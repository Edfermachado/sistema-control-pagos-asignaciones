/**
 * Utilidades puras y cliente HTTP tipado para comunicación con el Backend NestJS (/api).
 * Cumple CC-01 (Cero any), CC-03 (Funciones puras) y TEST-01 (Unit tests 1:1).
 */

export const DEFAULT_API_BASE_URL = 'http://localhost:3000/api';

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  token?: string | null;
  body?: unknown;
  baseUrl?: string;
}

/**
 * Construye las cabeceras HTTP incluyendo el token JWT si existe (Función Pura).
 */
export function buildAuthHeaders(
  token: string | null | undefined,
  includeJsonContentType = true,
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }

  const trimmedToken = (token ?? '').trim();
  if (trimmedToken.length > 0) {
    headers['Authorization'] = `Bearer ${trimmedToken}`;
  }

  return headers;
}

/**
 * Extrae el mensaje legible de error devuelto por las excepciones de NestJS (Función Pura).
 */
export function extractApiErrorMessage(
  payload: unknown,
  fallbackStatus: number,
): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const rawMessage = (payload as { message: unknown }).message;
    if (Array.isArray(rawMessage) && rawMessage.length > 0) {
      return rawMessage.map((item) => String(item)).join(' | ');
    }
    if (typeof rawMessage === 'string' && rawMessage.trim().length > 0) {
      return rawMessage.trim();
    }
  }

  return `Error del servidor (HTTP ${fallbackStatus})`;
}

/**
 * Ejecuta una petición JSON autenticada contra el backend NestJS.
 */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const baseUrl = options.baseUrl ?? DEFAULT_API_BASE_URL;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const method = options.method ?? 'GET';
  const hasBody = options.body !== undefined;

  const response = await fetch(`${baseUrl}${normalizedPath}`, {
    method,
    headers: buildAuthHeaders(options.token, hasBody),
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text };
    }
  }

  if (!response.ok) {
    throw new Error(extractApiErrorMessage(parsed, response.status));
  }

  return parsed as T;
}

/**
 * Descarga un archivo binario PDF autenticado con JWT desde el backend y dispara su guardado en el navegador.
 */
export async function downloadAuthenticatedPdf(
  path: string,
  fallbackFilename: string,
  token: string,
  baseUrl: string = DEFAULT_API_BASE_URL,
): Promise<void> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const response = await fetch(`${baseUrl}${normalizedPath}`, {
    method: 'GET',
    headers: buildAuthHeaders(token, false),
  });

  if (!response.ok) {
    let errorPayload: unknown = null;
    try {
      errorPayload = await response.json();
    } catch {
      errorPayload = null;
    }
    throw new Error(extractApiErrorMessage(errorPayload, response.status));
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fallbackFilename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(objectUrl);
}
