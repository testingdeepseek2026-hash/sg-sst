import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  createStandard,
  createStandardAssessment,
  deleteStandardAssessment,
  getStandardAssessments,
  getStandards,
  stdCumplimiento,
  updateStandardAssessment,
} from '../services/standards.js';
import { requireRole, getAuthUser, auditLog } from '../lib/auth.js';

const stdSchema = z.object({
  codigo: z.string().min(2),
  titulo: z.string().min(2),
  descripcion: z.string().min(2),
  set_aplicable: z.enum(['7', '21', '32']),
  capitulo: z.enum(['I', 'II', 'III']),
  modo_verificacion: z.string().optional(),
});
const assessSchema = z.object({
  standard_id: z.string(),
  cumple: z.boolean(),
  observaciones: z.string().optional(),
  plan_mejora: z.string().optional(),
  fecha: z.string().optional(),
  usuario_id: z.string().optional(),
});

const standardsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /standards - Cualquier autenticado
  fastify.get('/standards', async (request, reply) => {
    const { set } = request.query as { set?: string };
    return getStandards(fastify.db, set);
  });

  // POST /standards - Solo administrador
  fastify.post('/standards', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const parsed = stdSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const s = createStandard(fastify.db, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'standards',
      entidad_id: s.id,
      valores_nuevos: parsed.data,
    });

    return s;
  });

  // GET /standards/assessments - Cualquier autenticado
  fastify.get('/standards/assessments', async (request, reply) => {
    return getStandardAssessments(fastify.db);
  });

  // GET /standards/cumplimiento - Cualquier autenticado
  fastify.get('/standards/cumplimiento', async (request, reply) => {
    return stdCumplimiento(fastify.db);
  });

  // POST /standards/assessments - Solo administrador
  fastify.post('/standards/assessments', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const parsed = assessSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const user = getAuthUser(request);
    const a = createStandardAssessment(fastify.db, { ...parsed.data, usuario_id: user.id });

    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'standard_assessments',
      entidad_id: a.id,
      valores_nuevos: parsed.data,
    });

    return a;
  });

  // PUT /standards/assessments/:id - Solo administrador
  fastify.put('/standards/assessments/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = assessSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateStandardAssessment(fastify.db, id, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'editar',
      entidad: 'standard_assessments',
      entidad_id: id,
      valores_nuevos: parsed.data,
    });

    return updated;
  });

  // DELETE /standards/assessments/:id - Solo administrador
  fastify.delete('/standards/assessments/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    deleteStandardAssessment(fastify.db, id);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'eliminar',
      entidad: 'standard_assessments',
      entidad_id: id,
    });

    return { ok: true };
  });
};

export default standardsRoutes;