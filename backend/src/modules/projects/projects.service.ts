import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ProjectArea,
  ProjectStatus,
} from '../../common/constants/domain.enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { buildSystemDocumentCode } from '../../common/domain/document-code.generator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertValidProjectDateRange } from './domain/project-validity.helper';
import {
  CreateProjectDto,
  UpdateProjectDto,
} from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Crea un proyecto validando área (Física/Química/Biología), ámbito y vigencia (RN-CAT-01).
   * Si no se indica código, el sistema lo genera automáticamente según área y año.
   */
  async createProject(dto: CreateProjectDto, actor: AuthenticatedUser) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    assertValidProjectDateRange(startDate, endDate);

    const cleanCode = dto.code?.trim()
      ? dto.code.trim().toUpperCase()
      : await this.generateNextProjectCode(dto.area, startDate.getUTCFullYear());

    const existing = await this.prisma.project.findUnique({
      where: { code: cleanCode },
    });

    if (existing) {
      throw new ConflictException(
        `[RN-CAT-01] Ya existe un proyecto con el código '${cleanCode}'.`,
      );
    }

    const created = await this.prisma.project.create({
      data: {
        code: cleanCode,
        name: dto.name.trim(),
        area: dto.area,
        scope: dto.scope,
        startDate,
        endDate,
        status: ProjectStatus.ACTIVO,
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'CREATE_PROJECT',
      tableName: 'projects',
      recordId: created.id,
      oldValues: null,
      newValues: {
        code: created.code,
        name: created.name,
        area: created.area,
        scope: created.scope,
        startDate: dto.startDate,
        endDate: dto.endDate,
      },
    });

    return created;
  }

  /**
   * Actualiza los datos de un proyecto manteniendo la vigencia válida (RN-CAT-01).
   */
  async updateProject(
    id: string,
    dto: UpdateProjectDto,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.prisma.project.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`El proyecto con ID '${id}' no existe.`);
    }

    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : existing.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : existing.endDate;
    assertValidProjectDateRange(startDate, endDate);

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.area !== undefined ? { area: dto.area } : {}),
        ...(dto.scope !== undefined ? { scope: dto.scope } : {}),
        ...(dto.startDate !== undefined ? { startDate } : {}),
        ...(dto.endDate !== undefined ? { endDate } : {}),
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'UPDATE_PROJECT',
      tableName: 'projects',
      recordId: id,
      oldValues: {
        name: existing.name,
        area: existing.area,
        scope: existing.scope,
        startDate: existing.startDate,
        endDate: existing.endDate,
      },
      newValues: {
        name: updated.name,
        area: updated.area,
        scope: updated.scope,
        startDate: updated.startDate,
        endDate: updated.endDate,
      },
    });

    return updated;
  }

  /**
   * Lista proyectos con filtros opcionales por área científica y estado.
   */
  async findAllProjects(area?: ProjectArea, status?: ProjectStatus) {
    return this.prisma.project.findMany({
      where: {
        ...(area ? { area } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { startDate: 'desc' },
    });
  }

  /**
   * Actualiza el estado operativo de un proyecto (ACTIVO, INACTIVO, CERRADO) registrando auditoría.
   */
  async updateProjectStatus(
    id: string,
    status: ProjectStatus,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`El proyecto con ID '${id}' no existe.`);
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: { status },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'UPDATE_PROJECT_STATUS',
      tableName: 'projects',
      recordId: id,
      oldValues: { status: existing.status },
      newValues: { status: updated.status },
    });

    return updated;
  }

  private async generateNextProjectCode(
    area: ProjectArea,
    year: number,
  ): Promise<string> {
    const areaPrefix = area.slice(0, 3).toUpperCase();
    let seq =
      (typeof this.prisma.project.count === 'function'
        ? await this.prisma.project.count()
        : 0) + 1;

    while (true) {
      const candidate = buildSystemDocumentCode({
        prefix: areaPrefix,
        contextCode: String(year),
        sequence: seq,
        padLength: 2,
      });
      const existing = await this.prisma.project.findUnique({
        where: { code: candidate },
      });
      if (!existing) {
        return candidate;
      }
      seq += 1;
    }
  }
}
