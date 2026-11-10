import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../constants/domain.enums';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface RequestWithUser {
  headers: Record<string, string | undefined>;
  user?: AuthenticatedUser;
  ip?: string;
}

export function extractUserFromContext(
  context: ExecutionContext,
): AuthenticatedUser | undefined {
  const request = context.switchToHttp().getRequest<RequestWithUser>();
  return request.user;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    return extractUserFromContext(ctx);
  },
);
