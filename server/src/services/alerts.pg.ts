import { exec, one, query } from '../lib/db-pg.js';
import { genId, nowISO } from '../lib/utils.js';

import type { Alert } from './alerts.js';

/**
 * Alertas y recordatorios para PostgreSQL (Neon) — Fase N3.7.
 * Equivalente asíncrono de services/alerts.ts.
 */

type AlertPriority = 'critica' | 'alta' | 'media';

function prioridadPorDias(diff: number): AlertPriority {
  if (diff < 0) return 'critica';
  if (diff <= 7) return 'alta';
  return 'media';
}

function diasHasta(fecha: string, hoy: string): number {
  return Math.ceil((new Date(fecha).getTime() - new Date(hoy).getTime()) / (1000 * 60 * 60 * 24));
}

async function saveAlertPg(alert: Alert): Promise<boolean> {
  const existing = await one(
    'SELECT 1 FROM alerts WHERE entidad = ? AND entidad_id = ? AND tipo = ?',
    [alert.entidad, alert.entidad_id, alert.tipo]
  );
  if (existing) return false;

  await exec(
    `INSERT INTO alerts (id, entidad, entidad_id, tipo, fecha_vencimiento, prioridad, enviado, enviado_en, canal, creado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      alert.id,
      alert.entidad,
      alert.entidad_id,
      alert.tipo,
      alert.fecha_vencimiento,
      alert.prioridad,
      alert.enviado,
      alert.enviado_en,
      alert.canal,
      alert.creado_en,
    ]
  );
  return true;
}

export async function generateAlertsPg(): Promise<Alert[]> {
  const ahora = new Date();
  const diffBogota = ahora.getTime() + 5 * 60 * 60 * 1000;
  const hoy = new Date(diffBogota).toISOString().slice(0, 10);
  const limite = new Date(diffBogota);
  limite.setDate(new Date(diffBogota).getDate() + 30);
  const limiteStr = limite.toISOString().slice(0, 10);

  const alertas: Alert[] = [];

  const build = (
    entidad: string,
    entidadId: string,
    tipo: Alert['tipo'],
    fecha: string
  ): Alert => ({
    id: genId(),
    entidad,
    entidad_id: entidadId,
    tipo,
    fecha_vencimiento: fecha,
    prioridad: prioridadPorDias(diasHasta(fecha, hoy)),
    enviado: 0,
    enviado_en: null,
    canal: 'email',
    creado_en: nowISO(),
  });

  const exams = await query<{ id: string; vencimiento: string }>(
    `SELECT we.id, we.vencimiento
     FROM worker_exams we
     JOIN workers w ON w.id = we.worker_id
     WHERE we.vencimiento IS NOT NULL AND we.vencimiento <= ?
       AND w.estado = 'activo'`,
    [limiteStr]
  );
  for (const e of exams) {
    const alert = build('worker_exams', e.id, 'examen', e.vencimiento);
    if (await saveAlertPg(alert)) alertas.push(alert);
  }

  const certs = await query<{ id: string; fecha_vencimiento: string }>(
    `SELECT wc.id, wc.fecha_vencimiento
     FROM worker_certs wc
     JOIN workers w ON w.id = wc.worker_id
     WHERE wc.fecha_vencimiento IS NOT NULL AND wc.fecha_vencimiento <= ?
       AND w.estado = 'activo'`,
    [limiteStr]
  );
  for (const c of certs) {
    const alert = build('worker_certs', c.id, 'certificado', c.fecha_vencimiento);
    if (await saveAlertPg(alert)) alertas.push(alert);
  }

  const roles = await query<{
    id: string;
    licencia_sst_vence: string | null;
    curso_50h_vence: string | null;
  }>(
    `SELECT r.id, r.licencia_sst_vence, r.curso_50h_vence
     FROM roles r
     JOIN users u ON u.id = r.usuario_id
     WHERE (r.licencia_sst_vence IS NOT NULL AND r.licencia_sst_vence <= ?)
        OR (r.curso_50h_vence IS NOT NULL AND r.curso_50h_vence <= ?)`,
    [limiteStr, limiteStr]
  );
  for (const r of roles) {
    if (r.licencia_sst_vence) {
      const alert = build('roles', r.id, 'licencia_sst', r.licencia_sst_vence);
      if (await saveAlertPg(alert)) alertas.push(alert);
    }
    if (r.curso_50h_vence) {
      const alert = build('roles', r.id, 'curso_50h', r.curso_50h_vence);
      if (await saveAlertPg(alert)) alertas.push(alert);
    }
  }

  const inspections = await query<{ id: string; fecha: string }>(
    `SELECT id, fecha FROM inspections
     WHERE fecha IS NOT NULL AND fecha <= ?
       AND estado IN ('pendiente', 'programada')`,
    [limiteStr]
  );
  for (const i of inspections) {
    const alert = build('inspections', i.id, 'inspeccion', i.fecha);
    if (await saveAlertPg(alert)) alertas.push(alert);
  }

  const plans = await query<{ id: string; fecha_fin: string }>(
    `SELECT id, fecha_fin FROM annual_plan
     WHERE fecha_fin IS NOT NULL AND fecha_fin <= ?
       AND estado IN ('pendiente', 'en_proceso')`,
    [limiteStr]
  );
  for (const p of plans) {
    const alert = build('annual_plan', p.id, 'plan', p.fecha_fin);
    if (await saveAlertPg(alert)) alertas.push(alert);
  }

  const docs = await query<{ id: string; fecha_revision: string }>(
    `SELECT id, fecha_revision FROM documents
     WHERE fecha_revision IS NOT NULL AND fecha_revision <= ?
       AND estado = 'vigente'`,
    [limiteStr]
  );
  for (const d of docs) {
    const alert = build('documents', d.id, 'documento', d.fecha_revision);
    if (await saveAlertPg(alert)) alertas.push(alert);
  }

  return alertas;
}

const WORKER_ALERT_FILTER = `(
  (entidad = 'worker_exams' AND entidad_id IN (SELECT id FROM worker_exams WHERE worker_id = ?))
  OR (entidad = 'worker_certs' AND entidad_id IN (SELECT id FROM worker_certs WHERE worker_id = ?))
  OR (entidad = 'worker_epp' AND entidad_id IN (SELECT id FROM worker_epp WHERE worker_id = ?))
  OR (entidad = 'roles' AND entidad_id IN (SELECT id FROM roles WHERE usuario_id = ?))
)`;

export async function getAlertsPg(
  filtros: {
    tipo?: string;
    enviado?: number;
    fecha_desde?: string;
    fecha_hasta?: string;
    prioridad?: string;
    limit?: number;
    workerId?: string;
  } = {}
): Promise<Alert[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filtros.tipo) {
    conditions.push('tipo = ?');
    params.push(filtros.tipo);
  }
  if (filtros.enviado !== undefined) {
    conditions.push('enviado = ?');
    params.push(filtros.enviado);
  }
  if (filtros.fecha_desde) {
    conditions.push('fecha_vencimiento >= ?');
    params.push(filtros.fecha_desde);
  }
  if (filtros.fecha_hasta) {
    conditions.push('fecha_vencimiento <= ?');
    params.push(filtros.fecha_hasta);
  }
  if (filtros.prioridad) {
    conditions.push('prioridad = ?');
    params.push(filtros.prioridad);
  }
  if (filtros.workerId) {
    conditions.push(WORKER_ALERT_FILTER);
    params.push(filtros.workerId, filtros.workerId, filtros.workerId, filtros.workerId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filtros.limit ? `LIMIT ${Number(filtros.limit)}` : '';

  return query<Alert>(
    `SELECT * FROM alerts ${where} ORDER BY fecha_vencimiento ASC, creado_en DESC ${limit}`,
    params
  );
}

export async function getAlertStatsPg(workerId?: string) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (workerId) {
    conditions.push(WORKER_ALERT_FILTER);
    params.push(workerId, workerId, workerId, workerId);
  }
  const baseWhere = conditions.length ? conditions.join(' AND ') : '1=1';

  const count = async (extra = '') => {
    const row = await one<{ c: string | number }>(
      `SELECT COUNT(*) AS c FROM alerts WHERE ${baseWhere} ${extra}`,
      params
    );
    return Number(row?.c ?? 0);
  };

  const total = await count();
  const pendientes = await count('AND enviado = 0');
  const enviadas = await count('AND enviado = 1');
  const vencidas = await count('AND enviado = 0 AND fecha_vencimiento::date < CURRENT_DATE');

  const porTipo = await query<{ tipo: string; c: string | number }>(
    `SELECT tipo, COUNT(*) AS c FROM alerts WHERE ${baseWhere} GROUP BY tipo`,
    params
  );
  const porPrioridad = await query<{ prioridad: string; c: string | number }>(
    `SELECT prioridad, COUNT(*) AS c FROM alerts WHERE ${baseWhere} GROUP BY prioridad`,
    params
  );

  return {
    total,
    pendientes,
    enviadas,
    vencidas,
    por_tipo: porTipo.map((r) => ({ tipo: r.tipo, c: Number(r.c) })),
    por_prioridad: porPrioridad.map((r) => ({ prioridad: r.prioridad, c: Number(r.c) })),
  };
}

export async function getPendingAlertsForSendingPg() {
  return query<Alert & { company_email: string; canal_alertas: string }>(
    `SELECT a.*, c.email as company_email, c.canal_alertas
     FROM alerts a
     CROSS JOIN companies c
     WHERE a.enviado = 0
       AND a.fecha_vencimiento::date <= CURRENT_DATE + 30
     ORDER BY a.fecha_vencimiento ASC`
  );
}

export async function markAsSentPg(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const result = await exec(
    'UPDATE alerts SET enviado = 1, enviado_en = ? WHERE id = ANY(?::text[])',
    [nowISO(), ids]
  );
  return result.rowCount;
}

export async function deleteAlertPg(id: string) {
  await exec('DELETE FROM alerts WHERE id = ?', [id]);
}

export async function getWorkerEmailByAlertEntityPg(
  entidad: string,
  entidadId: string
): Promise<string | null> {
  if (entidad === 'worker_exams' || entidad === 'worker_certs' || entidad === 'worker_epp') {
    const table =
      entidad === 'worker_exams'
        ? 'worker_exams'
        : entidad === 'worker_certs'
          ? 'worker_certs'
          : 'worker_epp';
    const row = await one<{ email: string | null }>(
      `SELECT w.email FROM workers w
       JOIN ${table} t ON t.worker_id = w.id
       WHERE t.id = ?`,
      [entidadId]
    );
    return row?.email ?? null;
  }
  if (entidad === 'roles') {
    const row = await one<{ email: string | null }>(
      'SELECT u.email FROM roles r JOIN users u ON u.id = r.usuario_id WHERE r.id = ?',
      [entidadId]
    );
    return row?.email ?? null;
  }
  return null;
}
