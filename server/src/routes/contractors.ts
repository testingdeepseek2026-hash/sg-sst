import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  createContractor,
  deleteContractor,
  getContractorById,
  getContractors,
  updateContractor,
} from '../services/contractors.js';
import * as UsersService from '../services/users.js';

const contractorSchema = z.object({
  nombre: z.string().min(2),
  nit: z.string().optional().nullable(),
  servicio: z.string().min(2),
  arl: z.string().optional().nullable(),
  examen_medico: z.number().int().min(0).max(1).default(0),
  capacitacion_sst: z.number().int().min(0).max(1).default(0),
  epp: z.number().int().min(0).max(1).default(0),
  estado: z.enum(['pendiente', 'aprobado', 'rechazado']).default('pendiente'),
  fecha_evaluacion: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
});

const contractorsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/contractors', async () => getContractors(fastify.db));
  fastify.get('/contractors/:id', async (request, reply) => {
    const c = getContractorById(fastify.db, (request.params as any).id);
    if (!c) return reply.code(404).send({ error: 'Contratista no encontrado' });
    return c;
  });
  fastify.post('/contractors', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = contractorSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const c = createContractor(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'crear',
      entidad: 'contractors',
      entidad_id: c.id,
      valores_nuevos: parsed.data,
    });
    return c;
  });
  fastify.put('/contractors/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const parsed = contractorSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateContractor(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'editar',
      entidad: 'contractors',
      entidad_id: id,
      valores_nuevos: parsed.data,
    });
    return updated;
  });
  fastify.delete('/contractors/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    deleteContractor(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'eliminar',
      entidad: 'contractors',
      entidad_id: (request.params as any).id,
    });
    return { ok: true };
  });
};

export default contractorsRoutes;