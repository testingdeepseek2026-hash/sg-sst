import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { auditLog, getAuthUser, requireRole } from '../lib/auth.js';
import { isPgBackend } from '../lib/db-pg.js';
import {
  createContractor,
  deleteContractor,
  getContractorById,
  getContractors,
  updateContractor,
} from '../services/contractors.js';
import * as PgContractors from '../services/contractors.pg.js';
import { auditLogPg } from '../services/users.pg.js';

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
  // GET /contractors - Solo administrador
  fastify.get(
    '/contractors',
    { preHandler: requireRole('administrador') },
    async (_request, _reply) => {
      return isPgBackend() ? PgContractors.getContractorsPg() : getContractors(fastify.db);
    }
  );

  // GET /contractors/:id - Solo administrador
  fastify.get(
    '/contractors/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const c = isPgBackend()
        ? await PgContractors.getContractorByIdPg(id)
        : getContractorById(fastify.db, id);
      if (!c) return reply.code(404).send({ error: 'Contratista no encontrado' });
      return c;
    }
  );

  // POST /contractors - Solo administrador
  fastify.post(
    '/contractors',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const parsed = contractorSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const c = isPgBackend()
        ? await PgContractors.createContractorPg(parsed.data)
        : createContractor(fastify.db, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'crear',
        entidad: 'contractors',
        entidad_id: c.id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return c;
    }
  );

  // PUT /contractors/:id - Solo administrador
  fastify.put(
    '/contractors/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = contractorSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const updated = isPgBackend()
        ? await PgContractors.updateContractorPg(id, parsed.data)
        : updateContractor(fastify.db, id, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'editar',
        entidad: 'contractors',
        entidad_id: id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return updated;
    }
  );

  // DELETE /contractors/:id - Solo administrador
  fastify.delete(
    '/contractors/:id',
    { preHandler: requireRole('administrador') },
    async (request, _reply) => {
      const { id } = request.params as { id: string };
      if (isPgBackend()) await PgContractors.deleteContractorPg(id);
      else deleteContractor(fastify.db, id);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'eliminar',
        entidad: 'contractors',
        entidad_id: id,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { ok: true };
    }
  );
};

export default contractorsRoutes;
