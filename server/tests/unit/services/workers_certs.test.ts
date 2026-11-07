import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../../setup.js';
import * as certsService from '../../../src/services/workers_certs.js';
import * as workersService from '../../../src/services/workers.js';

describe('Certificados - Servicio', () => {
  let db: ReturnType<typeof createTestDb>;
  let workerId: string;

  beforeEach(() => {
    db = createTestDb();
    const worker = workersService.createWorker(db, {
      tipo_documento: 'CC',
      nombres: 'Carlos',
      apellidos: 'López',
      numero_documento: '1122334455',
      cargo: 'Trabajador en alturas',
      fecha_ingreso: '2020-01-01',
    });
    workerId = worker.id;
  });

  describe('crearCertificado', () => {
    it('debe crear certificado de alturas con vigencia 3 años exactos (Res. 4272/2021)', () => {
      const cert = certsService.crearCertificado(db, {
        worker_id: workerId,
        tipo: 'alturas',
        nombre_curso: 'Trabajo en alturas - Nivel básico',
        entidad: 'SENA',
        fecha_emision: '2026-01-15',
        fecha_vencimiento: '2029-01-15', // Exactamente 3 años
      });

      expect(cert.id).toBeDefined();
      expect(cert.tipo).toBe('alturas');
      expect(cert.fecha_emision).toBe('2026-01-15');
      expect(cert.fecha_vencimiento).toBe('2029-01-15');
    });

    it('debe lanzar error si vigencia de alturas no es 3 años exactos', () => {
      expect(() => 
        certsService.crearCertificado(db, {
          worker_id: workerId,
          tipo: 'alturas',
          fecha_emision: '2026-01-15',
          fecha_vencimiento: '2028-01-15', // Solo 2 años
        })
      ).toThrow('Certificado de alturas debe tener vigencia exacta de 3 años');
    });

    it('debe lanzar error si vigencia de alturas es más de 3 años', () => {
      expect(() => 
        certsService.crearCertificado(db, {
          worker_id: workerId,
          tipo: 'alturas',
          fecha_emision: '2026-01-15',
          fecha_vencimiento: '2030-01-15', // 4 años
        })
      ).toThrow('Certificado de alturas debe tener vigencia exacta de 3 años');
    });

    it('debe crear certificados de otros tipos sin validación estricta', () => {
      const types: certsService.WorkerCert['tipo'][] = ['electrico', 'primeros_auxilios', 'brigada', 'conduccion', 'sst_50h', 'otro'];
      
      for (const tipo of types) {
        const cert = certsService.crearCertificado(db, {
          worker_id: workerId,
          tipo,
          fecha_emision: '2026-01-15',
          fecha_vencimiento: '2027-01-15', // 1 año, válido para otros tipos
        });
        expect(cert.tipo).toBe(tipo);
      }
    });

    it('debe crear certificado con campos opcionales', () => {
      const cert = certsService.crearCertificado(db, {
        worker_id: workerId,
        tipo: 'primeros_auxilios',
        nombre_curso: 'Primeros auxilios básico',
        entidad: 'Cruz Roja',
        fecha_emision: '2026-03-01',
        fecha_vencimiento: '2027-03-01',
        archivo_url: '/files/cert-123.pdf',
        notas: 'Vigente hasta renovación',
      });

      expect(cert.nombre_curso).toBe('Primeros auxilios básico');
      expect(cert.entidad).toBe('Cruz Roja');
      expect(cert.archivo_url).toBe('/files/cert-123.pdf');
      expect(cert.notas).toBe('Vigente hasta renovación');
    });
  });

  describe('updateCert', () => {
    it('debe actualizar certificado', () => {
      const cert = certsService.crearCertificado(db, {
        worker_id: workerId,
        tipo: 'electrico',
        fecha_emision: '2026-01-15',
        fecha_vencimiento: '2027-01-15',
      });

      const updated = certsService.updateCert(db, cert.id, {
        entidad: 'Nueva Entidad',
        notas: 'Actualizado',
      });

      expect(updated.entidad).toBe('Nueva Entidad');
      expect(updated.notas).toBe('Actualizado');
    });

    it('debe revalidar vigencia al cambiar tipo a alturas', () => {
      const cert = certsService.crearCertificado(db, {
        worker_id: workerId,
        tipo: 'electrico',
        fecha_emision: '2026-01-15',
        fecha_vencimiento: '2027-01-15',
      });

      expect(() => 
        certsService.updateCert(db, cert.id, { tipo: 'alturas' })
      ).toThrow('Certificado de alturas debe tener vigencia exacta de 3 años');
    });

    it('debe permitir cambiar a alturas con fechas correctas', () => {
      const cert = certsService.crearCertificado(db, {
        worker_id: workerId,
        tipo: 'electrico',
        fecha_emision: '2026-01-15',
        fecha_vencimiento: '2029-01-15', // Ya 3 años
      });

      const updated = certsService.updateCert(db, cert.id, { tipo: 'alturas' });
      expect(updated.tipo).toBe('alturas');
    });

    it('debe revalidar al cambiar fecha_emision en certificado de alturas', () => {
      const cert = certsService.crearCertificado(db, {
        worker_id: workerId,
        tipo: 'alturas',
        fecha_emision: '2026-01-15',
        fecha_vencimiento: '2029-01-15',
      });

      expect(() => 
        certsService.updateCert(db, cert.id, { fecha_emision: '2025-01-15' })
      ).toThrow('Certificado de alturas debe tener vigencia exacta de 3 años');
    });

    it('debe lanzar error si certificado no existe', () => {
      expect(() => 
        certsService.updateCert(db, 'non-existent', { notas: 'test' })
      ).toThrow('Certificado no encontrado');
    });
  });

  describe('getCertsByWorker', () => {
    it('debe retornar certificados ordenados por fecha_emision descendente', () => {
      certsService.crearCertificado(db, { worker_id: workerId, tipo: 'alturas', fecha_emision: '2026-01-15', fecha_vencimiento: '2029-01-15' });
      certsService.crearCertificado(db, { worker_id: workerId, tipo: 'electrico', fecha_emision: '2026-06-15', fecha_vencimiento: '2027-06-15' });
      certsService.crearCertificado(db, { worker_id: workerId, tipo: 'primeros_auxilios', fecha_emision: '2025-12-01', fecha_vencimiento: '2026-12-01' });

      const certs = certsService.getCertsByWorker(db, workerId);
      
      expect(certs).toHaveLength(3);
      expect(certs[0].fecha_emision).toBe('2026-06-15'); // Más reciente
      expect(certs[1].fecha_emision).toBe('2026-01-15');
      expect(certs[2].fecha_emision).toBe('2025-12-01');
    });
  });

  describe('getCertById', () => {
    it('debe retornar certificado por ID', () => {
      const created = certsService.crearCertificado(db, {
        worker_id: workerId,
        tipo: 'alturas',
        fecha_emision: '2026-01-15',
        fecha_vencimiento: '2029-01-15',
      });
      const found = certsService.getCertById(db, created.id);
      expect(found).toEqual(created);
    });

    it('debe retornar undefined si no existe', () => {
      const found = certsService.getCertById(db, 'non-existent');
      expect(found).toBeUndefined();
    });
  });

  describe('deleteCert', () => {
    it('debe eliminar certificado', () => {
      const cert = certsService.crearCertificado(db, {
        worker_id: workerId,
        tipo: 'brigada',
        fecha_emision: '2026-01-15',
        fecha_vencimiento: '2027-01-15',
      });
      
      certsService.deleteCert(db, cert.id);
      
      const found = certsService.getCertById(db, cert.id);
      expect(found).toBeUndefined();
    });
  });

  describe('getVencimientosProximos', () => {
    it('debe detectar certificados vencidos, por vencer y vigentes', () => {
      const hoy = new Date().toISOString().slice(0, 10);
      const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const en15dias = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
      const en60dias = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
      const emisionAlturas = new Date(en15dias);
      emisionAlturas.setUTCFullYear(emisionAlturas.getUTCFullYear() - 3);

      certsService.crearCertificado(db, { worker_id: workerId, tipo: 'electrico', fecha_emision: '2025-01-01', fecha_vencimiento: ayer });
      certsService.crearCertificado(db, { worker_id: workerId, tipo: 'alturas', fecha_emision: emisionAlturas.toISOString().slice(0, 10), fecha_vencimiento: en15dias });
      certsService.crearCertificado(db, { worker_id: workerId, tipo: 'brigada', fecha_emision: '2026-01-01', fecha_vencimiento: en60dias });

      const vencimientos = certsService.getVencimientosProximos(db, 30);
      
      expect(vencimientos).toHaveLength(2);
      expect(vencimientos[0].estado).toBe('vencido');
      expect(vencimientos[0].tipo).toBe('cert_electrico');
      expect(vencimientos[1].estado).toBe('por_vencer');
      expect(vencimientos[1].tipo).toBe('cert_alturas');
    });
  });

  describe('Helpers de alturas', () => {
    it('calcularVencimientoAlturas debe sumar 3 años exactos', () => {
      const vencimiento = certsService.calcularVencimientoAlturas('2026-01-15');
      expect(vencimiento).toBe('2029-01-15');
    });

    it('calcularVencimientoAlturas debe manejar años bisiestos', () => {
      const vencimiento = certsService.calcularVencimientoAlturas('2024-02-29');
      expect(vencimiento).toBe('2027-02-28'); // 2027 no es bisiesto
    });

    it('validarCertificadoAlturas debe validar correctamente', () => {
      const valido = certsService.validarCertificadoAlturas('2026-01-15', '2029-01-15');
      expect(valido.valido).toBe(true);
    });

    it('validarCertificadoAlturas debe rechazar vigencia incorrecta', () => {
      const invalido = certsService.validarCertificadoAlturas('2026-01-15', '2028-01-15');
      expect(invalido.valido).toBe(false);
      expect(invalido.mensaje).toContain('3 años exactos');
    });
  });
});