import { genId, nowISO } from '../lib/utils.js';

export function getAudits(db: any) {
  return db.prepare('SELECT * FROM audits ORDER BY fecha DESC').all() as any[];
}
export function createAudit(db: any, input: any) {
  const id = genId();
  db.prepare(
    `INSERT INTO audits (id, anio, tipo, fecha, auditor, alcance, hallazgos, conclusiones, compromisos, estado, creado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    input.anio,
    input.tipo,
    input.fecha,
    input.auditor ?? null,
    input.alcance ?? null,
    input.hallazgos ?? null,
    input.conclusiones ?? null,
    input.compromisos ?? null,
    input.estado ?? 'programada',
    nowISO()
  );
  return db.prepare('SELECT * FROM audits WHERE id = ?').get(id);
}
export function updateAudit(db: any, id: string, patch: any) {
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return db.prepare('SELECT * FROM audits WHERE id = ?').get(id);
  db.prepare(`UPDATE audits SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
  return db.prepare('SELECT * FROM audits WHERE id = ?').get(id);
}
export function deleteAudit(db: any, id: string) {
  db.prepare('DELETE FROM audits WHERE id = ?').run(id);
}

export function getAlerts(db: any) {
  return db.prepare('SELECT * FROM alerts ORDER BY fecha_vencimiento ASC').all() as any[];
}
export function createAlert(db: any, input: any) {
  const id = genId();
  db.prepare(
    `INSERT INTO alerts (id, entidad, entidad_id, tipo, fecha_vencimiento, enviado, canal, creado_en)
     VALUES (?,?,?,?,?,0,?,?)`
  ).run(
    input.entidad,
    input.entidad_id,
    input.tipo,
    input.fecha_vencimiento,
    input.canal ?? 'email',
    nowISO()
  );
  return db.prepare('SELECT * FROM alerts WHERE id = ?').get(id);
}
export function markAlertSent(db: any, id: string) {
  db.prepare('UPDATE alerts SET enviado = 1 WHERE id = ?').run(id);
}
export function deleteAlert(db: any, id: string) {
  db.prepare('DELETE FROM alerts WHERE id = ?').run(id);
}
