import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePaymentGroupDto } from './dto/create-payment-group.dto';

@Injectable()
export class PaymentGroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Configura un grupo de pago con su periodicidad y reglas de corte (RN-CAT-03).
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

    const created = await this.prisma.paymentGroup.create({
      data: {
        name: cleanName,
        periodicity: dto.periodicity,
        cutoffRules: cleanCutoff,
        isActive: true,
      },
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
      },
    });

    return created;
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
}
