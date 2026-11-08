import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../../setup.js';
import * as examsService from '../../../src/services/workers_exams.js';
import * as workersService from '../../../src/services/workers.js';

describe('Exámenes Médicos - Servicio', () => {
  let db: ReturnType<typeof createTestDb>;
  let workerId: string;

  beforeEach(() => {
    db = createTestDb();
    // Crear trabajador y consentimiento médico
    const worker = workersService.createWorker(db, {
      tipo_documento: 'CC',
      nombres: 'Juan',
      apellidos: 'Pérez',
      numero_documento: '1234567890',
      cargo: 'Electricista',
      fecha_ingreso: '2020-01-01',
    });
    workerId = worker.id;
    
    // Registrar consentimiento médico
    db.prepare('INSERT INTO consents (id, worker_id, tipo, autorizado, fecha) VALUES (?, ?, ?, 1, ?)')
      .run('consent-1', workerId, 'medico', new Date().toISOString());
  });

  describe('createExam', () => {
    it('debe crear examen de ingreso con consentimiento', () => {
      const exam = examsService.createExam(db, {
        worker_id: workerId,
        tipo: 'ingreso',
        fecha: '2026-01-15',
        resultado: 'apto',
        medico: 'Dr. García',
        entidad: 'Clínica Salud',
      });

      expect(exam.id).toBeDefined();
      expect(exam.worker_id).toBe(workerId);
      expect(exam.tipo).toBe('ingreso');
      expect(exam.fecha).toBe('2026-01-15');
      expect(exam.resultado).toBe('apto');
      expect(exam.medico).toBe('Dr. García');
    });

    it('debe crear examen periódico', () => {
      examsService.createExam(db, { worker_id: workerId, tipo: 'ingreso', fecha: '2026-01-15' });
      
      const periodic = examsService.createExam(db, {
        worker_id: workerId,
        tipo: 'periodico',
        fecha: '2026-07-15',
        vencimiento: '2027-01-15',
        resultado: 'apto_con_restricciones',
        restricciones: 'No trabajo en alturas',
      });

      expect(periodic.tipo).toBe('periodico');
      expect(periodic.resultado).toBe('apto_con_restricciones');
      expect(periodic.restricciones).toBe('No trabajo en alturas');
      expect(periodic.vencimiento).toBe('2027-01-15');
    });

    it('debe lanzar error sin consentimiento médico (Ley 1581/2012)', () => {
      const worker2 = workersService.createWorker(db, {
        tipo_documento: 'CC',
        nombres: 'María',
        apellidos: 'González',
        numero_documento: '0987654321',
        cargo: 'Auxiliar',
        fecha_ingreso: '2020-01-01',
      });
      // Sin consentimiento médico

      expect(() => 
        examsService.createExam(db, { worker_id: worker2.id, tipo: 'ingreso', fecha: '2026-01-15' })
      ).toThrow('no ha autorizado el tratamiento de datos médicos');
    });

    it('debe lanzar error al crear segundo examen de ingreso', () => {
      examsService.createExam(db, { worker_id: workerId, tipo: 'ingreso', fecha: '2026-01-15' });
      
      expect(() => 
        examsService.createExam(db, { worker_id: workerId, tipo: 'ingreso', fecha: '2026-02-01' })
      ).toThrow('Ya existe un examen de ingreso');
    });

    it('debe usar resultado "apto" por defecto', () => {
      const exam = examsService.createExam(db, {
        worker_id: workerId,
        tipo: 'control',
        fecha: '2026-03-01',
      });

      expect(exam.resultado).toBe('apto');
    });
  });

  describe('getExamsByWorker', () => {
    beforeEach(() => {
      examsService.createExam(db, { worker_id: workerId, tipo: 'ingreso', fecha: '2026-01-15', resultado: 'apto' });
      examsService.createExam(db, { worker_id: workerId, tipo: 'periodico', fecha: '2026-07-15', resultado: 'apto_con_restricciones', restricciones: 'Restricción sensible' });
      examsService.createExam(db, { worker_id: workerId, tipo: 'control', fecha: '2026-10-01', resultado: 'no_apto' });
    });

    it('debe retornar exámenes ordenados por fecha descendente', () => {
      const exams = examsService.getExamsByWorker(db, workerId);
      
      expect(exams).toHaveLength(3);
      expect(exams[0].tipo).toBe('control'); // más reciente
      expect(exams[1].tipo).toBe('periodico');
      expect(exams[2].tipo).toBe('ingreso');
    });

    it('debe ocultar datos sensibles por defecto (Ley 1581/2012)', () => {
      const exams = examsService.getExamsByWorker(db, workerId);
      
      // restricciones debe ser null
      expect(exams.every(e => e.restricciones === null)).toBe(true);
      
      // resultado apto_con_restricciones debe convertirse a apto
      const periodico = exams.find(e => e.tipo === 'periodico');
      expect(periodico?.resultado).toBe('apto');
      
      // no_apto se mantiene
      const control = exams.find(e => e.tipo === 'control');
      expect(control?.resultado).toBe('no_apto');
    });

    it('debe mostrar datos sensibles con includeSensitive=true', () => {
      const exams = examsService.getExamsByWorker(db, workerId, true);
      
      const periodico = exams.find(e => e.tipo === 'periodico');
      expect(periodico?.restricciones).toBe('Restricción sensible');
      expect(periodico?.resultado).toBe('apto_con_restricciones');
    });
  });

  describe('getExamById', () => {
    it('debe retornar examen por ID', () => {
      const created = examsService.createExam(db, { worker_id: workerId, tipo: 'ingreso', fecha: '2026-01-15' });
      const found = examsService.getExamById(db, created.id);
      
      expect(found).toEqual(created);
    });

    it('debe retornar undefined si no existe', () => {
      const found = examsService.getExamById(db, 'non-existent');
      expect(found).toBeUndefined();
    });

    it('debe ocultar sensibles por defecto', () => {
      const created = examsService.createExam(db, { 
        worker_id: workerId, 
        tipo: 'periodico', 
        fecha: '2026-01-15',
        restricciones: 'Sensible',
        resultado: 'apto_con_restricciones',
      });
      const found = examsService.getExamById(db, created.id);
      
      expect(found?.restricciones).toBeNull();
      expect(found?.resultado).toBe('apto');
    });
  });

  describe('updateExam', () => {
    it('debe actualizar examen', () => {
      const exam = examsService.createExam(db, { worker_id: workerId, tipo: 'periodico', fecha: '2026-01-15' });
      
      const updated = examsService.updateExam(db, exam.id, { 
        resultado: 'apto_con_restricciones',
        restricciones: 'Nueva restricción',
      });
      
      expect(updated.resultado).toBe('apto_con_restricciones');
      expect(updated.restricciones).toBe('Nueva restricción');
    });

    it('debe retornar examen sin cambios si patch vacío', () => {
      const exam = examsService.createExam(db, { worker_id: workerId, tipo: 'ingreso', fecha: '2026-01-15' });
      
      const updated = examsService.updateExam(db, exam.id, {});
      
      expect(updated).toEqual(exam);
    });
  });

  describe('deleteExam', () => {
    it('debe eliminar examen', () => {
      const exam = examsService.createExam(db, { worker_id: workerId, tipo: 'control', fecha: '2026-01-15' });
      
      examsService.deleteExam(db, exam.id);
      
      const found = examsService.getExamById(db, exam.id);
      expect(found).toBeUndefined();
    });
  });

  describe('getVencimientosProximos', () => {
    it('debe detectar vencidos, por vencer y vigentes', () => {
      const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const en15dias = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
      const en60dias = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);

      examsService.createExam(db, { worker_id: workerId, tipo: 'periodico', fecha: '2026-01-01', vencimiento: ayer });
      examsService.createExam(db, { worker_id: workerId, tipo: 'periodico', fecha: '2026-01-01', vencimiento: en15dias });
      examsService.createExam(db, { worker_id: workerId, tipo: 'periodico', fecha: '2026-01-01', vencimiento: en60dias });

      const vencimientos = examsService.getVencimientosProximos(db, 30);
      
      expect(vencimientos).toHaveLength(2); // Solo los que vencen en <= 30 días
      expect(vencimientos[0].estado).toBe('vencido');
      expect(vencimientos[1].estado).toBe('por_vencer');
    });

    it('debe incluir datos del trabajador', () => {
      examsService.createExam(db, { worker_id: workerId, tipo: 'periodico', fecha: '2026-01-01', vencimiento: '2026-12-31' });
      
      const vencimientos = examsService.getVencimientosProximos(db, 365);
      
      expect(vencimientos[0]).toMatchObject({
        worker_id: workerId,
        nombres: 'Juan',
        apellidos: 'Pérez',
        tipo: 'examen_periodico',
      });
    });
  });

  describe('getExamenIngresoVigente', () => {
    it('debe retornar examen de ingreso más reciente', () => {
      examsService.createExam(db, { worker_id: workerId, tipo: 'ingreso', fecha: '2026-01-15' });
      examsService.createExam(db, { worker_id: workerId, tipo: 'periodico', fecha: '2026-07-15' });
      
      const ingreso = examsService.getExamenIngresoVigente(db, workerId);
      
      expect(ingreso).toBeDefined();
      expect(ingreso?.tipo).toBe('ingreso');
      expect(ingreso?.fecha).toBe('2026-01-15');
    });

    it('debe retornar undefined si no hay examen de ingreso', () => {
      examsService.createExam(db, { worker_id: workerId, tipo: 'periodico', fecha: '2026-07-15' });
      
      const ingreso = examsService.getExamenIngresoVigente(db, workerId);
      
      expect(ingreso).toBeUndefined();
    });
  });
});