import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

import { getPgPool, toPlaceholders } from '../lib/db-pg.js';
import {
  getForeignKeyEdges,
  getPublicTables,
  orderTablesByDependencies,
  quoteIdent,
} from '../lib/pg-schema.js';

/**
 * Respaldos lógicos PostgreSQL (Fase N5).
 *
 * No requiere `pg_dump`/`psql`: extrae cada tabla a JSONL comprimido y guarda
 * un manifiesto con conteos y SHA-256. La restauración exige un esquema ya
 * migrado (`migrate:pg`) y reemplaza los datos dentro de una transacción.
 *
 * Limitaciones: es un respaldo de datos, no del esquema; para volúmenes muy
 * grandes conviene complementarlo con snapshots/branches de Neon o pg_dump.
 */

export interface PgBackupConfig {
  backupDir: string;
  uploadsDir: string;
  retentionDays: number;
  timezone: string;
}

export interface PgBackupManifest {
  backup_name: string;
  created_at: string;
  version: string;
  backend: 'postgresql';
  format: 'jsonl-gzip';
  includes_uploads: boolean;
  retention_days: number;
  migrations: string[];
  order: string[];
  tables: Array<{
    name: string;
    rows: number;
    sha256: string;
    file: string;
  }>;
}

const BACKUP_PREFIX = 'sg-sst-pg-backup-';
const DATA_DIR = 'data';
const MANIFEST_FILE = 'MANIFEST.json';
const BATCH_PARAM_LIMIT = 30_000;

export function getPgBackupConfigFromEnv(): PgBackupConfig {
  return {
    backupDir: process.env.BACKUP_DIR ?? join(process.cwd(), 'backups'),
    uploadsDir: process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads'),
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS ?? '30', 10),
    timezone: process.env.BACKUP_TIMEZONE ?? 'America/Bogota',
  };
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function readManifest(path: string): PgBackupManifest {
  const manifest = JSON.parse(readFileSync(path, 'utf8')) as PgBackupManifest;
  if (manifest.backend !== 'postgresql' || manifest.format !== 'jsonl-gzip') {
    throw new Error('Manifiesto no corresponde a un respaldo PostgreSQL de este formato.');
  }
  return manifest;
}

function safeBackupName(name: string): boolean {
  return Boolean(name) && basename(name) === name && !name.includes('..');
}

function directorySize(path: string): number {
  let total = 0;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    total += entry.isDirectory() ? directorySize(child) : statSync(child).size;
  }
  return total;
}

function verifyContents(
  backupPath: string,
  manifest: PgBackupManifest
): { errors: string[]; contents: Map<string, string> } {
  const errors: string[] = [];
  const contents = new Map<string, string>();

  for (const table of manifest.tables) {
    if (basename(table.file) !== table.file) {
      errors.push(`${table.name}: nombre de archivo inválido en el manifiesto`);
      continue;
    }
    const filePath = join(backupPath, DATA_DIR, table.file);
    if (!existsSync(filePath)) {
      errors.push(`${table.name}: falta ${table.file}`);
      continue;
    }
    const text = gunzipSync(readFileSync(filePath)).toString('utf8');
    const rows = text.split('\n').filter((line) => line.length > 0).length;
    if (rows !== table.rows) {
      errors.push(`${table.name}: filas ${rows}, esperadas ${table.rows}`);
    }
    if (sha256(text) !== table.sha256) {
      errors.push(`${table.name}: checksum no coincide`);
    }
    contents.set(table.name, text);
  }

  return { errors, contents };
}

