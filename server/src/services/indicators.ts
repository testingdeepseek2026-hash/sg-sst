import { genId, nowISO } from '../lib/utils.js';

export function getIndicators(db: any, periodo?: string) {
  if (periodo)
    return db.prepare('SELECT * FROM indicators WHERE periodo = ? ORDER BY nombre').all(periodo);
  return db.prepare('SELECT * FROM indicators ORDER BY periodo DESC, nombre').all() as any[];
}
export function createIndicator(db: any, input: any) {
  const id = genId();
  db.prepare(
    `INSERT INTO indicators (id, nombre, tipo, valor, meta, periodo, fecha_calculo, notas)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(
    id,
    input.nombre,
    input.tipo,
    input.valor,
    input.meta ?? null,
    input.periodo,
    input.fecha_calculo ?? nowISO(),
    input.notas ?? null
  );
  return db.prepare('SELECT * FROM indicators WHERE id = ?').get(id);
}
export function updateIndicator(db: any, id: string, patch: any) {
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  sets.push('fecha_calculo = ?');
  vals.push(nowISO(), id);
  db.prepare(`UPDATE indicators SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return db.prepare('SELECT * FROM indicators WHERE id = ?').get(id);
}
export function deleteIndicator(db: any, id: string) {
  db.prepare('DELETE FROM indicators WHERE id = ?').run(id);
}
