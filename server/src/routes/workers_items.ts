import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import * as UsersService from '../services/users.js';
import {
  getCertsByWorker,
  getCertById,
  crearCertificado,
  updateCert,
  deleteCert,
  getVencimientosProximos as getCertVencimientos,
  calcularVencimientoAlturas,
  validarCertificadoAlturas
} from '../services/workers_certs.js';
import {
  getEppByWorker,
  getEppById,
  createEpp,
  updateEpp,
  deleteEpp,
  firmarEntregaEpp,
  getVencimientosProximos as getEppVencimientos,
  getEppSinFirmar,
  getWorkerVencimientos,
  EPP_ITEMS_COMUNES
} from '../services/workers_epp.js';
import {
  getExamsByWorker,
  getExamById,
  createExam,
  updateExam,
  deleteExam,
  getVencimientosProximos as getExamVencimientos
} from '../services/workers_exams.js';

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
  notas: z.string().optional().nullable()
});

const certSchema = z.object({
  worker_id: z.string(),
  tipo: z.enum(['alturas', 'electrico', 'primeros_auxilios', 'brigada', 'conduccion', 'sst_50h', 'otro']),
  nombre_curso: z.string().optional().nullable(),
  entidad: z.string().optional().nullable(),
  fecha_emision: z.string(),
  fecha_vencimiento: z.string(),
  archivo_url: z.string().optional().nullable(),
  notas: z.string().optional().nullable()
});

const eppSchema = z.object({
  worker_id: z.string(),
  item: z.string().min(1),
  cantidad: z.number().int().positive().default(1),
  fecha_entrega: z.string(),
  fecha_vencimiento: z.string().optional().nullable(),
  firmado_por_trabajador: z.number().int().min(0).max(1).default(0),
  firma_url: z.string().optional().nullable(),
  notas: z.string().optional().nullable()
});

const firmaEppSchema = z.object({
  firma_base64: z.string().min(100) // base64 PNG mínimo
});

