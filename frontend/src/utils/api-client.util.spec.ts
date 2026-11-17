import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  apiRequest,
  buildAuthHeaders,
  downloadAuthenticatedPdf,
  extractApiErrorMessage,
  uploadAuthenticatedFile,
} from './api-client.util';

describe('api-client.util (Cliente HTTP Tipado y Cabeceras JWT)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

    it('debe omitir Content-Type cuando includeJsonContentType es false manteniendo Authorization (Edge Case)', () => {
      // Arrange
      const token = '  jwt-multipart-uc  ';

      // Act
      const headers = buildAuthHeaders(token, false);

      // Assert
      expect(headers).toEqual({
        Authorization: 'Bearer jwt-multipart-uc',
      });
    });

    it('debe omitir Authorization si el token es nulo o está en blanco (Caso Vacío)', () => {
      // Arrange & Act
      const headersNull = buildAuthHeaders(null, true);
      const headersBlank = buildAuthHeaders('   ', false);

      // Assert
      expect(headersNull).toEqual({ 'Content-Type': 'application/json' });
      expect(headersBlank).toEqual({});
    });
  });

  describe('extractApiErrorMessage', () => {
    it('debe extraer el mensaje de regla de negocio cuando NestJS devuelve un string (Happy Path)', () => {
      // Arrange
      const stringError = {
        statusCode: 400,
        message: '[RN-CAJA-02] El monto supera el saldo disponible.',
      };

      // Act
      const message = extractApiErrorMessage(stringError, 400);

      // Assert
      expect(message).toBe('[RN-CAJA-02] El monto supera el saldo disponible.');
    });

    it('debe concatenar mensajes cuando class-validator devuelve un arreglo de errores (Edge Case)', () => {
      // Arrange
      const arrayError = {
        statusCode: 400,
        message: ['El código es obligatorio', 'El monto debe ser positivo'],
      };

      // Act
      const message = extractApiErrorMessage(arrayError, 400);

      // Assert
      expect(message).toBe('El código es obligatorio | El monto debe ser positivo');
    });

    it('debe retornar mensaje HTTP por defecto si el payload es nulo, vacío o sin message (Caso Error)', () => {
      // Arrange & Act
      const fromNull = extractApiErrorMessage(null, 500);
      const fromEmptyObj = extractApiErrorMessage({ message: '   ' }, 404);

      // Assert
      expect(fromNull).toBe('Error del servidor (HTTP 500)');
      expect(fromEmptyObj).toBe('Error del servidor (HTTP 404)');
    });
  });

  describe('apiRequest', () => {
    it('debe enviar una petición JSON autenticada y devolver el payload tipado (Happy Path)', async () => {
      // Arrange
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: () => Promise.resolve(JSON.stringify({ id: 'proj-1', code: 'FIS-01' })),
      });
      vi.stubGlobal('fetch', fetchMock);

      // Act
      const result = await apiRequest<{ id: string; code: string }>('/projects', {
        method: 'POST',
        token: 'jwt-uc-2026',
        body: { name: 'Óptica' },
        baseUrl: 'http://localhost:3000/api',
      });

      // Assert
      expect(result).toEqual({ id: 'proj-1', code: 'FIS-01' });
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/projects',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer jwt-uc-2026',
          },
          body: JSON.stringify({ name: 'Óptica' }),
        }),
      );
    });

    it('debe normalizar rutas sin barra inicial y tolerar respuesta vacía o texto plano (Edge Case)', async () => {
      // Arrange
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
      });
      vi.stubGlobal('fetch', fetchMock);

      // Act
      const result = await apiRequest<null>('health', {
        baseUrl: 'http://localhost:3000/api',
      });

      // Assert
      expect(result).toBeNull();
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/health',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('debe lanzar Error con el mensaje extraído del backend cuando response.ok es false (Caso Error)', async () => {
      // Arrange
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          text: () =>
            Promise.resolve(
              JSON.stringify({ message: '[RN-SEG-02] Acción no permitida para ADMIN.' }),
            ),
        }),
      );

      // Act & Assert
      await expect(
        apiRequest('/accruals', {
          token: 'jwt-admin',
          baseUrl: 'http://localhost:3000/api',
        }),
      ).rejects.toThrow('[RN-SEG-02] Acción no permitida para ADMIN.');
    });
  });

  describe('uploadAuthenticatedFile', () => {
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

    it('debe normalizar rutas sin barra inicial en multipart (Edge Case)', async () => {
      // Arrange
      const file = new File(['abc'], 'recibo.png', { type: 'image/png' });
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: () => Promise.resolve(JSON.stringify({ url: '/uploads/recibo.png' })),
      });
      vi.stubGlobal('fetch', fetchMock);

      // Act
      await uploadAuthenticatedFile(
        'uploads',
        file,
        'jwt-token',
        'http://localhost:3000/api',
      );

      // Assert
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/uploads',
        expect.anything(),
      );
    });

    it('debe propagar el mensaje de error del backend (Caso Error)', async () => {
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

  describe('downloadAuthenticatedPdf', () => {
    function mockBrowserDownloadGlobals() {
      const clickMock = vi.fn();
      const anchorMock = { href: '', download: '', click: clickMock };
      const appendChild = vi.fn();
      const removeChild = vi.fn();
      const createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/pdf-1');
      const revokeObjectURL = vi.fn();

      vi.stubGlobal('window', {
        URL: { createObjectURL, revokeObjectURL },
      });
      vi.stubGlobal('document', {
        createElement: vi.fn().mockReturnValue(anchorMock),
        body: { appendChild, removeChild },
      });

      return { clickMock, anchorMock, appendChild, removeChild, createObjectURL, revokeObjectURL };
    }

    it('debe descargar el binario PDF autenticado, disparar el enlace y liberar el ObjectURL (Happy Path)', async () => {
      // Arrange
      const dom = mockBrowserDownloadGlobals();
      const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(pdfBlob),
      });
      vi.stubGlobal('fetch', fetchMock);

      // Act
      await downloadAuthenticatedPdf(
        '/reports/summary/pdf',
        'estado_cuenta.pdf',
        'jwt-uc',
        'http://localhost:3000/api',
      );

      // Assert
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/reports/summary/pdf',
        {
          method: 'GET',
          headers: { Authorization: 'Bearer jwt-uc' },
        },
      );
      expect(dom.createObjectURL).toHaveBeenCalledWith(pdfBlob);
      expect(dom.anchorMock.download).toBe('estado_cuenta.pdf');
      expect(dom.clickMock).toHaveBeenCalledTimes(1);
      expect(dom.removeChild).toHaveBeenCalledWith(dom.anchorMock);
      expect(dom.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/pdf-1');
    });

    it('debe normalizar rutas sin barra inicial al descargar PDF (Edge Case)', async () => {
      // Arrange
      mockBrowserDownloadGlobals();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(new Blob(['%PDF-1.4'])),
      });
      vi.stubGlobal('fetch', fetchMock);

      // Act
      await downloadAuthenticatedPdf(
        'reports/payments/p-1/pdf',
        'recibo.pdf',
        'jwt-uc',
        'http://localhost:3000/api',
      );

      // Assert
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/reports/payments/p-1/pdf',
        expect.anything(),
      );
    });

    it('debe lanzar Error con el mensaje HTTP o del backend si la descarga falla (Caso Error)', async () => {
      // Arrange
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ message: 'El pago no existe.' }),
        }),
      );

      // Act & Assert
      await expect(
        downloadAuthenticatedPdf(
          '/reports/payments/no-existe/pdf',
          'recibo.pdf',
          'jwt-uc',
          'http://localhost:3000/api',
        ),
      ).rejects.toThrow('El pago no existe.');
    });
  });
});
