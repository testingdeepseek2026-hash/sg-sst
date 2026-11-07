import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getAnnualPlan, createAnnualPlan, updateAnnualPlan, deleteAnnualPlan, getTrainingSchedule, createTrainingSchedule, updateTrainingSchedule, deleteTrainingSchedule } from '../services/plans.js';
import * as UsersService from '../services/users.js';

const planSchema = z.object({
  anio: z.number().int(), objetivo: z.string().min(2), meta: z.string().optional(),
  responsable: z.string().optional(), fecha_inicio: z.string(), fecha_fin: z.string().optional().nullable(),
  presupuesto: z.number().optional().default(0), estado: z.enum(['pendiente','en_proceso','cumplido','incumplido']).default('pendiente')
});
const trainSchema = z.object({
  nombre: z.string().min(2), tipo: z.string(), fecha: z.string(), duracion_horas: z.number().optional(),
  responsable: z.string().optional(), objetivo: z.string().optional(), estado: z.enum(['programada','realizada','cancelada']).default('programada')
});

const plansRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/plans/annual', async (request) => {
    const { anio } = request.query as { anio?: string };
    return getAnnualPlan(fastify.db, anio ? Number(anio) : undefined);
  });
  fastify.post('/plans/annual', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = planSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const p = createAnnualPlan(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'crear', entidad: 'annual_plan', entidad_id: p.id, valores_nuevos: parsed.data });
    return p;
  });
  fastify.put('/plans/annual/:id', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const parsed = planSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateAnnualPlan(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'editar', entidad: 'annual_plan', entidad_id: id, valores_nuevos: parsed.data });
    return updated;
  });
  fastify.delete('/plans/annual/:id', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    deleteAnnualPlan(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'eliminar', entidad: 'annual_plan', entidad_id: (request.params as any).id });
    return { ok: true };
  });
  fastify.get('/plans/training', async () => getTrainingSchedule(fastify.db));
  fastify.post('/plans/training', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = trainSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const t = createTrainingSchedule(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'crear', entidad: 'training_schedule', entidad_id: t.id, valores_nuevos: parsed.data });
    return t;
  });
  fastify.put('/plans/training/:id', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const parsed = trainSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateTrainingSchedule(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'editar', entidad: 'training_schedule', entidad_id: id, valores_nuevos: parsed.data });
    return updated;
  });
  fastify.delete('/plans/training/:id', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    deleteTrainingSchedule(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'eliminar', entidad: 'training_schedule', entidad_id: (request.params as any).id });
    return { ok: true };
  });
};

export default plansRoutes;
