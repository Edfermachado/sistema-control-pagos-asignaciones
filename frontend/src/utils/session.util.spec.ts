import { describe, expect, it } from 'vitest';
import { UserRole } from '../types/domain.types';
import {
  buildUserSession,
  clearSession,
  getClearedSessionState,
  isValidAuthToken,
  loadSession,
  parseStoredSession,
  saveSession,
  serializeSession,
  type StorageLike,
} from './session.util';

describe('session.util', () => {
  describe('isValidAuthToken', () => {
    it('debe retornar true para un token JWT válido con longitud mayor a 10 caracteres (Happy Path)', () => {
      // Arrange
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_payload';

      // Act
      const result = isValidAuthToken(token);

      // Assert
      expect(result).toBe(true);
    });

    it('debe retornar false para tokens vacíos, nulos o de longitud insuficiente (Edge Cases)', () => {
      // Act & Assert
      expect(isValidAuthToken(null)).toBe(false);
      expect(isValidAuthToken(undefined)).toBe(false);
      expect(isValidAuthToken('')).toBe(false);
      expect(isValidAuthToken('   ')).toBe(false);
      expect(isValidAuthToken('short-jwt')).toBe(false);
    });
  });

  describe('buildUserSession', () => {
    it('debe construir un objeto UserSession inmutable normalizado (Happy Path)', () => {
      // Arrange
      const params = {
        id: 'usr-001',
        email: '  GERENTE@UC.EDU.VE  ',
        fullName: 'Lic. María Delgado',
        role: UserRole.RECEPTOR,
        accessToken: 'jwt_secure_token_abc123456789',
      };

      // Act
      const session = buildUserSession(params);

      // Assert
      expect(session.userId).toBe('usr-001');
      expect(session.email).toBe('gerente@uc.edu.ve');
      expect(session.fullName).toBe('Lic. María Delgado');
      expect(session.role).toBe(UserRole.RECEPTOR);
      expect(session.token).toBe('jwt_secure_token_abc123456789');
      expect(session.authenticatedAt).toBeDefined();
    });

    it('debe lanzar un error si faltan campos indispensables como id, email o token (Error Case)', () => {
      // Arrange
      const invalidParams = {
        id: '',
        email: 'test@uc.edu.ve',
        fullName: 'Test User',
        role: UserRole.ADMIN,
        accessToken: '',
      };

      // Act & Assert
      expect(() => buildUserSession(invalidParams)).toThrowError(
        '[AUTH-01] Parámetros insuficientes',
      );
    });
  });

  describe('getClearedSessionState', () => {
    it('debe retornar un estado completamente nulo y desconectado al cerrar sesión (Happy Path)', () => {
      // Act
      const cleared = getClearedSessionState();

      // Assert
      expect(cleared.token).toBeNull();
      expect(cleared.currentUser).toBeNull();
      expect(cleared.isConnectedToApi).toBe(false);
    });
  });

  describe('serializeSession', () => {
    it('debe serializar una sesión válida como JSON (Happy Path)', () => {
      // Arrange
      const session = buildUserSession({
        id: 'usr-002',
        email: 'admin@uc.edu.ve',
        fullName: 'Administrador',
        role: UserRole.ADMIN,
        accessToken: 'jwt_admin_token_123456789',
      });

      // Act
      const raw = serializeSession(session);

      // Assert
      expect(JSON.parse(raw).email).toBe('admin@uc.edu.ve');
    });

    it('debe rechazar la persistencia de una sesión sin token válido (Error Case)', () => {
      // Arrange
      const session = {
        userId: 'usr-003',
        email: 'x@uc.edu.ve',
        fullName: 'X',
        role: UserRole.GENERADOR,
        token: '',
        authenticatedAt: new Date().toISOString(),
      };

      // Act & Assert
      expect(() => serializeSession(session)).toThrowError('[AUTH-02]');
    });
  });

  describe('parseStoredSession', () => {
    it('debe reconstruir la sesión desde el texto almacenado (Happy Path)', () => {
      // Arrange
      const raw = JSON.stringify({
        userId: 'usr-004',
        email: 'gerente@uc.edu.ve',
        fullName: 'Gerente',
        role: UserRole.RECEPTOR,
        token: 'jwt_receptor_token_987654321',
        authenticatedAt: '2026-11-16T00:00:00.000Z',
      });

      // Act
      const session = parseStoredSession(raw);

      // Assert
      expect(session?.role).toBe(UserRole.RECEPTOR);
      expect(session?.token).toBe('jwt_receptor_token_987654321');
    });

    it('debe devolver null ante texto vacío, JSON corrupto o campos inválidos (Edge y Error Cases)', () => {
      // Act & Assert
      expect(parseStoredSession(null)).toBeNull();
      expect(parseStoredSession('')).toBeNull();
      expect(parseStoredSession('{no-es-json')).toBeNull();
      expect(parseStoredSession(JSON.stringify({ email: 'a@b.c' }))).toBeNull();
      expect(
        parseStoredSession(
          JSON.stringify({
            userId: 'u',
            email: 'a@b.c',
            role: 'SUPERADMIN',
            token: 'jwt_token_1234567890',
          }),
        ),
      ).toBeNull();
    });
  });

  describe('saveSession / loadSession / clearSession', () => {
    const createMemoryStorage = (): StorageLike => {
      const map = new Map<string, string>();
      return {
        getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
        setItem: (key, value) => void map.set(key, value),
        removeItem: (key) => void map.delete(key),
      };
    };

    it('debe guardar, recuperar y borrar la sesión en el almacenamiento (Happy Path)', () => {
      // Arrange
      const storage = createMemoryStorage();
      const session = buildUserSession({
        id: 'usr-005',
        email: 'coordinador@uc.edu.ve',
        fullName: 'Coordinador',
        role: UserRole.GENERADOR,
        accessToken: 'jwt_generador_token_123456789',
      });

      // Act
      saveSession(session, storage);
      const restored = loadSession(storage);
      clearSession(storage);
      const afterClear = loadSession(storage);

      // Assert
      expect(restored?.email).toBe('coordinador@uc.edu.ve');
      expect(afterClear).toBeNull();
    });

    it('no debe fallar cuando el almacenamiento no está disponible (Edge Case)', () => {
      // Arrange
      const session = buildUserSession({
        id: 'usr-006',
        email: 'admin@uc.edu.ve',
        fullName: 'Admin',
        role: UserRole.ADMIN,
        accessToken: 'jwt_admin_token_098765432',
      });

      // Act & Assert
      expect(() => saveSession(session, null)).not.toThrow();
      expect(loadSession(null)).toBeNull();
      expect(() => clearSession(null)).not.toThrow();
    });
  });
});
