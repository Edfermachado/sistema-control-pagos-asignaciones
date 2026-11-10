import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../../common/constants/domain.enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { hashPassword } from '../../common/security/crypto.helper';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Crea un nuevo usuario operador del sistema con uno de los 3 roles segregados (RN-SEG-02).
   */
  async createUser(dto: CreateUserDto, actor: AuthenticatedUser) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictException(
        `[RN-SEG-02] Ya existe un usuario registrado con el correo '${normalizedEmail}'.`,
      );
    }

    const passwordHash = hashPassword(dto.password);

    const created = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        fullName: dto.fullName.trim(),
        passwordHash,
        role: dto.role,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'CREATE_USER',
      tableName: 'users',
      recordId: created.id,
      oldValues: null,
      newValues: {
        email: created.email,
        fullName: created.fullName,
        role: created.role,
      },
    });

    return created;
  }

  /**
   * Lista todos los usuarios del sistema ocultando el hash de contraseña.
   */
  async findAllUsers(roleFilter?: UserRole) {
    return this.prisma.user.findMany({
      where: roleFilter ? { role: roleFilter } : {},
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  /**
   * Activa o desactiva un usuario, impidiendo que un ADMIN se desactive a sí mismo (RN-SEG-02).
   */
  async toggleUserActiveStatus(
    targetUserId: string,
    isActive: boolean,
    actor: AuthenticatedUser,
  ) {
    if (targetUserId === actor.id && !isActive) {
      throw new BadRequestException(
        '[RN-SEG-02] El Administrador no puede desactivar su propia cuenta en sesión.',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!existing) {
      throw new NotFoundException(`El usuario con ID ${targetUserId} no existe.`);
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { isActive },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'UPDATE_USER_STATUS',
      tableName: 'users',
      recordId: targetUserId,
      oldValues: { isActive: existing.isActive },
      newValues: { isActive: updated.isActive },
    });

    return updated;
  }
}
