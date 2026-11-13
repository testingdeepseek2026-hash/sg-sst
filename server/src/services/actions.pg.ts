import { exec, one, query } from '../lib/db-pg.js';
import { genId, nowISO } from '../lib/utils.js';

/**
 * Acciones correctivas/preventivas para PostgreSQL (Neon) — Fase N3.6.
 * Equivalente asíncrono de services/actions.ts.
 */

const ACTION_FIELDS = new Set([
  'origen',
  'descripcion',
  'responsable',
  'fecha_limite',
  'estado',
  'prioridad',
]);

export async function getCorrectiveActionsPg() {
  return query('SELECT * FROM corrective_actions ORDER BY fecha_limite ASC');
}

export async function createCorrectiveActionPg(input: Record<string, any>) {
  const id = genId();
  const now = nowISO();
  await exec(
    `INSERT INTO corrective_actions (id, origen, descripcion, responsable, fecha_limite, estado,
      prioridad, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.origen,
      input.descripcion,
      input.responsable,
      input.fecha_limite,
      input.estado ?? 'pendiente',
      input.prioridad ?? 'media',
      now,
      now,
    ]
  );
  return one('SELECT * FROM corrective_actions WHERE id = ?', [id]);
}

export async function updateCorrectiveActionPg(id: string, patch: Record<string, any>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !ACTION_FIELDS.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  sets.push('actualizado_en = ?');
  vals.push(nowISO(), id);
  await exec(`UPDATE corrective_actions SET ${sets.join(', ')} WHERE id = ?`, vals);
  return one('SELECT * FROM corrective_actions WHERE id = ?', [id]);
}

export async function deleteCorrectiveActionPg(id: string) {
  await exec('DELETE FROM corrective_actions WHERE id = ?', [id]);
}
