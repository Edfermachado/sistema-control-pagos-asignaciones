import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { RequestWithUser } from '../decorators/current-user.decorator';
import { verifyJwtToken } from '../security/crypto.helper';

const DEFAULT_JWT_SECRET = 'uc_facyt_sistemas_informacion_secret_key_2026';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Encabezado Authorization Bearer requerido para acceder a este recurso.',
      );
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const secret = process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET;
    const payload = verifyJwtToken(token, secret);

    request.user = {
      id: payload.sub,
      email: payload.email,
      fullName: payload.fullName,
      role: payload.role,
    };

    return true;
  }
}
