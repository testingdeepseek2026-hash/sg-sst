import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { getRoles, getRoleById, createRole, updateRole, deleteRole, getRoleVencimientos } from '../services/roles.js';
import * as UsersService from '../services/users.js';

const roleSchema = z.object({
  nombre: z.string().min(2),
  descripcion: z.string().optional(),
  usuario_id: z.string().optional(),
  licencia_sst_numero: z.string().optional(),
  licencia_sst_vence: z.string().optional(),
  curso_50h: z.boolean().optional(),
  curso_50h_vence: z.string().optional(),
  notas: z.string().optional()
});

const rolesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/roles', async () => getRoles(fastify.db));
  fastify.get('/roles/vencimientos', async () => getRoleVencimientos(fastify.db));
  fastify.get('/roles/:id', async (request, reply) => {
    const r = getRoleById(fastify.db, (request.params as any).id);
    if (!r) return reply.code(404).send({ error: 'Rol no encontrado' });
    return r;
  });
  fastify.post('/roles', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = roleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const role = createRole(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid, usuario_email: me.email, accion: 'crear', entidad: 'roles', entidad_id: role.id,
      valores_nuevos: parsed.data
    });
    return role;
  });
  fastify.put('/roles/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const prev = getRoleById(fastify.db, id);
    if (!prev) return reply.code(404).send({ error: 'Rol no encontrado' });
    const parsed = roleSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateRole(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid, usuario_email: me.email, accion: 'editar', entidad: 'roles', entidad_id: id,
      valores_anteriores: prev, valores_nuevos: parsed.data
    });
    return updated;
  });
  fastify.delete('/roles/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    deleteRole(fastify.db, id);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'eliminar', entidad: 'roles', entidad_id: id });
    return { ok: true };
  });
};

export default rolesRoutes;
