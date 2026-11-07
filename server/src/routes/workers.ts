import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import * as UsersService from '../services/users.js';
import { getWorkers, getWorkerById, createWorker, updateWorker, deleteWorker } from '../services/workers.js';

const workerSchema = z.object({
  tipo_documento: z.string().default('CC'),
  numero_documento: z.string().min(3),
  nombres: z.string().min(2),
  apellidos: z.string().min(2),
  cargo: z.string().min(2),
  fecha_ingreso: z.string(),
  fecha_egreso: z.string().optional().nullable(),
  estado: z.enum(['activo', 'inactivo', 'retirado']).default('activo'),
  eps: z.string().optional(), afp: z.string().optional(), arl: z.string().optional(),
  caja_compensacion: z.string().optional(), telefono: z.string().optional(), email: z.string().email().optional()
});

const workersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/workers', async () => getWorkers(fastify.db));
  fastify.get('/workers/:id', async (request, reply) => {
    const w = getWorkerById(fastify.db, (request.params as any).id);
    if (!w) return reply.code(404).send({ error: 'Trabajador no encontrado' });
    return w;
  });
  fastify.post('/workers', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = workerSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const w = createWorker(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'crear', entidad: 'workers', entidad_id: w.id, valores_nuevos: parsed.data });
    return w;
  });
  fastify.put('/workers/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const prev = getWorkerById(fastify.db, id);
    if (!prev) return reply.code(404).send({ error: 'Trabajador no encontrado' });
    const parsed = workerSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateWorker(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'editar', entidad: 'workers', entidad_id: id, valores_anteriores: prev, valores_nuevos: parsed.data });
    return updated;
  });
  fastify.delete('/workers/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    deleteWorker(fastify.db, id);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'eliminar', entidad: 'workers', entidad_id: id });
    return { ok: true };
  });
};

export default workersRoutes;
