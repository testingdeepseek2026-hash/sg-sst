import ExcelJS from 'exceljs';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { auditLog, getAuthUser, requireRole } from '../lib/auth.js';
import { isPgBackend } from '../lib/db-pg.js';
import {
  bulkCreateTrainingAttendance,
  createAnnualPlan,
  createPlanEvidence,
  createTraining,
  createTrainingAttendance,
  createTrainingSchedule,
  deleteAnnualPlan,
  deletePlanEvidence,
  deleteTraining,
  deleteTrainingAttendance,
  deleteTrainingSchedule,
  getAllPlanEvidences,
  getAnnualPlan,
  getPlanEvidenceById,
  getPlanEvidences,
  getTrainingAttendance,
  getTrainingById,
  getTrainings,
  getTrainingSchedule,
  importAnnualPlan,
  parseEstado,
  updateAnnualPlan,
  updateTraining,
  updateTrainingAttendance,
  updateTrainingSchedule,
} from '../services/plans.js';
import * as PgPlans from '../services/plans.pg.js';
import { saveUploadedFile } from '../services/uploads.js';
import { auditLogPg } from '../services/users.pg.js';

const planSchema = z.object({
  anio: z.number().int(),
  objetivo: z.string().min(2),
  meta: z.string().optional(),
  responsable: z.string().optional(),
  fecha_inicio: z.string(),
  fecha_fin: z.string().optional().nullable(),
  presupuesto: z.number().optional().default(0),
  estado: z.enum(['pendiente', 'en_proceso', 'cumplido', 'incumplido']).default('pendiente'),
  // Fase 2 â€” alineaciÃ³n con el Excel real (PL-SGSST-01)
  programa: z.string().optional().nullable(),
  evidencia_esperada: z.string().optional().nullable(),
  meses: z.array(z.number().int().min(1).max(12)).optional().nullable(),
});
const trainSchema = z.object({
  nombre: z.string().min(2),
  tipo: z.string(),
  fecha: z.string(),
  duracion_horas: z.number().optional(),
  responsable: z.string().optional(),
  objetivo: z.string().optional(),
  estado: z.enum(['programada', 'realizada', 'cancelada']).default('programada'),
});

const trainingSchema = z.object({
  schedule_id: z.string().optional().nullable(),
  nombre: z.string().min(2),
  fecha: z.string(),
  instructor: z.string().optional().nullable(),
  archivo_evidencia: z.string().optional().nullable(),
  estado: z.enum(['programada', 'realizada', 'cancelada']).default('programada'),
});

const trainingAttendanceSchema = z.object({
  training_id: z.string(),
  worker_id: z.string(),
  firmado: z.number().int().min(0).max(1).default(0),
  firma_url: z.string().optional().nullable(),
});

const bulkAttendanceSchema = z.object({
  training_id: z.string(),
  worker_ids: z.array(z.string()).min(1),
});

const plansRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /plans/annual - Cualquier autenticado
  fastify.get('/plans/annual', async (request, _reply) => {
    const { anio } = request.query as { anio?: string };
    return isPgBackend()
      ? PgPlans.getAnnualPlanPg(anio ? Number(anio) : undefined)
      : getAnnualPlan(fastify.db, anio ? Number(anio) : undefined);
  });

  // POST /plans/annual - Solo administrador
  fastify.post(
    '/plans/annual',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const parsed = planSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const plan = isPgBackend()
        ? await PgPlans.createAnnualPlanPg(parsed.data)
        : createAnnualPlan(fastify.db, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'crear',
        entidad: 'annual_plan',
        entidad_id: plan.id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return plan;
    }
  );

  // PUT /plans/annual/:id - Solo administrador
  fastify.put(
    '/plans/annual/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = planSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const updated = isPgBackend()
        ? await PgPlans.updateAnnualPlanPg(id, parsed.data)
        : updateAnnualPlan(fastify.db, id, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'editar',
        entidad: 'annual_plan',
        entidad_id: id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return updated;
    }
  );

  // DELETE /plans/annual/:id - Solo administrador
  fastify.delete(
    '/plans/annual/:id',
    { preHandler: requireRole('administrador') },
    async (request, _reply) => {
      const { id } = request.params as { id: string };
      if (isPgBackend()) await PgPlans.deleteAnnualPlanPg(id);
      else deleteAnnualPlan(fastify.db, id);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'eliminar',
        entidad: 'annual_plan',
        entidad_id: id,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { ok: true };
    }
  );

  // ===== EVIDENCIAS DEL PLAN ANUAL (Fase 2) =====

  // GET /plans/annual/evidencias - Todas las evidencias agrupadas por plan_id
  fastify.get('/plans/annual/evidencias', async (_request, _reply) => {
    return isPgBackend() ? PgPlans.getAllPlanEvidencesPg() : getAllPlanEvidences(fastify.db);
  });

  // POST /plans/annual/:id/evidencias - Subir archivo de soporte (solo administrador)
  fastify.post(
    '/plans/annual/:id/evidencias',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const plan = isPgBackend()
        ? await PgPlans.getAnnualPlanByIdPg(id)
        : fastify.db.prepare('SELECT id FROM annual_plan WHERE id = ?').get(id);
      if (!plan) return reply.code(404).send({ error: 'Actividad no encontrada' });

      let file: Awaited<ReturnType<typeof request.file>> | undefined;
      try {
        file = await request.file();
      } catch {
        file = undefined;
      }
      if (!file) return reply.code(400).send({ error: 'No se enviÃ³ archivo' });
      try {
        const saved = await saveUploadedFile(file, 'plan-anual');
        const user = getAuthUser(request);
        const input = {
          plan_id: id,
          url: saved.url,
          nombre_original: saved.filename,
          mime: file.mimetype,
          tamano: saved.size,
          subido_por: user.email,
        };
        const evidence = isPgBackend()
          ? await PgPlans.createPlanEvidencePg(input)
          : createPlanEvidence(fastify.db, input);

        const entry = {
          usuario_id: user.id,
          usuario_email: user.email,
          accion: 'subir_archivo',
          entidad: 'annual_plan_evidences',
          entidad_id: evidence.id,
          valores_nuevos: { plan_id: id, url: saved.url, nombre_original: saved.filename },
        };
        if (isPgBackend()) await auditLogPg(entry);
        else auditLog(fastify.db, entry);

        return evidence;
      } catch (err: any) {
        return reply.code(400).send({ error: err.message });
      }
    }
  );

  // GET /plans/annual/:id/evidencias - Evidencias de una actividad
  fastify.get('/plans/annual/:id/evidencias', async (request, _reply) => {
    const { id } = request.params as { id: string };
    return isPgBackend() ? PgPlans.getPlanEvidencesPg(id) : getPlanEvidences(fastify.db, id);
  });

  // DELETE /plans/annual/evidencias/:evidId - Eliminar evidencia (solo administrador)
  fastify.delete(
    '/plans/annual/evidencias/:evidId',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { evidId } = request.params as { evidId: string };
      const evidence = isPgBackend()
        ? await PgPlans.getPlanEvidenceByIdPg(evidId)
        : getPlanEvidenceById(fastify.db, evidId);
      if (!evidence) return reply.code(404).send({ error: 'Evidencia no encontrada' });

      if (isPgBackend()) await PgPlans.deletePlanEvidencePg(evidId);
      else deletePlanEvidence(fastify.db, evidId);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'eliminar',
        entidad: 'annual_plan_evidences',
        entidad_id: evidId,
        valores_anteriores: evidence,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { ok: true };
    }
  );

  // ===== IMPORTACIÃ“N MASIVA DESDE EXCEL (Fase 2) =====

  // // POST /plans/annual/import/preview - Previsualizar importación desde Excel
  fastify.post(
    '/plans/annual/import/preview',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      try {
        const resultado = await previewarExcelImport(request);
        return resultado;
      } catch (err: any) {
        return reply.code(400).send({ error: err.message });
      }
    }
  );

  // POST /plans/annual/import/confirm - Confirmar e importar las filas validadas
  fastify.post(
    '/plans/annual/import/confirm',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const schema = z.object({
        filas: z.array(
          z.object({
            anio: z.number().int(),
            programa: z.string().nullable().optional(),
            objetivo: z.string().min(1),
            meta: z.string().nullable().optional(),
            evidencia_esperada: z.string().nullable().optional(),
            responsable: z.string().nullable().optional(),
            estado: z.enum(['pendiente', 'en_proceso', 'cumplido', 'incumplido']),
            meses: z.array(z.number().int().min(1).max(12)),
            fecha_inicio: z.string().nullable().optional(),
            fecha_fin: z.string().nullable().optional(),
            presupuesto: z.number().optional().default(0),
            fila: z.number().int(),
          })
        ),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const rows = parsed.data.filas;
      const resultado = isPgBackend()
        ? await PgPlans.importAnnualPlanPg(rows as any)
        : importAnnualPlan(fastify.db, rows as any);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'importar_excel',
        entidad: 'annual_plan',
        entidad_id: 'import-masivo',
        valores_nuevos: { totalFilas: rows.length, importados: resultado.importados },
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return {
        importados: resultado.importados,
        errores: resultado.errores,
        totalSolicitados: rows.length,
      };
    }
  );

  // GET /plans/training// GET /plans/training - Cualquier autenticado
  fastify.get('/plans/training', async (_request, _reply) => {
    return isPgBackend() ? PgPlans.getTrainingSchedulePg() : getTrainingSchedule(fastify.db);
  });

  // POST /plans/training - Solo administrador
  fastify.post(
    '/plans/training',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const parsed = trainSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const schedule = isPgBackend()
        ? await PgPlans.createTrainingSchedulePg(parsed.data)
        : createTrainingSchedule(fastify.db, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'crear',
        entidad: 'training_schedule',
        entidad_id: schedule.id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return schedule;
    }
  );

  // PUT /plans/training/:id - Solo administrador
  fastify.put(
    '/plans/training/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = trainSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const updated = isPgBackend()
        ? await PgPlans.updateTrainingSchedulePg(id, parsed.data)
        : updateTrainingSchedule(fastify.db, id, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'editar',
        entidad: 'training_schedule',
        entidad_id: id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return updated;
    }
  );

  // DELETE /plans/training/:id - Solo administrador
  fastify.delete(
    '/plans/training/:id',
    { preHandler: requireRole('administrador') },
    async (request, _reply) => {
      const { id } = request.params as { id: string };
      if (isPgBackend()) await PgPlans.deleteTrainingSchedulePg(id);
      else deleteTrainingSchedule(fastify.db, id);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'eliminar',
        entidad: 'training_schedule',
        entidad_id: id,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { ok: true };
    }
  );

  // ===== TRAININGS (EjecuciÃ³n de capacitaciones con evidencias) =====
  // GET /plans/trainings - Cualquier autenticado
  fastify.get('/plans/trainings', async (_request, _reply) => {
    return isPgBackend() ? PgPlans.getTrainingsPg() : getTrainings(fastify.db);
  });

  // GET /plans/trainings/:id - Cualquier autenticado
  fastify.get('/plans/trainings/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const training = isPgBackend()
      ? await PgPlans.getTrainingByIdPg(id)
      : getTrainingById(fastify.db, id);
    if (!training) return reply.code(404).send({ error: 'CapacitaciÃ³n no encontrada' });
    return training;
  });

  // POST /plans/trainings - Solo administrador
  fastify.post(
    '/plans/trainings',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const parsed = trainingSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const training = isPgBackend()
        ? await PgPlans.createTrainingPg(parsed.data)
        : createTraining(fastify.db, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'crear',
        entidad: 'trainings',
        entidad_id: training.id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return training;
    }
  );

  // PUT /plans/trainings/:id - Solo administrador
  fastify.put(
    '/plans/trainings/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = trainingSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const updated = isPgBackend()
        ? await PgPlans.updateTrainingPg(id, parsed.data)
        : updateTraining(fastify.db, id, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'editar',
        entidad: 'trainings',
        entidad_id: id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return updated;
    }
  );

  // DELETE /plans/trainings/:id - Solo administrador
  fastify.delete(
    '/plans/trainings/:id',
    { preHandler: requireRole('administrador') },
    async (request, _reply) => {
      const { id } = request.params as { id: string };
      if (isPgBackend()) await PgPlans.deleteTrainingPg(id);
      else deleteTraining(fastify.db, id);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'eliminar',
        entidad: 'trainings',
        entidad_id: id,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { ok: true };
    }
  );

  // ===== TRAINING ATTENDANCE (Asistencia con firma) =====
  // GET /plans/trainings/:id/attendance - Cualquier autenticado
  fastify.get('/plans/trainings/:id/attendance', async (request, _reply) => {
    const { id } = request.params as { id: string };
    return isPgBackend()
      ? PgPlans.getTrainingAttendancePg(id)
      : getTrainingAttendance(fastify.db, id);
  });

  // POST /plans/trainings/:id/attendance - Solo administrador
  fastify.post(
    '/plans/trainings/:id/attendance',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const parsed = trainingAttendanceSchema.safeParse({ ...body, training_id: id });
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const attendance = isPgBackend()
        ? await PgPlans.createTrainingAttendancePg(parsed.data)
        : createTrainingAttendance(fastify.db, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'crear',
        entidad: 'training_attendance',
        entidad_id: attendance.id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return attendance;
    }
  );

  // POST /plans/trainings/:id/attendance/bulk - Solo administrador
  fastify.post(
    '/plans/trainings/:id/attendance/bulk',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const parsed = bulkAttendanceSchema.safeParse({ ...body, training_id: id });
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const list = isPgBackend()
        ? await PgPlans.bulkCreateTrainingAttendancePg(id, parsed.data.worker_ids)
        : bulkCreateTrainingAttendance(fastify.db, id, parsed.data.worker_ids);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'crear',
        entidad: 'training_attendance',
        entidad_id: id,
        valores_nuevos: {
          worker_ids: parsed.data.worker_ids,
          count: parsed.data.worker_ids.length,
        },
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return list;
    }
  );

  // PUT /plans/trainings/attendance/:attId - Solo administrador
  fastify.put(
    '/plans/trainings/attendance/:attId',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { attId } = request.params as { attId: string };
      const parsed = trainingAttendanceSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const updated = isPgBackend()
        ? await PgPlans.updateTrainingAttendancePg(attId, parsed.data)
        : updateTrainingAttendance(fastify.db, attId, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'editar',
        entidad: 'training_attendance',
        entidad_id: attId,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return updated;
    }
  );

  // DELETE /plans/trainings/attendance/:attId - Solo administrador
  fastify.delete(
    '/plans/trainings/attendance/:attId',
    { preHandler: requireRole('administrador') },
    async (request, _reply) => {
      const { attId } = request.params as { attId: string };
      if (isPgBackend()) await PgPlans.deleteTrainingAttendancePg(attId);
      else deleteTrainingAttendance(fastify.db, attId);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'eliminar',
        entidad: 'training_attendance',
        entidad_id: attId,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { ok: true };
    }
  );
};