const workersItemsRoutes: FastifyPluginAsync = async (fastify) => {
  // ===== EXÁMENES MÉDICOS =====
  
  // GET /workers/:wid/exams - listar exámenes de un trabajador (sin datos sensibles por defecto)
  fastify.get('/workers/:wid/exams', async (request, reply) => {
    const { wid } = request.params as { wid: string };
    const userId = (request as any).userId as string | undefined;
    const me = userId ? UsersService.getUserById(fastify.db, userId) : undefined;
    const includeSensitive = me?.rol === 'administrador';
    return getExamsByWorker(fastify.db, wid, includeSensitive);
  });

  // GET /workers/exams/ingreso - verificar si tiene examen de ingreso
  fastify.get('/workers/exams/ingreso', async (request, reply) => {
    const wid = (request as any).userId; // worker autenticado consulta el suyo
    if (!wid) return reply.code(401).send({ error: 'No autenticado' });
    const exam = fastify.db.prepare('SELECT * FROM worker_exams WHERE worker_id = ? AND tipo = ? ORDER BY fecha DESC LIMIT 1').get(wid, 'ingreso');
    return { tiene_examen_ingreso: !!exam, examen: exam ? { id: exam.id, fecha: exam.fecha, vencimiento: exam.vencimiento } : null };
  });

  // GET /workers/exams/detail/:id - detalle con datos sensibles (solo admin)
  fastify.get('/workers/exams/detail/:id', async (request, reply) => {
    const me = UsersService.getUserById(fastify.db, (request as any).userId!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador puede ver datos médicos sensibles' });
    const { id } = request.params as { id: string };
    const exam = getExamById(fastify.db, id, true);
    if (!exam) return reply.code(404).send({ error: 'Examen no encontrado' });
    return exam;
  });

  // POST /workers/:wid/exams (admin) - crear examen
  fastify.post('/workers/:wid/exams', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    
    const { wid } = request.params as { wid: string };
    const body = request.body as Record<string, any>;
    const parsed = examSchema.safeParse({ ...body, worker_id: wid });
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    
    try {
      const exam = createExam(fastify.db, parsed.data);
      UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'crear', entidad: 'worker_exams', entidad_id: exam.id, valores_nuevos: parsed.data });
      return exam;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // PUT /workers/exams/:id (admin) - actualizar examen
  fastify.put('/workers/exams/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    
    const { id } = request.params as { id: string };
    const parsed = examSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    
    const old = getExamById(fastify.db, id, true);
    const updated = updateExam(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'editar', entidad: 'worker_exams', entidad_id: id, valores_anteriores: old, valores_nuevos: parsed.data });
    return updated;
  });

  // DELETE /workers/exams/:id (admin)
  fastify.delete('/workers/exams/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    
    deleteExam(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'eliminar', entidad: 'worker_exams', entidad_id: (request.params as any).id });
    return { ok: true };
  });

  // ===== CERTIFICADOS =====
  
  // GET /workers/:wid/certs
  fastify.get('/workers/:wid/certs', async (request) => {
    const { wid } = request.params as { wid: string };
    return getCertsByWorker(fastify.db, wid);
  });

  // POST /workers/:wid/certs (admin)
  fastify.post('/workers/:wid/certs', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    
    const { wid } = request.params as { wid: string };
    const body = request.body as Record<string, any>;
    const parsed = certSchema.safeParse({ ...body, worker_id: wid });
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    
    try {
      const cert = crearCertificado(fastify.db, parsed.data);
      UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'crear', entidad: 'worker_certs', entidad_id: cert.id, valores_nuevos: parsed.data });
      return cert;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // PUT /workers/certs/:id (admin)
  fastify.put('/workers/certs/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    
    const { id } = request.params as { id: string };
    const parsed = certSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    
    const old = getCertById(fastify.db, id);
    if (!old) return reply.code(404).send({ error: 'Certificado no encontrado' });
    try {
      const updated = updateCert(fastify.db, id, parsed.data);
      UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'editar', entidad: 'worker_certs', entidad_id: id, valores_anteriores: old, valores_nuevos: parsed.data });
      return updated;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // DELETE /workers/certs/:id (admin)
  fastify.delete('/workers/certs/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    
    deleteCert(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'eliminar', entidad: 'worker_certs', entidad_id: (request.params as any).id });
    return { ok: true };
  });

  // Helpers para certificados de alturas (frontend)
  fastify.get('/certs/alturas/calcular-vencimiento', async (request) => {
    const { fecha_emision } = request.query as { fecha_emision: string };
    if (!fecha_emision) return { error: 'fecha_emision requerida' };
    return { fecha_vencimiento: calcularVencimientoAlturas(fecha_emision) };
  });

  fastify.post('/certs/alturas/validar', async (request) => {
    const parsed = z.object({ fecha_emision: z.string(), fecha_vencimiento: z.string() }).safeParse(request.body);
    if (!parsed.success) return { valido: false, mensaje: 'Parámetros inválidos' };
    return validarCertificadoAlturas(parsed.data.fecha_emision, parsed.data.fecha_vencimiento);
  });

  // ===== EPP / DOTACIÓN =====
  
  // GET /workers/:wid/epp
  fastify.get('/workers/:wid/epp', async (request) => {
    const { wid } = request.params as { wid: string };
    return getEppByWorker(fastify.db, wid);
  });

  // POST /workers/:wid/epp (admin)
  fastify.post('/workers/:wid/epp', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    
    const { wid } = request.params as { wid: string };
    const body = request.body as Record<string, any>;
    const parsed = eppSchema.safeParse({ ...body, worker_id: wid });
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    
    const epp = createEpp(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'crear', entidad: 'worker_epp', entidad_id: epp.id, valores_nuevos: parsed.data });
    return epp;
  });

  // PUT /workers/epp/:id (admin)
  fastify.put('/workers/epp/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    
    const { id } = request.params as { id: string };
    const parsed = eppSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    
    const old = getEppById(fastify.db, id);
    const updated = updateEpp(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'editar', entidad: 'worker_epp', entidad_id: id, valores_anteriores: old, valores_nuevos: parsed.data });
    return updated;
  });

  // POST /workers/epp/:id/firmar - firma digital del trabajador (Res. 0312/2019 E19)
  fastify.post('/workers/epp/:id/firmar', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me) return reply.code(401).send({ error: 'No autenticado' });
    
    const { id } = request.params as { id: string };
    const parsed = firmaEppSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    
    // Verificar propiedad: el trabajador solo puede firmar SU EPP, admin puede firmar cualquiera
    const epp = getEppById(fastify.db, id);
    if (!epp) return reply.code(404).send({ error: 'Entrega EPP no encontrada' });
    if (me.rol !== 'administrador' && epp.worker_id !== me.id) {
      return reply.code(403).send({ error: 'Solo puede firmar sus propias entregas de EPP' });
    }
    
    const old = { ...epp };
    const updated = firmarEntregaEpp(fastify.db, id, parsed.data.firma_base64, epp.worker_id);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'firmar', entidad: 'worker_epp', entidad_id: id, valores_anteriores: old, valores_nuevos: { firmado_por_trabajador: 1, firma_url: 'base64...' } });
    return updated;
  });

  // DELETE /workers/epp/:id (admin)
  fastify.delete('/workers/epp/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    
    deleteEpp(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'eliminar', entidad: 'worker_epp', entidad_id: (request.params as any).id });
    return { ok: true };
  });

  // GET /workers/epp/items-comunes - lista de items EPP comunes
  fastify.get('/workers/epp/items-comunes', async () => {
    return { items: EPP_ITEMS_COMUNES };
  });

  // ===== UNIFICADO: VENCIMIENTOS (para Alertas) =====
  
  // GET /workers/vencimientos?dias=30
  fastify.get('/workers/vencimientos', async (request) => {
    const { dias = '30' } = request.query as { dias?: string };
    return getWorkerVencimientos(fastify.db, parseInt(dias, 10));
  });

  // GET /workers/epp/sin-firmar - EPP pendientes de firma
  fastify.get('/workers/epp/sin-firmar', async (request, reply) => {
    const me = UsersService.getUserById(fastify.db, (request as any).userId!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    return getEppSinFirmar(fastify.db);
  });
};

export default workersItemsRoutes;