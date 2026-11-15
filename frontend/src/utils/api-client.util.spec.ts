import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAuthHeaders,
  extractApiErrorMessage,
  uploadAuthenticatedFile,
} from './api-client.util';

describe('api-client.util (Cliente HTTP Tipado y Cabeceras JWT)', () => {
  describe('buildAuthHeaders', () => {
    it('debe incluir Content-Type application/json y Authorization Bearer cuando hay token (Happy Path)', () => {
      // Arrange
      const token = 'jwt-token-uc-2026';

      // Act
      const headers = buildAuthHeaders(token, true);

      // Assert
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer jwt-token-uc-2026',
      });
    });

    it('debe omitir Authorization si el token es nulo o está en blanco (Edge Case)', () => {
      // Arrange & Act
      const headersNull = buildAuthHeaders(null, true);
      const headersBlank = buildAuthHeaders('   ', false);

      // Assert
      expect(headersNull).toEqual({ 'Content-Type': 'application/json' });
      expect(headersBlank).toEqual({});
    });
  });

  describe('uploadAuthenticatedFile', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('debe subir un archivo multipart y retornar su URL (Happy Path)', async () => {
      // Arrange
      const file = new File(['contenido'], 'factura.pdf', {
        type: 'application/pdf',
      });
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              url: '/uploads/factura.pdf',
              originalName: 'factura.pdf',
              mimeType: 'application/pdf',
              size: 9,
            }),
          ),
      });
      vi.stubGlobal('fetch', fetchMock);

      // Act
      const result = await uploadAuthenticatedFile(
        '/uploads',
        file,
        'jwt-token',
        'http://localhost:3000/api',
      );

      // Assert
      expect(result.url).toBe('/uploads/factura.pdf');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/uploads',
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer jwt-token' },
        }),
      );
    });

    it('debe propagar el mensaje de error del backend (Edge Case)', async () => {
      // Arrange
      const file = new File(['contenido'], 'archivo.zip', {
        type: 'application/zip',
      });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          text: () =>
            Promise.resolve(
              JSON.stringify({ message: 'Solo se permiten PDF, PNG o JPEG.' }),
            ),
        }),
      );

      // Act & Assert
      await expect(
        uploadAuthenticatedFile('/uploads', file, 'jwt-token'),
      ).rejects.toThrow('Solo se permiten PDF, PNG o JPEG.');
    });
  });

  describe('extractApiErrorMessage', () => {
    it('debe extraer el mensaje de regla de negocio cuando NestJS devuelve un string o arreglo (Happy Path)', () => {
      // Arrange
      const stringError = {
        statusCode: 400,
        message: '[RN-CAJA-02] El monto supera el saldo disponible.',
      };
      const arrayError = {
        statusCode: 400,
        message: ['El código es obligatorio', 'El monto debe ser positivo'],
      };

      // Act & Assert
      expect(extractApiErrorMessage(stringError, 400)).toBe(
        '[RN-CAJA-02] El monto supera el saldo disponible.',
      );
      expect(extractApiErrorMessage(arrayError, 400)).toBe(
        'El código es obligatorio | El monto debe ser positivo',
      );
    });

    it('debe retornar mensaje HTTP por defecto si el payload es nulo o desconocido (Edge Case)', () => {
      // Arrange & Act
      const fallback = extractApiErrorMessage(null, 500);

      // Assert
      expect(fallback).toBe('Error del servidor (HTTP 500)');
    });
  });
});
