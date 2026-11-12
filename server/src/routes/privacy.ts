import { FastifyPluginAsync, type FastifyInstance } from 'fastify';
import { z } from 'zod';

import { auditLog, getAuthUser, requireRole } from '../lib/auth.js';
import { isPgBackend } from '../lib/db-pg.js';
import {
  checkConsentForMedicalData,
  createArcoRequest,
  createConsent,
  createDataProcessingRecord,
  createPrivacyNotice,
  deleteDataProcessingRecord,
  getActivePrivacyNotice,
  getAllConsents,
  getArcoRequestById,
  getArcoRequests,
  getArcoStats,
  getConsentById,
  getConsentsByWorker,
  getDataProcessingRecordById,
  getDataProcessingRecords,
  getPrivacyComplianceReport,
  getPrivacyNoticeById,
  getPrivacyNotices,
  hasValidConsent,
  updateArcoRequest,
  updateDataProcessingRecord,
  updatePrivacyNotice,
  withdrawConsent,
} from '../services/privacy.js';
import {
  createConsentPg,
  getAllConsentsPg,
  getConsentByIdPg,
  getConsentsByWorkerPg,
  hasValidConsentPg,
  withdrawConsentPg,
} from '../services/privacy_consents.pg.js';
import { auditLogPg } from '../services/users.pg.js';

async function recordPrivacyAudit(
  fastify: FastifyInstance,
  entry: Parameters<typeof auditLog>[1]
): Promise<void> {
  if (isPgBackend()) await auditLogPg(entry);
  else auditLog(fastify.db, entry);
}

const noticeSchema = z.object({
  titulo: z.string().min(5),
  contenido: z.string().min(50),
  fecha_vigencia: z.string(),
  estado: z.enum(['borrador', 'vigente', 'archivado']).default('borrador'),
});

const consentSchema = z.object({
  worker_id: z.string(),
  tipo: z.enum(['medico', 'biometrico', 'general', 'marketing', 'transferencia']),
  finalidad: z.string().min(10),
  autorizado: z.number().int().min(0).max(1),
  medio: z.enum(['escrito', 'digital', 'verbal']),
  version_aviso: z.string(),
  ip: z.string().optional(),
  user_agent: z.string().optional(),
});

const arcoSchema = z.object({
  worker_id: z.string(),
  tipo: z.enum(['acceso', 'rectificacion', 'cancelacion', 'oposicion']),
  descripcion: z.string().min(20),
  responsable: z.string().min(2),
});

const arcoUpdateSchema = z.object({
  estado: z.enum(['pendiente', 'en_proceso', 'resuelto', 'rechazado']).optional(),
  respuesta: z.string().optional(),
  evidencia_respuesta: z.string().optional(),
});

const processingRecordSchema = z.object({
  entidad: z.string().min(2),
  finalidad: z.string().min(10),
  categorias_datos: z.array(z.string()).min(1),
  base_legal: z.enum([
    'consentimiento',
    'contrato',
    'obligacion_legal',
    'interes_vital',
    'interes_publico',
    'interes_legitimo',
  ]),
  destinatarios: z.array(z.string()).optional(),
  transferencias_internacionales: z.boolean().optional(),
  pais_destino: z.string().optional(),
  medidas_seguridad: z.array(z.string()).min(1),
  retencion_dias: z.number().int().positive(),
});

