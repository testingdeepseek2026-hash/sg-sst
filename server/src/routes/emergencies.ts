import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { auditLog, getAuthUser, requireRole } from '../lib/auth.js';
import { isPgBackend } from '../lib/db-pg.js';
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
import * as PgEmergencies from '../services/emergencies.pg.js';
import { auditLogPg } from '../services/users.pg.js';

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
  fastify.get('/emergency-plans', async (_request, _reply) => {
    return isPgBackend() ? PgEmergencies.getEmergencyPlansPg() : getEmergencyPlans(fastify.db);
  });

  fastify.get('/emergency-plans/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const plan = isPgBackend()
      ? await PgEmergencies.getEmergencyPlanByIdPg(id)
      : getEmergencyPlanById(fastify.db, id);
    if (!plan) return reply.code(404).send({ error: 'Plan de emergencias no encontrado' });
    return plan;
  });

  fastify.post(
    '/emergency-plans',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const parsed = emergencyPlanSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const p = isPgBackend()
        ? await PgEmergencies.createEmergencyPlanPg(parsed.data)
        : createEmergencyPlan(fastify.db, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'crear',
        entidad: 'emergency_plans',
        entidad_id: p.id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return p;
    }
  );

  fastify.put(
    '/emergency-plans/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = emergencyPlanSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const updated = isPgBackend()
        ? await PgEmergencies.updateEmergencyPlanPg(id, parsed.data)
        : updateEmergencyPlan(fastify.db, id, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'editar',
        entidad: 'emergency_plans',
        entidad_id: id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return updated;
    }
  );

  fastify.delete(
    '/emergency-plans/:id',
    { preHandler: requireRole('administrador') },
    async (request, _reply) => {
      const { id } = request.params as { id: string };
      if (isPgBackend()) await PgEmergencies.deleteEmergencyPlanPg(id);
      else deleteEmergencyPlan(fastify.db, id);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'eliminar',
        entidad: 'emergency_plans',
        entidad_id: id,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { ok: true };
    }
  );

  // ===== DRILLS (Simulacros) =====
  fastify.get('/drills', async (_request, _reply) => {
    return isPgBackend() ? PgEmergencies.getDrillsPg() : getDrills(fastify.db);
  });

  fastify.get('/drills/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const d = isPgBackend() ? await PgEmergencies.getDrillByIdPg(id) : getDrillById(fastify.db, id);
    if (!d) return reply.code(404).send({ error: 'Simulacro no encontrado' });
    return d;
  });

  fastify.get('/emergency-plans/:id/drills', async (request, _reply) => {
    const { id } = request.params as { id: string };
    return isPgBackend() ? PgEmergencies.getDrillsByPlanPg(id) : getDrillsByPlan(fastify.db, id);
  });

  fastify.post('/drills', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const parsed = drillSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = isPgBackend()
      ? await PgEmergencies.createDrillPg(parsed.data)
      : createDrill(fastify.db, parsed.data);

    const user = getAuthUser(request);
    const entry = {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'drills',
      entidad_id: d.id,
      valores_nuevos: parsed.data,
    };
    if (isPgBackend()) await auditLogPg(entry);
    else auditLog(fastify.db, entry);

    return d;
  });

  fastify.put(
    '/drills/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = drillSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const updated = isPgBackend()
        ? await PgEmergencies.updateDrillPg(id, parsed.data)
        : updateDrill(fastify.db, id, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'editar',
        entidad: 'drills',
        entidad_id: id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return updated;
    }
  );

  fastify.delete(
    '/drills/:id',
    { preHandler: requireRole('administrador') },
    async (request, _reply) => {
      const { id } = request.params as { id: string };
      if (isPgBackend()) await PgEmergencies.deleteDrillPg(id);
      else deleteDrill(fastify.db, id);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'eliminar',
        entidad: 'drills',
        entidad_id: id,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { ok: true };
    }
  );
};

export default emergenciesRoutes;
