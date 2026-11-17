import {
  AccrualStatus,
  PaymentRequestStatus,
  ProjectStatus,
} from '../types/domain.types';

export interface DateWindowLike {
  startDate: string;
  endDate?: string | null;
}

export interface ProjectWindowLike {
  id: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
}

export interface AssignmentWindowLike {
  id: string;
  beneficiaryId: string;
  projectId: string;
  paymentGroupId: string;
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
  beneficiary?: { isActive?: boolean };
}

export interface CutoffPeriodLike {
  id: string;
  paymentGroupId: string;
  periodStart: string;
  periodEnd: string;
  label?: string | null;
}

export interface AccrualBatchLike {
  id: string;
  projectId: string;
  paymentGroupId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
}

/**
 * Normaliza una fecha ISO a formato YYYY-MM-DD para comparaciones lexicográficas exactas.
 */
export function toIsoDateSlice(dateValue: string | Date | null | undefined): string {
  if (!dateValue) {
    return '';
  }
  if (dateValue instanceof Date) {
    return dateValue.toISOString().slice(0, 10);
  }
  return String(dateValue).slice(0, 10);
}

/**
 * Verifica si dos intervalos de fechas [startA, endA] y [startB, endB] se intersectan en al menos 1 día calendario.
 */
export function doDateRangesIntersect(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const sA = toIsoDateSlice(startA);
  const eA = toIsoDateSlice(endA);
  const sB = toIsoDateSlice(startB);
  const eB = toIsoDateSlice(endB);

  if (!sA || !eA || !sB || !eB) {
    return false;
  }

  const maxStart = sA > sB ? sA : sB;
  const minEnd = eA < eB ? eA : eB;
  return maxStart <= minEnd;
}

/**
 * Restringe (clamps) un rango de fechas [startDate, endDate] para que quede estrictamente
 * contenido dentro de la vigencia [minDate, maxDate] de un proyecto activo (RN-CAT-04).
 */
export function clampDateRangeToWindow(
  startDate: string,
  endDate: string,
  windowStart: string,
  windowEnd: string,
): { startDate: string; endDate: string } {
  const wStart = toIsoDateSlice(windowStart);
  const wEnd = toIsoDateSlice(windowEnd);
  let s = toIsoDateSlice(startDate) || wStart;
  let e = toIsoDateSlice(endDate) || wEnd;

  if (s < wStart || s > wEnd) {
    s = wStart;
  }
  if (e > wEnd || e < wStart) {
    e = wEnd;
  }
  if (e < s) {
    e = wEnd >= s ? wEnd : s;
  }

  return { startDate: s, endDate: e };
}

/**
 * Filtra las fechas de corte de un grupo de pago dejando únicamente los períodos válidos
 * para causar en un proyecto dado:
 * 1. Que intersecten la vigencia [startDate, endDate] del proyecto activo (RN-CAT-02).
 * 2. Que intersecten al menos una asignación activa en ese proyecto y grupo (RN-CAUS-02).
 * 3. Que no hayan sido ya causados en un lote activo (GENERADO) para ese proyecto y grupo (RN-CAUS-04).
 */
