import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { auditLog, getAuthUser, requireRole } from '../lib/auth.js';
import { isPgBackend } from '../lib/db-pg.js';
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
import * as PgPlans from '../services/plans.pg.js';
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

  // GET /plans/training - Cualquier autenticado
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

  // ===== TRAININGS (Ejecución de capacitaciones con evidencias) =====
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
    if (!training) return reply.code(404).send({ error: 'Capacitación no encontrada' });
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

export default plansRoutes;
