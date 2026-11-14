import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { parseAnnualPlanExcel } from '../../../src/services/plan-excel.js';

const COL_INICIO_MESES = 8; // H
const COL_PORCENTAJE = 20; // T

function fechasMensuales(anio: number, mesInicio: number): Date[] {
  return Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(anio, mesInicio - 1 + i, 1)));
}

async function construirPlan(fechas: Date[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Plan de trabajo Anual 2026');

  ws.getCell('A1').value = 'PLAN DE TRABAJO ANUAL';
  ws.mergeCells('A1:U2');

  ws.getCell('A3').value = 'POLÍTICA DEL SISTEMA DE GESTIÓN';
  ws.mergeCells('A3:A5');
  const encabezados: [number, string][] = [
    [2, 'Objetivo'],
    [3, 'Meta'],
    [4, 'Actividad'],
    [5, 'Evidencia'],
    [6, 'Responsable'],
    [7, '*Estado de la actividad'],
  ];
  for (const [col, texto] of encabezados) {
    ws.getCell(3, col).value = texto;
    ws.mergeCells(3, col, 5, col);
  }
  ws.getCell(3, COL_PORCENTAJE).value = '% DE CUMPLIMIENTO';
  for (let i = 0; i < 12; i++) {
    ws.getCell(3, COL_INICIO_MESES + i).value = 'CRONOGRAMA DE ACTIVIDADES';
    ws.getCell(5, COL_INICIO_MESES + i).value = fechas[i];
  }
  ws.mergeCells(3, COL_INICIO_MESES, 4, COL_INICIO_MESES + 11);
  ws.mergeCells(3, COL_PORCENTAJE, 5, COL_PORCENTAJE + 1);

  const grupos = [
    { desde: 6, hasta: 15, objetivo: 'Objetivo 1', meta: 'Meta 1' },
    { desde: 16, hasta: 31, objetivo: 'Objetivo 2', meta: 'Meta 2' },
    { desde: 32, hasta: 41, objetivo: 'Objetivo 3', meta: 'Meta 3' },
  ];
  for (const grupo of grupos) {
    ws.getCell(grupo.desde, 2).value = grupo.objetivo;
    ws.mergeCells(grupo.desde, 2, grupo.hasta, 2);
    ws.getCell(grupo.desde, 3).value = grupo.meta;
    ws.mergeCells(grupo.desde, 3, grupo.hasta, 3);
    ws.getCell(grupo.desde, COL_PORCENTAJE + 1).value = 0.5;
    ws.mergeCells(grupo.desde, COL_PORCENTAJE + 1, grupo.hasta, COL_PORCENTAJE + 1);
  }

  for (let i = 0; i < 18; i++) {
    const fila = 6 + i * 2;
    ws.getCell(fila, 4).value = `Actividad ${i + 1}`;
    ws.getCell(fila, 5).value = `Evidencia ${i + 1}`;
    ws.getCell(fila, 6).value = `Responsable ${i + 1}`;
    for (const col of [4, 5, 6]) ws.mergeCells(fila, col, fila + 1, col);

    ws.getCell(fila, 7).value = 'P';
    ws.getCell(fila + 1, 7).value = 'E';

    // Programado: julio siempre; agosto en la primera actividad.
    ws.getCell(fila, COL_INICIO_MESES).value = 'X';
    if (i === 0) ws.getCell(fila, COL_INICIO_MESES + 1).value = 'X';
    // Ejecutado: julio en las dos primeras actividades.
    if (i <= 1) ws.getCell(fila + 1, COL_INICIO_MESES).value = 'X';

    ws.getCell(fila, COL_PORCENTAJE).value = i === 0 ? 0.5 : i === 1 ? 1 : 0;
    ws.mergeCells(fila, COL_PORCENTAJE, fila + 1, COL_PORCENTAJE);
  }

  ws.getCell('A42').value = '* P: Actividades PLANEADAS\n* E: Actividades EJECUTADAS';
  ws.mergeCells('A42:F42');

  return (await wb.xlsx.writeBuffer()) as Buffer;
}

describe('parseAnnualPlanExcel', () => {
  it('agrupa las dos filas combinadas en una actividad por bloque', async () => {
    const preview = await parseAnnualPlanExcel(await construirPlan(fechasMensuales(2026, 7)));

    expect(preview.validas).toBe(18);
    expect(preview.conErrores).toBe(0);
    expect(preview.totalFilas).toBe(18);
    expect(preview.anioDetectado).toBe(2026);

    const primera = preview.filasValidas[0];
    expect(primera).toMatchObject({
      objetivo: 'Actividad 1',
      programa: 'Objetivo 1',
      meta: 'Meta 1',
      evidencia_esperada: 'Evidencia 1',
      responsable: 'Responsable 1',
      meses: [7, 8],
      meses_ejecutados: [7],
      porcentaje: 50,
      estado: 'en_proceso',
      fecha_inicio: '2026-07-01',
      fecha_fin: '2026-08-01',
      fila: 6,
    });

    const segunda = preview.filasValidas[1];
    expect(segunda.meses).toEqual([7]);
    expect(segunda.meses_ejecutados).toEqual([7]);
    expect(segunda.porcentaje).toBe(100);
    expect(segunda.estado).toBe('cumplido');

    const tercera = preview.filasValidas[2];
    expect(tercera.porcentaje).toBe(0);
    expect(tercera.estado).toBe('pendiente');
    expect(tercera.meses_ejecutados).toEqual([]);

    expect(preview.filasValidas[17].objetivo).toBe('Actividad 18');
    expect(preview.filasValidas[17].programa).toBe('Objetivo 3');
  });

  it('toma los meses de las fechas: un plan que inicia en enero usa 1..12', async () => {
    const preview = await parseAnnualPlanExcel(await construirPlan(fechasMensuales(2027, 1)));

    expect(preview.anioDetectado).toBe(2027);
    const primera = preview.filasValidas[0];
    expect(primera.anio).toBe(2027);
    expect(primera.meses).toEqual([1, 2]);
    expect(primera.fecha_inicio).toBe('2027-01-01');
    expect(primera.fecha_fin).toBe('2027-02-01');
  });
});
