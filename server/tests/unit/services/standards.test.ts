import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../../setup.js';
import * as standardsService from '../../../src/services/standards.js';

describe('Estándares (Normativa) - Servicio', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  describe('getStandards', () => {
    it('debe retornar todos los estándares activos', () => {
      const standards = standardsService.getStandards(db);
      expect(Array.isArray(standards)).toBe(true);
    });

    it('debe filtrar por set_aplicable', () => {
      // Los seeds ya insertan estándares, verificar filtrado
      const iso = standardsService.getStandards(db, 'iso45001');
      const resoluciones = standardsService.getStandards(db, 'resoluciones_colombia');
      
      expect(iso.every(s => s.set_aplicable === 'iso45001')).toBe(true);
      expect(resoluciones.every(s => s.set_aplicable === 'resoluciones_colombia')).toBe(true);
    });

    it('debe ordenar por set_aplicable y codigo', () => {
      const standards = standardsService.getStandards(db);
      for (let i = 1; i < standards.length; i++) {
        const prev = standards[i-1];
        const curr = standards[i];
        if (prev.set_aplicable === curr.set_aplicable) {
          expect(curr.codigo >= prev.codigo).toBe(true);
        }
      }
    });
  });

  describe('getStandardById', () => {
    it('debe retornar estándar por ID', () => {
      const all = standardsService.getStandards(db);
      if (all.length > 0) {
        const found = standardsService.getStandardById(db, all[0].id);
        expect(found).toEqual(all[0]);
      }
    });

    it('debe retornar undefined si no existe', () => {
      const found = standardsService.getStandardById(db, 'non-existent');
      expect(found).toBeUndefined();
    });
  });

  describe('createStandard', () => {
    it('debe crear estándar', () => {
      const standard = standardsService.createStandard(db, {
        codigo: 'ISO-45001-TEST',
        titulo: 'Requisito de prueba',
        descripcion: 'Descripción del requisito de prueba',
        set_aplicable: 'iso45001',
        capitulo: '4. Contexto de la organización',
        modo_verificacion: 'documental',
      });

      expect(standard.id).toBeDefined();
      expect(standard.codigo).toBe('ISO-45001-TEST');
      expect(standard.titulo).toBe('Requisito de prueba');
      expect(standard.set_aplicable).toBe('iso45001');
      expect(standard.activo).toBe(1);
    });

    it('debe usar modo_verificacion null por defecto', () => {
      const standard = standardsService.createStandard(db, {
        codigo: 'TEST-001',
        titulo: 'Sin modo',
        descripcion: 'Test',
        set_aplicable: 'otro',
        capitulo: 'General',
      });

      expect(standard.modo_verificacion).toBeNull();
    });
  });

  describe('Evaluaciones de estándares (Standard Assessments)', () => {
    let standardId: string;

    beforeEach(() => {
      const standard = standardsService.createStandard(db, {
        codigo: 'STD-TEST-001',
        titulo: 'Estándar para evaluar',
        descripcion: 'Descripción',
        set_aplicable: 'iso45001',
        capitulo: '4',
      });
      standardId = standard.id;
    });

    it('debe crear evaluación', () => {
      const assessment = standardsService.createStandardAssessment(db, {
        standard_id: standardId,
        cumple: true,
        observaciones: 'Cumple completamente',
        plan_mejora: null,
        fecha: '2026-06-15',
      });

      expect(assessment.id).toBeDefined();
      expect(assessment.standard_id).toBe(standardId);
      expect(assessment.cumple).toBe(1);
      expect(assessment.observaciones).toBe('Cumple completamente');
      expect(assessment.plan_mejora).toBeNull();
    });

    it('debe usar fecha actual por defecto', () => {
      const assessment = standardsService.createStandardAssessment(db, {
        standard_id: standardId,
        cumple: false,
      });

      expect(assessment.fecha).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('debe listar evaluaciones ordenadas por fecha descendente', () => {
      standardsService.createStandardAssessment(db, { standard_id: standardId, cumple: true, fecha: '2026-01-15' });
      standardsService.createStandardAssessment(db, { standard_id: standardId, cumple: false, fecha: '2026-03-15' });
      standardsService.createStandardAssessment(db, { standard_id: standardId, cumple: true, fecha: '2026-02-15' });

      const assessments = standardsService.getStandardAssessments(db);
      
      expect(assessments).toHaveLength(3);
      expect(assessments[0].fecha).toBe('2026-03-15'); // Más reciente
      expect(assessments[1].fecha).toBe('2026-02-15');
      expect(assessments[2].fecha).toBe('2026-01-15');
    });

    it('debe actualizar evaluación y actualizar fecha', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-15T10:00:00.000Z'));
      const assessment = standardsService.createStandardAssessment(db, {
        standard_id: standardId,
        cumple: true,
        observaciones: 'Original',
      });

      vi.advanceTimersByTime(1);
      const updated = standardsService.updateStandardAssessment(db, assessment.id, {
        cumple: false,
        observaciones: 'Actualizado',
        plan_mejora: 'Plan de acción',
      });

      vi.useRealTimers();
      expect(updated.cumple).toBe(0);
      expect(updated.observaciones).toBe('Actualizado');
      expect(updated.plan_mejora).toBe('Plan de acción');
      expect(updated.fecha).not.toBe(assessment.fecha); // Fecha actualizada
    });

    it('debe eliminar evaluación', () => {
      const assessment = standardsService.createStandardAssessment(db, {
        standard_id: standardId,
        cumple: true,
      });
      
      standardsService.deleteStandardAssessment(db, assessment.id);
      
      const assessments = standardsService.getStandardAssessments(db);
      expect(assessments.find(a => a.id === assessment.id)).toBeUndefined();
    });
  });

  describe('stdCumplimiento', () => {
    it('debe calcular porcentaje de cumplimiento', () => {
      const std1 = standardsService.createStandard(db, {
        codigo: 'STD-1', titulo: 'S1', descripcion: 'D1', set_aplicable: 'test', capitulo: '1'
      });
      const std2 = standardsService.createStandard(db, {
        codigo: 'STD-2', titulo: 'S2', descripcion: 'D2', set_aplicable: 'test', capitulo: '1'
      });
      const std3 = standardsService.createStandard(db, {
        codigo: 'STD-3', titulo: 'S3', descripcion: 'D3', set_aplicable: 'test', capitulo: '1'
      });

      standardsService.createStandardAssessment(db, { standard_id: std1.id, cumple: true });
      standardsService.createStandardAssessment(db, { standard_id: std2.id, cumple: true });
      standardsService.createStandardAssessment(db, { standard_id: std3.id, cumple: false });

      const stats = standardsService.stdCumplimiento(db);
      
      expect(stats.total).toBe(3);
      expect(stats.cumplidos).toBe(2);
      expect(stats.incumplidos).toBe(1);
      expect(stats.porcentaje).toBe(67); // 2/3 * 100 = 66.66 -> 67
    });

    it('debe manejar caso sin evaluaciones', () => {
      const stats = standardsService.stdCumplimiento(db);
      
      expect(stats.total).toBe(0);
      expect(stats.cumplidos).toBe(0);
      expect(stats.incumplidos).toBe(0);
      expect(stats.porcentaje).toBe(0);
    });

    it('debe manejar todos cumplidos', () => {
      const std = standardsService.createStandard(db, {
        codigo: 'STD-1', titulo: 'S1', descripcion: 'D1', set_aplicable: 'test', capitulo: '1'
      });
      standardsService.createStandardAssessment(db, { standard_id: std.id, cumple: true });
      
      const stats = standardsService.stdCumplimiento(db);
      
      expect(stats.porcentaje).toBe(100);
    });

    it('debe manejar todos incumplidos', () => {
      const std = standardsService.createStandard(db, {
        codigo: 'STD-1', titulo: 'S1', descripcion: 'D1', set_aplicable: 'test', capitulo: '1'
      });
      standardsService.createStandardAssessment(db, { standard_id: std.id, cumple: false });
      
      const stats = standardsService.stdCumplimiento(db);
      
      expect(stats.porcentaje).toBe(0);
    });
  });
});