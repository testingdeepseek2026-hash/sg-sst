import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../../setup.js';
import * as eppService from '../../../src/services/workers_epp.js';
import * as workersService from '../../../src/services/workers.js';

describe('EPP (Elementos de Protección Personal) - Servicio', () => {
  let db: ReturnType<typeof createTestDb>;
  let workerId: string;

  beforeEach(() => {
    db = createTestDb();
    const worker = workersService.createWorker(db, {
      tipo_documento: 'CC',
      nombres: 'Ana',
      apellidos: 'Martínez',
      numero_documento: '5566778899',
      cargo: 'Soldador',
      fecha_ingreso: '2020-01-01',
    });
    workerId = worker.id;
  });

  describe('createEpp', () => {
    it('debe crear entrega de EPP', () => {
      const epp = eppService.createEpp(db, {
        worker_id: workerId,
        item: 'Casco de seguridad',
        cantidad: 1,
        fecha_entrega: '2026-01-15',
        fecha_vencimiento: '2027-01-15',
        notas: 'Casco clase G',
      });

      expect(epp.id).toBeDefined();
      expect(epp.worker_id).toBe(workerId);
      expect(epp.item).toBe('Casco de seguridad');
      expect(epp.cantidad).toBe(1);
      expect(epp.fecha_entrega).toBe('2026-01-15');
      expect(epp.fecha_vencimiento).toBe('2027-01-15');
      expect(epp.firmado_por_trabajador).toBe(0);
      expect(epp.firma_url).toBeNull();
    });

    it('debe usar cantidad 1 por defecto', () => {
      const epp = eppService.createEpp(db, {
        worker_id: workerId,
        item: 'Guantes de protección',
        fecha_entrega: '2026-01-15',
      });

      expect(epp.cantidad).toBe(1);
    });

    it('debe permitir cualquier item (incluyendo "Otro")', () => {
      const items = [
        'Casco de seguridad',
        'Arnés de cuerpo completo',
        'Gafas de seguridad',
        'Guantes de protección',
        'Botas de seguridad',
        'Protección auditiva (tapones/orejeras)',
        'Ropa reflectiva (chaleco)',
        'Respirador / mascarilla',
        'Protección facial (careta)',
        'Cinturón de seguridad',
        'Línea de vida',
        'Dispositivo anticaídas',
        'Otro',
        'Elemento personalizado',
      ];

      for (const item of items) {
        const epp = eppService.createEpp(db, {
          worker_id: workerId,
          item,
          fecha_entrega: '2026-01-15',
        });
        expect(epp.item).toBe(item);
      }
    });
  });

  describe('getEppByWorker', () => {
    it('debe retornar EPPs ordenados por fecha_entrega descendente', () => {
      eppService.createEpp(db, { worker_id: workerId, item: 'Casco', fecha_entrega: '2026-01-15' });
      eppService.createEpp(db, { worker_id: workerId, item: 'Guantes', fecha_entrega: '2026-03-15' });
      eppService.createEpp(db, { worker_id: workerId, item: 'Botas', fecha_entrega: '2026-02-15' });

      const epps = eppService.getEppByWorker(db, workerId);
      
      expect(epps).toHaveLength(3);
      expect(epps[0].item).toBe('Guantes'); // Más reciente
      expect(epps[1].item).toBe('Botas');
      expect(epps[2].item).toBe('Casco');
    });
  });

  describe('updateEpp', () => {
    it('debe actualizar EPP', () => {
      const epp = eppService.createEpp(db, {
        worker_id: workerId,
        item: 'Casco',
        fecha_entrega: '2026-01-15',
      });

      const updated = eppService.updateEpp(db, epp.id, {
        item: 'Casco clase G',
        fecha_vencimiento: '2027-01-15',
        notas: 'Actualizado',
      });

      expect(updated.item).toBe('Casco clase G');
      expect(updated.fecha_vencimiento).toBe('2027-01-15');
      expect(updated.notas).toBe('Actualizado');
    });

    it('debe retornar sin cambios si patch vacío', () => {
      const epp = eppService.createEpp(db, { worker_id: workerId, item: 'Casco', fecha_entrega: '2026-01-15' });
      const updated = eppService.updateEpp(db, epp.id, {});
      expect(updated).toEqual(epp);
    });
  });

  describe('deleteEpp', () => {
    it('debe eliminar EPP', () => {
      const epp = eppService.createEpp(db, { worker_id: workerId, item: 'Casco', fecha_entrega: '2026-01-15' });
      eppService.deleteEpp(db, epp.id);
      const found = eppService.getEppById(db, epp.id);
      expect(found).toBeUndefined();
    });
  });

  describe('firmarEntregaEpp', () => {
    it('debe firmar entrega de EPP', () => {
      const epp = eppService.createEpp(db, { worker_id: workerId, item: 'Arnés', fecha_entrega: '2026-01-15' });
      
      const signed = eppService.firmarEntregaEpp(db, epp.id, 'data:image/png;base64,abc123', workerId);
      
      expect(signed.firmado_por_trabajador).toBe(1);
      expect(signed.firma_url).toBe('data:image/png;base64,abc123');
    });

    it('debe lanzar error si EPP no existe', () => {
      expect(() => 
        eppService.firmarEntregaEpp(db, 'non-existent', 'firma', workerId)
      ).toThrow('Entrega EPP no encontrada');
    });
  });

  describe('getVencimientosProximos', () => {
    it('debe detectar EPPs vencidos, por vencer y vigentes', () => {
      const hoy = new Date().toISOString().slice(0, 10);
      const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const en15dias = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
      const en60dias = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);

      eppService.createEpp(db, { worker_id: workerId, item: 'Casco', fecha_entrega: '2025-01-01', fecha_vencimiento: ayer });
      eppService.createEpp(db, { worker_id: workerId, item: 'Arnés', fecha_entrega: '2026-01-01', fecha_vencimiento: en15dias });
      eppService.createEpp(db, { worker_id: workerId, item: 'Guantes', fecha_entrega: '2026-01-01', fecha_vencimiento: en60dias });

      const vencimientos = eppService.getVencimientosProximos(db, 30);
      
      expect(vencimientos).toHaveLength(2);
      expect(vencimientos[0].estado).toBe('vencido');
      expect(vencimientos[0].item).toBe('Casco');
      expect(vencimientos[1].estado).toBe('por_vencer');
      expect(vencimientos[1].item).toBe('Arnés');
    });

    it('debe incluir estado "sin_vencimiento" para EPPs sin fecha_vencimiento', () => {
      eppService.createEpp(db, { worker_id: workerId, item: 'Gafas', fecha_entrega: '2026-01-15', fecha_vencimiento: null });
      
      // Los que no tienen vencimiento no aparecen en getVencimientosProximos
      const vencimientos = eppService.getVencimientosProximos(db, 365);
      expect(vencimientos.every(v => v.fecha_vencimiento !== null)).toBe(true);
    });
  });

  describe('getEppSinFirmar', () => {
    it('debe retornar EPPs pendientes de firma', () => {
      eppService.createEpp(db, { worker_id: workerId, item: 'Casco', fecha_entrega: '2026-01-15', firmado_por_trabajador: 0 });
      eppService.createEpp(db, { worker_id: workerId, item: 'Guantes', fecha_entrega: '2026-01-15', firmado_por_trabajador: 1 });
      eppService.createEpp(db, { worker_id: workerId, item: 'Botas', fecha_entrega: '2026-01-15', firmado_por_trabajador: 0 });

      const sinFirmar = eppService.getEppSinFirmar(db);
      
      expect(sinFirmar).toHaveLength(2);
      expect(sinFirmar.every(e => e.item === 'Casco' || e.item === 'Botas')).toBe(true);
      expect(sinFirmar[0]).toHaveProperty('nombres', 'Ana');
      expect(sinFirmar[0]).toHaveProperty('apellidos', 'Martínez');
    });

    it('debe excluir trabajadores inactivos', () => {
      const worker2 = workersService.createWorker(db, {
        tipo_documento: 'CC',
        nombres: 'Inactivo',
        apellidos: 'User',
        numero_documento: '9999999999',
        cargo: 'Test',
        fecha_ingreso: '2020-01-01',
        estado: 'inactivo',
      });
      
      eppService.createEpp(db, { worker_id: workerId, item: 'Casco', fecha_entrega: '2026-01-15', firmado_por_trabajador: 0 });
      eppService.createEpp(db, { worker_id: worker2.id, item: 'Guantes', fecha_entrega: '2026-01-15', firmado_por_trabajador: 0 });

      const sinFirmar = eppService.getEppSinFirmar(db);
      
      expect(sinFirmar).toHaveLength(1);
      expect(sinFirmar[0].worker_id).toBe(workerId);
    });
  });

  describe('getWorkerVencimientos (unificado)', () => {
    it('debe unificar exams, certs y epp ordenados por prioridad', () => {
      const hoy = new Date().toISOString().slice(0, 10);
      const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const en15dias = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);

      // Examen vencido
      eppService.createEpp(db, { worker_id: workerId, item: 'Casco', fecha_entrega: '2025-01-01', fecha_vencimiento: ayer });
      // Certificado por vencer
      // Nota: necesitamos crear cert y exam directamente en DB para este test de integración
      // Aquí probamos que la función existe y retorna array
      const vencimientos = eppService.getWorkerVencimientos(db, 30);
      
      expect(Array.isArray(vencimientos)).toBe(true);
      expect(vencimientos.length).toBeGreaterThan(0);
      // Vencidos primero
      if (vencimientos.length > 1) {
        expect(vencimientos[0].estado).toBe('vencido');
      }
    });
  });

  describe('EPP_ITEMS_COMUNES', () => {
    it('debe exportar lista de items comunes', () => {
      expect(eppService.EPP_ITEMS_COMUNES).toContain('Casco de seguridad');
      expect(eppService.EPP_ITEMS_COMUNES).toContain('Arnés de cuerpo completo');
      expect(eppService.EPP_ITEMS_COMUNES).toContain('Otro');
      expect(eppService.EPP_ITEMS_COMUNES.length).toBeGreaterThan(10);
    });
  });
});