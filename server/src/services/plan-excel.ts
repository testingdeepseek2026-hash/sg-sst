import ExcelJS from 'exceljs';

/**
 * Lector del formato real PL-SGSST-01 (plan de trabajo anual).
 *
 * Cada actividad ocupa un bloque de dos filas combinadas horizontalmente:
 * - fila P: cronograma programado
 * - fila E: cronograma ejecutado
 * Las columnas Actividad, Evidencia y Responsable están combinadas a lo ancho
 * del bloque; Objetivo, Meta y Estado pueden estarlo por grupos.
 */

export type EstadoPlan = 'pendiente' | 'en_proceso' | 'cumplido' | 'incumplido';

export type AnnualPlanImportRow = {
  anio: number;
  programa: string | null;
  objetivo: string;
  meta: string | null;
  evidencia_esperada: string | null;
  responsable: string | null;
  estado: EstadoPlan;
  meses: number[];
  meses_ejecutados: number[];
  porcentaje: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  presupuesto: number;
  fila: number;
  errores: string[];
};

export type AnnualPlanExcelPreview = {
  hoja: string;
  anioDetectado: number | null;
  totalFilas: number;
  validas: number;
  conErrores: number;
  filasValidas: AnnualPlanImportRow[];
  filasConErrores: AnnualPlanImportRow[];
};

type Rango = {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
};

function columnaANumero(letras: string): number {
  let n = 0;
  for (const ch of letras.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function parseRango(ref: string): Rango | null {
  const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(ref.toUpperCase());
  if (!m) return null;
  return {
    startRow: Number(m[2]),
    startCol: columnaANumero(m[1]),
    endRow: Number(m[4]),
    endCol: columnaANumero(m[3]),
  };
}

function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function texto(valor: ExcelJS.CellValue): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'string') {
    const limpio = valor.replace(/\s+/g, ' ').trim();
    return limpio || null;
  }
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  if (valor instanceof Date) return null;
  const obj = valor as unknown as Record<string, unknown>;
  if (Array.isArray(obj.richText)) {
    const unido = (obj.richText as { text: string }[]).map((t) => t.text).join('');
    return unido.replace(/\s+/g, ' ').trim() || null;
  }
  if (obj.hyperlink !== undefined && obj.text !== undefined)
    return texto(obj.text as ExcelJS.CellValue);
  if (obj.result !== undefined) return texto(obj.result as ExcelJS.CellValue);
  return null;
}

