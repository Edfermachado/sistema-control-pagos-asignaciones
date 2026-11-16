import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AnnulledEntityType } from '@prisma/client';
import {
  AccrualBatchStatus,
  AccrualStatus,
  PaymentRequestStatus,
  PaymentStatus,
  PettyCashPeriodStatus,
  PettyCashVoucherStatus,
  UserRole,
} from '../../common/constants/domain.enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  toUsdDecimal,
  validateAnnulmentReason,
} from '../../common/domain/money.helper';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertValidPaymentRequestTransition } from '../payment-requests/domain/payment-request-state.machine';
import { calculateAccrualStateAfterPaymentReversal } from './domain/annulment-reversal.calculator';

const ACTIVE_PAYMENT_REQUEST_STATUSES: PaymentRequestStatus[] = [
  PaymentRequestStatus.CREADA,
  PaymentRequestStatus.ENVIADA,
  PaymentRequestStatus.APROBADA,
  PaymentRequestStatus.ENTREGADA,
];

@Injectable()
export class AnnulmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Anula justificadamente un Pago confirmado, revirtiendo todos sus abonos FIFO de forma atómica.
   * Cumple RN-GLOB-03, RN-GLOB-04 y RN-PAG-03.
   */
  async annulPayment(
    paymentId: string,
    rawReason: string,
    actor: AuthenticatedUser,
  ) {
    const cleanReason = validateAnnulmentReason(rawReason);

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        allocations: { include: { accrual: true } },
        paymentRequest: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`El pago con ID '${paymentId}' no existe.`);
    }

    if (payment.status === PaymentStatus.ANULADO) {
      throw new ConflictException(
        `[RN-GLOB-04] El pago '${payment.receiptCode}' ya fue anulado previamente.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const allocation of payment.allocations) {
        const reversedState = calculateAccrualStateAfterPaymentReversal(
          allocation.accrual.paidAmount.toString(),
          allocation.accrual.balanceDue.toString(),
          allocation.allocatedAmount.toString(),
        );

        await tx.accrual.update({
          where: { id: allocation.accrualId },
          data: {
            paidAmount: reversedState.newPaidAmount,
            balanceDue: reversedState.newBalanceDue,
            status: reversedState.newStatus,
          },
        });
      }

      const currentRequestPaid = toUsdDecimal(
        payment.paymentRequest.paidAmount.toString(),
      );
      const paymentDec = toUsdDecimal(payment.amount.toString());
      const updatedRequestPaid = DecimalMaxZero(
        currentRequestPaid.minus(paymentDec),
      );

      // RN-PAG-01 / RN-PAG-03: si el pago era el único que sostenía la
      // solicitud, esta vuelve a APROBADA para permitir un nuevo pago.
      const reopenedStatus = toUsdDecimal(updatedRequestPaid).eq(0)
        ? PaymentRequestStatus.APROBADA
        : PaymentRequestStatus.ENTREGADA;

      await tx.paymentRequest.update({
        where: { id: payment.paymentRequestId },
        data: {
          paidAmount: updatedRequestPaid,
          status: reopenedStatus,
          ...(payment.paymentRequest.closedAt ? { closedAt: null } : {}),
        },
      });

      const annulledPayment = await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.ANULADO },
      });

      const annulmentRecord = await tx.annulment.create({
        data: {
          entityType: AnnulledEntityType.PAYMENT,
          entityId: paymentId,
          reason: cleanReason,
          annulledById: actor.id,
        },
      });

      await this.auditService.recordLog(
        {
          userId: actor.id,
          userRole: actor.role,
          action: 'ANNUL_PAYMENT',
          tableName: 'payments',
          recordId: paymentId,
          oldValues: {
            status: PaymentStatus.VALIDO,
            amount: payment.amount.toString(),
            requestStatus: payment.paymentRequest.status,
          },
          newValues: {
            status: PaymentStatus.ANULADO,
            reason: cleanReason,
            requestStatus: reopenedStatus,
            annulmentId: annulmentRecord.id,
          },
        },
        tx,
      );

      return { payment: annulledPayment, annulment: annulmentRecord };
    });
  }

  /**
   * Anula justificadamente una Causación que aún no haya recibido ningún pago (RN-GLOB-04 / RN-SEG-02).
   */
  async annulUnpaidAccrual(
    accrualId: string,
    rawReason: string,
    actor: AuthenticatedUser,
  ) {
    const cleanReason = validateAnnulmentReason(rawReason);

    const accrual = await this.prisma.accrual.findUnique({
      where: { id: accrualId },
    });

    if (!accrual) {
      throw new NotFoundException(
        `La causación con ID '${accrualId}' no existe.`,
      );
    }

    if (accrual.status === AccrualStatus.ANULADO) {
      throw new ConflictException(
        '[RN-GLOB-04] La causación ya se encuentra en estado ANULADO.',
      );
    }

    if (toUsdDecimal(accrual.paidAmount.toString()).gt(0)) {
      throw new BadRequestException(
        '[RN-GLOB-03] No se puede anular directamente una causación que ya posee pagos aplicados; primero debe anularse el pago correspondiente.',
      );
    }

    await this.assertAccrualsAreNotInActiveRequests([accrualId]);

    return this.prisma.$transaction(async (tx) => {
      const updatedAccrual = await tx.accrual.update({
        where: { id: accrualId },
        data: {
          status: AccrualStatus.ANULADO,
          balanceDue: '0.00',
        },
      });

      if (accrual.batchId && tx.accrualBatch) {
        const parentBatch = await tx.accrualBatch.findUnique({
          where: { id: accrual.batchId },
        });
        if (parentBatch) {
          const reducedBatchTotal = DecimalMaxZero(
            toUsdDecimal(parentBatch.totalAmount.toString()).minus(
              toUsdDecimal(
                (accrual.proratedAmount ?? accrual.balanceDue).toString(),
              ),
            ),
          );
          await tx.accrualBatch.update({
            where: { id: accrual.batchId },
            data: {
              totalAmount: reducedBatchTotal,
              ...(toUsdDecimal(reducedBatchTotal).eq(0)
                ? { status: AccrualBatchStatus.ANULADO }
                : {}),
            },
          });
        }
      }

      const annulmentRecord = await tx.annulment.create({
        data: {
          entityType: AnnulledEntityType.ACCRUAL,
          entityId: accrualId,
          reason: cleanReason,
          annulledById: actor.id,
        },
      });

      await this.auditService.recordLog(
        {
          userId: actor.id,
          userRole: actor.role,
          action: 'ANNUL_ACCRUAL',
          tableName: 'accruals',
          recordId: accrualId,
          oldValues: {
            status: accrual.status,
            balanceDue: accrual.balanceDue.toString(),
          },
          newValues: {
            status: AccrualStatus.ANULADO,
            balanceDue: '0.00',
            reason: cleanReason,
          },
        },
        tx,
      );

      return { accrual: updatedAccrual, annulment: annulmentRecord };
    });
  }

  /**
   * Anula un lote completo de causación cuando ninguna de sus causaciones tiene pagos.
   * Cumple RN-GLOB-03, RN-GLOB-04 y RN-CAUS-04.
   */
  async annulAccrualBatch(
    batchId: string,
    rawReason: string,
    actor: AuthenticatedUser,
  ) {
    const cleanReason = validateAnnulmentReason(rawReason);

    const batch = await this.prisma.accrualBatch.findUnique({
      where: { id: batchId },
      include: { accruals: true },
    });

    if (!batch) {
      throw new NotFoundException(
        `El lote de causación con ID '${batchId}' no existe.`,
      );
    }

    if (batch.status === AccrualBatchStatus.ANULADO) {
      throw new ConflictException(
        `[RN-GLOB-04] El lote '${batch.code}' ya fue anulado previamente.`,
      );
    }

    const paidAccrual = batch.accruals.find((accrual) =>
      toUsdDecimal(accrual.paidAmount.toString()).gt(0),
    );

    if (paidAccrual) {
      throw new BadRequestException(
        '[RN-GLOB-03] No se puede anular un lote con causaciones que ya poseen pagos aplicados; primero deben anularse los pagos.',
      );
    }

    await this.assertAccrualsAreNotInActiveRequests(
      batch.accruals.map((accrual) => accrual.id),
    );

    return this.prisma.$transaction(async (tx) => {
      const updatedBatch = await tx.accrualBatch.update({
        where: { id: batchId },
        data: { status: AccrualBatchStatus.ANULADO },
      });

      await tx.accrual.updateMany({
        where: { batchId },
        data: {
          status: AccrualStatus.ANULADO,
          balanceDue: '0.00',
        },
      });

      const annulmentRecord = await tx.annulment.create({
        data: {
          entityType: AnnulledEntityType.ACCRUAL_BATCH,
          entityId: batchId,
          reason: cleanReason,
          annulledById: actor.id,
        },
      });

      await this.auditService.recordLog(
        {
          userId: actor.id,
          userRole: actor.role,
          action: 'ANNUL_ACCRUAL_BATCH',
          tableName: 'accrual_batches',
          recordId: batchId,
          oldValues: {
            status: batch.status,
            code: batch.code,
            accrualCount: batch.accruals.length,
            totalAmount: batch.totalAmount.toString(),
          },
          newValues: {
            status: AccrualBatchStatus.ANULADO,
            reason: cleanReason,
          },
        },
        tx,
      );

      return { batch: updatedBatch, annulment: annulmentRecord };
    });
  }

  /**
   * Anula una solicitud de pago que no posea pagos válidos asociados.
   * Cumple RN-GLOB-04 y RN-PAG-01.
   */
  async annulPaymentRequest(
    paymentRequestId: string,
    rawReason: string,
    actor: AuthenticatedUser,
  ) {
    const cleanReason = validateAnnulmentReason(rawReason);

    const request = await this.prisma.paymentRequest.findUnique({
      where: { id: paymentRequestId },
      include: { payments: true },
    });

    if (!request) {
      throw new NotFoundException(
        `La solicitud de pago con ID '${paymentRequestId}' no existe.`,
      );
    }

    if (request.status === PaymentRequestStatus.ANULADA) {
      throw new ConflictException(
        `[RN-GLOB-04] La solicitud '${request.code}' ya fue anulada previamente.`,
      );
    }

    if (request.status === PaymentRequestStatus.RECHAZADA) {
      throw new BadRequestException(
        '[RN-PAG-01] Una solicitud RECHAZADA es inmutable y no requiere anulación.',
      );
    }

    const validPayment = request.payments.find(
      (payment) => payment.status === PaymentStatus.VALIDO,
    );

    if (
      validPayment ||
      toUsdDecimal(request.paidAmount.toString()).gt(0)
    ) {
      throw new BadRequestException(
        '[RN-GLOB-03] No se puede anular una solicitud con pagos válidos; primero deben anularse los pagos.',
      );
    }

    assertValidPaymentRequestTransition(
      request.status,
      PaymentRequestStatus.ANULADA,
    );

    return this.prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.paymentRequest.update({
        where: { id: paymentRequestId },
        data: { status: PaymentRequestStatus.ANULADA },
      });

      const annulmentRecord = await tx.annulment.create({
        data: {
          entityType: AnnulledEntityType.PAYMENT_REQUEST,
          entityId: paymentRequestId,
          reason: cleanReason,
          annulledById: actor.id,
        },
      });

      await this.auditService.recordLog(
        {
          userId: actor.id,
          userRole: actor.role,
          action: 'ANNUL_PAYMENT_REQUEST',
          tableName: 'payment_requests',
          recordId: paymentRequestId,
          oldValues: {
            status: request.status,
            code: request.code,
            totalAmount: request.totalAmount.toString(),
          },
          newValues: {
            status: PaymentRequestStatus.ANULADA,
            reason: cleanReason,
          },
        },
        tx,
      );

      return { paymentRequest: updatedRequest, annulment: annulmentRecord };
    });
  }

  /**
   * Anula un vale de caja chica y revierte el impacto en el saldo disponible.
   * El GENERADOR solo puede anular vales no desembolsados; el RECEPTOR puede
   * anular también vales desembolsados o rendidos (RN-GLOB-04 / RN-CAJA-03).
   */
  async annulPettyCashVoucher(
    voucherId: string,
    rawReason: string,
    actor: AuthenticatedUser,
  ) {
    const cleanReason = validateAnnulmentReason(rawReason);

    const voucher = await this.prisma.pettyCashVoucher.findUnique({
      where: { id: voucherId },
      include: { period: true },
    });

    if (!voucher) {
      throw new NotFoundException(`El vale '${voucherId}' no existe.`);
    }

    if (voucher.status === PettyCashVoucherStatus.ANULADO) {
      throw new ConflictException(
        `[RN-GLOB-04] El vale '${voucher.code}' ya fue anulado previamente.`,
      );
    }

    if (voucher.status === PettyCashVoucherStatus.RECHAZADO) {
      throw new BadRequestException(
        '[RN-CAJA-03] Un vale rechazado no requiere anulación.',
      );
    }

    if (voucher.period.status === PettyCashPeriodStatus.CERRADO) {
      throw new BadRequestException(
        '[RN-CAJA-04] No se puede anular un vale de un período ya cerrado.',
      );
    }

    if (
      actor.role === UserRole.GENERADOR &&
      voucher.status !== PettyCashVoucherStatus.SOLICITADO &&
      voucher.status !== PettyCashVoucherStatus.APROBADO
    ) {
      throw new ForbiddenException(
        '[RN-SEG-02] El GENERADOR solo puede anular vales solicitados o aprobados, no desembolsados o rendidos.',
      );
    }

    const reversalAmount = this.calculateVoucherAnnulmentReversal(voucher);
    const newAvailableBalance = toUsdDecimal(
      voucher.period.availableBalance.toString(),
    )
      .plus(reversalAmount)
      .toFixed(2);

    return this.prisma.$transaction(async (tx) => {
      if (reversalAmount.gt(0)) {
        await tx.pettyCashPeriod.update({
          where: { id: voucher.periodId },
          data: { availableBalance: newAvailableBalance },
        });
      }

      const updatedVoucher = await tx.pettyCashVoucher.update({
        where: { id: voucherId },
        data: { status: PettyCashVoucherStatus.ANULADO },
      });

      const annulmentRecord = await tx.annulment.create({
        data: {
          entityType: AnnulledEntityType.PETTY_CASH_VOUCHER,
          entityId: voucherId,
          reason: cleanReason,
          annulledById: actor.id,
        },
      });

      await this.auditService.recordLog(
        {
          userId: actor.id,
          userRole: actor.role,
          action: 'ANNUL_PETTY_CASH_VOUCHER',
          tableName: 'petty_cash_vouchers',
          recordId: voucherId,
          oldValues: {
            status: voucher.status,
            code: voucher.code,
            availableBalance: voucher.period.availableBalance.toString(),
          },
          newValues: {
            status: PettyCashVoucherStatus.ANULADO,
            availableBalance: newAvailableBalance,
            reason: cleanReason,
          },
        },
        tx,
      );

      return { voucher: updatedVoucher, annulment: annulmentRecord };
    });
  }

  /**
   * Lista todas las anulaciones justificadas registradas en el sistema.
   */
  async findAllAnnulments() {
    return this.prisma.annulment.findMany({
      include: {
        annulledBy: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Verifica que ninguna causación esté incluida en una solicitud activa.
   */
  private async assertAccrualsAreNotInActiveRequests(
    accrualIds: string[],
  ): Promise<void> {
    if (accrualIds.length === 0) {
      return;
    }

    const activeItem = await this.prisma.paymentRequestItem.findFirst({
      where: {
        accrualId: { in: accrualIds },
        paymentRequest: {
          status: { in: ACTIVE_PAYMENT_REQUEST_STATUSES },
        },
      },
      select: { id: true },
    });

    if (activeItem) {
      throw new BadRequestException(
        '[RN-PAG-01] No se puede anular una causación incluida en una solicitud de pago activa; primero debe anularse la solicitud.',
      );
    }
  }

  /**
   * Calcula el monto que debe devolverse al saldo de la caja chica al anular un vale.
   */
  private calculateVoucherAnnulmentReversal(voucher: {
    status: string;
    requestedAmount: unknown;
    disbursedAmount: unknown;
    settledAmount: unknown;
  }) {
    if (voucher.status === PettyCashVoucherStatus.DESEMBOLSADO) {
      return toUsdDecimal(
        (voucher.disbursedAmount ?? voucher.requestedAmount) as string,
      );
    }

    if (voucher.status === PettyCashVoucherStatus.RENDIDO) {
      return toUsdDecimal(
        (voucher.settledAmount ?? voucher.disbursedAmount) as string,
      );
    }

    return toUsdDecimal('0.00');
  }
}

function DecimalMaxZero(value: ReturnType<typeof toUsdDecimal>): string {
  return value.lt(0) ? '0.00' : value.toFixed(2);
}
