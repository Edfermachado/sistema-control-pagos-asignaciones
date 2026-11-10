import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import {
  AccrualStatus,
  ProjectStatus,
} from '../../common/constants/domain.enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertProjectAllowsNewAccruals } from '../projects/domain/project-validity.helper';
import {
  calculateProratedAccrual,
  calculateTotalCalendarDays,
} from './domain/proration.calculator';
import { GenerateAccrualBatchDto } from './dto/generate-accrual-batch.dto';

export interface AccrualPreviewItem {
  assignmentId: string;
  beneficiaryId: string;
  beneficiaryName: string;
  activeDays: number;
  totalPeriodDays: number;
  proratedAmount: string;
}

export interface AccrualBatchPreview {
  projectId: string;
  paymentGroupId: string;
  periodStart: string;
  periodEnd: string;
  totalPeriodDays: number;
  totalBatchAmount: string;
  items: AccrualPreviewItem[];
}

@Injectable()
export class AccrualsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Previsualiza el lote de causación por proyecto y período antes de persistirlo (RF 2.2 / RN-CAUS-04).
   */
  async previewAccrualBatch(
    dto: GenerateAccrualBatchDto,
  ): Promise<AccrualBatchPreview> {
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    const totalPeriodDays = calculateTotalCalendarDays(periodStart, periodEnd);

    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`El proyecto '${dto.projectId}' no existe.`);
    }

    assertProjectAllowsNewAccruals(
      {
        status: project.status as unknown as ProjectStatus,
        startDate: project.startDate,
        endDate: project.endDate,
      },
      periodStart,
      periodEnd,
    );

    const assignments = await this.prisma.assignment.findMany({
      where: {
        projectId: dto.projectId,
        paymentGroupId: dto.paymentGroupId,
        isActive: true,
      },
      include: { beneficiary: true },
    });

    let totalBatchDecimal = new Decimal('0.00');
    const items: AccrualPreviewItem[] = [];

    for (const assignment of assignments) {
      const calc = calculateProratedAccrual({
        amountPerPeriod: assignment.amountPerPeriod.toString(),
        periodStart,
        periodEnd,
        assignmentStart: assignment.startDate,
        assignmentEnd: assignment.endDate,
        projectStart: project.startDate,
        projectEnd: project.endDate,
      });

      if (calc.activeDays > 0 && calc.proratedAmount.gt(0)) {
        totalBatchDecimal = totalBatchDecimal.plus(calc.proratedAmount);
        items.push({
          assignmentId: assignment.id,
          beneficiaryId: assignment.beneficiaryId,
          beneficiaryName: assignment.beneficiary.fullName,
          activeDays: calc.activeDays,
          totalPeriodDays: calc.totalPeriodDays,
          proratedAmount: calc.proratedAmount.toFixed(2),
        });
      }
    }

    if (items.length === 0) {
      throw new BadRequestException(
        '[RN-CAUS-04] No existen asignaciones con días activos para causar en este proyecto y período.',
      );
    }

    return {
      projectId: dto.projectId,
      paymentGroupId: dto.paymentGroupId,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      totalPeriodDays,
      totalBatchAmount: totalBatchDecimal.toFixed(2),
      items,
    };
  }

  /**
   * Genera y persiste atómicamente un lote de causación inmutable (RN-CAUS-01 a RN-CAUS-04).
   */
  async generateAccrualBatch(
    dto: GenerateAccrualBatchDto,
    actor: AuthenticatedUser,
  ) {
    const cleanCode = dto.code.trim().toUpperCase();
    const existingBatch = await this.prisma.accrualBatch.findUnique({
      where: { code: cleanCode },
    });

    if (existingBatch) {
      throw new ConflictException(
        `[RN-CAUS-04] Ya existe un lote de causación con el código '${cleanCode}'.`,
      );
    }

    const preview = await this.previewAccrualBatch(dto);
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);

    const existingAccruals = await this.prisma.accrual.findMany({
      where: {
        assignmentId: { in: preview.items.map((i) => i.assignmentId) },
        periodStart,
        periodEnd,
        status: { not: AccrualStatus.ANULADO },
      },
    });

    if (existingAccruals.length > 0) {
      throw new ConflictException(
        '[RN-CAUS-04] Una o más asignaciones ya fueron causadas en este mismo período.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.accrualBatch.create({
        data: {
          code: cleanCode,
          projectId: dto.projectId,
          paymentGroupId: dto.paymentGroupId,
          periodStart,
          periodEnd,
          totalDays: preview.totalPeriodDays,
          totalAmount: preview.totalBatchAmount,
          generatedById: actor.id,
        },
      });

      const createdAccruals = [];
      for (const item of preview.items) {
        const accrual = await tx.accrual.create({
          data: {
            batchId: batch.id,
            assignmentId: item.assignmentId,
            beneficiaryId: item.beneficiaryId,
            projectId: dto.projectId,
            periodStart,
            periodEnd,
            activeDays: item.activeDays,
            totalPeriodDays: item.totalPeriodDays,
            proratedAmount: item.proratedAmount,
            paidAmount: '0.00',
            balanceDue: item.proratedAmount,
            status: AccrualStatus.PENDIENTE,
          },
        });
        createdAccruals.push(accrual);
      }

      await this.auditService.recordLog(
        {
          userId: actor.id,
          userRole: actor.role,
          action: 'GENERATE_ACCRUAL_BATCH',
          tableName: 'accrual_batches',
          recordId: batch.id,
          oldValues: null,
          newValues: {
            code: batch.code,
            projectId: batch.projectId,
            totalAmount: preview.totalBatchAmount,
            accrualCount: createdAccruals.length,
          },
        },
        tx,
      );

      return { batch, accruals: createdAccruals };
    });
  }

  /**
   * Lista las causaciones pendientes o parciales de un beneficiario ordenadas por antigüedad FIFO.
   */
  async findPendingAccrualsByBeneficiary(beneficiaryId: string) {
    return this.prisma.accrual.findMany({
      where: {
        beneficiaryId,
        status: { in: [AccrualStatus.PENDIENTE, AccrualStatus.PARCIAL] },
      },
      orderBy: [{ periodStart: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  /**
   * Lista todas las causaciones del libro mayor con relaciones a beneficiario, proyecto y lote.
   */
  async findAllAccruals() {
    return this.prisma.accrual.findMany({
      include: {
        beneficiary: true,
        project: true,
        batch: true,
      },
      orderBy: [{ periodStart: 'asc' }, { createdAt: 'asc' }],
    });
  }
}