function fechaISO(fecha: Date): string {
  // ExcelJS entrega las fechas a medianoche UTC; usar UTC evita que en
  // Colombia (UTC-5) el 2026-07-01 se lea como 2026-06-30.
  const y = fecha.getUTCFullYear();
  const m = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const d = String(fecha.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function esCeldaPropia(cell: ExcelJS.Cell): boolean {
  return !cell.isMerged || cell.master.address === cell.address;
}

export async function parseAnnualPlanExcel(
  buffer: Buffer | ArrayBuffer
): Promise<AnnualPlanExcelPreview> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);

  const ws =
    wb.worksheets.find((hoja) => normalizar(hoja.name).includes('plan de trabajo')) ??
    wb.worksheets.find((hoja) => normalizar(hoja.name).includes('plan anual')) ??
    wb.worksheets[0];
  if (!ws) throw new Error('El archivo no contiene hojas');

  const merges: Rango[] = ((ws.model.merges ?? []) as string[])
    .map(parseRango)
    .filter((r): r is Rango => r !== null);

  const ultimaFila = ws.rowCount;
  const ultimaColumna = ws.columnCount;

  // 1. Fila de encabezados: debe contener "Objetivo" y "Actividad".
  let filaEncabezado = -1;
  for (let r = 1; r <= Math.min(ultimaFila, 50); r++) {
    let tieneObjetivo = false;
    let tieneActividad = false;
    for (let c = 1; c <= ultimaColumna; c++) {
      const valor = normalizar(texto(ws.getCell(r, c).value) ?? '');
      if (valor === 'objetivo') tieneObjetivo = true;
      if (valor.startsWith('actividad')) tieneActividad = true;
    }
    if (tieneObjetivo && tieneActividad) {
      filaEncabezado = r;
      break;
    }
  }
  if (filaEncabezado < 0) {
    throw new Error(
      'No se encontró la fila de encabezados (se requieren las columnas "Objetivo" y "Actividad")'
    );
  }

  const col = {
    programa: 0,
    objetivoExcel: 0,
    meta: 0,
    actividad: 0,
    evidencia: 0,
    responsable: 0,
    estado: 0,
    porcentaje: 0,
  };
  for (let c = 1; c <= ultimaColumna; c++) {
    const valor = normalizar(texto(ws.getCell(filaEncabezado, c).value) ?? '');
    if (!valor) continue;
    if (valor.startsWith('programa')) col.programa ||= c;
    else if (valor.startsWith('objetivo')) col.objetivoExcel ||= c;
    else if (valor.startsWith('meta')) col.meta ||= c;
    else if (valor.startsWith('actividad')) col.actividad ||= c;
    else if (valor.startsWith('evidencia')) col.evidencia ||= c;
    else if (valor.startsWith('responsable')) col.responsable ||= c;
    else if (valor.includes('estado')) col.estado ||= c;
    else if (valor.includes('cumplimiento') && !col.porcentaje) col.porcentaje = c;
  }
  if (!col.actividad) {
    throw new Error('No se encontró la columna "Actividad" en los encabezados');
  }

  // 2. Fila de meses: la que tenga más celdas con fecha dentro del encabezado.
  let filaFechas = -1;
  let columnasMes = new Map<number, Date>();
  for (let r = filaEncabezado; r <= Math.min(filaEncabezado + 5, ultimaFila); r++) {
    const fechas = new Map<number, Date>();
    for (let c = 1; c <= ultimaColumna; c++) {
      const valor = ws.getCell(r, c).value;
      if (valor instanceof Date) fechas.set(c, valor);
    }
    if (fechas.size > columnasMes.size) {
      columnasMes = fechas;
      filaFechas = r;
    }
  }
  if (columnasMes.size < 2) {
    throw new Error(
      'No se encontró el cronograma de meses (fila de encabezado con fechas como "2026-07-01")'
    );
  }

  const mesesPorColumna = new Map<number, number>();
  let anioDetectado: number | null = null;
  for (const [c, fecha] of columnasMes) {
    mesesPorColumna.set(c, fecha.getUTCMonth() + 1);
    if (anioDetectado === null || fecha.getUTCFullYear() < anioDetectado) {
      anioDetectado = fecha.getUTCFullYear();
    }
  }

  // 3. Recorrer actividades: solo la celda maestra del combinado de Actividad.
  const inicioDatos = Math.max(filaEncabezado, filaFechas) + 1;
  const filasValidas: AnnualPlanImportRow[] = [];
  const filasConErrores: AnnualPlanImportRow[] = [];

  for (let r = inicioDatos; r <= ultimaFila; r++) {
    const celdaActividad = ws.getCell(r, col.actividad);
    if (!esCeldaPropia(celdaActividad)) continue;
    const actividad = texto(celdaActividad.value);
    if (!actividad) continue;

    const rangoActividad = merges.find(
      (rango) =>
        rango.startRow === r && rango.startCol === col.actividad && rango.endRow >= rango.startRow
    );
    const filasBloque: number[] = [];
    if (rangoActividad) {
      for (let rr = rangoActividad.startRow; rr <= rangoActividad.endRow; rr++) {
        filasBloque.push(rr);
      }
    } else {
      filasBloque.push(r);
    }

    const leer = (fila: number, columna: number): string | null =>
      columna > 0 ? texto(ws.getCell(fila, columna).value) : null;

    const estadosBloque = filasBloque.map((fila) => ({
      fila,
      estado: normalizar(leer(fila, col.estado) ?? ''),
    }));
    let filasProgramadas = estadosBloque.filter(({ estado }) => estado.startsWith('p'));
    let filasEjecutadas = estadosBloque.filter(({ estado }) => estado.startsWith('e'));
    if (filasProgramadas.length === 0 && filasEjecutadas.length === 0) {
      // Sin columna Estado utilizable: la primera fila es la programada.
      filasProgramadas = [{ fila: filasBloque[0], estado: 'p' }];
      filasEjecutadas = filasBloque.slice(1).map((fila) => ({ fila, estado: 'e' }));
    }

    const marcarMeses = (filas: { fila: number }[]): number[] => {
      const meses = new Set<number>();
      for (const { fila } of filas) {
        for (const [c, mes] of mesesPorColumna) {
          const valor = texto(ws.getCell(fila, c).value);
          if (valor && valor.trim().toUpperCase() === 'X') meses.add(mes);
        }
      }
      return [...meses].sort((a, b) => a - b);
    };

    const meses = marcarMeses(filasProgramadas);
    const mesesEjecutados = marcarMeses(filasEjecutadas);

    const fechasDeMeses = (listaMeses: number[]): Date[] =>
      [...columnasMes.entries()]
        .filter(([, fecha]) => listaMeses.includes(fecha.getUTCMonth() + 1))
        .map(([, fecha]) => fecha)
        .sort((a, b) => a.getTime() - b.getTime());
    const fechasProgramadas = fechasDeMeses(meses);
    const fechasEjecutadas = fechasDeMeses(mesesEjecutados);
    const fechasReferencia = fechasProgramadas.length ? fechasProgramadas : fechasEjecutadas;

    const programados = meses.length;
    const ejecutados = mesesEjecutados.length;
    let porcentaje = 0;
    if (programados > 0) {
      porcentaje = Math.min(100, Math.round((ejecutados / programados) * 100));
    }
    let estado: EstadoPlan = 'pendiente';
    if (programados > 0 && porcentaje >= 100) estado = 'cumplido';
    else if (porcentaje > 0 || (programados === 0 && ejecutados > 0)) estado = 'en_proceso';

    const anio = fechasReferencia.length
      ? fechasReferencia[0].getUTCFullYear()
      : (anioDetectado ?? new Date().getFullYear());

    const errores: string[] = [];

    const filaImport: AnnualPlanImportRow = {
      anio,
      programa: leer(r, col.programa) ?? leer(r, col.objetivoExcel),
      objetivo: actividad,
      meta: leer(r, col.meta),
      evidencia_esperada: leer(r, col.evidencia),
      responsable: leer(r, col.responsable),
      estado,
      meses,
      meses_ejecutados: mesesEjecutados,
      porcentaje,
      fecha_inicio: fechasReferencia.length ? fechaISO(fechasReferencia[0]) : null,
      fecha_fin: fechasReferencia.length
        ? fechaISO(fechasReferencia[fechasReferencia.length - 1])
        : null,
      presupuesto: 0,
      fila: r,
      errores,
    };

    if (errores.length > 0) filasConErrores.push(filaImport);
    else filasValidas.push(filaImport);
  }

  return {
    hoja: ws.name,
    anioDetectado,
    totalFilas: filasValidas.length + filasConErrores.length,
    validas: filasValidas.length,
    conErrores: filasConErrores.length,
    filasValidas,
    filasConErrores,
  };
}
