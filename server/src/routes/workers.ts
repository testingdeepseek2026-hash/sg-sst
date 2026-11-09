import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import * as UsersService from '../services/users.js';
import {
  createWorker,
  deleteWorker,
  getWorkerById,
  getWorkers,
  updateWorker,
} from '../services/workers.js';
import { requireRole, getAuthUser, auditLog } from '../lib/auth.js';

const workerSchema = z.object({
  tipo_documento: z.string().default('CC'),
  numero_documento: z.string().min(3),
  nombres: z.string().min(2),
  apellidos: z.string().min(2),
  cargo: z.string().min(2),
  fecha_ingreso: z.string(),
  fecha_egreso: z.string().optional().nullable(),
  estado: z.enum(['activo', 'inactivo', 'retirado']).default('activo'),
  eps: z.string().optional(),
  afp: z.string().optional(),
  arl: z.string().optional(),
  caja_compensacion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional(),
});

const workersRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /workers - Cualquier autenticado
  fastify.get('/workers', async (request, reply) => {
    return getWorkers(fastify.db);
  });

  // GET /workers/:id - Cualquier autenticado
  fastify.get('/workers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const w = getWorkerById(fastify.db, id);
    if (!w) return reply.code(404).send({ error: 'Trabajador no encontrado' });
    return w;
  });

  // POST /workers - Solo administrador
  fastify.post('/workers', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const parsed = workerSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const w = createWorker(fastify.db, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'workers',
      entidad_id: w.id,
      valores_nuevos: parsed.data,
    });

    return w;
  });

  // PUT /workers/:id - Solo administrador
  fastify.put('/workers/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prev = getWorkerById(fastify.db, id);
    if (!prev) return reply.code(404).send({ error: 'Trabajador no encontrado' });
    const parsed = workerSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateWorker(fastify.db, id, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'editar',
      entidad: 'workers',
      entidad_id: id,
      valores_anteriores: prev,
      valores_nuevos: parsed.data,
    });

    return updated;
  });

  // DELETE /workers/:id - Solo administrador
  fastify.delete('/workers/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    deleteWorker(fastify.db, id);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'eliminar',
      entidad: 'workers',
      entidad_id: id,
    });

    return { ok: true };
  });
};

export default workersRoutes;