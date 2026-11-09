import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { createTestDb, cleanDb } from '../../setup.js';
import policiesRoutes from '../../../src/routes/policies.js';
import * as policiesService from '../../../src/services/policies.js';

describe('Políticas - Rutas API (Integración)', () => {
  let app: ReturnType<typeof Fastify>;
  let db: ReturnType<typeof createTestDb>;
  let cookieJar: string[] = [];

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(cookie, { secret: 'test-secret' });
    
    db = createTestDb();
    app.decorate('db', db);
    
    // Mock auth hook
    app.addHook('preHandler', async (request) => {
      request.userId = request.cookies['sg_sst_user'] ?? undefined;
      request.userEmail = request.cookies['sg_sst_email'] ?? undefined;
    });
    
    await app.register(policiesRoutes, { prefix: '/api' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    cleanDb(db);
    cookieJar = [];
    
    // Login como admin para tests que requieren auth
    db.prepare('INSERT INTO users (id, email, nombre, rol, password_hash) VALUES (?, ?, ?, ?, ?)')
      .run('user-admin', 'admin@test.com', 'Admin', 'administrador', 'hash');
    
    // Simular cookie de sesión
    cookieJar = ['sg_sst_user=user-admin', 'sg_sst_email=admin@test.com'];
  });

  const getHeaders = () => ({
    cookie: cookieJar.join('; '),
  });

  describe('GET /api/policies', () => {
    it('debe retornar lista vacía inicialmente', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/policies',
        headers: getHeaders(),
      });
      
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toEqual([]);
    });

    it('debe retornar políticas ordenadas por versión descendente', async () => {
      // Crear políticas directamente en DB
      const { createPolicy } = await import('../../../src/services/policies.js');
      createPolicy(db, { titulo: 'P1', contenido: 'C1', estado: 'borrador' });
      createPolicy(db, { titulo: 'P2', contenido: 'C2', estado: 'vigente' });
      createPolicy(db, { titulo: 'P3', contenido: 'C3', estado: 'archivada' });
      
      const res = await app.inject({
        method: 'GET',
        url: '/api/policies',
        headers: getHeaders(),
      });
      
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(3);
      expect(body[0].estado).toBe('archivada'); // versión más alta
      expect(body[1].estado).toBe('vigente');
      expect(body[2].estado).toBe('borrador');
    });

    it('requiere autenticación para consultar políticas', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/policies',
      });
      
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/policies/active', () => {
    it('debe retornar política vigente', async () => {
      const { createPolicy } = await import('../../../src/services/policies.js');
      const active = createPolicy(db, { titulo: 'Vigente', contenido: 'Content', estado: 'vigente' });
      
      const res = await app.inject({
        method: 'GET',
        url: '/api/policies/active',
        headers: getHeaders(),
      });
      
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(active.id);
      expect(body.estado).toBe('vigente');
    });

    it('debe retornar 404 si no hay política vigente', async () => {
      const { createPolicy } = await import('../../../src/services/policies.js');
      createPolicy(db, { titulo: 'Borrador', contenido: 'Content', estado: 'borrador' });
      
      const res = await app.inject({
        method: 'GET',
        url: '/api/policies/active',
        headers: getHeaders(),
      });
      
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/policies', () => {
    it('debe crear política en borrador', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/policies',
        headers: { ...getHeaders(), 'content-type': 'application/json' },
        payload: {
          titulo: 'Nueva Política',
          contenido: 'Contenido de la política',
        },
      });
      
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.titulo).toBe('Nueva Política');
      expect(body.estado).toBe('borrador');
      expect(body.version).toBe(1);
    });

    it('debe crear política vigente directamente', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/policies',
        headers: { ...getHeaders(), 'content-type': 'application/json' },
        payload: {
          titulo: 'Política Vigente',
          contenido: 'Contenido de prueba',
          estado: 'vigente',
        },
      });
      
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.estado).toBe('vigente');
    });

    it('debe rechazar segunda política vigente', async () => {
      const { createPolicy } = await import('../../../src/services/policies.js');
      createPolicy(db, { titulo: 'Existente', contenido: 'Contenido vigente', estado: 'vigente' });
      
      const res = await app.inject({
        method: 'POST',
        url: '/api/policies',
        headers: { ...getHeaders(), 'content-type': 'application/json' },
        payload: {
          titulo: 'Nueva Vigente',
          contenido: 'Contenido de prueba',
          estado: 'vigente',
        },
      });
      
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toContain('Ya existe una política vigente');
    });

    it('debe validar campos requeridos', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/policies',
        headers: { ...getHeaders(), 'content-type': 'application/json' },
        payload: {
          contenido: 'Solo contenido',
        },
      });
      
      expect(res.statusCode).toBe(400);
    });
  });

  describe('PUT /api/policies/:id', () => {
    it('debe actualizar política en borrador', async () => {
      const { createPolicy } = await import('../../../src/services/policies.js');
      const policy = createPolicy(db, { titulo: 'Original', contenido: 'Original', estado: 'borrador' });
      
      const res = await app.inject({
        method: 'PUT',
        url: `/api/policies/${policy.id}`,
        headers: { ...getHeaders(), 'content-type': 'application/json' },
        payload: {
          titulo: 'Actualizado',
          contenido: 'Nuevo contenido',
        },
      });
      
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.titulo).toBe('Actualizado');
      expect(body.contenido).toBe('Nuevo contenido');
      expect(body.id).toBe(policy.id);
      expect(body.version).toBe(1);
    });

    it('debe crear nueva versión al editar política vigente', async () => {
      const { createPolicy } = await import('../../../src/services/policies.js');
      const active = createPolicy(db, { titulo: 'Vigente', contenido: 'Content', estado: 'vigente' });
      
      const res = await app.inject({
        method: 'PUT',
        url: `/api/policies/${active.id}`,
        headers: { ...getHeaders(), 'content-type': 'application/json' },
        payload: {
          titulo: 'Nuevo título',
        },
      });
      
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).not.toBe(active.id);
      expect(body.version).toBe(2);
      expect(body.estado).toBe('borrador');
      expect(body.titulo).toBe('Nuevo título');
    });

    it('debe retornar 404 si política no existe', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/policies/non-existent',
        headers: { ...getHeaders(), 'content-type': 'application/json' },
        payload: { titulo: 'Test' },
      });
      
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/policies/:id', () => {
    it('debe eliminar política en borrador', async () => {
      const { createPolicy } = await import('../../../src/services/policies.js');
      const policy = createPolicy(db, { titulo: 'Para borrar', contenido: 'Content', estado: 'borrador' });
      
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/policies/${policy.id}`,
        headers: getHeaders(),
      });
      
      expect(res.statusCode).toBe(200);
      
      const check = await app.inject({
        method: 'GET',
        url: `/api/policies/${policy.id}`,
        headers: getHeaders(),
      });
      expect(check.statusCode).toBe(404);
    });

    it('debe rechazar eliminación de política vigente', async () => {
      const { createPolicy } = await import('../../../src/services/policies.js');
      const policy = createPolicy(db, { titulo: 'Vigente', contenido: 'Content', estado: 'vigente' });
      
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/policies/${policy.id}`,
        headers: getHeaders(),
      });
      
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toContain('Solo se pueden eliminar políticas en estado borrador');
    });
  });

  describe('POST /api/policies/:id/firmar', () => {
    it('debe firmar política y ponerla vigente', async () => {
      const { createPolicy } = await import('../../../src/services/policies.js');
      const policy = createPolicy(db, { titulo: 'Para firmar', contenido: 'Content', estado: 'borrador' });
      
      const res = await app.inject({
        method: 'POST',
        url: `/api/policies/${policy.id}/firmar`,
        headers: { ...getHeaders(), 'content-type': 'application/json' },
        payload: { firmado_por: 'Gerente General' },
      });
      
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.estado).toBe('vigente');
      expect(body.firmado_por).toBe('Gerente General');
      expect(body.fecha_firma).toBeDefined();
    });

    it('debe rechazar firma de política no borrador', async () => {
      const { createPolicy } = await import('../../../src/services/policies.js');
      const policy = createPolicy(db, { titulo: 'Vigente', contenido: 'Content', estado: 'vigente' });
      
      const res = await app.inject({
        method: 'POST',
        url: `/api/policies/${policy.id}/firmar`,
        headers: { ...getHeaders(), 'content-type': 'application/json' },
        payload: { firmado_por: 'Gerente' },
      });
      
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/policies/:id/divulgar', () => {
    it('debe divulgar política vigente', async () => {
      const { createPolicy, firmarPolicy } = await import('../../../src/services/policies.js');
      const policy = createPolicy(db, { titulo: 'Vigente', contenido: 'Content', estado: 'borrador' });
      firmarPolicy(db, policy.id, 'Gerente');
      
      const res = await app.inject({
        method: 'POST',
        url: `/api/policies/${policy.id}/divulgar`,
        headers: getHeaders(),
      });
      
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.fecha_divulgacion).toBeDefined();
    });

    it('debe rechazar divulgación de política no vigente', async () => {
      const { createPolicy } = await import('../../../src/services/policies.js');
      const policy = createPolicy(db, { titulo: 'Borrador', contenido: 'Content', estado: 'borrador' });
      
      const res = await app.inject({
        method: 'POST',
        url: `/api/policies/${policy.id}/divulgar`,
        headers: getHeaders(),
      });
      
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/policies/:id/archivar', () => {
    it('debe archivar política', async () => {
      const { createPolicy } = await import('../../../src/services/policies.js');
      const policy = createPolicy(db, { titulo: 'Vigente', contenido: 'Content', estado: 'vigente' });
      
      const res = await app.inject({
        method: 'POST',
        url: `/api/policies/${policy.id}/archivar`,
        headers: getHeaders(),
      });
      
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.estado).toBe('archivada');
    });
  });

  describe('Objetivos - CRUD', () => {
    let policyId: string;

    beforeEach(() => {
      const policy = policiesService.createPolicy(db, { titulo: 'Con objetivos', contenido: 'Content', estado: 'vigente' });
      policyId = policy.id;
    });

    it('GET /api/policies/:id/objectives - listar objetivos', async () => {
      policiesService.createObjective(db, { policy_id: policyId, descripcion: 'Obj 1', tipo: 'estructura' });
      policiesService.createObjective(db, { policy_id: policyId, descripcion: 'Obj 2', tipo: 'resultado' });
      
      const res = await app.inject({
        method: 'GET',
        url: `/api/policies/${policyId}/objectives`,
        headers: getHeaders(),
      });
      
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(2);
    });

    it('POST /api/policies/:id/objectives - crear objetivo', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/policies/${policyId}/objectives`,
        headers: { ...getHeaders(), 'content-type': 'application/json' },
        payload: {
          descripcion: 'Nuevo objetivo',
          tipo: 'proceso',
          meta: 'Meta 50%',
          responsable: 'Jefe',
          fecha_limite: '2026-12-31',
        },
      });
      
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.descripcion).toBe('Nuevo objetivo');
      expect(body.tipo).toBe('proceso');
      expect(body.policy_id).toBe(policyId);
    });

    it('PUT /api/policies/objectives/:id - actualizar objetivo', async () => {
      const obj = policiesService.createObjective(db, { policy_id: policyId, descripcion: 'Original', tipo: 'estructura' });
      
      const res = await app.inject({
        method: 'PUT',
        url: `/api/objectives/${obj.id}`,
        headers: { ...getHeaders(), 'content-type': 'application/json' },
        payload: { estado: 'cumplido' },
      });
      
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.estado).toBe('cumplido');
    });

    it('DELETE /api/policies/objectives/:id - eliminar objetivo', async () => {
      const obj = policiesService.createObjective(db, { policy_id: policyId, descripcion: 'Para borrar', tipo: 'estructura' });
      
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/objectives/${obj.id}`,
        headers: getHeaders(),
      });
      
      expect(res.statusCode).toBe(200);
    });
  });
});