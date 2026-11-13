import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { encrypt, tryDecrypt } from '../lib/crypto.js';
import { closePgPool, getPgPool, toPlaceholders } from '../lib/db-pg.js';
import { REPO_ROOT } from '../lib/env.js';
import { getForeignKeyEdges, orderTablesByDependencies, quoteIdent } from '../lib/pg-schema.js';

import type { PoolClient } from 'pg';

/**
 * ETL SQLite -> PostgreSQL (Neon), Fase N4.
 *
 * - Por defecto es una simulación (dry-run): solo valida esquema, cifrado y
 *   reporta conteos del origen.
 * - `--apply` escribe en el destino dentro de una única transacción.
 * - `--truncate` vacía las tablas destino antes de copiar (requerido si ya
 *   tienen filas).
 * - `--url-env DATABASE_URL_DEV` selecciona la variable de entorno de destino
 *   sin imprimir credenciales.
 *
 * Los campos sensibles de trabajadores (exámenes, certificados y EPP) se
 * cifran en destino con ENCRYPTION_SECRET. Si se detecta un cifrado que no se
 * puede descifrar con la clave actual, se aborta para no duplicar el cifrado.
 */

interface Options {
  apply: boolean;
  truncate: boolean;
  sqlitePath: string;
  urlEnv: string;
  sampleSize: number;
}

const SENSITIVE_TABLE_FIELDS: Record<string, string[]> = {
  worker_exams: [
    'restricciones',
    'archivo_url',
    'notas',
    'diagnostico',
    'tratamiento',
    'medico',
    'entidad',
  ],
  worker_certs: ['archivo_url', 'notas', 'entidad'],
  worker_epp: ['firma_url', 'notas'],
};

const BATCH_PARAM_LIMIT = 30_000;

function printHelp(): void {
  console.log(`
Uso: pnpm --dir server run etl:pg -- [opciones]

Opciones:
  --apply                 Escribe en PostgreSQL (sin esto solo simula).
  --truncate              Vacía las tablas destino antes de copiar.
  --sqlite <ruta>         Archivo SQLite de origen (default: data/sg-sst.db).
  --url-env <nombre>      Variable con la cadena destino (default: DATABASE_URL).
  --sample <n>            Filas a comparar campo a campo (default: 5, 0 = omitir).
  --help                  Muestra esta ayuda.

Seguridad:
  - Use primero el branch de desarrollo: --url-env DATABASE_URL_DEV.
  - Producción solo con aprobación explícita de la empresa.
`);
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  const valueOf = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };

  const urlEnv = valueOf('--url-env') ?? 'DATABASE_URL';
  if (!/^[A-Z0-9_]+$/.test(urlEnv)) {
    throw new Error(`Nombre de variable inválido: ${urlEnv}`);
  }

  const sampleRaw = valueOf('--sample');
  const sampleSize = sampleRaw === undefined ? 5 : Number(sampleRaw);
  if (!Number.isInteger(sampleSize) || sampleSize < 0) {
    throw new Error('--sample debe ser un entero mayor o igual a 0');
  }

  return {
    apply: args.includes('--apply'),
    truncate: args.includes('--truncate'),
    sqlitePath: path.resolve(valueOf('--sqlite') ?? path.join(REPO_ROOT, 'data', 'sg-sst.db')),
    urlEnv,
    sampleSize,
  };
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '\u0000NULL';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64');
  return String(value);
}

function looksLikeCiphertext(value: string): boolean {
  const compact = value.replace(/\s+/g, '');
  return (
    compact.length >= 40 &&
    compact.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(compact) &&
    tryDecrypt(compact) === null
  );
}

async function tableColumns(client: PoolClient): Promise<Map<string, Set<string>>> {
  const { rows } = await client.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'`
  );
  const columns = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!columns.has(row.table_name)) columns.set(row.table_name, new Set());
    columns.get(row.table_name)!.add(row.column_name);
  }
  return columns;
}

function sourceColumns(db: DatabaseSync, table: string): string[] {
  const info = db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all() as Array<{
    name: string;
  }>;
  return info.map((column) => column.name);
}

function sensitiveFieldsFor(table: string, columns: string[]): Set<string> {
  const allowed = new Set(columns);
  return new Set((SENSITIVE_TABLE_FIELDS[table] ?? []).filter((field) => allowed.has(field)));
}

function secureRow(
  table: string,
  row: Record<string, unknown>,
  fields: Set<string>
): { row: Record<string, unknown>; encrypted: number; plaintext: number } {
  const secured = { ...row };
  let encrypted = 0;
  let plaintext = 0;

  for (const field of fields) {
    const value = secured[field];
    if (typeof value !== 'string' || value === '') continue;
    if (tryDecrypt(value) !== null) continue;
    if (looksLikeCiphertext(value)) {
      throw new Error(
        `${table}.${field}: valor cifrado ilegible. Verifique que ENCRYPTION_SECRET sea la misma del origen.`
      );
    }
    secured[field] = encrypt(value);
    encrypted++;
    plaintext++;
  }

  return { row: secured, encrypted, plaintext };
}

