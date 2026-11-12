import { decryptSensitiveFields, encrypt, encryptSensitiveFields } from '../lib/crypto.js';
import { exec, one, query } from '../lib/db-pg.js';
import { genId } from '../lib/utils.js';

import type { WorkerEpp } from './workers_epp.js';

type ExpiryBase = {
  worker_id: string;
  nombres: string;
  apellidos: string;
  fecha: string;
  expiracion: string;
  item?: string;
};

function getDateWindow(days: number): { today: string; limit: string } {
  const today = new Date().toISOString().slice(0, 10);
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() + days);
  return { today, limit: limitDate.toISOString().slice(0, 10) };
}

function getDaysRemaining(expiration: string, today: string): number {
  return Math.ceil(
    (new Date(expiration).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function getExpiryState(daysRemaining: number, days: number): 'vencido' | 'por_vencer' | 'vigente' {
  if (daysRemaining < 0) return 'vencido';
  if (daysRemaining <= days) return 'por_vencer';
  return 'vigente';
}

export async function getEppByWorkerPg(workerId: string): Promise<WorkerEpp[]> {
  const rows = await query<WorkerEpp>(
    'SELECT * FROM worker_epp WHERE worker_id = ? ORDER BY fecha_entrega DESC',
    [workerId]
  );
  return rows.map((row) => decryptSensitiveFields(row) as WorkerEpp);
}

export async function getEppByIdPg(id: string): Promise<WorkerEpp | undefined> {
  const row = await one<WorkerEpp>('SELECT * FROM worker_epp WHERE id = ?', [id]);
  return row ? (decryptSensitiveFields(row) as WorkerEpp) : undefined;
}

export async function createEppPg(input: {
  worker_id: string;
  item: string;
  cantidad?: number;
  fecha_entrega: string;
  fecha_vencimiento?: string | null;
  firmado_por_trabajador?: number;
  firma_url?: string | null;
  notas?: string | null;
}): Promise<WorkerEpp> {
  const sensitive = encryptSensitiveFields(input);
  const id = genId();
  await exec(
    `INSERT INTO worker_epp (id, worker_id, item, cantidad, fecha_entrega, fecha_vencimiento,
      firmado_por_trabajador, firma_url, notas)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      id,
      sensitive.worker_id,
      sensitive.item,
      sensitive.cantidad ?? 1,
      sensitive.fecha_entrega,
      sensitive.fecha_vencimiento ?? null,
      sensitive.firmado_por_trabajador ?? 0,
      sensitive.firma_url ?? null,
      sensitive.notas ?? null,
    ]
  );
  const epp = await getEppByIdPg(id);
  if (!epp) throw new Error('No se pudo recuperar la entrega EPP recién creada en PostgreSQL');
  return epp;
}

export async function updateEppPg(
  id: string,
  patch: Partial<WorkerEpp>
): Promise<WorkerEpp | undefined> {
  const sensitive = encryptSensitiveFields(patch);
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(sensitive)) {
    if (value === undefined) continue;
    sets.push(`${key} = ?`);
    values.push(value);
  }
  if (sets.length === 0) return getEppByIdPg(id);
  values.push(id);
  await exec(`UPDATE worker_epp SET ${sets.join(', ')} WHERE id = ?`, values);
  return getEppByIdPg(id);
}

export async function deleteEppPg(id: string): Promise<void> {
  await exec('DELETE FROM worker_epp WHERE id = ?', [id]);
}

export async function firmarEntregaEppPg(id: string, firmaBase64: string): Promise<WorkerEpp> {
  const epp = await getEppByIdPg(id);
  if (!epp) throw new Error('Entrega EPP no encontrada');
  const updated = await updateEppPg(id, {
    firmado_por_trabajador: 1,
    firma_url: encrypt(firmaBase64),
  });
  if (!updated) throw new Error('No se pudo actualizar la firma de la entrega EPP');
  return updated;
}

export async function getEppSinFirmarPg() {
  return query<{
    id: string;
    worker_id: string;
    nombres: string;
    apellidos: string;
    item: string;
    fecha_entrega: string;
  }>(
    `SELECT we.id, we.worker_id, w.nombres, w.apellidos, we.item, we.fecha_entrega
     FROM worker_epp we
     JOIN workers w ON w.id = we.worker_id
     WHERE we.firmado_por_trabajador = 0 AND w.estado = 'activo'
     ORDER BY we.fecha_entrega`
  );
}

export async function getEppVencimientosPg(days = 30) {
  const { today, limit } = getDateWindow(days);
  const rows = await query<ExpiryBase>(
    `SELECT we.worker_id, w.nombres, w.apellidos, we.item, we.fecha_entrega AS fecha,
            we.fecha_vencimiento AS expiracion
     FROM worker_epp we JOIN workers w ON w.id = we.worker_id
     WHERE we.fecha_vencimiento IS NOT NULL AND we.fecha_vencimiento <= ?
       AND w.estado = 'activo'
     ORDER BY we.fecha_vencimiento`,
    [limit]
  );
  return rows.map((row) => {
    const daysRemaining = getDaysRemaining(row.expiracion, today);
    return {
      worker_id: row.worker_id,
      nombres: row.nombres,
      apellidos: row.apellidos,
      tipo: 'epp',
      item: row.item ?? '',
      fecha_entrega: row.fecha,
      fecha_vencimiento: row.expiracion,
      estado: getExpiryState(daysRemaining, days),
      dias_restantes: daysRemaining,
    };
  });
}

export async function getWorkerVencimientosPg(days = 30) {
  const { today, limit } = getDateWindow(days);
  const [exams, certificates, epp] = await Promise.all([
    query<ExpiryBase & { tipo: string }>(
      `SELECT we.worker_id, w.nombres, w.apellidos, we.fecha, we.vencimiento AS expiracion,
              'examen_' || we.tipo AS tipo
       FROM worker_exams we JOIN workers w ON w.id = we.worker_id
       WHERE we.vencimiento IS NOT NULL AND we.vencimiento <= ? AND w.estado = 'activo'
       ORDER BY we.vencimiento`,
      [limit]
    ),
    query<ExpiryBase & { tipo: string }>(
      `SELECT wc.worker_id, w.nombres, w.apellidos, wc.fecha_emision AS fecha,
              wc.fecha_vencimiento AS expiracion, 'cert_' || wc.tipo AS tipo
       FROM worker_certs wc JOIN workers w ON w.id = wc.worker_id
       WHERE wc.fecha_vencimiento IS NOT NULL AND wc.fecha_vencimiento <= ? AND w.estado = 'activo'
       ORDER BY wc.fecha_vencimiento`,
      [limit]
    ),
    getEppVencimientosPg(days),
  ]);

  const mapExpiry = (row: ExpiryBase & { tipo: string }) => {
    const daysRemaining = getDaysRemaining(row.expiracion, today);
    return {
      worker_id: row.worker_id,
      nombres: row.nombres,
      apellidos: row.apellidos,
      tipo: row.tipo,
      fecha: row.fecha,
      vencimiento: row.expiracion,
      estado: getExpiryState(daysRemaining, days),
      dias_restantes: daysRemaining,
    };
  };
  return [...exams.map(mapExpiry), ...certificates.map(mapExpiry), ...epp].sort((a, b) => {
    if (a.estado === 'vencido' && b.estado !== 'vencido') return -1;
    if (b.estado === 'vencido' && a.estado !== 'vencido') return 1;
    return (a.dias_restantes ?? 999) - (b.dias_restantes ?? 999);
  });
}
