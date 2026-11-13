import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { auditLog, getAuthUser, requireRole } from '../lib/auth.js';
import { isPgBackend } from '../lib/db-pg.js';
import {
  createAlturaPermit,
  createATS,
  createInspection,
  deleteAlturaPermit,
  deleteATS,
  deleteInspection,
  getAlturaPermits,
  getATS,
  getInspectionById,
  getInspections,
  updateAlturaPermit,
  updateATS,
  updateInspection,
} from '../services/inspections.js';
import * as PgInspections from '../services/inspections.pg.js';
import { auditLogPg } from '../services/users.pg.js';

const inspSchema = z.object({
  tipo: z.enum([
    'herramientas',
    'epp',
    'escaleras',
    'arneses',
    'vehiculo',
    'botiquin',
    'extintores',
    'puesto_trabajo',
    'obra',
  ]),
  fecha: z.string(),
  lugar: z.string().optional(),
  responsable: z.string().optional(),
  estado: z.enum(['pendiente', 'aprobada', 'observaciones', 'rechazada']).default('pendiente'),
  resultado_json: z.string().optional(),
  observaciones: z.string().optional(),
  firmado_por: z.string().optional(),
  firma_url: z.string().optional(),
  archivo_fotos: z.string().optional(),
});

const permitSchema = z.object({
  obra: z.string().min(2),
  fecha: z.string(),
  hora_inicio: z.string().optional().nullable(),
  hora_fin: z.string().optional().nullable(),
  solicitante: z.string().optional().nullable(),
  responsable_seguridad: z.string().optional().nullable(),
  sistema_proteccion: z.string().optional().nullable(),
  equipo_verificado: z.number().int().min(0).max(1).default(0),
  apto_medico: z.number().int().min(0).max(1).default(0),
  certificado_alturas: z.number().int().min(0).max(1).default(0),
  estado: z.enum(['pendiente', 'autorizado', 'rechazado', 'cerrado']).default('pendiente'),
  at_s_id: z.string().optional().nullable(),
  archivo_fotos: z.string().optional().nullable(),
  firma_solicitante_url: z.string().optional().nullable(),
  firma_responsable_url: z.string().optional().nullable(),
});

const atsSchema = z.object({
  obra: z.string().min(2),
  tarea: z.string().min(2),
  peligro: z.string().optional().nullable(),
  control: z.string().optional().nullable(),
  responsable: z.string().optional().nullable(),
  fecha: z.string().optional(),
  estado: z.enum(['vigente', 'cerrado']).default('vigente'),
});

const inspectionsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/inspections', async (_request, _reply) => {
    return isPgBackend() ? PgInspections.getInspectionsPg() : getInspections(fastify.db);
  });

  fastify.get('/inspections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const insp = isPgBackend()
      ? await PgInspections.getInspectionByIdPg(id)
      : getInspectionById(fastify.db, id);
    if (!insp) return reply.code(404).send({ error: 'Inspección no encontrada' });
    return insp;
  });

  fastify.post(
    '/inspections',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const parsed = inspSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const insp = isPgBackend()
        ? await PgInspections.createInspectionPg(parsed.data)
        : createInspection(fastify.db, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'crear',
        entidad: 'inspections',
        entidad_id: insp.id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return insp;
    }
  );

  fastify.put(
    '/inspections/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = inspSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const updated = isPgBackend()
        ? await PgInspections.updateInspectionPg(id, parsed.data)
        : updateInspection(fastify.db, id, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'editar',
        entidad: 'inspections',
        entidad_id: id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return updated;
    }
  );

  fastify.delete(
    '/inspections/:id',
    { preHandler: requireRole('administrador') },
    async (request, _reply) => {
      const { id } = request.params as { id: string };
      if (isPgBackend()) await PgInspections.deleteInspectionPg(id);
      else deleteInspection(fastify.db, id);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'eliminar',
        entidad: 'inspections',
        entidad_id: id,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { ok: true };
    }
  );

  // ===== ALTURA PERMITS =====
  fastify.get('/altura/permits', async (_request, _reply) => {
    return isPgBackend() ? PgInspections.getAlturaPermitsPg() : getAlturaPermits(fastify.db);
  });

  fastify.post(
    '/altura/permits',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const parsed = permitSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const permit = isPgBackend()
        ? await PgInspections.createAlturaPermitPg(parsed.data)
        : createAlturaPermit(fastify.db, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'crear',
        entidad: 'altura_permits',
        entidad_id: permit.id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return permit;
    }
  );

  fastify.put(
    '/altura/permits/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = permitSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const updated = isPgBackend()
        ? await PgInspections.updateAlturaPermitPg(id, parsed.data)
        : updateAlturaPermit(fastify.db, id, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'editar',
        entidad: 'altura_permits',
        entidad_id: id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return updated;
    }
  );

  fastify.delete(
    '/altura/permits/:id',
    { preHandler: requireRole('administrador') },
    async (request, _reply) => {
      const { id } = request.params as { id: string };
      if (isPgBackend()) await PgInspections.deleteAlturaPermitPg(id);
      else deleteAlturaPermit(fastify.db, id);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'eliminar',
        entidad: 'altura_permits',
        entidad_id: id,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { ok: true };
    }
  );

  // ===== ATS =====
  fastify.get('/altura/ats', async (_request, _reply) => {
    return isPgBackend() ? PgInspections.getATSPg() : getATS(fastify.db);
  });

  fastify.post(
    '/altura/ats',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const parsed = atsSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const ats = isPgBackend()
        ? await PgInspections.createATSPg(parsed.data)
        : createATS(fastify.db, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'crear',
        entidad: 'ats',
        entidad_id: ats.id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return ats;
    }
  );

  fastify.put(
    '/altura/ats/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = atsSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const updated = isPgBackend()
        ? await PgInspections.updateATSPg(id, parsed.data)
        : updateATS(fastify.db, id, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'editar',
        entidad: 'ats',
        entidad_id: id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return updated;
    }
  );

  fastify.delete(
    '/altura/ats/:id',
    { preHandler: requireRole('administrador') },
    async (request, _reply) => {
      const { id } = request.params as { id: string };
      if (isPgBackend()) await PgInspections.deleteATSPg(id);
      else deleteATS(fastify.db, id);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'eliminar',
        entidad: 'ats',
        entidad_id: id,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { ok: true };
    }
  );
};

export default inspectionsRoutes;
