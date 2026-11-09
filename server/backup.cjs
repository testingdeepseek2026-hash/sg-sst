#!/usr/bin/env node
/**
 * Script de respaldo automático SG-SST (Node.js cross-platform)
 * Respalda la base de datos SQLite y la carpeta uploads
 * Uso: node backup.cjs [--retention-days=N] [--list] [--no-compress]
 * 
 * Configuración via variables de entorno:
 * - SG_SST_DATA_DIR: Directorio de datos (default: ./data)
 * - BACKUP_DIR: Directorio de respaldos (default: ./backups)
 * - BACKUP_RETENTION_DAYS: Días a retener (default: 30)
 * - BACKUP_COMPRESS: Comprimir con gzip (default: true)
 */

import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, copyFileSync, createReadStream, createWriteStream } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { createGzip, createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuración
const DATA_DIR = process.env.SG_SST_DATA_DIR ?? join(__dirname, '..', 'data');
const BACKUP_DIR = process.env.BACKUP_DIR ?? join(__dirname, '..', 'backups');
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS ?? '30', 10);
const COMPRESS = process.env.BACKUP_COMPRESS !== 'false';

const DB_FILE = 'sg-sst.db';
const UPLOADS_DIR = join(process.cwd(), 'uploads');

function log(msg: string, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const prefix = level === 'error' ? '[ERROR]' : level === 'warn' ? '[WARN]' : '[INFO]';
  console.log(`[${timestamp}] ${prefix} ${msg}`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

async function compressFile(inputPath: string, outputPath: string): Promise<void> {
  await pipeline(
    createReadStream(inputPath),
    createGzip({ level: 6 }),
    createWriteStream(outputPath)
  );
}

async function decompressFile(inputPath: string, outputPath: string): Promise<void> {
  await pipeline(
    createReadStream(inputPath),
    createGunzip(),
    createWriteStream(outputPath)
  );
}

function createZip(dirPath: string, zipPath: string): void {
  // Usar zip command if available (cross-platform)
  try {
    execSync(`cd "${dirname(dirPath)}" && zip -r "${zipPath}" "${basename(dirPath)}"`, { stdio: 'ignore' });
  } catch {
    // Fallback: copy files manually (simplified)
    throw new Error('zip command not available');
  }
}

async function backupDatabase(): Promise<string | null> {
  const dbPath = join(DATA_DIR, DB_FILE);
  if (!existsSync(dbPath)) {
    log(`Base de datos no encontrada en ${dbPath}`, 'warn');
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const ext = COMPRESS ? '.sqlite.gz' : '.sqlite';
  const backupName = `sg-sst-db-${timestamp}${ext}`;
  const backupPath = join(BACKUP_DIR, backupName);

  if (COMPRESS) {
    await compressFile(dbPath, backupPath);
  } else {
    copyFileSync(dbPath, backupPath);
  }

  const stats = statSync(backupPath);
  log(`Base de datos respaldada: ${backupName} (${formatBytes(stats.size)})`);
  return backupPath;
}

async function backupUploads(): Promise<string | null> {
  if (!existsSync(UPLOADS_DIR)) {
    log('Carpeta uploads no existe, omitiendo...', 'warn');
    return null;
  }

  const files = readdirSync(UPLOADS_DIR, { recursive: true });
  const fileCount = files.filter(f => !statSync(join(UPLOADS_DIR, f)).isDirectory()).length;
  if (fileCount === 0) {
    log('Carpeta uploads vacía, omitiendo...');
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const ext = COMPRESS ? '.tar.gz' : '.tar';
  const backupName = `sg-sst-uploads-${timestamp}${ext}`;
  const backupPath = join(BACKUP_DIR, backupName);

  try {
    // Intentar con tar (Linux/macOS/Git Bash)
    const tarCmd = COMPRESS 
      ? `tar -czf "${backupPath}" -C "${dirname(UPLOADS_DIR)}" "${basename(UPLOADS_DIR)}"`
      : `tar -cf "${backupPath}" -C "${dirname(UPLOADS_DIR)}" "${basename(UPLOADS_DIR)}"`;
    execSync(tarCmd, { stdio: 'ignore' });
  } catch {
    try {
      // Fallback: zip (Windows con zip instalado)
      const zipPath = backupPath.replace('.tar.gz', '.zip').replace('.tar', '.zip');
      execSync(`cd "${dirname(UPLOADS_DIR)}" && zip -r "${zipPath}" "${basename(UPLOADS_DIR)}"`, { stdio: 'ignore' });
      return zipPath;
    } catch {
      log('No se pudo crear archivo de uploads (tar/zip no disponibles)', 'error');
      return null;
    }
  }

  const stats = statSync(backupPath);
  log(`Uploads respaldados: ${basename(backupPath)} (${formatBytes(stats.size)})`);
  return backupPath;
}

function cleanupOldBackups(): void {
  if (!existsSync(BACKUP_DIR)) return;

  const now = Date.now();
  const cutoff = now - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const files = readdirSync(BACKUP_DIR);

  let deleted = 0;
  let freed = 0;

  for (const file of files) {
    const filePath = join(BACKUP_DIR, file);
    const stats = statSync(filePath);
    if (stats.mtimeMs < cutoff) {
      freed += stats.size;
      unlinkSync(filePath);
      deleted++;
    }
  }

  if (deleted > 0) {
    log(`Limpieza: ${deleted} respaldos antiguos eliminados (${formatBytes(freed)} liberados)`);
  } else {
    log('No hay respaldos antiguos para limpiar');
  }
}

function listBackups(): void {
  if (!existsSync(BACKUP_DIR)) {
    log('No hay directorio de respaldos');
    return;
  }

  const files = readdirSync(BACKUP_DIR)
    .map((f) => {
      const p = join(BACKUP_DIR, f);
      const s = statSync(p);
      return { name: f, size: s.size, mtime: s.mtime };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  log('\nRespaldos existentes:');
  for (const f of files) {
    log(`  ${f.name}  ${formatBytes(f.size)}  ${f.mtime.toLocaleString('es-CO')}`);
  }
}

async function restoreDatabase(backupFile: string): Promise<void> {
  const backupPath = join(BACKUP_DIR, backupFile);
  if (!existsSync(backupPath)) {
    throw new Error(`Archivo de respaldo no encontrado: ${backupPath}`);
  }

  const dbPath = join(DATA_DIR, DB_FILE);
  const tempPath = `${dbPath}.restore.tmp`;

  log(`Restaurando base de datos desde ${backupFile}...`);
  
  if (backupFile.endsWith('.gz')) {
    await decompressFile(backupPath, tempPath);
  } else {
    copyFileSync(backupPath, tempPath);
  }

  // Verificar que el archivo restaurado es una BD SQLite válida
  const { DatabaseSync } = await import('node:sqlite');
  const testDb = new DatabaseSync(tempPath);
  testDb.exec('PRAGMA integrity_check;');
  testDb.close();

  // Backup actual antes de sobrescribir
  if (existsSync(dbPath)) {
    const currentBackup = `${dbPath}.pre-restore-${Date.now()}`;
    copyFileSync(dbPath, currentBackup);
    log(`Backup actual guardado como: ${basename(currentBackup)}`);
  }

  copyFileSync(tempPath, dbPath);
  unlinkSync(tempPath);
  log('Base de datos restaurada correctamente');
}

async function main() {
  const args = process.argv.slice(2);
  const showList = args.includes('--list') || args.includes('-l');
  const noCompress = args.includes('--no-compress');
  const compress = !noCompress && COMPRESS;
  const restoreFile = args.find(a => a.startsWith('--restore='))?.split('=')[1];
  const retentionArg = args.find((a) => a.startsWith('--retention-days='));
  const retentionDays = retentionArg ? parseInt(retentionArg.split('=')[1], 10) : RETENTION_DAYS;

  log('Iniciando respaldo SG-SST');
  log(`Directorio datos: ${DATA_DIR}`);
  log(`Directorio respaldos: ${BACKUP_DIR}`);
  log(`Retención: ${retentionDays} días`);
  log(`Compresión: ${compress ? 'sí (gzip)' : 'no'}`);

  // Crear directorio de respaldos
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
    log(`Directorio de respaldos creado: ${BACKUP_DIR}`);
  }

  if (restoreFile) {
    await restoreDatabase(restoreFile);
    return;
  }

  const startTime = Date.now();

  // Ejecutar respaldos
  const dbBackup = await backupDatabase();
  const uploadsBackup = await backupUploads();

  // Limpiar antiguos
  cleanupOldBackups();

  // Listar si se pidió
  if (showList) {
    listBackups();
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`Respaldo completado en ${elapsed}s`);

  if (!dbBackup && !uploadsBackup) {
    log('No se generaron respaldos (verificar rutas)', 'warn');
    process.exit(1);
  }
}

main().catch((err) => {
  log(`Error fatal: ${err.message}`, 'error');
  process.exit(1);
});