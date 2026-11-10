import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { UserRole } from '../constants/domain.enums';

export const MIN_PASSWORD_LENGTH = 8 as const;
const SALT_BYTES = 16 as const;
const KEY_LENGTH = 64 as const;
const DEFAULT_TOKEN_TTL_SECONDS = 8 * 60 * 60; // 8 horas

export interface JwtPayload {
  sub: string;
  email: string;
  fullName: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padLength = (4 - (input.length % 4)) % 4;
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLength);
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Genera un hash seguro con sal aleatoria usando scrypt (nativo de Node.js).
 */
export function hashPassword(plainPassword: string): string {
  const cleanPassword = (plainPassword ?? '').trim();
  if (cleanPassword.length < MIN_PASSWORD_LENGTH) {
    throw new BadRequestException(
      `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    );
  }

  const salt = randomBytes(SALT_BYTES).toString('hex');
  const derivedKey = scryptSync(cleanPassword, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Verifica una contraseña en texto plano contra su hash almacenado usando comparación en tiempo constante.
 */
export function verifyPassword(
  plainPassword: string,
  storedHash: string,
): boolean {
  if (!plainPassword || !storedHash || !storedHash.includes(':')) {
    return false;
  }

  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) {
    return false;
  }

  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derivedBuffer = scryptSync(plainPassword.trim(), salt, KEY_LENGTH);

  if (keyBuffer.length !== derivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(keyBuffer, derivedBuffer);
}

/**
 * Firma un token JWT con algoritmo HS256 sin dependencias externas vulnerables.
 */
export function signJwtToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
  expiresInSeconds = DEFAULT_TOKEN_TTL_SECONDS,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  if (!secret || secret.trim().length === 0) {
    throw new Error('El secreto JWT no puede estar vacío.');
  }

  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload: JwtPayload = {
    ...payload,
    iat: nowSeconds,
    exp: nowSeconds + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = base64UrlEncode(
    createHmac('sha256', secret).update(signingInput).digest(),
  );

  return `${signingInput}.${signature}`;
}

/**
 * Verifica la firma criptográfica y la vigencia temporal de un token JWT HS256.
 */
export function verifyJwtToken(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): JwtPayload {
  if (!token || typeof token !== 'string') {
    throw new UnauthorizedException('Token de autenticación no suministrado.');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new UnauthorizedException('Formato de token JWT inválido.');
  }

  const [encodedHeader, encodedPayload, providedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = base64UrlEncode(
    createHmac('sha256', secret).update(signingInput).digest(),
  );

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new UnauthorizedException('Firma de token JWT inválida.');
  }

  let parsedPayload: JwtPayload;
  try {
    parsedPayload = JSON.parse(base64UrlDecode(encodedPayload)) as JwtPayload;
  } catch {
    throw new UnauthorizedException('Payload de token JWT corrupto.');
  }

  if (parsedPayload.exp !== undefined && nowSeconds >= parsedPayload.exp) {
    throw new UnauthorizedException('El token de sesión ha expirado.');
  }

  return parsedPayload;
}
