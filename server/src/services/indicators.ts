import { genId, nowISO } from '../lib/utils.js';

const SST_FORMULAS: Record<string, string> = {
  TRIR: ' (incidentes_registrados * 200000) / horas_trabajadas_totales ',
  LTIFR: ' (incidentes_con_perdida * 1000000) / horas_trabajadas_totales ',
  FRECUENCIA: ' (total_incidentes * 1000000) / horas_trabajadas_totales ',
  GRAVEDAD: ' (dias_perdidos * 1000000) / horas_trabajadas_totales ',
  INCIDENCIA_MENSUAL: ' (incidentes_mes * 30) / horas_trabajadas_mes ',
};

export function getIndicators(db: any, periodo?: string) {
  if (periodo)
    return db.prepare('SELECT * FROM indicators WHERE periodo = ? ORDER BY nombre').all(periodo);
  return db.prepare('SELECT * FROM indicators ORDER BY periodo DESC, nombre').all() as any[];
}

export function calculateIndicatorValue(formula: string | null, context: any): number | null {
  if (!formula) return null;
  try {
    let f = formula;
    f = f.replace(/incidentes_registrados/gi, String(context.incidentes_registrados ?? 0));
    f = f.replace(/incidentes_con_perdida/gi, String(context.incidentes_con_perdida ?? 0));
    f = f.replace(/total_incidentes/gi, String(context.total_incidentes ?? 0));
    f = f.replace(/dias_perdidos/gi, String(context.dias_perdidos ?? 0));
    f = f.replace(/horas_trabajadas_totales/gi, String(context.horas_trabajadas_totales ?? 0));
    f = f.replace(/incidentes_mes/gi, String(context.incidentes_mes ?? 0));
    f = f.replace(/horas_trabajadas_mes/gi, String(context.horas_trabajadas_mes ?? 0));
    return Math.round(parseFloat(f) * 100) / 100;
  } catch {
    return null;
  }
}

export function createIndicator(db: any, input: any) {
  const id = genId();
  const formula = SST_FORMULAS[input.codigo] || input.formula || null;
  db.prepare(
    `INSERT INTO indicators (id, nombre, tipo, valor, meta, periodo, fecha_calculo, notas, formula, frecuencia)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    input.nombre,
    input.tipo,
    input.valor,
    input.meta ?? null,
    input.periodo,
    input.fecha_calculo ?? nowISO(),
    input.notas ?? null,
    formula,
    input.frecuencia ?? 'mensual'
  );
  return db.prepare('SELECT * FROM indicators WHERE id = ?').get(id);
}

export function updateIndicator(db: any, id: string, patch: any) {
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  sets.push('fecha_calculo = ?');
  vals.push(nowISO(), id);
  db.prepare(`UPDATE indicators SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return db.prepare('SELECT * FROM indicators WHERE id = ?').get(id);
}

export function deleteIndicator(db: any, id: string) {
  db.prepare('DELETE FROM indicators WHERE id = ?').run(id);
}
