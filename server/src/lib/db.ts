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
