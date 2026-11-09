import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = process.env.SG_SST_DATA_DIR ?? path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'sg-sst.db');

export function openDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

export function runMigrations(db: DatabaseSync) {
  const migrationPaths = [
    path.join(import.meta.dirname, 'migrations', '001_initial.sql'),
    path.join(import.meta.dirname, '..', 'migrations', '001_initial.sql'),
  ];
  const migrationPath = migrationPaths.find((candidate) => fs.existsSync(candidate));
  if (!migrationPath) {
    throw new Error(`No se encontró la migración 001_initial.sql en: ${migrationPaths.join(', ')}`);
  }
  const sql = fs.readFileSync(migrationPath, 'utf8');
  db.exec(sql);

  // Migración incremental: agregar columnas SMTP a companies si no existen
  const companyColumns = db.prepare('PRAGMA table_info(companies)').all() as { name: string }[];
  if (!companyColumns.some(({ name }) => name === 'smtp_host')) {
    db.exec('ALTER TABLE companies ADD COLUMN smtp_host TEXT');
  }
  if (!companyColumns.some(({ name }) => name === 'smtp_port')) {
    db.exec('ALTER TABLE companies ADD COLUMN smtp_port INTEGER');
  }
  if (!companyColumns.some(({ name }) => name === 'smtp_user')) {
    db.exec('ALTER TABLE companies ADD COLUMN smtp_user TEXT');
  }
  if (!companyColumns.some(({ name }) => name === 'smtp_pass')) {
    db.exec('ALTER TABLE companies ADD COLUMN smtp_pass TEXT');
  }
  if (!companyColumns.some(({ name }) => name === 'smtp_from')) {
    db.exec('ALTER TABLE companies ADD COLUMN smtp_from TEXT');
  }
  if (!companyColumns.some(({ name }) => name === 'alerts_enabled')) {
    db.exec('ALTER TABLE companies ADD COLUMN alerts_enabled INTEGER NOT NULL DEFAULT 0');
  }

  // Migración incremental: columnas de trazabilidad en contractors (servicio usa creado_en/actualizado_en)
  const contractorColumns = db.prepare('PRAGMA table_info(contractors)').all() as {
    name: string;
  }[];
  if (!contractorColumns.some(({ name }) => name === 'creado_en')) {
    db.exec('ALTER TABLE contractors ADD COLUMN creado_en TEXT');
  }
  if (!contractorColumns.some(({ name }) => name === 'actualizado_en')) {
    db.exec('ALTER TABLE contractors ADD COLUMN actualizado_en TEXT');
  }

  const alertColumns = db.prepare('PRAGMA table_info(alerts)').all() as { name: string }[];
  if (!alertColumns.some(({ name }) => name === 'prioridad')) {
    db.exec(
      "ALTER TABLE alerts ADD COLUMN prioridad TEXT NOT NULL DEFAULT 'media' CHECK (prioridad IN ('critica','alta','media'))"
    );
  }
  if (!alertColumns.some(({ name }) => name === 'enviado_en')) {
    db.exec('ALTER TABLE alerts ADD COLUMN enviado_en TEXT');
  }
}

export { DATA_DIR, DB_PATH };
