import { genId, nowISO } from '../lib/utils.js';

export function getInspections(db: any) {
  return db.prepare('SELECT * FROM inspections ORDER BY fecha DESC').all() as any[];
}
export function getInspectionById(db: any, id: string) {
  return db.prepare('SELECT * FROM inspections WHERE id = ?').get(id) as any | undefined;
}
export function createInspection(db: any, input: any) {
  const id = genId();
  const now = nowISO();
  db.prepare(
    `INSERT INTO inspections (id, tipo, fecha, lugar, responsable, estado, resultado_json,
      observaciones, firmado_por, firma_url, archivo_fotos, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id, input.tipo, input.fecha, input.lugar ?? null, input.responsable ?? null, input.estado ?? 'pendiente',
    input.resultado_json ?? null, input.observaciones ?? null, input.firmado_por ?? null,
    input.firma_url ?? null, input.archivo_fotos ?? null, now, now
  );
  return db.prepare('SELECT * FROM inspections WHERE id = ?').get(id);
}
export function updateInspection(db: any, id: string, patch: any) {
  const now = nowISO();
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`); vals.push(v);
  }
  sets.push('actualizado_en = ?'); vals.push(now, id);
  db.prepare(`UPDATE inspections SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return db.prepare('SELECT * FROM inspections WHERE id = ?').get(id);
}
export function deleteInspection(db: any, id: string) {
  db.prepare('DELETE FROM inspections WHERE id = ?').run(id);
}

export function getAlturaPermits(db: any) {
  return db.prepare('SELECT * FROM altura_permits ORDER BY fecha DESC').all() as any[];
}
export function createAlturaPermit(db: any, input: any) {
  const id = genId();
  const now = nowISO();
  db.prepare(
    `INSERT INTO altura_permits (id, obra, fecha, hora_inicio, hora_fin, solicitante, responsable_seguridad,
      sistema_proteccion, equipo_verificado, apto_medico, certificado_alturas, estado, at_s_id, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id, input.obra, input.fecha, input.hora_inicio ?? null, input.hora_fin ?? null, input.solicitante ?? null,
    input.responsable_seguridad ?? null, input.sistema_proteccion ?? null, input.equipo_verificado ? 1 : 0,
    input.apto_medico ? 1 : 0, input.certificado_alturas ? 1 : 0, input.estado ?? 'pendiente',
    input.at_s_id ?? null, now, now
  );
  return db.prepare('SELECT * FROM altura_permits WHERE id = ?').get(id);
}
export function updateAlturaPermit(db: any, id: string, patch: any) {
  const now = nowISO();
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`); vals.push(v);
  }
  sets.push('actualizado_en = ?'); vals.push(now, id);
  db.prepare(`UPDATE altura_permits SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return db.prepare('SELECT * FROM altura_permits WHERE id = ?').get(id);
}
export function deleteAlturaPermit(db: any, id: string) {
  db.prepare('DELETE FROM altura_permits WHERE id = ?').run(id);
}

export function getATS(db: any) {
  return db.prepare('SELECT * FROM ats ORDER BY fecha DESC').all() as any[];
}
export function createATS(db: any, input: any) {
  const id = genId();
  db.prepare(
    `INSERT INTO ats (id, obra, tarea, peligro, control, responsable, fecha, estado)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(id, input.obra, input.tarea, input.peligro ?? null, input.control ?? null, input.responsable ?? null, input.fecha ?? nowISO(), input.estado ?? 'vigente');
  return db.prepare('SELECT * FROM ats WHERE id = ?').get(id);
}
export function deleteATS(db: any, id: string) {
  db.prepare('DELETE FROM ats WHERE id = ?').run(id);
}
