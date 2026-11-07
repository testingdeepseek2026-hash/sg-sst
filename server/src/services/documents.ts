import { genId, nowISO } from '../lib/utils.js';

export function getDocuments(db: any) {
  return db.prepare('SELECT * FROM documents ORDER BY fecha_emision DESC').all() as any[];
}
export function getDocumentById(db: any, id: string) {
  return db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any | undefined;
}
export function createDocument(db: any, input: any) {
  const id = genId();
  db.prepare(
    `INSERT INTO documents (id, codigo, nombre, version, tipo, archivo_url, fecha_emision,
      fecha_revision, retencion_anos, responsable, estado, creado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(id, input.codigo, input.nombre, input.version ?? '1.0', input.tipo, input.archivo_url ?? null,
    input.fecha_emision ?? nowISO(), input.fecha_revision ?? null, input.retencion_anos ?? 5,
    input.responsable ?? null, input.estado ?? 'vigente', nowISO());
  return db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
}
export function updateDocument(db: any, id: string, patch: any) {
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`); vals.push(v);
  }
  if (sets.length === 0) return getDocumentById(db, id);
  db.prepare(`UPDATE documents SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
  return db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
}
export function deleteDocument(db: any, id: string) {
  db.prepare('DELETE FROM documents WHERE id = ?').run(id);
}
