import { genId, nowISO } from '../lib/utils.js';

export type User = {
  id: string;
  email: string;
  password_hash: string;
  nombre: string;
  rol: 'administrador' | 'trabajador';
  creado_en: string;
  actualizado_en: string;
};

export function getAllUsers(db: any): User[] {
  return db.prepare('SELECT * FROM users ORDER BY nombre').all() as User[];
}

export function getUserByEmail(db: any, email: string | null | undefined): User | undefined {
  if (!email) return undefined;
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
}

export function getUserById(db: any, id: string | null | undefined): User | undefined {
  if (!id) return undefined;
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function createUser(
  db: any,
  input: {
    email: string;
    password_hash: string;
    nombre: string;
    rol: 'administrador' | 'trabajador';
  }
): User {
  const id = genId();
  const now = nowISO();
  db.prepare(
    'INSERT INTO users (id, email, password_hash, nombre, rol, creado_en, actualizado_en) VALUES (?,?,?,?,?,?,?)'
  ).run(id, input.email, input.password_hash, input.nombre, input.rol, now, now);
  return getUserById(db, id)!;
}

export function updateUser(
  db: any,
  id: string,
  patch: Partial<Pick<User, 'nombre' | 'rol' | 'email'>>
) {
  const now = nowISO();
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return getUserById(db, id);
  sets.push(`actualizado_en = ?`);
  vals.push(now, id);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getUserById(db, id)!;
}

export function deleteUser(db: any, id: string) {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

// Campos sensibles que no deben ir en bitácoras (Ley 1581/2012)
const AUDIT_SENSITIVE_FIELDS = [
  'restricciones',
  'medico',
  'entidad',
  'archivo_url',
  'notas',
  'diagnostico',
  'tratamiento',
  'historia_clinica',
  'examenes',
  'resultados',
  'archivo_evidencia',
  'firma_url',
  'firma_solicitante_url',
  'firma_responsable_url',
];

/**
 * Sanitiza un objeto removiendo o enmascarando campos sensibles antes de log/bitácora
 */
function sanitizeForAudit(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForAudit);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (AUDIT_SENSITIVE_FIELDS.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
      sanitized[key] = '[DATO SENSIBLE - PROTEGIDO LEY 1581/2012]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeForAudit(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function auditLog(
  db: any,
  input: {
    usuario_id?: string | null;
    usuario_email?: string | null;
    accion: string;
    entidad: string;
    entidad_id?: string | null;
    valores_anteriores?: any;
    valores_nuevos?: any;
    ip?: string | null;
  }
) {
  const id = genId();
  const now = nowISO();
  db.prepare(
    `INSERT INTO audit_logs (id, usuario_id, usuario_email, accion, entidad, entidad_id,
      valores_anteriores, valores_nuevos, ip, creado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    input.usuario_id ?? null,
    input.usuario_email ?? null,
    input.accion,
    input.entidad,
    input.entidad_id ?? null,
    input.valores_anteriores !== undefined
      ? JSON.stringify(sanitizeForAudit(input.valores_anteriores))
      : null,
    input.valores_nuevos !== undefined
      ? JSON.stringify(sanitizeForAudit(input.valores_nuevos))
      : null,
    input.ip ?? null,
    now
  );
  return id;
}

export function getAuditLogs(db: any, limit = 100) {
  return db
    .prepare(`SELECT * FROM audit_logs ORDER BY creado_en DESC LIMIT ?`)
    .all(limit) as Array<{
    id: string;
    usuario_id: string | null;
    usuario_email: string | null;
    accion: string;
    entidad: string;
    entidad_id: string | null;
    valores_anteriores: string | null;
    valores_nuevos: string | null;
    ip: string | null;
    creado_en: string;
  }>;
}