const privacyRoutes: FastifyPluginAsync = async (fastify) => {
  // ===== AVISOS DE PRIVACIDAD =====
  fastify.get('/privacy/notices', async (request, reply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'No autenticado' });
    // Admin ve todos; trabajador ve solo vigente
    if (user.rol !== 'administrador') {
      const active = getActivePrivacyNotice(fastify.db);
      return active ? [active] : [];
    }
    return getPrivacyNotices(fastify.db);
  });

  fastify.get('/privacy/notices/active', async (request, reply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'No autenticado' });
    const active = getActivePrivacyNotice(fastify.db);
    if (!active) return reply.code(404).send({ error: 'No hay aviso de privacidad vigente' });
    return active;
  });

  fastify.get(
    '/privacy/notices/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const notice = getPrivacyNoticeById(fastify.db, id);
      if (!notice) return reply.code(404).send({ error: 'Aviso no encontrado' });
      return notice;
    }
  );

  fastify.post(
    '/privacy/notices',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const parsed = noticeSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const notice = createPrivacyNotice(fastify.db, parsed.data);

      const user = getAuthUser(request);
      auditLog(fastify.db, {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'crear',
        entidad: 'privacy_notices',
        entidad_id: notice.id,
        valores_nuevos: parsed.data,
      });

      return notice;
    }
  );

  fastify.put(
    '/privacy/notices/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = noticeSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const updated = updatePrivacyNotice(fastify.db, id, parsed.data);
      if (!updated) return reply.code(404).send({ error: 'Aviso no encontrado' });

      const user = getAuthUser(request);
      auditLog(fastify.db, {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'editar',
        entidad: 'privacy_notices',
        entidad_id: id,
        valores_nuevos: parsed.data,
      });

      return updated;
    }
  );

  // ===== CONSENTIMIENTOS =====
  fastify.get('/privacy/consents', async (request, reply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'No autenticado' });
    // Admin ve todos; trabajador ve solo los suyos
    const workerId = user.rol === 'administrador' ? undefined : user.id;
    if (!workerId) {
      return isPgBackend() ? getAllConsentsPg() : getAllConsents(fastify.db);
    }
    return isPgBackend()
      ? getConsentsByWorkerPg(workerId)
      : getConsentsByWorker(fastify.db, workerId);
  });

  fastify.get('/privacy/consents/:id', async (request, reply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'No autenticado' });
    const { id } = request.params as { id: string };
    const consent = isPgBackend() ? await getConsentByIdPg(id) : getConsentById(fastify.db, id);
    if (!consent) return reply.code(404).send({ error: 'Consentimiento no encontrado' });
    // Trabajador solo ve los suyos
    if (user.rol !== 'administrador' && consent.worker_id !== user.id) {
      return reply.code(403).send({ error: 'No autorizado' });
    }
    return consent;
  });

  fastify.post('/privacy/consents', async (request, reply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'No autenticado' });

    const parsed = consentSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    // Trabajador solo puede crear consentimiento para sí mismo
    if (user.rol !== 'administrador' && parsed.data.worker_id !== user.id) {
      return reply.code(403).send({ error: 'Solo puede registrar su propio consentimiento' });
    }

    const consent = isPgBackend()
      ? await createConsentPg(parsed.data)
      : createConsent(fastify.db, parsed.data);

    await recordPrivacyAudit(fastify, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'consents',
      entidad_id: consent.id,
      valores_nuevos: parsed.data,
    });

    return consent;
  });

  fastify.post('/privacy/consents/:id/withdraw', async (request, reply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'No autenticado' });
    const { id } = request.params as { id: string };
    const consent = isPgBackend() ? await getConsentByIdPg(id) : getConsentById(fastify.db, id);
    if (!consent) return reply.code(404).send({ error: 'Consentimiento no encontrado' });
    // Trabajador solo puede retirar el suyo
    if (user.rol !== 'administrador' && consent.worker_id !== user.id) {
      return reply.code(403).send({ error: 'Solo puede retirar su propio consentimiento' });
    }

    const updated = isPgBackend() ? await withdrawConsentPg(id) : withdrawConsent(fastify.db, id);

    await recordPrivacyAudit(fastify, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'retirar_consentimiento',
      entidad: 'consents',
      entidad_id: id,
    });

    return updated;
  });

  fastify.get('/privacy/consents/check/:workerId/:tipo', async (request, reply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'No autenticado' });
    const { workerId, tipo } = request.params as { workerId: string; tipo: string };
    // Admin puede consultar cualquiera; trabajador solo el suyo
    if (user.rol !== 'administrador' && workerId !== user.id) {
      return reply.code(403).send({ error: 'No autorizado' });
    }
    const valid = isPgBackend()
      ? await hasValidConsentPg(
          workerId,
          tipo as 'medico' | 'biometrico' | 'general' | 'marketing' | 'transferencia'
        )
      : hasValidConsent(
          fastify.db,
          workerId,
          tipo as 'medico' | 'biometrico' | 'general' | 'marketing' | 'transferencia'
        );
    return { valid };
  });

  // ===== SOLICITUDES ARCO =====
  fastify.get('/privacy/arco', async (request, reply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'No autenticado' });
    // Admin ve todas; trabajador ve solo las suyas
    const workerId = user.rol === 'administrador' ? undefined : user.id;
    return getArcoRequests(fastify.db, workerId);
  });

  fastify.get('/privacy/arco/stats', { preHandler: requireRole('administrador') }, async () => {
    return getArcoStats(fastify.db);
  });

  fastify.get('/privacy/arco/:id', async (request, reply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'No autenticado' });
    const { id } = request.params as { id: string };
    const arco = getArcoRequestById(fastify.db, id);
    if (!arco) return reply.code(404).send({ error: 'Solicitud ARCO no encontrada' });
    if (user.rol !== 'administrador' && arco.worker_id !== user.id) {
      return reply.code(403).send({ error: 'No autorizado' });
    }
    return arco;
  });

  fastify.post('/privacy/arco', async (request, reply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'No autenticado' });

    const parsed = arcoSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    // Trabajador solo puede crear para sí mismo
    if (user.rol !== 'administrador' && parsed.data.worker_id !== user.id) {
      return reply.code(403).send({ error: 'Solo puede crear solicitudes para sí mismo' });
    }

    const arco = createArcoRequest(fastify.db, parsed.data);

    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'arco_requests',
      entidad_id: arco.id,
      valores_nuevos: parsed.data,
    });

    return arco;
  });

  fastify.put(
    '/privacy/arco/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = arcoUpdateSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const updated = updateArcoRequest(fastify.db, id, parsed.data);
      if (!updated) return reply.code(404).send({ error: 'Solicitud ARCO no encontrada' });

      const user = getAuthUser(request);
      auditLog(fastify.db, {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'editar',
        entidad: 'arco_requests',
        entidad_id: id,
        valores_nuevos: parsed.data,
      });

      return updated;
    }
  );

  // ===== REGISTRO DE TRATAMIENTO =====
  fastify.get('/privacy/processing', { preHandler: requireRole('administrador') }, async () => {
    return getDataProcessingRecords(fastify.db);
  });

  fastify.get(
    '/privacy/processing/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const record = getDataProcessingRecordById(fastify.db, id);
      if (!record) return reply.code(404).send({ error: 'Registro no encontrado' });
      return record;
    }
  );

  fastify.post(
    '/privacy/processing',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const parsed = processingRecordSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const record = createDataProcessingRecord(fastify.db, parsed.data);

      const user = getAuthUser(request);
      auditLog(fastify.db, {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'crear',
        entidad: 'data_processing_records',
        entidad_id: record.id,
        valores_nuevos: parsed.data,
      });

      return record;
    }
  );

  fastify.put(
    '/privacy/processing/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = processingRecordSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const updated = updateDataProcessingRecord(fastify.db, id, parsed.data);
      if (!updated) return reply.code(404).send({ error: 'Registro no encontrado' });

      const user = getAuthUser(request);
      auditLog(fastify.db, {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'editar',
        entidad: 'data_processing_records',
        entidad_id: id,
        valores_nuevos: parsed.data,
      });

      return updated;
    }
  );

  fastify.delete(
    '/privacy/processing/:id',
    { preHandler: requireRole('administrador') },
    async (request) => {
      const { id } = request.params as { id: string };
      deleteDataProcessingRecord(fastify.db, id);

      const user = getAuthUser(request);
      auditLog(fastify.db, {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'eliminar',
        entidad: 'data_processing_records',
        entidad_id: id,
      });

      return { ok: true };
    }
  );

  // ===== REPORTES DE CUMPLIMIENTO =====
  fastify.get('/privacy/compliance', { preHandler: requireRole('administrador') }, async () => {
    return getPrivacyComplianceReport(fastify.db);
  });

  fastify.get(
    '/privacy/consent/check/:workerId',
    { preHandler: requireRole('administrador') },
    async (request) => {
      const { workerId } = request.params as { workerId: string };
      return checkConsentForMedicalData(fastify.db, workerId);
    }
  );
};

export default privacyRoutes;
