import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
] as const;

export const ALLOWED_UPLOAD_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];

/**
 * Indica si el tipo MIME del comprobante está permitido (RN-CAJA-03).
 */
export function isAllowedUploadMimeType(mimeType: string): boolean {
  return (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(
    (mimeType ?? '').toLowerCase(),
  );
}

/**
 * Construye un nombre de archivo único y seguro a partir del nombre original.
 */
export function buildStoredFileName(originalName: string): string {
  const extension = extname(originalName ?? '').toLowerCase();
  const safeExtension = ALLOWED_UPLOAD_EXTENSIONS.includes(extension)
    ? extension
    : '.bin';

  return `${randomUUID()}${safeExtension}`;
}
