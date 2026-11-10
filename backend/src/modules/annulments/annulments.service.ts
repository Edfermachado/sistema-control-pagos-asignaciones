import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AnnulledEntityType } from '@prisma/client';
import {
  AccrualStatus,
  PaymentStatus,
} from '../../common/constants/domain.enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  toUsdDecimal,
  validateAnnulmentReason,
} from '../../common/domain/money.helper';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { calculateAccrualStateAfterPaymentReversal } from './domain/annulment-reversal.calculator';

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

      await tx.paymentRequest.update({
        where: { id: payment.paymentRequestId },
        data: {
          paidAmount: updatedRequestPaid,
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
          },
          newValues: {
            status: PaymentStatus.ANULADO,
            reason: cleanReason,
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

    return this.prisma.$transaction(async (tx) => {
      const updatedAccrual = await tx.accrual.update({
        where: { id: accrualId },
        data: {
          status: AccrualStatus.ANULADO,
          balanceDue: '0.00',
        },
      });

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
}

function DecimalMaxZero(value: ReturnType<typeof toUsdDecimal>): string {
  return value.lt(0) ? '0.00' : value.toFixed(2);
}
