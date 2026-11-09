#!/usr/bin/env node
/**
 * Script de respaldo automático SG-SST
 * Respalda la base de datos SQLite y la carpeta uploads
 * Uso: node backup.js [--retention-days=N]
 * 
 * Configuración via variables de entorno:
 * - SG_SST_DATA_DIR: Directorio de datos (default: ./data)
 * - BACKUP_DIR: Directorio de respaldos (default: ./backups)
 * - BACKUP_RETENTION_DAYS: Días a retener (default: 30)
 * - BACKUP_COMPRESS: Comprimir con gzip (default: true)
 */

import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuración
const DATA_DIR = process.env.SG_SST_DATA_DIR ?? join(__dirname, '..', 'data');
const BACKUP_DIR = process.env.BACKUP_DIR ?? join(__dirname, '..', 'backups');
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS ?? '30', 10);
const COMPRESS = process.env.BACKUP_COMPRESS !== 'false';

const DB_FILE = 'sg-sst.db';
const UPLOADS_DIR = join(process.cwd(), 'uploads');

function log(msg: string) {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${timestamp}] ${msg}`);
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

async function backupDatabase(): Promise<string | null> {
  const dbPath = join(DATA_DIR, DB_FILE);
  if (!existsSync(dbPath)) {
    log(`⚠️ Base de datos no encontrada en ${dbPath}`);
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupName = `sg-sst-db-${timestamp}.sqlite${COMPRESS ? '.gz' : ''}`;
  const backupPath = join(BACKUP_DIR, backupName);

  if (COMPRESS) {
    await compressFile(dbPath, backupPath);
  } else {
    copyFileSync(dbPath, backupPath);
  }

  const stats = statSync(backupPath);
  log(`✅ Base de datos respaldada: ${backupName} (${formatBytes(stats.size)})`);
  return backupPath;
}

async function backupUploads(): Promise<string | null> {
  if (!existsSync(UPLOADS_DIR)) {
    log('⚠️ Carpeta uploads no existe, omitiendo...');
    return null;
  }

  const files = readdirSync(UPLOADS_DIR);
  if (files.length === 0) {
    log('ℹ️ Carpeta uploads vacía, omitiendo...');
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupName = `sg-sst-uploads-${timestamp}.tar${COMPRESS ? '.gz' : ''}`;
  const backupPath = join(BACKUP_DIR, backupName);

  // Usar tar para crear archivo comprimido
  const { execSync } = await import('node:child_process');
  const tarCmd = COMPRESS
    ? `tar -czf "${backupPath}" -C "${dirname(UPLOADS_DIR)}" "${dirname(UPLOADS_DIR).split('/').pop()}"`
    : `tar -cf "${backupPath}" -C "${dirname(UPLOADS_DIR)}" "${dirname(UPLOADS_DIR).split('/').pop()}"`;
  
  try {
    execSync(tarCmd, { stdio: 'ignore' });
    const stats = statSync(backupPath);
    log(`✅ Uploads respaldados: ${backupName} (${formatBytes(stats.size)})`);
    return backupPath;
  } catch (err) {
    log(`❌ Error respaldando uploads: ${err}`);
    return null;
  }
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
    log(`🗑️ Limpieza: ${deleted} respaldos antiguos eliminados (${formatBytes(freed)} liberados)`);
  } else {
    log('ℹ️ No hay respaldos antiguos para limpiar');
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

  log('\n📦 Respaldos existentes:');
  for (const f of files) {
    log(`  ${f.name}  ${formatBytes(f.size)}  ${f.mtime.toLocaleString('es-CO')}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const showList = args.includes('--list');
  const retentionArg = args.find((a) => a.startsWith('--retention-days='));
  const retentionDays = retentionArg ? parseInt(retentionArg.split('=')[1], 10) : RETENTION_DAYS;

  log('🚀 Iniciando respaldo SG-SST');
  log(`📂 Directorio datos: ${DATA_DIR}`);
  log(`📦 Directorio respaldos: ${BACKUP_DIR}`);
  log(`🗓️ Retención: ${retentionDays} días`);
  log(`🗜️ Compresión: ${COMPRESS ? 'sí (gzip)' : 'no'}`);

  // Crear directorio de respaldos
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
    log(`📁 Directorio de respaldos creado: ${BACKUP_DIR}`);
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
  log(`✅ Respaldo completado en ${elapsed}s`);

  if (!dbBackup && !uploadsBackup) {
    log('⚠️ No se generaron respaldos (verificar rutas)');
    process.exit(1);
  }
}

main().catch((err) => {
  log(`❌ Error fatal: ${err.message}`);
  process.exit(1);
});