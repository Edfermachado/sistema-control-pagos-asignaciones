import { describe, expect, it } from 'vitest';
import { UserRole } from '../types/domain.types';
import {
  buildUserSession,
  getClearedSessionState,
  isValidAuthToken,
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
});
