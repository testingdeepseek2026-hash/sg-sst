import { FastifyPluginAsync } from 'fastify';

import { auditLog, getAuthUser, requireRole } from '../lib/auth.js';
import { isPgBackend } from '../lib/db-pg.js';
import {
  deleteAlert,
  generateAlerts,
  getAlerts,
  getAlertStats,
  markAsSent,
} from '../services/alerts.js';
import * as PgAlerts from '../services/alerts.pg.js';
import { auditLogPg } from '../services/users.pg.js';

const alertsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /alerts - listar con filtros (admin: todas; trabajador: solo suyas)
  fastify.get('/alerts', async (request, reply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'No autenticado' });

    const {
      tipo,
      enviado,
      fecha_desde,
      fecha_hasta,
      prioridad,
      limit = '100',
    } = request.query as {
      tipo?: string;
      enviado?: string;
      fecha_desde?: string;
      fecha_hasta?: string;
      prioridad?: string;
      limit?: string;
    };

    // Trabajador solo ve sus alertas
    const workerId = user.rol === 'trabajador' ? user.id : undefined;

    const filtros = {
      tipo,
      enviado: enviado !== undefined ? parseInt(enviado, 10) : undefined,
      fecha_desde,
      fecha_hasta,
      prioridad,
      limit: parseInt(limit, 10),
      workerId,
    };
    return isPgBackend() ? PgAlerts.getAlertsPg(filtros) : getAlerts(fastify.db, filtros);
  });

  // GET /alerts/stats - estadísticas (admin: global; trabajador: propias)
  fastify.get('/alerts/stats', async (request, reply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'No autenticado' });

    const workerId = user.rol === 'trabajador' ? user.id : undefined;
    return isPgBackend() ? PgAlerts.getAlertStatsPg(workerId) : getAlertStats(fastify.db, workerId);
  });

  // POST /alerts/generate (admin) - generar alertas manualmente
  fastify.post(
    '/alerts/generate',
    { preHandler: requireRole('administrador') },
    async (request, _reply) => {
      const user = getAuthUser(request);
      const nuevas = isPgBackend() ? await PgAlerts.generateAlertsPg() : generateAlerts(fastify.db);

      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'generar',
        entidad: 'alerts',
        valores_nuevos: { generadas: nuevas.length },
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { generadas: nuevas.length, alertas: nuevas };
    }
  );

  // PUT /alerts/:id/sent (admin) - marcar como atendida
  fastify.put(
    '/alerts/:id/sent',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { id } = request.params as { id: string };
      const updated = isPgBackend()
        ? await PgAlerts.markAsSentPg([id])
        : markAsSent(fastify.db, [id]);
      if (!updated) return reply.code(404).send({ error: 'Alerta no encontrada' });

      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'marcar_atendida',
        entidad: 'alerts',
        entidad_id: id,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { ok: true };
    }
  );

  // POST /alerts/mark-sent (admin) - marcar varias como atendidas
  fastify.post(
    '/alerts/mark-sent',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { ids } = request.body as { ids: string[] };
      if (!ids || !ids.length) return reply.code(400).send({ error: 'ids requeridos' });

      const updated = isPgBackend()
        ? await PgAlerts.markAsSentPg(ids)
        : markAsSent(fastify.db, ids);

      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'marcar_atendida_multiple',
        entidad: 'alerts',
        valores_nuevos: { ids },
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { actualizadas: updated };
    }
  );

  // DELETE /alerts/:id (admin)
  fastify.delete(
    '/alerts/:id',
    { preHandler: requireRole('administrador') },
    async (request, _reply) => {
      const user = getAuthUser(request);
      const { id } = request.params as { id: string };
      if (isPgBackend()) await PgAlerts.deleteAlertPg(id);
      else deleteAlert(fastify.db, id);

      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'eliminar',
        entidad: 'alerts',
        entidad_id: id,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { ok: true };
    }
  );
};

export default alertsRoutes;
