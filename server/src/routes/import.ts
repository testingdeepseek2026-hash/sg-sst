import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import ExcelJS from 'exceljs';
const { Workbook } = ExcelJS;
import { createWorker } from '../services/workers.js';
import { createStandardAssessment } from '../services/standards.js';
import { createAnnualPlan } from '../services/plans.js';
import { createIncident } from '../services/incidents.js';
import { createHazardAssessment } from '../services/hazards.js';
import * as UsersService from '../services/users.js';

async function readFileBuffer(file: any): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  // fastify multipart puede devolver un iterable o un array según la versión
  const fileArray = Array.isArray(file) ? file : [file];
  for (const f of fileArray) {
    const stream = f.file;
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
  }
  return Buffer.concat(chunks as any);
}

const importRoutes: FastifyPluginAsync = async (fastify) => {
  async function handleImport(request: any, reply: any, factory: (db: any, row: any[]) => void) {
    const uid = request.userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const parts = await request.files();
    const files = Array.isArray(parts) ? parts : [parts];
    if (!files.length) return reply.code(400).send({ error: 'No se envió archivo' });
    const file = files[0];
    const buf = await readFileBuffer(file);
    const wb = new Workbook();
    await wb.xlsx.load(buf as any);
    const ws = wb.worksheets[0];
    let importados = 0;
    const errores: string[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      try {
        const vals = (row.values as any[]) ?? [];
        factory(fastify.db, vals);
        importados++;
      } catch (e: any) {
        errores.push(`Fila ${rowNumber}: ${e.message}`);
      }
    });
    UsersService.auditLog(fastify.db, {
      usuario_id: uid, usuario_email: me.email, accion: 'importar', entidad: 'importaciones',
      valores_nuevos: { importados, errores: errores.length }
    });
    return { importados, errores };
  }

  fastify.post('/import/trabajadores', async (request, reply) => {
    return handleImport(request, reply, (db, vals) => {
      const [tipo_doc, num_doc, nombres, apellidos, cargo, fecha_ing, estado, eps, arl] = vals;
      if (!num_doc) return;
      createWorker(db, {
        tipo_documento: tipo_doc ?? 'CC', numero_documento: String(num_doc),
        nombres: String(nombres ?? ''), apellidos: String(apellidos ?? ''), cargo: String(cargo ?? ''),
        fecha_ingreso: fecha_ing ?? new Date().toISOString().slice(0, 10),
        estado: estado ?? 'activo', eps: eps ?? null, arl: arl ?? null
      });
    });
  });

  fastify.post('/import/riesgos', async (request, reply) => {
    return handleImport(request, reply, (db, vals) => {
      const [cargo, area, peligro, tarea, valoracion, responsable] = vals;
      if (!peligro) return;
      createHazardAssessment(db, {
        cargo_oficio: String(cargo ?? ''), area: area ?? null, peligro_texto: String(peligro),
        tarea: tarea ?? null, valoracion_riesgo: valoracion ?? 'medio', responsable: responsable ?? null
      });
    });
  });

  fastify.post('/import/incidentes', async (request, reply) => {
    return handleImport(request, reply, (db, vals) => {
      const [tipo, fecha, descripcion, estado] = vals;
      if (!fecha) return;
      createIncident(db, {
        tipo: tipo ?? 'incidente', fecha_ocurrencia: String(fecha), descripcion: String(descripcion ?? ''),
        estado: estado ?? 'abierto'
      });
    });
  });
};

export default importRoutes;
