import { exec, getPgPool, one, query } from '../lib/db-pg.js';
import { genId, nowISO } from '../lib/utils.js';

/**
 * Planes de emergencia y simulacros para PostgreSQL (Neon) — Fase N3.5.
 * Equivalente asíncrono de services/emergencies.ts.
 */

const PLAN_FIELDS = new Set(['nombre', 'tipo_emergencia', 'contenido', 'vigente']);
const DRILL_FIELDS = new Set([
  'emergency_plan_id',
  'fecha',
  'tipo',
  'participantes',
  'observaciones',
  'estado',
]);

export async function getEmergencyPlansPg() {
  return query('SELECT * FROM emergency_plans ORDER BY fecha_creacion DESC');
}

export async function getEmergencyPlanByIdPg(id: string) {
  return one('SELECT * FROM emergency_plans WHERE id = ?', [id]);
}

export async function createEmergencyPlanPg(input: Record<string, any>) {
  const id = genId();
  await exec(
    `INSERT INTO emergency_plans (id, nombre, tipo_emergencia, contenido, fecha_creacion, vigente)
     VALUES (?,?,?,?,?,?)`,
    [id, input.nombre, input.tipo_emergencia, input.contenido ?? null, nowISO(), input.vigente ?? 1]
  );
  return one('SELECT * FROM emergency_plans WHERE id = ?', [id]);
}

export async function updateEmergencyPlanPg(id: string, patch: Record<string, any>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !PLAN_FIELDS.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(k === 'vigente' ? (v ? 1 : 0) : v);
  }
  if (sets.length === 0) return one('SELECT * FROM emergency_plans WHERE id = ?', [id]);
  vals.push(id);
  await exec(`UPDATE emergency_plans SET ${sets.join(', ')} WHERE id = ?`, vals);
  return one('SELECT * FROM emergency_plans WHERE id = ?', [id]);
}

export async function deleteEmergencyPlanPg(id: string) {
  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM drills WHERE emergency_plan_id = $1', [id]);
    await client.query('DELETE FROM emergency_plans WHERE id = $1', [id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getDrillsPg() {
  return query(
    `SELECT d.*, ep.nombre as plan_nombre, ep.tipo_emergencia as plan_tipo
     FROM drills d
     LEFT JOIN emergency_plans ep ON ep.id = d.emergency_plan_id
     ORDER BY d.fecha DESC`
  );
}

export async function getDrillByIdPg(id: string) {
  return one('SELECT * FROM drills WHERE id = ?', [id]);
}

export async function getDrillsByPlanPg(planId: string) {
  return query('SELECT * FROM drills WHERE emergency_plan_id = ? ORDER BY fecha DESC', [planId]);
}

export async function createDrillPg(input: Record<string, any>) {
  const id = genId();
  await exec(
    `INSERT INTO drills (id, emergency_plan_id, fecha, tipo, participantes, observaciones, estado)
     VALUES (?,?,?,?,?,?,?)`,
    [
      id,
      input.emergency_plan_id ?? null,
      input.fecha,
      input.tipo,
      input.participantes ?? null,
      input.observaciones ?? null,
      input.estado ?? 'realizado',
    ]
  );
  return one('SELECT * FROM drills WHERE id = ?', [id]);
}

export async function updateDrillPg(id: string, patch: Record<string, any>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !DRILL_FIELDS.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return one('SELECT * FROM drills WHERE id = ?', [id]);
  vals.push(id);
  await exec(`UPDATE drills SET ${sets.join(', ')} WHERE id = ?`, vals);
  return one('SELECT * FROM drills WHERE id = ?', [id]);
}

export async function deleteDrillPg(id: string) {
  await exec('DELETE FROM drills WHERE id = ?', [id]);
}
