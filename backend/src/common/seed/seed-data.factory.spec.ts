import { BadRequestException } from '@nestjs/common';
import {
  Periodicity,
  ProjectArea,
  UserRole,
} from '../constants/domain.enums';
import { verifyPassword } from '../security/crypto.helper';
import {
  buildInitialSeedCatalog,
  DEFAULT_DEMO_PASSWORD,
} from './seed-data.factory';

describe('seed-data.factory (Entregable #3 Carga de Datos Iniciales)', () => {
  it('debe generar exactamente los 3 roles segregados, las 3 áreas científicas y las 3 periodicidades (Happy Path)', () => {
    // Arrange & Act
    const seed = buildInitialSeedCatalog();

    // Assert
    expect(seed.users.map((u) => u.role)).toEqual([
      UserRole.ADMIN,
      UserRole.GENERADOR,
      UserRole.RECEPTOR,
    ]);
    expect(seed.projects.map((p) => p.area)).toEqual([
      ProjectArea.FISICA,
      ProjectArea.QUIMICA,
      ProjectArea.BIOLOGIA,
    ]);
    expect(seed.paymentGroups.map((g) => g.periodicity)).toEqual([
      Periodicity.SEMANAL,
      Periodicity.QUINCENAL,
      Periodicity.MENSUAL,
    ]);
  });

  it('debe generar hashes de contraseña verificables con DEFAULT_DEMO_PASSWORD (Edge Case Criptográfico)', () => {
    // Arrange & Act
    const seed = buildInitialSeedCatalog();

    // Assert
    for (const user of seed.users) {
      expect(verifyPassword(DEFAULT_DEMO_PASSWORD, user.passwordHash)).toBe(true);
    }
  });

  it('debe lanzar BadRequestException si se intenta construir la semilla con una contraseña menor a 8 caracteres (Caso de Error)', () => {
    // Arrange & Act & Assert
    expect(() => buildInitialSeedCatalog('123')).toThrow(BadRequestException);
  });
});
