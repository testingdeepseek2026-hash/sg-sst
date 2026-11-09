import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../tests/setup.js';
import { runMigrations } from '../../src/lib/db.js';
import { seedAll } from '../../src/seed/index.js';

describe('Migraciones y datos semilla', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it('crea las tablas principales de los módulos del sistema', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all() as { name: string }[];
    const tableNames = new Set(tables.map(({ name }) => name));

    for (const expected of [
      'companies', 'users', 'audit_logs', 'roles', 'workers', 'consents',
      'worker_exams', 'worker_certs', 'worker_epp', 'policies', 'objectives',
      'hazard_catalog', 'hazard_assessments', 'standards', 'standard_assessments',
      'annual_plan', 'training_schedule', 'trainings', 'training_attendance',
      'inspections', 'altura_permits', 'ats', 'incidents', 'emergency_plans',
      'drills', 'documents', 'corrective_actions', 'audits', 'audit_findings', 'contractors',
      'alerts', 'indicators', 'incident_actions'
    ]) {
      expect(tableNames).toContain(expected);
    }
  });

  it('crea los índices definidos para consultas frecuentes', () => {
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
    ).all() as { name: string }[];
    const indexNames = new Set(indexes.map(({ name }) => name));

    for (const expected of [
      'idx_worker_exams_worker',
      'idx_worker_certs_worker',
      'idx_worker_epp_worker',
      'idx_hazard_assessment_cargo',
      'idx_incidents_fecha',
      'idx_alerts_venc',
      'idx_audit_logs_fecha'
    ]) {
      expect(indexNames).toContain(expected);
    }
  });

  it('habilita claves foráneas y permite ejecutar la migración repetidamente', () => {
    expect(db.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 });
    expect(() => runMigrations(db)).not.toThrow();
    expect(() => runMigrations(db)).not.toThrow();
  });

  it('agrega columnas de alertas sin borrar datos de una base existente', () => {
    db.exec(`
      DROP TABLE alerts;
      CREATE TABLE alerts (
        id TEXT PRIMARY KEY,
        entidad TEXT NOT NULL,
        entidad_id TEXT NOT NULL,
        tipo TEXT NOT NULL,
        fecha_vencimiento TEXT NOT NULL,
        enviado INTEGER NOT NULL DEFAULT 0,
        canal TEXT NOT NULL DEFAULT 'email',
        creado_en TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO alerts (id, entidad, entidad_id, tipo, fecha_vencimiento)
      VALUES ('alert-existing', 'worker_exams', 'exam-existing', 'examen', '2026-12-01');
    `);

    runMigrations(db);

    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get('alert-existing') as {
      prioridad: string; enviado_en: string | null;
    };
    expect(alert).toMatchObject({ prioridad: 'media', enviado_en: null });
  });

  it('rechaza exámenes asociados a trabajadores inexistentes', () => {
    expect(() => db.prepare(
      'INSERT INTO worker_exams (id, worker_id, tipo, fecha) VALUES (?, ?, ?, ?)'
    ).run('exam-test', 'missing-worker', 'ingreso', '2026-01-15')).toThrow();
  });

  it('siembra empresa, usuarios, rol, estándares y catálogo de peligros', async () => {
    await seedAll(db);

    const company = db.prepare('SELECT * FROM companies LIMIT 1').get() as {
      razon_social: string; clase_riesgo: string;
    };
    expect(company.razon_social).toBe('Micro Instalaciones Electrónicas SAS');
    expect(company.clase_riesgo).toBe('IV');

    const admin = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@sg-sst.local') as {
      rol: string;
    };
    expect(admin.rol).toBe('administrador');

    const role = db.prepare('SELECT * FROM roles WHERE nombre = ?').get('Responsable SG-SST') as {
      curso_50h: number; licencia_sst_numero: string | null;
    };
    expect(role.curso_50h).toBe(1);
    expect(role.licencia_sst_numero).toBeNull();

    const standards = db.prepare('SELECT set_aplicable, COUNT(*) AS count FROM standards GROUP BY set_aplicable').all() as {
      set_aplicable: string; count: number;
    }[];
    expect(standards).toEqual(expect.arrayContaining([
      { set_aplicable: '7', count: 7 },
      { set_aplicable: '32', count: 32 }
    ]));

    const hazards = db.prepare('SELECT COUNT(*) AS count FROM hazard_catalog WHERE activo = 1').get() as {
      count: number;
    };
    expect(hazards.count).toBeGreaterThan(20);
  });

  it('es idempotente al ejecutarse más de una vez', async () => {
    await seedAll(db);
    const before = db.prepare(
      'SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM standards) AS standards, (SELECT COUNT(*) FROM hazard_catalog) AS hazards'
    ).get();

    await seedAll(db);
    const after = db.prepare(
      'SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM standards) AS standards, (SELECT COUNT(*) FROM hazard_catalog) AS hazards'
    ).get();

    expect(after).toEqual(before);
  });
});
