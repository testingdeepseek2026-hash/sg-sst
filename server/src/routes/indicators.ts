import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  createIndicator,
  deleteIndicator,
  getIndicators,
  updateIndicator,
} from '../services/indicators.js';
import { requireRole, getAuthUser, auditLog } from '../lib/auth.js';

const indSchema = z.object({
  nombre: z.string().min(2),
  tipo: z.enum(['estructura', 'proceso', 'resultado']),
  valor: z.number(),
  meta: z.number().optional().nullable(),
  periodo: z.string(),
  fecha_calculo: z.string().optional(),
  notas: z.string().optional(),
});

const indicatorsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /indicators - Cualquier autenticado
  fastify.get('/indicators', async (request, reply) => {
    const { periodo } = request.query as { periodo?: string };
    return getIndicators(fastify.db, periodo);
  });

  // POST /indicators - Solo administrador
  fastify.post('/indicators', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const parsed = indSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const ind = createIndicator(fastify.db, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'indicators',
      entidad_id: ind.id,
      valores_nuevos: parsed.data,
    });

    return ind;
  });

  // PUT /indicators/:id - Solo administrador
  fastify.put('/indicators/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = indSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateIndicator(fastify.db, id, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'editar',
      entidad: 'indicators',
      entidad_id: id,
      valores_nuevos: parsed.data,
    });

    return updated;
  });

  // DELETE /indicators/:id - Solo administrador
  fastify.delete('/indicators/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    deleteIndicator(fastify.db, id);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'eliminar',
      entidad: 'indicators',
      entidad_id: id,
    });

    return { ok: true };
  });
};

export default indicatorsRoutes;