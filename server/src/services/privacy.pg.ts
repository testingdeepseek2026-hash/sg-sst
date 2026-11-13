import { exec, one, query } from '../lib/db-pg.js';
import { genId, nowISO } from '../lib/utils.js';

import { hasValidConsentPg } from './privacy_consents.pg.js';

import type { ArcoRequest, DataProcessingRecord, PrivacyNotice } from './privacy.js';

/**
 * Privacidad (Ley 1581/2012) para PostgreSQL (Neon) — Fase N3.8.
 * Equivalente asíncrono de avisos, solicitudes ARCO, registro de
 * tratamiento y reportes de cumplimiento de services/privacy.ts.
 */

const NOTICE_FIELDS = new Set(['titulo', 'contenido', 'fecha_vigencia', 'estado']);
const ARCO_FIELDS = new Set(['estado', 'respuesta', 'evidencia_respuesta']);
const PROCESSING_FIELDS = new Set([
  'entidad',
  'finalidad',
  'categorias_datos',
  'base_legal',
  'destinatarios',
  'transferencias_internacionales',
  'pais_destino',
  'medidas_seguridad',
  'retencion_dias',
]);

function parseProcessingRecord(row: any): DataProcessingRecord {
  return {
    ...row,
    categorias_datos: JSON.parse(row.categorias_datos),
    destinatarios: JSON.parse(row.destinatarios || '[]'),
    medidas_seguridad: JSON.parse(row.medidas_seguridad),
  } as DataProcessingRecord;
}

export async function getPrivacyNoticesPg(): Promise<PrivacyNotice[]> {
  return query<PrivacyNotice>(
    'SELECT * FROM privacy_notices ORDER BY version DESC, creado_en DESC'
  );
}

export async function getPrivacyNoticeByIdPg(id: string): Promise<PrivacyNotice | undefined> {
  return one<PrivacyNotice>('SELECT * FROM privacy_notices WHERE id = ?', [id]);
}

export async function getActivePrivacyNoticePg(): Promise<PrivacyNotice | undefined> {
  return one<PrivacyNotice>(
    "SELECT * FROM privacy_notices WHERE estado = 'vigente' ORDER BY version DESC LIMIT 1"
  );
}

export async function createPrivacyNoticePg(input: {
  titulo: string;
  contenido: string;
  fecha_vigencia: string;
  estado?: 'borrador' | 'vigente' | 'archivado';
}): Promise<PrivacyNotice> {
  const id = genId();
  const now = nowISO();
  const estado = input.estado ?? 'borrador';

  await exec(
    `INSERT INTO privacy_notices (id, version, titulo, contenido, fecha_vigencia, estado, creado_en, actualizado_en)
     VALUES (?, 1, ?, ?, ?, ?, ?, ?)`,
    [id, input.titulo, input.contenido, input.fecha_vigencia, estado, now, now]
  );

  return (await getPrivacyNoticeByIdPg(id)) as PrivacyNotice;
}

export async function updatePrivacyNoticePg(
  id: string,
  patch: Partial<Pick<PrivacyNotice, 'titulo' | 'contenido' | 'fecha_vigencia' | 'estado'>>
): Promise<PrivacyNotice | undefined> {
  const existing = await getPrivacyNoticeByIdPg(id);
  if (!existing) return undefined;

  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !NOTICE_FIELDS.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return existing;

  sets.push('actualizado_en = ?');
  vals.push(nowISO(), id);
  await exec(`UPDATE privacy_notices SET ${sets.join(', ')} WHERE id = ?`, vals);

  return getPrivacyNoticeByIdPg(id);
}

export async function createArcoRequestPg(input: {
  worker_id: string;
  tipo: ArcoRequest['tipo'];
  descripcion: string;
  responsable: string;
}): Promise<ArcoRequest> {
  const id = genId();
  const now = nowISO();

  await exec(
    `INSERT INTO arco_requests (id, worker_id, tipo, descripcion, estado, responsable, fecha_solicitud, creado_en, actualizado_en)
     VALUES (?,?,?,?,'pendiente',?,?,?,?)`,
    [id, input.worker_id, input.tipo, input.descripcion, input.responsable, now, now, now]
  );

  return (await getArcoRequestByIdPg(id)) as ArcoRequest;
}

export async function getArcoRequestByIdPg(id: string): Promise<ArcoRequest | undefined> {
  return one<ArcoRequest>('SELECT * FROM arco_requests WHERE id = ?', [id]);
}

export async function getArcoRequestsPg(workerId?: string): Promise<ArcoRequest[]> {
  if (workerId) {
    return query<ArcoRequest>(
      'SELECT * FROM arco_requests WHERE worker_id = ? ORDER BY fecha_solicitud DESC',
      [workerId]
    );
  }
  return query<ArcoRequest>('SELECT * FROM arco_requests ORDER BY fecha_solicitud DESC');
}

export async function updateArcoRequestPg(
  id: string,
  patch: Partial<Pick<ArcoRequest, 'estado' | 'respuesta' | 'evidencia_respuesta'>>
): Promise<ArcoRequest | undefined> {
  const existing = await getArcoRequestByIdPg(id);
  if (!existing) return undefined;

  const now = nowISO();
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !ARCO_FIELDS.has(k)) continue;
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
  await exec(`UPDATE arco_requests SET ${sets.join(', ')} WHERE id = ?`, vals);

  return getArcoRequestByIdPg(id);
}

