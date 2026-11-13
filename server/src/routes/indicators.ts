import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { auditLog, getAuthUser, requireRole } from '../lib/auth.js';
import { isPgBackend } from '../lib/db-pg.js';
import {
  createIndicator,
  deleteIndicator,
  getIndicators,
  updateIndicator,
} from '../services/indicators.js';
import * as PgIndicators from '../services/indicators.pg.js';
import { auditLogPg } from '../services/users.pg.js';

const indSchema = z.object({
  codigo: z.string().optional(),
  nombre: z.string().min(2),
  tipo: z.enum(['estructura', 'proceso', 'resultado']),
  valor: z.number(),
  meta: z.number().optional().nullable(),
  periodo: z.string(),
  fecha_calculo: z.string().optional(),
  notas: z.string().optional(),
  formula: z.string().optional(),
  frecuencia: z.enum(['mensual', 'trimestral', 'semestral', 'anual']).optional(),
});

const indicatorsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /indicators - Cualquier autenticado
  fastify.get('/indicators', async (request, _reply) => {
    const { periodo } = request.query as { periodo?: string };
    return isPgBackend()
      ? PgIndicators.getIndicatorsPg(periodo)
      : getIndicators(fastify.db, periodo);
  });

  // POST /indicators - Solo administrador
  fastify.post(
    '/indicators',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const parsed = indSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const ind = isPgBackend()
        ? await PgIndicators.createIndicatorPg(parsed.data)
        : createIndicator(fastify.db, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'crear',
        entidad: 'indicators',
        entidad_id: ind.id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return ind;
    }
  );

  // PUT /indicators/:id - Solo administrador
  fastify.put(
    '/indicators/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = indSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const updated = isPgBackend()
        ? await PgIndicators.updateIndicatorPg(id, parsed.data)
        : updateIndicator(fastify.db, id, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'editar',
        entidad: 'indicators',
        entidad_id: id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return updated;
    }
  );

  // DELETE /indicators/:id - Solo administrador
  fastify.delete(
    '/indicators/:id',
    { preHandler: requireRole('administrador') },
    async (request, _reply) => {
      const { id } = request.params as { id: string };
      if (isPgBackend()) await PgIndicators.deleteIndicatorPg(id);
      else deleteIndicator(fastify.db, id);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'eliminar',
        entidad: 'indicators',
        entidad_id: id,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { ok: true };
    }
  );
};

export default indicatorsRoutes;
