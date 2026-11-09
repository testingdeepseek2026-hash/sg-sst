import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, rmSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';

/**
 * Configuración de restauración
 */
export interface RestoreConfig {
  dbPath: string;
  uploadsDir: string;
  backupDir: string;
}

/**
 * Lista backups disponibles ordenados por fecha (más reciente primero)
 */
export function listBackups(config: RestoreConfig): Array<{
  file: string;
  name: string;
  created_at: string;
  size_bytes: number;
  size_mb: number;
  tables?: string[];
  includes_uploads?: boolean;
}> {
  if (!existsSync(config.backupDir)) {
    return [];
  }

  const backups: Array<{
    file: string;
    name: string;
    created_at: string;
    size_bytes: number;
    size_mb: number;
    tables?: string[];
    includes_uploads?: boolean;
  }> = [];

  for (const file of readdirSync(config.backupDir)) {
    if (!file.endsWith('.zip')) continue;
    const filePath = join(config.backupDir, file);
    try {
      const stats = statSync(filePath);
      const name = file.replace('.zip', '');

      // Intentar leer manifiesto del ZIP sin extraer completamente
      let manifest: any = null;
      try {
        // Extraer solo MANIFEST.json a temp
        const tempDir = join(config.backupDir, `.tmp-restore-${Date.now()}`);
        mkdirSync(tempDir, { recursive: true });
        execSync(`cd "${config.backupDir}" && unzip -q -o "${file}" "${name}/MANIFEST.json" -d "${tempDir}"`, { stdio: 'ignore' });
        const manifestPath = join(tempDir, name, 'MANIFEST.json');
        if (existsSync(manifestPath)) {
          manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        }
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Si falla, continuar sin manifiesto
      }

      backups.push({
        file,
        name,
        created_at: manifest?.created_at || stats.mtime.toISOString(),
        size_bytes: stats.size,
        size_mb: Math.round(stats.size / (1024 * 1024) * 100) / 100,
        tables: manifest?.tables,
        includes_uploads: manifest?.includes_uploads,
      });
    } catch {
      // Ignorar archivos problemáticos
    }
  }

  // Ordenar por fecha descendente (más reciente primero)
  return backups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Restaura un backup específico
 * ADVERTENCIA: Reemplaza la BD actual y uploads. Requiere servidor detenido.
 */
export function restoreBackup(config: RestoreConfig, backupFile: string): { success: boolean; error?: string } {
  const backupPath = join(config.backupDir, backupFile);

  if (!existsSync(backupPath)) {
    return { success: false, error: `Backup no encontrado: ${backupFile}` };
  }

  if (!backupFile.endsWith('.zip')) {
    return { success: false, error: 'El archivo debe ser .zip' };
  }

  const backupName = backupFile.replace('.zip', '');
  const tempDir = join(config.backupDir, `.tmp-restore-${Date.now()}`);

  try {
    console.log(`[RESTORE] Iniciando restauración desde ${backupFile}...`);

    // 1. Crear directorio temporal
    mkdirSync(tempDir, { recursive: true });

    // 2. Extraer ZIP
    console.log('[RESTORE] Extrayendo backup...');
    execSync(`cd "${config.backupDir}" && unzip -q -o "${backupFile}" -d "${tempDir}"`, { stdio: 'ignore' });

    const extractedDir = join(tempDir, backupName);
    if (!existsSync(extractedDir)) {
      throw new Error('Estructura de backup inválida: directorio esperado no encontrado');
    }

    // 3. Verificar integridad de la BD extraída
    const dbBackupPath = join(extractedDir, 'sg-sst.db');
    if (!existsSync(dbBackupPath)) {
      throw new Error('Backup inválido: sg-sst.db no encontrado');
    }

    console.log('[RESTORE] Verificando integridad de base de datos...');
    const integrity = execSync(`sqlite3 "${dbBackupPath}" "PRAGMA integrity_check;"`, { encoding: 'utf8' }).trim();
    if (integrity !== 'ok') {
      throw new Error(`Integridad fallida en backup: ${integrity}`);
    }

    // 4. Backup de la BD actual antes de reemplazar (por seguridad)
    const currentDbBackup = `${config.dbPath}.pre-restore-${Date.now()}`;
    console.log(`[RESTORE] Creando respaldo de BD actual: ${basename(currentDbBackup)}`);
    copyFileSync(config.dbPath, currentDbBackup);

    // 5. Detener procesos que usen la BD (en producción, el servidor debe estar detenido)
    // Nota: En entorno real, el servidor debe estar parado antes de restaurar

    // 6. Reemplazar BD
    console.log('[RESTORE] Reemplazando base de datos...');
    copyFileSync(dbBackupPath, config.dbPath);

    // 7. Restaurar uploads si existen en el backup
    const uploadsBackupPath = join(extractedDir, 'uploads');
    if (existsSync(uploadsBackupPath)) {
      console.log('[RESTORE] Restaurando archivos subidos...');
      // Eliminar uploads actuales
      if (existsSync(config.uploadsDir)) {
        rmSync(config.uploadsDir, { recursive: true, force: true });
      }
      mkdirSync(config.uploadsDir, { recursive: true });
      // Copiar desde backup
      execSync(`cp -r "${uploadsBackupPath}/." "${config.uploadsDir}/"`, { stdio: 'ignore' });
    }

    // 8. Limpiar directorio temporal
    rmSync(tempDir, { recursive: true, force: true });

    // 9. Verificar integridad post-restauración
    const postIntegrity = execSync(`sqlite3 "${config.dbPath}" "PRAGMA integrity_check;"`, { encoding: 'utf8' }).trim();
    if (postIntegrity !== 'ok') {
      throw new Error(`Integridad fallida post-restauración: ${postIntegrity}`);
    }

    console.log('[RESTORE] Restauración completada exitosamente');
    return { success: true };
  } catch (err: any) {
    // Limpiar temp en caso de error
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    console.error('[RESTORE] Error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Valida un backup sin restaurar (dry-run)
 */
export function validateBackup(config: RestoreConfig, backupFile: string): { success: boolean; error?: string; manifest?: any } {
  // Validar extensión primero
  if (!backupFile.endsWith('.zip')) {
    return { success: false, error: 'El archivo debe ser .zip' };
  }

  const backupPath = join(config.backupDir, backupFile);

  if (!existsSync(backupPath)) {
    return { success: false, error: `Backup no encontrado: ${backupFile}` };
  }

  const backupName = backupFile.replace('.zip', '');
  const tempDir = join(config.backupDir, `.tmp-validate-${Date.now()}`);

  try {
    mkdirSync(tempDir, { recursive: true });
    execSync(`cd "${config.backupDir}" && unzip -q -o "${backupFile}" -d "${tempDir}"`, { stdio: 'ignore' });

    const extractedDir = join(tempDir, backupName);
    const dbBackupPath = join(extractedDir, 'sg-sst.db');
    const manifestPath = join(extractedDir, 'MANIFEST.json');

    let manifest: any = null;
    if (existsSync(manifestPath)) {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    }

    // Verificar integridad
    if (existsSync(dbBackupPath)) {
      const integrity = execSync(`sqlite3 "${dbBackupPath}" "PRAGMA integrity_check;"`, { encoding: 'utf8' }).trim();
      if (integrity !== 'ok') {
        return { success: false, error: `Integridad fallida: ${integrity}`, manifest };
      }
    } else {
      return { success: false, error: 'sg-sst.db no encontrado en backup', manifest };
    }

    rmSync(tempDir, { recursive: true, force: true });
    return { success: true, manifest };
  } catch (err: any) {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    return { success: false, error: err.message };
  }
}

/**
 * Configuración por defecto desde variables de entorno
 */
export function getRestoreConfigFromEnv(): RestoreConfig {
  const dbPath = process.env.DB_PATH ?? join(process.cwd(), 'data', 'sg-sst.db');
  const uploadsDir = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
  const backupDir = process.env.BACKUP_DIR ?? join(process.cwd(), 'backups');

  return { dbPath, uploadsDir, backupDir };
}