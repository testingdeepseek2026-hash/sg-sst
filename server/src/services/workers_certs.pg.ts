import { decryptSensitiveFields, encryptSensitiveFields } from '../lib/crypto.js';
import { exec, one, query } from '../lib/db-pg.js';
import { genId } from '../lib/utils.js';

import { WorkerValidationError } from './worker_validation_error.js';
import { calcularVencimientoAlturas, type WorkerCert } from './workers_certs.js';

export async function getCertsByWorkerPg(workerId: string): Promise<WorkerCert[]> {
  const rows = await query<WorkerCert>(
    'SELECT * FROM worker_certs WHERE worker_id = ? ORDER BY fecha_emision DESC',
    [workerId]
  );
  return rows.map((row) => decryptSensitiveFields(row) as WorkerCert);
}

export async function getCertByIdPg(id: string): Promise<WorkerCert | undefined> {
  const row = await one<WorkerCert>('SELECT * FROM worker_certs WHERE id = ?', [id]);
  return row ? (decryptSensitiveFields(row) as WorkerCert) : undefined;
}

function validateHeightsCertificate(
  tipo: WorkerCert['tipo'],
  fechaEmision: string,
  fechaVencimiento: string
): void {
  if (tipo !== 'alturas') return;
  const expected = calcularVencimientoAlturas(fechaEmision);
  if (fechaVencimiento !== expected) {
    throw new WorkerValidationError(
      `Certificado de alturas debe tener vigencia exacta de 3 años (Res. 4272/2021 Art. 12). Emisión: ${fechaEmision} → Vencimiento esperado: ${expected}, recibido: ${fechaVencimiento}`
    );
  }
}

export async function crearCertificadoPg(input: {
  worker_id: string;
  tipo: WorkerCert['tipo'];
  nombre_curso?: string | null;
  entidad?: string | null;
  fecha_emision: string;
  fecha_vencimiento: string;
  archivo_url?: string | null;
  notas?: string | null;
}): Promise<WorkerCert> {
  validateHeightsCertificate(input.tipo, input.fecha_emision, input.fecha_vencimiento);
  const sensitive = encryptSensitiveFields(input);
  const id = genId();
  await exec(
    `INSERT INTO worker_certs (id, worker_id, tipo, nombre_curso, entidad, fecha_emision,
      fecha_vencimiento, archivo_url, notas)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      id,
      sensitive.worker_id,
      sensitive.tipo,
      sensitive.nombre_curso ?? null,
      sensitive.entidad ?? null,
      sensitive.fecha_emision,
      sensitive.fecha_vencimiento,
      sensitive.archivo_url ?? null,
      sensitive.notas ?? null,
    ]
  );
  const cert = await getCertByIdPg(id);
  if (!cert) throw new Error('No se pudo recuperar el certificado recién creado en PostgreSQL');
  return cert;
}

export async function updateCertPg(
  id: string,
  patch: Partial<WorkerCert>
): Promise<WorkerCert | undefined> {
  const existing = await getCertByIdPg(id);
  if (!existing) return undefined;
  const tipo = patch.tipo ?? existing.tipo;
  const fechaEmision = patch.fecha_emision ?? existing.fecha_emision;
  const fechaVencimiento = patch.fecha_vencimiento ?? existing.fecha_vencimiento;
  validateHeightsCertificate(tipo, fechaEmision, fechaVencimiento);

  const sensitive = encryptSensitiveFields(patch);
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(sensitive)) {
    if (value === undefined) continue;
    sets.push(`${key} = ?`);
    values.push(value);
  }
  if (sets.length === 0) return existing;
  values.push(id);
  await exec(`UPDATE worker_certs SET ${sets.join(', ')} WHERE id = ?`, values);
  return getCertByIdPg(id);
}

export async function deleteCertPg(id: string): Promise<void> {
  await exec('DELETE FROM worker_certs WHERE id = ?', [id]);
}