export async function createPgBackup(config: PgBackupConfig): Promise<{
  success: boolean;
  file?: string;
  error?: string;
}> {
  try {
    mkdirSync(config.backupDir, { recursive: true });
    const backupName = `${BACKUP_PREFIX}${timestamp()}`;
    const backupPath = join(config.backupDir, backupName);
    mkdirSync(join(backupPath, DATA_DIR), { recursive: true });

    const pool = getPgPool();
    const client = await pool.connect();
    try {
      const tables = await getPublicTables(client);
      const edges = await getForeignKeyEdges(client);
      const order = orderTablesByDependencies(tables, edges);

      const entries: PgBackupManifest['tables'] = [];
      for (const table of order) {
        const { rows } = await client.query(`SELECT * FROM ${quoteIdent(table)}`);
        const text = rows.length ? `${rows.map((row) => JSON.stringify(row)).join('\n')}\n` : '';
        const file = `${table}.jsonl.gz`;
        writeFileSync(join(backupPath, DATA_DIR, file), gzipSync(Buffer.from(text, 'utf8')));
        entries.push({ name: table, rows: rows.length, sha256: sha256(text), file });
        console.log(`[BACKUP-PG] ${table}: ${rows.length} filas`);
      }

      const { rows: migrationRows } = await client.query<{ name: string }>(
        'SELECT name FROM schema_migrations ORDER BY name'
      );
      const migrations = migrationRows.map((row) => row.name);

      const hasUploads = existsSync(config.uploadsDir);
      if (hasUploads) {
        cpSync(config.uploadsDir, join(backupPath, 'uploads'), { recursive: true });
      } else {
        mkdirSync(join(backupPath, 'uploads'), { recursive: true });
      }

      const manifest: PgBackupManifest = {
        backup_name: backupName,
        created_at: new Date().toISOString(),
        version: '2.0.0',
        backend: 'postgresql',
        format: 'jsonl-gzip',
        includes_uploads: hasUploads,
        retention_days: config.retentionDays,
        migrations,
        order,
        tables: entries,
      };
      writeFileSync(join(backupPath, MANIFEST_FILE), JSON.stringify(manifest, null, 2), 'utf8');

      return { success: true, file: backupPath };
    } finally {
      client.release();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[BACKUP-PG] Error creando respaldo:', message);
    return { success: false, error: message };
  }
}

export function applyPgRetention(config: PgBackupConfig): { deleted: number; errors: string[] } {
  const errors: string[] = [];
  let deleted = 0;
  if (!existsSync(config.backupDir)) return { deleted, errors };

  const cutoff = Date.now() - config.retentionDays * 24 * 60 * 60 * 1000;
  for (const entry of readdirSync(config.backupDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(BACKUP_PREFIX)) continue;
    const path = join(config.backupDir, entry.name);
    try {
      if (statSync(path).mtimeMs < cutoff) {
        rmSync(path, { recursive: true, force: true });
        deleted++;
      }
    } catch (error) {
      errors.push(`${entry.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { deleted, errors };
}

export async function runPgBackup(config: PgBackupConfig): Promise<{
  success: boolean;
  file?: string;
  deleted?: number;
  error?: string;
}> {
  console.log('[BACKUP-PG] Iniciando respaldo programado...');
  const result = await createPgBackup(config);
  if (!result.success) return { success: false, error: result.error };

  console.log(`[BACKUP-PG] Respaldo creado: ${result.file}`);
  const retention = applyPgRetention(config);
  console.log(`[BACKUP-PG] Retención aplicada: ${retention.deleted} respaldos eliminados`);
  if (retention.errors.length) console.warn('[BACKUP-PG] Errores en retención:', retention.errors);

  return { success: true, file: result.file, deleted: retention.deleted };
}

export function listPgBackups(config: PgBackupConfig): Array<{
  file: string;
  name: string;
  created_at: string;
  size_bytes: number;
  size_mb: number;
  tables?: string[];
  includes_uploads?: boolean;
}> {
  if (!existsSync(config.backupDir)) return [];

  const backups: Array<{
    file: string;
    name: string;
    created_at: string;
    size_bytes: number;
    size_mb: number;
    tables?: string[];
    includes_uploads?: boolean;
  }> = [];

  for (const entry of readdirSync(config.backupDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(BACKUP_PREFIX)) continue;
    const path = join(config.backupDir, entry.name);
    try {
      const stats = statSync(path);
      let manifest: PgBackupManifest | null = null;
      try {
        manifest = readManifest(join(path, MANIFEST_FILE));
      } catch {
        manifest = null;
      }
      const size = directorySize(path);
      backups.push({
        file: entry.name,
        name: entry.name,
        created_at: manifest?.created_at ?? stats.mtime.toISOString(),
        size_bytes: size,
        size_mb: Math.round((size / (1024 * 1024)) * 100) / 100,
        tables: manifest?.tables.map((table) => table.name),
        includes_uploads: manifest?.includes_uploads,
      });
    } catch {
      // Ignorar respaldos ilegibles
    }
  }

  return backups.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function validatePgBackup(
  config: PgBackupConfig,
  backupName: string
): { success: boolean; error?: string; manifest?: PgBackupManifest } {
  if (!safeBackupName(backupName)) {
    return { success: false, error: 'Nombre de respaldo inválido' };
  }
  const backupPath = join(config.backupDir, backupName);
  const manifestPath = join(backupPath, MANIFEST_FILE);
  if (!existsSync(manifestPath)) {
    return { success: false, error: `Manifiesto no encontrado: ${backupName}` };
  }

  try {
    const manifest = readManifest(manifestPath);
    const { errors } = verifyContents(backupPath, manifest);
    if (errors.length) {
      return { success: false, error: errors.join('; '), manifest };
    }
    return { success: true, manifest };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function restorePgBackup(
  config: PgBackupConfig,
  backupName: string
): Promise<{ success: boolean; error?: string }> {
  const validation = validatePgBackup(config, backupName);
  if (!validation.success || !validation.manifest) {
    return { success: false, error: validation.error ?? 'Respaldo inválido' };
  }

  const manifest = validation.manifest;
  const backupPath = join(config.backupDir, backupName);
  const { contents } = verifyContents(backupPath, manifest);

  const pool = getPgPool();
  const client = await pool.connect();
  let inTransaction = false;

  try {
    const { rows: migrationRows } = await client.query<{ name: string }>(
      'SELECT name FROM schema_migrations'
    );
    const applied = new Set(migrationRows.map((row) => row.name));
    const missingMigrations = manifest.migrations.filter((name) => !applied.has(name));
    if (missingMigrations.length) {
      throw new Error(
        `El destino no tiene aplicadas las migraciones: ${missingMigrations.join(', ')}. Ejecute migrate:pg.`
      );
    }

    console.log(`[RESTORE-PG] Restaurando ${manifest.tables.length} tablas...`);
    await client.query('BEGIN');
    inTransaction = true;
    await client.query(`TRUNCATE TABLE ${manifest.order.map(quoteIdent).join(', ')} CASCADE`);

    for (const table of manifest.order) {
      const text = contents.get(table);
      if (text === undefined) throw new Error(`${table}: contenido ausente`);
      const rows = text
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      if (!rows.length) continue;

      const columns = Object.keys(rows[0]);
      const batchSize = Math.max(1, Math.floor(BATCH_PARAM_LIMIT / columns.length));
      for (let start = 0; start < rows.length; start += batchSize) {
        const batch = rows.slice(start, start + batchSize);
        const valuesSql = batch.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
        const params = batch.flatMap((row) => columns.map((column) => row[column] ?? null));
        const sql = `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(', ')}) VALUES ${valuesSql}`;
        await client.query(toPlaceholders(sql), params);
      }
    }

    console.log('[RESTORE-PG] Verificando conteos...');
    const mismatches: string[] = [];
    for (const table of manifest.tables) {
      const result = await client.query<{ c: string }>(
        `SELECT COUNT(*) AS c FROM ${quoteIdent(table.name)}`
      );
      const actual = Number(result.rows[0]?.c ?? 0);
      if (actual !== table.rows) {
        mismatches.push(`${table.name}: esperadas ${table.rows}, restauradas ${actual}`);
      }
    }
    if (mismatches.length) throw new Error(`Conteos no coinciden: ${mismatches.join('; ')}`);

    await client.query('COMMIT');
    inTransaction = false;

    if (manifest.includes_uploads && existsSync(join(backupPath, 'uploads'))) {
      console.log('[RESTORE-PG] Restaurando archivos subidos...');
      if (existsSync(config.uploadsDir))
        rmSync(config.uploadsDir, { recursive: true, force: true });
      mkdirSync(config.uploadsDir, { recursive: true });
      cpSync(join(backupPath, 'uploads'), config.uploadsDir, { recursive: true });
    }

    console.log('[RESTORE-PG] Restauración completada.');
    return { success: true };
  } catch (error) {
    if (inTransaction) await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : String(error);
    console.error('[RESTORE-PG] Error:', message);
    return { success: false, error: message };
  } finally {
    client.release();
  }
}
