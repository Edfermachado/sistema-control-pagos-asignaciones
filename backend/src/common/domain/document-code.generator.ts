import { BadRequestException } from '@nestjs/common';

export interface SystemDocumentCodeInput {
  prefix: string;
  contextCode?: string;
  sequence: number;
  padLength?: number;
}

/**
 * Construye códigos correlativos institucionales deterministas para documentos y catálogos
 * (proyectos, lotes de causación, solicitudes de pago, recibos, cajas chicas y vales).
 * Cumple CC-03 (Función Pura de Dominio) y evita edición manual de códigos por el usuario.
 */
export function buildSystemDocumentCode(
  input: SystemDocumentCodeInput,
): string {
  const cleanPrefix = (input.prefix ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');

  if (!cleanPrefix) {
    throw new BadRequestException(
      'El prefijo del código de documento del sistema es obligatorio.',
    );
  }

  if (!Number.isInteger(input.sequence) || input.sequence <= 0) {
    throw new BadRequestException(
      'El número correlativo del documento debe ser un entero positivo.',
    );
  }

  const padLength = input.padLength ?? 3;
  const paddedSeq = String(input.sequence).padStart(padLength, '0');
  const cleanContext = (input.contextCode ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');

  return cleanContext
    ? `${cleanPrefix}-${cleanContext}-${paddedSeq}`
    : `${cleanPrefix}-${paddedSeq}`;
}

