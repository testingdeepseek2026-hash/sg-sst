import { exec, one, query } from '../lib/db-pg.js';
import { genId, nowISO } from '../lib/utils.js';

import type {
  HazardAssessment,
  HazardCatalogItem,
  HazardCategory,
  HazardRiskLevel,
} from './hazards.js';

/**
 * Servicio de peligros y matriz de riesgos para PostgreSQL (Neon) — Fase N3.3.
 * Equivalente asíncrono de services/hazards.ts con las mismas convenciones:
 * fechas TEXT ISO-8601 y booleanos INTEGER 0/1.
 */

type HazardCatalogInput = {
  codigo: string;
  nombre: string;
  categoria: HazardCategory;
  descripcion?: string | null;
  riesgo_por_defecto?: HazardRiskLevel;
  control_sugerido?: string | null;
};

type HazardAssessmentInput = {
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
};

const ASSESSMENT_FIELDS = new Set([
  'cargo_oficio',
  'area',
  'peligro_id',
  'peligro_texto',
  'tarea',
  'consecuencia',
  'probabilidad',
  'valoracion_riesgo',
  'controles',
  'responsable',
  'fecha',
  'estado',
]);

export async function getHazardCatalogPg(): Promise<HazardCatalogItem[]> {
  return query<HazardCatalogItem>(
    'SELECT * FROM hazard_catalog WHERE activo = 1 ORDER BY categoria, nombre'
  );
}

export async function getHazardCatalogByCategoryPg(
  categoria: HazardCategory
): Promise<HazardCatalogItem[]> {
  return query<HazardCatalogItem>(
    'SELECT * FROM hazard_catalog WHERE activo = 1 AND categoria = ? ORDER BY nombre',
    [categoria]
  );
}

export async function createHazardCatalogItemPg(
  input: HazardCatalogInput
): Promise<HazardCatalogItem> {
  const id = genId();
  await exec(
    `INSERT INTO hazard_catalog (id, codigo, nombre, categoria, descripcion, riesgo_por_defecto, control_sugerido, activo)
     VALUES (?,?,?,?,?,?,?,1)`,
    [
      id,
      input.codigo,
      input.nombre,
      input.categoria,
      input.descripcion ?? null,
      input.riesgo_por_defecto ?? 'medio',
      input.control_sugerido ?? null,
    ]
  );
  return (await one<HazardCatalogItem>('SELECT * FROM hazard_catalog WHERE id = ?', [
    id,
  ])) as HazardCatalogItem;
}

export async function getHazardAssessmentsPg(): Promise<HazardAssessment[]> {
  return query<HazardAssessment>('SELECT * FROM hazard_assessments ORDER BY fecha DESC');
}

export async function createHazardAssessmentPg(
  input: HazardAssessmentInput
): Promise<HazardAssessment> {
  const id = genId();
  const fecha = nowISO().slice(0, 10);
  await exec(
    `INSERT INTO hazard_assessments (id, cargo_oficio, area, peligro_id, peligro_texto, tarea, consecuencia,
      probabilidad, valoracion_riesgo, controles, responsable, fecha, revisado_en, estado)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.cargo_oficio,
      input.area ?? null,
      input.peligro_id ?? null,
      input.peligro_texto ?? null,
      input.tarea ?? null,
      input.consecuencia ?? null,
      input.probabilidad ?? null,
      input.valoracion_riesgo ?? 'medio',
      input.controles ?? null,
      input.responsable ?? null,
      input.fecha ?? fecha,
      input.revisado_en ?? null,
      input.estado ?? 'vigente',
    ]
  );
  return (await one<HazardAssessment>('SELECT * FROM hazard_assessments WHERE id = ?', [
    id,
  ])) as HazardAssessment;
}

export async function updateHazardAssessmentPg(
  id: string,
  patch: Partial<HazardAssessment>
): Promise<HazardAssessment> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !ASSESSMENT_FIELDS.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  sets.push('revisado_en = ?');
  vals.push(nowISO(), id);
  await exec(`UPDATE hazard_assessments SET ${sets.join(', ')} WHERE id = ?`, vals);
  return (await one<HazardAssessment>('SELECT * FROM hazard_assessments WHERE id = ?', [
    id,
  ])) as HazardAssessment;
}

export async function deleteHazardAssessmentPg(id: string): Promise<void> {
  await exec('DELETE FROM hazard_assessments WHERE id = ?', [id]);
}
