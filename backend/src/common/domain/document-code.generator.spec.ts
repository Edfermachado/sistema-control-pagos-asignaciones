import { BadRequestException } from '@nestjs/common';
import { buildSystemDocumentCode } from './document-code.generator';

describe('document-code.generator (Generación Automática de Códigos del Sistema)', () => {
  describe('buildSystemDocumentCode', () => {
    it('debe construir el código formateado con prefijo, contexto y correlativo con padding (Happy Path)', () => {
      // Arrange & Act
      const batchCode = buildSystemDocumentCode({
        prefix: 'LOTE',
        contextCode: 'FIS-2026-11',
        sequence: 4,
        padLength: 3,
      });

      // Assert
      expect(batchCode).toBe('LOTE-FIS-2026-11-004');
    });

    it('debe construir códigos sin segmento de contexto intermedio cuando contextCode se omite (Edge Case)', () => {
      // Arrange & Act
      const voucherCode = buildSystemDocumentCode({
        prefix: 'VALE-2026-11',
        sequence: 12,
        padLength: 3,
      });

      // Assert
      expect(voucherCode).toBe('VALE-2026-11-012');
    });

    it('debe lanzar BadRequestException si el prefijo está vacío o el correlativo no es positivo (Caso de Error)', () => {
      // Arrange & Act & Assert
      expect(() =>
        buildSystemDocumentCode({ prefix: '   ', sequence: 1 }),
      ).toThrow(BadRequestException);

      expect(() =>
        buildSystemDocumentCode({ prefix: 'REC', sequence: 0 }),
      ).toThrow(BadRequestException);
    });
  });
});

