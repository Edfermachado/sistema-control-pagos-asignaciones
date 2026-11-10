import { BadRequestException } from '@nestjs/common';
import { ProjectStatus } from '../../../common/constants/domain.enums';

export interface ProjectValidityWindow {
  status: ProjectStatus;
  startDate: Date;
  endDate: Date;
}

/**
 * Verifica que las fechas de vigencia del proyecto sean coherentes (startDate <= endDate).
 * Cumple RN-CAT-01 y CC-03 (Función Pura de Dominio).
 */
export function assertValidProjectDateRange(
  startDate: Date,
  endDate: Date,
): void {
  if (
    !(startDate instanceof Date) ||
    !(endDate instanceof Date) ||
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    throw new BadRequestException(
      '[RN-CAT-01] Las fechas de inicio y fin de vigencia del proyecto deben ser fechas válidas.',
    );
  }

  if (endDate.getTime() < startDate.getTime()) {
    throw new BadRequestException(
      '[RN-CAT-01] La fecha de fin de vigencia del proyecto no puede ser anterior a su fecha de inicio.',
    );
  }
}

/**
 * Determina si un proyecto permite generar nuevas causaciones para un período dado (RN-CAT-02).
 * Nota RN-CAT-02: Se bloquean nuevas causaciones fuera de vigencia o si está inactivo/cerrado,
 * pero las deudas ya causadas anteriormente sí pueden pagarse.
 */
export function assertProjectAllowsNewAccruals(
  project: ProjectValidityWindow,
  periodStart: Date,
  periodEnd: Date,
): void {
  if (project.status !== ProjectStatus.ACTIVO) {
    throw new BadRequestException(
      `[RN-CAT-02] El proyecto se encuentra en estado '${project.status}' y no admite nuevas causaciones.`,
    );
  }

  assertValidProjectDateRange(periodStart, periodEnd);

  const overlapStart = Math.max(
    project.startDate.getTime(),
    periodStart.getTime(),
  );
  const overlapEnd = Math.min(project.endDate.getTime(), periodEnd.getTime());

  if (overlapStart > overlapEnd) {
    throw new BadRequestException(
      '[RN-CAT-02] El período solicitado se encuentra completamente fuera de la vigencia del proyecto.',
    );
  }
}
