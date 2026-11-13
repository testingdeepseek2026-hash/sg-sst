import { genId } from '../lib/utils.js';

export function getIncidents(db: any) {
  return db.prepare('SELECT * FROM incidents ORDER BY fecha_ocurrencia DESC').all() as any[];
}
export function getIncidentById(db: any, id: string) {
  return db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as any | undefined;
}
export function createIncident(db: any, input: any) {
  const id = genId();
  db.prepare(
    `INSERT INTO incidents (id, tipo, fecha_ocurrencia, fecha_reporte, trabajador_id, lugar, descripcion,
      lesiones, causa_raiz, acciones_correctivas, reporte_arl, reporte_eps, reporte_mintrabajo,
      dias_perdidos, estado, investigador, fecha_cierre)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    input.tipo,
    input.fecha_ocurrencia,
    input.fecha_reporte ?? null,
    input.trabajador_id ? input.trabajador_id : null,
    input.lugar ?? null,
    input.descripcion,
    input.lesiones ?? null,
    input.causa_raiz ?? null,
    input.acciones_correctivas ?? null,
    input.reporte_arl ? 1 : 0,
    input.reporte_eps ? 1 : 0,
    input.reporte_mintrabajo ? 1 : 0,
    input.dias_perdidos ?? 0,
    input.estado ?? 'abierto',
    input.investigador ?? null,
    input.fecha_cierre ?? null
  );
  return db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
}
export function updateIncident(db: any, id: string, patch: any) {
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return getIncidentById(db, id);
  db.prepare(`UPDATE incidents SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
  return db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
}
export function deleteIncident(db: any, id: string) {
  db.prepare('DELETE FROM incidents WHERE id = ?').run(id);
}

// ===== ACCIONES CORRECTIVAS DEL INCIDENTE =====

export function getActionsByIncident(db: any, incidentId: string) {
  return db
    .prepare('SELECT * FROM incident_actions WHERE incident_id = ? ORDER BY creado_en DESC')
    .all(incidentId) as any[];
}

export function createIncidentAction(db: any, incidentId: string, input: any) {
  const id = genId();
  db.prepare(
    `INSERT INTO incident_actions (id, incident_id, descripcion, responsable, fecha_limite, estado, evidencia_url, creado_en, completada_en)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    incidentId,
    input.descripcion,
    input.responsable,
    input.fecha_limite ?? null,
    input.estado ?? 'pendiente',
    input.evidencia_url ?? null,
    new Date().toISOString(),
    input.completada_en ?? null
  );
  return db.prepare('SELECT * FROM incident_actions WHERE id = ?').get(id);
}

export function updateIncidentAction(db: any, id: string, patch: any) {
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return db.prepare('SELECT * FROM incident_actions WHERE id = ?').get(id);
  db.prepare(`UPDATE incident_actions SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
  return db.prepare('SELECT * FROM incident_actions WHERE id = ?').get(id);
}

export function deleteIncidentAction(db: any, id: string) {
  db.prepare('DELETE FROM incident_actions WHERE id = ?').run(id);
}
