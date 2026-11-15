import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { buildDefaultPaymentPeriods } from './domain/payment-period.generator';
import {
  CreatePaymentGroupDto,
  CreatePaymentGroupPeriodDto,
  UpdatePaymentGroupDto,
} from './dto/create-payment-group.dto';

@Injectable()
export class PaymentGroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Configura un grupo de pago y genera automáticamente sus períodos estándar
   * para el año actual y el siguiente (RN-CAT-03).
   */
  async createPaymentGroup(
    dto: CreatePaymentGroupDto,
    actor: AuthenticatedUser,
  ) {
    const cleanName = (dto.name ?? '').trim();
    const cleanCutoff = (dto.cutoffRules ?? '').trim();

    if (!cleanName || !cleanCutoff) {
      throw new BadRequestException(
        '[RN-CAT-03] El nombre y las reglas de corte del grupo de pago son obligatorios.',
      );
    }

    const existing = await this.prisma.paymentGroup.findUnique({
      where: { name: cleanName },
    });

    if (existing) {
      throw new ConflictException(
        `[RN-CAT-03] Ya existe un grupo de pago llamado '${cleanName}'.`,
      );
    }

    const currentYear = new Date().getUTCFullYear();
    const defaultPeriods = [
      ...buildDefaultPaymentPeriods(dto.periodicity, currentYear),
      ...buildDefaultPaymentPeriods(dto.periodicity, currentYear + 1),
    ];

    const created = await this.prisma.$transaction(async (tx) => {
      const group = await tx.paymentGroup.create({
        data: {
          name: cleanName,
          periodicity: dto.periodicity,
          cutoffRules: cleanCutoff,
          isActive: true,
        },
      });

      await tx.paymentGroupPeriod.createMany({
        data: defaultPeriods.map((period) => ({
          paymentGroupId: group.id,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          label: period.label,
        })),
        skipDuplicates: true,
      });

      return group;
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'CREATE_PAYMENT_GROUP',
      tableName: 'payment_groups',
      recordId: created.id,
      oldValues: null,
      newValues: {
        name: created.name,
        periodicity: created.periodicity,
        cutoffRules: created.cutoffRules,
        generatedPeriods: defaultPeriods.length,
      },
    });

    return created;
  }

  /**
   * Actualiza la configuración del grupo de pago (RN-CAT-03).
   */
  async updatePaymentGroup(
    id: string,
    dto: UpdatePaymentGroupDto,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.prisma.paymentGroup.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(
        `El grupo de pago con ID '${id}' no existe.`,
      );
    }

    if (dto.name && dto.name.trim() !== existing.name) {
      const duplicate = await this.prisma.paymentGroup.findUnique({
        where: { name: dto.name.trim() },
      });
      if (duplicate) {
        throw new ConflictException(
          `[RN-CAT-03] Ya existe un grupo de pago llamado '${dto.name.trim()}'.`,
        );
      }
    }

    const updated = await this.prisma.paymentGroup.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.periodicity !== undefined
          ? { periodicity: dto.periodicity }
          : {}),
        ...(dto.cutoffRules !== undefined
          ? { cutoffRules: dto.cutoffRules.trim() }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'UPDATE_PAYMENT_GROUP',
      tableName: 'payment_groups',
      recordId: id,
      oldValues: {
        name: existing.name,
        periodicity: existing.periodicity,
        cutoffRules: existing.cutoffRules,
        isActive: existing.isActive,
      },
      newValues: {
        name: updated.name,
        periodicity: updated.periodicity,
        cutoffRules: updated.cutoffRules,
        isActive: updated.isActive,
      },
    });

    return updated;
  }

  /**
   * Lista los grupos de pago activos o todos si se solicita.
   */
  async findAllPaymentGroups(onlyActive = true) {
    return this.prisma.paymentGroup.findMany({
      where: onlyActive ? { isActive: true } : {},
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Lista las fechas de corte configuradas para un grupo de pago.
   */
  async findPeriods(paymentGroupId: string) {
    return this.prisma.paymentGroupPeriod.findMany({
      where: { paymentGroupId },
      orderBy: { periodStart: 'asc' },
    });
  }

  /**
   * Agrega una fecha de corte personalizada, verificando que no se solape.
   */
  async createPeriod(
    paymentGroupId: string,
    dto: CreatePaymentGroupPeriodDto,
    actor: AuthenticatedUser,
  ) {
    const group = await this.prisma.paymentGroup.findUnique({
      where: { id: paymentGroupId },
    });
    if (!group) {
      throw new NotFoundException(
        `El grupo de pago con ID '${paymentGroupId}' no existe.`,
      );
    }

    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    if (periodEnd < periodStart) {
      throw new BadRequestException(
        '[RN-CAT-03] La fecha fin del período no puede ser anterior a la fecha inicio.',
      );
    }

    const overlap = await this.prisma.paymentGroupPeriod.findFirst({
      where: {
        paymentGroupId,
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
    });
    if (overlap) {
      throw new ConflictException(
        '[RN-CAT-03] El período se solapa con una fecha de corte ya configurada.',
      );
    }

    const created = await this.prisma.paymentGroupPeriod.create({
      data: {
        paymentGroupId,
        periodStart,
        periodEnd,
        label: dto.label?.trim() || null,
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'CREATE_PAYMENT_GROUP_PERIOD',
      tableName: 'payment_group_periods',
      recordId: created.id,
      oldValues: null,
      newValues: {
        paymentGroupId,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
        label: created.label,
      },
    });

    return created;
  }

  /**
   * Elimina una fecha de corte configurada.
   */
  async removePeriod(
    paymentGroupId: string,
    periodId: string,
    actor: AuthenticatedUser,
  ) {
    const period = await this.prisma.paymentGroupPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period || period.paymentGroupId !== paymentGroupId) {
      throw new NotFoundException(
        `El período de pago con ID '${periodId}' no existe en este grupo.`,
      );
    }

    const accrualInPeriod = await this.prisma.accrualBatch.findFirst({
      where: {
        paymentGroupId,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
      },
      select: { id: true },
    });
    if (accrualInPeriod) {
      throw new ConflictException(
        '[RN-CAT-03] No se puede eliminar un período que ya tiene lotes de causación asociados.',
      );
    }

    await this.prisma.paymentGroupPeriod.delete({ where: { id: periodId } });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'DELETE_PAYMENT_GROUP_PERIOD',
      tableName: 'payment_group_periods',
      recordId: periodId,
      oldValues: {
        paymentGroupId,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        label: period.label,
      },
      newValues: null,
    });

    return { deleted: true, id: periodId };
  }
}
