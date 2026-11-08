import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../../setup.js';
import * as policiesService from '../../../src/services/policies.js';

describe('Políticas - Servicio', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  describe('getPolicies', () => {
    it('debe retornar array vacío si no hay políticas', () => {
      const policies = policiesService.getPolicies(db);
      expect(policies).toEqual([]);
    });

    it('debe retornar todas las políticas ordenadas por versión descendente', () => {
      const p1 = policiesService.createPolicy(db, { titulo: 'Política 1', contenido: 'Contenido 1', estado: 'borrador' });
      const p2 = policiesService.createPolicy(db, { titulo: 'Política 2', contenido: 'Contenido 2', estado: 'vigente' });
      const p3 = policiesService.createPolicy(db, { titulo: 'Política 3', contenido: 'Contenido 3', estado: 'archivada' });

      const policies = policiesService.getPolicies(db);
      expect(policies).toHaveLength(3);
      expect(policies[0].id).toBe(p3.id); // versión más alta primero
      expect(policies[1].id).toBe(p2.id);
      expect(policies[2].id).toBe(p1.id);
    });
  });

  describe('getPolicyById', () => {
    it('debe retornar undefined si no existe', () => {
      const policy = policiesService.getPolicyById(db, 'non-existent');
      expect(policy).toBeUndefined();
    });

    it('debe retornar la política correcta', () => {
      const created = policiesService.createPolicy(db, { titulo: 'Test', contenido: 'Content' });
      const found = policiesService.getPolicyById(db, created.id);
      expect(found).toEqual(created);
    });
  });

  describe('getActivePolicy', () => {
    it('debe retornar undefined si no hay política vigente', () => {
      policiesService.createPolicy(db, { titulo: 'Borrador', contenido: 'Content', estado: 'borrador' });
      policiesService.createPolicy(db, { titulo: 'Archivada', contenido: 'Content', estado: 'archivada' });
      
      const active = policiesService.getActivePolicy(db);
      expect(active).toBeUndefined();
    });

    it('debe retornar la política vigente', () => {
      policiesService.createPolicy(db, { titulo: 'Borrador', contenido: 'Content', estado: 'borrador' });
      const active = policiesService.createPolicy(db, { titulo: 'Vigente', contenido: 'Content', estado: 'vigente' });
      
      const found = policiesService.getActivePolicy(db);
      expect(found).toEqual(active);
    });
  });

  describe('createPolicy', () => {
    it('debe crear una política en estado borrador por defecto', () => {
      const policy = policiesService.createPolicy(db, { titulo: 'Nueva', contenido: 'Contenido' });
      
      expect(policy.id).toBeDefined();
      expect(policy.version).toBe(1);
      expect(policy.titulo).toBe('Nueva');
      expect(policy.contenido).toBe('Contenido');
      expect(policy.estado).toBe('borrador');
      expect(policy.firmado_por).toBeNull();
      expect(policy.fecha_firma).toBeNull();
      expect(policy.fecha_divulgacion).toBeNull();
    });

    it('debe crear una política en estado especificado', () => {
      const policy = policiesService.createPolicy(db, { 
        titulo: 'Vigente directa', 
        contenido: 'Contenido', 
        estado: 'vigente' 
      });
      
      expect(policy.estado).toBe('vigente');
    });

    it('debe lanzar error si se intenta crear segunda política vigente', () => {
      policiesService.createPolicy(db, { titulo: 'Primera', contenido: 'Content', estado: 'vigente' });
      
      expect(() => 
        policiesService.createPolicy(db, { titulo: 'Segunda', contenido: 'Content', estado: 'vigente' })
      ).toThrow('Ya existe una política vigente');
    });
  });

  describe('updatePolicy', () => {
    it('debe actualizar título y contenido de política en borrador', () => {
      const policy = policiesService.createPolicy(db, { titulo: 'Original', contenido: 'Original', estado: 'borrador' });
      
      const updated = policiesService.updatePolicy(db, policy.id, { 
        titulo: 'Actualizado', 
        contenido: 'Nuevo contenido' 
      });
      
      expect(updated.titulo).toBe('Actualizado');
      expect(updated.contenido).toBe('Nuevo contenido');
      expect(updated.id).toBe(policy.id);
      expect(updated.version).toBe(1);
    });

    it('debe crear nueva versión al editar política vigente', () => {
      const active = policiesService.createPolicy(db, { titulo: 'Vigente', contenido: 'Content', estado: 'vigente' });
      
      const updated = policiesService.updatePolicy(db, active.id, { titulo: 'Nuevo título' });
      
      expect(updated.id).not.toBe(active.id);
      expect(updated.version).toBe(2);
      expect(updated.estado).toBe('borrador');
      expect(updated.titulo).toBe('Nuevo título');
      
      // La original debe estar archivada
      const archived = policiesService.getPolicyById(db, active.id);
      expect(archived?.estado).toBe('archivada');
    });

    it('debe lanzar error si política no existe', () => {
      expect(() => 
        policiesService.updatePolicy(db, 'non-existent', { titulo: 'Test' })
      ).toThrow('Política no encontrada');
    });
  });

  describe('deletePolicy', () => {
    it('debe eliminar política en borrador', () => {
      const policy = policiesService.createPolicy(db, { titulo: 'Para borrar', contenido: 'Content', estado: 'borrador' });
      
      policiesService.deletePolicy(db, policy.id);
      
      const found = policiesService.getPolicyById(db, policy.id);
      expect(found).toBeUndefined();
    });

    it('debe lanzar error al intentar eliminar política vigente', () => {
      const policy = policiesService.createPolicy(db, { titulo: 'Vigente', contenido: 'Content', estado: 'vigente' });
      
      expect(() => 
        policiesService.deletePolicy(db, policy.id)
      ).toThrow('Solo se pueden eliminar políticas en estado borrador');
    });

    it('debe lanzar error al intentar eliminar política archivada', () => {
      const policy = policiesService.createPolicy(db, { titulo: 'Archivada', contenido: 'Content', estado: 'archivada' });
      
      expect(() => 
        policiesService.deletePolicy(db, policy.id)
      ).toThrow('Solo se pueden eliminar políticas en estado borrador');
    });
  });

  describe('firmarPolicy', () => {
    it('debe firmar política en borrador y ponerla vigente', () => {
      const policy = policiesService.createPolicy(db, { titulo: 'Para firmar', contenido: 'Content', estado: 'borrador' });
      
      const signed = policiesService.firmarPolicy(db, policy.id, 'Gerente General');
      
      expect(signed.estado).toBe('vigente');
      expect(signed.firmado_por).toBe('Gerente General');
      expect(signed.fecha_firma).toBeDefined();
      expect(signed.fecha_firma).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('debe lanzar error al firmar política no borrador', () => {
      const policy = policiesService.createPolicy(db, { titulo: 'Vigente', contenido: 'Content', estado: 'vigente' });
      
      expect(() => 
        policiesService.firmarPolicy(db, policy.id, 'Gerente')
      ).toThrow('Solo se pueden firmar políticas en estado borrador');
    });

    it('debe lanzar error si ya existe otra política vigente', () => {
      policiesService.createPolicy(db, { titulo: 'Existente', contenido: 'Content', estado: 'vigente' });
      const toSign = policiesService.createPolicy(db, { titulo: 'Para firmar', contenido: 'Content', estado: 'borrador' });
      
      expect(() => 
        policiesService.firmarPolicy(db, toSign.id, 'Gerente')
      ).toThrow('Ya existe una política vigente');
    });
  });

  describe('divulgarPolicy', () => {
    it('debe divulgar política vigente', () => {
      const policy = policiesService.createPolicy(db, { titulo: 'Por divulgar', contenido: 'Content', estado: 'borrador' });
      policiesService.firmarPolicy(db, policy.id, 'Gerente');
      
      const divulgated = policiesService.divulgarPolicy(db, policy.id);
      
      expect(divulgated.fecha_divulgacion).toBeDefined();
      expect(divulgated.fecha_divulgacion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('debe lanzar error al divulgar política no vigente', () => {
      const policy = policiesService.createPolicy(db, { titulo: 'Borrador', contenido: 'Content', estado: 'borrador' });
      
      expect(() => 
        policiesService.divulgarPolicy(db, policy.id)
      ).toThrow('Solo se pueden divulgar políticas vigentes');
    });

    it('debe lanzar error si ya fue divulgada', () => {
      const policy = policiesService.createPolicy(db, { titulo: 'Por divulgar', contenido: 'Content', estado: 'borrador' });
      policiesService.firmarPolicy(db, policy.id, 'Gerente');
      policiesService.divulgarPolicy(db, policy.id);
      
      expect(() => 
        policiesService.divulgarPolicy(db, policy.id)
      ).toThrow('Esta política ya ha sido divulgada');
    });
  });

  describe('archivarPolicy', () => {
    it('debe archivar política vigente', () => {
      const policy = policiesService.createPolicy(db, { titulo: 'Vigente', contenido: 'Content', estado: 'vigente' });
      
      const archived = policiesService.archivarPolicy(db, policy.id);
      
      expect(archived.estado).toBe('archivada');
    });

    it('debe lanzar error si ya está archivada', () => {
      const policy = policiesService.createPolicy(db, { titulo: 'Archivada', contenido: 'Content', estado: 'archivada' });
      
      expect(() => 
        policiesService.archivarPolicy(db, policy.id)
      ).toThrow('La política ya está archivada');
    });
  });

  describe('Objectives CRUD', () => {
    let policy: ReturnType<typeof policiesService.createPolicy>;

    beforeEach(() => {
      policy = policiesService.createPolicy(db, { titulo: 'Con objetivos', contenido: 'Content', estado: 'vigente' });
    });

    it('debe crear objetivo', () => {
      const objective = policiesService.createObjective(db, {
        policy_id: policy.id,
        descripcion: 'Objetivo de prueba',
        tipo: 'resultado',
        meta: 'Meta 100%',
        responsable: 'Jefe',
        fecha_limite: '2026-12-31',
        estado: 'pendiente',
      });
      
      expect(objective.id).toBeDefined();
      expect(objective.policy_id).toBe(policy.id);
      expect(objective.descripcion).toBe('Objetivo de prueba');
      expect(objective.tipo).toBe('resultado');
      expect(objective.estado).toBe('pendiente');
    });

    it('debe listar objetivos de una política', () => {
      policiesService.createObjective(db, { policy_id: policy.id, descripcion: 'Obj 1', tipo: 'estructura' });
      policiesService.createObjective(db, { policy_id: policy.id, descripcion: 'Obj 2', tipo: 'proceso' });
      policiesService.createObjective(db, { policy_id: policy.id, descripcion: 'Obj 3', tipo: 'resultado' });
      
      const objectives = policiesService.getObjectives(db, policy.id);
      
      expect(objectives).toHaveLength(3);
      // Ordenados por tipo y fecha creación
      expect(objectives[0].tipo).toBe('estructura');
      expect(objectives[1].tipo).toBe('proceso');
      expect(objectives[2].tipo).toBe('resultado');
    });

    it('debe actualizar objetivo', () => {
      const objective = policiesService.createObjective(db, { 
        policy_id: policy.id, 
        descripcion: 'Original', 
        tipo: 'estructura',
        estado: 'pendiente',
      });
      
      const updated = policiesService.updateObjective(db, objective.id, { 
        descripcion: 'Actualizado', 
        estado: 'cumplido' 
      });
      
      expect(updated.descripcion).toBe('Actualizado');
      expect(updated.estado).toBe('cumplido');
    });

    it('debe eliminar objetivo', () => {
      const objective = policiesService.createObjective(db, { 
        policy_id: policy.id, 
        descripcion: 'Para borrar', 
        tipo: 'estructura' 
      });
      
      policiesService.deleteObjective(db, objective.id);
      
      const objectives = policiesService.getObjectives(db, policy.id);
      expect(objectives).toHaveLength(0);
    });

    it('debe retornar objetivos de política activa', () => {
      policiesService.createObjective(db, { policy_id: policy.id, descripcion: 'Obj activo', tipo: 'resultado' });
      
      // Crear otra política borrador con objetivo
      const draft = policiesService.createPolicy(db, { titulo: 'Borrador', contenido: 'Content', estado: 'borrador' });
      policiesService.createObjective(db, { policy_id: draft.id, descripcion: 'Obj borrador', tipo: 'estructura' });
      
      const activeObjectives = policiesService.getObjectivesByActivePolicy(db);
      
      expect(activeObjectives).toHaveLength(1);
      expect(activeObjectives[0].descripcion).toBe('Obj activo');
    });
  });
});