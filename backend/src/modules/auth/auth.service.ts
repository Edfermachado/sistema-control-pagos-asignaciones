import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '../../common/constants/domain.enums';
import {
  signJwtToken,
  verifyPassword,
} from '../../common/security/crypto.helper';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';

const DEFAULT_JWT_SECRET = 'uc_facyt_sistemas_informacion_secret_key_2026';

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Valida las credenciales de un operador del sistema y emite un token JWT con su rol (RN-SEG-02).
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Credenciales de acceso inválidas.');
    }

    if (!user.isActive) {
      throw new ForbiddenException(
        '[RN-SEG-02] La cuenta de usuario se encuentra desactivada.',
      );
    }

    const role = user.role as unknown as UserRole;
    const secret = process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET;
    const accessToken = signJwtToken(
      {
        sub: user.id,
        email: user.email,
        fullName: user.fullName,
        role,
      },
      secret,
    );

    await this.auditService.recordLog({
      userId: user.id,
      userRole: role,
      action: 'USER_LOGIN',
      tableName: 'users',
      recordId: user.id,
      newValues: { email: user.email, role },
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role,
      },
    };
  }

  /**
   * Obtiene el perfil del usuario autenticado omitiendo el hash de contraseña.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`El usuario con ID ${userId} no existe.`);
    }

    return user;
  }
}
