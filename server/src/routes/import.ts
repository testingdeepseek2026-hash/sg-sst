import ExcelJS from 'exceljs';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { createHazardAssessment } from '../services/hazards.js';
import { createIncident } from '../services/incidents.js';
import * as UsersService from '../services/users.js';
import { createWorker } from '../services/workers.js';

const { Workbook } = ExcelJS;

async function readFileBuffer(file: any): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const fileArray = Array.isArray(file) ? file : [file];
  for (const f of fileArray) {
    const stream = f.file;
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
  }
  return Buffer.concat(chunks as any);
}

function excelToJson(buf: Buffer): { headers: string[]; rows: any[][]; preview: any[] } {
  const wb = new Workbook();
  wb.xlsx.load(buf as any);
  const ws = wb.worksheets[0];
  
  const headers: string[] = [];
  const rows: any[][] = [];
  const preview: any[] = [];
  
  ws.eachRow((row, rowNumber) => {
    const vals = (row.values as any[]) ?? [];
    if (rowNumber === 1) {
      // Headers
      for (let i = 1; i < vals.length; i++) {
        headers.push(String(vals[i] ?? `Col${i}`));
      }
    } else {
      const rowData = vals.slice(1);
      rows.push(rowData);
      if (preview.length < 5) {
        const obj: Record<string, any> = {};
        headers.forEach((h, i) => { obj[h] = rowData[i]; });
        preview.push(obj);
      }
    }
  });
  
  return { headers, rows, preview };
}

