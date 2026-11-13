import { exec, one, query } from '../lib/db-pg.js';
import { genId, nowISO } from '../lib/utils.js';

/**
 * Contratistas para PostgreSQL (Neon) — Fase N3.5.
 * Equivalente asíncrono de services/contractors.ts.
 */

const CONTRACTOR_FIELDS = new Set([
  'nombre',
  'nit',
  'servicio',
  'arl',
  'examen_medico',
  'capacitacion_sst',
  'epp',
  'estado',
  'fecha_evaluacion',
  'notas',
]);

const BOOL_FIELDS = new Set(['examen_medico', 'capacitacion_sst', 'epp']);

export async function getContractorsPg() {
  return query('SELECT * FROM contractors ORDER BY fecha_evaluacion DESC, creado_en DESC');
}

export async function getContractorByIdPg(id: string) {
  return one('SELECT * FROM contractors WHERE id = ?', [id]);
}

export async function createContractorPg(input: Record<string, any>) {
  const id = genId();
  const now = nowISO();
  await exec(
    `INSERT INTO contractors (id, nombre, nit, servicio, arl, examen_medico, capacitacion_sst, epp,
      estado, fecha_evaluacion, notas, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.nombre,
      input.nit ?? null,
      input.servicio,
      input.arl ?? null,
      input.examen_medico ?? 0,
      input.capacitacion_sst ?? 0,
      input.epp ?? 0,
      input.estado ?? 'pendiente',
      input.fecha_evaluacion ?? null,
      input.notas ?? null,
      now,
      now,
    ]
  );
  return one('SELECT * FROM contractors WHERE id = ?', [id]);
}

export async function updateContractorPg(id: string, patch: Record<string, any>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !CONTRACTOR_FIELDS.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(BOOL_FIELDS.has(k) ? (v ? 1 : 0) : v);
  }
  sets.push('actualizado_en = ?');
  vals.push(nowISO(), id);
  await exec(`UPDATE contractors SET ${sets.join(', ')} WHERE id = ?`, vals);
  return one('SELECT * FROM contractors WHERE id = ?', [id]);
}

export async function deleteContractorPg(id: string) {
  await exec('DELETE FROM contractors WHERE id = ?', [id]);
}
