import {
  buildStoredFileName,
  isAllowedUploadMimeType,
} from './upload-file.helper';

describe('upload-file.helper (RN-CAJA-03 Comprobantes Adjuntos)', () => {
  describe('isAllowedUploadMimeType', () => {
    it('debe aceptar PDF, PNG y JPEG (Happy Path)', () => {
      expect(isAllowedUploadMimeType('application/pdf')).toBe(true);
      expect(isAllowedUploadMimeType('image/png')).toBe(true);
      expect(isAllowedUploadMimeType('image/jpeg')).toBe(true);
    });

    it('debe rechazar tipos no permitidos (Edge Case)', () => {
      expect(isAllowedUploadMimeType('application/zip')).toBe(false);
      expect(isAllowedUploadMimeType('')).toBe(false);
    });
  });

  describe('buildStoredFileName', () => {
    it('debe conservar la extensión permitida y generar un nombre único (Happy Path)', () => {
      const first = buildStoredFileName('FACTURA.PDF');
      const second = buildStoredFileName('FACTURA.PDF');

      expect(first.endsWith('.pdf')).toBe(true);
      expect(first).not.toBe(second);
    });

    it('debe usar .bin cuando la extensión no está permitida (Edge Case)', () => {
      expect(buildStoredFileName('malicioso.exe').endsWith('.bin')).toBe(true);
    });
  });
});
