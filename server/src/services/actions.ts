import { genId, nowISO } from '../lib/utils.js';

export function getCorrectiveActions(db: any) {
  return db.prepare('SELECT * FROM corrective_actions ORDER BY fecha_limite ASC').all() as any[];
}
export function createCorrectiveAction(db: any, input: any) {
  const id = genId();
  db.prepare(
    `INSERT INTO corrective_actions (id, origen, descripcion, responsable, fecha_limite, estado, prioridad, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    input.origen,
    input.descripcion,
    input.responsable,
    input.fecha_limite,
    input.estado ?? 'pendiente',
    input.prioridad ?? 'media',
    nowISO(),
    nowISO()
  );
  return db.prepare('SELECT * FROM corrective_actions WHERE id = ?').get(id);
}
export function updateCorrectiveAction(db: any, id: string, patch: any) {
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
  db.prepare(`UPDATE corrective_actions SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return db.prepare('SELECT * FROM corrective_actions WHERE id = ?').get(id);
}
export function deleteCorrectiveAction(db: any, id: string) {
  db.prepare('DELETE FROM corrective_actions WHERE id = ?').run(id);
}
