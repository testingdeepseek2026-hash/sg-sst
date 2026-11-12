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
    app.get('/dashboard', async () => ({ page: 'dashboard' }));
    app.get('/uploads/privado.pdf', async () => ({ file: 'privado' }));

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

  it('mantiene la sesión y aplica el rol en las rutas de usuario', async () => {
    const passwordHash = createHash('sha256').update('Admin1234!').digest('hex');
    const insertUser = db.prepare(
      'INSERT INTO users (id, email, nombre, rol, password_hash) VALUES (?, ?, ?, ?, ?)'
    );
    insertUser.run(
      'user-admin',
      'admin@sg-sst.local',
      'Responsable SG-SST',
      'administrador',
      passwordHash
    );
    insertUser.run(
      'user-worker',
      'trabajador@sg-sst.local',
      'Trabajador',
      'trabajador',
      passwordHash
    );

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/users/login',
      payload: { email: 'admin@sg-sst.local', password: 'Admin1234!' },
    });
    const adminSetCookie = adminLogin.headers['set-cookie'];
    const adminCookie = (Array.isArray(adminSetCookie) ? adminSetCookie : [adminSetCookie])
      .map((cookieHeader) => String(cookieHeader).split(';')[0])
      .join('; ');

    const me = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { cookie: adminCookie },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      id: 'user-admin',
      email: 'admin@sg-sst.local',
      rol: 'administrador',
    });

    const adminUsers = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { cookie: adminCookie },
    });
    expect(adminUsers.statusCode).toBe(200);
    expect(adminUsers.json()).toHaveLength(2);
    expect(adminUsers.json()[0]).not.toHaveProperty('password_hash');

    const workerLogin = await app.inject({
      method: 'POST',
      url: '/api/users/login',
      payload: { email: 'trabajador@sg-sst.local', password: 'Admin1234!' },
    });
    const workerSetCookie = workerLogin.headers['set-cookie'];
    const workerCookie = (Array.isArray(workerSetCookie) ? workerSetCookie : [workerSetCookie])
      .map((cookieHeader) => String(cookieHeader).split(';')[0])
      .join('; ');
    const forbiddenUsers = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { cookie: workerCookie },
    });
    expect(forbiddenUsers.statusCode).toBe(403);

    const logout = await app.inject({
      method: 'POST',
      url: '/api/users/logout',
      headers: { cookie: adminCookie },
    });
    expect(logout.statusCode).toBe(200);
    expect(
      db
        .prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE accion = 'logout'")
        .get()
    ).toMatchObject({ count: 1 });
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

  it('permite servir la SPA sin sesión y mantiene privados los archivos subidos', async () => {
    const page = await app.inject({ method: 'GET', url: '/dashboard' });
    const upload = await app.inject({ method: 'GET', url: '/uploads/privado.pdf' });

    expect(page.statusCode).toBe(200);
    expect(page.json()).toEqual({ page: 'dashboard' });
    expect(upload.statusCode).toBe(401);
    expect(upload.json()).toEqual({ error: 'No autenticado' });
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
