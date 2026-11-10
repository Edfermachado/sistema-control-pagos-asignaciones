import { BadRequestException } from '@nestjs/common';
import { PaymentStatus } from '../../../common/constants/domain.enums';
import { toUsdDecimal } from '../../../common/domain/money.helper';

export interface IndividualReceiptData {
  receiptCode: string;
  paymentDate: string;
  status: PaymentStatus;
  beneficiaryName: string;
  beneficiaryDni: string;
  projectCode: string;
  projectName: string;
  totalPaidUsd: string;
  deliveredByName: string;
  allocations: Array<{
    periodStart: string;
    periodEnd: string;
    allocatedUsd: string;
    remainingBalanceUsd: string;
  }>;
}

export interface ConsolidatedRequestData {
  requestCode: string;
  projectCode: string;
  projectName: string;
  projectArea: string;
  status: string;
  createdByName: string;
  reviewedByName?: string | null;
  totalRequestedUsd: string;
  items: Array<{
    beneficiaryName: string;
    beneficiaryDni: string;
    periodStart: string;
    periodEnd: string;
    requestedUsd: string;
  }>;
}

/**
 * Normaliza caracteres acentuados y escapa delimitadores de cadenas PDF Type1.
 */
export function sanitizePdfText(raw: string): string {
  const normalized = (raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return normalized
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Construye un archivo binario PDF 1.4 estándar válido con fuente Helvetica sin dependencias externas.
 * Cumple RN-AUD-02 y CC-03 (Función Pura de Dominio).
 */
export function buildSimplePdfBuffer(
  title: string,
  subtitle: string,
  bodyLines: string[],
): Buffer {
  const cleanTitle = sanitizePdfText(title).trim();
  if (!cleanTitle) {
    throw new BadRequestException(
      '[RN-AUD-02] El título del documento PDF oficial no puede estar vacío.',
    );
  }

  const cleanSubtitle = sanitizePdfText(subtitle).trim();
  const streamCommands: string[] = [
    'BT',
    '/F1 14 Tf',
    '50 760 Td',
    `(UNIVERSIDAD DE CARABOBO - SISTEMA DE CONTROL DE PAGOS Y ASIGNACIONES) Tj`,
    '0 -22 Td',
    `/F1 12 Tf`,
    `(${cleanTitle}) Tj`,
  ];

  if (cleanSubtitle) {
    streamCommands.push('0 -16 Td', `/F1 10 Tf`, `(${cleanSubtitle}) Tj`);
  }

  streamCommands.push(
    '0 -14 Td',
    '(--------------------------------------------------------------------------------) Tj',
  );

  for (const line of bodyLines) {
    const safeLine = sanitizePdfText(line);
    streamCommands.push('0 -14 Td', `(${safeLine}) Tj`);
  }

  streamCommands.push('ET');
  const contentStream = streamCommands.join('\n');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
  ];

  let pdfContent = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdfContent, 'utf8'));
    pdfContent += obj;
  }

  const xrefOffset = Buffer.byteLength(pdfContent, 'utf8');
  pdfContent += `xref\n0 ${objects.length + 1}\n`;
  pdfContent += '0000000000 65535 f \n';

  for (let i = 1; i < offsets.length; i++) {
    const paddedOffset = String(offsets[i]).padStart(10, '0');
    pdfContent += `${paddedOffset} 00000 n \n`;
  }

  pdfContent += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdfContent, 'utf8');
}

/**
 * Formatea las líneas de detalle de un Recibo Individual de Pago mostrando los períodos cubiertos por FIFO (RN-AUD-02).
 */
export function formatIndividualPaymentReceiptLines(
  data: IndividualReceiptData,
): string[] {
  const formattedTotal = toUsdDecimal(data.totalPaidUsd).toFixed(2);
  const statusBanner =
    data.status === PaymentStatus.ANULADO
      ? '*** ESTADO: ANULADO JUSTIFICADO (SIN VALIDEZ DE COBRO) ***'
      : 'ESTADO DEL RECIBO: VALIDO INMUTABLE';

  const lines: string[] = [
    statusBanner,
    `Recibo Nro: ${data.receiptCode} | Fecha de Entrega: ${data.paymentDate}`,
    `Beneficiario (Sin Usuario): ${data.beneficiaryName} (DNI: ${data.beneficiaryDni})`,
    `Proyecto: ${data.projectCode} - ${data.projectName}`,
    `Entregado por (Receptor): ${data.deliveredByName}`,
    `MONTO TOTAL ENTREGADO: $${formattedTotal} USD`,
    '--------------------------------------------------------------------------------',
    'DESGLOSE DE APLICACION POR PRELACION FIFO (PRIMERO EN ENTRAR, PRIMERO EN SALIR):',
  ];

  for (const alloc of data.allocations) {
    const allocAmt = toUsdDecimal(alloc.allocatedUsd).toFixed(2);
    const remAmt = toUsdDecimal(alloc.remainingBalanceUsd).toFixed(2);
    lines.push(
      ` * Periodo ${alloc.periodStart} a ${alloc.periodEnd}: Abonado $${allocAmt} USD | Saldo Restante: $${remAmt} USD`,
    );
  }

  return lines;
}

/**
 * Formatea las líneas de una Solicitud Consolidada de Pago por proyecto (RN-AUD-02).
 */
export function formatConsolidatedRequestLines(
  data: ConsolidatedRequestData,
): string[] {
  const formattedTotal = toUsdDecimal(data.totalRequestedUsd).toFixed(2);
  const lines: string[] = [
    `Solicitud Consolidada Nro: ${data.requestCode} | Estado: ${data.status}`,
    `Proyecto: ${data.projectCode} - ${data.projectName} (Area: ${data.projectArea})`,
    `Generado por (Coordinador): ${data.createdByName}`,
    `Revisado por (Gerencia): ${data.reviewedByName ?? 'Pendiente de Revision'}`,
    `TOTAL CONSOLIDADO SOLICITADO: $${formattedTotal} USD`,
    '--------------------------------------------------------------------------------',
    'DETALLE DE BENEFICIARIOS Y CAUSACIONES INCLUIDAS:',
  ];

  for (const item of data.items) {
    const reqAmt = toUsdDecimal(item.requestedUsd).toFixed(2);
    lines.push(
      ` * ${item.beneficiaryName} (${item.beneficiaryDni}) | Periodo ${item.periodStart} a ${item.periodEnd}: $${reqAmt} USD`,
    );
  }

  return lines;
}
