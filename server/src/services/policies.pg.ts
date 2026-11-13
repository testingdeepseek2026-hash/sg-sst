import { exec, one, query } from '../lib/db-pg.js';
import { genId, nowISO } from '../lib/utils.js';

import type { Objective, Policy } from './policies.js';

/**
 * Políticas y objetivos del SG-SST para PostgreSQL (Neon) — Fase N3.7.
 * Equivalente asíncrono de services/policies.ts.
 */

const POLICY_EDIT_FIELDS = new Set(['titulo', 'contenido']);
const OBJECTIVE_FIELDS = new Set([
  'descripcion',
  'tipo',
  'meta',
  'responsable',
  'fecha_limite',
  'estado',
]);

export async function getPoliciesPg(): Promise<Policy[]> {
  return query<Policy>('SELECT * FROM policies ORDER BY version DESC, creado_en DESC');
}

export async function getPolicyByIdPg(id: string): Promise<Policy | undefined> {
  return one<Policy>('SELECT * FROM policies WHERE id = ?', [id]);
}

export async function getActivePolicyPg(): Promise<Policy | undefined> {
  return one<Policy>("SELECT * FROM policies WHERE estado = 'vigente' LIMIT 1");
}

export async function createPolicyPg(input: {
  titulo: string;
  contenido: string;
  estado?: 'borrador' | 'vigente' | 'archivada';
}): Promise<Policy> {
  const id = genId();
  const now = nowISO();
  const estado = input.estado ?? 'borrador';

  if (estado === 'vigente') {
    const existing = await getActivePolicyPg();
    if (existing) {
      throw new Error(
        'Ya existe una política vigente. Archive la actual antes de crear una nueva vigente.'
      );
    }
  }

  await exec(
    `INSERT INTO policies (id, version, titulo, contenido, firmado_por, fecha_firma, fecha_divulgacion, estado, creado_en, actualizado_en)
     VALUES (?, 1, ?, ?, NULL, NULL, NULL, ?, ?, ?)`,
    [id, input.titulo, input.contenido, estado, now, now]
  );

  return (await getPolicyByIdPg(id)) as Policy;
}

