import { exec, one, query } from '../lib/db-pg.js';
import { genId, nowISO } from '../lib/utils.js';

import type { ConsentRecord } from './privacy.js';

export type ConsentInputPg = Pick<
  ConsentRecord,
  'worker_id' | 'tipo' | 'finalidad' | 'autorizado' | 'medio' | 'version_aviso'
> & {
  ip?: string;
  user_agent?: string;
};

export async function createConsentPg(input: ConsentInputPg): Promise<ConsentRecord> {
  const existing = await one<ConsentRecord>(
    'SELECT * FROM consents WHERE worker_id = ? AND tipo = ? AND version_aviso = ?',
    [input.worker_id, input.tipo, input.version_aviso]
  );
  const now = nowISO();

  if (existing) {
    await exec(
      `UPDATE consents SET autorizado = ?, finalidad = ?, medio = ?, fecha = ?, ip = ?, user_agent = ?,
       retirado_en = NULL, actualizado_en = ? WHERE id = ?`,
      [
        input.autorizado,
        input.finalidad,
        input.medio,
        now,
        input.ip ?? null,
        input.user_agent ?? null,
        now,
        existing.id,
      ]
    );
    const updated = await getConsentByIdPg(existing.id);
    if (!updated)
      throw new Error('No se pudo recuperar el consentimiento actualizado en PostgreSQL');
    return updated;
  }

  const id = genId();
  await exec(
    `INSERT INTO consents (id, worker_id, tipo, finalidad, autorizado, fecha, medio, version_aviso,
      ip, user_agent, retirado_en, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,NULL,?,?)`,
    [
      id,
      input.worker_id,
      input.tipo,
      input.finalidad,
      input.autorizado,
      now,
      input.medio,
      input.version_aviso,
      input.ip ?? null,
      input.user_agent ?? null,
      now,
      now,
    ]
  );
  const consent = await getConsentByIdPg(id);
  if (!consent)
    throw new Error('No se pudo recuperar el consentimiento recién creado en PostgreSQL');
  return consent;
}

export async function getConsentByIdPg(id: string): Promise<ConsentRecord | undefined> {
  return one<ConsentRecord>('SELECT * FROM consents WHERE id = ?', [id]);
}

export async function getConsentsByWorkerPg(workerId: string): Promise<ConsentRecord[]> {
  return query<ConsentRecord>('SELECT * FROM consents WHERE worker_id = ? ORDER BY fecha DESC', [
    workerId,
  ]);
}

export async function getAllConsentsPg(): Promise<ConsentRecord[]> {
  return query<ConsentRecord>('SELECT * FROM consents ORDER BY fecha DESC');
}

export async function getActiveConsentPg(
  workerId: string,
  tipo: ConsentRecord['tipo']
): Promise<ConsentRecord | undefined> {
  return one<ConsentRecord>(
    `SELECT * FROM consents WHERE worker_id = ? AND tipo = ? AND autorizado = 1
     AND retirado_en IS NULL ORDER BY fecha DESC LIMIT 1`,
    [workerId, tipo]
  );
}

export async function withdrawConsentPg(id: string): Promise<ConsentRecord | undefined> {
  const now = nowISO();
  await exec(
    'UPDATE consents SET autorizado = 0, retirado_en = ?, actualizado_en = ? WHERE id = ?',
    [now, now, id]
  );
  return getConsentByIdPg(id);
}

export async function hasValidConsentPg(
  workerId: string,
  tipo: ConsentRecord['tipo']
): Promise<boolean> {
  return !!(await getActiveConsentPg(workerId, tipo));
}
