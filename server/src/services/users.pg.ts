import { exec, getPgPool, one, query } from '../lib/db-pg.js';
import { genId, nowISO } from '../lib/utils.js';

import { sanitizeForAudit, type User } from './users.js';

import type pg from 'pg';

export type AuditEntryPg = {
  usuario_id?: string | null;
  usuario_email?: string | null;
  accion: string;
  entidad: string;
  entidad_id?: string | null;
  valores_anteriores?: unknown;
  valores_nuevos?: unknown;
  ip?: string | null;
};

export type AuditFiltersPg = {
  limit?: number;
  offset?: number;
  entidad?: string;
  accion?: string;
  usuario_id?: string;
  desde?: string;
  hasta?: string;
};

export type AuditLogRecordPg = {
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
};

function serializeAuditValue(value: unknown): string | null {
  if (value === undefined) return null;
  return JSON.stringify(sanitizeForAudit(value)) ?? null;
}

async function insertAuditLogPg(client: pg.PoolClient, input: AuditEntryPg): Promise<string> {
  const id = genId();
  await client.query(
    `INSERT INTO audit_logs (id, usuario_id, usuario_email, accion, entidad, entidad_id,
      valores_anteriores, valores_nuevos, ip, creado_en)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      input.usuario_id ?? null,
      input.usuario_email ?? null,
      input.accion,
      input.entidad,
      input.entidad_id ?? null,
      serializeAuditValue(input.valores_anteriores),
      serializeAuditValue(input.valores_nuevos),
      input.ip ?? null,
      nowISO(),
    ]
  );
  return id;
}

export async function getAllUsersPg(): Promise<User[]> {
  return query<User>('SELECT * FROM users ORDER BY nombre');
}

export async function getUserByEmailPg(
  email: string | null | undefined
): Promise<User | undefined> {
  if (!email) return undefined;
  return one<User>('SELECT * FROM users WHERE email = ?', [email]);
}

export async function getUserByIdPg(id: string | null | undefined): Promise<User | undefined> {
  if (!id) return undefined;
  return one<User>('SELECT * FROM users WHERE id = ?', [id]);
}

export async function registerFirstUserPg(input: {
  email: string;
  password_hash: string;
  nombre: string;
  rol: User['rol'];
}): Promise<
  | { status: 'created'; user: User }
  | { status: 'already_registered' }
  | { status: 'duplicate_email' }
> {
  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [846239, 1]);
    const count = await client.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM users');
    if ((count.rows[0]?.c ?? 0) > 0) {
      await client.query('ROLLBACK');
      return { status: 'already_registered' };
    }

    const duplicate = await client.query('SELECT 1 FROM users WHERE email = $1', [input.email]);
    if (duplicate.rowCount) {
      await client.query('ROLLBACK');
      return { status: 'duplicate_email' };
    }

    const id = genId();
    const now = nowISO();
    await client.query(
      `INSERT INTO users (id, email, password_hash, nombre, rol, creado_en, actualizado_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, input.email, input.password_hash, input.nombre, input.rol, now, now]
    );
    const result = await client.query<User>('SELECT * FROM users WHERE id = $1', [id]);
    const user = result.rows[0];
    if (!user) throw new Error('No se pudo recuperar el usuario recién creado en PostgreSQL');

    await insertAuditLogPg(client, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'users',
      entidad_id: user.id,
      valores_nuevos: { email: user.email, nombre: user.nombre, rol: user.rol },
    });
    await client.query('COMMIT');
    return { status: 'created', user };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateUserPg(
  id: string,
  patch: Partial<Pick<User, 'nombre' | 'rol' | 'email'>>
): Promise<User | undefined> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    sets.push(`${key} = ?`);
    values.push(value);
  }
  if (sets.length === 0) return getUserByIdPg(id);
  sets.push('actualizado_en = ?');
  values.push(nowISO(), id);
  await exec(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values);
  return getUserByIdPg(id);
}

export async function deleteUserPg(id: string): Promise<void> {
  await exec('DELETE FROM users WHERE id = ?', [id]);
}

export async function auditLogPg(input: AuditEntryPg): Promise<string> {
  const client = await getPgPool().connect();
  try {
    return await insertAuditLogPg(client, input);
  } finally {
    client.release();
  }
}

export async function getAuditLogsPg(filters: AuditFiltersPg = {}) {
  const where: string[] = [];
  const values: unknown[] = [];

  for (const key of ['entidad', 'accion', 'usuario_id'] as const) {
    const value = filters[key];
    if (!value) continue;
    where.push(`${key} = ?`);
    values.push(value);
  }
  if (filters.desde) {
    where.push('creado_en::date >= ?::date');
    values.push(filters.desde);
  }
  if (filters.hasta) {
    where.push('creado_en::date <= ?::date');
    values.push(filters.hasta);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;
  const [logs, total] = await Promise.all([
    query<AuditLogRecordPg>(
      `SELECT * FROM audit_logs ${clause} ORDER BY creado_en DESC LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    ),
    one<{ c: number }>(`SELECT COUNT(*)::int AS c FROM audit_logs ${clause}`, values),
  ]);
  return { logs, total: total?.c ?? 0 };
}

export async function getAuditLogStatsPg() {
  const [total, porEntidad, porAccion, porUsuario] = await Promise.all([
    one<{ c: number }>('SELECT COUNT(*)::int AS c FROM audit_logs'),
    query<{ entidad: string; c: number }>(
      'SELECT entidad, COUNT(*)::int AS c FROM audit_logs GROUP BY entidad ORDER BY c DESC'
    ),
    query<{ accion: string; c: number }>(
      'SELECT accion, COUNT(*)::int AS c FROM audit_logs GROUP BY accion ORDER BY c DESC'
    ),
    query<{ usuario_email: string; c: number }>(
      `SELECT usuario_email, COUNT(*)::int AS c FROM audit_logs
       WHERE usuario_email IS NOT NULL GROUP BY usuario_email ORDER BY c DESC`
    ),
  ]);
  return { total: total?.c ?? 0, porEntidad, porAccion, porUsuario };
}
