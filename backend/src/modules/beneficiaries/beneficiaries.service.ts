import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateBeneficiaryDto,
  UpdateBeneficiaryDto,
} from './dto/create-beneficiary.dto';

@Injectable()
export class BeneficiariesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Registra un beneficiario (personal que cobra sin usuario en el sistema según RN-SEG-01).
   */
  async createBeneficiary(
    dto: CreateBeneficiaryDto,
    actor: AuthenticatedUser,
  ) {
    const cleanDni = (dto.dni ?? '').trim().toUpperCase();
    const cleanName = (dto.fullName ?? '').trim();

    if (!cleanDni || !cleanName) {
      throw new BadRequestException(
        '[RN-SEG-01] El documento de identidad (DNI) y nombre completo del beneficiario son obligatorios.',
      );
    }

    const existing = await this.prisma.beneficiary.findUnique({
      where: { dni: cleanDni },
    });

    if (existing) {
      throw new ConflictException(
        `[RN-SEG-01] Ya existe un beneficiario registrado con el documento '${cleanDni}'.`,
      );
    }

    const created = await this.prisma.beneficiary.create({
      data: {
        dni: cleanDni,
        fullName: cleanName,
        email: dto.email ? dto.email.trim().toLowerCase() : null,
        phone: dto.phone ? dto.phone.trim() : null,
        bankInfo: dto.bankInfo ? dto.bankInfo.trim() : null,
        isActive: true,
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'CREATE_BENEFICIARY',
      tableName: 'beneficiaries',
      recordId: created.id,
      oldValues: null,
      newValues: {
        dni: created.dni,
        fullName: created.fullName,
        email: created.email,
      },
    });

    return created;
  }

  /**
   * Lista beneficiarios con filtro opcional de búsqueda por nombre o documento.
   */
  async findAllBeneficiaries(search?: string) {
    const cleanSearch = search?.trim();

    return this.prisma.beneficiary.findMany({
      where: cleanSearch
        ? {
            OR: [
              { fullName: { contains: cleanSearch, mode: 'insensitive' } },
              { dni: { contains: cleanSearch, mode: 'insensitive' } },
            ],
          }
        : {},
      orderBy: { fullName: 'asc' },
    });
  }

  /**
   * Actualiza los datos de contacto o bancarios de un beneficiario registrando auditoría (RN-AUD-03).
   */
  async updateBeneficiary(
    id: string,
    dto: UpdateBeneficiaryDto,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.prisma.beneficiary.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(
        `El beneficiario con ID '${id}' no se encuentra registrado.`,
      );
    }

    const updated = await this.prisma.beneficiary.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.email !== undefined
          ? { email: dto.email ? dto.email.trim().toLowerCase() : null }
          : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.bankInfo !== undefined ? { bankInfo: dto.bankInfo } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'UPDATE_BENEFICIARY',
      tableName: 'beneficiaries',
      recordId: id,
      oldValues: {
        fullName: existing.fullName,
        bankInfo: existing.bankInfo,
        isActive: existing.isActive,
      },
      newValues: {
        fullName: updated.fullName,
        bankInfo: updated.bankInfo,
        isActive: updated.isActive,
      },
    });

    return updated;
  }
}