export async function getArcoStatsPg(): Promise<{
  total: number;
  pendientes: number;
  en_proceso: number;
  resueltos: number;
  rechazados: number;
  por_tipo: Record<string, number>;
}> {
  const row = await one<Record<string, string | number>>(
    `SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE estado = 'pendiente') AS pendientes,
       COUNT(*) FILTER (WHERE estado = 'en_proceso') AS en_proceso,
       COUNT(*) FILTER (WHERE estado = 'resuelto') AS resueltos,
       COUNT(*) FILTER (WHERE estado = 'rechazado') AS rechazados
     FROM arco_requests`
  );

  const porTipoRows = await query<{ tipo: string; c: string | number }>(
    'SELECT tipo, COUNT(*) AS c FROM arco_requests GROUP BY tipo'
  );
  const por_tipo: Record<string, number> = {};
  for (const r of porTipoRows) por_tipo[r.tipo] = Number(r.c);

  return {
    total: Number(row?.total ?? 0),
    pendientes: Number(row?.pendientes ?? 0),
    en_proceso: Number(row?.en_proceso ?? 0),
    resueltos: Number(row?.resueltos ?? 0),
    rechazados: Number(row?.rechazados ?? 0),
    por_tipo,
  };
}

export async function createDataProcessingRecordPg(input: {
  entidad: string;
  finalidad: string;
  categorias_datos: string[];
  base_legal: DataProcessingRecord['base_legal'];
  destinatarios?: string[];
  transferencias_internacionales?: boolean;
  pais_destino?: string;
  medidas_seguridad: string[];
  retencion_dias: number;
}): Promise<DataProcessingRecord> {
  const id = genId();
  const now = nowISO();

  await exec(
    `INSERT INTO data_processing_records (id, entidad, finalidad, categorias_datos, base_legal, destinatarios, transferencias_internacionales, pais_destino, medidas_seguridad, retencion_dias, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
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
      now,
    ]
  );

  return (await getDataProcessingRecordByIdPg(id)) as DataProcessingRecord;
}

export async function getDataProcessingRecordByIdPg(
  id: string
): Promise<DataProcessingRecord | undefined> {
  const row = await one('SELECT * FROM data_processing_records WHERE id = ?', [id]);
  return row ? parseProcessingRecord(row) : undefined;
}

export async function getDataProcessingRecordsPg(): Promise<DataProcessingRecord[]> {
  const rows = await query('SELECT * FROM data_processing_records ORDER BY creado_en DESC');
  return rows.map(parseProcessingRecord);
}

export async function updateDataProcessingRecordPg(
  id: string,
  patch: Partial<Omit<DataProcessingRecord, 'id' | 'creado_en'>>
): Promise<DataProcessingRecord | undefined> {
  const existing = await getDataProcessingRecordByIdPg(id);
  if (!existing) return undefined;

  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !PROCESSING_FIELDS.has(k)) continue;
    sets.push(`${k} = ?`);
    if (k === 'categorias_datos' || k === 'destinatarios' || k === 'medidas_seguridad') {
      vals.push(JSON.stringify(v));
    } else if (k === 'transferencias_internacionales') {
      vals.push(v ? 1 : 0);
    } else {
      vals.push(v);
    }
  }
  if (sets.length === 0) return existing;

  sets.push('actualizado_en = ?');
  vals.push(nowISO(), id);
  await exec(`UPDATE data_processing_records SET ${sets.join(', ')} WHERE id = ?`, vals);

  return getDataProcessingRecordByIdPg(id);
}

export async function deleteDataProcessingRecordPg(id: string): Promise<void> {
  await exec('DELETE FROM data_processing_records WHERE id = ?', [id]);
}

export async function checkConsentForMedicalDataPg(
  workerId: string
): Promise<{ valid: boolean; missing: string[] }> {
  const missing: string[] = [];

  if (!(await hasValidConsentPg(workerId, 'medico'))) {
    missing.push('Consentimiento para datos médicos (exámenes, restricciones, diagnósticos)');
  }
  if (!(await hasValidConsentPg(workerId, 'biometrico'))) {
    missing.push('Consentimiento para datos biométricos (firmas digitales, huellas)');
  }

  return { valid: missing.length === 0, missing };
}

export async function getPrivacyComplianceReportPg(): Promise<{
  workers_without_medical_consent: number;
  workers_without_biometric_consent: number;
  total_workers: number;
  arco_pending: number;
  notices_count: number;
  processing_records_count: number;
}> {
  const count = async (sql: string): Promise<number> => {
    const row = await one<{ c: string | number }>(sql);
    return Number(row?.c ?? 0);
  };

  const total_workers = await count("SELECT COUNT(*) AS c FROM workers WHERE estado = 'activo'");
  const workers_with_medical = await count(
    "SELECT COUNT(DISTINCT worker_id) AS c FROM consents WHERE tipo = 'medico' AND autorizado = 1 AND retirado_en IS NULL"
  );
  const workers_with_biometric = await count(
    "SELECT COUNT(DISTINCT worker_id) AS c FROM consents WHERE tipo = 'biometrico' AND autorizado = 1 AND retirado_en IS NULL"
  );
  const arco_pending = await count(
    "SELECT COUNT(*) AS c FROM arco_requests WHERE estado IN ('pendiente', 'en_proceso')"
  );
  const notices_count = await count('SELECT COUNT(*) AS c FROM privacy_notices');
  const processing_records_count = await count('SELECT COUNT(*) AS c FROM data_processing_records');

  return {
    workers_without_medical_consent: total_workers - workers_with_medical,
    workers_without_biometric_consent: total_workers - workers_with_biometric,
    total_workers,
    arco_pending,
    notices_count,
    processing_records_count,
  };
}