export function filterValidCutoffPeriodsForProject(params: {
  periods: CutoffPeriodLike[];
  project: ProjectWindowLike | undefined;
  paymentGroupId: string;
  assignments: AssignmentWindowLike[];
  existingBatches: AccrualBatchLike[];
}): CutoffPeriodLike[] {
  const { periods, project, paymentGroupId, assignments, existingBatches } = params;
  if (!project || project.status !== ProjectStatus.ACTIVO || !paymentGroupId) {
    return [];
  }

  const pStart = toIsoDateSlice(project.startDate);
  const pEnd = toIsoDateSlice(project.endDate);

  const projectGroupAssignments = assignments.filter(
    (a) =>
      a.projectId === project.id &&
      a.paymentGroupId === paymentGroupId &&
      a.isActive &&
      a.beneficiary?.isActive !== false,
  );

  const activeBatches = existingBatches.filter(
    (b) =>
      b.projectId === project.id &&
      b.paymentGroupId === paymentGroupId &&
      b.status === 'GENERADO',
  );

  return periods.filter((period) => {
    const perStart = toIsoDateSlice(period.periodStart);
    const perEnd = toIsoDateSlice(period.periodEnd);

    // 1. Debe intersectar la vigencia del proyecto (RN-CAT-02)
    if (!doDateRangesIntersect(perStart, perEnd, pStart, pEnd)) {
      return false;
    }

    // 2. No debe solaparse con un lote ya GENERADO para este proyecto y grupo (RN-CAUS-04)
    const alreadyAccrued = activeBatches.some((b) =>
      doDateRangesIntersect(
        perStart,
        perEnd,
        toIsoDateSlice(b.periodStart),
        toIsoDateSlice(b.periodEnd),
      ),
    );
    if (alreadyAccrued) {
      return false;
    }

    // 3. Si se conocen las asignaciones, debe existir al menos 1 asignación con días activos en el corte (RN-CAUS-02)
    if (assignments.length > 0) {
      const hasActiveAssignmentInPeriod = projectGroupAssignments.some((a) => {
        const aStart = toIsoDateSlice(a.startDate);
        const aEnd = toIsoDateSlice(a.endDate) || pEnd;
        const effectiveStart = [perStart, aStart, pStart].sort()[2];
        const effectiveEnd = [perEnd, aEnd, pEnd].sort()[0];
        return effectiveStart <= effectiveEnd;
      });
      if (!hasActiveAssignmentInPeriod) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Calcula el siguiente mes YYYY-MM posterior al último período cerrado de una caja chica (RN-CAJA-02 / RN-CAJA-04).
 */
export function getNextSequentialYearMonth(
  lastClosedYearMonth?: string | null,
  fallbackYearMonth = '2026-11',
): string {
  if (!lastClosedYearMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(lastClosedYearMonth)) {
    return fallbackYearMonth;
  }
  const [yearStr, monthStr] = lastClosedYearMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);

  if (month === 12) {
    return `${year + 1}-01`;
  }
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/**
 * Determina las solicitudes pagables (APROBADA o ENTREGADA con saldo pendiente > 0)
 * y los beneficiarios con deuda pendiente dentro de una solicitud dada (RN-PAG-01 / RN-PAG-02).
 */
export function getPayableBeneficiariesForRequest<
  TBeneficiary extends { id: string; fullName: string; dni: string },
>(
  request:
    | {
        status: PaymentRequestStatus;
        totalAmount: string | number;
        paidAmount: string | number;
        items?: Array<{
          accrual?: {
            id: string;
            beneficiaryId: string;
            balanceDue: string | number;
            status?: AccrualStatus;
          };
        }>;
      }
    | undefined,
  allBeneficiaries: TBeneficiary[],
): Array<{ beneficiary: TBeneficiary; pendingInRequestUsd: number }> {
  if (!request) {
    return [];
  }

  const items = request.items ?? [];
  if (items.length === 0) {
    const reqRemaining = Math.max(
      0,
      Number(request.totalAmount) - Number(request.paidAmount),
    );
    return allBeneficiaries.map((beneficiary) => ({
      beneficiary,
      pendingInRequestUsd: reqRemaining,
    }));
  }

  const debtByBeneficiary = new Map<string, number>();
  for (const item of items) {
    const acc = item.accrual;
    if (!acc) {
      continue;
    }
    const balance = Number(acc.balanceDue);
    if (
      balance > 0 &&
      (acc.status === undefined ||
        acc.status === AccrualStatus.PENDIENTE ||
        acc.status === AccrualStatus.PARCIAL)
    ) {
      debtByBeneficiary.set(
        acc.beneficiaryId,
        (debtByBeneficiary.get(acc.beneficiaryId) ?? 0) + balance,
      );
    }
  }

  const result: Array<{ beneficiary: TBeneficiary; pendingInRequestUsd: number }> = [];
  for (const beneficiary of allBeneficiaries) {
    const pending = debtByBeneficiary.get(beneficiary.id) ?? 0;
    if (pending > 0) {
      result.push({
        beneficiary,
        pendingInRequestUsd: Number(pending.toFixed(2)),
      });
    }
  }

  return result;
}

