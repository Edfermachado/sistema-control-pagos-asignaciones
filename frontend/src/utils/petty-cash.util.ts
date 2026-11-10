/**
 * Calcula el porcentaje de uso del fondo mensual de una caja chica para visualización en barra de progreso.
 * Cumple RN-CAJA-02 y FE-01.
 */
export function calculatePettyCashUtilizationPercent(
  openingTotalUsd: number,
  currentAvailableUsd: number,
): number {
  if (
    !Number.isFinite(openingTotalUsd) ||
    !Number.isFinite(currentAvailableUsd) ||
    openingTotalUsd <= 0
  ) {
    throw new Error(
      '[RN-CAJA-02] El monto de apertura debe ser un número positivo mayor a 0.',
    );
  }

  if (currentAvailableUsd < 0 || currentAvailableUsd > openingTotalUsd) {
    throw new Error(
      '[RN-CAJA-02] El saldo disponible actual debe estar entre 0 y el monto total de apertura.',
    );
  }

  const usedAmount = openingTotalUsd - currentAvailableUsd;
  return Math.round((usedAmount / openingTotalUsd) * 100);
}

/**
 * Valida en la interfaz antes de enviar la petición si un vale cabe en el saldo disponible actual (RN-CAJA-02).
 */
export function validateVoucherRequestInUi(
  requestedUsd: number,
  availableUsd: number,
): { allowed: boolean; reason: string } {
  if (!Number.isFinite(requestedUsd) || requestedUsd <= 0) {
    throw new Error('[RN-CAJA-03] El monto solicitado del vale debe ser mayor a $0.00 USD.');
  }

  if (requestedUsd > availableUsd) {
    return {
      allowed: false,
      reason: `[RN-CAJA-02] Tope excedido: el vale supera el saldo disponible ($${availableUsd.toFixed(2)} USD).`,
    };
  }

  return {
    allowed: true,
    reason: 'Monto dentro del saldo disponible de la caja chica.',
  };
}
