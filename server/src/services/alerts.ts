import { genId, nowISO } from '../lib/utils.js';

export interface Alert {
  id: string;
  entidad: string;
  entidad_id: string;
  tipo:
    'examen' | 'certificado' | 'licencia_sst' | 'curso_50h' | 'inspeccion' | 'plan' | 'documento';
  fecha_vencimiento: string;
  prioridad: 'critica' | 'alta' | 'media';
  enviado: number;
  enviado_en: string | null;
  canal: string;
  creado_en: string;
}

function saveAlert(db: any, alert: Alert): boolean {
  const existing = db
    .prepare('SELECT 1 FROM alerts WHERE entidad = ? AND entidad_id = ? AND tipo = ?')
    .get(alert.entidad, alert.entidad_id, alert.tipo);
  if (existing) return false;

  db.prepare(
    `INSERT INTO alerts (id, entidad, entidad_id, tipo, fecha_vencimiento, prioridad, enviado, enviado_en, canal, creado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(
    alert.id,
    alert.entidad,
    alert.entidad_id,
    alert.tipo,
    alert.fecha_vencimiento,
    alert.prioridad,
    alert.enviado,
    alert.enviado_en,
    alert.canal,
    alert.creado_en
  );
  return true;
}

export function generateAlerts(db: any): Alert[] {
  // Usar timezone America/Bogota consistente con scheduler (scheduler.ts:46)
  // Bogota es UTC-5 sin horario de verano; el CronJob ya corre con esta TZ
  const ahora = new Date();
  const diffBogota = ahora.getTime() + 5 * 60 * 60 * 1000; // Ajuste UTC-5
  const hoy = new Date(diffBogota).toISOString().slice(0, 10);
  const limite = new Date(diffBogota);
  limite.setDate(new Date(diffBogota).getDate() + 30);
  const limiteStr = limite.toISOString().slice(0, 10);

  const alertas: Alert[] = [];

  // 1. Exámenes médicos (worker_exams)
  const exams = db
    .prepare(
      `
    SELECT we.*, w.nombres, w.apellidos, w.email
    FROM worker_exams we
    JOIN workers w ON w.id = we.worker_id
    WHERE we.vencimiento IS NOT NULL AND we.vencimiento <= ?
    AND w.estado = 'activo'
  `
    )
    .all(limiteStr) as any[];

  for (const e of exams) {
    const diff = Math.ceil(
      (new Date(e.vencimiento).getTime() - new Date(hoy).getTime()) / (1000 * 60 * 60 * 24)
    );
    let prioridad: 'critica' | 'alta' | 'media' = 'media';
    if (diff < 0) prioridad = 'critica';
    else if (diff <= 7) prioridad = 'alta';

    const alert: Alert = {
      id: genId(),
      entidad: 'worker_exams',
      entidad_id: e.id,
      tipo: 'examen',
      fecha_vencimiento: e.vencimiento,
      prioridad,
      enviado: 0,
      enviado_en: null,
      canal: 'email',
      creado_en: nowISO(),
    };
    if (saveAlert(db, alert)) alertas.push(alert);
  }

  // 2. Certificados (worker_certs)
  const certs = db
    .prepare(
      `
    SELECT wc.*, w.nombres, w.apellidos, w.email
    FROM worker_certs wc
    JOIN workers w ON w.id = wc.worker_id
    WHERE wc.fecha_vencimiento IS NOT NULL AND wc.fecha_vencimiento <= ?
    AND w.estado = 'activo'
  `
    )
    .all(limiteStr) as any[];

  for (const c of certs) {
    const diff = Math.ceil(
      (new Date(c.fecha_vencimiento).getTime() - new Date(hoy).getTime()) / (1000 * 60 * 60 * 24)
    );
    let prioridad: 'critica' | 'alta' | 'media' = 'media';
    if (diff < 0) prioridad = 'critica';
    else if (diff <= 7) prioridad = 'alta';

    const alert: Alert = {
      id: genId(),
      entidad: 'worker_certs',
      entidad_id: c.id,
      tipo: 'certificado',
      fecha_vencimiento: c.fecha_vencimiento,
      prioridad,
      enviado: 0,
      enviado_en: null,
      canal: 'email',
      creado_en: nowISO(),
    };
    if (saveAlert(db, alert)) alertas.push(alert);
  }

  // 3. Licencias SST y Curso 50h (roles)
  const roles = db
    .prepare(
      `
    SELECT r.*, u.nombre, u.email
    FROM roles r
    JOIN users u ON u.id = r.usuario_id
    WHERE (r.licencia_sst_vence IS NOT NULL AND r.licencia_sst_vence <= ?)
       OR (r.curso_50h_vence IS NOT NULL AND r.curso_50h_vence <= ?)
  `
    )
    .all(limiteStr, limiteStr) as any[];

  for (const r of roles) {
    if (r.licencia_sst_vence) {
      const diff = Math.ceil(
        (new Date(r.licencia_sst_vence).getTime() - new Date(hoy).getTime()) / (1000 * 60 * 60 * 24)
      );
      let prioridad: 'critica' | 'alta' | 'media' = 'media';
      if (diff < 0) prioridad = 'critica';
      else if (diff <= 7) prioridad = 'alta';

      const alert: Alert = {
        id: genId(),
        entidad: 'roles',
        entidad_id: r.id,
        tipo: 'licencia_sst',
        fecha_vencimiento: r.licencia_sst_vence,
        prioridad,
        enviado: 0,
        enviado_en: null,
        canal: 'email',
        creado_en: nowISO(),
      };
      if (saveAlert(db, alert)) alertas.push(alert);
    }

    if (r.curso_50h_vence) {
      const diff = Math.ceil(
        (new Date(r.curso_50h_vence).getTime() - new Date(hoy).getTime()) / (1000 * 60 * 60 * 24)
      );
      let prioridad: 'critica' | 'alta' | 'media' = 'media';
      if (diff < 0) prioridad = 'critica';
      else if (diff <= 7) prioridad = 'alta';

      const alert: Alert = {
        id: genId(),
        entidad: 'roles',
        entidad_id: r.id,
        tipo: 'curso_50h',
        fecha_vencimiento: r.curso_50h_vence,
        prioridad,
        enviado: 0,
        enviado_en: null,
        canal: 'email',
        creado_en: nowISO(),
      };
      if (saveAlert(db, alert)) alertas.push(alert);
    }
  }

  // 4. Inspecciones programadas
  const inspections = db
    .prepare(
      `
    SELECT i.*
    FROM inspections i
    WHERE i.fecha IS NOT NULL AND i.fecha <= ?
    AND i.estado IN ('pendiente', 'programada')
  `
    )
    .all(limiteStr) as any[];

  for (const i of inspections) {
    const diff = Math.ceil(
      (new Date(i.fecha).getTime() - new Date(hoy).getTime()) / (1000 * 60 * 60 * 24)
    );
    let prioridad: 'critica' | 'alta' | 'media' = 'media';
    if (diff < 0) prioridad = 'critica';
    else if (diff <= 7) prioridad = 'alta';

    const alert: Alert = {
      id: genId(),
      entidad: 'inspections',
      entidad_id: i.id,
      tipo: 'inspeccion',
      fecha_vencimiento: i.fecha,
      prioridad,
      enviado: 0,
      enviado_en: null,
      canal: 'email',
      creado_en: nowISO(),
    };
    if (saveAlert(db, alert)) alertas.push(alert);
  }

  // 5. Plan anual de trabajo
  const plans = db
    .prepare(
      `
    SELECT p.*
    FROM annual_plan p
    WHERE p.fecha_fin IS NOT NULL AND p.fecha_fin <= ?
    AND p.estado IN ('pendiente', 'en_proceso')
  `
    )
    .all(limiteStr) as any[];

  for (const p of plans) {
    const diff = Math.ceil(
      (new Date(p.fecha_fin).getTime() - new Date(hoy).getTime()) / (1000 * 60 * 60 * 24)
    );
    let prioridad: 'critica' | 'alta' | 'media' = 'media';
    if (diff < 0) prioridad = 'critica';
    else if (diff <= 7) prioridad = 'alta';

    const alert: Alert = {
      id: genId(),
      entidad: 'annual_plan',
      entidad_id: p.id,
      tipo: 'plan',
      fecha_vencimiento: p.fecha_fin,
      prioridad,
      enviado: 0,
      enviado_en: null,
      canal: 'email',
      creado_en: nowISO(),
    };
    if (saveAlert(db, alert)) alertas.push(alert);
  }

  // 6. Documentos (revisión)
  const docs = db
    .prepare(
      `
    SELECT d.*
    FROM documents d
    WHERE d.fecha_revision IS NOT NULL AND d.fecha_revision <= ?
    AND d.estado = 'vigente'
  `
    )
    .all(limiteStr) as any[];

  for (const d of docs) {
    const diff = Math.ceil(
      (new Date(d.fecha_revision).getTime() - new Date(hoy).getTime()) / (1000 * 60 * 60 * 24)
    );
    let prioridad: 'critica' | 'alta' | 'media' = 'media';
    if (diff < 0) prioridad = 'critica';
    else if (diff <= 7) prioridad = 'alta';

    const alert: Alert = {
      id: genId(),
      entidad: 'documents',
      entidad_id: d.id,
      tipo: 'documento',
      fecha_vencimiento: d.fecha_revision,
      prioridad,
      enviado: 0,
      enviado_en: null,
      canal: 'email',
      creado_en: nowISO(),
    };
    if (saveAlert(db, alert)) alertas.push(alert);
  }

  return alertas;
}

export function getAlerts(
  db: any,
  filtros: {
    tipo?: string;
    enviado?: number;
    fecha_desde?: string;
    fecha_hasta?: string;
    prioridad?: string;
    limit?: number;
    workerId?: string;
  } = {}
): Alert[] {
  const conditions: string[] = [];
  const params: any[] = [];

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

  // Filtrar por trabajador: alertas relacionadas a sus examenes, certificados, EPP, roles
  if (filtros.workerId) {
    conditions.push(`
      (entidad = 'worker_exams' AND entidad_id IN (SELECT id FROM worker_exams WHERE worker_id = ?))
      OR (entidad = 'worker_certs' AND entidad_id IN (SELECT id FROM worker_certs WHERE worker_id = ?))
      OR (entidad = 'worker_epp' AND entidad_id IN (SELECT id FROM worker_epp WHERE worker_id = ?))
      OR (entidad = 'roles' AND entidad_id IN (SELECT id FROM roles WHERE usuario_id = ?))
    `);
    params.push(filtros.workerId, filtros.workerId, filtros.workerId, filtros.workerId);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const limit = filtros.limit ? `LIMIT ${filtros.limit}` : '';

  return db
    .prepare(
      `SELECT * FROM alerts ${where} ORDER BY fecha_vencimiento ASC, creado_en DESC ${limit}`
    )
    .all(...params) as Alert[];
}

export function getAlertStats(db: any, workerId?: string) {
  let where = '';
  const params: any[] = [];
  if (workerId) {
    where = `WHERE 
      (entidad = 'worker_exams' AND entidad_id IN (SELECT id FROM worker_exams WHERE worker_id = ?))
      OR (entidad = 'worker_certs' AND entidad_id IN (SELECT id FROM worker_certs WHERE worker_id = ?))
      OR (entidad = 'worker_epp' AND entidad_id IN (SELECT id FROM worker_epp WHERE worker_id = ?))
      OR (entidad = 'roles' AND entidad_id IN (SELECT id FROM roles WHERE usuario_id = ?))
    `;
    params.push(workerId, workerId, workerId, workerId);
  }

  const baseWhere = where ? `${where}` : '1=1';
  const total = db
    .prepare(`SELECT COUNT(*) as c FROM alerts WHERE ${baseWhere}`)
    .get(...params) as { c: number };
  const pendientes = db
    .prepare(`SELECT COUNT(*) as c FROM alerts WHERE ${baseWhere} AND enviado = 0`)
    .get(...params) as { c: number };
  const enviadas = db
    .prepare(`SELECT COUNT(*) as c FROM alerts WHERE ${baseWhere} AND enviado = 1`)
    .get(...params) as { c: number };
  const vencidas = db
    .prepare(
      `SELECT COUNT(*) as c FROM alerts WHERE ${baseWhere} AND enviado = 0 AND date(fecha_vencimiento) < date('now')`
    )
    .get(...params) as { c: number };
  const porTipo = db
    .prepare(`SELECT tipo, COUNT(*) as c FROM alerts WHERE ${baseWhere} GROUP BY tipo`)
    .all(...params) as { tipo: string; c: number }[];
  const porPrioridad = db
    .prepare(`SELECT prioridad, COUNT(*) as c FROM alerts WHERE ${baseWhere} GROUP BY prioridad`)
    .all(...params) as { prioridad: string; c: number }[];

  return {
    total: total.c,
    pendientes: pendientes.c,
    enviadas: enviadas.c,
    vencidas: vencidas.c,
    por_tipo: porTipo,
    por_prioridad: porPrioridad,
  };
}

export function getPendingAlertsForSending(db: any): Alert[] {
  return db
    .prepare(
      `
    SELECT a.*, c.email as company_email, c.canal_alertas
    FROM alerts a
    CROSS JOIN companies c
    WHERE a.enviado = 0
    AND date(a.fecha_vencimiento) <= date('now', '+30 days')
    ORDER BY a.fecha_vencimiento ASC
  `
    )
    .all() as (Alert & { company_email: string; canal_alertas: string })[];
}

export function markAsSent(db: any, ids: string[]): number {
  if (!ids.length) return 0;
  const placeholders = ids.map(() => '?').join(',');
  const now = nowISO();
  const result = db
    .prepare(`UPDATE alerts SET enviado = 1, enviado_en = ? WHERE id IN (${placeholders})`)
    .run(now, ...ids);
  return result.changes;
}

export function deleteAlert(db: any, id: string): void {
  db.prepare('DELETE FROM alerts WHERE id = ?').run(id);
}
