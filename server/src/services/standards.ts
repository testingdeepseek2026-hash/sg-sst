import { genId, nowISO } from '../lib/utils.js';

export function getStandards(db: any, set?: string) {
  if (set) {
    return db.prepare('SELECT * FROM standards WHERE activo = 1 AND set_aplicable = ? ORDER BY codigo').all(set);
  }
  return db.prepare('SELECT * FROM standards WHERE activo = 1 ORDER BY set_aplicable, codigo').all() as any[];
}
export function getStandardById(db: any, id: string) {
  return db.prepare('SELECT * FROM standards WHERE id = ?').get(id) as any | undefined;
}
export function createStandard(db: any, input: any) {
  const id = genId();
  db.prepare(
    `INSERT INTO standards (id, codigo, titulo, descripcion, set_aplicable, capitulo, modo_verificacion, activo)
     VALUES (?,?,?,?,?,?,?,1)`
  ).run(id, input.codigo, input.titulo, input.descripcion, input.set_aplicable, input.capitulo, input.modo_verificacion ?? null);
  return db.prepare('SELECT * FROM standards WHERE id = ?').get(id);
}
export function getStandardAssessments(db: any) {
  return db.prepare('SELECT * FROM standard_assessments ORDER BY fecha DESC').all() as any[];
}
export function createStandardAssessment(db: any, input: any) {
  const id = genId();
  const now = nowISO();
  db.prepare(
    `INSERT INTO standard_assessments (id, standard_id, cumple, observaciones, plan_mejora, fecha, usuario_id)
     VALUES (?,?,?,?,?,?,?)`
  ).run(id, input.standard_id, input.cumple ? 1 : 0, input.observaciones ?? null, input.plan_mejora ?? null, input.fecha ?? now, input.usuario_id ?? null);
  return db.prepare('SELECT * FROM standard_assessments WHERE id = ?').get(id);
}
export function updateStandardAssessment(db: any, id: string, patch: any) {
  const now = nowISO();
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(k === 'cumple' ? (v ? 1 : 0) : v);
  }
  sets.push('fecha = ?'); vals.push(now, id);
  db.prepare(`UPDATE standard_assessments SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return db.prepare('SELECT * FROM standard_assessments WHERE id = ?').get(id);
}
export function deleteStandardAssessment(db: any, id: string) {
  db.prepare('DELETE FROM standard_assessments WHERE id = ?').run(id);
}
export function stdCumplimiento(db: any) {
  const rows = db.prepare('SELECT cumple, COUNT(*) AS c FROM standard_assessments GROUP BY cumple').all() as { cumple: number; c: number }[];
  const si = rows.find(r => r.cumple === 1)?.c ?? 0;
  const no = rows.find(r => r.cumple === 0)?.c ?? 0;
  const total = si + no;
  return { total, cumplidos: si, incumplidos: no, porcentaje: total ? Math.round((si / total) * 100) : 0 };
}
