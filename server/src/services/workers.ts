import { genId, nowISO } from '../lib/utils.js';

export function getWorkers(db: any) {
  return db.prepare('SELECT * FROM workers ORDER BY apellidos, nombres').all() as any[];
}
export function getWorkerById(db: any, id: string) {
  return db.prepare('SELECT * FROM workers WHERE id = ?').get(id) as any | undefined;
}
export function getWorkerByDocumento(db: any, numeroDocumento: string) {
  return db.prepare('SELECT * FROM workers WHERE numero_documento = ?').get(numeroDocumento) as any | undefined;
}
export function getWorkerByEmail(db: any, email: string) {
  return db.prepare('SELECT * FROM workers WHERE email = ?').get(email) as any | undefined;
}
export function createWorker(db: any, input: any) {
  const id = genId();
  const now = nowISO();
  db.prepare(
    `INSERT INTO workers (id, tipo_documento, numero_documento, nombres, apellidos, cargo, fecha_ingreso,
      fecha_egreso, estado, eps, afp, arl, caja_compensacion, telefono, email, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id, input.tipo_documento, input.numero_documento, input.nombres, input.apellidos, input.cargo,
    input.fecha_ingreso, input.fecha_egreso ?? null, input.estado ?? 'activo',
    input.eps ?? null, input.afp ?? null, input.arl ?? null, input.caja_compensacion ?? null,
    input.telefono ?? null, input.email ?? null, now, now
  );
  return getWorkerById(db, id)!;
}
export function updateWorker(db: any, id: string, patch: any) {
  const now = nowISO();
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`); vals.push(v);
  }
  sets.push('actualizado_en = ?'); vals.push(now, id);
  db.prepare(`UPDATE workers SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getWorkerById(db, id)!;
}
export function deleteWorker(db: any, id: string) {
  db.prepare('DELETE FROM workers WHERE id = ?').run(id);
}
