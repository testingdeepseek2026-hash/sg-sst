import { exec, one } from '../lib/db-pg.js';
import { genId, nowISO } from '../lib/utils.js';

import { estandarSetPorRiesgo } from './companies.js';
export { auditLogPg } from './users.pg.js';

/**
 * Servicio de empresa para PostgreSQL (Neon) — Fase N2, piloto del patrón
 * de conversión asíncrona (ver PLAN_MIGRACION_NEON.md).
 *
 * Equivalente de services/companies.ts (SQLite) con las mismas convenciones
 * de datos: fechas TEXT ISO-8601, booleanos como INTEGER 0/1 y JSON en TEXT.
 * La lógica normativa (estandarSetPorRiesgo) se reutiliza del servicio
 * original para no duplicar reglas.
 */

export type CompanyRecord = Record<string, unknown>;

// Campos booleanos de companies almacenados como INTEGER 0/1 (igual que SQLite).
const BOOL_FIELDS = new Set([
  'tiene_vigia_sst',
  'tiene_copasst',
  'tiene_comite_convivencia',
  'tiene_brigada',
  'alerts_enabled',
]);

/**
 * node-pg envía `true`/`false` como boolean y las columnas son INTEGER:
 * se normaliza a 0/1 para conservar el contrato que espera el frontend.
 */
function toDbValue(key: string, value: unknown): unknown {
  if (BOOL_FIELDS.has(key) && typeof value === 'boolean') return value ? 1 : 0;
  return value === undefined ? null : value;
}

/** Equivalente de getCompany(db): primera fila de companies o undefined. */
export async function getCompanyPg(): Promise<CompanyRecord | undefined> {
  return one<CompanyRecord>('SELECT * FROM companies LIMIT 1');
}

/** Equivalente de upsertCompany(db, input): actualiza si existe, inserta si no. */
export async function upsertCompanyPg(input: Record<string, unknown>): Promise<CompanyRecord> {
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) data[k] = v;
  }

  const existing = await getCompanyPg();
  const now = nowISO();

  if (existing) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(data)) {
      // Las claves provienen del esquema Zod de la ruta (nombres de columna conocidos).
      sets.push(`${k} = ?`);
      vals.push(toDbValue(k, v));
    }
    sets.push('actualizado_en = ?');
    vals.push(now, existing.id);
    await exec(`UPDATE companies SET ${sets.join(', ')} WHERE id = ?`, vals);
    return { ...existing, ...data, actualizado_en: now };
  }

  const numTrab = Number(data.numero_trabajadores ?? 3);
  const estandarSet =
    (data.estandar_set as string | undefined) ??
    estandarSetPorRiesgo((data.clase_riesgo as string) ?? 'IV', numTrab);
  const id = genId();

  await exec(
    `INSERT INTO companies (id, razon_social, nit, direccion, telefono, email, clase_riesgo, estandar_set,
      sector, actividad_economica, numero_trabajadores, tiene_vigia_sst, tiene_copasst,
      tiene_comite_convivencia, tiene_brigada, canal_alertas,
      smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, alerts_enabled,
      creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      data.razon_social,
      data.nit,
      data.direccion ?? null,
      data.telefono ?? null,
      data.email ?? null,
      data.clase_riesgo ?? 'IV',
      estandarSet,
      data.sector ?? null,
      data.actividad_economica ?? null,
      numTrab,
      toDbValue('tiene_vigia_sst', data.tiene_vigia_sst ?? 0),
      toDbValue('tiene_copasst', data.tiene_copasst ?? 0),
      toDbValue('tiene_comite_convivencia', data.tiene_comite_convivencia ?? 0),
      toDbValue('tiene_brigada', data.tiene_brigada ?? 0),
      data.canal_alertas ?? 'app',
      data.smtp_host ?? null,
      data.smtp_port ?? null,
      data.smtp_user ?? null,
      data.smtp_pass ?? null,
      data.smtp_from ?? null,
      toDbValue('alerts_enabled', data.alerts_enabled ?? 0),
      now,
      now,
    ]
  );

  return {
    id,
    ...data,
    estandar_set: estandarSet,
    numero_trabajadores: numTrab,
    creado_en: now,
    actualizado_en: now,
  };
}
