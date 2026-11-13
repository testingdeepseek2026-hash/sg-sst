import { exec, one, query } from '../lib/db-pg.js';
import { genId, nowISO } from '../lib/utils.js';

/**
 * Indicadores SST para PostgreSQL (Neon) — Fase N3.7.
 * Equivalente asíncrono de services/indicators.ts.
 */

const INDICATOR_FIELDS = new Set([
  'nombre',
  'tipo',
  'valor',
  'meta',
  'periodo',
  'notas',
  'formula',
  'frecuencia',
]);

export const SST_FORMULAS: Record<string, string> = {
  TRIR: ' (incidentes_registrados * 200000) / horas_trabajadas_totales ',
  LTIFR: ' (incidentes_con_perdida * 1000000) / horas_trabajadas_totales ',
  FRECUENCIA: ' (total_incidentes * 1000000) / horas_trabajadas_totales ',
  GRAVEDAD: ' (dias_perdidos * 1000000) / horas_trabajadas_totales ',
  INCIDENCIA_MENSUAL: ' (incidentes_mes * 30) / horas_trabajadas_mes ',
};

export async function getIndicatorsPg(periodo?: string) {
  if (periodo) {
    return query('SELECT * FROM indicators WHERE periodo = ? ORDER BY nombre', [periodo]);
  }
  return query('SELECT * FROM indicators ORDER BY periodo DESC, nombre');
}

export async function createIndicatorPg(input: Record<string, any>) {
  const id = genId();
  const formula = SST_FORMULAS[input.codigo] || input.formula || null;
  await exec(
    `INSERT INTO indicators (id, nombre, tipo, valor, meta, periodo, fecha_calculo, notas, formula, frecuencia)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.nombre,
      input.tipo,
      input.valor,
      input.meta ?? null,
      input.periodo,
      input.fecha_calculo ?? nowISO(),
      input.notas ?? null,
      formula,
      input.frecuencia ?? 'mensual',
    ]
  );
  return one('SELECT * FROM indicators WHERE id = ?', [id]);
}

export async function updateIndicatorPg(id: string, patch: Record<string, any>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !INDICATOR_FIELDS.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  sets.push('fecha_calculo = ?');
  vals.push(nowISO(), id);
  await exec(`UPDATE indicators SET ${sets.join(', ')} WHERE id = ?`, vals);
  return one('SELECT * FROM indicators WHERE id = ?', [id]);
}

export async function deleteIndicatorPg(id: string) {
  await exec('DELETE FROM indicators WHERE id = ?', [id]);
}
