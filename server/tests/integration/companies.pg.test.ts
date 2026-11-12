import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import pg from 'pg';

import { createTestDb, cleanDb } from '../setup.js';
import { requireAuth } from '../../src/lib/auth.js';
import companiesRoutes from '../../src/routes/companies.js';
import usersRoutes from '../../src/routes/users.js';
import rolesRoutes from '../../src/routes/roles.js';
import workersRoutes from '../../src/routes/workers.js';
import workersItemsRoutes from '../../src/routes/workers_items.js';
import privacyRoutes from '../../src/routes/privacy.js';
import { auditLogsRoutes } from '../../src/routes/documents_actions_audits_alerts.js';
import { closePgPool, exec, isPgBackend, one, runPgMigrations } from '../../src/lib/db-pg.js';
import { decrypt } from '../../src/lib/crypto.js';
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
      app.decorate('db', createTestDb());
      app.addHook('preHandler', requireAuth);
      await app.register(usersRoutes, { prefix: '/api' });
      await app.register(companiesRoutes, { prefix: '/api' });
      await app.register(rolesRoutes, { prefix: '/api' });
      await app.register(workersRoutes, { prefix: '/api' });
      await app.register(workersItemsRoutes, { prefix: '/api' });
      await app.register(privacyRoutes, { prefix: '/api' });
      await app.register(auditLogsRoutes, { prefix: '/api' });
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
      await pool.query('TRUNCATE companies, audit_logs, roles, users, workers CASCADE');
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
  }
);
