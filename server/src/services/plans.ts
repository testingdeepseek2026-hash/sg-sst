import { genId, nowISO } from '../lib/utils.js';

export function getAnnualPlan(db: any, anio?: number) {
  if (anio)
    return db.prepare('SELECT * FROM annual_plan WHERE anio = ? ORDER BY fecha_inicio').all(anio);
  return db.prepare('SELECT * FROM annual_plan ORDER BY anio DESC, fecha_inicio').all() as any[];
}
export function createAnnualPlan(db: any, input: any) {
  const id = genId();
  const now = nowISO();
  db.prepare(
    `INSERT INTO annual_plan (id, anio, objetivo, meta, responsable, fecha_inicio, fecha_fin, presupuesto, estado, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
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
    now
  );
  return db.prepare('SELECT * FROM annual_plan WHERE id = ?').get(id);
}
export function updateAnnualPlan(db: any, id: string, patch: any) {
  const now = nowISO();
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  sets.push('actualizado_en = ?');
  vals.push(now, id);
  db.prepare(`UPDATE annual_plan SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return db.prepare('SELECT * FROM annual_plan WHERE id = ?').get(id);
}
export function deleteAnnualPlan(db: any, id: string) {
  db.prepare('DELETE FROM annual_plan WHERE id = ?').run(id);
}

export function getTrainingSchedule(db: any) {
  return db.prepare('SELECT * FROM training_schedule ORDER BY fecha ASC').all() as any[];
}
export function createTrainingSchedule(db: any, input: any) {
  const id = genId();
  db.prepare(
    `INSERT INTO training_schedule (id, nombre, tipo, fecha, duracion_horas, responsable, objetivo, estado, creado_en)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    input.nombre,
    input.tipo,
    input.fecha,
    input.duracion_horas ?? null,
    input.responsable ?? null,
    input.objetivo ?? null,
    input.estado ?? 'programada',
    nowISO()
  );
  return db.prepare('SELECT * FROM training_schedule WHERE id = ?').get(id);
}
export function updateTrainingSchedule(db: any, id: string, patch: any) {
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  sets.push('creado_en = ?'); // placeholder no-op
  db.prepare(`UPDATE training_schedule SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
  return db.prepare('SELECT * FROM training_schedule WHERE id = ?').get(id);
}
export function deleteTrainingSchedule(db: any, id: string) {
  db.prepare('DELETE FROM training_schedule WHERE id = ?').run(id);
}
