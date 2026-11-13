import { exec, one, query } from '../lib/db-pg.js';
import { genId, nowISO } from '../lib/utils.js';

/**
 * Inspecciones, permisos de trabajo en alturas y ATS para PostgreSQL (Neon) — Fase N3.5.
 * Equivalente asíncrono de services/inspections.ts.
 */

const INSPECTION_FIELDS = new Set([
  'tipo',
  'fecha',
  'lugar',
  'responsable',
  'estado',
  'resultado_json',
  'observaciones',
  'firmado_por',
  'firma_url',
  'archivo_fotos',
]);

const PERMIT_FIELDS = new Set([
  'obra',
  'fecha',
  'hora_inicio',
  'hora_fin',
  'solicitante',
  'responsable_seguridad',
  'sistema_proteccion',
  'equipo_verificado',
  'apto_medico',
  'certificado_alturas',
  'estado',
  'at_s_id',
  'archivo_fotos',
  'firma_solicitante_url',
  'firma_responsable_url',
]);

const PERMIT_BOOL_FIELDS = new Set(['equipo_verificado', 'apto_medico', 'certificado_alturas']);

const ATS_FIELDS = new Set([
  'obra',
  'tarea',
  'peligro',
  'control',
  'responsable',
  'fecha',
  'estado',
]);

export async function getInspectionsPg() {
  return query('SELECT * FROM inspections ORDER BY fecha DESC');
}

export async function getInspectionByIdPg(id: string) {
  return one('SELECT * FROM inspections WHERE id = ?', [id]);
}

export async function createInspectionPg(input: Record<string, any>) {
  const id = genId();
  const now = nowISO();
  await exec(
    `INSERT INTO inspections (id, tipo, fecha, lugar, responsable, estado, resultado_json,
      observaciones, firmado_por, firma_url, archivo_fotos, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.tipo,
      input.fecha,
      input.lugar ?? null,
      input.responsable ?? null,
      input.estado ?? 'pendiente',
      input.resultado_json ?? null,
      input.observaciones ?? null,
      input.firmado_por ?? null,
      input.firma_url ?? null,
      input.archivo_fotos ?? null,
      now,
      now,
    ]
  );
  return one('SELECT * FROM inspections WHERE id = ?', [id]);
}

export async function updateInspectionPg(id: string, patch: Record<string, any>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !INSPECTION_FIELDS.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  sets.push('actualizado_en = ?');
  vals.push(nowISO(), id);
  await exec(`UPDATE inspections SET ${sets.join(', ')} WHERE id = ?`, vals);
  return one('SELECT * FROM inspections WHERE id = ?', [id]);
}

export async function deleteInspectionPg(id: string) {
  await exec('DELETE FROM inspections WHERE id = ?', [id]);
}

export async function getAlturaPermitsPg() {
  return query('SELECT * FROM altura_permits ORDER BY fecha DESC');
}

export async function createAlturaPermitPg(input: Record<string, any>) {
  const id = genId();
  const now = nowISO();
  await exec(
    `INSERT INTO altura_permits (id, obra, fecha, hora_inicio, hora_fin, solicitante, responsable_seguridad,
      sistema_proteccion, equipo_verificado, apto_medico, certificado_alturas, estado, at_s_id,
      archivo_fotos, firma_solicitante_url, firma_responsable_url, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.obra,
      input.fecha,
      input.hora_inicio ?? null,
      input.hora_fin ?? null,
      input.solicitante ?? null,
      input.responsable_seguridad ?? null,
      input.sistema_proteccion ?? null,
      input.equipo_verificado ? 1 : 0,
      input.apto_medico ? 1 : 0,
      input.certificado_alturas ? 1 : 0,
      input.estado ?? 'pendiente',
      input.at_s_id ?? null,
      input.archivo_fotos ?? null,
      input.firma_solicitante_url ?? null,
      input.firma_responsable_url ?? null,
      now,
      now,
    ]
  );
  return one('SELECT * FROM altura_permits WHERE id = ?', [id]);
}

export async function updateAlturaPermitPg(id: string, patch: Record<string, any>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !PERMIT_FIELDS.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(PERMIT_BOOL_FIELDS.has(k) ? (v ? 1 : 0) : v);
  }
  sets.push('actualizado_en = ?');
  vals.push(nowISO(), id);
  await exec(`UPDATE altura_permits SET ${sets.join(', ')} WHERE id = ?`, vals);
  return one('SELECT * FROM altura_permits WHERE id = ?', [id]);
}

export async function deleteAlturaPermitPg(id: string) {
  await exec('DELETE FROM altura_permits WHERE id = ?', [id]);
}

export async function getATSPg() {
  return query('SELECT * FROM ats ORDER BY fecha DESC');
}

export async function createATSPg(input: Record<string, any>) {
  const id = genId();
  await exec(
    `INSERT INTO ats (id, obra, tarea, peligro, control, responsable, fecha, estado)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      id,
      input.obra,
      input.tarea,
      input.peligro ?? null,
      input.control ?? null,
      input.responsable ?? null,
      input.fecha ?? nowISO(),
      input.estado ?? 'vigente',
    ]
  );
  return one('SELECT * FROM ats WHERE id = ?', [id]);
}

export async function updateATSPg(id: string, patch: Record<string, any>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !ATS_FIELDS.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return one('SELECT * FROM ats WHERE id = ?', [id]);
  vals.push(id);
  await exec(`UPDATE ats SET ${sets.join(', ')} WHERE id = ?`, vals);
  return one('SELECT * FROM ats WHERE id = ?', [id]);
}

export async function deleteATSPg(id: string) {
  await exec('DELETE FROM ats WHERE id = ?', [id]);
}
