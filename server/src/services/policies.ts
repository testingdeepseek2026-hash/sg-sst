import { genId, nowISO } from '../lib/utils.js';

export interface Policy {
  id: string;
  version: number;
  titulo: string;
  contenido: string;
  firmado_por: string | null;
  fecha_firma: string | null;
  fecha_divulgacion: string | null;
  estado: 'borrador' | 'vigente' | 'archivada';
  creado_en: string;
  actualizado_en: string;
}

export interface Objective {
  id: string;
  policy_id: string;
  descripcion: string;
  tipo: 'estructura' | 'proceso' | 'resultado';
  meta: string | null;
  responsable: string | null;
  fecha_limite: string | null;
  estado: 'pendiente' | 'cumplido' | 'en_proceso' | 'incumplido';
}

export function getPolicies(db: any): Policy[] {
  return db.prepare('SELECT * FROM policies ORDER BY version DESC, rowid DESC').all() as Policy[];
}

export function getPolicyById(db: any, id: string): Policy | undefined {
  return db.prepare('SELECT * FROM policies WHERE id = ?').get(id) as Policy | undefined;
}

export function getActivePolicy(db: any): Policy | undefined {
  return db.prepare('SELECT * FROM policies WHERE estado = ? LIMIT 1').get('vigente') as Policy | undefined;
}

export function createPolicy(db: any, input: {
  titulo: string;
  contenido: string;
  estado?: 'borrador' | 'vigente' | 'archivada';
}): Policy {
  const id = genId();
  const now = nowISO();
  const estado = input.estado ?? 'borrador';
  
  // Validar: solo una política vigente a la vez
  if (estado === 'vigente') {
    const existing = getActivePolicy(db);
    if (existing) {
      throw new Error('Ya existe una política vigente. Archive la actual antes de crear una nueva vigente.');
    }
  }

  db.prepare(
    `INSERT INTO policies (id, version, titulo, contenido, firmado_por, fecha_firma, fecha_divulgacion, estado, creado_en, actualizado_en)
     VALUES (?, 1, ?, ?, NULL, NULL, NULL, ?, ?, ?)`
  ).run(id, input.titulo, input.contenido, estado, now, now);

  return getPolicyById(db, id)!;
}

