import { AccrualStatus } from '../types/domain.types';
import {
  doDateRangesIntersect,
  toIsoDateSlice,
} from './range-validity.util';

const MS_PER_DAY = 86_400_000;

function toCents(value: string | number | null | undefined): number {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.round(num * 100);
}

function fromCents(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

function addDaysIso(isoDate: string, days: number): string {
  const base = new Date(`${toIsoDateSlice(isoDate)}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) {
    return isoDate;
  }
  return new Date(base.getTime() + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

/**
 * Valida la longitud mínima del motivo para acciones justificadas inline
 * (rechazos >= 5 caracteres, anulaciones >= 10 caracteres según RN-PAG-01/03 y RN-GLOB-04).
 */
export function validateInlineJustification(
  reason: string,
  minLength = 10,
): { valid: boolean; trimmed: string; remainingChars: number } {
  const trimmed = reason.trim();
  const remainingChars = Math.max(0, minLength - trimmed.length);
  return {
    valid: trimmed.length >= minLength,
    trimmed,
    remainingChars,
  };
}

/**
 * Prepara el borrador inicial de rendición de un vale de caja chica usando
 * el monto desembolsado (o el solicitado si aún no figura desembolso) y fija el tope permitido (RN-CAJA-03).
 */
export function getDefaultVoucherSettlementDraft(voucher: {
  requestedAmount: string | number;
  disbursedAmount?: string | number | null;
}): { settledAmount: string; maxAllowedAmount: number } {
  const rawSource =
    voucher.disbursedAmount !== null &&
    voucher.disbursedAmount !== undefined &&
    voucher.disbursedAmount !== ''
      ? voucher.disbursedAmount
      : voucher.requestedAmount;
  const parsed = Number(rawSource);
  const safeBase = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  const rounded = Number(safeBase.toFixed(2));

  return {
    settledAmount: rounded.toFixed(2),
    maxAllowedAmount: rounded,
  };
}

/**
 * Resume en tiempo real la selección de causaciones al consolidar una solicitud de pago (RN-PAG-01).
 */
export function summarizeAccrualSelection(
  eligibleAccruals: Array<{
    id: string;
    balanceDue: string | number;
    beneficiaryId: string;
  }>,
  selectedIds: string[],
): {
  selectedCount: number;
  totalEligibleCount: number;
  allSelected: boolean;
  totalSelectedUsd: number;
  uniqueBeneficiariesCount: number;
} {
  const selectedSet = new Set(selectedIds);
  const selectedItems = eligibleAccruals.filter((item) =>
    selectedSet.has(item.id),
  );

  const totalCents = selectedItems.reduce(
    (sum, item) => sum + Math.max(0, toCents(item.balanceDue)),
    0,
  );
  const uniqueBeneficiariesCount = new Set(
    selectedItems.map((item) => item.beneficiaryId),
  ).size;

  return {
    selectedCount: selectedItems.length,
    totalEligibleCount: eligibleAccruals.length,
    allSelected:
      eligibleAccruals.length > 0 &&
      selectedItems.length === eligibleAccruals.length,
    totalSelectedUsd: fromCents(totalCents),
    uniqueBeneficiariesCount,
  };
}

/**
 * Alterna entre seleccionar todas las causaciones elegibles del proyecto o limpiar la selección.
 */
export function toggleAllEligibleAccruals(
  eligibleAccruals: Array<{ id: string }>,
  selectedIds: string[],
): string[] {
  if (eligibleAccruals.length === 0) {
    return [];
  }
  const selectedSet = new Set(selectedIds);
  const allAlreadySelected = eligibleAccruals.every((item) =>
    selectedSet.has(item.id),
  );
  return allAlreadySelected ? [] : eligibleAccruals.map((item) => item.id);
}

/**
 * Analiza las asignaciones activas de un beneficiario dentro de un proyecto para detectar
 * traslapes preventivos (RN-CAT-04) y calcular los sub-rangos libres dentro de la vigencia.
 */
export function analyzeBeneficiaryProjectAvailability(params: {
  project: { id: string; startDate: string; endDate: string } | undefined;
  beneficiaryId: string;
  assignments: Array<{
    id: string;
    beneficiaryId: string;
    projectId: string;
    startDate: string;
    endDate?: string | null;
    isActive: boolean;
  }>;
  proposedStart: string;
  proposedEnd: string;
}): {
  occupiedRanges: Array<{ id: string; startDate: string; endDate: string }>;
  freeSubRanges: Array<{ startDate: string; endDate: string }>;
  hasOverlapConflict: boolean;
  suggestedRange: { startDate: string; endDate: string } | null;
} {
  const { project, beneficiaryId, assignments, proposedStart, proposedEnd } =
    params;

  if (!project || !beneficiaryId) {
    return {
      occupiedRanges: [],
      freeSubRanges: [],
      hasOverlapConflict: false,
      suggestedRange: null,
    };
  }

  const pStart = toIsoDateSlice(project.startDate);
  const pEnd = toIsoDateSlice(project.endDate);
  if (!pStart || !pEnd || pStart > pEnd) {
    return {
      occupiedRanges: [],
      freeSubRanges: [],
      hasOverlapConflict: false,
      suggestedRange: null,
    };
  }

  const occupiedRanges = assignments
    .filter(
      (a) =>
        a.isActive &&
        a.projectId === project.id &&
        a.beneficiaryId === beneficiaryId,
    )
    .map((a) => {
      const rawStart = toIsoDateSlice(a.startDate) || pStart;
      const rawEnd = toIsoDateSlice(a.endDate) || pEnd;
      const clampedStart = rawStart < pStart ? pStart : rawStart;
      const clampedEnd = rawEnd > pEnd ? pEnd : rawEnd;
      return {
        id: a.id,
        startDate: clampedStart,
        endDate: clampedEnd,
      };
    })
    .filter((range) => range.startDate <= range.endDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const freeSubRanges: Array<{ startDate: string; endDate: string }> = [];
  let cursor = pStart;

  for (const occ of occupiedRanges) {
    if (occ.startDate > cursor) {
      freeSubRanges.push({
        startDate: cursor,
        endDate: addDaysIso(occ.startDate, -1),
      });
    }
    const afterOcc = addDaysIso(occ.endDate, 1);
    if (afterOcc > cursor) {
      cursor = afterOcc;
    }
  }

  if (cursor <= pEnd) {
    freeSubRanges.push({
      startDate: cursor,
      endDate: pEnd,
    });
  }

  const normPropStart = toIsoDateSlice(proposedStart) || pStart;
  const normPropEnd = toIsoDateSlice(proposedEnd) || pEnd;
  const hasOverlapConflict = occupiedRanges.some((occ) =>
    doDateRangesIntersect(
      normPropStart,
      normPropEnd,
      occ.startDate,
      occ.endDate,
    ),
  );

  return {
    occupiedRanges,
    freeSubRanges,
    hasOverlapConflict,
    suggestedRange: freeSubRanges[0] ?? null,
  };
}

/**
 * Simula en el cliente la imputación exacta FIFO sobre las causaciones pendientes
 * de un beneficiario dentro de una solicitud de pago antes de enviar la mutación (RN-PAG-02).
 */
export function simulateFifoPaymentPreview(params: {
  paymentAmount: string | number;
  requestItems?: Array<{
    accrual?: {
      id: string;
      beneficiaryId: string;
      periodStart?: string;
      periodEnd?: string;
      balanceDue: string | number;
      status?: AccrualStatus;
    };
  }>;
  allAccruals: Array<{
    id: string;
    beneficiaryId: string;
    periodStart: string;
    periodEnd: string;
    balanceDue: string | number;
    status: AccrualStatus;
  }>;
  beneficiaryId: string;
}): {
  isValidAmount: boolean;
  totalBeneficiaryDebtInRequestUsd: number;
  remainingDebtAfterPaymentUsd: number;
  steps: Array<{
    accrualId: string;
    periodStart: string;
    periodEnd: string;
    previousBalanceUsd: number;
    allocatedUsd: number;
    newBalanceUsd: number;
    resultingStatus: AccrualStatus;
  }>;
} {
  const { paymentAmount, requestItems = [], allAccruals, beneficiaryId } = params;

  if (!beneficiaryId || requestItems.length === 0) {
    return {
      isValidAmount: false,
      totalBeneficiaryDebtInRequestUsd: 0,
      remainingDebtAfterPaymentUsd: 0,
      steps: [],
    };
  }

  const accrualById = new Map(allAccruals.map((a) => [a.id, a]));
  const seenIds = new Set<string>();

  const candidates = requestItems
    .map((item) => item.accrual)
    .filter((acc): acc is NonNullable<typeof acc> => Boolean(acc))
    .filter((acc) => {
      if (acc.beneficiaryId !== beneficiaryId || seenIds.has(acc.id)) {
        return false;
      }
      seenIds.add(acc.id);
      const balanceCents = toCents(acc.balanceDue);
      const status = acc.status ?? accrualById.get(acc.id)?.status;
      return (
        balanceCents > 0 &&
        (status === undefined ||
          status === AccrualStatus.PENDIENTE ||
          status === AccrualStatus.PARCIAL)
      );
    })
    .map((acc) => {
      const full = accrualById.get(acc.id);
      return {
        id: acc.id,
        periodStart: toIsoDateSlice(acc.periodStart ?? full?.periodStart ?? ''),
        periodEnd: toIsoDateSlice(acc.periodEnd ?? full?.periodEnd ?? ''),
        balanceCents: toCents(acc.balanceDue),
      };
    })
    .sort((a, b) => {
      const startDiff = a.periodStart.localeCompare(b.periodStart);
      if (startDiff !== 0) {
        return startDiff;
      }
      const endDiff = a.periodEnd.localeCompare(b.periodEnd);
      if (endDiff !== 0) {
        return endDiff;
      }
      return a.id.localeCompare(b.id);
    });

  const totalDebtCents = candidates.reduce(
    (sum, item) => sum + item.balanceCents,
    0,
  );
  const parsedAmount = Number(paymentAmount);
  const rawPaymentCents =
    Number.isFinite(parsedAmount) && parsedAmount > 0
      ? toCents(parsedAmount)
      : 0;
  const isValidAmount =
    rawPaymentCents > 0 && rawPaymentCents <= totalDebtCents;

  let remainingToAllocateCents = isValidAmount ? rawPaymentCents : 0;

  const steps = candidates.map((item) => {
    const allocatedCents = Math.min(remainingToAllocateCents, item.balanceCents);
    remainingToAllocateCents -= allocatedCents;
    const newBalanceCents = item.balanceCents - allocatedCents;

    let resultingStatus = AccrualStatus.PENDIENTE;
    if (newBalanceCents === 0) {
      resultingStatus = AccrualStatus.PAGADO;
    } else if (allocatedCents > 0) {
      resultingStatus = AccrualStatus.PARCIAL;
    }

    return {
      accrualId: item.id,
      periodStart: item.periodStart,
      periodEnd: item.periodEnd,
      previousBalanceUsd: fromCents(item.balanceCents),
      allocatedUsd: fromCents(allocatedCents),
      newBalanceUsd: fromCents(newBalanceCents),
      resultingStatus,
    };
  });

  const totalAllocatedCents = steps.reduce(
    (sum, step) => sum + toCents(step.allocatedUsd),
    0,
  );

  return {
    isValidAmount,
    totalBeneficiaryDebtInRequestUsd: fromCents(totalDebtCents),
    remainingDebtAfterPaymentUsd: fromCents(
      Math.max(0, totalDebtCents - totalAllocatedCents),
    ),
    steps,
  };
}

/**
 * Indica si una confirmación explícita en dos pasos está armada para la acción objetivo.
 */
export function isConfirmationArmed(
  armedKey: string | null,
  targetKey: string,
): boolean {
  return Boolean(armedKey && armedKey === targetKey);
}

