import { exec, getPgPool, one, query } from '../lib/db-pg.js';
import { genId, nowISO } from '../lib/utils.js';

/**
 * Servicio de plan anual, cronograma y ejecución de capacitaciones para
 * PostgreSQL (Neon) — Fase N3.4. Equivalente asíncrono de services/plans.ts.
 */

export type PlanRecord = Record<string, unknown> & { id: string };

const ANNUAL_PLAN_FIELDS = new Set([
  'anio',
  'objetivo',
  'meta',
  'responsable',
  'fecha_inicio',
  'fecha_fin',
  'presupuesto',
  'estado',
]);
const SCHEDULE_FIELDS = new Set([
  'nombre',
  'tipo',
  'fecha',
  'duracion_horas',
  'responsable',
  'objetivo',
  'estado',
]);
const TRAINING_FIELDS = new Set([
  'schedule_id',
  'nombre',
  'fecha',
  'instructor',
  'archivo_evidencia',
  'estado',
]);
const ATTENDANCE_FIELDS = new Set(['training_id', 'worker_id', 'firmado', 'firma_url']);

function buildUpdate(
  patch: Record<string, unknown>,
  allowed: Set<string>
): { sets: string[]; vals: unknown[] } {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !allowed.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  return { sets, vals };
}

// ===== PLAN ANUAL =====

export async function getAnnualPlanPg(anio?: number): Promise<PlanRecord[]> {
  if (anio) {
    return query<PlanRecord>('SELECT * FROM annual_plan WHERE anio = ? ORDER BY fecha_inicio', [
      anio,
    ]);
  }
  return query<PlanRecord>('SELECT * FROM annual_plan ORDER BY anio DESC, fecha_inicio');
}

export async function createAnnualPlanPg(input: Record<string, unknown>): Promise<PlanRecord> {
  const id = genId();
  const now = nowISO();
  await exec(
    `INSERT INTO annual_plan (id, anio, objetivo, meta, responsable, fecha_inicio, fecha_fin, presupuesto, estado, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.anio,
      input.objetivo,
      input.meta ?? null,
      input.responsable ?? null,
      input.fecha_inicio,
      input.fecha_fin ?? null,
      input.presupuesto ?? 0,
      input.estado ?? 'pendiente',
      now,
      now,
    ]
  );
  return (await one<PlanRecord>('SELECT * FROM annual_plan WHERE id = ?', [id])) as PlanRecord;
}

export async function updateAnnualPlanPg(
  id: string,
  patch: Record<string, unknown>
): Promise<PlanRecord> {
  const { sets, vals } = buildUpdate(patch, ANNUAL_PLAN_FIELDS);
  sets.push('actualizado_en = ?');
  vals.push(nowISO(), id);
  await exec(`UPDATE annual_plan SET ${sets.join(', ')} WHERE id = ?`, vals);
  return (await one<PlanRecord>('SELECT * FROM annual_plan WHERE id = ?', [id])) as PlanRecord;
}

export async function deleteAnnualPlanPg(id: string): Promise<void> {
  await exec('DELETE FROM annual_plan WHERE id = ?', [id]);
}

// ===== CRONOGRAMA DE CAPACITACIÓN =====

export async function getTrainingSchedulePg(): Promise<PlanRecord[]> {
  return query<PlanRecord>('SELECT * FROM training_schedule ORDER BY fecha ASC');
}

export async function createTrainingSchedulePg(
  input: Record<string, unknown>
): Promise<PlanRecord> {
  const id = genId();
  await exec(
    `INSERT INTO training_schedule (id, nombre, tipo, fecha, duracion_horas, responsable, objetivo, estado, creado_en)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.nombre,
      input.tipo,
      input.fecha,
      input.duracion_horas ?? null,
      input.responsable ?? null,
      input.objetivo ?? null,
      input.estado ?? 'programada',
      nowISO(),
    ]
  );
  return (await one<PlanRecord>('SELECT * FROM training_schedule WHERE id = ?', [
    id,
  ])) as PlanRecord;
}

export async function updateTrainingSchedulePg(
  id: string,
  patch: Record<string, unknown>
): Promise<PlanRecord> {
  const { sets, vals } = buildUpdate(patch, SCHEDULE_FIELDS);
  vals.push(id);
  await exec(`UPDATE training_schedule SET ${sets.join(', ')} WHERE id = ?`, vals);
  return (await one<PlanRecord>('SELECT * FROM training_schedule WHERE id = ?', [
    id,
  ])) as PlanRecord;
}

