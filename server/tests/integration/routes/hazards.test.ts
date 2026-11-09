import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { createTestDb, cleanDb } from '../../setup.js';
import hazardsRoutes from '../../../src/routes/hazards.js';
import * as hazardsService from '../../../src/services/hazards.js';
import { requireAuth } from '../../../src/lib/auth.js';

describe('Peligros (IPERC) - Rutas API (Integración)', () => {
  let app: ReturnType<typeof Fastify>;
  let db: ReturnType<typeof createTestDb>;
  let cookieJar: string[] = [];

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(cookie, { secret: 'test-secret' });

    db = createTestDb();
    app.decorate('db', db);

    // Usar el hook de autenticación centralizado (igual que la app principal)
    app.addHook('preHandler', requireAuth);

    await app.register(hazardsRoutes, { prefix: '/api' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    cleanDb(db);
    cookieJar = [];

    db.prepare('INSERT INTO users (id, email, nombre, rol, password_hash) VALUES (?, ?, ?, ?, ?)')
      .run('user-admin', 'admin@test.com', 'Admin', 'administrador', 'hash');

    cookieJar = ['sg_sst_user=user-admin', 'sg_sst_email=admin@test.com'];
  });

  const getHeaders = () => ({
    cookie: cookieJar.join('; '),
  });

  describe('Catálogo de peligros', () => {
    describe('GET /api/hazards/catalog', () => {
      it('debe retornar catálogo vacío inicialmente', async () => {
        const res = await app.inject({
          method: 'GET',
          url: '/api/hazards/catalog',
          headers: getHeaders(),
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body).toEqual([]);
      });

      it('debe retornar catálogo ordenado por categoría y nombre', async () => {
        hazardsService.createHazardCatalogItem(db, { codigo: 'EL-002', nombre: 'Zebra', categoria: 'electrico' });
        hazardsService.createHazardCatalogItem(db, { codigo: 'EL-001', nombre: 'Alpha', categoria: 'electrico' });
        hazardsService.createHazardCatalogItem(db, { codigo: 'AL-001', nombre: 'Beta', categoria: 'alturas' });

        const res = await app.inject({
          method: 'GET',
          url: '/api/hazards/catalog',
          headers: getHeaders(),
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body).toHaveLength(3);
        expect(body[0].categoria).toBe('alturas');
        expect(body[1].categoria).toBe('electrico');
        expect(body[1].nombre).toBe('Alpha');
        expect(body[2].nombre).toBe('Zebra');
      });
    });

    describe('POST /api/hazards/catalog', () => {
      it('debe crear item en catálogo', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/hazards/catalog',
          headers: { ...getHeaders(), 'content-type': 'application/json' },
          payload: {
            codigo: 'EL-001',
            nombre: 'Contacto con partes vivas',
            categoria: 'electrico',
            descripcion: 'Riesgo de electrocución',
            riesgo_por_defecto: 'alto',
            control_sugerido: 'Desenergizar y bloquear',
          },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.codigo).toBe('EL-001');
        expect(body.nombre).toBe('Contacto con partes vivas');
        expect(body.categoria).toBe('electrico');
        expect(body.riesgo_por_defecto).toBe('alto');
        expect(body.activo).toBe(1);
      });

      it('debe usar valores por defecto', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/hazards/catalog',
          headers: { ...getHeaders(), 'content-type': 'application/json' },
          payload: {
            codigo: 'ER-001',
            nombre: 'Postura forzada',
            categoria: 'ergonomia',
          },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.riesgo_por_defecto).toBe('medio');
        expect(body.control_sugerido).toBeNull();
      });

      it('debe validar campos requeridos', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/hazards/catalog',
          headers: { ...getHeaders(), 'content-type': 'application/json' },
          payload: { nombre: 'Sin código' },
        });

        expect(res.statusCode).toBe(400);
      });

      it('debe validar categoría válida', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/hazards/catalog',
          headers: { ...getHeaders(), 'content-type': 'application/json' },
          payload: {
            codigo: 'TEST-001',
            nombre: 'Test',
            categoria: 'invalida',
          },
        });

        expect(res.statusCode).toBe(400);
      });
    });
  });

  describe('Evaluaciones de peligros (IPERC)', () => {
    describe('GET /api/hazards/assessments', () => {
      it('debe listar evaluaciones ordenadas por fecha descendente', async () => {
        hazardsService.createHazardAssessment(db, { cargo_oficio: 'A', fecha: '2026-01-01' });
        hazardsService.createHazardAssessment(db, { cargo_oficio: 'B', fecha: '2026-03-01' });
        hazardsService.createHazardAssessment(db, { cargo_oficio: 'C', fecha: '2026-02-01' });

        const res = await app.inject({
          method: 'GET',
          url: '/api/hazards/assessments',
          headers: getHeaders(),
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body).toHaveLength(3);
        expect(body[0].cargo_oficio).toBe('B');
        expect(body[1].cargo_oficio).toBe('C');
        expect(body[2].cargo_oficio).toBe('A');
      });
    });

    describe('POST /api/hazards/assessments', () => {
      it('debe crear evaluación completa', async () => {
        const hazard = hazardsService.createHazardCatalogItem(db, {
          codigo: 'ALT-001',
          nombre: 'Caída de altura',
          categoria: 'alturas',
        });
        const res = await app.inject({
          method: 'POST',
          url: '/api/hazards/assessments',
          headers: { ...getHeaders(), 'content-type': 'application/json' },
          payload: {
            cargo_oficio: 'Trabajador en alturas',
            area: 'Techo nave 3',
            peligro_id: hazard.id,
            peligro_texto: 'Caída de altura',
            tarea: 'Mantenimiento cubierta',
            consecuencia: 'Fracturas, muerte',
            probabilidad: 'Posible',
            valoracion_riesgo: 'critico',
            controles: 'Arnés, línea de vida, capacitación',
            responsable: 'Jefe seguridad',
            fecha: '2026-01-15',
            estado: 'vigente',
          },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.cargo_oficio).toBe('Trabajador en alturas');
        expect(body.valoracion_riesgo).toBe('critico');
        expect(body.estado).toBe('vigente');
      });

      it('debe usar valores por defecto', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/hazards/assessments',
          headers: { ...getHeaders(), 'content-type': 'application/json' },
          payload: {
            cargo_oficio: 'Electricista',
          },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.valoracion_riesgo).toBe('medio');
        expect(body.estado).toBe('vigente');
        expect(body.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it('debe validar cargo_oficio requerido', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/hazards/assessments',
          headers: { ...getHeaders(), 'content-type': 'application/json' },
          payload: { area: 'Sin cargo' },
        });

        expect(res.statusCode).toBe(400);
      });

      it('debe validar valoracion_riesgo válida', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/hazards/assessments',
          headers: { ...getHeaders(), 'content-type': 'application/json' },
          payload: {
            cargo_oficio: 'Test',
            valoracion_riesgo: 'invalido',
          },
        });

        expect(res.statusCode).toBe(400);
      });
    });

    describe('PUT /api/hazards/assessments/:id', () => {
      it('debe actualizar evaluación', async () => {
        const { createHazardAssessment } = await import('../../../src/services/hazards.js');
        const assessment = createHazardAssessment(db, { cargo_oficio: 'Original', valoracion_riesgo: 'bajo' });

        const res = await app.inject({
          method: 'PUT',
          url: `/api/hazards/assessments/${assessment.id}`,
          headers: { ...getHeaders(), 'content-type': 'application/json' },
          payload: {
            cargo_oficio: 'Actualizado',
            valoracion_riesgo: 'alto',
            controles: 'Nuevos controles',
          },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.cargo_oficio).toBe('Actualizado');
        expect(body.valoracion_riesgo).toBe('alto');
        expect(body.controles).toBe('Nuevos controles');
        expect(body.revisado_en).toBeDefined();
      });
    });

    describe('DELETE /api/hazards/assessments/:id', () => {
      it('debe eliminar evaluación', async () => {
        const { createHazardAssessment } = await import('../../../src/services/hazards.js');
        const assessment = createHazardAssessment(db, { cargo_oficio: 'Para borrar' });

        const res = await app.inject({
          method: 'DELETE',
          url: `/api/hazards/assessments/${assessment.id}`,
          headers: getHeaders(),
        });

        expect(res.statusCode).toBe(200);

        const check = await app.inject({
          method: 'GET',
          url: '/api/hazards/assessments',
          headers: getHeaders(),
        });
        const body = JSON.parse(check.body);
        expect(body).toHaveLength(0);
      });
    });
  });
});