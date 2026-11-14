import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { resolveDbPath } from './paths.js';

// `paths.ts` carga el .env de la raíz antes de resolver la ruta, así que
// DB_PATH y SG_SST_DATA_DIR se aplican aunque el proceso corra desde server/.
const DB_PATH = resolveDbPath();
const DATA_DIR = path.dirname(DB_PATH);

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

  // Migración incremental: evidencias del permiso de alturas (fotos y firmas)
  const permitColumns = db.prepare('PRAGMA table_info(altura_permits)').all() as {
    name: string;
  }[];
  if (!permitColumns.some(({ name }) => name === 'archivo_fotos')) {
    db.exec('ALTER TABLE altura_permits ADD COLUMN archivo_fotos TEXT');
  }
  if (!permitColumns.some(({ name }) => name === 'firma_solicitante_url')) {
    db.exec('ALTER TABLE altura_permits ADD COLUMN firma_solicitante_url TEXT');
  }
  if (!permitColumns.some(({ name }) => name === 'firma_responsable_url')) {
    db.exec('ALTER TABLE altura_permits ADD COLUMN firma_responsable_url TEXT');
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

  // Migración incremental: fórmula y frecuencia de indicadores
  const indicatorColumns = db.prepare('PRAGMA table_info(indicators)').all() as { name: string }[];
  if (!indicatorColumns.some(({ name }) => name === 'formula')) {
    db.exec('ALTER TABLE indicators ADD COLUMN formula TEXT');
  }
  if (!indicatorColumns.some(({ name }) => name === 'frecuencia')) {
    db.exec('ALTER TABLE indicators ADD COLUMN frecuencia TEXT');
  }

  // Migración incremental: Fase 2 — plan anual alineado al Excel real
  // (PL-SGSST-01): programa, evidencia esperada y cronograma mensual.
  const annualPlanColumns = db.prepare('PRAGMA table_info(annual_plan)').all() as {
    name: string;
  }[];
  if (!annualPlanColumns.some(({ name }) => name === 'programa')) {
    db.exec('ALTER TABLE annual_plan ADD COLUMN programa TEXT');
  }
  if (!annualPlanColumns.some(({ name }) => name === 'evidencia_esperada')) {
    db.exec('ALTER TABLE annual_plan ADD COLUMN evidencia_esperada TEXT');
  }
  if (!annualPlanColumns.some(({ name }) => name === 'meses')) {
    // Cronograma mensual del Excel real: JSON con los números de mes (1-12).
    db.exec('ALTER TABLE annual_plan ADD COLUMN meses TEXT');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS annual_plan_evidences (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES annual_plan(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      nombre_original TEXT NOT NULL,
      mime TEXT,
      tamano INTEGER,
      subido_por TEXT,
      creado_en TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_annual_plan_evidences_plan
      ON annual_plan_evidences(plan_id);
  `);
}

export { DATA_DIR, DB_PATH };
