import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import {
  AccrualStatus,
  PaymentRequestStatus,
} from '../../common/constants/domain.enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { toUsdDecimal } from '../../common/domain/money.helper';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  assertPaymentRequestCanBeClosed,
  assertValidPaymentRequestTransition,
} from './domain/payment-request-state.machine';
import {
  CreatePaymentRequestDto,
  ReviewPaymentRequestDto,
} from './dto/payment-request.dto';

@Injectable()
export class PaymentRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Crea una Solicitud de Pago agrupando causaciones con deuda pendiente del proyecto (RN-PAG-01).
   */
  async createPaymentRequest(
    dto: CreatePaymentRequestDto,
    actor: AuthenticatedUser,
  ) {
    const cleanCode = dto.code.trim().toUpperCase();
    const existing = await this.prisma.paymentRequest.findUnique({
      where: { code: cleanCode },
    });

    if (existing) {
      throw new ConflictException(
        `[RN-PAG-01] Ya existe una solicitud de pago con el código '${cleanCode}'.`,
      );
    }

    const accruals = await this.prisma.accrual.findMany({
      where: {
        id: { in: dto.accrualIds },
        projectId: dto.projectId,
        status: { in: [AccrualStatus.PENDIENTE, AccrualStatus.PARCIAL] },
      },
    });

    if (accruals.length !== dto.accrualIds.length) {
      throw new BadRequestException(
        '[RN-PAG-01] Todas las causaciones incluidas deben pertenecer al proyecto y tener saldo pendiente.',
      );
    }

    let totalRequested = new Decimal('0.00');
    for (const acc of accruals) {
      totalRequested = totalRequested.plus(toUsdDecimal(acc.balanceDue.toString()));
    }

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.paymentRequest.create({
        data: {
          code: cleanCode,
          projectId: dto.projectId,
          createdById: actor.id,
          totalAmount: totalRequested.toFixed(2),
          paidAmount: '0.00',
          status: PaymentRequestStatus.CREADA,
          items: {
            create: accruals.map((acc) => ({
              accrualId: acc.id,
              requestedAmount: toUsdDecimal(acc.balanceDue.toString()).toFixed(2),
            })),
          },
        },
        include: { items: true },
      });

      await this.auditService.recordLog(
        {
          userId: actor.id,
          userRole: actor.role,
          action: 'CREATE_PAYMENT_REQUEST',
          tableName: 'payment_requests',
          recordId: request.id,
          oldValues: null,
          newValues: {
            code: request.code,
            totalAmount: totalRequested.toFixed(2),
            status: PaymentRequestStatus.CREADA,
          },
        },
        tx,
      );

      return request;
    });
  }

  /**
   * Envía la solicitud a Gerencia pasando de CREADA a ENVIADA (RN-PAG-01).
   */
  async sendPaymentRequest(id: string, actor: AuthenticatedUser) {
    const existing = await this.prisma.paymentRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`La solicitud de pago '${id}' no existe.`);
    }

    assertValidPaymentRequestTransition(
      existing.status as unknown as PaymentRequestStatus,
      PaymentRequestStatus.ENVIADA,
    );

    const updated = await this.prisma.paymentRequest.update({
      where: { id },
      data: {
        status: PaymentRequestStatus.ENVIADA,
        sentAt: new Date(),
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'SEND_PAYMENT_REQUEST',
      tableName: 'payment_requests',
      recordId: id,
      oldValues: { status: existing.status },
      newValues: { status: PaymentRequestStatus.ENVIADA },
    });

    return updated;
  }

  /**
   * Aprueba o rechaza una solicitud enviada (Exclusivo RECEPTOR según RN-SEG-02 y RN-PAG-01).
   */
  async reviewPaymentRequest(
    id: string,
    dto: ReviewPaymentRequestDto,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.prisma.paymentRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`La solicitud de pago '${id}' no existe.`);
    }

    assertValidPaymentRequestTransition(
      existing.status as unknown as PaymentRequestStatus,
      dto.decision,
    );

    if (
      dto.decision === PaymentRequestStatus.RECHAZADA &&
      (!dto.rejectionReason || dto.rejectionReason.trim().length < 5)
    ) {
      throw new BadRequestException(
        '[RN-PAG-01] Para rechazar una solicitud debe indicar un motivo de rechazo claro.',
      );
    }

    const updated = await this.prisma.paymentRequest.update({
      where: { id },
      data: {
        status: dto.decision,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        rejectionReason:
          dto.decision === PaymentRequestStatus.RECHAZADA
            ? dto.rejectionReason?.trim()
            : null,
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: `REVIEW_PAYMENT_REQUEST_${dto.decision}`,
      tableName: 'payment_requests',
      recordId: id,
      oldValues: { status: existing.status },
      newValues: {
        status: dto.decision,
        rejectionReason: updated.rejectionReason,
      },
    });

    return updated;
  }

  /**
   * Cierra formalmente una solicitud de pago cuya deuda fue pagada en su totalidad (RN-PAG-01).
   */
  async closePaymentRequest(id: string, actor: AuthenticatedUser) {
    const existing = await this.prisma.paymentRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`La solicitud de pago '${id}' no existe.`);
    }

    assertPaymentRequestCanBeClosed(
      existing.status as unknown as PaymentRequestStatus,
      existing.totalAmount.toString(),
      existing.paidAmount.toString(),
    );

    const updated = await this.prisma.paymentRequest.update({
      where: { id },
      data: {
        status: PaymentRequestStatus.CERRADA,
        closedAt: new Date(),
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'CLOSE_PAYMENT_REQUEST',
      tableName: 'payment_requests',
      recordId: id,
      oldValues: { status: existing.status },
      newValues: { status: PaymentRequestStatus.CERRADA },
    });

    return updated;
  }

  /**
   * Lista las solicitudes de pago con filtros opcionales por proyecto y estado.
   */
  async findAllPaymentRequests(
    projectId?: string,
    status?: PaymentRequestStatus,
  ) {
    return this.prisma.paymentRequest.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        project: true,
        items: { include: { accrual: { include: { beneficiary: true } } } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
