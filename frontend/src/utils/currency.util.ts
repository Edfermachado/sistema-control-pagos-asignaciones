/**
 * Formatea un monto numérico o cadena decimal al formato estándar de moneda USD ($1,234.56).
 * Cumple RN-GLOB-01 (Moneda única USD) y FE-03 (Presentación pura en el cliente).
 */
export function formatUsdCurrency(amount: number | string): string {
  const numericValue = typeof amount === 'string' ? Number(amount) : amount;

  if (
    amount === '' ||
    amount === null ||
    amount === undefined ||
    Number.isNaN(numericValue) ||
    !Number.isFinite(numericValue)
  ) {
    throw new Error('[RN-GLOB-01] El valor suministrado para formatear en USD no es válido.');
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
}
