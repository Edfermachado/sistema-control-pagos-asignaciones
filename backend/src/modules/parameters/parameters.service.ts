import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateSystemParameterDto,
  UpdateSystemParameterDto,
} from './dto/system-parameter.dto';

@Injectable()
export class ParametersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Lista los parámetros globales del sistema ordenados por clave (RF 2.1 / RN-SEG-02).
   */
  async findAll() {
    return this.prisma.systemParameter.findMany({
      orderBy: { key: 'asc' },
    });
  }

  /**
   * Crea un parámetro global administrado exclusivamente por el ADMIN (RF 2.1).
   */
  async create(dto: CreateSystemParameterDto, actor: AuthenticatedUser) {
    const cleanKey = dto.key.trim().toUpperCase();
    const existing = await this.prisma.systemParameter.findUnique({
      where: { key: cleanKey },
    });

    if (existing) {
      throw new ConflictException(
        `[RN-SEG-02] Ya existe un parámetro con la clave '${cleanKey}'.`,
      );
    }

    const created = await this.prisma.systemParameter.create({
      data: {
        key: cleanKey,
        value: dto.value.trim(),
        description: dto.description.trim(),
        updatedById: actor.id,
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'CREATE_SYSTEM_PARAMETER',
      tableName: 'system_parameters',
      recordId: created.id,
      oldValues: null,
      newValues: {
        key: created.key,
        value: created.value,
        description: created.description,
      },
    });

    return created;
  }

  /**
   * Actualiza el valor o la descripción de un parámetro global (RF 2.1).
   */
  async update(
    id: string,
    dto: UpdateSystemParameterDto,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.prisma.systemParameter.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(
        `El parámetro del sistema con ID '${id}' no existe.`,
      );
    }

    const updated = await this.prisma.systemParameter.update({
      where: { id },
      data: {
        ...(dto.value !== undefined ? { value: dto.value.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() }
          : {}),
        updatedById: actor.id,
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'UPDATE_SYSTEM_PARAMETER',
      tableName: 'system_parameters',
      recordId: id,
      oldValues: {
        value: existing.value,
        description: existing.description,
      },
      newValues: {
        value: updated.value,
        description: updated.description,
      },
    });

    return updated;
  }

  /**
   * Elimina un parámetro global. Solo el ADMIN puede hacerlo (RF 2.1).
   */
  async remove(id: string, actor: AuthenticatedUser) {
    const existing = await this.prisma.systemParameter.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(
        `El parámetro del sistema con ID '${id}' no existe.`,
      );
    }

    await this.prisma.systemParameter.delete({ where: { id } });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'DELETE_SYSTEM_PARAMETER',
      tableName: 'system_parameters',
      recordId: id,
      oldValues: {
        key: existing.key,
        value: existing.value,
        description: existing.description,
      },
      newValues: null,
    });

    return { deleted: true, id };
  }
}