function canonicalValue(
  table: string,
  field: string,
  value: unknown,
  sensitive: Set<string>
): string {
  if (sensitive.has(field) && typeof value === 'string' && value !== '') {
    const decrypted = tryDecrypt(value);
    if (decrypted !== null) return decrypted;
  }
  return normalizeValue(value);
}

async function main(): Promise<void> {
  const options = parseArgs();

  const connectionString = process.env[options.urlEnv];
  if (!connectionString) {
    throw new Error(`La variable ${options.urlEnv} no está definida en el .env de la raíz.`);
  }
  process.env.DATABASE_URL = connectionString;

  if (!fs.existsSync(options.sqlitePath)) {
    throw new Error(`No se encontró la base SQLite: ${options.sqlitePath}`);
  }

  const db = new DatabaseSync(options.sqlitePath, { readOnly: true });
  const pool = getPgPool();
  const client = await pool.connect();
  let inTransaction = false;

  console.log(`[ETL] Origen SQLite: ${path.relative(REPO_ROOT, options.sqlitePath)}`);
  console.log(`[ETL] Destino: PostgreSQL (${options.apply ? 'ESCRITURA' : 'simulación'})`);

  try {
    const sourceTables = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .all() as Array<{ name: string }>
    ).map((row) => row.name);

    const { rows: pgTableRows } = await client.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    const pgTables = new Set(
      pgTableRows.map((row) => row.table_name).filter((name) => name !== 'schema_migrations')
    );

    const missingInPg = sourceTables.filter((name) => !pgTables.has(name));
    if (missingInPg.length) {
      throw new Error(`Tablas del origen sin equivalente en PostgreSQL: ${missingInPg.join(', ')}`);
    }

    const tables = sourceTables.filter((name) => pgTables.has(name)).sort();
    const pgColumns = await tableColumns(client);

    const columnMap = new Map<string, string[]>();
    for (const table of tables) {
      const source = sourceColumns(db, table);
      const target = pgColumns.get(table) ?? new Set<string>();
      const common = source.filter((column) => target.has(column));
      const missingInSource = [...target].filter((column) => !source.includes(column));
      const missingInTarget = source.filter((column) => !target.has(column));

      if (missingInTarget.length) {
        console.warn(
          `[ETL] ${table}: columnas ignoradas (no existen en PostgreSQL): ${missingInTarget.join(', ')}`
        );
      }
      if (missingInSource.length) {
        console.warn(
          `[ETL] ${table}: columnas sin origen (se usan defaults de PostgreSQL): ${missingInSource.join(', ')}`
        );
      }
      if (!common.length) {
        throw new Error(`${table}: no hay columnas comunes entre SQLite y PostgreSQL`);
      }
      columnMap.set(table, common);
    }

    const relations = await getForeignKeyEdges(client);
    const ordered = orderTablesByDependencies(tables, relations);

    console.log(`[ETL] Tablas a copiar: ${ordered.length}`);
    console.log(`[ETL] Orden por dependencias: ${ordered.join(' → ')}`);

    const sourceCounts = new Map<string, number>();
    let totalRows = 0;
    for (const table of ordered) {
      const row = db.prepare(`SELECT COUNT(*) AS c FROM ${quoteIdent(table)}`).get() as {
        c: number;
      };
      sourceCounts.set(table, Number(row.c));
      totalRows += Number(row.c);
    }
    console.log(`[ETL] Filas de origen: ${totalRows}`);

    for (const table of ordered) {
      const fields = sensitiveFieldsFor(table, columnMap.get(table) ?? []);
      if (!fields.size) continue;
      let encrypted = 0;
      let plaintext = 0;
      const rows = db.prepare(`SELECT * FROM ${quoteIdent(table)}`).all() as Array<
        Record<string, unknown>
      >;
      for (const row of rows) {
        for (const field of fields) {
          const value = row[field];
          if (typeof value !== 'string' || value === '') continue;
          if (tryDecrypt(value) !== null) encrypted++;
          else if (looksLikeCiphertext(value)) {
            throw new Error(
              `${table}.${field}: cifrado ilegible. ENCRYPTION_SECRET no coincide con la del origen.`
            );
          } else plaintext++;
        }
      }
      console.log(
        `[ETL] ${table}: sensibles ya cifrados ${encrypted}, en texto plano a cifrar ${plaintext}`
      );
    }

    if (!options.apply) {
      console.log('\n[ETL] Simulación sin cambios. Detalle por tabla:');
      for (const table of ordered) {
        const columns = columnMap.get(table) ?? [];
        console.log(`  - ${table}: ${sourceCounts.get(table)} filas, ${columns.length} columnas`);
      }
      console.log('\n[ETL] Para escribir use --apply (y --truncate si el destino ya tiene datos).');
      return;
    }

    const nonEmpty: string[] = [];
    for (const table of ordered) {
      const row = await client.query<{ c: string }>(
        `SELECT COUNT(*) AS c FROM ${quoteIdent(table)}`
      );
      if (Number(row.rows[0]?.c ?? 0) > 0) nonEmpty.push(table);
    }
    if (nonEmpty.length && !options.truncate) {
      throw new Error(
        `El destino ya tiene filas en: ${nonEmpty.join(', ')}. Use --truncate para reemplazar el contenido.`
      );
    }

    await client.query('BEGIN');
    inTransaction = true;

    if (options.truncate) {
      console.log('[ETL] Vaciando tablas destino (TRUNCATE ... CASCADE)...');
      await client.query(`TRUNCATE TABLE ${ordered.map(quoteIdent).join(', ')} CASCADE`);
    }

    for (const table of ordered) {
      const columns = columnMap.get(table) ?? [];
      const fields = sensitiveFieldsFor(table, columns);
      const sourceRows = db.prepare(`SELECT * FROM ${quoteIdent(table)}`).all() as Array<
        Record<string, unknown>
      >;
      const batchSize = Math.max(1, Math.floor(BATCH_PARAM_LIMIT / columns.length));
      let encryptedFields = 0;

      for (let start = 0; start < sourceRows.length; start += batchSize) {
        const batch = sourceRows.slice(start, start + batchSize).map((row) => {
          const secured = secureRow(table, row, fields);
          encryptedFields += secured.encrypted;
          return secured.row;
        });

        const valuesSql = batch.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
        const params = batch.flatMap((row) => columns.map((column) => row[column] ?? null));
        const sql = `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(', ')}) VALUES ${valuesSql}`;
        await client.query(toPlaceholders(sql), params);
      }

      console.log(
        `[ETL] ${table}: ${sourceRows.length} filas copiadas${
          encryptedFields ? `, ${encryptedFields} campos cifrados` : ''
        }`
      );
    }

    console.log('[ETL] Verificando conteos y muestras...');
    const mismatches: string[] = [];

    for (const table of ordered) {
      const columns = columnMap.get(table) ?? [];
      const fields = sensitiveFieldsFor(table, columns);
      const expected = sourceCounts.get(table) ?? 0;
      const result = await client.query<{ c: string }>(
        `SELECT COUNT(*) AS c FROM ${quoteIdent(table)}`
      );
      const actual = Number(result.rows[0]?.c ?? 0);
      if (expected !== actual) {
        mismatches.push(`${table}: origen ${expected}, destino ${actual}`);
        continue;
      }

      const hasId = columns.includes('id');
      if (!hasId || options.sampleSize === 0 || expected === 0) continue;

      const samples = db
        .prepare(`SELECT * FROM ${quoteIdent(table)} ORDER BY id LIMIT ?`)
        .all(options.sampleSize) as Array<Record<string, unknown>>;

      for (const sourceRow of samples) {
        const id = sourceRow.id;
        const targetResult = await client.query(
          `SELECT * FROM ${quoteIdent(table)} WHERE id = $1`,
          [id]
        );
        const targetRow = targetResult.rows[0] as Record<string, unknown> | undefined;
        if (!targetRow) {
          mismatches.push(`${table} id=${String(id)}: no existe en destino`);
          continue;
        }
        for (const column of columns) {
          const sourceValue = canonicalValue(table, column, sourceRow[column], fields);
          const targetValue = canonicalValue(table, column, targetRow[column], fields);
          if (sourceValue !== targetValue) {
            mismatches.push(
              `${table} id=${String(id)} campo=${column}: origen=${sourceValue.slice(0, 60)} destino=${targetValue.slice(0, 60)}`
            );
          }
        }
      }
    }

    if (mismatches.length) {
      throw new Error(`Verificación fallida:\n${mismatches.join('\n')}`);
    }

    await client.query('COMMIT');
    inTransaction = false;
    console.log('[ETL] Verificación OK: conteos y muestras coinciden.');
    console.log(`[ETL] Completado: ${totalRows} filas en ${ordered.length} tablas.`);
  } catch (error) {
    if (inTransaction) {
      await client.query('ROLLBACK');
      inTransaction = false;
    }
    throw error;
  } finally {
    client.release();
    db.close();
    await closePgPool();
  }
}

main().catch((error) => {
  console.error('[ETL] Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
