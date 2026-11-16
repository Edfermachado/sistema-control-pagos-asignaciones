import { UserRole } from '../types/domain.types';

export interface UserSession {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  token: string;
  authenticatedAt: string;
}

/**
 * Valida si un token JWT o clave de sesión es sintácticamente válida (no nula y con longitud mínima).
 */
export function isValidAuthToken(token: string | null | undefined): boolean {
  if (!token) {
    return false;
  }
  const trimmed = token.trim();
  return trimmed.length > 10;
}

/**
 * Construye el objeto de sesión de usuario a partir de la respuesta del servicio de autenticación.
 */
export function buildUserSession(params: {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  accessToken: string;
}): UserSession {
  if (!params.id || !params.email || !params.accessToken) {
    throw new Error('[AUTH-01] Parámetros insuficientes para inicializar la sesión de usuario.');
  }

  return {
    userId: params.id,
    email: params.email.trim().toLowerCase(),
    fullName: params.fullName.trim(),
    role: params.role,
    token: params.accessToken,
    authenticatedAt: new Date().toISOString(),
  };
}

/**
 * Retorna los valores de estado completamente limpios al cerrar sesión (Logout).
 */
export function getClearedSessionState(): {
  token: null;
  currentUser: null;
  isConnectedToApi: false;
} {
  return {
    token: null,
    currentUser: null,
    isConnectedToApi: false,
  };
}
