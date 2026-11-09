import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

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
import * as UsersService from '../services/users.js';

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
  fastify.get('/incidents', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me) return reply.code(401).send({ error: 'No autenticado' });
    return getIncidents(fastify.db);
  });
  fastify.get('/incidents/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me) return reply.code(401).send({ error: 'No autenticado' });
    const inc = getIncidentById(fastify.db, (request.params as any).id);
    if (!inc) return reply.code(404).send({ error: 'Incidente no encontrado' });
    return inc;
  });
  fastify.post('/incidents', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = incSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const inc = createIncident(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'crear',
      entidad: 'incidents',
      entidad_id: inc.id,
      valores_nuevos: parsed.data,
    });
    return inc;
  });
  fastify.put('/incidents/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const parsed = incSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateIncident(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'editar',
      entidad: 'incidents',
      entidad_id: id,
      valores_nuevos: parsed.data,
    });
    return updated;
  });
  fastify.delete('/incidents/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    deleteIncident(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'eliminar',
      entidad: 'incidents',
      entidad_id: (request.params as any).id,
    });
    return { ok: true };
  });

  // ===== ACCIONES CORRECTIVAS DEL INCIDENTE =====
  fastify.get('/incidents/:id/actions', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me) return reply.code(401).send({ error: 'No autenticado' });
    const { id } = request.params as { id: string };
    if (!getIncidentById(fastify.db, id))
      return reply.code(404).send({ error: 'Incidente no encontrado' });
    return getActionsByIncident(fastify.db, id);
  });

  fastify.post('/incidents/:id/actions', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    if (!getIncidentById(fastify.db, id))
      return reply.code(404).send({ error: 'Incidente no encontrado' });
    const parsed = actionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const action = createIncidentAction(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'crear',
      entidad: 'incident_actions',
      entidad_id: action.id,
      valores_nuevos: parsed.data,
    });
    return action;
  });

  fastify.put('/incidents/:id/actions/:aid', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { aid } = request.params as { aid: string };
    const parsed = actionSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateIncidentAction(fastify.db, aid, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'editar',
      entidad: 'incident_actions',
      entidad_id: aid,
      valores_nuevos: parsed.data,
    });
    return updated;
  });

  fastify.delete('/incidents/:id/actions/:aid', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { aid } = request.params as { aid: string };
    deleteIncidentAction(fastify.db, aid);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'eliminar',
      entidad: 'incident_actions',
      entidad_id: aid,
    });
    return { ok: true };
  });
};

export default incidentsRoutes;
