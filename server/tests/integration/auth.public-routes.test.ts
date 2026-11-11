import { createHash } from 'node:crypto';

import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { isPublicPath, requireAuth } from '../../src/lib/auth.js';
import usersRoutes from '../../src/routes/users.js';
import { cleanDb, createTestDb } from '../setup.js';

describe('Autenticación - rutas públicas', () => {
  let app: ReturnType<typeof Fastify>;
  let db: ReturnType<typeof createTestDb>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(cookie, { secret: 'test-secret' });

    db = createTestDb();
    app.decorate('db', db);

    // Mismo orden que server/src/index.ts: hook global antes de las rutas.
    app.addHook('preHandler', requireAuth);
    app.get('/api/protegida', async () => ({ ok: true }));

    await app.register(usersRoutes, { prefix: '/api' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    cleanDb(db);
  });

  it('permite el login sin sesión y entrega la cookie', async () => {
    const passwordHash = createHash('sha256').update('Admin1234!').digest('hex');
    db.prepare(
      'INSERT INTO users (id, email, nombre, rol, password_hash) VALUES (?, ?, ?, ?, ?)'
    ).run('user-admin', 'admin@sg-sst.local', 'Responsable SG-SST', 'administrador', passwordHash);

    const response = await app.inject({
      method: 'POST',
      url: '/api/users/login',
      payload: { email: 'admin@sg-sst.local', password: 'Admin1234!' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      email: 'admin@sg-sst.local',
      rol: 'administrador',
    });

    const setCookie = response.headers['set-cookie'];
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie ?? '');
    expect(cookieHeader).toContain('sg_sst_user=user-admin');
  });

  it('permite el registro inicial sin sesión', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/users/register',
      payload: {
        email: 'nuevo@sg-sst.local',
        password: 'Secreta123',
        nombre: 'Nuevo usuario',
        rol: 'administrador',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ email: 'nuevo@sg-sst.local' });
  });

  it('mantiene protegidas las demás rutas', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/protegida' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'No autenticado' });
  });

  it('reconoce la ruta exacta y tolera query string', () => {
    expect(isPublicPath('/api/health')).toBe(true);
    expect(isPublicPath('/api/health?probe=1')).toBe(true);
    expect(isPublicPath('/api/users/login')).toBe(true);
    expect(isPublicPath('/api/users/register')).toBe(true);
    expect(isPublicPath('/api/users')).toBe(false);
    expect(isPublicPath('/api/users/login/extra')).toBe(false);
    expect(isPublicPath('/api/healthz')).toBe(false);
  });
});
