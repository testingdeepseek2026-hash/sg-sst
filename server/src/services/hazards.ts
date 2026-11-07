import { genId, nowISO } from '../lib/utils.js';

export type HazardCategory = 'alturas' | 'electrico' | 'herramientas' | 'escaleras' | 'ergonomia' | 'conduccion' | 'cielos_rasos' | 'confinados' | 'locativo' | 'otro';
export type HazardRiskLevel = 'bajo' | 'medio' | 'alto' | 'critico';

export interface HazardCatalogItem {
  id: string;
  codigo: string;
  nombre: string;
  categoria: HazardCategory;
  descripcion: string | null;
  riesgo_por_defecto: HazardRiskLevel;
  control_sugerido: string | null;
  activo: number;
}

export interface HazardAssessment {
  id: string;
  cargo_oficio: string;
  area: string | null;
  peligro_id: string | null;
  peligro_texto: string | null;
  tarea: string | null;
  consecuencia: string | null;
  probabilidad: string | null;
  valoracion_riesgo: HazardRiskLevel;
  controles: string | null;
  responsable: string | null;
  fecha: string;
  revisado_en: string | null;
  estado: 'vigente' | 'revisado' | 'obsoleto';
}

export function getHazardCatalog(db: any): HazardCatalogItem[] {
  return db.prepare('SELECT * FROM hazard_catalog WHERE activo = 1 ORDER BY categoria, nombre').all() as HazardCatalogItem[];
}

export function getHazardCatalogByCategory(db: any, categoria: HazardCategory): HazardCatalogItem[] {
  return db.prepare('SELECT * FROM hazard_catalog WHERE activo = 1 AND categoria = ? ORDER BY nombre').all(categoria) as HazardCatalogItem[];
}

export function createHazardCatalogItem(db: any, input: {
  codigo: string;
  nombre: string;
  categoria: HazardCategory;
  descripcion?: string | null;
  riesgo_por_defecto?: HazardRiskLevel;
  control_sugerido?: string | null;
}): HazardCatalogItem {
  const id = genId();
  db.prepare(
    `INSERT INTO hazard_catalog (id, codigo, nombre, categoria, descripcion, riesgo_por_defecto, control_sugerido, activo)
     VALUES (?,?,?,?,?,?,?,1)`
  ).run(id, input.codigo, input.nombre, input.categoria, input.descripcion ?? null, input.riesgo_por_defecto ?? 'medio', input.control_sugerido ?? null);
  return db.prepare('SELECT * FROM hazard_catalog WHERE id = ?').get(id) as HazardCatalogItem;
}

export function getHazardAssessments(db: any): HazardAssessment[] {
  return db.prepare('SELECT * FROM hazard_assessments ORDER BY fecha DESC').all() as HazardAssessment[];
}

export function createHazardAssessment(db: any, input: {
  cargo_oficio: string;
  area?: string | null;
  peligro_id?: string | null;
  peligro_texto?: string | null;
  tarea?: string | null;
  consecuencia?: string | null;
  probabilidad?: string | null;
  valoracion_riesgo?: HazardRiskLevel;
  controles?: string | null;
  responsable?: string | null;
  fecha?: string;
  revisado_en?: string | null;
  estado?: 'vigente' | 'revisado' | 'obsoleto';
}): HazardAssessment {
  const id = genId();
  const fecha = nowISO().slice(0, 10);
  db.prepare(
    `INSERT INTO hazard_assessments (id, cargo_oficio, area, peligro_id, peligro_texto, tarea, consecuencia,
      probabilidad, valoracion_riesgo, controles, responsable, fecha, revisado_en, estado)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id, input.cargo_oficio, input.area ?? null, input.peligro_id ?? null, input.peligro_texto ?? null,
    input.tarea ?? null, input.consecuencia ?? null, input.probabilidad ?? null,
    input.valoracion_riesgo ?? 'medio', input.controles ?? null, input.responsable ?? null,
    input.fecha ?? fecha, input.revisado_en ?? null, input.estado ?? 'vigente'
  );
  return db.prepare('SELECT * FROM hazard_assessments WHERE id = ?').get(id) as HazardAssessment;
}

export function updateHazardAssessment(db: any, id: string, patch: Partial<HazardAssessment>): HazardAssessment {
  const now = nowISO();
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`); vals.push(v);
  }
  sets.push('revisado_en = ?'); vals.push(now, id);
  db.prepare(`UPDATE hazard_assessments SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return db.prepare('SELECT * FROM hazard_assessments WHERE id = ?').get(id) as HazardAssessment;
}

export function deleteHazardAssessment(db: any, id: string): void {
  db.prepare('DELETE FROM hazard_assessments WHERE id = ?').run(id);
}