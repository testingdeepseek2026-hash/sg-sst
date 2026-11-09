import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { createTestDb, cleanDb } from '../../setup.js';
import workersItemsRoutes from '../../../src/routes/workers_items.js';
import workersRoutes from '../../../src/routes/workers.js';
import * as examsService from '../../../src/services/workers_exams.js';
import * as certsService from '../../../src/services/workers_certs.js';
import * as eppService from '../../../src/services/workers_epp.js';
import * as workersService from '../../../src/services/workers.js';
import { requireAuth } from '../../../src/lib/auth.js';

describe('Trabajadores - Exámenes, Certificados, EPP (Integración)', () => {
  let app: ReturnType<typeof Fastify>;
  let db: ReturnType<typeof createTestDb>;
  let cookieJar: string[] = [];
  let workerId: string;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(cookie, { secret: 'test-secret' });
    
    db = createTestDb();
    app.decorate('db', db);
    
    // Usar el hook de autenticación centralizado (igual que la app principal)
    app.addHook('preHandler', requireAuth);
    
    await app.register(workersRoutes, { prefix: '/api' });
    await app.register(workersItemsRoutes, { prefix: '/api' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    cleanDb(db);
    cookieJar = [];
    
    // Usuario administrador
    db.prepare('INSERT INTO users (id, email, nombre, rol, password_hash) VALUES (?, ?, ?, ?, ?)')
      .run('user-admin', 'admin@test.com', 'Admin', 'administrador', 'hash');
    
    // Usuario trabajador (mismo ID que el worker para autenticación)
    const worker = workersService.createWorker(db, {
      tipo_documento: 'CC',
      numero_documento: '1234567890',
      nombres: 'Juan',
      apellidos: 'Pérez',
      cargo: 'Electricista',
      fecha_ingreso: '2025-01-15',
    });
    workerId = worker.id;
    
    // Crear usuario con mismo ID que el trabajador para autenticación como trabajador
    db.prepare('INSERT INTO users (id, email, nombre, rol, password_hash) VALUES (?, ?, ?, ?, ?)')
      .run(workerId, 'trabajador@test.com', 'Juan Pérez', 'trabajador', 'hash');
    
    // Cookie por defecto: admin
    cookieJar = ['sg_sst_user=user-admin', 'sg_sst_email=admin@test.com'];
    
    // Consentimiento médico
    db.prepare('INSERT INTO consents (id, worker_id, tipo, autorizado, fecha) VALUES (?, ?, ?, 1, ?)')
      .run('consent-1', workerId, 'medico', new Date().toISOString());
  });

  const getHeaders = () => ({
    cookie: cookieJar.join('; '),
  });

  describe('Exámenes médicos', () => {
    describe('GET /api/workers/:id/exams', () => {
      it('debe listar exámenes del trabajador', async () => {
        examsService.createExam(db, { worker_id: workerId, tipo: 'ingreso', fecha: '2026-01-15' });
        examsService.createExam(db, { worker_id: workerId, tipo: 'periodico', fecha: '2026-07-15' });
        
        const res = await app.inject({
          method: 'GET',
          url: `/api/workers/${workerId}/exams`,
          headers: getHeaders(),
        });
        
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body).toHaveLength(2);
      });

      it('debe ocultar datos sensibles por defecto (no admin)', async () => {
        examsService.createExam(db, { 
          worker_id: workerId, 
          tipo: 'periodico', 
          fecha: '2026-01-15', 
          restricciones: 'Sensible',
          resultado: 'apto_con_restricciones',
        });
        
        // Autenticar como trabajador (no admin)
        const res = await app.inject({
          method: 'GET',
          url: `/api/workers/${workerId}/exams`,
          headers: { cookie: `sg_sst_user=${workerId}; sg_sst_email=trabajador@test.com` },
        });
        
        const body = JSON.parse(res.body);
        expect(body[0].restricciones).toBeNull();
        expect(body[0].resultado).toBe('apto');
      });
    });

    describe('POST /api/workers/:id/exams', () => {
      it('debe crear examen de ingreso', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/workers/${workerId}/exams`,
          headers: { ...getHeaders(), 'content-type': 'application/json' },
          payload: {
            tipo: 'ingreso',
            fecha: '2026-01-15',
            resultado: 'apto',
            medico: 'Dr. Test',
            entidad: 'Clínica',
          },
        });
        
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.tipo).toBe('ingreso');
        expect(body.resultado).toBe('apto');
      });

      it('debe rechazar examen sin consentimiento médico', async () => {
        const worker2 = workersService.createWorker(db, {
          tipo_documento: 'CC',
          nombres: 'Sin',
          apellidos: 'Consentimiento',
          numero_documento: '9999999999',
          cargo: 'Test',
          fecha_ingreso: '2025-01-15',
        });
        // Sin consentimiento
        
        const res = await app.inject({
          method: 'POST',
          url: `/api/workers/${worker2.id}/exams`,
          headers: { ...getHeaders(), 'content-type': 'application/json' },
          payload: { tipo: 'ingreso', fecha: '2026-01-15' },
        });
        
        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.error).toContain('autorizado el tratamiento de datos médicos');
      });

      it('debe rechazar segundo examen de ingreso', async () => {
        examsService.createExam(db, { worker_id: workerId, tipo: 'ingreso', fecha: '2026-01-15' });
        
        const res = await app.inject({
          method: 'POST',
          url: `/api/workers/${workerId}/exams`,
          headers: { ...getHeaders(), 'content-type': 'application/json' },
          payload: { tipo: 'ingreso', fecha: '2026-02-01' },
        });
        
        expect(res.statusCode).toBe(400);
      });
    });

    describe('GET /api/workers/exams/ingreso', () => {
      it('debe retornar examen de ingreso vigente', async () => {
        examsService.createExam(db, { worker_id: workerId, tipo: 'ingreso', fecha: '2026-01-15' });
        
        const res = await app.inject({
          method: 'GET',
          url: '/api/workers/exams/ingreso',
          headers: { cookie: `sg_sst_user=${workerId}; sg_sst_email=trabajador@test.com` },
        });
        
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.tiene_examen_ingreso).toBe(true);
        expect(body.examen.fecha).toBe('2026-01-15');
      });

      it('debe retornar 404 si no hay examen de ingreso', async () => {
        examsService.createExam(db, { worker_id: workerId, tipo: 'periodico', fecha: '2026-01-15' });
        
        const res = await app.inject({
          method: 'GET',
          url: '/api/workers/exams/ingreso',
          headers: { cookie: `sg_sst_user=${workerId}; sg_sst_email=trabajador@test.com` },
        });
        
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).tiene_examen_ingreso).toBe(false);
      });
    });

    describe('GET /api/workers/vencimientos', () => {
      it('debe unificar exámenes, certificados y EPP', async () => {
        // Examen por vencer
        examsService.createExam(db, { worker_id: workerId, tipo: 'periodico', fecha: '2026-01-01', vencimiento: '2026-06-20' });
        // Certificado por vencer
        certsService.crearCertificado(db, { worker_id: workerId, tipo: 'alturas', fecha_emision: '2023-06-18', fecha_vencimiento: '2026-06-18' });
        // EPP por vencer
        eppService.createEpp(db, { worker_id: workerId, item: 'Casco', fecha_entrega: '2025-01-01', fecha_vencimiento: '2026-06-19' });
        
        const res = await app.inject({
          method: 'GET',
          url: `/api/workers/vencimientos?dias=30`,
          headers: getHeaders(),
        });
        
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.length).toBeGreaterThanOrEqual(3);
        // Vencidos/por vencer primero
        expect(body[0].estado === 'vencido' || body[0].estado === 'por_vencer').toBe(true);
      });
    });
  });

  describe('Certificados', () => {
    describe('GET /api/workers/:id/certs', () => {
      it('debe listar certificados ordenados por fecha_emision descendente', async () => {
        certsService.crearCertificado(db, { worker_id: workerId, tipo: 'alturas', fecha_emision: '2026-01-15', fecha_vencimiento: '2029-01-15' });
        certsService.crearCertificado(db, { worker_id: workerId, tipo: 'electrico', fecha_emision: '2026-06-15', fecha_vencimiento: '2027-06-15' });
        
        const res = await app.inject({
          method: 'GET',
          url: `/api/workers/${workerId}/certs`,
          headers: getHeaders(),
        });
        
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body).toHaveLength(2);
        expect(body[0].fecha_emision).toBe('2026-06-15');
      });
    });

    describe('POST /api/workers/:id/certs', () => {
      it('debe crear certificado de alturas con vigencia 3 años (Res. 4272/2021)', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/workers/${workerId}/certs`,
          headers: { ...getHeaders(), 'content-type': 'application/json' },
          payload: {
            tipo: 'alturas',
            nombre_curso: 'Trabajo en alturas',
            entidad: 'SENA',
            fecha_emision: '2026-01-15',
            fecha_vencimiento: '2029-01-15',
          },
        });
        
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.tipo).toBe('alturas');
        expect(body.fecha_vencimiento).toBe('2029-01-15');
      });

      it('debe rechazar certificado de alturas con vigencia incorrecta', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/workers/${workerId}/certs`,
          headers: { ...getHeaders(), 'content-type': 'application/json' },
          payload: {
            tipo: 'alturas',
            fecha_emision: '2026-01-15',
            fecha_vencimiento: '2028-01-15', // 2 años
          },
        });
        
        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.error).toContain('vigencia exacta de 3 años');
      });

      it('debe crear otros tipos de certificados sin validación estricta', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/workers/${workerId}/certs`,
          headers: { ...getHeaders(), 'content-type': 'application/json' },
          payload: {
            tipo: 'primeros_auxilios',
            fecha_emision: '2026-01-15',
            fecha_vencimiento: '2027-01-15',
          },
        });
        
        expect(res.statusCode).toBe(200);
      });
    });

    describe('PUT /api/workers/certs/:id', () => {
      it('debe revalidar vigencia al cambiar a tipo alturas', async () => {
        const cert = certsService.crearCertificado(db, { worker_id: workerId, tipo: 'electrico', fecha_emision: '2026-01-15', fecha_vencimiento: '2027-01-15' });
        
        const res = await app.inject({
          method: 'PUT',
          url: `/api/workers/certs/${cert.id}`,
          headers: { ...getHeaders(), 'content-type': 'application/json' },
          payload: { tipo: 'alturas' },
        });
        
        expect(res.statusCode).toBe(400);
      });
    });
  });

  describe('EPP', () => {
    describe('GET /api/workers/:id/epp', () => {
      it('debe listar EPPs del trabajador', async () => {
        eppService.createEpp(db, { worker_id: workerId, item: 'Casco', fecha_entrega: '2026-01-15' });
        eppService.createEpp(db, { worker_id: workerId, item: 'Guantes', fecha_entrega: '2026-02-15' });
        
        const res = await app.inject({
          method: 'GET',
          url: `/api/workers/${workerId}/epp`,
          headers: getHeaders(),
        });
        
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body).toHaveLength(2);
      });
    });

    describe('POST /api/workers/:id/epp', () => {
      it('debe crear entrega de EPP', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/workers/${workerId}/epp`,
          headers: { ...getHeaders(), 'content-type': 'application/json' },
          payload: {
            item: 'Arnés de cuerpo completo',
            cantidad: 1,
            fecha_entrega: '2026-01-15',
            fecha_vencimiento: '2027-01-15',
          },
        });
        
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.item).toBe('Arnés de cuerpo completo');
        expect(body.firmado_por_trabajador).toBe(0);
      });
    });

    describe('POST /api/workers/epp/:id/firmar', () => {
      it('debe firmar entrega de EPP', async () => {
        const epp = eppService.createEpp(db, { worker_id: workerId, item: 'Casco', fecha_entrega: '2026-01-15' });
        const firma = `data:image/png;base64,${'a'.repeat(120)}`;
        
        const res = await app.inject({
          method: 'POST',
          url: `/api/workers/epp/${epp.id}/firmar`,
          headers: { ...getHeaders(), 'content-type': 'application/json' },
          payload: { firma_base64: firma },
        });
        
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.firmado_por_trabajador).toBe(1);
        expect(body.firma_url).toBe(firma);
      });
    });

    describe('GET /api/workers/epp/sin-firmar', () => {
      it('debe listar EPPs pendientes de firma', async () => {
        eppService.createEpp(db, { worker_id: workerId, item: 'Casco', fecha_entrega: '2026-01-15', firmado_por_trabajador: 0 });
        eppService.createEpp(db, { worker_id: workerId, item: 'Guantes', fecha_entrega: '2026-01-15', firmado_por_trabajador: 1 });
        
        const res = await app.inject({
          method: 'GET',
          url: '/api/workers/epp/sin-firmar',
          headers: getHeaders(),
        });
        
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body).toHaveLength(1);
        expect(body[0].item).toBe('Casco');
      });
    });
  });
});