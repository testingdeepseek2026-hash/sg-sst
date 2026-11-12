import { decryptSensitiveFields, encryptSensitiveFields } from '../lib/crypto.js';
import { exec, one, query } from '../lib/db-pg.js';
import { genId } from '../lib/utils.js';

import { hasValidConsentPg } from './privacy_consents.pg.js';
import { WorkerValidationError } from './worker_validation_error.js';

import type { WorkerExam } from './workers_exams.js';

export async function getExamsByWorkerPg(
  workerId: string,
  includeSensitive = false
): Promise<WorkerExam[]> {
  const rows = await query<WorkerExam>(
    'SELECT * FROM worker_exams WHERE worker_id = ? ORDER BY fecha DESC',
    [workerId]
  );
  if (includeSensitive) return rows.map((row) => decryptSensitiveFields(row) as WorkerExam);
  return rows.map((row) => ({
    ...row,
    restricciones: null,
    medico: null,
    entidad: null,
    archivo_url: null,
    notas: null,
    resultado: row.resultado === 'no_apto' ? 'no_apto' : 'apto',
  }));
}

export async function getExamByIdPg(
  id: string,
  includeSensitive = false
): Promise<WorkerExam | undefined> {
  const row = await one<WorkerExam>('SELECT * FROM worker_exams WHERE id = ?', [id]);
  if (!row) return undefined;
  if (includeSensitive) return decryptSensitiveFields(row) as WorkerExam;
  return {
    ...row,
    restricciones: null,
    medico: null,
    entidad: null,
    archivo_url: null,
    notas: null,
    resultado: row.resultado === 'no_apto' ? 'no_apto' : 'apto',
  };
}

export async function getExamIngresoByWorkerPg(workerId: string): Promise<WorkerExam | undefined> {
  return one<WorkerExam>(
    `SELECT * FROM worker_exams WHERE worker_id = ? AND tipo = ?
     ORDER BY fecha DESC LIMIT 1`,
    [workerId, 'ingreso']
  );
}

export async function createExamPg(input: {
  worker_id: string;
  tipo: WorkerExam['tipo'];
  fecha: string;
  vencimiento?: string | null;
  resultado?: WorkerExam['resultado'];
  restricciones?: string | null;
  medico?: string | null;
  entidad?: string | null;
  archivo_url?: string | null;
  notas?: string | null;
}): Promise<WorkerExam> {
  if (!(await hasValidConsentPg(input.worker_id, 'medico'))) {
    throw new WorkerValidationError(
      'El trabajador no ha autorizado el tratamiento de datos médicos (Ley 1581/2012). Registre consentimiento primero.'
    );
  }
  if (input.tipo === 'ingreso') {
    const existing = await one('SELECT id FROM worker_exams WHERE worker_id = ? AND tipo = ?', [
      input.worker_id,
      'ingreso',
    ]);
    if (existing) {
      throw new WorkerValidationError(
        'Ya existe un examen de ingreso para este trabajador. Use tipo "periodico" o "control".'
      );
    }
  }

  const sensitive = encryptSensitiveFields(input);
  const id = genId();
  await exec(
    `INSERT INTO worker_exams (id, worker_id, tipo, fecha, vencimiento, resultado, restricciones,
      medico, entidad, archivo_url, notas)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      sensitive.worker_id,
      sensitive.tipo,
      sensitive.fecha,
      sensitive.vencimiento ?? null,
      sensitive.resultado ?? 'apto',
      sensitive.restricciones ?? null,
      sensitive.medico ?? null,
      sensitive.entidad ?? null,
      sensitive.archivo_url ?? null,
      sensitive.notas ?? null,
    ]
  );
  const exam = await getExamByIdPg(id, true);
  if (!exam) throw new Error('No se pudo recuperar el examen recién creado en PostgreSQL');
  return exam;
}

export async function updateExamPg(
  id: string,
  patch: Partial<WorkerExam>
): Promise<WorkerExam | undefined> {
  const sensitive = encryptSensitiveFields(patch);
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(sensitive)) {
    if (value === undefined) continue;
    sets.push(`${key} = ?`);
    values.push(value);
  }
  if (sets.length === 0) return getExamByIdPg(id, true);
  values.push(id);
  await exec(`UPDATE worker_exams SET ${sets.join(', ')} WHERE id = ?`, values);
  return getExamByIdPg(id, true);
}

export async function deleteExamPg(id: string): Promise<void> {
  await exec('DELETE FROM worker_exams WHERE id = ?', [id]);
}
