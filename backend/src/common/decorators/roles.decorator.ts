import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../constants/domain.enums';

export const ROLES_KEY = 'roles' as const;

/**
 * Decorador para declarar qué roles tienen acceso a un controlador o endpoint según RN-SEG-02.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
