import { exec, one, query } from '../lib/db-pg.js';
import { genId, nowISO } from '../lib/utils.js';

/**
 * Incidentes, accidentes y acciones asociadas para PostgreSQL (Neon) — Fase N3.6.
 * Equivalente asíncrono de services/incidents.ts.
 */

const INCIDENT_FIELDS = new Set([
  'tipo',
  'fecha_ocurrencia',
  'fecha_reporte',
  'trabajador_id',
  'lugar',
  'descripcion',
  'lesiones',
  'causa_raiz',
  'acciones_correctivas',
  'reporte_arl',
  'reporte_eps',
  'reporte_mintrabajo',
  'dias_perdidos',
  'estado',
  'investigador',
  'fecha_cierre',
]);

const INCIDENT_BOOL_FIELDS = new Set(['reporte_arl', 'reporte_eps', 'reporte_mintrabajo']);

const INCIDENT_ACTION_FIELDS = new Set([
  'descripcion',
  'responsable',
  'fecha_limite',
  'estado',
  'evidencia_url',
  'completada_en',
]);

export async function getIncidentsPg() {
  return query('SELECT * FROM incidents ORDER BY fecha_ocurrencia DESC');
}

export async function getIncidentByIdPg(id: string) {
  return one('SELECT * FROM incidents WHERE id = ?', [id]);
}

export async function createIncidentPg(input: Record<string, any>) {
  const id = genId();
  await exec(
    `INSERT INTO incidents (id, tipo, fecha_ocurrencia, fecha_reporte, trabajador_id, lugar, descripcion,
      lesiones, causa_raiz, acciones_correctivas, reporte_arl, reporte_eps, reporte_mintrabajo,
      dias_perdidos, estado, investigador, fecha_cierre)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
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
      input.fecha_cierre ?? null,
    ]
  );
  return one('SELECT * FROM incidents WHERE id = ?', [id]);
}

export async function updateIncidentPg(id: string, patch: Record<string, any>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !INCIDENT_FIELDS.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(INCIDENT_BOOL_FIELDS.has(k) ? (v ? 1 : 0) : v);
  }
  if (sets.length === 0) return one('SELECT * FROM incidents WHERE id = ?', [id]);
  vals.push(id);
  await exec(`UPDATE incidents SET ${sets.join(', ')} WHERE id = ?`, vals);
  return one('SELECT * FROM incidents WHERE id = ?', [id]);
}

export async function deleteIncidentPg(id: string) {
  await exec('DELETE FROM incidents WHERE id = ?', [id]);
}

export async function getActionsByIncidentPg(incidentId: string) {
  return query('SELECT * FROM incident_actions WHERE incident_id = ? ORDER BY creado_en DESC', [
    incidentId,
  ]);
}

export async function createIncidentActionPg(incidentId: string, input: Record<string, any>) {
  const id = genId();
  await exec(
    `INSERT INTO incident_actions (id, incident_id, descripcion, responsable, fecha_limite, estado,
      evidencia_url, creado_en, completada_en)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      id,
      incidentId,
      input.descripcion,
      input.responsable,
      input.fecha_limite ?? null,
      input.estado ?? 'pendiente',
      input.evidencia_url ?? null,
      nowISO(),
      input.completada_en ?? null,
    ]
  );
  return one('SELECT * FROM incident_actions WHERE id = ?', [id]);
}

export async function updateIncidentActionPg(id: string, patch: Record<string, any>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !INCIDENT_ACTION_FIELDS.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return one('SELECT * FROM incident_actions WHERE id = ?', [id]);
  vals.push(id);
  await exec(`UPDATE incident_actions SET ${sets.join(', ')} WHERE id = ?`, vals);
  return one('SELECT * FROM incident_actions WHERE id = ?', [id]);
}

export async function deleteIncidentActionPg(id: string) {
  await exec('DELETE FROM incident_actions WHERE id = ?', [id]);
}
