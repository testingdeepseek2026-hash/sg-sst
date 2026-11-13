import { describe, expect, it } from 'vitest';

import {
  decrypt,
  decryptSensitiveFields,
  encrypt,
  encryptSensitiveFields,
  isEncrypted,
} from '../../../src/lib/crypto.js';

describe('crypto', () => {
  it('cifra y descifra texto con AES-256-GCM', () => {
    const plaintext = 'Examen periódico anual. Restricción por hipoacusia leve bilateral.';
    const ciphertext = encrypt(plaintext);

    expect(ciphertext).not.toBe(plaintext);
    expect(isEncrypted(ciphertext)).toBe(true);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('no clasifica texto plano largo ni data URLs como cifrado', () => {
    expect(isEncrypted('Examen de ingreso según Res. 0312/2019 E13. Apto para alturas.')).toBe(false);
    expect(
      isEncrypted(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
      )
    ).toBe(false);
  });

  it('descifra una sola vez aunque la lista de campos tenga duplicados', () => {
    const plaintext = 'Nota médica confidencial con longitud suficiente para el caso.';
    const row = {
      notas: encrypt(plaintext),
      medico: encrypt('Dr. Carlos Méndez'),
      entidad: encrypt('Clínica Ocupacional Salud Total'),
    };

    const decrypted = decryptSensitiveFields(row);

    expect(decrypted.notas).toBe(plaintext);
    expect(decrypted.medico).toBe('Dr. Carlos Méndez');
    expect(decrypted.entidad).toBe('Clínica Ocupacional Salud Total');
  });

  it('cifra texto plano una sola vez y conserva lo ya cifrado', () => {
    const encrypted = encryptSensitiveFields({
      notas: 'Nota médica confidencial con longitud suficiente para el caso.',
      medico: 'Dra. Ana Rodríguez',
    });

    expect(isEncrypted(encrypted.notas)).toBe(true);
    expect(isEncrypted(encrypted.medico)).toBe(true);
    expect(decrypt(encrypted.notas)).toContain('Nota médica');

    const again = encryptSensitiveFields(encrypted);
    expect(again.notas).toBe(encrypted.notas);
    expect(again.medico).toBe(encrypted.medico);
  });
});
