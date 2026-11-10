import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../constants/domain.enums';
import {
  hashPassword,
  signJwtToken,
  verifyJwtToken,
  verifyPassword,
} from './crypto.helper';

describe('crypto.helper (Seguridad y Autenticación JWT)', () => {
  const TEST_SECRET = 'uc_test_secret_2026';

  describe('hashPassword', () => {
    it('debe generar un hash con formato salt:key para una contraseña válida (Happy Path)', () => {
      // Arrange
      const plain = 'ClaveSegura2026!';

      // Act
      const hashed = hashPassword(plain);

      // Assert
      expect(hashed).toContain(':');
      expect(hashed.split(':')).toHaveLength(2);
    });

    it('debe generar hashes distintos para la misma contraseña gracias a la sal aleatoria (Edge Case)', () => {
      // Arrange
      const plain = 'MismaClave123';

      // Act
      const hash1 = hashPassword(plain);
      const hash2 = hashPassword(plain);

      // Assert
      expect(hash1).not.toBe(hash2);
    });

    it('debe lanzar BadRequestException si la contraseña tiene menos de 8 caracteres (Caso de Error)', () => {
      // Arrange
      const shortPassword = '12345';

      // Act & Assert
      expect(() => hashPassword(shortPassword)).toThrow(BadRequestException);
    });
  });

  describe('verifyPassword', () => {
    it('debe retornar true cuando la contraseña coincide con el hash (Happy Path)', () => {
      // Arrange
      const hashed = hashPassword('CoordinadorUC2026');

      // Act
      const isValid = verifyPassword('CoordinadorUC2026', hashed);

      // Assert
      expect(isValid).toBe(true);
    });

    it('debe retornar false cuando el hash almacenado está malformado o vacío (Edge Case)', () => {
      // Arrange & Act
      const resultMalformed = verifyPassword('Clave12345', 'hash_sin_dos_puntos');
      const resultEmpty = verifyPassword('', '');

      // Assert
      expect(resultMalformed).toBe(false);
      expect(resultEmpty).toBe(false);
    });

    it('debe retornar false cuando la contraseña suministrada es incorrecta (Caso de Error)', () => {
      // Arrange
      const hashed = hashPassword('ClaveCorrecta2026');

      // Act
      const isValid = verifyPassword('ClaveIncorrecta999', hashed);

      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('signJwtToken & verifyJwtToken', () => {
    it('debe firmar y verificar un token JWT retornando el payload original (Happy Path)', () => {
      // Arrange
      const payload = {
        sub: 'user-uuid-1',
        email: 'coordinador@uc.edu.ve',
        fullName: 'Coordinador General',
        role: UserRole.GENERADOR,
      };
      const fixedNow = 1700000000;

      // Act
      const token = signJwtToken(payload, TEST_SECRET, 3600, fixedNow);
      const decoded = verifyJwtToken(token, TEST_SECRET, fixedNow + 100);

      // Assert
      expect(decoded.sub).toBe('user-uuid-1');
      expect(decoded.role).toBe(UserRole.GENERADOR);
      expect(decoded.exp).toBe(fixedNow + 3600);
    });

    it('debe lanzar Error si se intenta firmar con un secreto vacío (Edge Case)', () => {
      // Arrange
      const payload = {
        sub: 'user-1',
        email: 'admin@uc.edu.ve',
        fullName: 'Admin',
        role: UserRole.ADMIN,
      };

      // Act & Assert
      expect(() => signJwtToken(payload, '   ')).toThrow(
        'El secreto JWT no puede estar vacío.',
      );
    });

    it('debe lanzar UnauthorizedException si el token expiró o fue adulterado (Caso de Error)', () => {
      // Arrange
      const payload = {
        sub: 'user-1',
        email: 'admin@uc.edu.ve',
        fullName: 'Admin',
        role: UserRole.ADMIN,
      };
      const fixedNow = 1700000000;
      const token = signJwtToken(payload, TEST_SECRET, 60, fixedNow);

      // Act & Assert (Expirado)
      expect(() => verifyJwtToken(token, TEST_SECRET, fixedNow + 61)).toThrow(
        UnauthorizedException,
      );
      // Act & Assert (Secreto distinto / firma adulterada)
      expect(() => verifyJwtToken(token, 'otro_secreto', fixedNow)).toThrow(
        UnauthorizedException,
      );
    });
  });
});
