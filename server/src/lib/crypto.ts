/**
 * Utilidades de cifrado para datos sensibles (Ley 1581/2012)
 * Datos médicos y sensibles requieren cifrado en reposo
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

// Derivar clave desde variable de entorno (32 bytes para AES-256)
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET ?? 'sg-sst-dev-secret-change-in-production-32b';
  return scryptSync(secret, 'sg-sst-salt', 32);
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recomienda 12 bytes
const AUTH_TAG_LENGTH = 16;

/**
 * Cifra un texto plano (string) y devuelve base64(IV + ciphertext + authTag)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  const authTag = cipher.getAuthTag();

  // Formato: IV (12) + ciphertext + authTag (16)
  const result = Buffer.concat([iv, ciphertext, authTag]);
  return result.toString('base64');
}

/**
 * Intenta descifrar un string. Devuelve null si no es un cifrado válido
 * (texto plano, formato ajeno o clave distinta), sin registrar errores.
 */
export function tryDecrypt(encryptedBase64: string): string | null {
  if (!encryptedBase64) return null;

  try {
    const key = getEncryptionKey();
    const data = Buffer.from(encryptedBase64, 'base64');

    if (data.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) return null;

    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH, data.length - AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Descifra un string base64(IV + ciphertext + authTag) y devuelve texto plano
 */
export function decrypt(encryptedBase64: string): string {
  if (!encryptedBase64) return '';

  const plaintext = tryDecrypt(encryptedBase64);
  if (plaintext === null) {
    console.error('[CRYPTO] Error descifrando: datos cifrados inválidos o clave distinta');
    return '[DATOS CIFRADOS - ERROR AL DESCIFRAR]';
  }
  return plaintext;
}

/**
 * Cifra un objeto (lo serializa a JSON primero)
 */
export function encryptObject(obj: any): string {
  if (!obj) return '';
  return encrypt(JSON.stringify(obj));
}

/**
 * Descifra y parsea JSON
 */
export function decryptObject<T>(encryptedBase64: string): T | null {
  if (!encryptedBase64) return null;
  try {
    const decrypted = decrypt(encryptedBase64);
    return JSON.parse(decrypted) as T;
  } catch {
    return null;
  }
}

/**
 * Verifica si un string parece estar cifrado: base64 estricto con longitud
 * suficiente para IV + autenticador + al menos un byte de contenido.
 * No basta con que `Buffer.from(value, 'base64')` produzca bytes, porque
 * ignora caracteres inválidos y clasificaría texto plano largo como cifrado.
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const compact = value.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return false;
  try {
    const buf = Buffer.from(compact, 'base64');
    return buf.length >= IV_LENGTH + AUTH_TAG_LENGTH + 1;
  } catch {
    return false;
  }
}

/**
 * Middleware para cifrar/descifrar campos sensibles automáticamente
 * Ley 1581/2012 - Datos sensibles: médicos, biométricos, hábitos, etc.
 */
export const SENSITIVE_FIELDS = [
  // Datos médicos (worker_exams)
  'restricciones',
  'archivo_url', // puede contener rutas a archivos médicos
  'notas', // puede contener info médica
  'diagnostico',
  'tratamiento',
  'medico', // nombre del médico tratante
  'entidad', // IPS/entidad médica
  // Certificados (worker_certs) - archivo_url y notas pueden contener info sensible
  'archivo_url',
  'notas',
  // EPP (worker_epp) - firma es dato biométrico
  'firma_url',
  'notas',
];

/**
 * Cifra campos sensibles de un objeto antes de guardar en BD
 */
export function encryptSensitiveFields(
  obj: Record<string, any>,
  fields: string[] = SENSITIVE_FIELDS
): Record<string, any> {
  const result = { ...obj };
  for (const field of new Set(fields)) {
    if (result[field] && typeof result[field] === 'string' && !isEncrypted(result[field])) {
      result[field] = encrypt(result[field]);
    }
  }
  return result;
}

/**
 * Descifra campos sensibles de un objeto leído de BD
 */
export function decryptSensitiveFields(
  obj: Record<string, any>,
  fields: string[] = SENSITIVE_FIELDS
): Record<string, any> {
  const result = { ...obj };
  for (const field of new Set(fields)) {
    if (result[field] && typeof result[field] === 'string' && isEncrypted(result[field])) {
      result[field] = decrypt(result[field]);
    }
  }
  return result;
}
