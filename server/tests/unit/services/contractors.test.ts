import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../../setup.js';
import * as contractorsService from '../../../src/services/contractors.js';

describe('Contratistas - Servicio', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('lista contratistas con las columnas de trazabilidad presentes en la migración', () => {
    const contractors = contractorsService.getContractors(db);
    expect(Array.isArray(contractors)).toBe(true);
  });

  it('crea un contratista con fechas de trazabilidad', () => {
    const created = contractorsService.createContractor(db, {
      nombre: 'Instalaciones Eléctricas SAS',
      nit: '900.123.456-7',
      servicio: 'Instalación de tableros',
      arl: 'Positiva',
    });

    expect(created.id).toBeDefined();
    expect(created.nombre).toBe('Instalaciones Eléctricas SAS');
    expect(created.estado).toBe('pendiente');
    expect((created as { creado_en?: string }).creado_en).toBeTruthy();
    expect((created as { actualizado_en?: string }).actualizado_en).toBeTruthy();
  });

  it('lista correctamente después de crear y ordena por fecha de evaluación', () => {
    contractorsService.createContractor(db, { nombre: 'Contratista A', servicio: 'CCTV', fecha_evaluacion: '2026-01-10' });
    contractorsService.createContractor(db, { nombre: 'Contratista B', servicio: 'Alarmas', fecha_evaluacion: '2026-02-10' });

    const list = contractorsService.getContractors(db);
    expect(list).toHaveLength(2);
    expect((list[0] as { nombre: string }).nombre).toBe('Contratista B');
  });

  it('actualiza y mantiene el registro en el listado', () => {
    const created = contractorsService.createContractor(db, { nombre: 'Contratista C', servicio: 'Control de acceso' });
    const updated = contractorsService.updateContractor(db, created.id, { estado: 'aprobado' });

    expect(updated.estado).toBe('aprobado');
    expect((updated as { actualizado_en?: string }).actualizado_en).toBeTruthy();
    expect(contractorsService.getContractors(db)).toHaveLength(1);
  });
});
