import '../lib/env.js';

import { closePgPool } from '../lib/db-pg.js';
import {
  getPgBackupConfigFromEnv,
  restorePgBackup,
  validatePgBackup,
} from '../services/backup.pg.js';

function readArg(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const urlEnv = readArg('--url-env') ?? 'DATABASE_URL';
  if (!/^[A-Z0-9_]+$/.test(urlEnv)) throw new Error(`Nombre de variable inválido: ${urlEnv}`);
  const connectionString = process.env[urlEnv];
  if (!connectionString) throw new Error(`La variable ${urlEnv} no está definida.`);
  process.env.DATABASE_URL = connectionString;

  const dir = readArg('--dir');
  if (!dir) throw new Error('Indique el respaldo con --dir <nombre>');
  if (process.env.NODE_ENV === 'production' && !args.includes('--allow-production')) {
    throw new Error('En producción agregue --allow-production tras detener la API.');
  }

  const config = getPgBackupConfigFromEnv();
  const backupDir = readArg('--backup-dir');
  if (backupDir) config.backupDir = backupDir;

  const validation = validatePgBackup(config, dir);
  if (!validation.success || !validation.manifest) {
    throw new Error(validation.error ?? 'Respaldo inválido');
  }
  const manifest = validation.manifest;
  console.log(
    `[RESTORE-PG] Respaldo ${manifest.backup_name}: ${manifest.tables.length} tablas, ` +
      `${manifest.tables.reduce((sum, table) => sum + table.rows, 0)} filas.`
  );

  if (!args.includes('--apply')) {
    console.log('[RESTORE-PG] Validación OK. Simulación sin cambios; use --apply para restaurar.');
    return;
  }

  const result = await restorePgBackup(config, dir);
  if (!result.success) throw new Error(result.error ?? 'Restauración fallida');
}

main()
  .catch((error) => {
    console.error('[RESTORE-PG] Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => closePgPool());
