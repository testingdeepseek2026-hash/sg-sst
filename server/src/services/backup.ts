import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { resolveDbPath } from '../lib/paths.js';

/**
 * Configuración de respaldos
 */
export interface BackupConfig {
  dbPath: string;
  uploadsDir: string;
  backupDir: string;
  retentionDays: number;
  timezone: string;
}

/**
 * Crea un respaldo de la base de datos SQLite y archivos subidos
 * Usa sqlite3 .backup para copia consistente (requiere sqlite3 en PATH)
 */
export function createBackup(config: BackupConfig): {
  success: boolean;
  file?: string;
  error?: string;
} {
  try {
    // Asegurar directorio de respaldos
    if (!existsSync(config.backupDir)) {
      mkdirSync(config.backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `sg-sst-backup-${timestamp}`;
    const backupPath = join(config.backupDir, backupName);
    mkdirSync(backupPath, { recursive: true });

    const dbBackupPath = join(backupPath, 'sg-sst.db');
    const uploadsBackupPath = join(backupPath, 'uploads');

    // 1. Backup base de datos usando sqlite3 .backup (consistente)
    try {
      execSync(`sqlite3 "${config.dbPath}" ".backup '${dbBackupPath}'"`, { stdio: 'ignore' });
    } catch {
      // Fallback: copiar archivo directamente (requiere BD no en uso intensivo)
      copyFileSync(config.dbPath, dbBackupPath);
    }

    // 2. Backup archivos subidos
    if (existsSync(config.uploadsDir)) {
      execSync(`cp -r "${config.uploadsDir}" "${uploadsBackupPath}"`, { stdio: 'ignore' });
    } else {
      mkdirSync(uploadsBackupPath, { recursive: true });
    }

    // 3. Generar manifiesto
    const tables = execSync(`sqlite3 "${dbBackupPath}" ".tables"`, { encoding: 'utf8' })
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    const manifest = {
      backup_name: backupName,
      created_at: new Date().toISOString(),
      version: '1.0.0',
      database: 'sg-sst.db',
      includes_uploads: existsSync(config.uploadsDir),
      tables,
      retention_days: config.retentionDays,
    };

    const { writeFileSync } = require('node:fs');
    writeFileSync(join(backupPath, 'MANIFEST.json'), JSON.stringify(manifest, null, 2), 'utf8');

    // 4. Verificar integridad
    const integrity = execSync(`sqlite3 "${dbBackupPath}" "PRAGMA integrity_check;"`, {
      encoding: 'utf8',
    }).trim();
    if (integrity !== 'ok') {
      throw new Error(`Integridad fallida: ${integrity}`);
    }

    // 5. Comprimir
    const zipPath = `${backupPath}.zip`;
    execSync(`cd "${config.backupDir}" && zip -r "${backupName}.zip" "${backupName}"`, {
      stdio: 'ignore',
    });

    // Limpiar directorio temporal
    rmSync(backupPath, { recursive: true, force: true });

    return { success: true, file: zipPath };
  } catch (err: any) {
    console.error('[BACKUP] Error creando respaldo:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Aplica política de retención: elimina backups más antiguos que retentionDays
 */
export function applyRetention(config: BackupConfig): { deleted: number; errors: string[] } {
  const errors: string[] = [];
  let deleted = 0;

  if (!existsSync(config.backupDir)) {
    return { deleted: 0, errors: [] };
  }

  const cutoff = Date.now() - config.retentionDays * 24 * 60 * 60 * 1000;

  for (const file of readdirSync(config.backupDir)) {
    if (!file.endsWith('.zip')) continue;
    const filePath = join(config.backupDir, file);
    try {
      const stats = statSync(filePath);
      if (stats.mtimeMs < cutoff) {
        rmSync(filePath);
        deleted++;
      }
    } catch (err: any) {
      errors.push(`${file}: ${err.message}`);
    }
  }

  return { deleted, errors };
}

/**
 * Ejecuta respaldo completo con retención
 */
export function runBackup(config: BackupConfig): {
  success: boolean;
  file?: string;
  deleted?: number;
  error?: string;
} {
  console.log('[BACKUP] Iniciando respaldo programado...');

  const backupResult = createBackup(config);
  if (!backupResult.success) {
    return { success: false, error: backupResult.error };
  }

  console.log(`[BACKUP] Respaldo creado: ${backupResult.file}`);

  const retentionResult = applyRetention(config);
  console.log(`[BACKUP] Retención aplicada: ${retentionResult.deleted} archivos eliminados`);
  if (retentionResult.errors.length) {
    console.warn('[BACKUP] Errores en retención:', retentionResult.errors);
  }

  return { success: true, file: backupResult.file, deleted: retentionResult.deleted };
}

/**
 * Configuración por defecto desde variables de entorno
 */
export function getBackupConfigFromEnv(): BackupConfig {
  const dbPath = resolveDbPath();
  const uploadsDir = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
  const backupDir = process.env.BACKUP_DIR ?? join(process.cwd(), 'backups');
  const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS ?? '30', 10);
  const timezone = process.env.BACKUP_TIMEZONE ?? 'America/Bogota';

  return { dbPath, uploadsDir, backupDir, retentionDays, timezone };
}
