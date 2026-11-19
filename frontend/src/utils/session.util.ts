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

/** Clave de almacenamiento de la sesión (ámbito de pestaña). */
export const SESSION_STORAGE_KEY = 'scpa.session';

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function defaultStorage(): StorageLike | null {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null;
  }
  return window.sessionStorage;
}

/**
 * Serializa la sesión para persistirla en el almacenamiento de la pestaña.
 * Se usa sessionStorage (no localStorage): la sesión muere al cerrar la pestaña.
 */
export function serializeSession(session: UserSession): string {
  if (!isValidAuthToken(session.token)) {
    throw new Error('[AUTH-02] No se puede persistir una sesión sin token válido.');
  }
  return JSON.stringify(session);
}

/**
 * Reconstruye la sesión desde texto almacenado; devuelve null si está corrupta o incompleta.
 */
export function parseStoredSession(raw: string | null): UserSession | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<UserSession>;
    const roles = Object.values(UserRole) as string[];
    if (
      !parsed ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.role !== 'string' ||
      !roles.includes(parsed.role) ||
      !isValidAuthToken(parsed.token)
    ) {
      return null;
    }
    return {
      userId: parsed.userId,
      email: parsed.email,
      fullName: typeof parsed.fullName === 'string' ? parsed.fullName : parsed.email,
      role: parsed.role as UserRole,
      token: parsed.token as string,
      authenticatedAt:
        typeof parsed.authenticatedAt === 'string'
          ? parsed.authenticatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Persiste la sesión en el almacenamiento de la pestaña. */
export function saveSession(session: UserSession, storage?: StorageLike | null): void {
  const target = storage === undefined ? defaultStorage() : storage;
  if (!target) {
    return;
  }
  target.setItem(SESSION_STORAGE_KEY, serializeSession(session));
}

/** Recupera la sesión guardada, si existe y es válida. */
export function loadSession(storage?: StorageLike | null): UserSession | null {
  const target = storage === undefined ? defaultStorage() : storage;
  if (!target) {
    return null;
  }
  return parseStoredSession(target.getItem(SESSION_STORAGE_KEY));
}

/** Elimina la sesión guardada (logout o expiración). */
export function clearSession(storage?: StorageLike | null): void {
  const target = storage === undefined ? defaultStorage() : storage;
  if (!target) {
    return;
  }
  target.removeItem(SESSION_STORAGE_KEY);
}

