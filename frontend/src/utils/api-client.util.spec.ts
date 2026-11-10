import { describe, expect, it } from 'vitest';
import {
  buildAuthHeaders,
  extractApiErrorMessage,
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
