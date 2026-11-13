import { exec, one, query } from '../lib/db-pg.js';
import { genId, nowISO } from '../lib/utils.js';

/**
 * Gestión documental para PostgreSQL (Neon) — Fase N3.7.
 * Equivalente asíncrono de services/documents.ts.
 */

const DOCUMENT_FIELDS = new Set([
  'codigo',
  'nombre',
  'version',
  'tipo',
  'archivo_url',
  'fecha_emision',
  'fecha_revision',
  'retencion_anos',
  'responsable',
  'estado',
]);

export async function getDocumentsPg(filtros?: { estado?: string }) {
  let sql = 'SELECT * FROM documents';
  const params: unknown[] = [];
  if (filtros?.estado) {
    sql += ' WHERE estado = ?';
    params.push(filtros.estado);
  }
  sql += ' ORDER BY fecha_emision DESC';
  return query(sql, params);
}

export async function getDocumentByIdPg(id: string) {
  return one('SELECT * FROM documents WHERE id = ?', [id]);
}

export async function createDocumentPg(input: Record<string, any>) {
  const id = genId();
  await exec(
    `INSERT INTO documents (id, codigo, nombre, version, tipo, archivo_url, fecha_emision,
      fecha_revision, retencion_anos, responsable, estado, creado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.codigo,
      input.nombre,
      input.version ?? '1.0',
      input.tipo,
      input.archivo_url ?? null,
      input.fecha_emision ?? nowISO(),
      input.fecha_revision ?? null,
      input.retencion_anos ?? 5,
      input.responsable ?? null,
      input.estado ?? 'vigente',
      nowISO(),
    ]
  );
  return one('SELECT * FROM documents WHERE id = ?', [id]);
}

export async function updateDocumentPg(id: string, patch: Record<string, any>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !DOCUMENT_FIELDS.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return one('SELECT * FROM documents WHERE id = ?', [id]);
  vals.push(id);
  await exec(`UPDATE documents SET ${sets.join(', ')} WHERE id = ?`, vals);
  return one('SELECT * FROM documents WHERE id = ?', [id]);
}

export async function deleteDocumentPg(id: string) {
  await exec('DELETE FROM documents WHERE id = ?', [id]);
}
