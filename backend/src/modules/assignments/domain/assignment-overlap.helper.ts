import { BadRequestException, ConflictException } from '@nestjs/common';

export interface DateInterval {
  startDate: Date;
  endDate?: Date | null;
}

export interface ProjectDateWindow {
  startDate: Date;
  endDate: Date;
}

/**
 * Valida que las fechas de la asignación estén contenidas dentro de la vigencia del proyecto
 * y que no exista solapamiento con otra asignación activa de la misma persona en el MISMO proyecto.
 * Cumple RN-CAT-04 y CC-03 (Función Pura de Dominio).
 */
export function assertValidAssignmentWindowAndNoOverlap(
  newAssignment: DateInterval,
  projectWindow: ProjectDateWindow,
  existingSameProjectAssignments: DateInterval[],
): void {
  const newStart = newAssignment.startDate.getTime();
  const newEnd = (newAssignment.endDate ?? projectWindow.endDate).getTime();

  if (Number.isNaN(newStart) || Number.isNaN(newEnd) || newEnd < newStart) {
    throw new BadRequestException(
      '[RN-CAT-04] El rango de fechas de la asignación es inválido (endDate < startDate).',
    );
  }

  if (
    newStart < projectWindow.startDate.getTime() ||
    newEnd > projectWindow.endDate.getTime()
  ) {
    throw new BadRequestException(
      '[RN-CAT-04] El rango de fechas de la asignación debe estar contenido dentro de la vigencia del proyecto.',
    );
  }

  for (const existing of existingSameProjectAssignments) {
    const existingStart = existing.startDate.getTime();
    const existingEnd = (existing.endDate ?? projectWindow.endDate).getTime();

    const overlaps = newStart <= existingEnd && existingStart <= newEnd;
    if (overlaps) {
      throw new ConflictException(
        '[RN-CAT-04] El beneficiario ya posee una asignación activa que se solapa en fechas dentro de este mismo proyecto.',
      );
    }
  }
}
