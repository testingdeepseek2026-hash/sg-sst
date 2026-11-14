import fs from 'node:fs';
import path from 'node:path';

import pg from 'pg';

/**
 * Capa de acceso a datos para Neon Postgres.
 *
 * Contrato (ver PLAN_MIGRACION_NEON.md, Fase N2):
 *  - query(sql, params)  → filas como array de objetos.
 *  - one(sql, params)    → primera fila o undefined (equivalente a .get() de SQLite).
 *  - exec(sql, params)   → ejecución sin retorno de filas (equivalente a .run()).
 *
 * Los servicios SQLite usan `?` como placeholder; toPlaceholders() los
 * traduce a $1..$n para que la conversión módulo por módulo no requiera
 * reescribir cada consulta a mano.
 */

let pool: pg.Pool | null = null;

export interface PgQueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
}

/**
 * Llave explícita de backend (Fase N2, transición N2–N3):
 * las rutas migradas consultan Postgres solo cuando DB_BACKEND=pg y existe
 * DATABASE_URL. Por defecto el app sigue en SQLite para no romper pruebas
 * ni operación. Al completar N3 la llave se retira y Postgres queda único.
 */
export function isPgBackend(): boolean {
  return process.env.DB_BACKEND === 'pg' && !!process.env.DATABASE_URL;
}

export function getPgPool(): pg.Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL no está definida. Configúrala en el .env de la raíz con la cadena de conexión de Neon (ver .env.example).'
    );
  }

  // Neon exige TLS y la cadena trae sslmode=require; node-pg lo valida de
  // forma completa (equivalente a verify-full). No se relaja el certificado.
  pool = new pg.Pool({
    connectionString,
    max: Number(process.env.PGPOOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });

  pool.on('error', (err) => {
    console.error('[DB-PG] Error inesperado del pool:', err.message);
  });

  return pool;
}

export async function closePgPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/** Convierte placeholders `?` de SQLite a `$1..$n` de PostgreSQL. */
export function toPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await getPgPool().query(toPlaceholders(sql), params);
  return result.rows as T[];
}

/** Equivalente a `db.prepare(sql).get(...params)` de node:sqlite. */
export async function one<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
}

/** Equivalente a `db.prepare(sql).run(...params)` de node:sqlite. */
export async function exec(sql: string, params: unknown[] = []): Promise<PgQueryResult> {
  const result = await getPgPool().query(toPlaceholders(sql), params);
  return { rows: result.rows as Record<string, unknown>[], rowCount: result.rowCount ?? 0 };
}

const PG_MIGRATIONS: { name: string }[] = [
  { name: '002_postgres_initial.sql' },
  { name: '003_altura_permits_evidence.sql' },
  { name: '004_indicators_formula_frequency.sql' },
  { name: '005_plan_anual_evidencias.sql' },
];

function resolveMigrationPath(name: string): string {
  // Igual que runMigrations en lib/db.ts: soporta ejecución desde fuente
  // (src: src/migrations/) y desde build de producción (dist: dist/lib/migrations/).
  const candidates = [
    path.join(import.meta.dirname, 'migrations', name),
    path.join(import.meta.dirname, '..', 'migrations', name),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`No se encontró la migración ${name} en: ${candidates.join(', ')}`);
  }
  return found;
}

/**
 * Ejecuta las migraciones PostgreSQL pendientes de forma idempotente.
 * Registra cada migración aplicada en schema_migrations.
 */
export async function runPgMigrations(poolInstance?: pg.Pool): Promise<void> {
  const client = poolInstance ?? getPgPool();
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      aplicado_en TEXT NOT NULL DEFAULT (to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
    )
  `);

  for (const migration of PG_MIGRATIONS) {
    const { rows } = await client.query('SELECT name FROM schema_migrations WHERE name = $1', [
      migration.name,
    ]);
    if (rows.length > 0) continue;

    const sql = fs.readFileSync(resolveMigrationPath(migration.name), 'utf8');
    const pgClient = await (poolInstance
      ? poolInstance.connect()
      : (await Promise.resolve(getPgPool())).connect());
    try {
      // Una migración se aplica completa o no se aplica (transacción única).
      await pgClient.query('BEGIN');
      await pgClient.query(sql);
      await pgClient.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migration.name]);
      await pgClient.query('COMMIT');
      console.log(`[DB-PG] Migración aplicada: ${migration.name}`);
    } catch (err) {
      await pgClient.query('ROLLBACK');
      throw err;
    } finally {
      pgClient.release();
    }
  }
}