export async function updatePolicyPg(
  id: string,
  patch: Partial<Pick<Policy, 'titulo' | 'contenido'>>
): Promise<Policy> {
  const existing = await getPolicyByIdPg(id);
  if (!existing) throw new Error('Política no encontrada');

  const now = nowISO();

  if (
    existing.estado === 'vigente' &&
    (patch.titulo !== undefined || patch.contenido !== undefined)
  ) {
    await exec("UPDATE policies SET estado = 'archivada', actualizado_en = ? WHERE id = ?", [
      now,
      id,
    ]);

    const newId = genId();
    await exec(
      `INSERT INTO policies (id, version, titulo, contenido, firmado_por, fecha_firma, fecha_divulgacion, estado, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, NULL, NULL, NULL, 'borrador', ?, ?)`,
      [
        newId,
        existing.version + 1,
        patch.titulo ?? existing.titulo,
        patch.contenido ?? existing.contenido,
        now,
        now,
      ]
    );

    return (await getPolicyByIdPg(newId)) as Policy;
  }

  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !POLICY_EDIT_FIELDS.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length > 0) {
    sets.push('actualizado_en = ?');
    vals.push(now, id);
    await exec(`UPDATE policies SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  return (await getPolicyByIdPg(id)) as Policy;
}

export async function deletePolicyPg(id: string): Promise<boolean> {
  const existing = await getPolicyByIdPg(id);
  if (!existing) throw new Error('Política no encontrada');
  if (existing.estado !== 'borrador') {
    throw new Error('Solo se pueden eliminar políticas en estado borrador');
  }

  await exec('DELETE FROM objectives WHERE policy_id = ?', [id]);
  const result = await exec('DELETE FROM policies WHERE id = ?', [id]);
  return result.rowCount > 0;
}

export async function firmarPolicyPg(id: string, firmadoPor: string): Promise<Policy> {
  const existing = await getPolicyByIdPg(id);
  if (!existing) throw new Error('Política no encontrada');
  if (existing.estado !== 'borrador') {
    throw new Error('Solo se pueden firmar políticas en estado borrador');
  }

  const activePolicy = await getActivePolicyPg();
  if (activePolicy && activePolicy.id !== id) {
    throw new Error('Ya existe una política vigente. Archive la actual antes de firmar esta.');
  }

  const now = nowISO();
  await exec(
    `UPDATE policies SET firmado_por = ?, fecha_firma = ?, estado = 'vigente', actualizado_en = ?
     WHERE id = ?`,
    [firmadoPor, now.slice(0, 10), now, id]
  );

  return (await getPolicyByIdPg(id)) as Policy;
}

export async function divulgarPolicyPg(id: string): Promise<Policy> {
  const existing = await getPolicyByIdPg(id);
  if (!existing) throw new Error('Política no encontrada');
  if (existing.estado !== 'vigente') {
    throw new Error('Solo se pueden divulgar políticas vigentes');
  }
  if (existing.fecha_divulgacion) {
    throw new Error('Esta política ya ha sido divulgada');
  }

  const now = nowISO();
  await exec('UPDATE policies SET fecha_divulgacion = ?, actualizado_en = ? WHERE id = ?', [
    now.slice(0, 10),
    now,
    id,
  ]);

  return (await getPolicyByIdPg(id)) as Policy;
}

export async function archivarPolicyPg(id: string): Promise<Policy> {
  const existing = await getPolicyByIdPg(id);
  if (!existing) throw new Error('Política no encontrada');
  if (existing.estado === 'archivada') {
    throw new Error('La política ya está archivada');
  }

  await exec("UPDATE policies SET estado = 'archivada', actualizado_en = ? WHERE id = ?", [
    nowISO(),
    id,
  ]);

  return (await getPolicyByIdPg(id)) as Policy;
}

export async function getObjectivesPg(policyId: string): Promise<Objective[]> {
  return query<Objective>('SELECT * FROM objectives WHERE policy_id = ? ORDER BY tipo', [policyId]);
}

export async function createObjectivePg(input: {
  policy_id: string;
  descripcion: string;
  tipo: 'estructura' | 'proceso' | 'resultado';
  meta?: string | null;
  responsable?: string | null;
  fecha_limite?: string | null;
  estado?: 'pendiente' | 'cumplido' | 'en_proceso' | 'incumplido';
}): Promise<Objective> {
  const id = genId();
  await exec(
    `INSERT INTO objectives (id, policy_id, descripcion, tipo, meta, responsable, fecha_limite, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.policy_id,
      input.descripcion,
      input.tipo,
      input.meta ?? null,
      input.responsable ?? null,
      input.fecha_limite ?? null,
      input.estado ?? 'pendiente',
    ]
  );

  return (await one<Objective>('SELECT * FROM objectives WHERE id = ?', [id])) as Objective;
}

export async function updateObjectivePg(
  id: string,
  patch: Partial<
    Pick<Objective, 'descripcion' | 'tipo' | 'meta' | 'responsable' | 'fecha_limite' | 'estado'>
  >
): Promise<Objective | undefined> {
  const existing = await one('SELECT * FROM objectives WHERE id = ?', [id]);
  if (!existing) throw new Error('Objetivo no encontrado');

  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !OBJECTIVE_FIELDS.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }

  if (sets.length > 0) {
    vals.push(id);
    await exec(`UPDATE objectives SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  return one<Objective>('SELECT * FROM objectives WHERE id = ?', [id]);
}

export async function deleteObjectivePg(id: string) {
  await exec('DELETE FROM objectives WHERE id = ?', [id]);
}

export async function getObjectivesByActivePolicyPg(): Promise<Objective[]> {
  const active = await getActivePolicyPg();
  if (!active) return [];
  return getObjectivesPg(active.id);
}
