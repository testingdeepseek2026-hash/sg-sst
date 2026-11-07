import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../../setup.js';
import * as alertsService from '../../../src/services/alerts.js';
import * as workersService from '../../../src/services/workers.js';
import * as companiesService from '../../../src/services/companies.js';
import * as usersService from '../../../src/services/users.js';
import * as rolesService from '../../../src/services/roles.js';
import * as inspectionsService from '../../../src/services/inspections.js';
import * as plansService from '../../../src/services/plans.js';
import * as documentsService from '../../../src/services/documents.js';

describe('Alertas - Servicio', () => {
  let db: ReturnType<typeof createTestDb>;
  let userId: string;
  let workerId: string;
  let roleId: string;

  beforeEach(() => {
    db = createTestDb();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T10:00:00Z'));

    // Crear datos base
    companiesService.upsertCompany(db, {
      razon_social: 'Empresa Test',
      nit: '900123456-7',
      direccion: 'Calle 123',
      telefono: '6012345678',
      email: 'alertas@empresa.com',
      canal_alertas: 'email',
    });
    const user = usersService.createUser(db, {
      email: 'user@test.com',
      nombre: 'Usuario Test',
      password_hash: 'test-password-hash',
      rol: 'administrador',
    });
    userId = user.id;

    const worker = workersService.createWorker(db, {
      tipo_documento: 'CC',
      nombres: 'Juan',
      apellidos: 'Pérez',
      numero_documento: '1234567890',
      cargo: 'Electricista',
      fecha_ingreso: '2020-01-01',
    });
    workerId = worker.id;

    const role = rolesService.createRole(db, {
      usuario_id: userId,
      nombre: 'Responsable SST',
      licencia_sst_vence: '2026-06-20', // En 5 días
    });
    roleId = role.id;

    // Consentimiento médico para exámenes
    db.prepare('INSERT INTO consents (id, worker_id, tipo, autorizado, fecha) VALUES (?, ?, ?, 1, ?)')
      .run('consent-1', workerId, 'medico', new Date().toISOString());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateAlerts', () => {
    it('debe generar alertas para exámenes médicos próximos a vencer', () => {
      // Examen que vence en 5 días (alta prioridad)
      const exam = db.prepare(`
        INSERT INTO worker_exams (id, worker_id, tipo, fecha, vencimiento, resultado, medico, entidad)
        VALUES (?, ?, 'periodico', '2026-01-15', '2026-06-20', 'apto', 'Dr. Test', 'Clínica')
      `).run('exam-1', workerId);

      const alerts = alertsService.generateAlerts(db);
      
      const examAlert = alerts.find(a => a.tipo === 'examen');
      expect(examAlert).toBeDefined();
      expect(examAlert?.prioridad).toBe('alta');
      expect(examAlert?.entidad_id).toBe('exam-1');
    });

    it('debe generar alertas para exámenes vencidos (crítica)', () => {
      const exam = db.prepare(`
        INSERT INTO worker_exams (id, worker_id, tipo, fecha, vencimiento, resultado)
        VALUES (?, ?, 'periodico', '2026-01-15', '2026-06-10', 'apto')
      `).run('exam-vencido', workerId);

      const alerts = alertsService.generateAlerts(db);
      
      const examAlert = alerts.find(a => a.tipo === 'examen');
      expect(examAlert?.prioridad).toBe('critica');
    });

    it('debe generar alertas para certificados', () => {
      db.prepare(`
        INSERT INTO worker_certs (id, worker_id, tipo, fecha_emision, fecha_vencimiento)
        VALUES (?, ?, 'alturas', '2023-01-15', '2026-06-25')
      `).run('cert-1', workerId);

      const alerts = alertsService.generateAlerts(db);
      
      const certAlert = alerts.find(a => a.tipo === 'certificado');
      expect(certAlert).toBeDefined();
      expect(certAlert?.prioridad).toBe('media'); // 10 días
    });

    it('debe generar alertas para licencias SST', () => {
      // roleId ya tiene licencia_sst_vence en 5 días
      const alerts = alertsService.generateAlerts(db);
      
      const licenciaAlert = alerts.find(a => a.tipo === 'licencia_sst');
      expect(licenciaAlert).toBeDefined();
      expect(licenciaAlert?.prioridad).toBe('alta');
      expect(licenciaAlert?.entidad_id).toBe(roleId);
    });

    it('debe generar alertas para curso 50h', () => {
      rolesService.updateRole(db, roleId, { curso_50h_vence: '2026-06-18' }); // En 3 días
      
      const alerts = alertsService.generateAlerts(db);
      
      const cursoAlert = alerts.find(a => a.tipo === 'curso_50h');
      expect(cursoAlert).toBeDefined();
      expect(cursoAlert?.prioridad).toBe('alta');
    });

    it('debe generar alertas para inspecciones programadas', () => {
      db.prepare(`
        INSERT INTO inspections (id, tipo, fecha, estado, observaciones)
        VALUES (?, 'obra', '2026-06-18', 'pendiente', 'Inspección test')
      `).run('insp-1');

      const alerts = alertsService.generateAlerts(db);
      
      const inspAlert = alerts.find(a => a.tipo === 'inspeccion');
      expect(inspAlert).toBeDefined();
      expect(inspAlert?.prioridad).toBe('alta');
    });

    it('debe generar alertas para planes anuales', () => {
      db.prepare(`
        INSERT INTO annual_plan (id, anio, objetivo, fecha_inicio, fecha_fin, estado)
        VALUES (?, 2026, 'Plan test', '2026-01-01', '2026-06-20', 'en_proceso')
      `).run('plan-1');

      const alerts = alertsService.generateAlerts(db);
      
      const planAlert = alerts.find(a => a.tipo === 'plan');
      expect(planAlert).toBeDefined();
      expect(planAlert?.prioridad).toBe('alta');
    });

    it('debe generar alertas para documentos por revisar', () => {
      db.prepare(`
        INSERT INTO documents (id, codigo, nombre, tipo, fecha_emision, fecha_revision, estado)
        VALUES (?, 'DOC-TEST', 'Doc test', 'procedimiento', '2026-01-01', '2026-06-18', 'vigente')
      `).run('doc-1');

      const alerts = alertsService.generateAlerts(db);
      
      const docAlert = alerts.find(a => a.tipo === 'documento');
      expect(docAlert).toBeDefined();
      expect(docAlert?.prioridad).toBe('alta');
    });

    it('no debe duplicar alertas existentes (INSERT OR IGNORE)', () => {
      db.prepare(`
        INSERT INTO worker_exams (id, worker_id, tipo, fecha, vencimiento, resultado)
        VALUES (?, ?, 'periodico', '2026-01-15', '2026-06-20', 'apto')
      `).run('exam-dup', workerId);

      alertsService.generateAlerts(db);
      const alerts1 = alertsService.getAlerts(db, { tipo: 'examen' });
      
      alertsService.generateAlerts(db);
      const alerts2 = alertsService.getAlerts(db, { tipo: 'examen' });
      
      expect(alerts2.length).toBe(alerts1.length);
    });

    it('debe ignorar trabajadores inactivos', () => {
      const inactiveWorker = workersService.createWorker(db, {
        tipo_documento: 'CC',
        nombres: 'Inactivo',
        apellidos: 'User',
        numero_documento: '9999999999',
        cargo: 'Test',
        fecha_ingreso: '2020-01-01',
        estado: 'inactivo',
      });
      db.prepare('INSERT INTO consents (id, worker_id, tipo, autorizado, fecha) VALUES (?, ?, ?, 1, ?)')
        .run('consent-inactive', inactiveWorker.id, 'medico', new Date().toISOString());
      
      db.prepare(`
        INSERT INTO worker_exams (id, worker_id, tipo, fecha, vencimiento, resultado)
        VALUES (?, ?, 'periodico', '2026-01-15', '2026-06-20', 'apto')
      `).run('exam-inactive', inactiveWorker.id);

      const alerts = alertsService.generateAlerts(db);
      
      const examAlert = alerts.find(a => a.entidad_id === 'exam-inactive');
      expect(examAlert).toBeUndefined();
    });

  });

  describe('getAlerts', () => {
    beforeEach(() => {
      // Poblar con datos de prueba
      alertsService.generateAlerts(db);
    });

    it('debe filtrar por tipo', () => {
      const examAlerts = alertsService.getAlerts(db, { tipo: 'examen' });
      expect(examAlerts.every(a => a.tipo === 'examen')).toBe(true);
    });

    it('debe filtrar por enviado', () => {
      const pendientes = alertsService.getAlerts(db, { enviado: 0 });
      expect(pendientes.every(a => a.enviado === 0)).toBe(true);
    });

    it('debe filtrar por prioridad', () => {
      const criticas = alertsService.getAlerts(db, { prioridad: 'critica' });
      expect(criticas.every(a => a.prioridad === 'critica')).toBe(true);
    });

    it('debe filtrar por rango de fechas', () => {
      const alerts = alertsService.getAlerts(db, { 
        fecha_desde: '2026-06-15', 
        fecha_hasta: '2026-06-25' 
      });
      expect(alerts.every(a => a.fecha_vencimiento >= '2026-06-15' && a.fecha_vencimiento <= '2026-06-25')).toBe(true);
    });

    it('debe limitar resultados', () => {
      const limited = alertsService.getAlerts(db, { limit: 5 });
      expect(limited.length).toBeLessThanOrEqual(5);
    });

    it('debe ordenar por fecha_vencimiento ASC y creado_en DESC', () => {
      const alerts = alertsService.getAlerts(db);
      for (let i = 1; i < alerts.length; i++) {
        expect(alerts[i].fecha_vencimiento >= alerts[i-1].fecha_vencimiento).toBe(true);
      }
    });
  });

  describe('getAlertStats', () => {
    it('debe retornar estadísticas correctas', () => {
      alertsService.generateAlerts(db);
      
      const stats = alertsService.getAlertStats(db);
      
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.pendientes).toBeGreaterThan(0);
      expect(stats.enviadas).toBe(0);
      expect(Array.isArray(stats.por_tipo)).toBe(true);
      expect(Array.isArray(stats.por_prioridad)).toBe(true);
    });
  });

  describe('getPendingAlertsForSending', () => {
    it('debe retornar alertas pendientes con info de empresa', () => {
      alertsService.generateAlerts(db);
      
      const pending = alertsService.getPendingAlertsForSending(db);
      
      expect(pending.length).toBeGreaterThan(0);
      expect(pending[0]).toHaveProperty('company_email');
      expect(pending[0]).toHaveProperty('canal_alertas');
    });
  });

  describe('markAsSent', () => {
    it('debe marcar alertas como enviadas', () => {
      db.prepare(`
        INSERT INTO worker_exams (id, worker_id, tipo, fecha, vencimiento, resultado)
        VALUES (?, ?, 'periodico', '2026-01-15', '2026-06-20', 'apto')
      `).run('exam-to-send', workerId);
      alertsService.generateAlerts(db);
      const alerts = alertsService.getAlerts(db, { enviado: 0 });
      const ids = alerts.slice(0, 2).map(a => a.id);
      
      const changes = alertsService.markAsSent(db, ids);
      
      expect(changes).toBe(2);
      const updated = alertsService.getAlerts(db, { enviado: 1 });
      expect(updated.length).toBe(2);
    });

    it('debe retornar 0 si array vacío', () => {
      const changes = alertsService.markAsSent(db, []);
      expect(changes).toBe(0);
    });
  });

  describe('deleteAlert', () => {
    it('debe eliminar alerta', () => {
      alertsService.generateAlerts(db);
      const alerts = alertsService.getAlerts(db);
      const id = alerts[0].id;
      
      alertsService.deleteAlert(db, id);
      
      const found = alertsService.getAlerts(db, { limit: 100 }).find(a => a.id === id);
      expect(found).toBeUndefined();
    });
  });
});