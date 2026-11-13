import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import ExcelJS from 'exceljs';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import pg from 'pg';

import { createTestDb, cleanDb } from '../setup.js';
import { requireAuth } from '../../src/lib/auth.js';
import companiesRoutes from '../../src/routes/companies.js';
import usersRoutes from '../../src/routes/users.js';
import rolesRoutes from '../../src/routes/roles.js';
import workersRoutes from '../../src/routes/workers.js';
import workersItemsRoutes from '../../src/routes/workers_items.js';
import privacyRoutes from '../../src/routes/privacy.js';
import { auditLogsRoutes, actionsRoutes, auditsRoutes, documentsRoutes } from '../../src/routes/documents_actions_audits_alerts.js';
import incidentsRoutes from '../../src/routes/incidents.js';
import hazardsRoutes from '../../src/routes/hazards.js';
import standardsRoutes from '../../src/routes/standards.js';
import plansRoutes from '../../src/routes/plans.js';
import inspectionsRoutes from '../../src/routes/inspections.js';
import emergenciesRoutes from '../../src/routes/emergencies.js';
import contractorsRoutes from '../../src/routes/contractors.js';
import alertsRoutes from '../../src/routes/alerts.js';
import indicatorsRoutes from '../../src/routes/indicators.js';
import policiesRoutes from '../../src/routes/policies.js';
import exportRoutes from '../../src/routes/export.js';
import importRoutes from '../../src/routes/import.js';
import { closePgPool, exec, isPgBackend, one, runPgMigrations } from '../../src/lib/db-pg.js';
import { decrypt } from '../../src/lib/crypto.js';
import { quoteIdent } from '../../src/lib/pg-schema.js';
import {
  createPgBackup,
  restorePgBackup,
  validatePgBackup,
} from '../../src/services/backup.pg.js';
import { calcularVencimientoAlturas } from '../../src/services/workers_certs.js';

/**
 * Fases N2/N3 — prueba de integración de empresas, usuarios, roles y bitácora.
 *
 * Requiere TEST_DATABASE_URL (cadena hacia un servidor PostgreSQL de pruebas;
 * NO usar producción). La prueba crea una base temporal, aplica las
 * migraciones del proyecto y la elimina al terminar. Sin TEST_DATABASE_URL
 * la suite se omite para no depender de infraestructura en CI.
 */

    const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
    const SCRATCH_DB = 'sg_sst_pg_pilot_test';

    /** Cierra conexiones activas a la base temporal (Neon mantiene conexiones en el pooler). */
    async function terminateScratchConnections(pool: pg.Pool): Promise<void> {
      await pool.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
         WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [SCRATCH_DB]
      );
    }

