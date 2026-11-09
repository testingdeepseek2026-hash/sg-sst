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

// ===== AUDIT FINDINGS (Hallazgos) =====

export interface AuditFinding {
  id: string;
  audit_id: string;
  descripcion: string;
  tipo: 'no_conformidad' | 'observacion' | 'oportunidad_mejora' | 'fortaleza';
  requisito: string;
  evidencia: string;
  responsable: string;
  fecha_limite: string;
  estado: 'abierto' | 'en_proceso' | 'cerrado' | 'verificado';
  accion_correctiva: string;
  evidencia_cierre: string;
  fecha_cierre: string | null;
  creado_en: string;
}

export function getFindingsByAudit(db: any, auditId: string) {
  return db.prepare('SELECT * FROM audit_findings WHERE audit_id = ? ORDER BY creado_en DESC').all(auditId) as AuditFinding[];
}

export function getFindingById(db: any, id: string) {
  return db.prepare('SELECT * FROM audit_findings WHERE id = ?').get(id) as AuditFinding | undefined;
}

export function createFinding(db: any, input: any) {
  const id = genId();
  const now = nowISO();
  db.prepare(
    `INSERT INTO audit_findings (id, audit_id, descripcion, tipo, requisito, evidencia, responsable, fecha_limite, estado, accion_correctiva, evidencia_cierre, fecha_cierre, creado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
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
    now
  );
  return db.prepare('SELECT * FROM audit_findings WHERE id = ?').get(id);
}

export function updateFinding(db: any, id: string, patch: any) {
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return getFindingById(db, id);
  vals.push(id);
  db.prepare(`UPDATE audit_findings SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return db.prepare('SELECT * FROM audit_findings WHERE id = ?').get(id);
}

export function deleteFinding(db: any, id: string) {
  db.prepare('DELETE FROM audit_findings WHERE id = ?').run(id);
}

export function getFindingsSummary(db: any) {
  // Resumen global de hallazgos para seguimiento
  const total = db.prepare('SELECT COUNT(*) as c FROM audit_findings').get() as { c: number };
  const abiertos = db.prepare("SELECT COUNT(*) as c FROM audit_findings WHERE estado = 'abierto'").get() as { c: number };
  const enProceso = db.prepare("SELECT COUNT(*) as c FROM audit_findings WHERE estado = 'en_proceso'").get() as { c: number };
  const cerrados = db.prepare("SELECT COUNT(*) as c FROM audit_findings WHERE estado = 'cerrado'").get() as { c: number };
  const verificados = db.prepare("SELECT COUNT(*) as c FROM audit_findings WHERE estado = 'verificado'").get() as { c: number };
  const vencidos = db.prepare("SELECT COUNT(*) as c FROM audit_findings WHERE estado NOT IN ('cerrado', 'verificado') AND date(fecha_limite) < date('now')").get() as { c: number };

  return {
    total: total.c,
    abiertos: abiertos.c,
    en_proceso: enProceso.c,
    cerrados: cerrados.c,
    verificados: verificados.c,
    vencidos: vencidos.c,
  };
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
