import '../lib/env.js';

import { closePgPool } from '../lib/db-pg.js';
import { getPgBackupConfigFromEnv, runPgBackup } from '../services/backup.pg.js';

function readArg(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const urlEnv = readArg('--url-env') ?? 'DATABASE_URL';
  if (!/^[A-Z0-9_]+$/.test(urlEnv)) throw new Error(`Nombre de variable inválido: ${urlEnv}`);
  const connectionString = process.env[urlEnv];
  if (!connectionString) throw new Error(`La variable ${urlEnv} no está definida.`);
  process.env.DATABASE_URL = connectionString;

  const config = getPgBackupConfigFromEnv();
  const backupDir = readArg('--backup-dir');
  if (backupDir) config.backupDir = backupDir;

  const result = await runPgBackup(config);
  if (!result.success) throw new Error(result.error ?? 'Respaldo fallido');
  console.log(`[BACKUP-PG] Archivo: ${result.file}`);
}

main()
  .catch((error) => {
    console.error('[BACKUP-PG] Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => closePgPool());
