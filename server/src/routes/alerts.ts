import { FastifyPluginAsync } from 'fastify';

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
import * as UsersService from '../services/users.js';

const alertsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /alerts - listar con filtros
  fastify.get('/alerts', async (request) => {
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

    return getAlerts(fastify.db, {
      tipo,
      enviado: enviado !== undefined ? parseInt(enviado, 10) : undefined,
      fecha_desde,
      fecha_hasta,
      prioridad,
      limit: parseInt(limit, 10),
    });
  });

  // GET /alerts/stats - estadísticas
  fastify.get('/alerts/stats', async () => {
    return getAlertStats(fastify.db);
  });

  // POST /alerts/generate (admin) - generar alertas manualmente
  fastify.post('/alerts/generate', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });

    const nuevas = generateAlerts(fastify.db);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'generar',
      entidad: 'alerts',
      valores_nuevos: { generadas: nuevas.length },
    });
    return { generadas: nuevas.length, alertas: nuevas };
  });

  // POST /alerts/send (admin) - enviar alertas pendientes manualmente
  fastify.post('/alerts/send', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });

    const transporter = createTransporter();
    const pending = getPendingAlertsForSending(fastify.db);

    if (!pending.length) {
      return { enviadas: 0, mensaje: 'No hay alertas pendientes' };
    }

    // Agrupar por email
    const byEmail = new Map<string, typeof pending>();
    for (const a of pending) {
      let email = '';
      if (
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
          .prepare('SELECT u.email FROM roles r JOIN users u ON u.id = r.usuario_id WHERE r.id = ?')
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
        markAsSent(
          fastify.db,
          alertas.map((a) => a.id)
        );
      } else {
        errores++;
      }
    }

    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'enviar',
      entidad: 'alerts',
      valores_nuevos: { enviadas, errores },
    });
    return { enviadas, errores };
  });

  // PUT /alerts/:id/sent (admin) - marcar como enviada
  fastify.put('/alerts/:id/sent', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });

    const { id } = request.params as { id: string };
    const updated = markAsSent(fastify.db, [id]);
    if (!updated) return reply.code(404).send({ error: 'Alerta no encontrada' });

    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'marcar_enviada',
      entidad: 'alerts',
      entidad_id: id,
    });
    return { ok: true };
  });

  // POST /alerts/mark-sent (admin) - marcar múltiples
  fastify.post('/alerts/mark-sent', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });

    const { ids } = request.body as { ids: string[] };
    if (!ids || !ids.length) return reply.code(400).send({ error: 'ids requeridos' });

    const updated = markAsSent(fastify.db, ids);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'marcar_enviada_multiple',
      entidad: 'alerts',
      valores_nuevos: { ids },
    });
    return { actualizadas: updated };
  });

  // DELETE /alerts/:id (admin)
  fastify.delete('/alerts/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });

    deleteAlert(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'eliminar',
      entidad: 'alerts',
      entidad_id: (request.params as any).id,
    });
    return { ok: true };
  });

  // GET /alerts/test-email?to= - email de prueba
  fastify.get('/alerts/test-email', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });

    const { to } = request.query as { to?: string };
    const email = to || me.email;

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
  });

  // GET /alerts/preview - preview HTML
  fastify.get('/alerts/preview', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });

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
  });
};

export default alertsRoutes;