describe.skipIf(!TEST_DATABASE_URL)(
  'Fases N2/N3 - Dominios base contra PostgreSQL (Neon)',
  () => {
    let app: ReturnType<typeof Fastify>;
    let adminUrl: string;
    let scratchUrl: string;
    let adminPool: pg.Pool;
    let adminCookie: string;
    let workerCookie: string;

    beforeAll(async () => {
      if (!TEST_DATABASE_URL) return;

      adminUrl = new URL(TEST_DATABASE_URL);
      adminUrl.pathname = '/postgres';
      scratchUrl = new URL(TEST_DATABASE_URL);
      scratchUrl.pathname = `/${SCRATCH_DB}`;

      // Base temporal limpia: se recrea en cada corrida.
      adminPool = new pg.Pool({ connectionString: adminUrl.href, max: 1 });
      await terminateScratchConnections(adminPool);
      await adminPool.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
      await adminPool.query(`CREATE DATABASE ${SCRATCH_DB}`);

      // Activar el backend Postgres del piloto para ESTA prueba.
      process.env.DATABASE_URL = scratchUrl.href;
      process.env.DB_BACKEND = 'pg';
      expect(isPgBackend()).toBe(true);

      const scratchPool = new pg.Pool({ connectionString: scratchUrl.href, max: 2 });
      await runPgMigrations(scratchPool);
      await scratchPool.end();

      // Autenticación, usuarios, roles y empresas funcionan contra PostgreSQL.
      app = Fastify({ logger: false });
      await app.register(cookie, { secret: 'test-secret' });
      await app.register(multipart, { limits: { fields: 50, files: 20, fileSize: 10 * 1024 * 1024 } });
      app.decorate('db', createTestDb());
      app.addHook('preHandler', requireAuth);
      await app.register(usersRoutes, { prefix: '/api' });
      await app.register(companiesRoutes, { prefix: '/api' });
      await app.register(rolesRoutes, { prefix: '/api' });
      await app.register(workersRoutes, { prefix: '/api' });
      await app.register(workersItemsRoutes, { prefix: '/api' });
      await app.register(privacyRoutes, { prefix: '/api' });
      await app.register(auditLogsRoutes, { prefix: '/api' });
      await app.register(hazardsRoutes, { prefix: '/api' });
      await app.register(standardsRoutes, { prefix: '/api' });
      await app.register(plansRoutes, { prefix: '/api' });
      await app.register(inspectionsRoutes, { prefix: '/api' });
      await app.register(emergenciesRoutes, { prefix: '/api' });
      await app.register(contractorsRoutes, { prefix: '/api' });
      await app.register(incidentsRoutes, { prefix: '/api' });
      await app.register(actionsRoutes, { prefix: '/api' });
      await app.register(auditsRoutes, { prefix: '/api' });
      await app.register(documentsRoutes, { prefix: '/api' });
      await app.register(alertsRoutes, { prefix: '/api' });
      await app.register(indicatorsRoutes, { prefix: '/api' });
      await app.register(policiesRoutes, { prefix: '/api' });
      await app.register(exportRoutes, { prefix: '/api' });
      await app.register(importRoutes, { prefix: '/api' });
      await app.ready();

      adminCookie = 'sg_sst_user=user-admin; sg_sst_email=admin@sg-sst.local';
      workerCookie = 'sg_sst_user=user-worker; sg_sst_email=worker@sg-sst.local';
    });

    beforeEach(async () => {
      if (!TEST_DATABASE_URL) return;

      // SQLite se conserva como backend predeterminado para las otras suites.
      cleanDb(app.db);

      // Datos en Postgres: se limpian las tablas de los dominios migrados.
      await closePgPool();
      const pool = new pg.Pool({ connectionString: scratchUrl.href, max: 1 });
      await pool.query(
        'TRUNCATE companies, audit_logs, roles, users, workers, hazard_catalog, hazard_assessments, standards, standard_assessments, annual_plan, training_schedule, trainings, training_attendance, inspections, altura_permits, ats, drills, emergency_plans, contractors, incidents, incident_actions, corrective_actions, audits, audit_findings, worker_exams, documents, indicators, policies, objectives, alerts, privacy_notices, arco_requests, data_processing_records, consents CASCADE'
      );
      await pool.end();

      // Los usuarios existen en PostgreSQL para autenticación, permisos y FK de auditoría.
      await exec(
        'INSERT INTO users (id, email, nombre, rol, password_hash) VALUES (?,?,?,?,?)',
        ['user-admin', 'admin@sg-sst.local', 'Administrador', 'administrador', 'test-hash']
      );
      await exec(
        'INSERT INTO users (id, email, nombre, rol, password_hash) VALUES (?,?,?,?,?)',
        ['user-worker', 'worker@sg-sst.local', 'Trabajador', 'trabajador', 'test-hash']
      );
      await exec(
        `INSERT INTO workers (id, tipo_documento, numero_documento, nombres, apellidos, cargo, fecha_ingreso)
         VALUES (?,?,?,?,?,?,?)`,
        ['user-worker', 'CC', '123456789', 'Trabajador', 'Prueba', 'Técnico', '2025-01-01']
      );
    });

    afterAll(async () => {
      if (!TEST_DATABASE_URL) return;
      await app.close();
      await closePgPool();
      await terminateScratchConnections(adminPool);
      await adminPool.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
      await adminPool.end();
    });

    const adminHeaders = () => ({ cookie: adminCookie, 'content-type': 'application/json' });
    const workerHeaders = () => ({ cookie: workerCookie, 'content-type': 'application/json' });

    const XLSX_BOUNDARY = '----sg-sst-test-boundary';
    const xlsxFormHeaders = () => ({
      'content-type': `multipart/form-data; boundary=${XLSX_BOUNDARY}`,
    });
    async function xlsxFormPayload(rows: Record<string, unknown>[]): Promise<Buffer> {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Datos');
      const headers = Object.keys(rows[0]);
      ws.addRow(headers);
      for (const row of rows) {
        ws.addRow(headers.map((h) => row[h]));
      }
      const fileBuffer = Buffer.from(await wb.xlsx.writeBuffer());
      const head = Buffer.from(
        `--${XLSX_BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="datos.xlsx"\r\n` +
          'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n'
      );
      const tail = Buffer.from(`\r\n--${XLSX_BOUNDARY}--\r\n`);
      return Buffer.concat([head, fileBuffer, tail]);
    }

    const empresaBase = {
      razon_social: 'Micro Instalaciones Electrónicas SAS',
      nit: '900.123.456-7',
      clase_riesgo: 'IV',
      numero_trabajadores: 3,
      canal_alertas: 'app',
      tiene_vigia_sst: true,
      tiene_comite_convivencia: true,
      alerts_enabled: false,
    };

    it('GET sin empresa configurada responde 404 (Postgres)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/companies',
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).error).toBe('Empresa no configurada');
    });

    it('admin crea la empresa y los datos persisten en Postgres', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/companies',
        headers: adminHeaders(),
        payload: empresaBase,
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.razon_social).toBe(empresaBase.razon_social);
      expect(body.id).toBeTruthy();

      // Persistencia verificada con consulta directa al backend
      const row = await one<Record<string, unknown>>('SELECT * FROM companies WHERE id = ?', [
        body.id,
      ]);
      expect(row?.razon_social).toBe(empresaBase.razon_social);
      expect(row?.nit).toBe(empresaBase.nit);
    });

    it('estandar_set se autocalcula según Res. 0312/2019 (riesgo IV, 3 trabajadores → 21)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/companies',
        headers: adminHeaders(),
        payload: empresaBase,
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).estandar_set).toBe('21');
    });

    it('booleanos persisten como 0/1 y se devuelven como números', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/companies',
        headers: adminHeaders(),
        payload: empresaBase,
      });
      const company = await one<Record<string, unknown>>('SELECT * FROM companies LIMIT 1');
      expect(company?.tiene_vigia_sst).toBe(1);
      expect(company?.tiene_comite_convivencia).toBe(1);
      expect(company?.tiene_copasst).toBe(0);
      expect(company?.alerts_enabled).toBe(0);
    });

    it('segundo POST actualiza (upsert) sin duplicar la fila', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/companies',
        headers: adminHeaders(),
        payload: empresaBase,
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/companies',
        headers: adminHeaders(),
        payload: { ...empresaBase, razon_social: 'Micro Instalaciones Electrónicas S.A.S.' },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).razon_social).toBe('Micro Instalaciones Electrónicas S.A.S.');

      const count = await one<{ c: number }>('SELECT COUNT(*)::int AS c FROM companies');
      expect(count?.c).toBe(1);
    });

    it('GET devuelve la empresa guardada (flujo completo contra Postgres)', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/companies',
        headers: adminHeaders(),
        payload: empresaBase,
      });
      const res = await app.inject({
        method: 'GET',
        url: '/api/companies',
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.razon_social).toBe(empresaBase.razon_social);
      expect(body.numero_trabajadores).toBe(3);
    });

    it('trabajador NO puede crear empresa (RBAC)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/companies',
        headers: workerHeaders(),
        payload: empresaBase,
      });
      expect(res.statusCode).toBe(403);
    });

    it('POST con datos inválidos responde 400 sin tocar la base', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/companies',
        headers: adminHeaders(),
        payload: { razon_social: 'X', clase_riesgo: 'IV' }, // nit muy corto
      });
      expect(res.statusCode).toBe(400);
      const count = await one<{ c: number }>('SELECT COUNT(*)::int AS c FROM companies');
      expect(count?.c).toBe(0);
    });

    it('POST deja registro en la bitácora audit_logs (trazabilidad)', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/companies',
        headers: adminHeaders(),
        payload: empresaBase,
      });
      const companyId = (JSON.parse(created.body) as { id: string }).id;

      const log = await one<Record<string, unknown>>(
        'SELECT * FROM audit_logs WHERE entidad = ? AND entidad_id = ?',
        ['companies', companyId]
      );
      expect(log).toBeTruthy();
      expect(log?.accion).toBe('editar');
      expect(String(log?.valores_nuevos)).toContain('clase_riesgo');
    });

    it('autentica y valida permisos de usuarios consultando PostgreSQL', async () => {
      const passwordHash = createHash('sha256').update('Admin1234!').digest('hex');
      await exec('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, 'user-admin']);
      const login = await app.inject({
        method: 'POST',
        url: '/api/users/login',
        payload: { email: 'admin@sg-sst.local', password: 'Admin1234!' },
      });
      expect(login.statusCode).toBe(200);
      expect(login.json()).toMatchObject({ id: 'user-admin', rol: 'administrador' });

      const me = await app.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: { cookie: adminCookie },
      });
      expect(me.statusCode).toBe(200);
      expect(me.json()).toMatchObject({ id: 'user-admin' });

      const adminUsers = await app.inject({
        method: 'GET',
        url: '/api/users',
        headers: { cookie: adminCookie },
      });
      expect(adminUsers.statusCode).toBe(200);
      expect(adminUsers.json()).toHaveLength(2);
      expect(adminUsers.json()[0]).not.toHaveProperty('password_hash');

      const forbidden = await app.inject({
        method: 'GET',
        url: '/api/users',
        headers: { cookie: workerCookie },
      });
      expect(forbidden.statusCode).toBe(403);

      const logout = await app.inject({
        method: 'POST',
        url: '/api/users/logout',
        headers: { cookie: adminCookie },
      });
      expect(logout.statusCode).toBe(200);
      const logoutCount = await one<{ c: number }>(
        "SELECT COUNT(*)::int AS c FROM audit_logs WHERE accion = 'logout'"
      );
      expect(logoutCount?.c).toBe(1);
    });

    it('registra solo un usuario inicial ante solicitudes concurrentes', async () => {
      await exec('TRUNCATE audit_logs, roles, users CASCADE');
      const payload = {
        email: 'primer.admin@sg-sst.local',
        password: 'Secreta123',
        nombre: 'Primer administrador',
        rol: 'administrador',
      };
      const responses = await Promise.all([
        app.inject({ method: 'POST', url: '/api/users/register', payload }),
        app.inject({
          method: 'POST',
          url: '/api/users/register',
          payload: { ...payload, email: 'otro@sg-sst.local' },
        }),
      ]);
      expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 403]);

      const stored = await one<Record<string, unknown>>('SELECT * FROM users WHERE email = ?', [
        payload.email,
      ]);
      expect(stored?.password_hash).not.toBe(payload.password);
      expect(stored?.password_hash).toBeTruthy();
      const logCount = await one<{ c: number }>(
        "SELECT COUNT(*)::int AS c FROM audit_logs WHERE entidad = 'users' AND accion = 'crear'"
      );
      expect(logCount?.c).toBe(1);
    });

    it('actualiza usuarios y no registra el hash de contraseña en la bitácora', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/users/user-worker',
        headers: adminHeaders(),
        payload: { nombre: 'Trabajador actualizado' },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ nombre: 'Trabajador actualizado' });

      const log = await one<Record<string, unknown>>(
        'SELECT valores_anteriores FROM audit_logs WHERE entidad = ? AND entidad_id = ? ORDER BY creado_en DESC LIMIT 1',
        ['users', 'user-worker']
      );
      expect(String(log?.valores_anteriores)).not.toContain('password_hash');
      expect(String(log?.valores_anteriores)).not.toContain('test-hash');

      const deleted = await app.inject({
        method: 'DELETE',
        url: '/api/users/user-worker',
        headers: { cookie: adminCookie },
      });
      expect(deleted.statusCode).toBe(200);
      expect(await one('SELECT id FROM users WHERE id = ?', ['user-worker'])).toBeUndefined();
    });

    it('crea y consulta roles en PostgreSQL con bitácora y vencimientos', async () => {
      const create = await app.inject({
        method: 'POST',
        url: '/api/roles',
        headers: adminHeaders(),
        payload: {
          nombre: 'Responsable SG-SST',
          usuario_id: 'user-admin',
          licencia_sst_numero: 'LIC-123',
          licencia_sst_vence: '2027-12-31',
          curso_50h: true,
          curso_50h_vence: '2027-06-30',
        },
      });
      expect(create.statusCode).toBe(200);
      const role = create.json();
      expect(role.curso_50h).toBe(1);

      const get = await app.inject({
        method: 'GET',
        url: `/api/roles/${role.id}`,
        headers: { cookie: adminCookie },
      });
      expect(get.statusCode).toBe(200);
      expect(get.json()).toMatchObject({ id: role.id, usuario_id: 'user-admin' });

      const update = await app.inject({
        method: 'PUT',
        url: `/api/roles/${role.id}`,
        headers: adminHeaders(),
        payload: { curso_50h: false, descripcion: 'Rol actualizado' },
      });
      expect(update.statusCode).toBe(200);
      expect(update.json()).toMatchObject({ curso_50h: 0, descripcion: 'Rol actualizado' });

      const expiries = await app.inject({
        method: 'GET',
        url: '/api/roles/vencimientos',
        headers: { cookie: workerCookie },
      });
      expect(expiries.statusCode).toBe(200);
      expect(expiries.json()).toHaveLength(2);

      const log = await one<Record<string, unknown>>(
        'SELECT * FROM audit_logs WHERE entidad = ? AND entidad_id = ?',
        ['roles', role.id]
      );
      expect(log?.accion).toBe('crear');

      const deleted = await app.inject({
        method: 'DELETE',
        url: `/api/roles/${role.id}`,
        headers: { cookie: adminCookie },
      });
      expect(deleted.statusCode).toBe(200);
      const missing = await app.inject({
        method: 'GET',
        url: `/api/roles/${role.id}`,
        headers: { cookie: adminCookie },
      });
      expect(missing.statusCode).toBe(404);
    });

    it('crea, consulta y actualiza trabajadores en PostgreSQL con control de acceso', async () => {
      const forbidden = await app.inject({
        method: 'POST',
        url: '/api/workers',
        headers: workerHeaders(),
        payload: {
          numero_documento: '987654321',
          nombres: 'Nuevo',
          apellidos: 'Trabajador',
          cargo: 'Técnico',
          fecha_ingreso: '2025-03-01',
        },
      });
      expect(forbidden.statusCode).toBe(403);

      const created = await app.inject({
        method: 'POST',
        url: '/api/workers',
        headers: adminHeaders(),
        payload: {
          numero_documento: '987654321',
          nombres: 'Nuevo',
          apellidos: 'Trabajador',
          cargo: 'Técnico',
          fecha_ingreso: '2025-03-01',
        },
      });
      expect(created.statusCode).toBe(200);
      const worker = created.json();
      expect(worker).toMatchObject({
        numero_documento: '987654321',
        estado: 'activo',
        eps: null,
        email: null,
      });
      expect(
        await one('SELECT id FROM workers WHERE id = ?', [worker.id])
      ).toBeTruthy();

      const update = await app.inject({
        method: 'PUT',
        url: `/api/workers/${worker.id}`,
        headers: adminHeaders(),
        payload: { cargo: 'Técnico electricista' },
      });
      expect(update.statusCode).toBe(200);
      expect(update.json().cargo).toBe('Técnico electricista');

      const log = await one<Record<string, unknown>>(
        'SELECT * FROM audit_logs WHERE entidad = ? AND entidad_id = ? ORDER BY creado_en DESC LIMIT 1',
        ['workers', worker.id]
      );
      expect(log?.accion).toBe('editar');
    });

    it('exige consentimiento médico y cifra los datos sensibles de exámenes', async () => {
      const examPayload = {
        tipo: 'periodico',
        fecha: '2026-02-01',
        resultado: 'apto_con_restricciones',
        restricciones: 'No levantar cargas mayores a 10 kg',
        medico: 'Profesional ficticio',
        entidad: 'IPS demostrativa',
        notas: 'Dato de prueba',
      };
      const denied = await app.inject({
        method: 'POST',
        url: '/api/workers/user-worker/exams',
        headers: adminHeaders(),
        payload: examPayload,
      });
      expect(denied.statusCode).toBe(400);

      const consent = await app.inject({
        method: 'POST',
        url: '/api/privacy/consents',
        headers: workerHeaders(),
        payload: {
          worker_id: 'user-worker',
          tipo: 'medico',
          finalidad: 'Gestión de exámenes ocupacionales de prueba',
          autorizado: 1,
          medio: 'digital',
          version_aviso: 'test-1',
        },
      });
      expect(consent.statusCode).toBe(200);
      const consentId = consent.json().id as string;
      expect(
        (await app.inject({
          method: 'GET',
          url: '/api/privacy/consents',
          headers: { cookie: adminCookie },
        })).json()
      ).toHaveLength(1);

      const created = await app.inject({
        method: 'POST',
        url: '/api/workers/user-worker/exams',
        headers: adminHeaders(),
        payload: examPayload,
      });
      expect(created.statusCode).toBe(200);
      const examId = created.json().id as string;
      const stored = await one<Record<string, unknown>>(
        'SELECT restricciones, medico, notas FROM worker_exams WHERE id = ?',
        [examId]
      );
      expect(stored?.restricciones).not.toBe(examPayload.restricciones);
      expect(decrypt(String(stored?.restricciones))).toBe(examPayload.restricciones);
      const examAudit = await one<{ valores_nuevos: string }>(
        'SELECT valores_nuevos FROM audit_logs WHERE entidad = ? AND entidad_id = ?',
        ['worker_exams', examId]
      );
      expect(String(examAudit?.valores_nuevos)).not.toContain(examPayload.restricciones);

      const workerList = await app.inject({
        method: 'GET',
        url: '/api/workers/user-worker/exams',
        headers: workerHeaders(),
      });
      expect(workerList.statusCode).toBe(200);
      expect(workerList.json()[0]).toMatchObject({
        restricciones: null,
        medico: null,
        notas: null,
        resultado: 'apto',
      });

      const adminDetail = await app.inject({
        method: 'GET',
        url: `/api/workers/exams/detail/${examId}`,
        headers: { cookie: adminCookie },
      });
      expect(adminDetail.statusCode).toBe(200);
      expect(adminDetail.json()).toMatchObject({
        restricciones: examPayload.restricciones,
        medico: examPayload.medico,
        notas: examPayload.notas,
      });

      const withdrawn = await app.inject({
        method: 'POST',
        url: `/api/privacy/consents/${consentId}/withdraw`,
        headers: { cookie: workerCookie },
      });
      expect(withdrawn.statusCode).toBe(200);
      const invalidConsent = await app.inject({
        method: 'GET',
        url: '/api/privacy/consents/check/user-worker/medico',
        headers: { cookie: adminCookie },
      });
      expect(invalidConsent.json()).toEqual({ valid: false });

      const afterWithdrawal = await app.inject({
        method: 'POST',
        url: '/api/workers/user-worker/exams',
        headers: adminHeaders(),
        payload: { ...examPayload, fecha: '2026-03-01' },
      });
      expect(afterWithdrawal.statusCode).toBe(400);
    });

    it('valida certificados de alturas, firma EPP propia y devuelve sus vencimientos', async () => {
      const invalidCert = await app.inject({
        method: 'POST',
        url: '/api/workers/user-worker/certs',
        headers: adminHeaders(),
        payload: {
          tipo: 'alturas',
          fecha_emision: '2023-06-15',
          fecha_vencimiento: '2027-06-15',
        },
      });
      expect(invalidCert.statusCode).toBe(400);

      const fechaEmision = '2023-06-15';
      const cert = await app.inject({
        method: 'POST',
        url: '/api/workers/user-worker/certs',
        headers: adminHeaders(),
        payload: {
          tipo: 'alturas',
          fecha_emision: fechaEmision,
          fecha_vencimiento: calcularVencimientoAlturas(fechaEmision),
          nombre_curso: 'Trabajo seguro en alturas',
        },
      });
      expect(cert.statusCode).toBe(200);
      expect(cert.json().fecha_vencimiento).toBe(calcularVencimientoAlturas(fechaEmision));

      const fechaVencimiento = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const epp = await app.inject({
        method: 'POST',
        url: '/api/workers/user-worker/epp',
        headers: adminHeaders(),
        payload: {
          item: 'Casco de prueba',
          fecha_entrega: '2026-01-10',
          fecha_vencimiento: fechaVencimiento,
        },
      });
      expect(epp.statusCode).toBe(200);
      const eppId = epp.json().id as string;
      const signature = `data:image/png;base64,${'A'.repeat(140)}`;
      const signed = await app.inject({
        method: 'POST',
        url: `/api/workers/epp/${eppId}/firmar`,
        headers: workerHeaders(),
        payload: { firma_base64: signature },
      });
      expect(signed.statusCode).toBe(200);
      const storedSignature = await one<{ firma_url: string }>(
        'SELECT firma_url FROM worker_epp WHERE id = ?',
        [eppId]
      );
      expect(storedSignature?.firma_url).not.toBe(signature);
      expect(decrypt(storedSignature!.firma_url)).toBe(signature);

      const expiries = await app.inject({
        method: 'GET',
        url: '/api/workers/vencimientos?dias=30',
        headers: workerHeaders(),
      });
      expect(expiries.statusCode).toBe(200);
      expect(expiries.json()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tipo: 'epp',
            item: 'Casco de prueba',
            fecha_vencimiento: fechaVencimiento,
          }),
        ])
      );
    });

    it('consulta bitácora y estadísticas desde PostgreSQL y mantiene RBAC', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/companies',
        headers: adminHeaders(),
        payload: empresaBase,
      });

      const logs = await app.inject({
        method: 'GET',
        url: '/api/audit-logs?entidad=companies&limit=5',
        headers: { cookie: adminCookie },
      });
      expect(logs.statusCode).toBe(200);
      expect(logs.json().total).toBe(1);
      expect(logs.json().logs[0].entidad).toBe('companies');

      const stats = await app.inject({
        method: 'GET',
        url: '/api/audit-logs/stats',
        headers: { cookie: adminCookie },
      });
      expect(stats.statusCode).toBe(200);
      expect(stats.json().total).toBe(1);

      const forbidden = await app.inject({
        method: 'GET',
        url: '/api/audit-logs',
        headers: { cookie: workerCookie },
      });
      expect(forbidden.statusCode).toBe(403);
    });

    it('gestiona el catálogo y la matriz de peligros en PostgreSQL', async () => {
      const catalogPayload = {
        codigo: 'PEL-ALT-001',
        nombre: 'Trabajo en alturas',
        categoria: 'alturas',
        descripcion: 'Instalación de cámaras en postes',
        riesgo_por_defecto: 'alto',
        control_sugerido: 'Arnés y línea de vida certificados',
      };

      const denied = await app.inject({
        method: 'POST',
        url: '/api/hazards/catalog',
        headers: workerHeaders(),
        payload: catalogPayload,
      });
      expect(denied.statusCode).toBe(403);

      const created = await app.inject({
        method: 'POST',
        url: '/api/hazards/catalog',
        headers: adminHeaders(),
        payload: catalogPayload,
      });
      expect(created.statusCode).toBe(200);
      const catalogItem = created.json();
      expect(catalogItem).toMatchObject({ codigo: 'PEL-ALT-001', activo: 1 });
      expect(
        await one('SELECT id FROM hazard_catalog WHERE id = ?', [catalogItem.id])
      ).toBeTruthy();

      const filtered = await app.inject({
        method: 'GET',
        url: '/api/hazards/catalog?categoria=alturas',
        headers: { cookie: workerCookie },
      });
      expect(filtered.statusCode).toBe(200);
      expect(filtered.json()).toHaveLength(1);

      const assessment = await app.inject({
        method: 'POST',
        url: '/api/hazards/assessments',
        headers: adminHeaders(),
        payload: {
          cargo_oficio: 'Técnico instalador',
          peligro_id: catalogItem.id,
          tarea: 'Montaje de cámara en fachada',
          consecuencia: 'Caída a distinto nivel',
          valoracion_riesgo: 'alto',
          controles: 'Arnés, línea de vida y permiso de alturas',
          responsable: 'Responsable SST',
        },
      });
      expect(assessment.statusCode).toBe(200);
      const assessmentId = assessment.json().id as string;
      expect(
        (await app.inject({
          method: 'GET',
          url: '/api/hazards/assessments',
          headers: { cookie: workerCookie },
        })).json()
      ).toHaveLength(1);

      const updated = await app.inject({
        method: 'PUT',
        url: `/api/hazards/assessments/${assessmentId}`,
        headers: adminHeaders(),
        payload: { valoracion_riesgo: 'critico', controles: 'Controles reforzados' },
      });
      expect(updated.statusCode).toBe(200);
      expect(updated.json()).toMatchObject({
        valoracion_riesgo: 'critico',
        controles: 'Controles reforzados',
      });
      expect(updated.json().revisado_en).toBeTruthy();

      const catalogLog = await one<Record<string, unknown>>(
        'SELECT * FROM audit_logs WHERE entidad = ? AND entidad_id = ?',
        ['hazard_catalog', catalogItem.id]
      );
      expect(catalogLog?.accion).toBe('crear');

      const assessmentLog = await one<Record<string, unknown>>(
        'SELECT * FROM audit_logs WHERE entidad = ? AND entidad_id = ? ORDER BY creado_en DESC LIMIT 1',
        ['hazard_assessments', assessmentId]
      );
      expect(assessmentLog?.accion).toBe('editar');

      const deleted = await app.inject({
        method: 'DELETE',
        url: `/api/hazards/assessments/${assessmentId}`,
        headers: { cookie: adminCookie },
      });
      expect(deleted.statusCode).toBe(200);
      expect(
        await one('SELECT id FROM hazard_assessments WHERE id = ?', [assessmentId])
      ).toBeUndefined();
    });

    it('evalúa estándares mínimos y calcula cumplimiento desde PostgreSQL', async () => {
      const stdPayload = {
        codigo: 'E1',
        titulo: 'Política de SST',
        descripcion: 'Política documentada y divulgada',
        set_aplicable: '21',
        capitulo: 'I',
      };

      const denied = await app.inject({
        method: 'POST',
        url: '/api/standards',
        headers: workerHeaders(),
        payload: stdPayload,
      });
      expect(denied.statusCode).toBe(403);

      const created = await app.inject({
        method: 'POST',
        url: '/api/standards',
        headers: adminHeaders(),
        payload: stdPayload,
      });
      expect(created.statusCode).toBe(200);
      const standardId = created.json().id as string;

      const bySet = await app.inject({
        method: 'GET',
        url: '/api/standards?set=21',
        headers: { cookie: workerCookie },
      });
      expect(bySet.statusCode).toBe(200);
      expect(bySet.json()).toHaveLength(1);
      expect(bySet.json()[0].codigo).toBe('E1');

      const assessment = await app.inject({
        method: 'POST',
        url: '/api/standards/assessments',
        headers: adminHeaders(),
        payload: {
          standard_id: standardId,
          cumple: true,
          observaciones: 'Documento vigente de prueba',
        },
      });
      expect(assessment.statusCode).toBe(200);
      expect(assessment.json()).toMatchObject({ cumple: 1, usuario_id: 'user-admin' });
      const assessmentId = assessment.json().id as string;

      const cumplimiento = await app.inject({
        method: 'GET',
        url: '/api/standards/cumplimiento',
        headers: { cookie: workerCookie },
      });
      expect(cumplimiento.statusCode).toBe(200);
      expect(cumplimiento.json()).toEqual({
        total: 1,
        cumplidos: 1,
        incumplidos: 0,
        porcentaje: 100,
      });

      const updated = await app.inject({
        method: 'PUT',
        url: `/api/standards/assessments/${assessmentId}`,
        headers: adminHeaders(),
        payload: { cumple: false, plan_mejora: 'Elaborar y divulgar la política' },
      });
      expect(updated.statusCode).toBe(200);
      expect(updated.json()).toMatchObject({
        cumple: 0,
        plan_mejora: 'Elaborar y divulgar la política',
      });

      const afterUpdate = await app.inject({
        method: 'GET',
        url: '/api/standards/cumplimiento',
        headers: { cookie: workerCookie },
      });
      expect(afterUpdate.json()).toEqual({
        total: 1,
        cumplidos: 0,
        incumplidos: 1,
        porcentaje: 0,
      });

      const log = await one<Record<string, unknown>>(
        'SELECT * FROM audit_logs WHERE entidad = ? AND entidad_id = ? ORDER BY creado_en DESC LIMIT 1',
        ['standard_assessments', assessmentId]
      );
      expect(log?.accion).toBe('editar');

      const deleted = await app.inject({
        method: 'DELETE',
        url: `/api/standards/assessments/${assessmentId}`,
        headers: { cookie: adminCookie },
      });
      expect(deleted.statusCode).toBe(200);
      expect(
        (await app.inject({
          method: 'GET',
          url: '/api/standards/assessments',
          headers: { cookie: workerCookie },
        })).json()
      ).toHaveLength(0);
    });

    it('gestiona el plan anual y el cronograma de capacitación en PostgreSQL', async () => {
      const denied = await app.inject({
        method: 'POST',
        url: '/api/plans/annual',
        headers: workerHeaders(),
        payload: {
          anio: 2026,
          objetivo: 'Cumplir el SG-SST',
          fecha_inicio: '2026-01-15',
        },
      });
      expect(denied.statusCode).toBe(403);

      const created = await app.inject({
        method: 'POST',
        url: '/api/plans/annual',
        headers: adminHeaders(),
        payload: {
          anio: 2026,
          objetivo: 'Cumplir el SG-SST',
          meta: '100% de actividades ejecutadas',
          responsable: 'Responsable SST',
          fecha_inicio: '2026-01-15',
          fecha_fin: '2026-12-15',
          presupuesto: 1500000,
          estado: 'pendiente',
        },
      });
      expect(created.statusCode).toBe(200);
      const planId = created.json().id as string;
      expect(created.json()).toMatchObject({ anio: 2026, presupuesto: 1500000 });

      const list = await app.inject({
        method: 'GET',
        url: '/api/plans/annual?anio=2026',
        headers: { cookie: workerCookie },
      });
      expect(list.statusCode).toBe(200);
      expect(list.json()).toHaveLength(1);

      const updated = await app.inject({
        method: 'PUT',
        url: `/api/plans/annual/${planId}`,
        headers: adminHeaders(),
        payload: { estado: 'en_proceso' },
      });
      expect(updated.statusCode).toBe(200);
      expect(updated.json().estado).toBe('en_proceso');

      const schedule = await app.inject({
        method: 'POST',
        url: '/api/plans/training',
        headers: adminHeaders(),
        payload: {
          nombre: 'Inducción SG-SST',
          tipo: 'induccion',
          fecha: '2026-02-01',
          duracion_horas: 2,
          responsable: 'Responsable SST',
          estado: 'programada',
        },
      });
      expect(schedule.statusCode).toBe(200);
      const scheduleId = schedule.json().id as string;
      const createdAt = schedule.json().creado_en as string;
      expect(createdAt).toBeTruthy();

      const scheduleUpdated = await app.inject({
        method: 'PUT',
        url: `/api/plans/training/${scheduleId}`,
        headers: adminHeaders(),
        payload: { objetivo: 'Inducción general al SG-SST' },
      });
      expect(scheduleUpdated.statusCode).toBe(200);
      expect(scheduleUpdated.json().creado_en).toBe(createdAt);
      expect(scheduleUpdated.json().objetivo).toBe('Inducción general al SG-SST');

      const log = await one<Record<string, unknown>>(
        'SELECT * FROM audit_logs WHERE entidad = ? AND entidad_id = ?',
        ['annual_plan', planId]
      );
      expect(log?.accion).toBe('crear');
    });

    it('ejecuta capacitaciones con asistencia y firma en PostgreSQL', async () => {
      const training = await app.inject({
        method: 'POST',
        url: '/api/plans/trainings',
        headers: adminHeaders(),
        payload: {
          nombre: 'Uso y mantenimiento de EPP',
          fecha: '2026-03-01',
          instructor: 'Instructor ficticio',
          estado: 'realizada',
        },
      });
      expect(training.statusCode).toBe(200);
      const trainingId = training.json().id as string;

      const listed = await app.inject({
        method: 'GET',
        url: '/api/plans/trainings',
        headers: { cookie: workerCookie },
      });
      expect(listed.statusCode).toBe(200);
      expect(listed.json()).toHaveLength(1);
      expect(listed.json()[0].nombre).toBe('Uso y mantenimiento de EPP');

      const bulk = await app.inject({
        method: 'POST',
        url: `/api/plans/trainings/${trainingId}/attendance/bulk`,
        headers: adminHeaders(),
        payload: { worker_ids: ['user-worker'] },
      });
      expect(bulk.statusCode).toBe(200);
      expect(bulk.json()).toHaveLength(1);
      const attendanceId = bulk.json()[0].id as string;
      expect(bulk.json()[0]).toMatchObject({ firmado: 0, nombres: 'Trabajador' });

      const signed = await app.inject({
        method: 'PUT',
        url: `/api/plans/trainings/attendance/${attendanceId}`,
        headers: adminHeaders(),
        payload: { firmado: 1, firma_url: 'data:image/png;base64,AAAA' },
      });
      expect(signed.statusCode).toBe(200);
      expect(signed.json()).toMatchObject({ firmado: 1 });

      const attendance = await app.inject({
        method: 'GET',
        url: `/api/plans/trainings/${trainingId}/attendance`,
        headers: { cookie: workerCookie },
      });
      expect(attendance.statusCode).toBe(200);
      expect(attendance.json()).toHaveLength(1);
      expect(attendance.json()[0]).toMatchObject({
        worker_id: 'user-worker',
        apellidos: 'Prueba',
        firmado: 1,
      });

      const deleted = await app.inject({
        method: 'DELETE',
        url: `/api/plans/trainings/${trainingId}`,
        headers: { cookie: adminCookie },
      });
      expect(deleted.statusCode).toBe(200);
      expect(
        (await app.inject({
          method: 'GET',
          url: '/api/plans/trainings',
          headers: { cookie: workerCookie },
        })).json()
      ).toHaveLength(0);
      expect(
        await one('SELECT id FROM training_attendance WHERE id = ?', [attendanceId])
      ).toBeUndefined();
    });

    it('registra inspecciones con evidencias y bitácora en PostgreSQL', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/inspections',
        headers: adminHeaders(),
        payload: {
          tipo: 'extintores',
          fecha: '2026-04-10',
          lugar: 'Bodega principal',
          estado: 'aprobada',
          archivo_fotos: JSON.stringify(['data:image/png;base64,AAAA']),
        },
      });
      expect(created.statusCode).toBe(200);
      const inspectionId = created.json().id as string;
      expect(created.json()).toMatchObject({ tipo: 'extintores', estado: 'aprobada' });
      expect(created.json().creado_en).toBeTruthy();

      const denied = await app.inject({
        method: 'POST',
        url: '/api/inspections',
        headers: workerHeaders(),
        payload: { tipo: 'epp', fecha: '2026-04-10' },
      });
      expect(denied.statusCode).toBe(403);

      const listed = await app.inject({
        method: 'GET',
        url: '/api/inspections',
        headers: { cookie: workerCookie },
      });
      expect(listed.statusCode).toBe(200);
      expect(listed.json()).toHaveLength(1);

      const updated = await app.inject({
        method: 'PUT',
        url: `/api/inspections/${inspectionId}`,
        headers: adminHeaders(),
        payload: { estado: 'observaciones', observaciones: 'Extintor vencido en bodega' },
      });
      expect(updated.statusCode).toBe(200);
      expect(updated.json()).toMatchObject({
        estado: 'observaciones',
        observaciones: 'Extintor vencido en bodega',
      });

      const log = await one<Record<string, unknown>>(
        'SELECT * FROM audit_logs WHERE entidad = ? AND entidad_id = ? AND accion = ?',
        ['inspections', inspectionId, 'editar']
      );
      expect(log).toBeTruthy();

      const deleted = await app.inject({
        method: 'DELETE',
        url: `/api/inspections/${inspectionId}`,
        headers: { cookie: adminCookie },
      });
      expect(deleted.statusCode).toBe(200);
      expect(
        await one('SELECT id FROM inspections WHERE id = ?', [inspectionId])
      ).toBeUndefined();
    });

    it('gestiona permisos de alturas con fotos y firmas, y ATS en PostgreSQL', async () => {
      const permit = await app.inject({
        method: 'POST',
        url: '/api/altura/permits',
        headers: adminHeaders(),
        payload: {
          obra: 'Bloque A',
          fecha: '2026-05-01',
          hora_inicio: '07:00',
          hora_fin: '17:00',
          solicitante: 'Solicitante Ficticio',
          responsable_seguridad: 'Responsable SST',
          sistema_proteccion: 'Arnés y línea de vida',
          equipo_verificado: 1,
          apto_medico: 1,
          certificado_alturas: 1,
          archivo_fotos: JSON.stringify(['data:image/png;base64,AAAA']),
          firma_solicitante_url: 'data:image/png;base64,BBBB',
        },
      });
      expect(permit.statusCode).toBe(200);
      const permitId = permit.json().id as string;
      expect(permit.json()).toMatchObject({
        obra: 'Bloque A',
        equipo_verificado: 1,
        apto_medico: 1,
        certificado_alturas: 1,
      });

      const signed = await app.inject({
        method: 'PUT',
        url: `/api/altura/permits/${permitId}`,
        headers: adminHeaders(),
        payload: {
          firma_responsable_url: 'data:image/png;base64,CCCC',
          estado: 'autorizado',
        },
      });
      expect(signed.statusCode).toBe(200);
      expect(signed.json()).toMatchObject({
        estado: 'autorizado',
        firma_responsable_url: 'data:image/png;base64,CCCC',
        obra: 'Bloque A',
      });

      const permits = await app.inject({
        method: 'GET',
        url: '/api/altura/permits',
        headers: { cookie: workerCookie },
      });
      expect(permits.statusCode).toBe(200);
      expect(permits.json()).toHaveLength(1);

      const ats = await app.inject({
        method: 'POST',
        url: '/api/altura/ats',
        headers: adminHeaders(),
        payload: {
          obra: 'Bloque A',
          tarea: 'Instalación de cubierta',
          peligro: 'Caída a más de 2 metros',
          fecha: '2026-05-01',
        },
      });
      expect(ats.statusCode).toBe(200);
      const atsId = ats.json().id as string;
      expect(ats.json().estado).toBe('vigente');

      const atsUpdated = await app.inject({
        method: 'PUT',
        url: `/api/altura/ats/${atsId}`,
        headers: adminHeaders(),
        payload: { estado: 'cerrado', control: 'Uso de arnés y línea de vida' },
      });
      expect(atsUpdated.statusCode).toBe(200);
      expect(atsUpdated.json()).toMatchObject({
        estado: 'cerrado',
        control: 'Uso de arnés y línea de vida',
      });

      await app.inject({
        method: 'DELETE',
        url: `/api/altura/ats/${atsId}`,
        headers: { cookie: adminCookie },
      });
      await app.inject({
        method: 'DELETE',
        url: `/api/altura/permits/${permitId}`,
        headers: { cookie: adminCookie },
      });
      expect(await one('SELECT id FROM ats WHERE id = ?', [atsId])).toBeUndefined();
      expect(
        await one('SELECT id FROM altura_permits WHERE id = ?', [permitId])
      ).toBeUndefined();
    });

    it('gestiona planes de emergencia, simulacros y contratistas en PostgreSQL', async () => {
      const plan = await app.inject({
        method: 'POST',
        url: '/api/emergency-plans',
        headers: adminHeaders(),
        payload: {
          nombre: 'Plan de evacuación',
          tipo_emergencia: 'evacuacion',
          contenido: 'Rutas y puntos de encuentro',
        },
      });
      expect(plan.statusCode).toBe(200);
      const planId = plan.json().id as string;
      expect(plan.json()).toMatchObject({ vigente: 1 });

      const drill = await app.inject({
        method: 'POST',
        url: '/api/drills',
        headers: adminHeaders(),
        payload: {
          emergency_plan_id: planId,
          fecha: '2026-06-01',
          tipo: 'evacuacion',
          participantes: 5,
        },
      });
      expect(drill.statusCode).toBe(200);
      const drillId = drill.json().id as string;

      const drills = await app.inject({
        method: 'GET',
        url: '/api/drills',
        headers: { cookie: workerCookie },
      });
      expect(drills.statusCode).toBe(200);
      expect(drills.json()).toHaveLength(1);
      expect(drills.json()[0]).toMatchObject({
        plan_nombre: 'Plan de evacuación',
        participantes: 5,
      });

      const planUpdated = await app.inject({
        method: 'PUT',
        url: `/api/emergency-plans/${planId}`,
        headers: adminHeaders(),
        payload: { vigente: 0 },
      });
      expect(planUpdated.statusCode).toBe(200);
      expect(planUpdated.json().vigente).toBe(0);

      const contractor = await app.inject({
        method: 'POST',
        url: '/api/contractors',
        headers: adminHeaders(),
        payload: {
          nombre: 'Andamios SAS',
          nit: '901.000.111-2',
          servicio: 'Montaje de andamios',
          examen_medico: 1,
          capacitacion_sst: 1,
          epp: 1,
        },
      });
      expect(contractor.statusCode).toBe(200);
      const contractorId = contractor.json().id as string;
      expect(contractor.json().creado_en).toBeTruthy();

      const contractorDenied = await app.inject({
        method: 'GET',
        url: '/api/contractors',
        headers: { cookie: workerCookie },
      });
      expect(contractorDenied.statusCode).toBe(403);

      const contractorUpdated = await app.inject({
        method: 'PUT',
        url: `/api/contractors/${contractorId}`,
        headers: adminHeaders(),
        payload: { estado: 'aprobado', fecha_evaluacion: '2026-06-15' },
      });
      expect(contractorUpdated.statusCode).toBe(200);
      expect(contractorUpdated.json().estado).toBe('aprobado');

      const planDeleted = await app.inject({
        method: 'DELETE',
        url: `/api/emergency-plans/${planId}`,
        headers: { cookie: adminCookie },
      });
      expect(planDeleted.statusCode).toBe(200);
      expect(await one('SELECT id FROM drills WHERE id = ?', [drillId])).toBeUndefined();

      const contractorDeleted = await app.inject({
        method: 'DELETE',
        url: `/api/contractors/${contractorId}`,
        headers: { cookie: adminCookie },
      });
      expect(contractorDeleted.statusCode).toBe(200);
      expect(
        await one('SELECT id FROM contractors WHERE id = ?', [contractorId])
      ).toBeUndefined();
    });

    it('registra incidentes con acciones asociadas y elimina en cascada en PostgreSQL', async () => {
      const incident = await app.inject({
        method: 'POST',
        url: '/api/incidents',
        headers: adminHeaders(),
        payload: {
          tipo: 'incidente',
          fecha_ocurrencia: '2026-07-01',
          fecha_reporte: '2026-07-02',
          trabajador_id: 'user-worker',
          lugar: 'Bloque A',
          descripcion: 'Caída de herramienta sin lesionados',
          reporte_arl: true,
          dias_perdidos: 0,
        },
      });
      expect(incident.statusCode).toBe(200);
      const incidentId = incident.json().id as string;
      expect(incident.json()).toMatchObject({ reporte_arl: 1, reporte_eps: 0, estado: 'abierto' });

      const denied = await app.inject({
        method: 'GET',
        url: '/api/incidents',
        headers: { cookie: workerCookie },
      });
      expect(denied.statusCode).toBe(403);

      const incidentAction = await app.inject({
        method: 'POST',
        url: `/api/incidents/${incidentId}/actions`,
        headers: adminHeaders(),
        payload: {
          descripcion: 'Revisar amarre de herramientas en altura',
          responsable: 'Responsable SST',
          fecha_limite: '2026-07-15',
        },
      });
      expect(incidentAction.statusCode).toBe(200);
      const incidentActionId = incidentAction.json().id as string;

      const completed = await app.inject({
        method: 'PUT',
        url: `/api/incidents/${incidentId}/actions/${incidentActionId}`,
        headers: adminHeaders(),
        payload: { estado: 'completada', completada_en: '2026-07-10' },
      });
      expect(completed.statusCode).toBe(200);
      expect(completed.json()).toMatchObject({
        estado: 'completada',
        completada_en: '2026-07-10',
      });

      const actions = await app.inject({
        method: 'GET',
        url: `/api/incidents/${incidentId}/actions`,
        headers: { cookie: adminCookie },
      });
      expect(actions.statusCode).toBe(200);
      expect(actions.json()).toHaveLength(1);

      const missingIncident = await app.inject({
        method: 'POST',
        url: '/api/incidents/no-existe/actions',
        headers: adminHeaders(),
        payload: {
          descripcion: 'Acción sin incidente',
          responsable: 'Responsable SST',
        },
      });
      expect(missingIncident.statusCode).toBe(404);

      const deleted = await app.inject({
        method: 'DELETE',
        url: `/api/incidents/${incidentId}`,
        headers: { cookie: adminCookie },
      });
      expect(deleted.statusCode).toBe(200);
      expect(
        await one('SELECT id FROM incident_actions WHERE id = ?', [incidentActionId])
      ).toBeUndefined();
    });

    it('gestiona acciones correctivas con prioridad y bitácora en PostgreSQL', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/actions',
        headers: adminHeaders(),
        payload: {
          origen: 'auditoria',
          descripcion: 'Actualizar matriz de riesgos',
          responsable: 'Responsable SST',
          fecha_limite: '2026-08-30',
        },
      });
      expect(created.statusCode).toBe(200);
      const actionId = created.json().id as string;
      expect(created.json()).toMatchObject({ estado: 'pendiente', prioridad: 'media' });
      expect(created.json().creado_en).toBeTruthy();

      const listed = await app.inject({
        method: 'GET',
        url: '/api/actions',
        headers: { cookie: workerCookie },
      });
      expect(listed.statusCode).toBe(200);
      expect(listed.json()).toHaveLength(1);

      const updated = await app.inject({
        method: 'PUT',
        url: `/api/actions/${actionId}`,
        headers: adminHeaders(),
        payload: { estado: 'en_proceso', prioridad: 'alta' },
      });
      expect(updated.statusCode).toBe(200);
      expect(updated.json()).toMatchObject({ estado: 'en_proceso', prioridad: 'alta' });

      const log = await one<Record<string, unknown>>(
        'SELECT * FROM audit_logs WHERE entidad = ? AND entidad_id = ? AND accion = ?',
        ['corrective_actions', actionId, 'editar']
      );
      expect(log).toBeTruthy();

      await app.inject({
        method: 'DELETE',
        url: `/api/actions/${actionId}`,
        headers: { cookie: adminCookie },
      });
      expect(
        await one('SELECT id FROM corrective_actions WHERE id = ?', [actionId])
      ).toBeUndefined();
    });

    it('gestiona auditorías, hallazgos y su resumen en PostgreSQL', async () => {
      const audit = await app.inject({
        method: 'POST',
        url: '/api/audits',
        headers: adminHeaders(),
        payload: {
          anio: 2026,
          tipo: 'interna',
          fecha: '2026-09-01',
          auditor: 'Auditor ficticio',
          alcance: 'Sistema de gestión SG-SST',
        },
      });
      expect(audit.statusCode).toBe(200);
      const auditId = audit.json().id as string;
      expect(audit.json().estado).toBe('programada');

      const finding = await app.inject({
        method: 'POST',
        url: `/api/audits/${auditId}/findings`,
        headers: adminHeaders(),
        payload: {
          descripcion: 'Falta evidencia de entrega de EPP',
          tipo: 'no_conformidad',
          responsable: 'Responsable SST',
          fecha_limite: '2020-01-01',
        },
      });
      expect(finding.statusCode).toBe(200);
      const findingId = finding.json().id as string;
      expect(finding.json().estado).toBe('abierto');

      const findings = await app.inject({
        method: 'GET',
        url: `/api/audits/${auditId}/findings`,
        headers: { cookie: adminCookie },
      });
      expect(findings.statusCode).toBe(200);
      expect(findings.json()).toHaveLength(1);

      const summary = await app.inject({
        method: 'GET',
        url: '/api/audits/findings/summary',
        headers: { cookie: adminCookie },
      });
      expect(summary.statusCode).toBe(200);
      expect(summary.json()).toMatchObject({ total: 1, abiertos: 1, vencidos: 1 });

      const verified = await app.inject({
        method: 'PUT',
        url: `/api/audits/${auditId}/findings/${findingId}`,
        headers: adminHeaders(),
        payload: { estado: 'verificado', evidencia_cierre: 'Acta firmada' },
      });
      expect(verified.statusCode).toBe(200);
      expect(verified.json()).toMatchObject({ estado: 'verificado' });

      const summaryAfter = await app.inject({
        method: 'GET',
        url: '/api/audits/findings/summary',
        headers: { cookie: adminCookie },
      });
      expect(summaryAfter.json()).toMatchObject({
        total: 1,
        abiertos: 0,
        verificados: 1,
        vencidos: 0,
      });

      await app.inject({
        method: 'DELETE',
        url: `/api/audits/${auditId}`,
        headers: { cookie: adminCookie },
      });
      expect(
        await one('SELECT id FROM audit_findings WHERE id = ?', [findingId])
      ).toBeUndefined();
      expect(await one('SELECT id FROM audits WHERE id = ?', [auditId])).toBeUndefined();
    });

    it('genera, consulta, marca y elimina alertas en PostgreSQL', async () => {
      await exec(
        `INSERT INTO worker_exams (id, worker_id, tipo, fecha, vencimiento, resultado)
         VALUES (?,?,?,?,?,?)`,
        ['exam-alert', 'user-worker', 'periodico', '2020-01-01', '2020-01-15', 'apto']
      );

      const generate = await app.inject({
        method: 'POST',
        url: '/api/alerts/generate',
        headers: { cookie: adminCookie },
      });
      expect(generate.statusCode).toBe(200);
      expect(generate.json().generadas).toBe(1);
      const alertId = generate.json().alertas[0].id as string;
      expect(generate.json().alertas[0]).toMatchObject({
        tipo: 'examen',
        prioridad: 'critica',
        enviado: 0,
      });

      // La segunda corrida no duplica (dedupe por entidad/tipo).
      const again = await app.inject({
        method: 'POST',
        url: '/api/alerts/generate',
        headers: { cookie: adminCookie },
      });
      expect(again.json().generadas).toBe(0);

      const adminList = await app.inject({
        method: 'GET',
        url: '/api/alerts',
        headers: { cookie: adminCookie },
      });
      expect(adminList.statusCode).toBe(200);
      expect(adminList.json()).toHaveLength(1);

      // El trabajador solo ve alertas de sus propias entidades.
      const workerList = await app.inject({
        method: 'GET',
        url: '/api/alerts',
        headers: { cookie: workerCookie },
      });
      expect(workerList.statusCode).toBe(200);
      expect(workerList.json()).toHaveLength(1);

      const stats = await app.inject({
        method: 'GET',
        url: '/api/alerts/stats',
        headers: { cookie: adminCookie },
      });
      expect(stats.statusCode).toBe(200);
      expect(stats.json()).toMatchObject({ total: 1, pendientes: 1, enviadas: 0, vencidas: 1 });

      const sent = await app.inject({
        method: 'PUT',
        url: `/api/alerts/${alertId}/sent`,
        headers: { cookie: adminCookie },
      });
      expect(sent.statusCode).toBe(200);
      const row = await one<{ enviado: number }>('SELECT enviado FROM alerts WHERE id = ?', [
        alertId,
      ]);
      expect(row?.enviado).toBe(1);

      const deleted = await app.inject({
        method: 'DELETE',
        url: `/api/alerts/${alertId}`,
        headers: { cookie: adminCookie },
      });
      expect(deleted.statusCode).toBe(200);
      expect(await one('SELECT id FROM alerts WHERE id = ?', [alertId])).toBeUndefined();
    });

    it('CRUD de indicadores con RBAC y filtro por periodo en PostgreSQL', async () => {
      const denied = await app.inject({
        method: 'POST',
        url: '/api/indicators',
        headers: adminHeaders(),
        payload: {
          nombre: 'Frecuencia de accidentalidad',
          tipo: 'resultado',
          valor: 1.5,
          meta: 2,
          periodo: '2026-07',
        },
      });
      expect(denied.statusCode).toBe(200);

      const created = denied.json();
      expect(created.fecha_calculo).toBeTruthy();

      const workerDenied = await app.inject({
        method: 'POST',
        url: '/api/indicators',
        headers: workerHeaders(),
        payload: {
          nombre: 'Indicador no autorizado',
          tipo: 'proceso',
          valor: 1,
          periodo: '2026-07',
        },
      });
      expect(workerDenied.statusCode).toBe(403);

      const list = await app.inject({
        method: 'GET',
        url: '/api/indicators?periodo=2026-07',
        headers: { cookie: workerCookie },
      });
      expect(list.statusCode).toBe(200);
      expect(list.json()).toHaveLength(1);
      expect(list.json()[0]).toMatchObject({ valor: 1.5, periodo: '2026-07' });

      const empty = await app.inject({
        method: 'GET',
        url: '/api/indicators?periodo=2025-01',
        headers: { cookie: adminCookie },
      });
      expect(empty.json()).toHaveLength(0);

      const updated = await app.inject({
        method: 'PUT',
        url: `/api/indicators/${created.id}`,
        headers: adminHeaders(),
        payload: { valor: 2.5 },
      });
      expect(updated.statusCode).toBe(200);
      expect(updated.json().valor).toBe(2.5);

      const deleted = await app.inject({
        method: 'DELETE',
        url: `/api/indicators/${created.id}`,
        headers: { cookie: adminCookie },
      });
      expect(deleted.statusCode).toBe(200);
      expect(
        await one('SELECT id FROM indicators WHERE id = ?', [created.id])
      ).toBeUndefined();
    });

    it('gestiona documentos con visibilidad por rol en PostgreSQL', async () => {
      const vigente = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: adminHeaders(),
        payload: {
          codigo: 'DOC-001',
          nombre: 'Política de seguridad',
          tipo: 'politica',
          estado: 'vigente',
          retencion_anos: 5,
        },
      });
      expect(vigente.statusCode).toBe(200);
      expect(vigente.json().estado).toBe('vigente');

      const revision = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: adminHeaders(),
        payload: {
          codigo: 'DOC-002',
          nombre: 'Matriz de riesgos',
          tipo: 'matriz',
          estado: 'en_revision',
          retencion_anos: 5,
        },
      });
      expect(revision.statusCode).toBe(200);

      const adminList = await app.inject({
        method: 'GET',
        url: '/api/documents',
        headers: { cookie: adminCookie },
      });
      expect(adminList.json()).toHaveLength(2);

      // Trabajador solo ve documentos vigentes.
      const workerList = await app.inject({
        method: 'GET',
        url: '/api/documents',
        headers: { cookie: workerCookie },
      });
      expect(workerList.json()).toHaveLength(1);
      expect(workerList.json()[0].codigo).toBe('DOC-001');

      const workerDetail = await app.inject({
        method: 'GET',
        url: `/api/documents/${revision.json().id}`,
        headers: { cookie: workerCookie },
      });
      expect(workerDetail.statusCode).toBe(403);

      const workerCreate = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: workerHeaders(),
        payload: { codigo: 'DOC-003', nombre: 'No autorizado', tipo: 'otro' },
      });
      expect(workerCreate.statusCode).toBe(403);

      const updated = await app.inject({
        method: 'PUT',
        url: `/api/documents/${revision.json().id}`,
        headers: adminHeaders(),
        payload: { estado: 'obsoleto' },
      });
      expect(updated.statusCode).toBe(200);
      expect(updated.json().estado).toBe('obsoleto');

      const deleted = await app.inject({
        method: 'DELETE',
        url: `/api/documents/${vigente.json().id}`,
        headers: { cookie: adminCookie },
      });
      expect(deleted.statusCode).toBe(200);
      expect(
        await one('SELECT id FROM documents WHERE id = ?', [vigente.json().id])
      ).toBeUndefined();
    });

    it('flujo de política: borrador, objetivos, firma, divulgación, archivo y export PDF', async () => {
      const draft = await app.inject({
        method: 'POST',
        url: '/api/policies',
        headers: adminHeaders(),
        payload: {
          titulo: 'Política de SST 2026',
          contenido: 'La empresa se compromete a proteger la seguridad y salud de sus trabajadores.',
          estado: 'borrador',
        },
      });
      expect(draft.statusCode).toBe(200);
      const policyId = draft.json().id as string;
      expect(draft.json()).toMatchObject({ version: 1, estado: 'borrador' });

      const noActive = await app.inject({
        method: 'GET',
        url: '/api/policies/active',
        headers: { cookie: workerCookie },
      });
      expect(noActive.statusCode).toBe(404);

      const objective = await app.inject({
        method: 'POST',
        url: `/api/policies/${policyId}/objectives`,
        headers: adminHeaders(),
        payload: {
          descripcion: 'Reducir la accidentalidad en 20%',
          tipo: 'resultado',
          meta: '20%',
          responsable: 'Responsable SST',
        },
      });
      expect(objective.statusCode).toBe(200);
      const objectiveId = objective.json().id as string;

      const activeDraft = await app.inject({
        method: 'GET',
        url: `/api/policies/${policyId}`,
        headers: { cookie: workerCookie },
      });
      expect(activeDraft.json().objectives).toHaveLength(1);

      const signed = await app.inject({
        method: 'POST',
        url: `/api/policies/${policyId}/firmar`,
        headers: adminHeaders(),
        payload: { firmado_por: 'Representante Legal' },
      });
      expect(signed.statusCode).toBe(200);
      expect(signed.json()).toMatchObject({ estado: 'vigente', firmado_por: 'Representante Legal' });
      expect(signed.json().fecha_firma).toBeTruthy();

      const active = await app.inject({
        method: 'GET',
        url: '/api/policies/active',
        headers: { cookie: workerCookie },
      });
      expect(active.statusCode).toBe(200);
      expect(active.json().objectives).toHaveLength(1);

      const exportPdf = await app.inject({
        method: 'GET',
        url: `/api/policies/${policyId}/export`,
        headers: { cookie: adminCookie },
      });
      expect(exportPdf.statusCode).toBe(200);
      expect(exportPdf.headers['content-type']).toContain('application/pdf');
      expect(exportPdf.rawPayload.subarray(0, 4).toString()).toBe('%PDF');

      const exportPolicy = await app.inject({
        method: 'GET',
        url: '/api/export/politica',
        headers: { cookie: adminCookie },
      });
      expect(exportPolicy.statusCode).toBe(200);
      expect(exportPolicy.headers['content-type']).toContain('application/pdf');

      const divulgated = await app.inject({
        method: 'POST',
        url: `/api/policies/${policyId}/divulgar`,
        headers: { cookie: adminCookie },
      });
      expect(divulgated.statusCode).toBe(200);
      expect(divulgated.json().fecha_divulgacion).toBeTruthy();

      const archived = await app.inject({
        method: 'POST',
        url: `/api/policies/${policyId}/archivar`,
        headers: { cookie: adminCookie },
      });
      expect(archived.statusCode).toBe(200);
      expect(archived.json().estado).toBe('archivada');

      const noExport = await app.inject({
        method: 'GET',
        url: '/api/export/politica',
        headers: { cookie: adminCookie },
      });
      expect(noExport.statusCode).toBe(404);

      const notDeletable = await app.inject({
        method: 'DELETE',
        url: `/api/policies/${policyId}`,
        headers: { cookie: adminCookie },
      });
      expect(notDeletable.statusCode).toBe(400);

      expect(
        await one('SELECT id FROM objectives WHERE id = ?', [objectiveId])
      ).toBeTruthy();
    });

    it('editar una política vigente crea nueva versión borrador y archiva la anterior', async () => {
      const draft = await app.inject({
        method: 'POST',
        url: '/api/policies',
        headers: adminHeaders(),
        payload: { titulo: 'Política v1', contenido: 'Contenido inicial de la política.' },
      });
      const policyId = draft.json().id as string;

      await app.inject({
        method: 'POST',
        url: `/api/policies/${policyId}/firmar`,
        headers: adminHeaders(),
        payload: { firmado_por: 'Representante Legal' },
      });

      const newVersion = await app.inject({
        method: 'PUT',
        url: `/api/policies/${policyId}`,
        headers: adminHeaders(),
        payload: { titulo: 'Política v2' },
      });
      expect(newVersion.statusCode).toBe(200);
      expect(newVersion.json()).toMatchObject({
        version: 2,
        estado: 'borrador',
        titulo: 'Política v2',
      });

      const previous = await one<{ estado: string }>(
        'SELECT estado FROM policies WHERE id = ?',
        [policyId]
      );
      expect(previous?.estado).toBe('archivada');

      const deleted = await app.inject({
        method: 'DELETE',
        url: `/api/policies/${newVersion.json().id}`,
        headers: { cookie: adminCookie },
      });
      expect(deleted.statusCode).toBe(200);
    });

    it('exporta indicadores y estándares a PDF y Excel en PostgreSQL', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/indicators',
        headers: adminHeaders(),
        payload: {
          nombre: 'Cobertura de capacitación',
          tipo: 'proceso',
          valor: 95,
          meta: 100,
          periodo: '2026-07',
        },
      });

      const indicatorsPdf = await app.inject({
        method: 'GET',
        url: '/api/export/indicadores',
        headers: { cookie: adminCookie },
      });
      expect(indicatorsPdf.statusCode).toBe(200);
      expect(indicatorsPdf.headers['content-type']).toContain('application/pdf');

      const indicatorsXlsx = await app.inject({
        method: 'GET',
        url: '/api/export/indicadores/excel',
        headers: { cookie: adminCookie },
      });
      expect(indicatorsXlsx.statusCode).toBe(200);
      expect(indicatorsXlsx.headers['content-type']).toContain('spreadsheetml');
      expect(indicatorsXlsx.rawPayload.length).toBeGreaterThan(0);

      const standardsXlsx = await app.inject({
        method: 'GET',
        url: '/api/export/estandares/excel',
        headers: { cookie: adminCookie },
      });
      expect(standardsXlsx.statusCode).toBe(200);

      const workerDenied = await app.inject({
        method: 'GET',
        url: '/api/export/indicadores',
        headers: { cookie: workerCookie },
      });
      expect(workerDenied.statusCode).toBe(403);
    });

    it('importa trabajadores, riesgos e incidentes desde Excel a PostgreSQL', async () => {
      const preview = await app.inject({
        method: 'POST',
        url: '/api/import/preview',
        headers: { cookie: adminCookie, ...xlsxFormHeaders() },
        payload: await xlsxFormPayload([
          { tipo_documento: 'CC', numero_documento: '987654321', nombres: 'Ana', apellidos: 'Gómez', cargo: 'Técnica', fecha_ingreso: '2026-01-10' },
        ]),
      });
      expect(preview.statusCode).toBe(200);
      expect(preview.json().totalRows).toBe(1);
      expect(preview.json().headers).toContain('numero_documento');

      const workers = await app.inject({
        method: 'POST',
        url: '/api/import/trabajadores',
        headers: { cookie: adminCookie, ...xlsxFormHeaders() },
        payload: await xlsxFormPayload([
          { tipo_documento: 'CC', numero_documento: '987654321', nombres: 'Ana', apellidos: 'Gómez', cargo: 'Técnica', fecha_ingreso: '2026-01-10', email: 'ana@empresa.com' },
          { tipo_documento: 'CC', numero_documento: '987654321', nombres: 'Ana', apellidos: 'Gómez', cargo: 'Técnica', fecha_ingreso: '2026-01-10' },
        ]),
      });
      expect(workers.statusCode).toBe(200);
      expect(workers.json().importados).toBe(1);
      expect(workers.json().errores).toHaveLength(1);
      const importedWorker = await one<{ email: string }>(
        'SELECT email FROM workers WHERE numero_documento = ?',
        ['987654321']
      );
      expect(importedWorker?.email).toBe('ana@empresa.com');

      const risks = await app.inject({
        method: 'POST',
        url: '/api/import/riesgos',
        headers: { cookie: adminCookie, ...xlsxFormHeaders() },
        payload: await xlsxFormPayload([
          { cargo_oficio: 'Técnica', area: 'Obra Norte', peligro_texto: 'Trabajo en altura', tarea: 'Instalación', valoracion_riesgo: 'alto' },
        ]),
      });
      expect(risks.statusCode).toBe(200);
      expect(risks.json().importados).toBe(1);
      expect(
        await one('SELECT id FROM hazard_assessments WHERE peligro_texto = ?', ['Trabajo en altura'])
      ).toBeTruthy();

      const incidents = await app.inject({
        method: 'POST',
        url: '/api/import/incidentes',
        headers: { cookie: adminCookie, ...xlsxFormHeaders() },
        payload: await xlsxFormPayload([
          { tipo: 'incidente', fecha_ocurrencia: '2026-07-01', descripcion: 'Escalera mal apoyada', estado: 'abierto' },
        ]),
      });
      expect(incidents.statusCode).toBe(200);
      expect(incidents.json().importados).toBe(1);
      expect(
        await one('SELECT id FROM incidents WHERE descripcion = ?', ['Escalera mal apoyada'])
      ).toBeTruthy();

      const denied = await app.inject({
        method: 'POST',
        url: '/api/import/preview',
        headers: { cookie: workerCookie, ...xlsxFormHeaders() },
        payload: await xlsxFormPayload([{ col: 'x' }]),
      });
      expect(denied.statusCode).toBe(403);
    });

    it('gestiona avisos de privacidad con visibilidad por rol en PostgreSQL', async () => {
      const draft = await app.inject({
        method: 'POST',
        url: '/api/privacy/notices',
        headers: adminHeaders(),
        payload: {
          titulo: 'Aviso de privacidad 2026',
          contenido:
            'La empresa trata los datos personales de sus trabajadores conforme a la Ley 1581 de 2012 y su decreto reglamentario.',
          fecha_vigencia: '2026-01-01',
          estado: 'borrador',
        },
      });
      expect(draft.statusCode).toBe(200);
      const noticeId = draft.json().id as string;
      expect(draft.json()).toMatchObject({ version: 1, estado: 'borrador' });

      const noActive = await app.inject({
        method: 'GET',
        url: '/api/privacy/notices/active',
        headers: { cookie: workerCookie },
      });
      expect(noActive.statusCode).toBe(404);

      const activated = await app.inject({
        method: 'PUT',
        url: `/api/privacy/notices/${noticeId}`,
        headers: adminHeaders(),
        payload: { estado: 'vigente' },
      });
      expect(activated.statusCode).toBe(200);

      const active = await app.inject({
        method: 'GET',
        url: '/api/privacy/notices/active',
        headers: { cookie: workerCookie },
      });
      expect(active.statusCode).toBe(200);
      expect(active.json()).toMatchObject({ id: noticeId, estado: 'vigente' });

      // El trabajador solo ve el aviso vigente.
      const workerList = await app.inject({
        method: 'GET',
        url: '/api/privacy/notices',
        headers: { cookie: workerCookie },
      });
      expect(workerList.json()).toHaveLength(1);

      const adminDetailDenied = await app.inject({
        method: 'GET',
        url: `/api/privacy/notices/${noticeId}`,
        headers: { cookie: workerCookie },
      });
      expect(adminDetailDenied.statusCode).toBe(403);

      const adminDetail = await app.inject({
        method: 'GET',
        url: `/api/privacy/notices/${noticeId}`,
        headers: { cookie: adminCookie },
      });
      expect(adminDetail.statusCode).toBe(200);
    });

    it('tramita solicitudes ARCO con RBAC, estadísticas y respuesta en PostgreSQL', async () => {
      const own = await app.inject({
        method: 'POST',
        url: '/api/privacy/arco',
        headers: workerHeaders(),
        payload: {
          worker_id: 'user-worker',
          tipo: 'acceso',
          descripcion: 'Solicito copia de mis datos personales tratados por la empresa.',
          responsable: 'Trabajador',
        },
      });
      expect(own.statusCode).toBe(200);
      const arcoId = own.json().id as string;
      expect(own.json()).toMatchObject({ estado: 'pendiente', tipo: 'acceso' });

      const other = await app.inject({
        method: 'POST',
        url: '/api/privacy/arco',
        headers: workerHeaders(),
        payload: {
          worker_id: 'otro-trabajador',
          tipo: 'cancelacion',
          descripcion: 'Solicitud creada para un tercero sin autorización válida.',
          responsable: 'Trabajador',
        },
      });
      expect(other.statusCode).toBe(403);

      const workerList = await app.inject({
        method: 'GET',
        url: '/api/privacy/arco',
        headers: { cookie: workerCookie },
      });
      expect(workerList.json()).toHaveLength(1);

      const stats = await app.inject({
        method: 'GET',
        url: '/api/privacy/arco/stats',
        headers: { cookie: adminCookie },
      });
      expect(stats.json()).toMatchObject({ total: 1, pendientes: 1, por_tipo: { acceso: 1 } });

      const resolved = await app.inject({
        method: 'PUT',
        url: `/api/privacy/arco/${arcoId}`,
        headers: adminHeaders(),
        payload: { estado: 'resuelto', respuesta: 'Se entrega copia de los datos al titular.' },
      });
      expect(resolved.statusCode).toBe(200);
      expect(resolved.json().estado).toBe('resuelto');
      expect(resolved.json().fecha_respuesta).toBeTruthy();

      const detail = await app.inject({
        method: 'GET',
        url: `/api/privacy/arco/${arcoId}`,
        headers: { cookie: workerCookie },
      });
      expect(detail.statusCode).toBe(200);

      const statsAfter = await app.inject({
        method: 'GET',
        url: '/api/privacy/arco/stats',
        headers: { cookie: adminCookie },
      });
      expect(statsAfter.json()).toMatchObject({ total: 1, pendientes: 0, resueltos: 1 });
    });

    it('mantiene el registro de tratamiento de datos con JSON persistido en PostgreSQL', async () => {
      const denied = await app.inject({
        method: 'POST',
        url: '/api/privacy/processing',
        headers: workerHeaders(),
        payload: {
          entidad: 'workers',
          finalidad: 'Gestionar la vinculación laboral',
          categorias_datos: ['identificacion'],
          base_legal: 'contrato',
          medidas_seguridad: ['control de acceso'],
          retencion_dias: 365,
        },
      });
      expect(denied.statusCode).toBe(403);

      const created = await app.inject({
        method: 'POST',
        url: '/api/privacy/processing',
        headers: adminHeaders(),
        payload: {
          entidad: 'workers',
          finalidad: 'Gestionar la vinculación laboral y la seguridad social',
          categorias_datos: ['identificacion', 'laborales'],
          base_legal: 'contrato',
          destinatarios: ['ARL', 'EPS'],
          transferencias_internacionales: false,
          medidas_seguridad: ['control de acceso', 'cifrado'],
          retencion_dias: 730,
        },
      });
      expect(created.statusCode).toBe(200);
      const recordId = created.json().id as string;
      expect(created.json().categorias_datos).toEqual(['identificacion', 'laborales']);
      expect(created.json().destinatarios).toEqual(['ARL', 'EPS']);

      const updated = await app.inject({
        method: 'PUT',
        url: `/api/privacy/processing/${recordId}`,
        headers: adminHeaders(),
        payload: {
          categorias_datos: ['identificacion', 'laborales', 'medicos'],
          transferencias_internacionales: true,
          pais_destino: 'Estados Unidos',
        },
      });
      expect(updated.statusCode).toBe(200);
      expect(updated.json()).toMatchObject({
        transferencias_internacionales: 1,
        pais_destino: 'Estados Unidos',
      });
      expect(updated.json().categorias_datos).toContain('medicos');

      const list = await app.inject({
        method: 'GET',
        url: '/api/privacy/processing',
        headers: { cookie: adminCookie },
      });
      expect(list.json()).toHaveLength(1);

      const deleted = await app.inject({
        method: 'DELETE',
        url: `/api/privacy/processing/${recordId}`,
        headers: { cookie: adminCookie },
      });
      expect(deleted.statusCode).toBe(200);
      expect(
        await one('SELECT id FROM data_processing_records WHERE id = ?', [recordId])
      ).toBeUndefined();
    });

    it('reporta cumplimiento de consentimientos y tratamiento en PostgreSQL', async () => {
      for (const tipo of ['medico', 'biometrico']) {
        const consent = await app.inject({
          method: 'POST',
          url: '/api/privacy/consents',
          headers: workerHeaders(),
          payload: {
            worker_id: 'user-worker',
            tipo,
            finalidad: 'Autorizo el tratamiento de mis datos para el SG-SST.',
            autorizado: 1,
            medio: 'digital',
            version_aviso: 'v1',
          },
        });
        expect(consent.statusCode).toBe(200);
      }

      const check = await app.inject({
        method: 'GET',
        url: '/api/privacy/consent/check/user-worker',
        headers: { cookie: adminCookie },
      });
      expect(check.statusCode).toBe(200);
      expect(check.json()).toEqual({ valid: true, missing: [] });

      await app.inject({
        method: 'POST',
        url: '/api/privacy/notices',
        headers: adminHeaders(),
        payload: {
          titulo: 'Aviso de privacidad 2026',
          contenido:
            'La empresa trata los datos personales de sus trabajadores conforme a la Ley 1581 de 2012.',
          fecha_vigencia: '2026-01-01',
          estado: 'vigente',
        },
      });

      const report = await app.inject({
        method: 'GET',
        url: '/api/privacy/compliance',
        headers: { cookie: adminCookie },
      });
      expect(report.statusCode).toBe(200);
      expect(report.json()).toMatchObject({
        workers_without_medical_consent: 0,
        workers_without_biometric_consent: 0,
        total_workers: 1,
        arco_pending: 0,
        notices_count: 1,
        processing_records_count: 0,
      });
    });

    it('respalda y restaura PostgreSQL con verificación de integridad', async () => {
      const root = mkdtempSync(join(tmpdir(), 'sg-sst-pg-backup-'));
      const backupDir = join(root, 'backups');
      const uploadsDir = join(root, 'uploads');
      mkdirSync(uploadsDir, { recursive: true });
      writeFileSync(join(uploadsDir, 'evidencia.txt'), 'adjunto de prueba', 'utf8');
      const config = { backupDir, uploadsDir, retentionDays: 30, timezone: 'America/Bogota' };

      try {
        const company = await app.inject({
          method: 'POST',
          url: '/api/companies',
          headers: adminHeaders(),
          payload: empresaBase,
        });
        expect(company.statusCode).toBe(200);

        const worker = await app.inject({
          method: 'POST',
          url: '/api/workers',
          headers: adminHeaders(),
          payload: {
            numero_documento: '555000111',
            nombres: 'Ana',
            apellidos: 'Respaldo',
            cargo: 'Técnica',
            fecha_ingreso: '2025-05-01',
          },
        });
        expect(worker.statusCode).toBe(200);

        const created = await createPgBackup(config);
        expect(created.success).toBe(true);
        expect(created.file).toBeTruthy();
        const backupName = basename(created.file!);

        const valid = validatePgBackup(config, backupName);
        expect(valid.success).toBe(true);
        const manifest = valid.manifest!;
        expect(manifest.backend).toBe('postgresql');
        expect(manifest.tables.find((table) => table.name === 'workers')?.rows).toBe(2);
        expect(manifest.tables.find((table) => table.name === 'companies')?.rows).toBe(1);

        // Un respaldo alterado no pasa la validación de checksum.
        const tamperedDir = join(root, 'tampered');
        cpSync(backupDir, tamperedDir, { recursive: true });
        writeFileSync(
          join(tamperedDir, backupName, 'data', 'workers.jsonl.gz'),
          gzipSync(Buffer.from('{"id":"alterado"}\n', 'utf8'))
        );
        const tampered = validatePgBackup({ ...config, backupDir: tamperedDir }, backupName);
        expect(tampered.success).toBe(false);
        expect(tampered.error).toContain('checksum');

        // Entorno limpio: se vacían los datos y se elimina el adjunto.
        await exec(`TRUNCATE TABLE ${manifest.order.map(quoteIdent).join(', ')} CASCADE`);
        rmSync(join(uploadsDir, 'evidencia.txt'));
        expect((await one<{ c: number }>('SELECT COUNT(*)::int AS c FROM workers'))?.c).toBe(0);

        const restored = await restorePgBackup(config, backupName);
        expect(restored.success).toBe(true);
        expect((await one<{ c: number }>('SELECT COUNT(*)::int AS c FROM workers'))?.c).toBe(2);
        expect((await one<{ c: number }>('SELECT COUNT(*)::int AS c FROM companies'))?.c).toBe(1);
        expect(existsSync(join(uploadsDir, 'evidencia.txt'))).toBe(true);

        const workerRow = await one<{ nombres: string }>(
          'SELECT nombres FROM workers WHERE numero_documento = ?',
          ['555000111']
        );
        expect(workerRow?.nombres).toBe('Ana');
        const row = await one<{ razon_social: string }>('SELECT razon_social FROM companies');
        expect(row?.razon_social).toBe(empresaBase.razon_social);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }
);
