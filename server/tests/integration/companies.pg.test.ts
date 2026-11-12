import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import pg from 'pg';

import { createTestDb, cleanDb } from '../setup.js';
import { requireAuth } from '../../src/lib/auth.js';
import companiesRoutes from '../../src/routes/companies.js';
import { closePgPool, exec, isPgBackend, one, runPgMigrations } from '../../src/lib/db-pg.js';

/**
 * Fase N2 — prueba de integración del piloto de empresas contra PostgreSQL.
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
  'Fase N2 - Piloto companies contra PostgreSQL (Neon)',
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

      // App: autenticación sigue en SQLite (transición N2-N3), datos en Postgres.
      app = Fastify({ logger: false });
      await app.register(cookie, { secret: 'test-secret' });
      app.decorate('db', createTestDb());
      app.addHook('preHandler', requireAuth);
      await app.register(companiesRoutes, { prefix: '/api' });
      await app.ready();

      adminCookie = 'sg_sst_user=user-admin; sg_sst_email=admin@sg-sst.local';
      workerCookie = 'sg_sst_user=user-worker; sg_sst_email=worker@sg-sst.local';
    });

    beforeEach(async () => {
      if (!TEST_DATABASE_URL) return;

      // Auth en SQLite (limpio en cada prueba)
      cleanDb(app.db);
      app.db
        .prepare('INSERT INTO users (id, email, nombre, rol, password_hash) VALUES (?,?,?,?,?)')
        .run('user-admin', 'admin@sg-sst.local', 'Administrador', 'administrador', 'hash');
      app.db
        .prepare('INSERT INTO users (id, email, nombre, rol, password_hash) VALUES (?,?,?,?,?)')
        .run('user-worker', 'worker@sg-sst.local', 'Trabajador', 'trabajador', 'hash');

      // Datos en Postgres: se limpian las tablas del piloto (users incluida)
      await closePgPool();
      const pool = new pg.Pool({ connectionString: scratchUrl.href, max: 1 });
      await pool.query('TRUNCATE companies, audit_logs, users CASCADE');
      await pool.end();

      // El usuario debe existir también en Postgres (FK de audit_logs)
      await exec('INSERT INTO users (id, email, nombre, rol, password_hash) VALUES (?,?,?,?,?)', [
        'user-admin',
        'admin@pg.local',
        'Administrador',
        'administrador',
        'hash',
      ]);
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
  }
);
