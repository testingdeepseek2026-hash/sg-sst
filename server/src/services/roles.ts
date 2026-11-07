import { genId, nowISO } from '../lib/utils.js';

export function getRoles(db: any) {
  return db.prepare('SELECT * FROM roles ORDER BY nombre').all() as any[];
}
export function getRoleById(db: any, id: string) {
  return db.prepare('SELECT * FROM roles WHERE id = ?').get(id) as any | undefined;
}
export function createRole(db: any, input: any) {
  const id = genId();
  const now = nowISO();
  db.prepare(
    `INSERT INTO roles (id, nombre, descripcion, usuario_id, licencia_sst_numero, licencia_sst_vence,
      curso_50h, curso_50h_vence, notas, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id, input.nombre, input.descripcion ?? null, input.usuario_id ?? null,
    input.licencia_sst_numero ?? null, input.licencia_sst_vence ?? null,
    input.curso_50h ? 1 : 0, input.curso_50h_vence ?? null,
    input.notas ?? null, now, now
  );
  return getRoleById(db, id)!;
}
export function updateRole(db: any, id: string, patch: any) {
  const now = nowISO();
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (k === 'curso_50h') { sets.push('curso_50h = ?'); vals.push(v ? 1 : 0); continue; }
    sets.push(`${k} = ?`); vals.push(v);
  }
  sets.push('actualizado_en = ?'); vals.push(now, id);
  db.prepare(`UPDATE roles SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getRoleById(db, id)!;
}
export function deleteRole(db: any, id: string) {
  db.prepare('DELETE FROM roles WHERE id = ?').run(id);
}
export function getRoleVencimientos(db: any) {
  const rows = db.prepare(
    `SELECT r.id, r.nombre, r.licencia_sst_vence AS fecha, r.licencia_sst_numero,
            u.email AS usuario_email, 'licencia_sst' AS tipo
     FROM roles r LEFT JOIN users u ON r.usuario_id = u.id
     WHERE r.licencia_sst_vence IS NOT NULL
     UNION ALL
     SELECT r.id, r.nombre, r.curso_50h_vence AS fecha, r.licencia_sst_numero,
            u.email AS usuario_email, 'curso_50h' AS tipo
     FROM roles r LEFT JOIN users u ON r.usuario_id = u.id
     WHERE r.curso_50h_vence IS NOT NULL
     ORDER BY fecha`
  ).all() as any[];
  return rows;
}
