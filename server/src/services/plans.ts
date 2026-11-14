import { genId, nowISO } from '../lib/utils.js';

import type { AnnualPlanImportRow } from './plan-excel.js';

export type { AnnualPlanImportRow } from './plan-excel.js';

export const ESTADO_MAP: Record<string, 'pendiente' | 'en_proceso' | 'cumplido' | 'incumplido'> = {
  p: 'pendiente',
  e: 'en_proceso',
  c: 'cumplido',
  i: 'incumplido',
  cerrada: 'cumplido',
  'en ejecución': 'en_proceso',
  'en proceso': 'en_proceso',
};

export function getAnnualPlan(db: any, anio?: number) {
  if (anio)
    return db.prepare('SELECT * FROM annual_plan WHERE anio = ? ORDER BY fecha_inicio').all(anio);
  return db.prepare('SELECT * FROM annual_plan ORDER BY anio DESC, fecha_inicio').all() as any[];
}
export function createAnnualPlan(db: any, input: any) {
  const id = genId();
  const now = nowISO();
  db.prepare(
    `INSERT INTO annual_plan (id, anio, objetivo, meta, responsable, fecha_inicio, fecha_fin, presupuesto, estado, programa, evidencia_esperada, meses, meses_ejecutados, porcentaje, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
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
    input.programa ?? null,
    input.evidencia_esperada ?? null,
    input.meses ? JSON.stringify(input.meses) : null,
    input.meses_ejecutados ? JSON.stringify(input.meses_ejecutados) : null,
    input.porcentaje ?? null,
    now,
    now
  );
  return db.prepare('SELECT * FROM annual_plan WHERE id = ?').get(id);
}
export function updateAnnualPlan(db: any, id: string, patch: any) {
  const now = nowISO();
  const patchConMeses = { ...patch };
  for (const campo of ['meses', 'meses_ejecutados'] as const) {
    if (patchConMeses[campo] === undefined) continue;
    patchConMeses[campo] =
      Array.isArray(patchConMeses[campo]) && patchConMeses[campo].length > 0
        ? JSON.stringify(patchConMeses[campo])
        : null;
  }
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patchConMeses)) {
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

export function parseEstado(
  valor: string | null | undefined
): 'pendiente' | 'en_proceso' | 'cumplido' | 'incumplido' {
  if (!valor) return 'pendiente';
  const key = String(valor).trim().toLowerCase();
  return ESTADO_MAP[key] ?? 'pendiente';
}

export function importAnnualPlan(
  db: any,
  rows: AnnualPlanImportRow[]
): { importados: number; errores: string[] } {
  const now = nowISO();
  const stmt = db.prepare(
    `INSERT INTO annual_plan (id, anio, objetivo, meta, responsable, fecha_inicio, fecha_fin, presupuesto, estado, programa, evidencia_esperada, meses, meses_ejecutados, porcentaje, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  const errores: string[] = [];
  let importados = 0;
  db.prepare('BEGIN').run();
  try {
    for (const row of rows) {
      if (row.errores.length > 0) {
        errores.push(`Fila ${row.fila}: ${row.errores.join('; ')}`);
        continue;
      }
      stmt.run(
        genId(),
        row.anio,
        row.objetivo,
        row.meta ?? null,
        row.responsable ?? null,
        row.fecha_inicio ?? null,
        row.fecha_fin ?? null,
        row.presupuesto ?? 0,
        row.estado,
        row.programa ?? null,
        row.evidencia_esperada ?? null,
        row.meses.length > 0 ? JSON.stringify(row.meses) : null,
        row.meses_ejecutados.length > 0 ? JSON.stringify(row.meses_ejecutados) : null,
        row.porcentaje ?? 0,
        now,
        now
      );
      importados++;
    }
    db.prepare('COMMIT').run();
  } catch (err: any) {
    db.prepare('ROLLBACK').run();
    throw err;
  }
  return { importados, errores };
}

// ===== EVIDENCIAS DEL PLAN ANUAL (soportes reales por actividad) =====

export function getPlanEvidences(db: any, planId: string) {
  return db
    .prepare('SELECT * FROM annual_plan_evidences WHERE plan_id = ? ORDER BY creado_en DESC')
    .all(planId) as any[];
}

export function getAllPlanEvidences(db: any) {
  return db.prepare('SELECT * FROM annual_plan_evidences ORDER BY creado_en DESC').all() as any[];
}

export function getPlanEvidenceById(db: any, id: string) {
  return db.prepare('SELECT * FROM annual_plan_evidences WHERE id = ?').get(id) as any | undefined;
}

export function createPlanEvidence(db: any, input: any) {
  const id = genId();
  db.prepare(
    `INSERT INTO annual_plan_evidences (id, plan_id, url, nombre_original, mime, tamano, subido_por, creado_en)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(
    id,
    input.plan_id,
    input.url,
    input.nombre_original,
    input.mime ?? null,
    input.tamano ?? null,
    input.subido_por ?? null,
    nowISO()
  );
  return db.prepare('SELECT * FROM annual_plan_evidences WHERE id = ?').get(id);
}

export function deletePlanEvidence(db: any, id: string) {
  db.prepare('DELETE FROM annual_plan_evidences WHERE id = ?').run(id);
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
  vals.push(id);
  db.prepare(`UPDATE training_schedule SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return db.prepare('SELECT * FROM training_schedule WHERE id = ?').get(id);
}
export function deleteTrainingSchedule(db: any, id: string) {
  db.prepare('DELETE FROM training_schedule WHERE id = ?').run(id);
}

// ===== TRAININGS (Ejecución de capacitaciones con evidencias) =====

export function getTrainings(db: any) {
  return db
    .prepare(
      `
    SELECT t.*, ts.nombre as schedule_nombre, ts.tipo as schedule_tipo
    FROM trainings t
    LEFT JOIN training_schedule ts ON ts.id = t.schedule_id
    ORDER BY t.fecha DESC
  `
    )
    .all() as any[];
}

export function getTrainingById(db: any, id: string) {
  return db.prepare('SELECT * FROM trainings WHERE id = ?').get(id) as any | undefined;
}

export function createTraining(db: any, input: any) {
  const id = genId();
  const now = nowISO();
  db.prepare(
    `INSERT INTO trainings (id, schedule_id, nombre, fecha, instructor, archivo_evidencia, estado, creado_en)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(
    id,
    input.schedule_id ?? null,
    input.nombre,
    input.fecha,
    input.instructor ?? null,
    input.archivo_evidencia ?? null,
    input.estado ?? 'programada',
    now
  );
  return db.prepare('SELECT * FROM trainings WHERE id = ?').get(id);
}

export function updateTraining(db: any, id: string, patch: any) {
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  vals.push(id);
  db.prepare(`UPDATE trainings SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return db.prepare('SELECT * FROM trainings WHERE id = ?').get(id);
}

export function deleteTraining(db: any, id: string) {
  // Primero borrar asistencias asociadas
  db.prepare('DELETE FROM training_attendance WHERE training_id = ?').run(id);
  db.prepare('DELETE FROM trainings WHERE id = ?').run(id);
}

// ===== TRAINING ATTENDANCE (Asistencia con firma) =====

export function getTrainingAttendance(db: any, trainingId: string) {
  return db
    .prepare(
      `
    SELECT ta.*, w.nombres, w.apellidos, w.numero_documento, w.cargo
    FROM training_attendance ta
    JOIN workers w ON w.id = ta.worker_id
    WHERE ta.training_id = ?
    ORDER BY w.apellidos, w.nombres
  `
    )
    .all(trainingId) as any[];
}

export function createTrainingAttendance(db: any, input: any) {
  const id = genId();
  db.prepare(
    `INSERT INTO training_attendance (id, training_id, worker_id, firmado, firma_url)
     VALUES (?,?,?,?,?)`
  ).run(id, input.training_id, input.worker_id, input.firmado ?? 0, input.firma_url ?? null);
  return db.prepare('SELECT * FROM training_attendance WHERE id = ?').get(id);
}

export function updateTrainingAttendance(db: any, id: string, patch: any) {
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  vals.push(id);
  db.prepare(`UPDATE training_attendance SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return db.prepare('SELECT * FROM training_attendance WHERE id = ?').get(id);
}

export function deleteTrainingAttendance(db: any, id: string) {
  db.prepare('DELETE FROM training_attendance WHERE id = ?').run(id);
}

export function bulkCreateTrainingAttendance(db: any, trainingId: string, workerIds: string[]) {
  const stmt = db.prepare(
    `INSERT INTO training_attendance (id, training_id, worker_id, firmado, firma_url)
     VALUES (?,?,?,?,?)`
  );
  for (const workerId of workerIds) {
    stmt.run(genId(), trainingId, workerId, 0, null);
  }
  return getTrainingAttendance(db, trainingId);
}
