import { FastifyPluginAsync } from 'fastify';

import { auditLog, getAuthUser, requireRole } from '../lib/auth.js';
import { isPgBackend } from '../lib/db-pg.js';
import {
  buildAlertEmailHtml,
  buildAlertEmailText,
  createTransporter,
  sendAlertEmail,
} from '../lib/email.js';
import {
  deleteAlert,
  generateAlerts,
  getAlerts,
  getAlertStats,
  getPendingAlertsForSending,
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

  // POST /alerts/send (admin) - enviar alertas pendientes manualmente
  fastify.post(
    '/alerts/send',
    { preHandler: requireRole('administrador') },
    async (request, _reply) => {
      const user = getAuthUser(request);
      const transporter = createTransporter();
      const pending = isPgBackend()
        ? await PgAlerts.getPendingAlertsForSendingPg()
        : getPendingAlertsForSending(fastify.db);

      if (!pending.length) {
        return { enviadas: 0, mensaje: 'No hay alertas pendientes' };
      }

      // Agrupar por email
      const byEmail = new Map<string, typeof pending>();
      for (const a of pending) {
        let email = '';
        if (isPgBackend()) {
          email = (await PgAlerts.getWorkerEmailByAlertEntityPg(a.entidad, a.entidad_id)) ?? '';
        } else if (
          a.entidad === 'worker_exams' ||
          a.entidad === 'worker_certs' ||
          a.entidad === 'worker_epp'
        ) {
          const worker = fastify.db
            .prepare('SELECT email FROM workers WHERE id = (SELECT worker_id FROM ?? WHERE id = ?)')
            .get(a.entidad, a.entidad_id) as { email: string | null } | undefined;
          if (worker?.email) email = worker.email;
        } else if (a.entidad === 'roles') {
          const role = fastify.db
            .prepare(
              'SELECT u.email FROM roles r JOIN users u ON u.id = r.usuario_id WHERE r.id = ?'
            )
            .get(a.entidad_id) as { email: string | null } | undefined;
          if (role?.email) email = role.email;
        }

        if (!email) continue;
        if (!byEmail.has(email)) byEmail.set(email, []);
        byEmail.get(email)!.push(a);
      }

      let enviadas = 0;
      let errores = 0;

      for (const [email, alertas] of byEmail) {
        const html = buildAlertEmailHtml(alertas);
        const text = buildAlertEmailText(alertas);
        const result = await sendAlertEmail(
          transporter,
          email,
          `⚠️ SG-SST: ${alertas.length} alerta(s) de vencimiento`,
          html,
          text
        );
        if (result.success) {
          enviadas++;
          const ids = alertas.map((a) => a.id);
          if (isPgBackend()) await PgAlerts.markAsSentPg(ids);
          else markAsSent(fastify.db, ids);
        } else {
          errores++;
        }
      }

      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'enviar',
        entidad: 'alerts',
        valores_nuevos: { enviadas, errores },
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { enviadas, errores };
    }
  );

  // PUT /alerts/:id/sent (admin) - marcar como enviada
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
        accion: 'marcar_enviada',
        entidad: 'alerts',
        entidad_id: id,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { ok: true };
    }
  );

  // POST /alerts/mark-sent (admin) - marcar múltiples
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
        accion: 'marcar_enviada_multiple',
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

  // GET /alerts/test-email?to= - email de prueba (admin)
  fastify.get(
    '/alerts/test-email',
    { preHandler: requireRole('administrador') },
    async (request, _reply) => {
      const user = getAuthUser(request);
      const { to } = request.query as { to?: string };
      const email = to || user.email;

      const transporter = createTransporter();
      const html = buildAlertEmailHtml([
        {
          tipo: 'examen',
          entidad: 'worker_exams',
          fecha_vencimiento: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
          prioridad: 'alta',
          worker_nombre: 'Juan',
          worker_apellido: 'Pérez',
          detalle: 'Examen periódico vencimiento en 5 días',
        },
      ]);
      const text = buildAlertEmailText([
        {
          tipo: 'examen',
          entidad: 'worker_exams',
          fecha_vencimiento: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
          prioridad: 'alta',
          worker_nombre: 'Juan',
          worker_apellido: 'Pérez',
          detalle: 'Examen periódico vencimiento en 5 días',
        },
      ]);

      const result = await sendAlertEmail(
        transporter,
        email,
        '🧪 SG-SST: Email de prueba',
        html,
        text
      );
      return { success: result.success, error: result.error };
    }
  );

  // GET /alerts/preview - preview HTML (admin)
  fastify.get(
    '/alerts/preview',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const html = buildAlertEmailHtml([
        {
          tipo: 'examen',
          entidad: 'worker_exams',
          fecha_vencimiento: '2026-11-15',
          prioridad: 'critica',
          worker_nombre: 'Juan',
          worker_apellido: 'Pérez',
          detalle: 'Examen de ingreso vencido',
        },
        {
          tipo: 'certificado',
          entidad: 'worker_certs',
          fecha_vencimiento: '2026-11-20',
          prioridad: 'alta',
          worker_nombre: 'María',
          worker_apellido: 'Gómez',
          item_nombre: 'Alturas',
          detalle: 'Certificado alturas vence en 5 días (Res. 4272/2021)',
        },
        {
          tipo: 'licencia_sst',
          entidad: 'roles',
          fecha_vencimiento: '2026-12-01',
          prioridad: 'media',
          worker_nombre: 'Carlos',
          worker_apellido: 'Ruiz',
          detalle: 'Licencia SST vence en 15 días',
        },
        {
          tipo: 'inspeccion',
          entidad: 'inspections',
          fecha_vencimiento: '2026-11-18',
          prioridad: 'alta',
          item_nombre: 'Inspección andamios',
          detalle: 'Programada para obra Centro Comercial',
        },
      ]);

      reply.type('text/html');
      return html;
    }
  );
};

export default alertsRoutes;
