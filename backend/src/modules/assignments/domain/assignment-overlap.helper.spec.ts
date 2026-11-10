import { BadRequestException, ConflictException } from '@nestjs/common';
import { assertValidAssignmentWindowAndNoOverlap } from './assignment-overlap.helper';

describe('assignment-overlap.helper (RN-CAT-04 Multiplicidad y Unicidad de Asignaciones)', () => {
  const projectWindow = {
    startDate: new Date('2026-01-01T00:00:00Z'),
    endDate: new Date('2026-12-31T00:00:00Z'),
  };

  it('debe permitir una asignación dentro de la vigencia del proyecto sin solapamientos previos (Happy Path)', () => {
    // Arrange
    const newAssignment = {
      startDate: new Date('2026-02-01T00:00:00Z'),
      endDate: new Date('2026-06-30T00:00:00Z'),
    };

    // Act & Assert
    expect(() =>
      assertValidAssignmentWindowAndNoOverlap(newAssignment, projectWindow, []),
    ).not.toThrow();
  });

  it('debe permitir una segunda asignación en el mismo proyecto si sus fechas NO se solapan con la anterior (Edge Case)', () => {
    // Arrange
    const firstAssignment = {
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-05-31T00:00:00Z'),
    };
    const secondAssignment = {
      startDate: new Date('2026-06-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    };

    // Act & Assert
    expect(() =>
      assertValidAssignmentWindowAndNoOverlap(secondAssignment, projectWindow, [
        firstAssignment,
      ]),
    ).not.toThrow();
  });

  it('debe lanzar ConflictException si se solapa con otra asignación activa en el mismo proyecto o BadRequestException si sale de la vigencia (Violación RN-CAT-04)', () => {
    // Arrange
    const existing = {
      startDate: new Date('2026-03-01T00:00:00Z'),
      endDate: new Date('2026-08-31T00:00:00Z'),
    };

    // Act & Assert (Solapamiento)
    expect(() =>
      assertValidAssignmentWindowAndNoOverlap(
        {
          startDate: new Date('2026-05-01T00:00:00Z'),
          endDate: new Date('2026-10-01T00:00:00Z'),
        },
        projectWindow,
        [existing],
      ),
    ).toThrow(ConflictException);

    // Act & Assert (Fuera de vigencia del proyecto)
    expect(() =>
      assertValidAssignmentWindowAndNoOverlap(
        {
          startDate: new Date('2025-11-01T00:00:00Z'),
          endDate: new Date('2026-02-01T00:00:00Z'),
        },
        projectWindow,
        [],
      ),
    ).toThrow(BadRequestException);
  });
});
