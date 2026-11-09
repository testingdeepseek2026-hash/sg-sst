import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  createRole,
  deleteRole,
  getRoleById,
  getRoles,
  getRoleVencimientos,
  updateRole,
} from '../services/roles.js';
import { requireRole, getAuthUser, auditLog } from '../lib/auth.js';

const roleSchema = z.object({
  nombre: z.string().min(2),
  descripcion: z.string().optional(),
  usuario_id: z.string().optional(),
  licencia_sst_numero: z.string().optional(),
  licencia_sst_vence: z.string().optional(),
  curso_50h: z.boolean().optional(),
  curso_50h_vence: z.string().optional(),
  notas: z.string().optional(),
});

const rolesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /roles - Cualquier autenticado
  fastify.get('/roles', async (request, reply) => {
    return getRoles(fastify.db);
  });

  // GET /roles/vencimientos - Cualquier autenticado
  fastify.get('/roles/vencimientos', async (request, reply) => {
    return getRoleVencimientos(fastify.db);
  });

  // GET /roles/:id - Cualquier autenticado
  fastify.get('/roles/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const r = getRoleById(fastify.db, id);
    if (!r) return reply.code(404).send({ error: 'Rol no encontrado' });
    return r;
  });

  // POST /roles - Solo administrador
  fastify.post('/roles', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const parsed = roleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const role = createRole(fastify.db, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'roles',
      entidad_id: role.id,
      valores_nuevos: parsed.data,
    });

    return role;
  });

  // PUT /roles/:id - Solo administrador
  fastify.put('/roles/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prev = getRoleById(fastify.db, id);
    if (!prev) return reply.code(404).send({ error: 'Rol no encontrado' });
    const parsed = roleSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateRole(fastify.db, id, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'editar',
      entidad: 'roles',
      entidad_id: id,
      valores_anteriores: prev,
      valores_nuevos: parsed.data,
    });

    return updated;
  });

  // DELETE /roles/:id - Solo administrador
  fastify.delete('/roles/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    deleteRole(fastify.db, id);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'eliminar',
      entidad: 'roles',
      entidad_id: id,
    });

    return { ok: true };
  });
};

export default rolesRoutes;