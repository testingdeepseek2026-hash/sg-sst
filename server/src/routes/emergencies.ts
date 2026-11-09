import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  createDrill,
  createEmergencyPlan,
  deleteDrill,
  deleteEmergencyPlan,
  getDrillById,
  getDrills,
  getDrillsByPlan,
  getEmergencyPlanById,
  getEmergencyPlans,
  updateDrill,
  updateEmergencyPlan,
} from '../services/emergencies.js';
import { requireRole, getAuthUser, auditLog } from '../lib/auth.js';

const emergencyPlanSchema = z.object({
  nombre: z.string().min(2),
  tipo_emergencia: z.enum(['incendio', 'sismo', 'evacuacion', 'electrico', 'otro']),
  contenido: z.string().optional().nullable(),
  vigente: z.number().int().min(0).max(1).default(1),
});

const drillSchema = z.object({
  emergency_plan_id: z.string().optional().nullable(),
  fecha: z.string(),
  tipo: z.string(),
  participantes: z.number().int().optional().nullable(),
  observaciones: z.string().optional().nullable(),
  estado: z.enum(['programado', 'realizado', 'cancelado']).default('realizado'),
});

const emergenciesRoutes: FastifyPluginAsync = async (fastify) => {
  // ===== EMERGENCY PLANS =====
  fastify.get('/emergency-plans', async (request, reply) => {
    return getEmergencyPlans(fastify.db);
  });

  fastify.get('/emergency-plans/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const plan = getEmergencyPlanById(fastify.db, id);
    if (!plan) return reply.code(404).send({ error: 'Plan de emergencias no encontrado' });
    return plan;
  });

  fastify.post('/emergency-plans', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const parsed = emergencyPlanSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const p = createEmergencyPlan(fastify.db, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'emergency_plans',
      entidad_id: p.id,
      valores_nuevos: parsed.data,
    });

    return p;
  });

  fastify.put('/emergency-plans/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = emergencyPlanSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateEmergencyPlan(fastify.db, id, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'editar',
      entidad: 'emergency_plans',
      entidad_id: id,
      valores_nuevos: parsed.data,
    });

    return updated;
  });

  fastify.delete('/emergency-plans/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    deleteEmergencyPlan(fastify.db, id);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'eliminar',
      entidad: 'emergency_plans',
      entidad_id: id,
    });

    return { ok: true };
  });

  // ===== DRILLS (Simulacros) =====
  fastify.get('/drills', async (request, reply) => {
    return getDrills(fastify.db);
  });

  fastify.get('/drills/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const d = getDrillById(fastify.db, id);
    if (!d) return reply.code(404).send({ error: 'Simulacro no encontrado' });
    return d;
  });

  fastify.get('/emergency-plans/:id/drills', async (request, reply) => {
    const { id } = request.params as { id: string };
    return getDrillsByPlan(fastify.db, id);
  });

  fastify.post('/drills', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const parsed = drillSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = createDrill(fastify.db, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'drills',
      entidad_id: d.id,
      valores_nuevos: parsed.data,
    });

    return d;
  });

  fastify.put('/drills/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = drillSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateDrill(fastify.db, id, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'editar',
      entidad: 'drills',
      entidad_id: id,
      valores_nuevos: parsed.data,
    });

    return updated;
  });

  fastify.delete('/drills/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    deleteDrill(fastify.db, id);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'eliminar',
      entidad: 'drills',
      entidad_id: id,
    });

    return { ok: true };
  });
};

export default emergenciesRoutes;