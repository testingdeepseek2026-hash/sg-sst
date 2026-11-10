import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

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
  updateInspection,
} from '../services/inspections.js';
import { requireRole, getAuthUser, auditLog } from '../lib/auth.js';

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

const inspectionsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/inspections', async (request, reply) => {
    return getInspections(fastify.db);
  });

  fastify.get('/inspections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const insp = getInspectionById(fastify.db, id);
    if (!insp) return reply.code(404).send({ error: 'Inspección no encontrada' });
    return insp;
  });

  fastify.post('/inspections', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const parsed = inspSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const insp = createInspection(fastify.db, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'inspections',
      entidad_id: insp.id,
      valores_nuevos: parsed.data,
    });

    return insp;
  });

  fastify.put('/inspections/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = inspSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateInspection(fastify.db, id, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'editar',
      entidad: 'inspections',
      entidad_id: id,
      valores_nuevos: parsed.data,
    });

    return updated;
  });

  fastify.delete('/inspections/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    deleteInspection(fastify.db, id);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'eliminar',
      entidad: 'inspections',
      entidad_id: id,
    });

    return { ok: true };
  });

  // ===== ALTURA PERMITS =====
  fastify.get('/altura/permits', async (request, reply) => {
    return getAlturaPermits(fastify.db);
  });

  fastify.post('/altura/permits', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const parsed = inspSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const permit = createAlturaPermit(fastify.db, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'altura_permits',
      entidad_id: permit.id,
      valores_nuevos: parsed.data,
    });

    return permit;
  });

  fastify.put('/altura/permits/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = inspSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateAlturaPermit(fastify.db, id, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'editar',
      entidad: 'altura_permits',
      entidad_id: id,
      valores_nuevos: parsed.data,
    });

    return updated;
  });

  fastify.delete('/altura/permits/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    deleteAlturaPermit(fastify.db, id);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'eliminar',
      entidad: 'altura_permits',
      entidad_id: id,
    });

    return { ok: true };
  });

  // ===== ATS =====
  fastify.get('/altura/ats', async (request, reply) => {
    return getATS(fastify.db);
  });

  fastify.post('/altura/ats', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const parsed = inspSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const ats = createATS(fastify.db, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'ats',
      entidad_id: ats.id,
      valores_nuevos: parsed.data,
    });

    return ats;
  });

  fastify.delete('/altura/ats/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    deleteATS(fastify.db, id);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'eliminar',
      entidad: 'ats',
      entidad_id: id,
    });

    return { ok: true };
  });
};

export default inspectionsRoutes;