const importRoutes: FastifyPluginAsync = async (fastify) => {
  // Preview endpoint - returns headers and first 5 rows for validation
  fastify.post('/import/preview', async (request, reply) => {
    const uid = request.userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    
    const parts = await request.files();
    const files = Array.isArray(parts) ? parts : [parts];
    if (!files.length) return reply.code(400).send({ error: 'No se envió archivo' });
    const file = files[0];
    const buf = await readFileBuffer(file);
    
    try {
      const { headers, rows, preview } = excelToJson(buf);
      return {
        headers,
        totalRows: rows.length,
        preview,
        message: `Archivo válido: ${headers.length} columnas, ${rows.length} filas de datos`
      };
    } catch (e: any) {
      return reply.code(400).send({ error: `Error leyendo Excel: ${e.message}` });
    }
  });

  async function handleImport(
    request: any, 
    reply: any, 
    factory: (db: any, row: any[], headers: string[]) => { success: boolean; error?: string; data?: any }
  ) {
    const uid = request.userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    
    const parts = await request.files();
    const files = Array.isArray(parts) ? parts : [parts];
    if (!files.length) return reply.code(400).send({ error: 'No se envió archivo' });
    const file = files[0];
    const buf = await readFileBuffer(file);
    
    let headers: string[] = [];
    let rows: any[][] = [];
    
    try {
      const parsed = excelToJson(buf);
      headers = parsed.headers;
      rows = parsed.rows;
    } catch (e: any) {
      return reply.code(400).send({ error: `Error leyendo Excel: ${e.message}` });
    }
    
    let importados = 0;
    const errores: string[] = [];
    const advertencias: string[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // +2 because row 1 is header, 0-indexed
      try {
        const result = factory(fastify.db, rows[i], headers);
        if (result.success) {
          importados++;
        } else {
          errores.push(`Fila ${rowNumber}: ${result.error}`);
        }
        if (result.data?.advertencia) {
          advertencias.push(`Fila ${rowNumber}: ${result.data.advertencia}`);
        }
      } catch (e: any) {
        errores.push(`Fila ${rowNumber}: ${e.message}`);
      }
    }
    
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'importar',
      entidad: 'importaciones',
      valores_nuevos: { importados, errores: errores.length, advertencias: advertencias.length },
    });
    
    return { 
      importados, 
      errores, 
      advertencias,
      resumen: {
        total: rows.length,
        exitosos: importados,
        fallidos: errores.length,
        advertencias: advertencias.length
      }
    };
  }

  // Import workers with validation
  fastify.post('/import/trabajadores', async (request, reply) => {
    const workerSchema = z.object({
      tipo_documento: z.string().optional().default('CC'),
      numero_documento: z.string().min(3),
      nombres: z.string().min(1),
      apellidos: z.string().min(1),
      cargo: z.string().min(1),
      fecha_ingreso: z.string().optional(),
      estado: z.enum(['activo', 'inactivo', 'retirado']).optional().default('activo'),
      eps: z.string().optional(),
      afp: z.string().optional(),
      arl: z.string().optional(),
      caja_compensacion: z.string().optional(),
      telefono: z.string().optional(),
      email: z.string().email().optional(),
      fecha_egreso: z.string().optional().nullable(),
    });

    return handleImport(request, reply, (db, row, headers) => {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      
      // Normalize field names (case-insensitive match)
      const getVal = (keys: string[]) => {
        for (const k of keys) {
          const found = Object.keys(obj).find(o => o.toLowerCase() === k.toLowerCase());
          if (found) return obj[found];
        }
        return undefined;
      };

      const parsed = workerSchema.safeParse({
        tipo_documento: getVal(['tipo_documento', 'tipo_doc', 'documento_tipo']) ?? 'CC',
        numero_documento: getVal(['numero_documento', 'num_documento', 'documento', 'id']),
        nombres: getVal(['nombres', 'nombre']),
        apellidos: getVal(['apellidos', 'apellido']),
        cargo: getVal(['cargo', 'puesto']),
        fecha_ingreso: getVal(['fecha_ingreso', 'fecha_ing', 'ingreso', 'fecha_ingreso']),
        estado: getVal(['estado']),
        eps: getVal(['eps']),
        afp: getVal(['afp']),
        arl: getVal(['arl']),
        caja_compensacion: getVal(['caja_compensacion', 'caja']),
        telefono: getVal(['telefono', 'tel']),
        email: getVal(['email', 'correo']),
        fecha_egreso: getVal(['fecha_egreso', 'egreso']),
      });

      if (!parsed.success) {
        return { success: false, error: parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ') };
      }

      if (!parsed.data.numero_documento) {
        return { success: false, error: 'Número de documento requerido' };
      }

      // Check duplicate
      const existing = db.prepare('SELECT id FROM workers WHERE numero_documento = ?').get(parsed.data.numero_documento);
      if (existing) {
        return { success: false, error: `Documento ${parsed.data.numero_documento} ya existe` };
      }

      createWorker(db, parsed.data);
      return { success: true };
    });
  });

  // Import risks with validation
  fastify.post('/import/riesgos', async (request, reply) => {
    const riskSchema = z.object({
      cargo_oficio: z.string().optional().default(''),
      area: z.string().optional().nullable(),
      peligro_texto: z.string().min(1),
      tarea: z.string().optional().nullable(),
      valoracion_riesgo: z.enum(['bajo', 'medio', 'alto', 'critico']).optional().default('medio'),
      responsable: z.string().optional().nullable(),
    });

    return handleImport(request, reply, (db, row, headers) => {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      
      const getVal = (keys: string[]) => {
        for (const k of keys) {
          const found = Object.keys(obj).find(o => o.toLowerCase() === k.toLowerCase());
          if (found) return obj[found];
        }
        return undefined;
      };

      const parsed = riskSchema.safeParse({
        cargo_oficio: getVal(['cargo_oficio', 'cargo', 'oficio']),
        area: getVal(['area', 'área']),
        peligro_texto: getVal(['peligro_texto', 'peligro', 'riesgo', 'peligro_nombre']),
        tarea: getVal(['tarea', 'actividad']),
        valoracion_riesgo: getVal(['valoracion_riesgo', 'valoracion', 'riesgo_nivel']),
        responsable: getVal(['responsable', 'resp']),
      });

      if (!parsed.success) {
        return { success: false, error: parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ') };
      }

      if (!parsed.data.peligro_texto) {
        return { success: false, error: 'Peligro requerido' };
      }

      createHazardAssessment(db, parsed.data);
      return { success: true };
    });
  });

  // Import incidents with validation
  fastify.post('/import/incidentes', async (request, reply) => {
    const incidentSchema = z.object({
      tipo: z.enum(['incidente', 'accidente', 'enfermedad_laboral']).optional().default('incidente'),
      fecha_ocurrencia: z.string(),
      descripcion: z.string().optional().default(''),
      estado: z.enum(['abierto', 'investigando', 'cerrado']).optional().default('abierto'),
      trabajador_id: z.string().optional().nullable(),
      lugar: z.string().optional().nullable(),
      lesiones: z.string().optional().nullable(),
      causa_raiz: z.string().optional().nullable(),
      acciones_correctivas: z.string().optional().nullable(),
      reporte_arl: z.boolean().optional().default(false),
      reporte_eps: z.boolean().optional().default(false),
      reporte_mintrabajo: z.boolean().optional().default(false),
      dias_perdidos: z.number().int().min(0).optional().default(0),
      investigador: z.string().optional().nullable(),
      fecha_cierre: z.string().optional().nullable(),
    });

    return handleImport(request, reply, (db, row, headers) => {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      
      const getVal = (keys: string[]) => {
        for (const k of keys) {
          const found = Object.keys(obj).find(o => o.toLowerCase() === k.toLowerCase());
          if (found) return obj[found];
        }
        return undefined;
      };

      const parsed = incidentSchema.safeParse({
        tipo: getVal(['tipo', 'tipo_incidente']),
        fecha_ocurrencia: getVal(['fecha_ocurrencia', 'fecha', 'fecha_ocu']),
        descripcion: getVal(['descripcion', 'descripción', 'detalle']),
        estado: getVal(['estado']),
        trabajador_id: getVal(['trabajador_id', 'trabajador', 'worker_id']),
        lugar: getVal(['lugar', 'ubicacion']),
        lesiones: getVal(['lesiones', 'lesion']),
        causa_raiz: getVal(['causa_raiz', 'causa', 'causa_raíz']),
        acciones_correctivas: getVal(['acciones_correctivas', 'acciones', 'correctivas']),
        reporte_arl: getVal(['reporte_arl', 'arl']),
        reporte_eps: getVal(['reporte_eps', 'eps']),
        reporte_mintrabajo: getVal(['reporte_mintrabajo', 'mintrabajo', 'min_trabajo']),
        dias_perdidos: getVal(['dias_perdidos', 'dias', 'dias_perd']),
        investigador: getVal(['investigador', 'investigador_nombre']),
        fecha_cierre: getVal(['fecha_cierre', 'cierre']),
      });

      if (!parsed.success) {
        return { success: false, error: parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ') };
      }

      if (!parsed.data.fecha_ocurrencia) {
        return { success: false, error: 'Fecha de ocurrencia requerida' };
      }

      createIncident(db, parsed.data);
      return { success: true };
    });
  });

  // Download template endpoint
  fastify.get('/import/template/:type', async (request, reply) => {
    const { type } = request.params as { type: string };
    
    const wb = new Workbook();
    const ws = wb.addWorksheet('Plantilla');
    
    let columns: { header: string; key: string; width: number }[] = [];
    let exampleRow: Record<string, any> = {};
    
    switch (type) {
      case 'trabajadores':
        columns = [
          { header: 'tipo_documento', key: 'tipo_documento', width: 18 },
          { header: 'numero_documento', key: 'numero_documento', width: 22 },
          { header: 'nombres', key: 'nombres', width: 20 },
          { header: 'apellidos', key: 'apellidos', width: 20 },
          { header: 'cargo', key: 'cargo', width: 20 },
          { header: 'fecha_ingreso', key: 'fecha_ingreso', width: 15 },
          { header: 'estado', key: 'estado', width: 15 },
          { header: 'eps', key: 'eps', width: 20 },
          { header: 'afp', key: 'afp', width: 20 },
          { header: 'arl', key: 'arl', width: 20 },
          { header: 'caja_compensacion', key: 'caja_compensacion', width: 22 },
          { header: 'telefono', key: 'telefono', width: 15 },
          { header: 'email', key: 'email', width: 25 },
          { header: 'fecha_egreso', key: 'fecha_egreso', width: 15 },
        ];
        exampleRow = {
          tipo_documento: 'CC',
          numero_documento: '123456789',
          nombres: 'Juan',
          apellidos: 'Pérez',
          cargo: 'Técnico Instalador',
          fecha_ingreso: '2024-01-15',
          estado: 'activo',
          eps: 'Nueva EPS',
          afp: 'Porvenir',
          arl: 'Positiva',
          caja_compensacion: 'Compensar',
          telefono: '3001234567',
          email: 'juan@empresa.com',
          fecha_egreso: '',
        };
        break;
      case 'riesgos':
        columns = [
          { header: 'cargo_oficio', key: 'cargo_oficio', width: 22 },
          { header: 'area', key: 'area', width: 20 },
          { header: 'peligro_texto', key: 'peligro_texto', width: 50 },
          { header: 'tarea', key: 'tarea', width: 30 },
          { header: 'valoracion_riesgo', key: 'valoracion_riesgo', width: 20 },
          { header: 'responsable', key: 'responsable', width: 20 },
        ];
        exampleRow = {
          cargo_oficio: 'Técnico Instalador',
          area: 'Obra Norte',
          peligro_texto: 'Trabajo en altura > 2m sin protección',
          tarea: 'Instalación cámaras en fachada',
          valoracion_riesgo: 'alto',
          responsable: 'Juan Pérez',
        };
        break;
      case 'incidentes':
        columns = [
          { header: 'tipo', key: 'tipo', width: 18 },
          { header: 'fecha_ocurrencia', key: 'fecha_ocurrencia', width: 18 },
          { header: 'descripcion', key: 'descripcion', width: 50 },
          { header: 'estado', key: 'estado', width: 15 },
          { header: 'trabajador_id', key: 'trabajador_id', width: 20 },
          { header: 'lugar', key: 'lugar', width: 30 },
          { header: 'lesiones', key: 'lesiones', width: 30 },
          { header: 'causa_raiz', key: 'causa_raiz', width: 40 },
          { header: 'acciones_correctivas', key: 'acciones_correctivas', width: 40 },
          { header: 'reporte_arl', key: 'reporte_arl', width: 15 },
          { header: 'reporte_eps', key: 'reporte_eps', width: 15 },
          { header: 'reporte_mintrabajo', key: 'reporte_mintrabajo', width: 20 },
          { header: 'dias_perdidos', key: 'dias_perdidos', width: 15 },
          { header: 'investigador', key: 'investigador', width: 20 },
          { header: 'fecha_cierre', key: 'fecha_cierre', width: 15 },
        ];
        exampleRow = {
          tipo: 'incidente',
          fecha_ocurrencia: '2024-01-15',
          descripcion: 'Caída de escalera sin consecuencias',
          estado: 'abierto',
          trabajador_id: '',
          lugar: 'Obra Norte - Planta 2',
          lesiones: 'Ninguna',
          causa_raiz: 'Escalera mal apoyada',
          acciones_correctivas: 'Capacitación uso escaleras',
          reporte_arl: false,
          reporte_eps: false,
          reporte_mintrabajo: false,
          dias_perdidos: 0,
          investigador: 'Carlos López',
          fecha_cierre: '',
        };
        break;
      default:
        return reply.code(400).send({ error: 'Tipo de plantilla no válido. Use: trabajadores, riesgos, incidentes' });
    }
    
    ws.columns = columns;
    ws.addRow(exampleRow);
    
    // Add header style
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    
    const buf = await wb.xlsx.writeBuffer();
    reply.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename=plantilla_${type}.xlsx`);
    return buf;
  });
};

export default importRoutes;