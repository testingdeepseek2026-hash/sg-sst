/**
 * Módulo de Privacidad y Protección de Datos (Ley 1581/2012 - Colombia)
 * Implementa: Aviso de privacidad, Consentimientos, Derechos ARCO
 */

import { genId, nowISO } from '../lib/utils.js';
import { decryptSensitiveFields, encrypt, isEncrypted, SENSITIVE_FIELDS } from '../lib/crypto.js';

export interface PrivacyNotice {
  id: string;
  version: number;
  titulo: string;
  contenido: string;
  fecha_vigencia: string;
  estado: 'borrador' | 'vigente' | 'archivado';
  creado_en: string;
  actualizado_en: string;
}

export interface ConsentRecord {
  id: string;
  worker_id: string;
  tipo: 'medico' | 'biometrico' | 'general' | 'marketing' | 'transferencia';
  finalidad: string;
  autorizado: number; // 0 | 1
  fecha: string;
  medio: 'escrito' | 'digital' | 'verbal';
  version_aviso: string;
  ip?: string;
  user_agent?: string;
  retirado_en?: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface ArcoRequest {
  id: string;
  worker_id: string;
  tipo: 'acceso' | 'rectificacion' | 'cancelacion' | 'oposicion';
  descripcion: string;
  estado: 'pendiente' | 'en_proceso' | 'resuelto' | 'rechazado';
  respuesta?: string;
  fecha_solicitud: string;
  fecha_respuesta?: string | null;
  responsable: string;
  evidencia_respuesta?: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface DataProcessingRecord {
  id: string;
  entidad: string;
  finalidad: string;
  categorias_datos: string[]; // ej: ['identificacion', 'medicos', 'biometricos', 'laborales']
  base_legal: string; // consentimiento, contrato, obligacion_legal, interes_vital, interes_publico, interes_legitimo
  destinatarios?: string[]; // terceros con quienes se comparten
  transferencias_internacionales?: boolean;
  pais_destino?: string;
  medidas_seguridad: string[];
  retencion_dias: number;
  creado_en: string;
  actualizado_en: string;
}

/**
 * Avisos de Privacidad
 */
export function createPrivacyNotice(
  db: any,
  input: {
    titulo: string;
    contenido: string;
    fecha_vigencia: string;
    estado?: 'borrador' | 'vigente' | 'archivado';
  }
): PrivacyNotice {
  const id = genId();
  const now = nowISO();
  const estado = input.estado ?? 'borrador';

  db.prepare(
    `INSERT INTO privacy_notices (id, version, titulo, contenido, fecha_vigencia, estado, creado_en, actualizado_en)
     VALUES (?, 1, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.titulo, input.contenido, input.fecha_vigencia, estado, now, now);

  return getPrivacyNoticeById(db, id)!;
}

export function getPrivacyNoticeById(db: any, id: string): PrivacyNotice | undefined {
  return db.prepare('SELECT * FROM privacy_notices WHERE id = ?').get(id) as PrivacyNotice | undefined;
}

export function getActivePrivacyNotice(db: any): PrivacyNotice | undefined {
  return db.prepare("SELECT * FROM privacy_notices WHERE estado = 'vigente' ORDER BY version DESC LIMIT 1").get() as PrivacyNotice | undefined;
}

export function getPrivacyNotices(db: any): PrivacyNotice[] {
  return db.prepare('SELECT * FROM privacy_notices ORDER BY version DESC, creado_en DESC').all() as PrivacyNotice[];
}

export function updatePrivacyNotice(
  db: any,
  id: string,
  patch: Partial<Pick<PrivacyNotice, 'titulo' | 'contenido' | 'fecha_vigencia' | 'estado'>>
): PrivacyNotice | undefined {
  const existing = getPrivacyNoticeById(db, id);
  if (!existing) return undefined;

  const now = nowISO();
  const sets: string[] = [];
  const vals: any[] = [];

  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }

  if (sets.length === 0) return existing;

  sets.push('actualizado_en = ?');
  vals.push(now, id);

  db.prepare(`UPDATE privacy_notices SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getPrivacyNoticeById(db, id)!;
}

/**
 * Consentimientos (Ley 1581/2012 - Art. 9, 10)
 * Tipos: medico (datos sensibles), biometrico (firmas, huellas), general, marketing, transferencia
 */
export function createConsent(
  db: any,
  input: {
    worker_id: string;
    tipo: ConsentRecord['tipo'];
    finalidad: string;
    autorizado: number;
    medio: ConsentRecord['medio'];
    version_aviso: string;
    ip?: string;
    user_agent?: string;
  }
): ConsentRecord {
  // Verificar si ya existe consentimiento del mismo tipo para este trabajador
  const existing = db.prepare(
    'SELECT * FROM consents WHERE worker_id = ? AND tipo = ? AND version_aviso = ?'
  ).get(input.worker_id, input.tipo, input.version_aviso);

  const id = genId();
  const now = nowISO();

  if (existing) {
    // Actualizar existente
    db.prepare(
      `UPDATE consents SET autorizado = ?, finalidad = ?, medio = ?, fecha = ?, ip = ?, user_agent = ?, retirado_en = NULL, actualizado_en = ? WHERE id = ?`
    ).run(input.autorizado, input.finalidad, input.medio, now, input.ip ?? null, input.user_agent ?? null, now, existing.id);
    return getConsentById(db, existing.id)!;
  }

  db.prepare(
    `INSERT INTO consents (id, worker_id, tipo, finalidad, autorizado, fecha, medio, version_aviso, ip, user_agent, retirado_en, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,NULL,?,?)`
  ).run(
    id,
    input.worker_id,
    input.tipo,
    input.finalidad,
    input.autorizado,
    now,
    input.medio,
    input.version_aviso,
    input.ip ?? null,
    input.user_agent ?? null,
    now,
    now
  );

  return getConsentById(db, id)!;
}

export function getConsentById(db: any, id: string): ConsentRecord | undefined {
  return db.prepare('SELECT * FROM consents WHERE id = ?').get(id) as ConsentRecord | undefined;
}

export function getConsentsByWorker(db: any, workerId: string): ConsentRecord[] {
  return db.prepare('SELECT * FROM consents WHERE worker_id = ? ORDER BY fecha DESC').all(workerId) as ConsentRecord[];
}

export function getActiveConsent(db: any, workerId: string, tipo: ConsentRecord['tipo']): ConsentRecord | undefined {
  return db.prepare(
    'SELECT * FROM consents WHERE worker_id = ? AND tipo = ? AND autorizado = 1 AND retirado_en IS NULL ORDER BY fecha DESC LIMIT 1'
  ).get(workerId, tipo) as ConsentRecord | undefined;
}

export function withdrawConsent(db: any, consentId: string): ConsentRecord | undefined {
  const now = nowISO();
  db.prepare('UPDATE consents SET autorizado = 0, retirado_en = ?, actualizado_en = ? WHERE id = ?')
    .run(now, now, consentId);
  return getConsentById(db, consentId);
}

export function hasValidConsent(db: any, workerId: string, tipo: ConsentRecord['tipo']): boolean {
  const consent = getActiveConsent(db, workerId, tipo);
  return !!consent;
}

/**
 * Derechos ARCO (Ley 1581/2012 - Art. 8, 15, 16, 17)
 * Acceso, Rectificación, Cancelación, Oposición
 */
export function createArcoRequest(
  db: any,
  input: {
    worker_id: string;
    tipo: ArcoRequest['tipo'];
    descripcion: string;
    responsable: string;
  }
): ArcoRequest {
  const id = genId();
  const now = nowISO();

  db.prepare(
    `INSERT INTO arco_requests (id, worker_id, tipo, descripcion, estado, responsable, fecha_solicitud, creado_en, actualizado_en)
     VALUES (?,?,?,'pendiente',?,?,?,?)`
  ).run(id, input.worker_id, input.tipo, input.descripcion, input.responsable, now, now, now);

  return getArcoRequestById(db, id)!;
}

export function getArcoRequestById(db: any, id: string): ArcoRequest | undefined {
  return db.prepare('SELECT * FROM arco_requests WHERE id = ?').get(id) as ArcoRequest | undefined;
}

export function getArcoRequests(db: any, workerId?: string): ArcoRequest[] {
  if (workerId) {
    return db.prepare('SELECT * FROM arco_requests WHERE worker_id = ? ORDER BY fecha_solicitud DESC').all(workerId) as ArcoRequest[];
  }
  return db.prepare('SELECT * FROM arco_requests ORDER BY fecha_solicitud DESC').all() as ArcoRequest[];
}

export function updateArcoRequest(
  db: any,
  id: string,
  patch: Partial<Pick<ArcoRequest, 'estado' | 'respuesta' | 'evidencia_respuesta'>>
): ArcoRequest | undefined {
  const existing = getArcoRequestById(db, id);
  if (!existing) return undefined;

  const now = nowISO();
  const sets: string[] = [];
  const vals: any[] = [];

  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }

  if (patch.estado === 'resuelto' && !existing.fecha_respuesta) {
    sets.push('fecha_respuesta = ?');
    vals.push(now);
  }

  if (sets.length === 0) return existing;

  sets.push('actualizado_en = ?');
  vals.push(now, id);

  db.prepare(`UPDATE arco_requests SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getArcoRequestById(db, id)!;
}

export function getArcoStats(db: any): {
  total: number;
  pendientes: number;
  en_proceso: number;
  resueltos: number;
  rechazados: number;
  por_tipo: Record<string, number>;
} {
  const total = db.prepare('SELECT COUNT(*) as c FROM arco_requests').get() as { c: number };
  const pendientes = db.prepare("SELECT COUNT(*) as c FROM arco_requests WHERE estado = 'pendiente'").get() as { c: number };
  const en_proceso = db.prepare("SELECT COUNT(*) as c FROM arco_requests WHERE estado = 'en_proceso'").get() as { c: number };
  const resueltos = db.prepare("SELECT COUNT(*) as c FROM arco_requests WHERE estado = 'resuelto'").get() as { c: number };
  const rechazados = db.prepare("SELECT COUNT(*) as c FROM arco_requests WHERE estado = 'rechazado'").get() as { c: number };

  const por_tipo_rows = db.prepare(
    "SELECT tipo, COUNT(*) as c FROM arco_requests GROUP BY tipo"
  ).all() as Array<{ tipo: string; c: number }>;

  const por_tipo: Record<string, number> = {};
  for (const row of por_tipo_rows) {
    por_tipo[row.tipo] = row.c;
  }

  return {
    total: total.c,
    pendientes: pendientes.c,
    en_proceso: en_proceso.c,
    resueltos: resueltos.c,
    rechazados: rechazados.c,
    por_tipo,
  };
}

/**
 * Registro de Tratamiento de Datos (Ley 1581/2012 - Art. 18, Decreto 1377/2013)
 */
export function createDataProcessingRecord(
  db: any,
  input: {
    entidad: string;
    finalidad: string;
    categorias_datos: string[];
    base_legal: DataProcessingRecord['base_legal'];
    destinatarios?: string[];
    transferencias_internacionales?: boolean;
    pais_destino?: string;
    medidas_seguridad: string[];
    retencion_dias: number;
  }
): DataProcessingRecord {
  const id = genId();
  const now = nowISO();

  db.prepare(
    `INSERT INTO data_processing_records (id, entidad, finalidad, categorias_datos, base_legal, destinatarios, transferencias_internacionales, pais_destino, medidas_seguridad, retencion_dias, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    input.entidad,
    input.finalidad,
    JSON.stringify(input.categorias_datos),
    input.base_legal,
    JSON.stringify(input.destinatarios ?? []),
    input.transferencias_internacionales ? 1 : 0,
    input.pais_destino ?? null,
    JSON.stringify(input.medidas_seguridad),
    input.retencion_dias,
    now,
    now
  );

  return getDataProcessingRecordById(db, id)!;
}

export function getDataProcessingRecordById(db: any, id: string): DataProcessingRecord | undefined {
  const row = db.prepare('SELECT * FROM data_processing_records WHERE id = ?').get(id) as any;
  if (!row) return undefined;
  return {
    ...row,
    categorias_datos: JSON.parse(row.categorias_datos),
    destinatarios: JSON.parse(row.destinatarios || '[]'),
    medidas_seguridad: JSON.parse(row.medidas_seguridad),
  };
}

export function getDataProcessingRecords(db: any): DataProcessingRecord[] {
  const rows = db.prepare('SELECT * FROM data_processing_records ORDER BY creado_en DESC').all() as any[];
  return rows.map(row => ({
    ...row,
    categorias_datos: JSON.parse(row.categorias_datos),
    destinatarios: JSON.parse(row.destinatarios || '[]'),
    medidas_seguridad: JSON.parse(row.medidas_seguridad),
  }));
}

export function updateDataProcessingRecord(
  db: any,
  id: string,
  patch: Partial<Omit<DataProcessingRecord, 'id' | 'creado_en'>>
): DataProcessingRecord | undefined {
  const existing = getDataProcessingRecordById(db, id);
  if (!existing) return undefined;

  const now = nowISO();
  const sets: string[] = [];
  const vals: any[] = [];

  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (['categorias_datos', 'destinatarios', 'medidas_seguridad'].includes(k)) {
      sets.push(`${k} = ?`);
      vals.push(JSON.stringify(v));
    } else if (k === 'transferencias_internacionales') {
      sets.push(`${k} = ?`);
      vals.push(v ? 1 : 0);
    } else {
      sets.push(`${k} = ?`);
      vals.push(v);
    }
  }

  if (sets.length === 0) return existing;

  sets.push('actualizado_en = ?');
  vals.push(now, id);

  db.prepare(`UPDATE data_processing_records SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getDataProcessingRecordById(db, id)!;
}

export function deleteDataProcessingRecord(db: any, id: string): void {
  db.prepare('DELETE FROM data_processing_records WHERE id = ?').run(id);
}

/**
 * Verificaciones de cumplimiento
 */
export function checkConsentForMedicalData(db: any, workerId: string): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!hasValidConsent(db, workerId, 'medico')) {
    missing.push('Consentimiento para datos médicos (exámenes, restricciones, diagnósticos)');
  }
  if (!hasValidConsent(db, workerId, 'biometrico')) {
    missing.push('Consentimiento para datos biométricos (firmas digitales, huellas)');
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

export function getPrivacyComplianceReport(db: any): {
  workers_without_medical_consent: number;
  workers_without_biometric_consent: number;
  total_workers: number;
  arco_pending: number;
  notices_count: number;
  processing_records_count: number;
} {
  const total_workers = db.prepare("SELECT COUNT(*) as c FROM workers WHERE estado = 'activo'").get() as { c: number };

  const workers_with_medical = db.prepare(`
    SELECT COUNT(DISTINCT c.worker_id) as c
    FROM consents c
    WHERE c.tipo = 'medico' AND c.autorizado = 1 AND c.retirado_en IS NULL
  `).get() as { c: number };

  const workers_with_biometric = db.prepare(`
    SELECT COUNT(DISTINCT c.worker_id) as c
    FROM consents c
    WHERE c.tipo = 'biometrico' AND c.autorizado = 1 AND c.retirado_en IS NULL
  `).get() as { c: number };

  const arco_pending = db.prepare("SELECT COUNT(*) as c FROM arco_requests WHERE estado IN ('pendiente', 'en_proceso')").get() as { c: number };

  const notices_count = db.prepare("SELECT COUNT(*) as c FROM privacy_notices").get() as { c: number };

  const processing_records_count = db.prepare("SELECT COUNT(*) as c FROM data_processing_records").get() as { c: number };

  return {
    workers_without_medical_consent: total_workers.c - workers_with_medical.c,
    workers_without_biometric_consent: total_workers.c - workers_with_biometric.c,
    total_workers: total_workers.c,
    arco_pending: arco_pending.c,
    notices_count: notices_count.c,
    processing_records_count: processing_records_count.c,
  };
}