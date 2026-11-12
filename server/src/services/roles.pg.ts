import { exec, one, query } from '../lib/db-pg.js';
import { genId, nowISO } from '../lib/utils.js';

export type RoleRecord = {
  id: string;
  nombre: string;
  descripcion: string | null;
  usuario_id: string | null;
  licencia_sst_numero: string | null;
  licencia_sst_vence: string | null;
  curso_50h: number;
  curso_50h_vence: string | null;
  notas: string | null;
  creado_en: string;
  actualizado_en: string;
};

type RoleInput = Omit<
  Partial<Omit<RoleRecord, 'id' | 'creado_en' | 'actualizado_en'>>,
  'curso_50h'
> & { curso_50h?: boolean | number };

function dbValue(key: string, value: unknown): unknown {
  if (key === 'curso_50h' && typeof value === 'boolean') return value ? 1 : 0;
  return value === undefined ? null : value;
}

export async function getRolesPg(): Promise<RoleRecord[]> {
  return query<RoleRecord>('SELECT * FROM roles ORDER BY nombre');
}

export async function getRoleByIdPg(id: string): Promise<RoleRecord | undefined> {
  return one<RoleRecord>('SELECT * FROM roles WHERE id = ?', [id]);
}

export async function createRolePg(input: RoleInput): Promise<RoleRecord> {
  const id = genId();
  const now = nowISO();
  await exec(
    `INSERT INTO roles (id, nombre, descripcion, usuario_id, licencia_sst_numero, licencia_sst_vence,
      curso_50h, curso_50h_vence, notas, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.nombre,
      input.descripcion ?? null,
      input.usuario_id ?? null,
      input.licencia_sst_numero ?? null,
      input.licencia_sst_vence ?? null,
      dbValue('curso_50h', input.curso_50h ?? 0),
      input.curso_50h_vence ?? null,
      input.notas ?? null,
      now,
      now,
    ]
  );
  const role = await getRoleByIdPg(id);
  if (!role) throw new Error('No se pudo recuperar el rol recién creado en PostgreSQL');
  return role;
}

export async function updateRolePg(id: string, patch: RoleInput): Promise<RoleRecord | undefined> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    sets.push(`${key} = ?`);
    values.push(dbValue(key, value));
  }
  if (sets.length === 0) return getRoleByIdPg(id);
  sets.push('actualizado_en = ?');
  values.push(nowISO(), id);
  await exec(`UPDATE roles SET ${sets.join(', ')} WHERE id = ?`, values);
  return getRoleByIdPg(id);
}

export async function deleteRolePg(id: string): Promise<void> {
  await exec('DELETE FROM roles WHERE id = ?', [id]);
}

export async function getRoleVencimientosPg() {
  return query(
    `SELECT r.id, r.nombre, r.licencia_sst_vence AS fecha, r.licencia_sst_numero,
            u.email AS usuario_email, 'licencia_sst' AS tipo
     FROM roles r LEFT JOIN users u ON r.usuario_id = u.id
     WHERE r.licencia_sst_vence IS NOT NULL
     UNION ALL
     SELECT r.id, r.nombre, r.curso_50h_vence AS fecha, r.licencia_sst_numero,
            u.email AS usuario_email, 'curso_50h' AS tipo
     FROM roles r LEFT JOIN users u ON r.usuario_id = u.id
     WHERE r.curso_50h_vence IS NOT NULL
     ORDER BY fecha`
  );
}
