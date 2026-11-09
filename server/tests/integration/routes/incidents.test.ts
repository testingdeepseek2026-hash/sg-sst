import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';

import { cleanDb, createTestDb } from '../../setup.js';
import incidentsRoutes from '../../../src/routes/incidents.js';

describe('Incidentes y acciones - Rutas API (Integración)', () => {
  let app: ReturnType<typeof Fastify>;
  let db: ReturnType<typeof createTestDb>;
  let cookieJar: string[] = [];
  let incidentId = '';

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(cookie, { secret: 'test-secret' });

    db = createTestDb();
    app.decorate('db', db);

    app.addHook('preHandler', async (request) => {
      request.userId = request.cookies['sg_sst_user'] ?? undefined;
      request.userEmail = request.cookies['sg_sst_email'] ?? undefined;
    });

    await app.register(incidentsRoutes, { prefix: '/api' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    cleanDb(db);
    cookieJar = [];

    db.prepare('INSERT INTO users (id, email, nombre, rol, password_hash) VALUES (?, ?, ?, ?, ?)')
      .run('user-admin', 'admin@test.com', 'Admin', 'administrador', 'hash');

    cookieJar = ['sg_sst_user=user-admin', 'sg_sst_email=admin@test.com'];

    const res = await app.inject({
      method: 'POST',
      url: '/api/incidents',
      headers: { ...getHeaders(), 'content-type': 'application/json' },
      payload: {
        tipo: 'accidente',
        fecha_ocurrencia: '2026-05-10',
        trabajador_id: null,
        lugar: 'Obra prueba',
        descripcion: 'Caída de escalera durante la instalación',
        dias_perdidos: 2,
        estado: 'investigando',
      },
    });
    incidentId = (JSON.parse(res.body) as { id: string }).id;
  });

  const getHeaders = () => ({ cookie: cookieJar.join('; ') });

  it('crea un incidente y lo lista', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/incidents', headers: getHeaders() });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ tipo: 'accidente', dias_perdidos: 2, estado: 'investigando' });
  });

  it('crea un incidente sin trabajador (trabajador_id vacío se guarda como null)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/incidents',
      headers: { ...getHeaders(), 'content-type': 'application/json' },
      payload: {
        tipo: 'incidente',
        fecha_ocurrencia: '2026-06-01',
        trabajador_id: '',
        descripcion: 'Incidente sin trabajador afectado',
      },
    });
    expect(res.statusCode).toBe(200);
    expect((JSON.parse(res.body) as { trabajador_id: string | null }).trabajador_id).toBeNull();
  });

  it('rechaza un trabajador inexistente por clave foránea', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/incidents',
      headers: { ...getHeaders(), 'content-type': 'application/json' },
      payload: {
        tipo: 'incidente',
        fecha_ocurrencia: '2026-06-01',
        trabajador_id: 'worker-inexistente',
        descripcion: 'Incidente con trabajador no registrado',
      },
    });
    expect(res.statusCode).toBe(500);
  });

  it('registra una acción correctiva y la recupera', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/incidents/${incidentId}/actions`,
      headers: { ...getHeaders(), 'content-type': 'application/json' },
      payload: {
        descripcion: 'Reemplazar la escalera y capacitar al personal',
        responsable: 'Responsable SG-SST',
        fecha_limite: '2026-12-01',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.descripcion).toContain('escalera');
    expect(body.estado).toBe('pendiente');

    const list = await app.inject({
      method: 'GET',
      url: `/api/incidents/${incidentId}/actions`,
      headers: getHeaders(),
    });
    expect(list.statusCode).toBe(200);
    expect(JSON.parse(list.body)).toHaveLength(1);
  });

  it('actualiza una acción y la marca como completada', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/api/incidents/${incidentId}/actions`,
      headers: { ...getHeaders(), 'content-type': 'application/json' },
      payload: {
        descripcion: 'Acción de prueba para completar',
        responsable: 'Responsable SG-SST',
        fecha_limite: '2026-12-01',
      },
    });
    const actionId = (JSON.parse(created.body) as { id: string }).id;

    const updated = await app.inject({
      method: 'PUT',
      url: `/api/incidents/${incidentId}/actions/${actionId}`,
      headers: { ...getHeaders(), 'content-type': 'application/json' },
      payload: { estado: 'completada', completada_en: '2026-06-20T10:00:00.000Z' },
    });
    expect(updated.statusCode).toBe(200);
    expect(JSON.parse(updated.body)).toMatchObject({ estado: 'completada' });
  });

  it('elimina una acción', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/api/incidents/${incidentId}/actions`,
      headers: { ...getHeaders(), 'content-type': 'application/json' },
      payload: {
        descripcion: 'Acción de prueba para eliminar',
        responsable: 'Responsable SG-SST',
        fecha_limite: '2026-12-01',
      },
    });
    const actionId = (JSON.parse(created.body) as { id: string }).id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/incidents/${incidentId}/actions/${actionId}`,
      headers: getHeaders(),
    });
    expect(res.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: `/api/incidents/${incidentId}/actions`,
      headers: getHeaders(),
    });
    expect(JSON.parse(list.body)).toHaveLength(0);
  });

  it('eliminar el incidente elimina sus acciones asociadas', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/incidents/${incidentId}/actions`,
      headers: { ...getHeaders(), 'content-type': 'application/json' },
      payload: {
        descripcion: 'Acción que debe desaparecer con el incidente',
        responsable: 'Responsable SG-SST',
        fecha_limite: '2026-12-01',
      },
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/incidents/${incidentId}`,
      headers: getHeaders(),
    });
    expect(res.statusCode).toBe(200);

    const remaining = db.prepare('SELECT COUNT(*) AS c FROM incident_actions').get() as { c: number };
    expect(remaining.c).toBe(0);
  });

  it('exige autenticación para consultar las acciones', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/incidents/${incidentId}/actions`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('rechaza acciones con descripción demasiado corta', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/incidents/${incidentId}/actions`,
      headers: { ...getHeaders(), 'content-type': 'application/json' },
      payload: {
        descripcion: 'cort',
        responsable: 'Responsable SG-SST',
        fecha_limite: '2026-12-01',
      },
    });
    expect(res.statusCode).toBe(400);
  });
});