export async function deleteTrainingSchedulePg(id: string): Promise<void> {
  await exec('DELETE FROM training_schedule WHERE id = ?', [id]);
}

// ===== EJECUCIÓN DE CAPACITACIONES =====

export async function getTrainingsPg(): Promise<PlanRecord[]> {
  return query<PlanRecord>(
    `SELECT t.*, ts.nombre as schedule_nombre, ts.tipo as schedule_tipo
     FROM trainings t
     LEFT JOIN training_schedule ts ON ts.id = t.schedule_id
     ORDER BY t.fecha DESC`
  );
}

export async function getTrainingByIdPg(id: string): Promise<PlanRecord | undefined> {
  return one<PlanRecord>('SELECT * FROM trainings WHERE id = ?', [id]);
}

export async function createTrainingPg(input: Record<string, unknown>): Promise<PlanRecord> {
  const id = genId();
  await exec(
    `INSERT INTO trainings (id, schedule_id, nombre, fecha, instructor, archivo_evidencia, estado, creado_en)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      id,
      input.schedule_id ?? null,
      input.nombre,
      input.fecha,
      input.instructor ?? null,
      input.archivo_evidencia ?? null,
      input.estado ?? 'programada',
      nowISO(),
    ]
  );
  return (await one<PlanRecord>('SELECT * FROM trainings WHERE id = ?', [id])) as PlanRecord;
}

export async function updateTrainingPg(
  id: string,
  patch: Record<string, unknown>
): Promise<PlanRecord> {
  const { sets, vals } = buildUpdate(patch, TRAINING_FIELDS);
  vals.push(id);
  await exec(`UPDATE trainings SET ${sets.join(', ')} WHERE id = ?`, vals);
  return (await one<PlanRecord>('SELECT * FROM trainings WHERE id = ?', [id])) as PlanRecord;
}

export async function deleteTrainingPg(id: string): Promise<void> {
  await exec('DELETE FROM training_attendance WHERE training_id = ?', [id]);
  await exec('DELETE FROM trainings WHERE id = ?', [id]);
}

// ===== ASISTENCIA CON FIRMA =====

export async function getTrainingAttendancePg(trainingId: string): Promise<PlanRecord[]> {
  return query<PlanRecord>(
    `SELECT ta.*, w.nombres, w.apellidos, w.numero_documento, w.cargo
     FROM training_attendance ta
     JOIN workers w ON w.id = ta.worker_id
     WHERE ta.training_id = ?
     ORDER BY w.apellidos, w.nombres`,
    [trainingId]
  );
}

export async function createTrainingAttendancePg(
  input: Record<string, unknown>
): Promise<PlanRecord> {
  const id = genId();
  await exec(
    `INSERT INTO training_attendance (id, training_id, worker_id, firmado, firma_url)
     VALUES (?,?,?,?,?)`,
    [id, input.training_id, input.worker_id, input.firmado ?? 0, input.firma_url ?? null]
  );
  return (await one<PlanRecord>('SELECT * FROM training_attendance WHERE id = ?', [
    id,
  ])) as PlanRecord;
}

export async function updateTrainingAttendancePg(
  id: string,
  patch: Record<string, unknown>
): Promise<PlanRecord> {
  const { sets, vals } = buildUpdate(patch, ATTENDANCE_FIELDS);
  vals.push(id);
  await exec(`UPDATE training_attendance SET ${sets.join(', ')} WHERE id = ?`, vals);
  return (await one<PlanRecord>('SELECT * FROM training_attendance WHERE id = ?', [
    id,
  ])) as PlanRecord;
}

export async function deleteTrainingAttendancePg(id: string): Promise<void> {
  await exec('DELETE FROM training_attendance WHERE id = ?', [id]);
}

export async function bulkCreateTrainingAttendancePg(
  trainingId: string,
  workerIds: string[]
): Promise<PlanRecord[]> {
  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    for (const workerId of workerIds) {
      await client.query(
        `INSERT INTO training_attendance (id, training_id, worker_id, firmado, firma_url)
         VALUES ($1,$2,$3,$4,$5)`,
        [genId(), trainingId, workerId, 0, null]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return getTrainingAttendancePg(trainingId);
}
