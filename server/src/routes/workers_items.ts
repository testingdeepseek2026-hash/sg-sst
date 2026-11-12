import { FastifyPluginAsync, type FastifyInstance } from 'fastify';
import { z } from 'zod';

import { auditLog, getAuthUser, isAdmin, requireRole } from '../lib/auth.js';
import { isPgBackend } from '../lib/db-pg.js';
import { auditLogPg } from '../services/users.pg.js';
import { WorkerValidationError } from '../services/worker_validation_error.js';
import {
  calcularVencimientoAlturas,
  crearCertificado,
  deleteCert,
  getCertById,
  getCertsByWorker,
  updateCert,
  validarCertificadoAlturas,
} from '../services/workers_certs.js';
import * as PgCertsService from '../services/workers_certs.pg.js';
import {
  createEpp,
  deleteEpp,
  EPP_ITEMS_COMUNES,
  firmarEntregaEpp,
  getEppById,
  getEppByWorker,
  getEppSinFirmar,
  getWorkerVencimientos,
  updateEpp,
} from '../services/workers_epp.js';
import * as PgEppService from '../services/workers_epp.pg.js';
import {
  createExam,
  deleteExam,
  getExamById,
  getExamsByWorker,
  updateExam,
} from '../services/workers_exams.js';
import * as PgExamsService from '../services/workers_exams.pg.js';

async function recordAudit(
  fastify: FastifyInstance,
  entry: Parameters<typeof auditLog>[1]
): Promise<void> {
  if (isPgBackend()) await auditLogPg(entry);
  else auditLog(fastify.db, entry);
}

const examSchema = z.object({
  worker_id: z.string(),
  tipo: z.enum(['ingreso', 'periodico', 'egreso', 'control']),
  fecha: z.string(),
  vencimiento: z.string().optional().nullable(),
  resultado: z.enum(['apto', 'apto_con_restricciones', 'no_apto']).default('apto'),
  restricciones: z.string().optional().nullable(),
  medico: z.string().optional().nullable(),
  entidad: z.string().optional().nullable(),
  archivo_url: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
});

const certSchema = z.object({
  worker_id: z.string(),
  tipo: z.enum([
    'alturas',
    'electrico',
    'primeros_auxilios',
    'brigada',
    'conduccion',
    'sst_50h',
    'otro',
  ]),
  nombre_curso: z.string().optional().nullable(),
  entidad: z.string().optional().nullable(),
  fecha_emision: z.string(),
  fecha_vencimiento: z.string(),
  archivo_url: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
});

const eppSchema = z.object({
  worker_id: z.string(),
  item: z.string().min(1),
  cantidad: z.number().int().positive().default(1),
  fecha_entrega: z.string(),
  fecha_vencimiento: z.string().optional().nullable(),
  firmado_por_trabajador: z.number().int().min(0).max(1).default(0),
  firma_url: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
});

const firmaEppSchema = z.object({
  firma_base64: z.string().min(100), // base64 PNG mínimo
});

