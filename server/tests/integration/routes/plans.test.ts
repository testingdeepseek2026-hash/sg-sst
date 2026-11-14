import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import Fastify from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { requireAuth } from '../../../src/lib/auth.js';
import plansRoutes from '../../../src/routes/plans.js';
import { cleanDb, createTestDb } from '../../setup.js';

describe('Plan anual - Fase 2 (programa, evidencia, meses, soportes)', () => {
  let app: ReturnType<typeof Fastify>;
  let db: ReturnType<typeof createTestDb>;
  let cookies: string[];
  const archivosSubidos: string[] = [];

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(cookie, { secret: 'test-secret' });
    await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

    db = createTestDb();
    app.decorate('db', db);

    app.addHook('preHandler', requireAuth);
    await app.register(plansRoutes, { prefix: '/api' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    for (const url of archivosSubidos) {
      // url forma: /uploads/plan-anual/<archivo>
      const ruta = join(process.cwd(), ...url.replace(/^\//, '').split('/'));
      await unlink(ruta).catch(() => undefined);
    }
  });

  beforeEach(() => {
    cleanDb(db);
    db.prepare('INSERT INTO users (id, email, nombre, rol, password_hash) VALUES (?, ?, ?, ?, ?)')
      .run('user-admin', 'admin@test.com', 'Admin', 'administrador', 'hash');
    db.prepare('INSERT INTO users (id, email, nombre, rol, password_hash) VALUES (?, ?, ?, ?, ?)')
      .run('user-worker', 'trabajador@test.com', 'Trabajador', 'trabajador', 'hash');
    cookies = ['sg_sst_user=user-admin', 'sg_sst_email=admin@test.com'];
  });

  const headers = (user = cookies) => ({ cookie: user.join('; ') });
  const workerHeaders = { cookie: ['sg_sst_user=user-worker', 'sg_sst_email=trabajador@test.com'].join('; ') };

  async function crearActividad(extra: Record<string, unknown> = {}) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/plans/annual',
      headers: headers(),
      payload: {
        anio: 2026,
        objetivo: 'Reducir la accidentalidad laboral',
        meta: 'Cero accidentes graves en la vigencia',
        responsable: 'Vigía SST',
        fecha_inicio: '2026-01-01',
        fecha_fin: '2026-12-31',
        ...extra,
      },
    });
    expect(res.statusCode).toBe(200);
    return JSON.parse(res.body);
  }

  it('crea actividad con programa, evidencia esperada y cronograma mensual', async () => {
    const plan = await crearActividad({
      programa: 'POLÍTICA DEL SISTEMA DE GESTIÓN',
      evidencia_esperada: 'Creación de procedimiento',
      meses: [2, 5, 8],
    });
    expect(plan.programa).toBe('POLÍTICA DEL SISTEMA DE GESTIÓN');
    expect(plan.evidencia_esperada).toBe('Creación de procedimiento');
    expect(JSON.parse(plan.meses)).toEqual([2, 5, 8]);

    const lista = JSON.parse(
      (await app.inject({ method: 'GET', url: '/api/plans/annual?anio=2026', headers: headers() })).body
    );
    expect(lista).toHaveLength(1);
    expect(lista[0].programa).toBe('POLÍTICA DEL SISTEMA DE GESTIÓN');
  });

  it('actualiza el cronograma mensual y puede dejarlo vacío', async () => {
    const plan = await crearActividad({ meses: [1, 6] });
    const editado = JSON.parse(
      (
        await app.inject({
          method: 'PUT',
          url: `/api/plans/annual/${plan.id}`,
          headers: headers(),
          payload: { meses: [3, 7, 11], estado: 'en_proceso' },
        })
      ).body
    );
    expect(JSON.parse(editado.meses)).toEqual([3, 7, 11]);
    expect(editado.estado).toBe('en_proceso');

    const limpio = JSON.parse(
      (
        await app.inject({
          method: 'PUT',
          url: `/api/plans/annual/${plan.id}`,
          headers: headers(),
          payload: { meses: [] },
        })
      ).body
    );
    expect(limpio.meses).toBeNull();
  });

  it('rechaza meses fuera de rango', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/plans/annual',
      headers: headers(),
      payload: {
        anio: 2026,
        objetivo: 'Objetivo válido',
        fecha_inicio: '2026-01-01',
        meses: [0, 13],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('sube, lista y elimina el soporte de una actividad', async () => {
    const plan = await crearActividad();
    const boundary = '----sgsstboundary';
    const res = await app.inject({
      method: 'POST',
      url: `/api/plans/annual/${plan.id}/evidencias`,
      headers: { ...headers(), 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload:
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="acta.pdf"\r\n` +
        'Content-Type: application/pdf\r\n\r\n%PDF-1.4 contenido-de-prueba\r\n' +
        `--${boundary}--\r\n`,
    });
    expect(res.statusCode).toBe(200);
    const evidencia = JSON.parse(res.body);
    expect(evidencia.plan_id).toBe(plan.id);
    expect(evidencia.nombre_original).toBe('acta.pdf');
    expect(evidencia.url).toMatch(/^\/uploads\/plan-anual\//);
    expect(evidencia.subido_por).toBe('admin@test.com');
    archivosSubidos.push(evidencia.url);

    const lista = JSON.parse(
      (
        await app.inject({
          method: 'GET',
          url: `/api/plans/annual/${plan.id}/evidencias`,
          headers: headers(),
        })
      ).body
    );
    expect(lista).toHaveLength(1);

    const todas = JSON.parse(
      (await app.inject({ method: 'GET', url: '/api/plans/annual/evidencias', headers: headers() })).body
    );
    expect(todas).toHaveLength(1);

    const borrado = await app.inject({
      method: 'DELETE',
      url: `/api/plans/annual/evidencias/${evidencia.id}`,
      headers: headers(),
    });
    expect(borrado.statusCode).toBe(200);

    const listaFinal = JSON.parse(
      (
        await app.inject({
          method: 'GET',
          url: `/api/plans/annual/${plan.id}/evidencias`,
          headers: headers(),
        })
      ).body
    );
    expect(listaFinal).toHaveLength(0);
  });

  it('rechaza la subida sin archivo y para una actividad inexistente', async () => {
    const plan = await crearActividad();
    const sinArchivo = await app.inject({
      method: 'POST',
      url: `/api/plans/annual/${plan.id}/evidencias`,
      headers: headers(),
    });
    expect(sinArchivo.statusCode).toBe(400);

    const inexistente = await app.inject({
      method: 'POST',
      url: '/api/plans/annual/id-que-no-existe/evidencias',
      headers: headers(),
    });
    expect(inexistente.statusCode).toBe(404);
  });

  it('exige rol administrador para subir y eliminar soportes', async () => {
    const plan = await crearActividad();
    const subida = await app.inject({
      method: 'POST',
      url: `/api/plans/annual/${plan.id}/evidencias`,
      headers: workerHeaders,
    });
    expect(subida.statusCode).toBe(403);

    const eliminacion = await app.inject({
      method: 'DELETE',
      url: '/api/plans/annual/evidencias/id-falso',
      headers: workerHeaders,
    });
    expect(eliminacion.statusCode).toBe(403);
  });
});
