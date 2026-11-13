import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { auditLog, getAuthUser, requireRole } from '../lib/auth.js';
import { isPgBackend } from '../lib/db-pg.js';
import {
  createIncident,
  createIncidentAction,
  deleteIncident,
  deleteIncidentAction,
  getActionsByIncident,
  getIncidentById,
  getIncidents,
  updateIncident,
  updateIncidentAction,
} from '../services/incidents.js';
import * as PgIncidents from '../services/incidents.pg.js';
import { auditLogPg } from '../services/users.pg.js';

const actionSchema = z.object({
  descripcion: z.string().min(5),
  responsable: z.string().min(2),
  fecha_limite: z.string().optional().nullable(),
  estado: z.enum(['pendiente', 'en_proceso', 'completada', 'vencida']).default('pendiente'),
  evidencia_url: z.string().optional().nullable(),
  completada_en: z.string().optional().nullable(),
});

const incSchema = z.object({
  tipo: z.enum(['incidente', 'accidente', 'enfermedad_laboral']),
  fecha_ocurrencia: z.string(),
  fecha_reporte: z.string().optional().nullable(),
  trabajador_id: z.string().optional().nullable(),
  lugar: z.string().optional(),
  descripcion: z.string().min(2),
  lesiones: z.string().optional(),
  causa_raiz: z.string().optional(),
  acciones_correctivas: z.string().optional(),
  reporte_arl: z.boolean().default(false),
  reporte_eps: z.boolean().default(false),
  reporte_mintrabajo: z.boolean().default(false),
  dias_perdidos: z.number().int().nonnegative().default(0),
  estado: z.enum(['abierto', 'investigando', 'cerrado']).default('abierto'),
  investigador: z.string().optional(),
  fecha_cierre: z.string().optional().nullable(),
});

const incidentsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /incidents - Solo administrador (según matriz de permisos)
  fastify.get(
    '/incidents',
    { preHandler: requireRole('administrador') },
    async (_request, _reply) => {
      return isPgBackend() ? PgIncidents.getIncidentsPg() : getIncidents(fastify.db);
    }
  );

  // GET /incidents/:id - Solo administrador
  fastify.get(
    '/incidents/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const inc = isPgBackend()
        ? await PgIncidents.getIncidentByIdPg(id)
        : getIncidentById(fastify.db, id);
      if (!inc) return reply.code(404).send({ error: 'Incidente no encontrado' });
      return inc;
    }
  );

  // POST /incidents - Solo administrador
  fastify.post(
    '/incidents',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const parsed = incSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const inc = isPgBackend()
        ? await PgIncidents.createIncidentPg(parsed.data)
        : createIncident(fastify.db, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'crear',
        entidad: 'incidents',
        entidad_id: inc.id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return inc;
    }
  );

  // PUT /incidents/:id - Solo administrador
  fastify.put(
    '/incidents/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = incSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const updated = isPgBackend()
        ? await PgIncidents.updateIncidentPg(id, parsed.data)
        : updateIncident(fastify.db, id, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'editar',
        entidad: 'incidents',
        entidad_id: id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return updated;
    }
  );

  // DELETE /incidents/:id - Solo administrador
  fastify.delete(
    '/incidents/:id',
    { preHandler: requireRole('administrador') },
    async (request, _reply) => {
      const { id } = request.params as { id: string };
      if (isPgBackend()) await PgIncidents.deleteIncidentPg(id);
      else deleteIncident(fastify.db, id);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'eliminar',
        entidad: 'incidents',
        entidad_id: id,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { ok: true };
    }
  );

  // ===== ACCIONES CORRECTIVAS DEL INCIDENTE =====
  fastify.get(
    '/incidents/:id/actions',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const incident = isPgBackend()
        ? await PgIncidents.getIncidentByIdPg(id)
        : getIncidentById(fastify.db, id);
      if (!incident) return reply.code(404).send({ error: 'Incidente no encontrado' });
      return isPgBackend()
        ? PgIncidents.getActionsByIncidentPg(id)
        : getActionsByIncident(fastify.db, id);
    }
  );

  fastify.post(
    '/incidents/:id/actions',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const incident = isPgBackend()
        ? await PgIncidents.getIncidentByIdPg(id)
        : getIncidentById(fastify.db, id);
      if (!incident) return reply.code(404).send({ error: 'Incidente no encontrado' });
      const parsed = actionSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const action = isPgBackend()
        ? await PgIncidents.createIncidentActionPg(id, parsed.data)
        : createIncidentAction(fastify.db, id, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'crear',
        entidad: 'incident_actions',
        entidad_id: action.id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return action;
    }
  );

  fastify.put(
    '/incidents/:id/actions/:aid',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { aid } = request.params as { aid: string };
      const parsed = actionSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const updated = isPgBackend()
        ? await PgIncidents.updateIncidentActionPg(aid, parsed.data)
        : updateIncidentAction(fastify.db, aid, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'editar',
        entidad: 'incident_actions',
        entidad_id: aid,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return updated;
    }
  );

  fastify.delete(
    '/incidents/:id/actions/:aid',
    { preHandler: requireRole('administrador') },
    async (request, _reply) => {
      const { aid } = request.params as { aid: string };
      if (isPgBackend()) await PgIncidents.deleteIncidentActionPg(aid);
      else deleteIncidentAction(fastify.db, aid);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'eliminar',
        entidad: 'incident_actions',
        entidad_id: aid,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { ok: true };
    }
  );
};

export default incidentsRoutes;