const workersItemsRoutes: FastifyPluginAsync = async (fastify) => {
  // ===== EXÁMENES MÉDICOS =====

  // GET /workers/:wid/exams - listar exámenes de un trabajador (sin datos sensibles por defecto)
  fastify.get('/workers/:wid/exams', async (request) => {
    const { wid } = request.params as { wid: string };
    const user = request.user;
    const includeSensitive = user?.rol === 'administrador';
    return isPgBackend()
      ? PgExamsService.getExamsByWorkerPg(wid, includeSensitive)
      : getExamsByWorker(fastify.db, wid, includeSensitive);
  });

  // GET /workers/exams/ingreso - verificar si tiene examen de ingreso (trabajador autenticado)
  fastify.get('/workers/exams/ingreso', async (request, reply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'No autenticado' });
    const exam = isPgBackend()
      ? await PgExamsService.getExamIngresoByWorkerPg(user.id)
      : fastify.db
          .prepare(
            'SELECT * FROM worker_exams WHERE worker_id = ? AND tipo = ? ORDER BY fecha DESC LIMIT 1'
          )
          .get(user.id, 'ingreso');
    return {
      tiene_examen_ingreso: !!exam,
      examen: exam ? { id: exam.id, fecha: exam.fecha, vencimiento: exam.vencimiento } : null,
    };
  });

  // GET /workers/exams/detail/:id - detalle con datos sensibles (solo admin)
  fastify.get(
    '/workers/exams/detail/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const exam = isPgBackend()
        ? await PgExamsService.getExamByIdPg(id, true)
        : getExamById(fastify.db, id, true);
      if (!exam) return reply.code(404).send({ error: 'Examen no encontrado' });
      return exam;
    }
  );

  // POST /workers/:wid/exams (admin) - crear examen
  fastify.post(
    '/workers/:wid/exams',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { wid } = request.params as { wid: string };
      const body = request.body as Record<string, any>;
      const parsed = examSchema.safeParse({ ...body, worker_id: wid });
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      try {
        const exam = isPgBackend()
          ? await PgExamsService.createExamPg(parsed.data)
          : createExam(fastify.db, parsed.data);

        const user = getAuthUser(request);
        await recordAudit(fastify, {
          usuario_id: user.id,
          usuario_email: user.email,
          accion: 'crear',
          entidad: 'worker_exams',
          entidad_id: exam.id,
          valores_nuevos: {
            worker_id: parsed.data.worker_id,
            tipo: parsed.data.tipo,
            fecha: parsed.data.fecha,
          },
        });

        return exam;
      } catch (error) {
        if (!(error instanceof WorkerValidationError)) throw error;
        return reply.code(400).send({ error: error.message });
      }
    }
  );

  // PUT /workers/exams/:id (admin) - actualizar examen
  fastify.put(
    '/workers/exams/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = examSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const old = isPgBackend()
        ? await PgExamsService.getExamByIdPg(id, true)
        : getExamById(fastify.db, id, true);
      if (!old) return reply.code(404).send({ error: 'Examen no encontrado' });
      const updated = isPgBackend()
        ? await PgExamsService.updateExamPg(id, parsed.data)
        : updateExam(fastify.db, id, parsed.data);
      if (!updated) return reply.code(404).send({ error: 'Examen no encontrado' });

      const user = getAuthUser(request);
      await recordAudit(fastify, {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'editar',
        entidad: 'worker_exams',
        entidad_id: id,
        valores_anteriores: { worker_id: old.worker_id, tipo: old.tipo, fecha: old.fecha },
        valores_nuevos: {
          worker_id: parsed.data.worker_id ?? old.worker_id,
          tipo: parsed.data.tipo ?? old.tipo,
          fecha: parsed.data.fecha ?? old.fecha,
        },
      });

      return updated;
    }
  );

  // DELETE /workers/exams/:id (admin)
  fastify.delete(
    '/workers/exams/:id',
    { preHandler: requireRole('administrador') },
    async (request) => {
      const { id } = request.params as { id: string };
      if (isPgBackend()) await PgExamsService.deleteExamPg(id);
      else deleteExam(fastify.db, id);

      const user = getAuthUser(request);
      await recordAudit(fastify, {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'eliminar',
        entidad: 'worker_exams',
        entidad_id: id,
      });

      return { ok: true };
    }
  );

  // ===== CERTIFICADOS =====

  // GET /workers/:wid/certs
  fastify.get('/workers/:wid/certs', async (request) => {
    const { wid } = request.params as { wid: string };
    return isPgBackend()
      ? PgCertsService.getCertsByWorkerPg(wid)
      : getCertsByWorker(fastify.db, wid);
  });

  // POST /workers/:wid/certs (admin)
  fastify.post(
    '/workers/:wid/certs',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { wid } = request.params as { wid: string };
      const body = request.body as Record<string, any>;
      const parsed = certSchema.safeParse({ ...body, worker_id: wid });
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      try {
        const cert = isPgBackend()
          ? await PgCertsService.crearCertificadoPg(parsed.data)
          : crearCertificado(fastify.db, parsed.data);

        const user = getAuthUser(request);
        await recordAudit(fastify, {
          usuario_id: user.id,
          usuario_email: user.email,
          accion: 'crear',
          entidad: 'worker_certs',
          entidad_id: cert.id,
          valores_nuevos: {
            worker_id: parsed.data.worker_id,
            tipo: parsed.data.tipo,
            nombre_curso: parsed.data.nombre_curso,
            fecha_emision: parsed.data.fecha_emision,
            fecha_vencimiento: parsed.data.fecha_vencimiento,
          },
        });

        return cert;
      } catch (error) {
        if (!(error instanceof WorkerValidationError)) throw error;
        return reply.code(400).send({ error: error.message });
      }
    }
  );

  // PUT /workers/certs/:id (admin)
  fastify.put(
    '/workers/certs/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = certSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const old = isPgBackend()
        ? await PgCertsService.getCertByIdPg(id)
        : getCertById(fastify.db, id);
      if (!old) return reply.code(404).send({ error: 'Certificado no encontrado' });

      try {
        const updated = isPgBackend()
          ? await PgCertsService.updateCertPg(id, parsed.data)
          : updateCert(fastify.db, id, parsed.data);

        const user = getAuthUser(request);
        await recordAudit(fastify, {
          usuario_id: user.id,
          usuario_email: user.email,
          accion: 'editar',
          entidad: 'worker_certs',
          entidad_id: id,
          valores_anteriores: {
            worker_id: old.worker_id,
            tipo: old.tipo,
            nombre_curso: old.nombre_curso,
            fecha_emision: old.fecha_emision,
            fecha_vencimiento: old.fecha_vencimiento,
          },
          valores_nuevos: {
            worker_id: parsed.data.worker_id ?? old.worker_id,
            tipo: parsed.data.tipo ?? old.tipo,
            nombre_curso: parsed.data.nombre_curso ?? old.nombre_curso,
            fecha_emision: parsed.data.fecha_emision ?? old.fecha_emision,
            fecha_vencimiento: parsed.data.fecha_vencimiento ?? old.fecha_vencimiento,
          },
        });

        return updated;
      } catch (error) {
        if (!(error instanceof WorkerValidationError)) throw error;
        return reply.code(400).send({ error: error.message });
      }
    }
  );

  // DELETE /workers/certs/:id (admin)
  fastify.delete(
    '/workers/certs/:id',
    { preHandler: requireRole('administrador') },
    async (request) => {
      const { id } = request.params as { id: string };
      if (isPgBackend()) await PgCertsService.deleteCertPg(id);
      else deleteCert(fastify.db, id);

      const user = getAuthUser(request);
      await recordAudit(fastify, {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'eliminar',
        entidad: 'worker_certs',
        entidad_id: id,
      });

      return { ok: true };
    }
  );

  // Helpers para certificados de alturas (frontend)
  fastify.get('/certs/alturas/calcular-vencimiento', async (request) => {
    const { fecha_emision } = request.query as { fecha_emision: string };
    if (!fecha_emision) return { error: 'fecha_emision requerida' };
    return { fecha_vencimiento: calcularVencimientoAlturas(fecha_emision) };
  });

  fastify.post('/certs/alturas/validar', async (request) => {
    const parsed = z
      .object({ fecha_emision: z.string(), fecha_vencimiento: z.string() })
      .safeParse(request.body);
    if (!parsed.success) return { valido: false, mensaje: 'Parámetros inválidos' };
    return validarCertificadoAlturas(parsed.data.fecha_emision, parsed.data.fecha_vencimiento);
  });

  // ===== EPP / DOTACIÓN =====

  // GET /workers/:wid/epp
  fastify.get('/workers/:wid/epp', async (request) => {
    const { wid } = request.params as { wid: string };
    return isPgBackend() ? PgEppService.getEppByWorkerPg(wid) : getEppByWorker(fastify.db, wid);
  });

  // POST /workers/:wid/epp (admin)
  fastify.post(
    '/workers/:wid/epp',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { wid } = request.params as { wid: string };
      const body = request.body as Record<string, any>;
      const parsed = eppSchema.safeParse({ ...body, worker_id: wid });
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const epp = isPgBackend()
        ? await PgEppService.createEppPg(parsed.data)
        : createEpp(fastify.db, parsed.data);

      const user = getAuthUser(request);
      await recordAudit(fastify, {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'crear',
        entidad: 'worker_epp',
        entidad_id: epp.id,
        valores_nuevos: {
          worker_id: parsed.data.worker_id,
          item: parsed.data.item,
          cantidad: parsed.data.cantidad,
          fecha_entrega: parsed.data.fecha_entrega,
          fecha_vencimiento: parsed.data.fecha_vencimiento,
        },
      });

      return epp;
    }
  );

  // PUT /workers/epp/:id (admin)
  fastify.put(
    '/workers/epp/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = eppSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const old = isPgBackend() ? await PgEppService.getEppByIdPg(id) : getEppById(fastify.db, id);
      if (!old) return reply.code(404).send({ error: 'Entrega EPP no encontrada' });
      const updated = isPgBackend()
        ? await PgEppService.updateEppPg(id, parsed.data)
        : updateEpp(fastify.db, id, parsed.data);
      if (!updated) return reply.code(404).send({ error: 'Entrega EPP no encontrada' });

      const user = getAuthUser(request);
      await recordAudit(fastify, {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'editar',
        entidad: 'worker_epp',
        entidad_id: id,
        valores_anteriores: {
          worker_id: old.worker_id,
          item: old.item,
          cantidad: old.cantidad,
          fecha_entrega: old.fecha_entrega,
          fecha_vencimiento: old.fecha_vencimiento,
        },
        valores_nuevos: {
          worker_id: parsed.data.worker_id ?? old.worker_id,
          item: parsed.data.item ?? old.item,
          cantidad: parsed.data.cantidad ?? old.cantidad,
          fecha_entrega: parsed.data.fecha_entrega ?? old.fecha_entrega,
          fecha_vencimiento: parsed.data.fecha_vencimiento ?? old.fecha_vencimiento,
        },
      });

      return updated;
    }
  );

  // POST /workers/epp/:id/firmar - firma digital del trabajador (Res. 0312/2019 E19)
  // El trabajador puede firmar su propio EPP, admin puede firmar cualquiera
  fastify.post('/workers/epp/:id/firmar', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = firmaEppSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const epp = isPgBackend() ? await PgEppService.getEppByIdPg(id) : getEppById(fastify.db, id);
    if (!epp) return reply.code(404).send({ error: 'Entrega EPP no encontrada' });

    // Verificar propiedad: trabajador solo firma SU EPP, admin cualquiera
    const me = getAuthUser(request);
    if (!isAdmin(request) && epp.worker_id !== me.id) {
      return reply.code(403).send({ error: 'Solo puede firmar sus propias entregas de EPP' });
    }

    const old = { ...epp };
    const updated = isPgBackend()
      ? await PgEppService.firmarEntregaEppPg(id, parsed.data.firma_base64)
      : firmarEntregaEpp(fastify.db, id, parsed.data.firma_base64, epp.worker_id);

    await recordAudit(fastify, {
      usuario_id: me.id,
      usuario_email: me.email,
      accion: 'firmar',
      entidad: 'worker_epp',
      entidad_id: id,
      valores_anteriores: old,
      valores_nuevos: { firmado_por_trabajador: 1, firma_url: 'base64...' },
    });

    return updated;
  });

  // DELETE /workers/epp/:id (admin)
  fastify.delete(
    '/workers/epp/:id',
    { preHandler: requireRole('administrador') },
    async (request) => {
      const { id } = request.params as { id: string };
      if (isPgBackend()) await PgEppService.deleteEppPg(id);
      else deleteEpp(fastify.db, id);

      const user = getAuthUser(request);
      await recordAudit(fastify, {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'eliminar',
        entidad: 'worker_epp',
        entidad_id: id,
      });

      return { ok: true };
    }
  );

  // GET /workers/epp/items-comunes - lista de items EPP comunes
  fastify.get('/workers/epp/items-comunes', async () => {
    return { items: EPP_ITEMS_COMUNES };
  });

  // ===== UNIFICADO: VENCIMIENTOS (para Alertas) =====

  // GET /workers/vencimientos?dias=30
  fastify.get('/workers/vencimientos', async (request) => {
    const { dias = '30' } = request.query as { dias?: string };
    return isPgBackend()
      ? PgEppService.getWorkerVencimientosPg(parseInt(dias, 10))
      : getWorkerVencimientos(fastify.db, parseInt(dias, 10));
  });

  // GET /workers/epp/sin-firmar - EPP pendientes de firma (solo admin)
  fastify.get('/workers/epp/sin-firmar', { preHandler: requireRole('administrador') }, async () => {
    return isPgBackend() ? PgEppService.getEppSinFirmarPg() : getEppSinFirmar(fastify.db);
  });
};

export default workersItemsRoutes;
