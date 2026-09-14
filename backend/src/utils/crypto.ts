import bcrypt from 'bcrypt';
import { randomBytes, randomInt } from 'crypto';
import { env } from '../config/env';

/**
 * Hash a password or PIN with bcrypt.
 * Cost factor from env (BCRYPT_COST=12).
 */
export async function hashSecret(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, env.BCRYPT_COST);
}

/**
 * Verify a plaintext value against a bcrypt hash.
 * Constant-time comparison — resistant to timing attacks.
 */
export async function verifySecret(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

/**
 * Generate a cryptographically secure random session token.
 * 32 bytes = 256 bits of entropy. Base64url so its safe in cookies.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Generate a cryptographically secure random public token for gallery URLs.
 * 16 bytes = 128 bits of entropy. base64url encoded.
 * Used for /gallery/:public_token — unguessable, resists enumeration.
 */
export function generatePublicToken(): string {
  return randomBytes(16).toString('base64url');
}

/**
 * Generate a cryptographically secure numeric PIN.
 * Returns a zero-padded string of the configured length.
 * Uses crypto.randomInt (uniform distribution) — NEVER Math.random.
 */
export function generatePin(): string {
  const max = Math.pow(10, env.PIN_LENGTH);
  const value = randomInt(0, max);
  return value.toString().padStart(env.PIN_LENGTH, '0');
}

/**
 * Generate a random S3 key for a photo upload.
 * Format: events/{eventId}/photos/{random}.{ext}
 * The random component prevents key collisions and enumeration.
 */
export function generateS3Key(eventId: bigint, extension: string): string {
  const random = randomBytes(16).toString('base64url');
  const cleanExt = extension.replace(/^\./, '').toLowerCase();
  return `events/${eventId}/photos/${random}.${cleanExt}`;
}
