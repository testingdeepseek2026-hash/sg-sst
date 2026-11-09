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
  
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Formato: IV (12) + ciphertext + authTag (16)
  const result = Buffer.concat([iv, ciphertext, authTag]);
  return result.toString('base64');
}

/**
 * Descifra un string base64(IV + ciphertext + authTag) y devuelve texto plano
 */
export function decrypt(encryptedBase64: string): string {
  if (!encryptedBase64) return '';
  
  try {
    const key = getEncryptionKey();
    const data = Buffer.from(encryptedBase64, 'base64');
    
    if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Datos cifrados inválidos');
    }
    
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH, data.length - AUTH_TAG_LENGTH);
    
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    
    return plaintext.toString('utf8');
  } catch (err) {
    console.error('[CRYPTO] Error descifrando:', err);
    return '[DATOS CIFRADOS - ERROR AL DESCIFRAR]';
  }
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
 * Verifica si un string parece estar cifrado (formato base64 con longitud mínima)
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  try {
    const buf = Buffer.from(value, 'base64');
    return buf.length >= IV_LENGTH + AUTH_TAG_LENGTH + 1;
  } catch {
    return false;
  }
}

/**
 * Middleware para cifrar/descifrar campos sensibles automáticamente
 */
export const SENSITIVE_FIELDS = [
  'restricciones',
  'archivo_url', // si contiene datos médicos
  'notas', // puede contener info médica
  'diagnostico',
  'tratamiento',
];

/**
 * Cifra campos sensibles de un objeto antes de guardar en BD
 */
export function encryptSensitiveFields(obj: Record<string, any>, fields: string[] = SENSITIVE_FIELDS): Record<string, any> {
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string' && !isEncrypted(result[field])) {
      result[field] = encrypt(result[field]);
    }
  }
  return result;
}

/**
 * Descifra campos sensibles de un objeto leído de BD
 */
export function decryptSensitiveFields(obj: Record<string, any>, fields: string[] = SENSITIVE_FIELDS): Record<string, any> {
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string' && isEncrypted(result[field])) {
      result[field] = decrypt(result[field]);
    }
  }
  return result;
}