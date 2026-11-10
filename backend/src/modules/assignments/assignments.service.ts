import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectStatus } from '../../common/constants/domain.enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { assertPositiveUsdAmount } from '../../common/domain/money.helper';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertValidAssignmentWindowAndNoOverlap } from './domain/assignment-overlap.helper';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

export interface AssignmentFilter {
  projectId?: string;
  beneficiaryId?: string;
  paymentGroupId?: string;
  onlyActive?: boolean;
}

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Crea una asignación (Beneficiario x Proyecto x Grupo de Pago) en USD cumpliendo RN-CAT-02 y RN-CAT-04.
   */
  async createAssignment(dto: CreateAssignmentDto, actor: AuthenticatedUser) {
    const amountDecimal = assertPositiveUsdAmount(
      dto.amountPerPeriod,
      'amountPerPeriod',
    );

    const [beneficiary, project, paymentGroup] = await Promise.all([
      this.prisma.beneficiary.findUnique({ where: { id: dto.beneficiaryId } }),
      this.prisma.project.findUnique({ where: { id: dto.projectId } }),
      this.prisma.paymentGroup.findUnique({ where: { id: dto.paymentGroupId } }),
    ]);

    if (!beneficiary || !beneficiary.isActive) {
      throw new NotFoundException(
        'El beneficiario seleccionado no existe o se encuentra inactivo.',
      );
    }

    if (!project) {
      throw new NotFoundException('El proyecto seleccionado no existe.');
    }

    if (project.status !== ProjectStatus.ACTIVO) {
      throw new BadRequestException(
        `[RN-CAT-02] No se pueden crear asignaciones en un proyecto con estado '${project.status}'.`,
      );
    }

    if (!paymentGroup || !paymentGroup.isActive) {
      throw new NotFoundException(
        'El grupo de pago seleccionado no existe o está inactivo.',
      );
    }

    const existingSameProject = await this.prisma.assignment.findMany({
      where: {
        beneficiaryId: dto.beneficiaryId,
        projectId: dto.projectId,
        isActive: true,
      },
      select: { startDate: true, endDate: true },
    });

    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : project.endDate;

    assertValidAssignmentWindowAndNoOverlap(
      { startDate, endDate },
      { startDate: project.startDate, endDate: project.endDate },
      existingSameProject,
    );

    const created = await this.prisma.assignment.create({
      data: {
        beneficiaryId: dto.beneficiaryId,
        projectId: dto.projectId,
        paymentGroupId: dto.paymentGroupId,
        amountPerPeriod: amountDecimal.toFixed(2),
        startDate,
        endDate,
        isActive: true,
      },
      include: {
        beneficiary: true,
        project: true,
        paymentGroup: true,
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'CREATE_ASSIGNMENT',
      tableName: 'assignments',
      recordId: created.id,
      oldValues: null,
      newValues: {
        beneficiaryId: created.beneficiaryId,
        projectId: created.projectId,
        paymentGroupId: created.paymentGroupId,
        amountPerPeriod: amountDecimal.toFixed(2),
      },
    });

    return created;
  }

  /**
   * Lista las asignaciones registradas con filtros por proyecto, beneficiario o grupo de pago.
   */
  async findAllAssignments(filter: AssignmentFilter = {}) {
    return this.prisma.assignment.findMany({
      where: {
        ...(filter.projectId ? { projectId: filter.projectId } : {}),
        ...(filter.beneficiaryId ? { beneficiaryId: filter.beneficiaryId } : {}),
        ...(filter.paymentGroupId
          ? { paymentGroupId: filter.paymentGroupId }
          : {}),
        ...(filter.onlyActive !== undefined
          ? { isActive: filter.onlyActive }
          : {}),
      },
      include: {
        beneficiary: true,
        project: true,
        paymentGroup: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Finaliza o desactiva una asignación activa registrando auditoría (RN-AUD-03).
   */
  async deactivateAssignment(
    id: string,
    endDateIso: string | undefined,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.prisma.assignment.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`La asignación con ID '${id}' no existe.`);
    }

    const effectiveEndDate = endDateIso ? new Date(endDateIso) : existing.endDate;

    const updated = await this.prisma.assignment.update({
      where: { id },
      data: {
        isActive: false,
        endDate: effectiveEndDate,
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'DEACTIVATE_ASSIGNMENT',
      tableName: 'assignments',
      recordId: id,
      oldValues: { isActive: existing.isActive, endDate: existing.endDate },
      newValues: { isActive: false, endDate: effectiveEndDate },
    });

    return updated;
  }
}
