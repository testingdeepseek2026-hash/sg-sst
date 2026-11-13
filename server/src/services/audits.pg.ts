import { exec, one, query } from '../lib/db-pg.js';
import { genId, nowISO } from '../lib/utils.js';

/**
 * Auditorías internas y hallazgos para PostgreSQL (Neon) — Fase N3.6.
 * Equivalente asíncrono de la sección de auditorías de services/audits_alerts.ts.
 */

const AUDIT_FIELDS = new Set([
  'anio',
  'tipo',
  'fecha',
  'auditor',
  'alcance',
  'hallazgos',
  'conclusiones',
  'compromisos',
  'estado',
]);

const FINDING_FIELDS = new Set([
  'descripcion',
  'tipo',
  'requisito',
  'evidencia',
  'responsable',
  'fecha_limite',
  'estado',
  'accion_correctiva',
  'evidencia_cierre',
  'fecha_cierre',
]);

export async function getAuditsPg() {
  return query('SELECT * FROM audits ORDER BY fecha DESC');
}

export async function getAuditByIdPg(id: string) {
  return one('SELECT * FROM audits WHERE id = ?', [id]);
}

export async function createAuditPg(input: Record<string, any>) {
  const id = genId();
  await exec(
    `INSERT INTO audits (id, anio, tipo, fecha, auditor, alcance, hallazgos, conclusiones,
      compromisos, estado, creado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
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
      nowISO(),
    ]
  );
  return one('SELECT * FROM audits WHERE id = ?', [id]);
}

export async function updateAuditPg(id: string, patch: Record<string, any>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !AUDIT_FIELDS.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return one('SELECT * FROM audits WHERE id = ?', [id]);
  vals.push(id);
  await exec(`UPDATE audits SET ${sets.join(', ')} WHERE id = ?`, vals);
  return one('SELECT * FROM audits WHERE id = ?', [id]);
}

export async function deleteAuditPg(id: string) {
  await exec('DELETE FROM audits WHERE id = ?', [id]);
}

export async function getFindingsByAuditPg(auditId: string) {
  return query('SELECT * FROM audit_findings WHERE audit_id = ? ORDER BY creado_en DESC', [
    auditId,
  ]);
}

export async function getFindingByIdPg(id: string) {
  return one('SELECT * FROM audit_findings WHERE id = ?', [id]);
}

export async function createFindingPg(input: Record<string, any>) {
  const id = genId();
  await exec(
    `INSERT INTO audit_findings (id, audit_id, descripcion, tipo, requisito, evidencia, responsable,
      fecha_limite, estado, accion_correctiva, evidencia_cierre, fecha_cierre, creado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.audit_id,
      input.descripcion,
      input.tipo,
      input.requisito ?? null,
      input.evidencia ?? null,
      input.responsable,
      input.fecha_limite,
      input.estado ?? 'abierto',
      input.accion_correctiva ?? null,
      input.evidencia_cierre ?? null,
      input.fecha_cierre ?? null,
      nowISO(),
    ]
  );
  return one('SELECT * FROM audit_findings WHERE id = ?', [id]);
}

export async function updateFindingPg(id: string, patch: Record<string, any>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !FINDING_FIELDS.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return one('SELECT * FROM audit_findings WHERE id = ?', [id]);
  vals.push(id);
  await exec(`UPDATE audit_findings SET ${sets.join(', ')} WHERE id = ?`, vals);
  return one('SELECT * FROM audit_findings WHERE id = ?', [id]);
}

export async function deleteFindingPg(id: string) {
  await exec('DELETE FROM audit_findings WHERE id = ?', [id]);
}

export async function getFindingsSummaryPg() {
  const rows = await query<Record<string, string | number>>(
    `SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE estado = 'abierto') AS abiertos,
       COUNT(*) FILTER (WHERE estado = 'en_proceso') AS en_proceso,
       COUNT(*) FILTER (WHERE estado = 'cerrado') AS cerrados,
       COUNT(*) FILTER (WHERE estado = 'verificado') AS verificados,
       COUNT(*) FILTER (
         WHERE estado NOT IN ('cerrado', 'verificado') AND fecha_limite::date < CURRENT_DATE
       ) AS vencidos
     FROM audit_findings`
  );
  const row = rows[0] ?? {};
  return {
    total: Number(row.total ?? 0),
    abiertos: Number(row.abiertos ?? 0),
    en_proceso: Number(row.en_proceso ?? 0),
    cerrados: Number(row.cerrados ?? 0),
    verificados: Number(row.verificados ?? 0),
    vencidos: Number(row.vencidos ?? 0),
  };
}
