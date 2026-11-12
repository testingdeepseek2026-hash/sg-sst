import { exec, one, query } from '../lib/db-pg.js';
import { genId, nowISO } from '../lib/utils.js';

export type WorkerRecord = {
  id: string;
  tipo_documento: string;
  numero_documento: string;
  nombres: string;
  apellidos: string;
  cargo: string;
  fecha_ingreso: string;
  fecha_egreso: string | null;
  estado: string;
  eps: string | null;
  afp: string | null;
  arl: string | null;
  caja_compensacion: string | null;
  telefono: string | null;
  email: string | null;
  creado_en: string;
  actualizado_en: string;
};

type WorkerInput = Pick<
  WorkerRecord,
  'tipo_documento' | 'numero_documento' | 'nombres' | 'apellidos' | 'cargo' | 'fecha_ingreso'
> &
  Partial<
    Pick<
      WorkerRecord,
      'fecha_egreso' | 'estado' | 'eps' | 'afp' | 'arl' | 'caja_compensacion' | 'telefono' | 'email'
    >
  >;

export async function getWorkersPg(): Promise<WorkerRecord[]> {
  return query<WorkerRecord>('SELECT * FROM workers ORDER BY apellidos, nombres');
}

export async function getWorkerByIdPg(id: string): Promise<WorkerRecord | undefined> {
  return one<WorkerRecord>('SELECT * FROM workers WHERE id = ?', [id]);
}

export async function getWorkerByDocumentoPg(
  numeroDocumento: string
): Promise<WorkerRecord | undefined> {
  return one<WorkerRecord>('SELECT * FROM workers WHERE numero_documento = ?', [numeroDocumento]);
}

export async function getWorkerByEmailPg(email: string): Promise<WorkerRecord | undefined> {
  return one<WorkerRecord>('SELECT * FROM workers WHERE email = ?', [email]);
}

export async function createWorkerPg(input: WorkerInput): Promise<WorkerRecord> {
  const id = genId();
  const now = nowISO();
  await exec(
    `INSERT INTO workers (id, tipo_documento, numero_documento, nombres, apellidos, cargo, fecha_ingreso,
      fecha_egreso, estado, eps, afp, arl, caja_compensacion, telefono, email, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.tipo_documento,
      input.numero_documento,
      input.nombres,
      input.apellidos,
      input.cargo,
      input.fecha_ingreso,
      input.fecha_egreso ?? null,
      input.estado ?? 'activo',
      input.eps ?? null,
      input.afp ?? null,
      input.arl ?? null,
      input.caja_compensacion ?? null,
      input.telefono ?? null,
      input.email ?? null,
      now,
      now,
    ]
  );
  const worker = await getWorkerByIdPg(id);
  if (!worker) throw new Error('No se pudo recuperar el trabajador recién creado en PostgreSQL');
  return worker;
}

export async function updateWorkerPg(
  id: string,
  patch: Partial<Omit<WorkerRecord, 'id' | 'creado_en' | 'actualizado_en'>>
): Promise<WorkerRecord | undefined> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    sets.push(`${key} = ?`);
    values.push(value);
  }
  if (sets.length === 0) return getWorkerByIdPg(id);
  sets.push('actualizado_en = ?');
  values.push(nowISO(), id);
  await exec(`UPDATE workers SET ${sets.join(', ')} WHERE id = ?`, values);
  return getWorkerByIdPg(id);
}

export async function deleteWorkerPg(id: string): Promise<void> {
  await exec('DELETE FROM workers WHERE id = ?', [id]);
}
