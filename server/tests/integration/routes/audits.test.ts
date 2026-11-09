import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';

import { cleanDb, createTestDb } from '../../setup.js';
import { auditsRoutes } from '../../../src/routes/documents_actions_audits_alerts.js';

describe('Auditorías y hallazgos - Rutas API (Integración)', () => {
  let app: ReturnType<typeof Fastify>;
  let db: ReturnType<typeof createTestDb>;
  let cookieJar: string[] = [];
  let auditId = '';

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(cookie, { secret: 'test-secret' });

    db = createTestDb();
    app.decorate('db', db);

    app.addHook('preHandler', async (request) => {
      request.userId = request.cookies['sg_sst_user'] ?? undefined;
      request.userEmail = request.cookies['sg_sst_email'] ?? undefined;
    });

    await app.register(auditsRoutes, { prefix: '/api' });
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

    const audit = await app.inject({
      method: 'POST',
      url: '/api/audits',
      headers: { ...getHeaders(), 'content-type': 'application/json' },
      payload: {
        anio: 2026,
        tipo: 'interna',
        fecha: '2026-05-01',
        auditor: 'Auditor interno',
        alcance: 'SG-SST completo',
        estado: 'realizada',
      },
    });
    auditId = (JSON.parse(audit.body) as { id: string }).id;
  });

  const getHeaders = () => ({ cookie: cookieJar.join('; ') });

  it('crea una auditoría y la lista', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/audits', headers: getHeaders() });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ anio: 2026, tipo: 'interna', estado: 'realizada' });
  });

  it('registra un hallazgo y lo recupera por auditoría', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/audits/${auditId}/findings`,
      headers: { ...getHeaders(), 'content-type': 'application/json' },
      payload: {
        descripcion: 'No se evidencia matriz de peligros actualizada',
        tipo: 'no_conformidad',
        requisito: 'Res. 0312/2019 E4',
        responsable: 'Responsable SG-SST',
        fecha_limite: '2026-12-31',
        accion_correctiva: 'Actualizar la matriz y capacitar al personal',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.descripcion).toContain('matriz de peligros');
    expect(body.estado).toBe('abierto');

    const list = await app.inject({
      method: 'GET',
      url: `/api/audits/${auditId}/findings`,
      headers: getHeaders(),
    });
    expect(list.statusCode).toBe(200);
    expect(JSON.parse(list.body)).toHaveLength(1);
  });

  it('actualiza el estado de un hallazgo y lo refleja en el resumen', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/api/audits/${auditId}/findings`,
      headers: { ...getHeaders(), 'content-type': 'application/json' },
      payload: {
        descripcion: 'Hallazgo de prueba para actualizar estado',
        tipo: 'observacion',
        responsable: 'Responsable SG-SST',
        fecha_limite: '2026-12-31',
      },
    });
    const findingId = (JSON.parse(created.body) as { id: string }).id;

    const updated = await app.inject({
      method: 'PUT',
      url: `/api/audits/${auditId}/findings/${findingId}`,
      headers: { ...getHeaders(), 'content-type': 'application/json' },
      payload: { estado: 'verificado', fecha_cierre: '2026-06-01' },
    });
    expect(updated.statusCode).toBe(200);
    expect((JSON.parse(updated.body) as { estado: string }).estado).toBe('verificado');

    const summary = await app.inject({
      method: 'GET',
      url: '/api/audits/findings/summary',
      headers: getHeaders(),
    });
    expect(summary.statusCode).toBe(200);
    expect(JSON.parse(summary.body)).toMatchObject({ total: 1, verificados: 1, abiertos: 0 });
  });

  it('elimina un hallazgo', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/api/audits/${auditId}/findings`,
      headers: { ...getHeaders(), 'content-type': 'application/json' },
      payload: {
        descripcion: 'Hallazgo de prueba para eliminar',
        tipo: 'fortaleza',
        responsable: 'Responsable SG-SST',
        fecha_limite: '2026-12-31',
      },
    });
    const findingId = (JSON.parse(created.body) as { id: string }).id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/audits/${auditId}/findings/${findingId}`,
      headers: getHeaders(),
    });
    expect(res.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: `/api/audits/${auditId}/findings`,
      headers: getHeaders(),
    });
    expect(JSON.parse(list.body)).toHaveLength(0);
  });

  it('eliminar la auditoría elimina sus hallazgos asociados', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/audits/${auditId}/findings`,
      headers: { ...getHeaders(), 'content-type': 'application/json' },
      payload: {
        descripcion: 'Hallazgo que debe desaparecer con la auditoría',
        tipo: 'observacion',
        responsable: 'Responsable SG-SST',
        fecha_limite: '2026-12-31',
      },
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/audits/${auditId}`,
      headers: getHeaders(),
    });
    expect(res.statusCode).toBe(200);

    const remaining = db.prepare('SELECT COUNT(*) AS c FROM audit_findings').get() as { c: number };
    expect(remaining.c).toBe(0);
  });

  it('valida la descripción mínima de un hallazgo', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/audits/${auditId}/findings`,
      headers: { ...getHeaders(), 'content-type': 'application/json' },
      payload: {
        descripcion: 'cort',
        tipo: 'observacion',
        responsable: 'Responsable SG-SST',
        fecha_limite: '2026-12-31',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('exige autenticación para consultar hallazgos', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/audits/${auditId}/findings`,
    });
    expect(res.statusCode).toBe(401);
  });
});
