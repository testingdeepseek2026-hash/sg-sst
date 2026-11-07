import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  archivarPolicy,
  createObjective,
  createPolicy,
  deleteObjective,
  deletePolicy,
  divulgarPolicy,
  firmarPolicy,
  getActivePolicy,
  getObjectives,
  getPolicies,
  getPolicyById,
  updateObjective,
  updatePolicy,
} from '../services/policies.js';
import * as UsersService from '../services/users.js';

const policyCreateSchema = z.object({
  titulo: z.string().min(2),
  contenido: z.string().min(10),
  estado: z.enum(['borrador', 'vigente', 'archivada']).default('borrador'),
});

const policyUpdateSchema = z.object({
  titulo: z.string().min(2).optional(),
  contenido: z.string().min(10).optional(),
});

const firmarSchema = z.object({
  firmado_por: z.string().min(2),
});

const objectiveSchema = z.object({
  policy_id: z.string(),
  descripcion: z.string().min(5),
  tipo: z.enum(['estructura', 'proceso', 'resultado']),
  meta: z.string().optional().nullable(),
  responsable: z.string().optional().nullable(),
  fecha_limite: z.string().optional().nullable(),
  estado: z.enum(['pendiente', 'cumplido', 'en_proceso', 'incumplido']).default('pendiente'),
});

const objectiveUpdateSchema = z.object({
  descripcion: z.string().min(5).optional(),
  tipo: z.enum(['estructura', 'proceso', 'resultado']).optional(),
  meta: z.string().optional().nullable(),
  responsable: z.string().optional().nullable(),
  fecha_limite: z.string().optional().nullable(),
  estado: z.enum(['pendiente', 'cumplido', 'en_proceso', 'incumplido']).optional(),
});

const policiesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /policies - lista todas con objetivos anidados
  fastify.get('/policies', async () => {
    const policies = getPolicies(fastify.db);
    const policiesWithObjectives = policies.map((p) => ({
      ...p,
      objectives: getObjectives(fastify.db, p.id),
    }));
    return policiesWithObjectives;
  });

  // GET /policies/active - política vigente con objetivos
  fastify.get('/policies/active', async (request, reply) => {
    const active = getActivePolicy(fastify.db);
    if (!active) return reply.code(404).send({ error: 'No hay política vigente' });
    return {
      ...active,
      objectives: getObjectives(fastify.db, active.id),
    };
  });

  // GET /policies/:id - detalle
  fastify.get('/policies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const policy = getPolicyById(fastify.db, id);
    if (!policy) return reply.code(404).send({ error: 'Política no encontrada' });
    return {
      ...policy,
      objectives: getObjectives(fastify.db, id),
    };
  });

  // POST /policies (admin) - crear borrador
  fastify.post('/policies', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });

    const parsed = policyCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const p = createPolicy(fastify.db, parsed.data);
      UsersService.auditLog(fastify.db, {
        usuario_id: uid,
        usuario_email: me.email,
        accion: 'crear',
        entidad: 'policies',
        entidad_id: p.id,
        valores_nuevos: parsed.data,
      });
      return p;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // PUT /policies/:id (admin) - editar (si vigente -> nueva versión)
  fastify.put('/policies/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });

    const { id } = request.params as { id: string };
    const parsed = policyUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const old = getPolicyById(fastify.db, id);
      if (!old) return reply.code(404).send({ error: 'Política no encontrada' });
      const updated = updatePolicy(fastify.db, id, parsed.data);
      UsersService.auditLog(fastify.db, {
        usuario_id: uid,
        usuario_email: me.email,
        accion: 'editar',
        entidad: 'policies',
        entidad_id: updated.id,
        valores_anteriores: old,
        valores_nuevos: updated,
      });
      return updated;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // POST /policies/:id/firmar (admin) - firmar y poner vigente
  fastify.post('/policies/:id/firmar', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });

    const { id } = request.params as { id: string };
    const parsed = firmarSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const old = getPolicyById(fastify.db, id);
      const updated = firmarPolicy(fastify.db, id, parsed.data.firmado_por);
      UsersService.auditLog(fastify.db, {
        usuario_id: uid,
        usuario_email: me.email,
        accion: 'firmar',
        entidad: 'policies',
        entidad_id: id,
        valores_anteriores: old,
        valores_nuevos: updated,
      });
      return updated;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // POST /policies/:id/divulgar (admin) - registrar fecha divulgación
  fastify.post('/policies/:id/divulgar', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });

    const { id } = request.params as { id: string };

    try {
      const old = getPolicyById(fastify.db, id);
      const updated = divulgarPolicy(fastify.db, id);
      UsersService.auditLog(fastify.db, {
        usuario_id: uid,
        usuario_email: me.email,
        accion: 'divulgar',
        entidad: 'policies',
        entidad_id: id,
        valores_anteriores: old,
        valores_nuevos: updated,
      });
      return updated;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // POST /policies/:id/archivar (admin) - archivar política
  fastify.post('/policies/:id/archivar', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });

    const { id } = request.params as { id: string };

    try {
      const old = getPolicyById(fastify.db, id);
      const updated = archivarPolicy(fastify.db, id);
      UsersService.auditLog(fastify.db, {
        usuario_id: uid,
        usuario_email: me.email,
        accion: 'archivar',
        entidad: 'policies',
        entidad_id: id,
        valores_anteriores: old,
        valores_nuevos: updated,
      });
      return updated;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // DELETE /policies/:id (admin) - solo si borrador
  fastify.delete('/policies/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });

    const { id } = request.params as { id: string };

    try {
      const old = getPolicyById(fastify.db, id);
      deletePolicy(fastify.db, id);
      UsersService.auditLog(fastify.db, {
        usuario_id: uid,
        usuario_email: me.email,
        accion: 'eliminar',
        entidad: 'policies',
        entidad_id: id,
        valores_anteriores: old,
      });
      return { ok: true };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // GET /policies/:id/objectives - objetivos de una política
  fastify.get('/policies/:id/objectives', async (request) => {
    const { id } = request.params as { id: string };
    return getObjectives(fastify.db, id);
  });

  // POST /policies/:id/objectives (admin) - crear objetivo
  fastify.post('/policies/:id/objectives', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });

    const { id } = request.params as { id: string };
    const parsed = objectiveSchema.omit({ policy_id: true }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const obj = createObjective(fastify.db, { ...parsed.data, policy_id: id });
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'crear',
      entidad: 'objectives',
      entidad_id: obj.id,
      valores_nuevos: { ...parsed.data, policy_id: id },
    });
    return obj;
  });

  // PUT /objectives/:id (admin) - editar objetivo
  fastify.put('/objectives/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });

    const { id } = request.params as { id: string };
    const parsed = objectiveUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const old = fastify.db.prepare('SELECT * FROM objectives WHERE id = ?').get(id);
    const updated = updateObjective(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'editar',
      entidad: 'objectives',
      entidad_id: id,
      valores_anteriores: old,
      valores_nuevos: updated,
    });
    return updated;
  });

  // DELETE /objectives/:id (admin) - eliminar objetivo
  fastify.delete('/objectives/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });

    const { id } = request.params as { id: string };
    deleteObjective(fastify.db, id);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'eliminar',
      entidad: 'objectives',
      entidad_id: id,
    });
    return { ok: true };
  });
};

export default policiesRoutes;
