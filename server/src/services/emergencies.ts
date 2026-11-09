import { genId, nowISO } from '../lib/utils.js';

// ===== EMERGENCY PLANS =====

export function getEmergencyPlans(db: any) {
  return db.prepare('SELECT * FROM emergency_plans ORDER BY fecha_creacion DESC').all() as any[];
}

export function getEmergencyPlanById(db: any, id: string) {
  return db.prepare('SELECT * FROM emergency_plans WHERE id = ?').get(id) as any | undefined;
}

export function createEmergencyPlan(db: any, input: any) {
  const id = genId();
  const now = nowISO();
  db.prepare(
    `INSERT INTO emergency_plans (id, nombre, tipo_emergencia, contenido, fecha_creacion, vigente)
     VALUES (?,?,?,?,?,?)`
  ).run(
    id,
    input.nombre,
    input.tipo_emergencia,
    input.contenido ?? null,
    now,
    input.vigente ?? 1
  );
  return db.prepare('SELECT * FROM emergency_plans WHERE id = ?').get(id);
}

export function updateEmergencyPlan(db: any, id: string, patch: any) {
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  vals.push(id);
  db.prepare(`UPDATE emergency_plans SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return db.prepare('SELECT * FROM emergency_plans WHERE id = ?').get(id);
}

export function deleteEmergencyPlan(db: any, id: string) {
  // Primero borrar simulacros asociados
  db.prepare('DELETE FROM drills WHERE emergency_plan_id = ?').run(id);
  db.prepare('DELETE FROM emergency_plans WHERE id = ?').run(id);
}

// ===== DRILLS (Simulacros) =====

export function getDrills(db: any) {
  return db.prepare(`
    SELECT d.*, ep.nombre as plan_nombre, ep.tipo_emergencia as plan_tipo
    FROM drills d
    LEFT JOIN emergency_plans ep ON ep.id = d.emergency_plan_id
    ORDER BY d.fecha DESC
  `).all() as any[];
}

export function getDrillById(db: any, id: string) {
  return db.prepare('SELECT * FROM drills WHERE id = ?').get(id) as any | undefined;
}

export function getDrillsByPlan(db: any, planId: string) {
  return db.prepare('SELECT * FROM drills WHERE emergency_plan_id = ? ORDER BY fecha DESC').all(planId) as any[];
}

export function createDrill(db: any, input: any) {
  const id = genId();
  db.prepare(
    `INSERT INTO drills (id, emergency_plan_id, fecha, tipo, participantes, observaciones, estado)
     VALUES (?,?,?,?,?,?,?)`
  ).run(
    id,
    input.emergency_plan_id ?? null,
    input.fecha,
    input.tipo,
    input.participantes ?? null,
    input.observaciones ?? null,
    input.estado ?? 'realizado'
  );
  return db.prepare('SELECT * FROM drills WHERE id = ?').get(id);
}

export function updateDrill(db: any, id: string, patch: any) {
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  vals.push(id);
  db.prepare(`UPDATE drills SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return db.prepare('SELECT * FROM drills WHERE id = ?').get(id);
}

export function deleteDrill(db: any, id: string) {
  db.prepare('DELETE FROM drills WHERE id = ?').run(id);
}