export function updatePolicy(db: any, id: string, patch: Partial<Pick<Policy, 'titulo' | 'contenido'>>): Policy {
  const existing = getPolicyById(db, id);
  if (!existing) throw new Error('Política no encontrada');

  const now = nowISO();
  const sets: string[] = [];
  const vals: any[] = [];

  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }

  // Si la política está vigente y se edita el contenido/título -> crear nueva versión borrador
  if (existing.estado === 'vigente' && (patch.titulo !== undefined || patch.contenido !== undefined)) {
    // Archivar la actual
    db.prepare(`UPDATE policies SET estado = 'archivada', actualizado_en = ? WHERE id = ?`).run(now, id);
    
    // Crear nueva versión como borrador
    const newId = genId();
    const newVersion = existing.version + 1;
    db.prepare(
      `INSERT INTO policies (id, version, titulo, contenido, firmado_por, fecha_firma, fecha_divulgacion, estado, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, NULL, NULL, NULL, 'borrador', ?, ?)`
    ).run(newId, newVersion, patch.titulo ?? existing.titulo, patch.contenido ?? existing.contenido, now, now);
    
    return getPolicyById(db, newId)!;
  }

  // Edición normal (borrador o archivada)
  if (sets.length > 0) {
    sets.push('actualizado_en = ?');
    vals.push(now, id);
    db.prepare(`UPDATE policies SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }

  return getPolicyById(db, id)!;
}

export function deletePolicy(db: any, id: string): void {
  const existing = getPolicyById(db, id);
  if (!existing) throw new Error('Política no encontrada');
  
  if (existing.estado !== 'borrador') {
    throw new Error('Solo se pueden eliminar políticas en estado borrador');
  }

  // Eliminar objetivos asociados primero
  db.prepare('DELETE FROM objectives WHERE policy_id = ?').run(id);
  db.prepare('DELETE FROM policies WHERE id = ?').run(id);
}

export function firmarPolicy(db: any, id: string, firmadoPor: string): Policy {
  const existing = getPolicyById(db, id);
  if (!existing) throw new Error('Política no encontrada');
  
  if (existing.estado !== 'borrador') {
    throw new Error('Solo se pueden firmar políticas en estado borrador');
  }

  // Validar: solo una política vigente
  const activePolicy = getActivePolicy(db);
  if (activePolicy && activePolicy.id !== id) {
    throw new Error('Ya existe una política vigente. Archive la actual antes de firmar esta.');
  }

  const now = nowISO();
  const fechaFirma = now.slice(0, 10); // Solo fecha YYYY-MM-DD
  
  db.prepare(
    `UPDATE policies SET firmado_por = ?, fecha_firma = ?, estado = 'vigente', actualizado_en = ? WHERE id = ?`
  ).run(firmadoPor, fechaFirma, now, id);

  return getPolicyById(db, id)!;
}

export function divulgarPolicy(db: any, id: string): Policy {
  const existing = getPolicyById(db, id);
  if (!existing) throw new Error('Política no encontrada');
  
  if (existing.estado !== 'vigente') {
    throw new Error('Solo se pueden divulgar políticas vigentes');
  }
  
  if (existing.fecha_divulgacion) {
    throw new Error('Esta política ya ha sido divulgada');
  }

  const now = nowISO();
  const fechaDivulgacion = now.slice(0, 10);
  
  db.prepare(
    `UPDATE policies SET fecha_divulgacion = ?, actualizado_en = ? WHERE id = ?`
  ).run(fechaDivulgacion, now, id);

  return getPolicyById(db, id)!;
}

export function archivarPolicy(db: any, id: string): Policy {
  const existing = getPolicyById(db, id);
  if (!existing) throw new Error('Política no encontrada');
  
  if (existing.estado === 'archivada') {
    throw new Error('La política ya está archivada');
  }

  const now = nowISO();
  db.prepare(`UPDATE policies SET estado = 'archivada', actualizado_en = ? WHERE id = ?`).run(now, id);
  
  return getPolicyById(db, id)!;
}

// CRUD Objectives
export function getObjectives(db: any, policyId: string): Objective[] {
  return db.prepare('SELECT * FROM objectives WHERE policy_id = ? ORDER BY tipo, rowid').all(policyId) as Objective[];
}

export function createObjective(db: any, input: {
  policy_id: string;
  descripcion: string;
  tipo: 'estructura' | 'proceso' | 'resultado';
  meta?: string | null;
  responsable?: string | null;
  fecha_limite?: string | null;
  estado?: 'pendiente' | 'cumplido' | 'en_proceso' | 'incumplido';
}): Objective {
  const id = genId();
  
  db.prepare(
    `INSERT INTO objectives (id, policy_id, descripcion, tipo, meta, responsable, fecha_limite, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.policy_id, input.descripcion, input.tipo, input.meta ?? null, input.responsable ?? null, input.fecha_limite ?? null, input.estado ?? 'pendiente');

  return db.prepare('SELECT * FROM objectives WHERE id = ?').get(id) as Objective;
}

export function updateObjective(db: any, id: string, patch: Partial<Pick<Objective, 'descripcion' | 'tipo' | 'meta' | 'responsable' | 'fecha_limite' | 'estado'>>): Objective {
  const existing = db.prepare('SELECT * FROM objectives WHERE id = ?').get(id) as Objective | undefined;
  if (!existing) throw new Error('Objetivo no encontrado');

  const sets: string[] = [];
  const vals: any[] = [];

  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }

  if (sets.length > 0) {
    vals.push(id);
    db.prepare(`UPDATE objectives SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }

  return db.prepare('SELECT * FROM objectives WHERE id = ?').get(id) as Objective;
}

export function deleteObjective(db: any, id: string): void {
  db.prepare('DELETE FROM objectives WHERE id = ?').run(id);
}

export function getObjectivesByActivePolicy(db: any): Objective[] {
  const active = getActivePolicy(db);
  if (!active) return [];
  return getObjectives(db, active.id);
}