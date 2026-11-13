import { exec, one, query } from '../lib/db-pg.js';
import { genId, nowISO } from '../lib/utils.js';

/**
 * Servicio de estándares mínimos y autoevaluación para PostgreSQL (Neon)
 * — Fase N3.3. Equivalente asíncrono de services/standards.ts.
 */

export type StandardRecord = Record<string, unknown> & { id: string };
export type StandardAssessmentRecord = Record<string, unknown> & { id: string };

const ASSESSMENT_FIELDS = new Set([
  'standard_id',
  'cumple',
  'observaciones',
  'plan_mejora',
  'fecha',
  'usuario_id',
]);

export async function getStandardsPg(set?: string): Promise<StandardRecord[]> {
  if (set) {
    return query<StandardRecord>(
      'SELECT * FROM standards WHERE activo = 1 AND set_aplicable = ? ORDER BY codigo',
      [set]
    );
  }
  return query<StandardRecord>(
    'SELECT * FROM standards WHERE activo = 1 ORDER BY set_aplicable, codigo'
  );
}

export async function getStandardByIdPg(id: string): Promise<StandardRecord | undefined> {
  return one<StandardRecord>('SELECT * FROM standards WHERE id = ?', [id]);
}

export async function createStandardPg(input: {
  codigo: string;
  titulo: string;
  descripcion: string;
  set_aplicable: '7' | '21' | '32';
  capitulo: 'I' | 'II' | 'III';
  modo_verificacion?: string | null;
}): Promise<StandardRecord> {
  const id = genId();
  await exec(
    `INSERT INTO standards (id, codigo, titulo, descripcion, set_aplicable, capitulo, modo_verificacion, activo)
     VALUES (?,?,?,?,?,?,?,1)`,
    [
      id,
      input.codigo,
      input.titulo,
      input.descripcion,
      input.set_aplicable,
      input.capitulo,
      input.modo_verificacion ?? null,
    ]
  );
  return (await one<StandardRecord>('SELECT * FROM standards WHERE id = ?', [
    id,
  ])) as StandardRecord;
}

export async function getStandardAssessmentsPg(): Promise<StandardAssessmentRecord[]> {
  return query<StandardAssessmentRecord>('SELECT * FROM standard_assessments ORDER BY fecha DESC');
}

export async function createStandardAssessmentPg(input: {
  standard_id: string;
  cumple: boolean;
  observaciones?: string | null;
  plan_mejora?: string | null;
  fecha?: string;
  usuario_id?: string | null;
}): Promise<StandardAssessmentRecord> {
  const id = genId();
  const now = nowISO();
  await exec(
    `INSERT INTO standard_assessments (id, standard_id, cumple, observaciones, plan_mejora, fecha, usuario_id)
     VALUES (?,?,?,?,?,?,?)`,
    [
      id,
      input.standard_id,
      input.cumple ? 1 : 0,
      input.observaciones ?? null,
      input.plan_mejora ?? null,
      input.fecha ?? now,
      input.usuario_id ?? null,
    ]
  );
  return (await one<StandardAssessmentRecord>('SELECT * FROM standard_assessments WHERE id = ?', [
    id,
  ])) as StandardAssessmentRecord;
}

export async function updateStandardAssessmentPg(
  id: string,
  patch: Record<string, unknown>
): Promise<StandardAssessmentRecord> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !ASSESSMENT_FIELDS.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(k === 'cumple' ? (v ? 1 : 0) : v);
  }
  sets.push('fecha = ?');
  vals.push(nowISO(), id);
  await exec(`UPDATE standard_assessments SET ${sets.join(', ')} WHERE id = ?`, vals);
  return (await one<StandardAssessmentRecord>('SELECT * FROM standard_assessments WHERE id = ?', [
    id,
  ])) as StandardAssessmentRecord;
}

export async function deleteStandardAssessmentPg(id: string): Promise<void> {
  await exec('DELETE FROM standard_assessments WHERE id = ?', [id]);
}

export async function stdCumplimientoPg(): Promise<{
  total: number;
  cumplidos: number;
  incumplidos: number;
  porcentaje: number;
}> {
  const rows = await query<{ cumple: number | string; c: number | string }>(
    'SELECT cumple, COUNT(*) AS c FROM standard_assessments GROUP BY cumple'
  );
  const countFor = (value: number) => Number(rows.find((r) => Number(r.cumple) === value)?.c ?? 0);
  const si = countFor(1);
  const no = countFor(0);
  const total = si + no;
  return {
    total,
    cumplidos: si,
    incumplidos: no,
    porcentaje: total ? Math.round((si / total) * 100) : 0,
  };
}
