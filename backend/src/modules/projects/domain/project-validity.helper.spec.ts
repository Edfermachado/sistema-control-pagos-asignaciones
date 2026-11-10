import { BadRequestException } from '@nestjs/common';
import { ProjectStatus } from '../../../common/constants/domain.enums';
import {
  assertProjectAllowsNewAccruals,
  assertValidProjectDateRange,
} from './project-validity.helper';

describe('project-validity.helper (RN-CAT-01 y RN-CAT-02)', () => {
  describe('assertValidProjectDateRange', () => {
    it('debe permitir un rango donde endDate es posterior a startDate (Happy Path)', () => {
      // Arrange
      const start = new Date('2026-01-01T00:00:00Z');
      const end = new Date('2026-12-31T00:00:00Z');

      // Act & Assert
      expect(() => assertValidProjectDateRange(start, end)).not.toThrow();
    });

    it('debe permitir un proyecto de un solo día donde startDate === endDate (Edge Case)', () => {
      // Arrange
      const sameDay = new Date('2026-06-15T00:00:00Z');

      // Act & Assert
      expect(() => assertValidProjectDateRange(sameDay, sameDay)).not.toThrow();
    });

    it('debe lanzar BadRequestException si endDate es anterior a startDate (Violación RN-CAT-01)', () => {
      // Arrange
      const start = new Date('2026-10-10T00:00:00Z');
      const end = new Date('2026-10-01T00:00:00Z');

      // Act & Assert
      expect(() => assertValidProjectDateRange(start, end)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('assertProjectAllowsNewAccruals', () => {
    const activeProject = {
      status: ProjectStatus.ACTIVO,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-06-30T00:00:00Z'),
    };

    it('debe permitir nuevas causaciones cuando el proyecto está ACTIVO y el período está dentro de su vigencia (Happy Path)', () => {
      // Arrange
      const periodStart = new Date('2026-03-01T00:00:00Z');
      const periodEnd = new Date('2026-03-15T00:00:00Z');

      // Act & Assert
      expect(() =>
        assertProjectAllowsNewAccruals(activeProject, periodStart, periodEnd),
      ).not.toThrow();
    });

    it('debe permitir causación parcial si el período se solapa al menos 1 día con el fin de vigencia (Edge Case)', () => {
      // Arrange
      const periodStart = new Date('2026-06-30T00:00:00Z');
      const periodEnd = new Date('2026-07-15T00:00:00Z');

      // Act & Assert
      expect(() =>
        assertProjectAllowsNewAccruals(activeProject, periodStart, periodEnd),
      ).not.toThrow();
    });

    it('debe lanzar BadRequestException si el proyecto está CERRADO o si el período es posterior a su vencimiento (Violación RN-CAT-02)', () => {
      // Arrange
      const expiredPeriodStart = new Date('2026-07-01T00:00:00Z');
      const expiredPeriodEnd = new Date('2026-07-15T00:00:00Z');

      // Act & Assert (Fuera de fecha)
      expect(() =>
        assertProjectAllowsNewAccruals(
          activeProject,
          expiredPeriodStart,
          expiredPeriodEnd,
        ),
      ).toThrow('[RN-CAT-02]');

      // Act & Assert (Estado CERRADO)
      expect(() =>
        assertProjectAllowsNewAccruals(
          { ...activeProject, status: ProjectStatus.CERRADO },
          new Date('2026-03-01T00:00:00Z'),
          new Date('2026-03-15T00:00:00Z'),
        ),
      ).toThrow(BadRequestException);
    });
  });
});
