import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { getIndicators, createIndicator, updateIndicator, deleteIndicator } from '../services/indicators.js';
import * as UsersService from '../services/users.js';

const indSchema = z.object({
  nombre: z.string().min(2), tipo: z.enum(['estructura','proceso','resultado']), valor: z.number(),
  meta: z.number().optional().nullable(), periodo: z.string(), fecha_calculo: z.string().optional(),
  notas: z.string().optional()
});

const indicatorsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/indicators', async (request) => {
    const { periodo } = request.query as { periodo?: string };
    return getIndicators(fastify.db, periodo);
  });
  fastify.post('/indicators', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = indSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const ind = createIndicator(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'crear', entidad: 'indicators', entidad_id: ind.id, valores_nuevos: parsed.data });
    return ind;
  });
  fastify.put('/indicators/:id', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const parsed = indSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateIndicator(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'editar', entidad: 'indicators', entidad_id: id, valores_nuevos: parsed.data });
    return updated;
  });
  fastify.delete('/indicators/:id', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    deleteIndicator(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'eliminar', entidad: 'indicators', entidad_id: (request.params as any).id });
    return { ok: true };
  });
};

export default indicatorsRoutes;
