import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  bulkCreateTrainingAttendance,
  createAnnualPlan,
  createTraining,
  createTrainingAttendance,
  createTrainingSchedule,
  deleteAnnualPlan,
  deleteTraining,
  deleteTrainingAttendance,
  deleteTrainingSchedule,
  getAnnualPlan,
  getTrainingAttendance,
  getTrainingById,
  getTrainings,
  getTrainingSchedule,
  updateAnnualPlan,
  updateTraining,
  updateTrainingAttendance,
  updateTrainingSchedule,
} from '../services/plans.js';
import { requireRole, getAuthUser, auditLog } from '../lib/auth.js';

const planSchema = z.object({
  anio: z.number().int(),
  objetivo: z.string().min(2),
  meta: z.string().optional(),
  responsable: z.string().optional(),
  fecha_inicio: z.string(),
  fecha_fin: z.string().optional().nullable(),
  presupuesto: z.number().optional().default(0),
  estado: z.enum(['pendiente', 'en_proceso', 'cumplido', 'incumplido']).default('pendiente'),
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
  fastify.get('/plans/annual', async (request, reply) => {
    const { anio } = request.query as { anio?: string };
    return getAnnualPlan(fastify.db, anio ? Number(anio) : undefined);
  });

  // POST /plans/annual - Solo administrador
  fastify.post('/plans/annual', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const parsed = planSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const p = createAnnualPlan(fastify.db, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'annual_plan',
      entidad_id: p.id,
      valores_nuevos: parsed.data,
    });

    return p;
  });

  // PUT /plans/annual/:id - Solo administrador
  fastify.put('/plans/annual/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = planSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateAnnualPlan(fastify.db, id, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'editar',
      entidad: 'annual_plan',
      entidad_id: id,
      valores_nuevos: parsed.data,
    });

    return updated;
  });

  // DELETE /plans/annual/:id - Solo administrador
  fastify.delete('/plans/annual/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    deleteAnnualPlan(fastify.db, id);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'eliminar',
      entidad: 'annual_plan',
      entidad_id: id,
    });

    return { ok: true };
  });

  // GET /plans/training - Cualquier autenticado
  fastify.get('/plans/training', async (request, reply) => {
    return getTrainingSchedule(fastify.db);
  });

  // POST /plans/training - Solo administrador
  fastify.post('/plans/training', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const parsed = trainSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const t = createTrainingSchedule(fastify.db, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'training_schedule',
      entidad_id: t.id,
      valores_nuevos: parsed.data,
    });

    return t;
  });

  // PUT /plans/training/:id - Solo administrador
  fastify.put('/plans/training/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = trainSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateTrainingSchedule(fastify.db, id, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'editar',
      entidad: 'training_schedule',
      entidad_id: id,
      valores_nuevos: parsed.data,
    });

    return updated;
  });

  // DELETE /plans/training/:id - Solo administrador
  fastify.delete('/plans/training/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    deleteTrainingSchedule(fastify.db, id);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'eliminar',
      entidad: 'training_schedule',
      entidad_id: id,
    });

    return { ok: true };
  });

  // ===== TRAININGS (Ejecución de capacitaciones con evidencias) =====
  // GET /plans/trainings - Cualquier autenticado
  fastify.get('/plans/trainings', async (request, reply) => {
    return getTrainings(fastify.db);
  });

  // GET /plans/trainings/:id - Cualquier autenticado
  fastify.get('/plans/trainings/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const t = getTrainingById(fastify.db, id);
    if (!t) return reply.code(404).send({ error: 'Capacitación no encontrada' });
    return t;
  });

  // POST /plans/trainings - Solo administrador
  fastify.post('/plans/trainings', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const parsed = trainingSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const t = createTraining(fastify.db, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'trainings',
      entidad_id: t.id,
      valores_nuevos: parsed.data,
    });

    return t;
  });

  // PUT /plans/trainings/:id - Solo administrador
  fastify.put('/plans/trainings/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = trainingSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateTraining(fastify.db, id, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'editar',
      entidad: 'trainings',
      entidad_id: id,
      valores_nuevos: parsed.data,
    });

    return updated;
  });

  // DELETE /plans/trainings/:id - Solo administrador
  fastify.delete('/plans/trainings/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    deleteTraining(fastify.db, id);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'eliminar',
      entidad: 'trainings',
      entidad_id: id,
    });

    return { ok: true };
  });

  // ===== TRAINING ATTENDANCE (Asistencia con firma) =====
  // GET /plans/trainings/:id/attendance - Cualquier autenticado
  fastify.get('/plans/trainings/:id/attendance', async (request, reply) => {
    const { id } = request.params as { id: string };
    return getTrainingAttendance(fastify.db, id);
  });

  // POST /plans/trainings/:id/attendance - Solo administrador
  fastify.post('/plans/trainings/:id/attendance', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, any>;
    const parsed = trainingAttendanceSchema.safeParse({ ...body, training_id: id });
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const a = createTrainingAttendance(fastify.db, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'training_attendance',
      entidad_id: a.id,
      valores_nuevos: parsed.data,
    });

    return a;
  });

  // POST /plans/trainings/:id/attendance/bulk - Solo administrador
  fastify.post('/plans/trainings/:id/attendance/bulk', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, any>;
    const parsed = bulkAttendanceSchema.safeParse({ ...body, training_id: id });
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const list = bulkCreateTrainingAttendance(fastify.db, id, parsed.data.worker_ids);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'training_attendance',
      entidad_id: id,
      valores_nuevos: { worker_ids: parsed.data.worker_ids, count: parsed.data.worker_ids.length },
    });

    return list;
  });

  // PUT /plans/trainings/attendance/:attId - Solo administrador
  fastify.put('/plans/trainings/attendance/:attId', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { attId } = request.params as { attId: string };
    const parsed = trainingAttendanceSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateTrainingAttendance(fastify.db, attId, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'editar',
      entidad: 'training_attendance',
      entidad_id: attId,
      valores_nuevos: parsed.data,
    });

    return updated;
  });

  // DELETE /plans/trainings/attendance/:attId - Solo administrador
  fastify.delete('/plans/trainings/attendance/:attId', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { attId } = request.params as { attId: string };
    deleteTrainingAttendance(fastify.db, attId);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'eliminar',
      entidad: 'training_attendance',
      entidad_id: attId,
    });

    return { ok: true };
  });
};

export default plansRoutes;