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
  getTrainings,
  getTrainingAttendance,
  getTrainingById,
  getTrainingSchedule,
  updateAnnualPlan,
  updateTraining,
  updateTrainingAttendance,
  updateTrainingSchedule,
} from '../services/plans.js';
import * as UsersService from '../services/users.js';

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
  fastify.get('/plans/annual', async (request) => {
    const { anio } = request.query as { anio?: string };
    return getAnnualPlan(fastify.db, anio ? Number(anio) : undefined);
  });
  fastify.post('/plans/annual', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = planSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const p = createAnnualPlan(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'crear',
      entidad: 'annual_plan',
      entidad_id: p.id,
      valores_nuevos: parsed.data,
    });
    return p;
  });
  fastify.put('/plans/annual/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const parsed = planSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateAnnualPlan(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'editar',
      entidad: 'annual_plan',
      entidad_id: id,
      valores_nuevos: parsed.data,
    });
    return updated;
  });
  fastify.delete('/plans/annual/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    deleteAnnualPlan(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'eliminar',
      entidad: 'annual_plan',
      entidad_id: (request.params as any).id,
    });
    return { ok: true };
  });
  fastify.get('/plans/training', async () => getTrainingSchedule(fastify.db));
  fastify.post('/plans/training', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = trainSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const t = createTrainingSchedule(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'crear',
      entidad: 'training_schedule',
      entidad_id: t.id,
      valores_nuevos: parsed.data,
    });
    return t;
  });
  fastify.put('/plans/training/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const parsed = trainSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateTrainingSchedule(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'editar',
      entidad: 'training_schedule',
      entidad_id: id,
      valores_nuevos: parsed.data,
    });
    return updated;
  });
  fastify.delete('/plans/training/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    deleteTrainingSchedule(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'eliminar',
      entidad: 'training_schedule',
      entidad_id: (request.params as any).id,
    });
    return { ok: true };
  });

  // ===== TRAININGS (Ejecución de capacitaciones con evidencias) =====
  fastify.get('/plans/trainings', async () => getTrainings(fastify.db));
  fastify.get('/plans/trainings/:id', async (request, reply) => {
    const t = getTrainingById(fastify.db, (request.params as any).id);
    if (!t) return reply.code(404).send({ error: 'Capacitación no encontrada' });
    return t;
  });
  fastify.post('/plans/trainings', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = trainingSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const t = createTraining(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'crear',
      entidad: 'trainings',
      entidad_id: t.id,
      valores_nuevos: parsed.data,
    });
    return t;
  });
  fastify.put('/plans/trainings/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const parsed = trainingSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateTraining(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'editar',
      entidad: 'trainings',
      entidad_id: id,
      valores_nuevos: parsed.data,
    });
    return updated;
  });
  fastify.delete('/plans/trainings/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    deleteTraining(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'eliminar',
      entidad: 'trainings',
      entidad_id: (request.params as any).id,
    });
    return { ok: true };
  });

  // ===== TRAINING ATTENDANCE (Asistencia con firma) =====
  fastify.get('/plans/trainings/:id/attendance', async (request, reply) => {
    const { id } = request.params as { id: string };
    return getTrainingAttendance(fastify.db, id);
  });
  fastify.post('/plans/trainings/:id/attendance', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, any>;
    const parsed = trainingAttendanceSchema.safeParse({ ...body, training_id: id });
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const a = createTrainingAttendance(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'crear',
      entidad: 'training_attendance',
      entidad_id: a.id,
      valores_nuevos: parsed.data,
    });
    return a;
  });
  fastify.post('/plans/trainings/:id/attendance/bulk', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, any>;
    const parsed = bulkAttendanceSchema.safeParse({ ...body, training_id: id });
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const list = bulkCreateTrainingAttendance(fastify.db, id, parsed.data.worker_ids);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'crear',
      entidad: 'training_attendance',
      entidad_id: id,
      valores_nuevos: { worker_ids: parsed.data.worker_ids, count: parsed.data.worker_ids.length },
    });
    return list;
  });
  fastify.put('/plans/trainings/attendance/:attId', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { attId } = request.params as { attId: string };
    const parsed = trainingAttendanceSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateTrainingAttendance(fastify.db, attId, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'editar',
      entidad: 'training_attendance',
      entidad_id: attId,
      valores_nuevos: parsed.data,
    });
    return updated;
  });
  fastify.delete('/plans/trainings/attendance/:attId', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    deleteTrainingAttendance(fastify.db, (request.params as any).attId);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'eliminar',
      entidad: 'training_attendance',
      entidad_id: (request.params as any).attId,
    });
    return { ok: true };
  });
};

export default plansRoutes;
