import { BadRequestException } from '@nestjs/common';
import { PaymentStatus } from '../../../common/constants/domain.enums';
import {
  buildSimplePdfBuffer,
  formatConsolidatedRequestLines,
  formatIndividualPaymentReceiptLines,
  sanitizePdfText,
} from './pdf-document.builder';

describe('pdf-document.builder (RN-AUD-02 Generación de PDFs para Recibos y Solicitudes)', () => {
  describe('sanitizePdfText', () => {
    it('debe eliminar tildes y escapar paréntesis para compatibilidad con PDF Type1 (Happy Path)', () => {
      // Arrange
      const raw = 'Causación de Física (Óptica)';

      // Act
      const clean = sanitizePdfText(raw);

      // Assert
      expect(clean).toBe('Causacion de Fisica \\(Optica\\)');
    });

    it('debe retornar cadena vacía cuando se recibe texto vacío (Edge Case)', () => {
      // Arrange & Act & Assert
      expect(sanitizePdfText('')).toBe('');
    });

    it('debe escapar barras invertidas correctamente (Seguridad de Stream PDF)', () => {
      // Arrange & Act
      const clean = sanitizePdfText('C:\\ruta\\archivo');

      // Assert
      expect(clean).toBe('C:\\\\ruta\\\\archivo');
    });
  });

  describe('buildSimplePdfBuffer', () => {
    it('debe construir un Buffer PDF-1.4 válido con cabecera %PDF-1.4 y cierre %%EOF (Happy Path)', () => {
      // Arrange & Act
      const buffer = buildSimplePdfBuffer(
        'RECIBO INDIVIDUAL DE PAGO',
        'Proyecto FIS-2026-01',
        ['Linea 1: Monto $400.00 USD', 'Linea 2: Aplicacion FIFO'],
      );
      const textContent = buffer.toString('utf8');

      // Assert
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(textContent.startsWith('%PDF-1.4\n')).toBe(true);
      expect(textContent.trim().endsWith('%%EOF')).toBe(true);
      expect(textContent).toContain('RECIBO INDIVIDUAL DE PAGO');
    });

    it('debe generar un PDF válido incluso cuando subtitle y bodyLines están vacíos (Edge Case)', () => {
      // Arrange & Act
      const buffer = buildSimplePdfBuffer('DOCUMENTO VACIO', '', []);

      // Assert
      expect(buffer.toString('utf8')).toContain('DOCUMENTO VACIO');
    });

    it('debe lanzar BadRequestException si el título del PDF está vacío (Violación RN-AUD-02)', () => {
      // Arrange & Act & Assert
      expect(() => buildSimplePdfBuffer('   ', 'Sub', [])).toThrow(
        BadRequestException,
      );
    });
  });

  describe('formatIndividualPaymentReceiptLines & formatConsolidatedRequestLines', () => {
    it('debe formatear el recibo individual incluyendo el desglose de períodos cubiertos por FIFO (Happy Path)', () => {
      // Arrange
      const lines = formatIndividualPaymentReceiptLines({
        receiptCode: 'REC-001',
        paymentDate: '2026-11-09',
        status: PaymentStatus.VALIDO,
        beneficiaryName: 'Dr. Alejandro Mendoza',
        beneficiaryDni: 'V-18456789',
        projectCode: 'FIS-2026-01',
        projectName: 'Optica Cuantica',
        totalPaidUsd: '400.00',
        deliveredByName: 'Gerente Admin',
        allocations: [
          {
            periodStart: '2026-10-01',
            periodEnd: '2026-10-15',
            allocatedUsd: '300.00',
            remainingBalanceUsd: '0.00',
          },
          {
            periodStart: '2026-10-16',
            periodEnd: '2026-10-31',
            allocatedUsd: '100.00',
            remainingBalanceUsd: '200.00',
          },
        ],
      });

      // Assert
      expect(lines.join('\n')).toContain('ESTADO DEL RECIBO: VALIDO INMUTABLE');
      expect(lines.join('\n')).toContain('Abonado $300.00 USD');
      expect(lines.join('\n')).toContain('Saldo Restante: $200.00 USD');
    });

    it('debe incluir marca de agua textual de ANULADO cuando el pago fue anulado justificadamente (Edge Case)', () => {
      // Arrange & Act
      const lines = formatIndividualPaymentReceiptLines({
        receiptCode: 'REC-ANULADO',
        paymentDate: '2026-11-09',
        status: PaymentStatus.ANULADO,
        beneficiaryName: 'Dr. Mendoza',
        beneficiaryDni: 'V-18456789',
        projectCode: 'FIS-01',
        projectName: 'Fisica',
        totalPaidUsd: '100.00',
        deliveredByName: 'Gerente',
        allocations: [],
      });

      // Assert
      expect(lines[0]).toContain('ANULADO JUSTIFICADO');
    });

    it('debe formatear la solicitud consolidada listando beneficiarios y total en USD (RN-AUD-02)', () => {
      // Arrange & Act
      const lines = formatConsolidatedRequestLines({
        requestCode: 'SOL-FIS-01',
        projectCode: 'FIS-2026-01',
        projectName: 'Optica',
        projectArea: 'FISICA',
        status: 'APROBADA',
        createdByName: 'Coordinador',
        reviewedByName: 'Gerente',
        totalRequestedUsd: '750.00',
        items: [
          {
            beneficiaryName: 'Dr. Mendoza',
            beneficiaryDni: 'V-18456789',
            periodStart: '2026-11-01',
            periodEnd: '2026-11-15',
            requestedUsd: '450.00',
          },
        ],
      });

      // Assert
      expect(lines.join('\n')).toContain('TOTAL CONSOLIDADO SOLICITADO: $750.00 USD');
      expect(lines.join('\n')).toContain('Dr. Mendoza (V-18456789)');
    });
  });
});
