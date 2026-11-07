import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../../setup.js';
import * as hazardsService from '../../../src/services/hazards.js';

describe('Peligros (IPERC) - Servicio', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  describe('Catálogo de peligros', () => {
    it('debe retornar catálogo vacío inicialmente', () => {
      const catalog = hazardsService.getHazardCatalog(db);
      expect(catalog).toEqual([]);
    });

    it('debe crear item en catálogo', () => {
      const item = hazardsService.createHazardCatalogItem(db, {
        codigo: 'EL-001',
        nombre: 'Contacto con partes vivas',
        categoria: 'electrico',
        descripcion: 'Riesgo de electrocución',
        riesgo_por_defecto: 'alto',
        control_sugerido: 'Desenergizar y bloquear',
      });

      expect(item.id).toBeDefined();
      expect(item.codigo).toBe('EL-001');
      expect(item.nombre).toBe('Contacto con partes vivas');
      expect(item.categoria).toBe('electrico');
      expect(item.riesgo_por_defecto).toBe('alto');
      expect(item.activo).toBe(1);
    });

    it('debe usar valores por defecto', () => {
      const item = hazardsService.createHazardCatalogItem(db, {
        codigo: 'ER-001',
        nombre: 'Postura forzada',
        categoria: 'ergonomia',
      });

      expect(item.riesgo_por_defecto).toBe('medio');
      expect(item.control_sugerido).toBeNull();
      expect(item.descripcion).toBeNull();
    });

    it('debe filtrar por categoría', () => {
      hazardsService.createHazardCatalogItem(db, { codigo: 'EL-001', nombre: 'Eléctrico 1', categoria: 'electrico' });
      hazardsService.createHazardCatalogItem(db, { codigo: 'EL-002', nombre: 'Eléctrico 2', categoria: 'electrico' });
      hazardsService.createHazardCatalogItem(db, { codigo: 'AL-001', nombre: 'Alturas 1', categoria: 'alturas' });

      const electricos = hazardsService.getHazardCatalogByCategory(db, 'electrico');
      const alturas = hazardsService.getHazardCatalogByCategory(db, 'alturas');

      expect(electricos).toHaveLength(2);
      expect(alturas).toHaveLength(1);
      expect(electricos.every(e => e.categoria === 'electrico')).toBe(true);
    });

    it('debe ordenar catálogo por categoría y nombre', () => {
      hazardsService.createHazardCatalogItem(db, { codigo: 'B', nombre: 'Zebra', categoria: 'electrico' });
      hazardsService.createHazardCatalogItem(db, { codigo: 'A', nombre: 'Alpha', categoria: 'electrico' });
      hazardsService.createHazardCatalogItem(db, { codigo: 'C', nombre: 'Beta', categoria: 'alturas' });

      const catalog = hazardsService.getHazardCatalog(db);
      
      expect(catalog[0].categoria).toBe('alturas');
      expect(catalog[1].categoria).toBe('electrico');
      expect(catalog[1].nombre).toBe('Alpha');
      expect(catalog[2].nombre).toBe('Zebra');
    });
  });

  describe('Evaluaciones de peligros (IPERC)', () => {
    it('debe crear evaluación con valores por defecto', () => {
      const assessment = hazardsService.createHazardAssessment(db, {
        cargo_oficio: 'Electricista',
      });

      expect(assessment.id).toBeDefined();
      expect(assessment.cargo_oficio).toBe('Electricista');
      expect(assessment.valoracion_riesgo).toBe('medio');
      expect(assessment.estado).toBe('vigente');
      expect(assessment.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('debe crear evaluación completa', () => {
      const hazard = hazardsService.createHazardCatalogItem(db, {
        codigo: 'ALT-TEST',
        nombre: 'Caída de altura',
        categoria: 'alturas',
      });
      const assessment = hazardsService.createHazardAssessment(db, {
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
      });

      expect(assessment.cargo_oficio).toBe('Trabajador en alturas');
      expect(assessment.area).toBe('Techo nave 3');
      expect(assessment.peligro_id).toBe(hazard.id);
      expect(assessment.peligro_texto).toBe('Caída de altura');
      expect(assessment.tarea).toBe('Mantenimiento cubierta');
      expect(assessment.consecuencia).toBe('Fracturas, muerte');
      expect(assessment.probabilidad).toBe('Posible');
      expect(assessment.valoracion_riesgo).toBe('critico');
      expect(assessment.controles).toBe('Arnés, línea de vida, capacitación');
      expect(assessment.responsable).toBe('Jefe seguridad');
      expect(assessment.fecha).toBe('2026-01-15');
    });

    it('debe listar evaluaciones ordenadas por fecha descendente', () => {
      hazardsService.createHazardAssessment(db, { cargo_oficio: 'A', fecha: '2026-01-01' });
      hazardsService.createHazardAssessment(db, { cargo_oficio: 'B', fecha: '2026-03-01' });
      hazardsService.createHazardAssessment(db, { cargo_oficio: 'C', fecha: '2026-02-01' });

      const assessments = hazardsService.getHazardAssessments(db);

      expect(assessments).toHaveLength(3);
      expect(assessments[0].cargo_oficio).toBe('B'); // 2026-03-01
      expect(assessments[1].cargo_oficio).toBe('C'); // 2026-02-01
      expect(assessments[2].cargo_oficio).toBe('A'); // 2026-01-01
    });

    it('debe actualizar evaluación y setear revisado_en', () => {
      const assessment = hazardsService.createHazardAssessment(db, {
        cargo_oficio: 'Original',
        valoracion_riesgo: 'bajo',
      });

      const updated = hazardsService.updateHazardAssessment(db, assessment.id, {
        cargo_oficio: 'Actualizado',
        valoracion_riesgo: 'alto',
        controles: 'Nuevos controles',
      });

      expect(updated.cargo_oficio).toBe('Actualizado');
      expect(updated.valoracion_riesgo).toBe('alto');
      expect(updated.controles).toBe('Nuevos controles');
      expect(updated.revisado_en).toBeDefined();
      expect(updated.revisado_en).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('debe eliminar evaluación', () => {
      const assessment = hazardsService.createHazardAssessment(db, { cargo_oficio: 'Para borrar' });
      
      hazardsService.deleteHazardAssessment(db, assessment.id);
      
      const assessments = hazardsService.getHazardAssessments(db);
      expect(assessments).toHaveLength(0);
    });

    it('debe manejar riesgo crítico', () => {
      const assessment = hazardsService.createHazardAssessment(db, {
        cargo_oficio: 'Espacio confinado',
        valoracion_riesgo: 'critico',
      });

      expect(assessment.valoracion_riesgo).toBe('critico');
    });

    it('debe manejar todos los niveles de riesgo', () => {
      const levels: hazardsService.HazardRiskLevel[] = ['bajo', 'medio', 'alto', 'critico'];
      
      for (const level of levels) {
        const assessment = hazardsService.createHazardAssessment(db, {
          cargo_oficio: `Test ${level}`,
          valoracion_riesgo: level,
        });
        expect(assessment.valoracion_riesgo).toBe(level);
      }
    });

    it('debe manejar todas las categorías', () => {
      const categories: hazardsService.HazardCategory[] = [
        'alturas', 'electrico', 'herramientas', 'escaleras', 
        'ergonomia', 'conduccion', 'cielos_rasos', 'confinados', 
        'locativo', 'otro'
      ];
      
      for (const category of categories) {
        const item = hazardsService.createHazardCatalogItem(db, {
          codigo: `CAT-${category}`,
          nombre: `Peligro ${category}`,
          categoria: category,
        });
        expect(item.categoria).toBe(category);
      }
    });
  });
});