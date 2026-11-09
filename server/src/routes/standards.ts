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
import * as UsersService from '../services/users.js';

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
  fastify.get('/standards', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me) return reply.code(401).send({ error: 'No autenticado' });
    const { set } = request.query as { set?: string };
    return getStandards(fastify.db, set);
  });
  fastify.post('/standards', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = stdSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const s = createStandard(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'crear',
      entidad: 'standards',
      entidad_id: s.id,
      valores_nuevos: parsed.data,
    });
    return s;
  });
  fastify.get('/standards/assessments', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me) return reply.code(401).send({ error: 'No autenticado' });
    return getStandardAssessments(fastify.db);
  });
  fastify.get('/standards/cumplimiento', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me) return reply.code(401).send({ error: 'No autenticado' });
    return stdCumplimiento(fastify.db);
  });
  fastify.post('/standards/assessments', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = assessSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const a = createStandardAssessment(fastify.db, { ...parsed.data, usuario_id: uid });
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'crear',
      entidad: 'standard_assessments',
      entidad_id: a.id,
      valores_nuevos: parsed.data,
    });
    return a;
  });
  fastify.put('/standards/assessments/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const parsed = assessSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateStandardAssessment(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'editar',
      entidad: 'standard_assessments',
      entidad_id: id,
      valores_nuevos: parsed.data,
    });
    return updated;
  });
  fastify.delete('/standards/assessments/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    deleteStandardAssessment(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'eliminar',
      entidad: 'standard_assessments',
      entidad_id: (request.params as any).id,
    });
    return { ok: true };
  });
};

export default standardsRoutes;
