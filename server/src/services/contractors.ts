import { genId, nowISO } from '../lib/utils.js';

export interface Contractor {
  id: string;
  nombre: string;
  nit?: string;
  servicio: string;
  arl?: string;
  examen_medico: number;
  capacitacion_sst: number;
  epp: number;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  fecha_evaluacion?: string;
  notas?: string;
  creado_en: string;
  actualizado_en: string;
}

export function getContractors(db: any) {
  return db.prepare('SELECT * FROM contractors ORDER BY fecha_evaluacion DESC, creado_en DESC').all() as Contractor[];
}

export function getContractorById(db: any, id: string) {
  return db.prepare('SELECT * FROM contractors WHERE id = ?').get(id) as Contractor | undefined;
}

export function createContractor(db: any, input: any) {
  const id = genId();
  const now = nowISO();
  db.prepare(
    `INSERT INTO contractors (id, nombre, nit, servicio, arl, examen_medico, capacitacion_sst, epp, estado, fecha_evaluacion, notas, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    input.nombre,
    input.nit ?? null,
    input.servicio,
    input.arl ?? null,
    input.examen_medico ?? 0,
    input.capacitacion_sst ?? 0,
    input.epp ?? 0,
    input.estado ?? 'pendiente',
    input.fecha_evaluacion ?? null,
    input.notas ?? null,
    now,
    now
  );
  return db.prepare('SELECT * FROM contractors WHERE id = ?').get(id);
}

export function updateContractor(db: any, id: string, patch: any) {
  const now = nowISO();
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  sets.push('actualizado_en = ?');
  vals.push(now, id);
  db.prepare(`UPDATE contractors SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return db.prepare('SELECT * FROM contractors WHERE id = ?').get(id);
}

export function deleteContractor(db: any, id: string) {
  db.prepare('DELETE FROM contractors WHERE id = ?').run(id);
}