/**
 * Preview de importación masiva desde Excel (plan anual).
 * Lee el archivo, detecta encabezados, mapea columnas y devuelve filas válidas y con errores.
 */
async function previewarExcelImport(request: any): Promise<any> {
  const file = await request.file();
  if (!file) throw new Error('No se envió archivo');

  const chunks: Buffer[] = [];
  for await (const chunk of file.file) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks) as any;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const hoja = wb.worksheets.find((s: any) =>
    String(s.name ?? '').includes('Plan de trabajo Anual')
  );
  if (!hoja) throw new Error('No se encontró la hoja "Plan de trabajo Anual"');
  const ws = wb.getWorksheet(hoja.name);
  if (!ws) throw new Error('No se pudo leer la hoja');

  const filas: any[] = [];
  ws.eachRow((row: any) => {
    const celdas: any[] = [];
    row.eachCell({ includeEmpty: false }, (cell: any, colNumber: number) => {
      celdas.push({ c: colNumber, v: cell.value });
    });
    filas.push(celdas);
  });

  let encabezadoIdx = -1;
  const colMap: Record<string, number> = {};
  const MESES_POR_COLUMNA: Record<number, number> = {
    8: 6,
    9: 7,
    10: 8,
    11: 9,
    12: 10,
    13: 11,
    14: 12,
    15: 1,
    16: 2,
    17: 3,
    18: 4,
    19: 5,
  };

  for (let i = 0; i < filas.length; i++) {
    const celdas = filas[i];
    const tieneObjetivo = celdas.some(
      (cel: any) => typeof cel.v === 'string' && String(cel.v).trim().toLowerCase() === 'objetivo'
    );
    const tieneActividad = celdas.some(
      (cel: any) => typeof cel.v === 'string' && String(cel.v).trim().toLowerCase() === 'actividad'
    );
    if (tieneObjetivo && tieneActividad) {
      encabezadoIdx = i;
      for (const cel of celdas) {
        if (typeof cel.v === 'string') {
          const nom = String(cel.v).trim().toLowerCase();
          if (nom === 'objetivo') colMap.objetivo = cel.c;
          else if (nom === 'meta') colMap.meta = cel.c;
          else if (nom === 'actividad') colMap.actividad = cel.c;
          else if (nom === 'evidencia') colMap.evidencia = cel.c;
          else if (nom === 'responsable') colMap.responsable = cel.c;
          else if (nom === '*estado de la actividad' || nom === 'estado') colMap.estado = cel.c;
          else if (nom === 'programa' || cel.c === 1) colMap.programa = cel.c;
        }
      }
      break;
    }
  }

  if (encabezadoIdx < 0) {
    throw new Error(
      'No se encontró la fila de encabezados (se requieren columnas "Objetivo" y "Actividad")'
    );
  }

  const filasValidas: any[] = [];
  const filasConErrores: any[] = [];
  let anioDetectado: number | null = null;

  for (let i = encabezadoIdx + 1; i < filas.length; i++) {
    const celdas = filas[i];
    const get = (col: number) => {
      const cel = celdas.find((c: any) => c.c === col);
      return cel ? cel.v : null;
    };

    const programa =
      typeof get(colMap.programa ?? 1) === 'string'
        ? String(get(colMap.programa ?? 1)).trim()
        : null;
    const meta = typeof get(colMap.meta) === 'string' ? String(get(colMap.meta)).trim() : null;
    const actividad =
      typeof get(colMap.actividad) === 'string' ? String(get(colMap.actividad)).trim() : null;
    const evidencia =
      typeof get(colMap.evidencia) === 'string' ? String(get(colMap.evidencia)).trim() : null;
    const responsable =
      typeof get(colMap.responsable) === 'string' ? String(get(colMap.responsable)).trim() : null;
    const estadoRaw =
      typeof get(colMap.estado ?? 7) === 'string' ? String(get(colMap.estado ?? 7)).trim() : null;

    const errores: string[] = [];
    if (!actividad) errores.push('Falta actividad');

    const meses: number[] = [];
    let primeraFechaX: Date | null = null;
    for (const [colStr, mes] of Object.entries(MESES_POR_COLUMNA)) {
      const colNum = parseInt(colStr);
      const cel = get(colNum);
      if (cel && String(cel).trim().toUpperCase() === 'X') {
        meses.push(mes);
        if (!primeraFechaX) {
          const filaFechas = filas[4];
          if (filaFechas) {
            const celFecha = filaFechas.find((c: any) => c.c === colNum);
            if (celFecha && celFecha.v instanceof Date) {
              primeraFechaX = celFecha.v as Date;
            }
          }
        }
      }
    }
    meses.sort((a: number, b: number) => a - b);

    if (primeraFechaX) anioDetectado = primeraFechaX.getFullYear();
    const anio = anioDetectado ?? new Date().getFullYear();

    const estado = parseEstado(estadoRaw);

    const filaImport = {
      anio,
      programa,
      objetivo: actividad,
      meta,
      evidencia_esperada: evidencia,
      responsable,
      estado,
      meses,
      fecha_inicio: primeraFechaX ? primeraFechaX.toISOString().slice(0, 10) : null,
      fecha_fin: null,
      presupuesto: 0,
      fila: i + 1,
      errores,
    };

    if (errores.length > 0) {
      filasConErrores.push(filaImport);
    } else {
      filasValidas.push(filaImport);
    }
  }

  return {
    totalFilas: filas.length - encabezadoIdx - 1,
    validas: filasValidas.length,
    conErrores: filasConErrores.length,
    anioDetectado,
    filasValidas,
    filasConErrores,
  };
}

export default plansRoutes;
