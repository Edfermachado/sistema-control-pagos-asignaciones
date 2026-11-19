import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccrualStatus,
  PaymentRequestStatus,
  PaymentStatus,
} from '../../common/constants/domain.enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { buildSystemDocumentCode } from '../../common/domain/document-code.generator';
import { toUsdDecimal } from '../../common/domain/money.helper';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { allocatePaymentFifo } from './domain/fifo-allocator.calculator';
import { RegisterPaymentDto } from './dto/register-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Registra la entrega de fondos (total o parcial) aplicando prelación FIFO sobre las deudas más antiguas (RN-PAG-02).
   * Nota RN-CAT-02: Permite pagar deudas ya causadas aunque el proyecto haya vencido.
   */
  async registerPayment(dto: RegisterPaymentDto, actor: AuthenticatedUser) {
    const cleanReceipt = dto.receiptCode?.trim()
      ? dto.receiptCode.trim().toUpperCase()
      : await this.generateNextReceiptCode(dto.paymentDate);

    return this.prisma.$transaction(async (tx) => {
      const paymentRepo = tx.payment ?? this.prisma.payment;
      const requestRepo = tx.paymentRequest ?? this.prisma.paymentRequest;
      const accrualRepo = tx.accrual ?? this.prisma.accrual;
      const paramRepo = tx.systemParameter ?? this.prisma.systemParameter;

      const existingReceipt = await paymentRepo.findUnique({
        where: { receiptCode: cleanReceipt },
      });

      if (existingReceipt) {
        throw new ConflictException(
          `[RN-PAG-02] Ya existe un pago registrado con el código de recibo '${cleanReceipt}'.`,
        );
      }

      const request = await requestRepo.findUnique({
        where: { id: dto.paymentRequestId },
        include: {
          items: {
            include: { accrual: true },
          },
        },
      });

      if (!request) {
        throw new NotFoundException(
          `La solicitud de pago '${dto.paymentRequestId}' no existe.`,
        );
      }

      const validPayableStatuses: string[] = [
        PaymentRequestStatus.APROBADA,
        PaymentRequestStatus.ENTREGADA,
      ];

      if (!validPayableStatuses.includes(request.status)) {
        throw new BadRequestException(
          `[RN-PAG-01] Solo se pueden registrar pagos sobre solicitudes en estado APROBADA o ENTREGADA (estado actual: ${request.status}).`,
        );
      }

      const requestPendingAmount = toUsdDecimal(request.totalAmount.toString())
        .minus(toUsdDecimal(request.paidAmount.toString()));

      if (toUsdDecimal(dto.amount).gt(requestPendingAmount)) {
        throw new BadRequestException(
          `[RN-PAG-02] El pago ($${toUsdDecimal(dto.amount).toFixed(2)}) supera el saldo pendiente de la solicitud ($${requestPendingAmount.toFixed(2)}).`,
        );
      }

      const scopeParam = await paramRepo?.findUnique?.({
        where: { key: 'PAYMENT_REQUEST_SCOPE' },
      });

      // RN-PAG-02: por defecto (REQUEST_ITEMS) el pago se aplica exclusivamente a las
      // causaciones incluidas en la solicitud; si PAYMENT_REQUEST_SCOPE = PROJECT_ACCRUALS,
      // cubre todas las causaciones pendientes del beneficiario en el proyecto.
      const pendingAccruals =
        scopeParam?.value.trim().toUpperCase() === 'PROJECT_ACCRUALS'
          ? await accrualRepo.findMany({
              where: {
                projectId: request.projectId,
                beneficiaryId: dto.beneficiaryId,
                status: { in: [AccrualStatus.PENDIENTE, AccrualStatus.PARCIAL] },
              },
            })
          : request.items
              .map((item) => item.accrual)
              .filter(
                (accrual) =>
                  accrual.beneficiaryId === dto.beneficiaryId &&
                  (accrual.status === AccrualStatus.PENDIENTE ||
                    accrual.status === AccrualStatus.PARCIAL) &&
                  toUsdDecimal(accrual.balanceDue.toString()).gt(0),
              );

      const fifoPlan = allocatePaymentFifo(
        dto.amount,
        pendingAccruals.map((a) => ({
          id: a.id,
          periodStart: a.periodStart,
          periodEnd: a.periodEnd,
          createdAt: a.createdAt,
          paidAmount: a.paidAmount.toString(),
          balanceDue: a.balanceDue.toString(),
        })),
      );

      const newRequestPaidAmount = toUsdDecimal(request.paidAmount.toString())
        .plus(toUsdDecimal(fifoPlan.paymentAmount))
        .toFixed(2);

      const payment = await paymentRepo.create({
        data: {
          receiptCode: cleanReceipt,
          paymentRequestId: dto.paymentRequestId,
          beneficiaryId: dto.beneficiaryId,
          deliveredById: actor.id,
          amount: fifoPlan.paymentAmount,
          paymentDate: new Date(dto.paymentDate),
          reference: dto.reference ? dto.reference.trim() : null,
          notes: dto.notes ? dto.notes.trim() : null,
          status: PaymentStatus.VALIDO,
        },
      });

      const createdAllocations = [];
      for (const step of fifoPlan.allocations) {
        const allocation = await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            accrualId: step.accrualId,
            allocatedAmount: step.allocatedAmount,
          },
        });
        createdAllocations.push(allocation);

        await accrualRepo.update({
          where: { id: step.accrualId },
          data: {
            paidAmount: step.newPaidAmount,
            balanceDue: step.newBalanceDue,
            status: step.newStatus,
          },
        });
      }

      await requestRepo.update({
        where: { id: request.id },
        data: {
          paidAmount: newRequestPaidAmount,
          status: PaymentRequestStatus.ENTREGADA,
        },
      });

      await this.auditService.recordLog(
        {
          userId: actor.id,
          userRole: actor.role,
          action: 'REGISTER_FIFO_PAYMENT',
          tableName: 'payments',
          recordId: payment.id,
          oldValues: {
            totalDebtBeforePayment: fifoPlan.totalDebtBeforePayment,
          },
          newValues: {
            receiptCode: payment.receiptCode,
            paymentAmount: fifoPlan.paymentAmount,
            remainingDebtAfterPayment: fifoPlan.remainingDebtAfterPayment,
            allocations: fifoPlan.allocations,
          },
        },
        tx,
      );

      return {
        payment,
        allocations: createdAllocations,
        fifoSummary: fifoPlan,
      };
    });
  }

  /**
   * Lista los pagos realizados con su desglose FIFO (payment_allocations).
   */
  async findAllPayments(beneficiaryId?: string, paymentRequestId?: string) {
    return this.prisma.payment.findMany({
      where: {
        ...(beneficiaryId ? { beneficiaryId } : {}),
        ...(paymentRequestId ? { paymentRequestId } : {}),
      },
      include: {
        beneficiary: true,
        paymentRequest: { include: { project: true } },
        allocations: { include: { accrual: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async generateNextReceiptCode(
    paymentDateIso: string,
  ): Promise<string> {
    const year =
      String(paymentDateIso ?? '').slice(0, 4) ||
      String(new Date().getUTCFullYear());
    let seq =
      (typeof this.prisma.payment.count === 'function'
        ? await this.prisma.payment.count()
        : 0) + 1;

    while (true) {
      const candidate = buildSystemDocumentCode({
        prefix: 'REC',
        contextCode: year,
        sequence: seq,
        padLength: 4,
      });
      const existing = await this.prisma.payment.findUnique({
        where: { receiptCode: candidate },
      });
      if (!existing) {
        return candidate;
      }
      seq += 1;
    }
  }
}
