import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  createCorrectiveAction,
  deleteCorrectiveAction,
  getCorrectiveActions,
  updateCorrectiveAction,
} from '../services/actions.js';
import { createAudit, deleteAudit, getAudits, updateAudit, createFinding, deleteFinding, getFindingsByAudit, getFindingsSummary, updateFinding } from '../services/audits_alerts.js';
import {
  createDocument,
  deleteDocument,
  getDocumentById,
  getDocuments,
  updateDocument,
} from '../services/documents.js';
import * as UsersService from '../services/users.js';

const docSchema = z.object({
  codigo: z.string().min(2),
  nombre: z.string().min(2),
  version: z.string().default('1.0'),
  tipo: z.string(),
  archivo_url: z.string().optional(),
  fecha_emision: z.string().optional(),
  fecha_revision: z.string().optional().nullable(),
  retencion_anos: z.number().int().positive().default(5),
  responsable: z.string().optional(),
  estado: z.enum(['vigente', 'obsoleto', 'en_revision']).default('vigente'),
});

const documentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/documents', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me) return reply.code(401).send({ error: 'No autenticado' });
    // Admin ve todo; trabajador ve solo vigentes
    if (me.rol !== 'administrador') {
      return getDocuments(fastify.db, { estado: 'vigente' });
    }
    return getDocuments(fastify.db);
  });
  fastify.get('/documents/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me) return reply.code(401).send({ error: 'No autenticado' });
    const d = getDocumentById(fastify.db, (request.params as any).id);
    if (!d) return reply.code(404).send({ error: 'Documento no encontrado' });
    // Trabajador solo ve documentos vigentes
    if (me.rol !== 'administrador' && d.estado !== 'vigente') {
      return reply.code(403).send({ error: 'No autorizado' });
    }
    return d;
  });
  fastify.post('/documents', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = docSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = createDocument(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'crear',
      entidad: 'documents',
      entidad_id: d.id,
      valores_nuevos: parsed.data,
    });
    return d;
  });
  fastify.put('/documents/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const parsed = docSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateDocument(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'editar',
      entidad: 'documents',
      entidad_id: id,
      valores_nuevos: parsed.data,
    });
    return updated;
  });
  fastify.delete('/documents/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    deleteDocument(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'eliminar',
      entidad: 'documents',
      entidad_id: (request.params as any).id,
    });
    return { ok: true };
  });
};

const actionSchema = z.object({
  origen: z.string(),
  descripcion: z.string().min(2),
  responsable: z.string().min(2),
  fecha_limite: z.string(),
  estado: z.enum(['pendiente', 'en_proceso', 'completada', 'vencida']).default('pendiente'),
  prioridad: z.enum(['baja', 'media', 'alta', 'critica']).default('media'),
});

const actionsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/actions', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me) return reply.code(401).send({ error: 'No autenticado' });
    return getCorrectiveActions(fastify.db);
  });
  fastify.post('/actions', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = actionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const a = createCorrectiveAction(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'crear',
      entidad: 'corrective_actions',
      entidad_id: a.id,
      valores_nuevos: parsed.data,
    });
    return a;
  });
  fastify.put('/actions/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const parsed = actionSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateCorrectiveAction(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'editar',
      entidad: 'corrective_actions',
      entidad_id: id,
      valores_nuevos: parsed.data,
    });
    return updated;
  });
  fastify.delete('/actions/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    deleteCorrectiveAction(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'eliminar',
      entidad: 'corrective_actions',
      entidad_id: (request.params as any).id,
    });
    return { ok: true };
  });
};

const auditSchema = z.object({
  anio: z.number().int(),
  tipo: z.enum(['interna', 'direccion']),
  fecha: z.string(),
  auditor: z.string().optional(),
  alcance: z.string().optional(),
  hallazgos: z.string().optional(),
  conclusiones: z.string().optional(),
  compromisos: z.string().optional(),
  estado: z.enum(['programada', 'realizada', 'cerrada']).default('programada'),
});

const findingSchema = z.object({
  audit_id: z.string(),
  descripcion: z.string().min(5),
  tipo: z.enum(['no_conformidad', 'observacion', 'oportunidad_mejora', 'fortaleza']),
  requisito: z.string().optional().nullable(),
  evidencia: z.string().optional().nullable(),
  responsable: z.string().min(2),
  fecha_limite: z.string(),
  estado: z.enum(['abierto', 'en_proceso', 'cerrado', 'verificado']).default('abierto'),
  accion_correctiva: z.string().optional().nullable(),
  evidencia_cierre: z.string().optional().nullable(),
  fecha_cierre: z.string().optional().nullable(),
});

const auditsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/audits', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me) return reply.code(401).send({ error: 'No autenticado' });
    return getAudits(fastify.db);
  });
  fastify.post('/audits', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = auditSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const a = createAudit(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'crear',
      entidad: 'audits',
      entidad_id: a.id,
      valores_nuevos: parsed.data,
    });
    return a;
  });
  fastify.put('/audits/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const parsed = auditSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateAudit(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'editar',
      entidad: 'audits',
      entidad_id: id,
      valores_nuevos: parsed.data,
    });
    return updated;
  });
  fastify.delete('/audits/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    deleteAudit(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'eliminar',
      entidad: 'audits',
      entidad_id: (request.params as any).id,
    });
    return { ok: true };
  });

  // ===== AUDIT FINDINGS (Hallazgos) =====
  fastify.get('/audits/:id/findings', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me) return reply.code(401).send({ error: 'No autenticado' });
    const { id } = request.params as { id: string };
    return getFindingsByAudit(fastify.db, id);
  });

  fastify.get('/audits/findings/summary', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me) return reply.code(401).send({ error: 'No autenticado' });
    return getFindingsSummary(fastify.db);
  });

  fastify.post('/audits/:id/findings', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, any>;
    const parsed = findingSchema.safeParse({ ...body, audit_id: id });
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const f = createFinding(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'crear',
      entidad: 'audit_findings',
      entidad_id: f.id,
      valores_nuevos: parsed.data,
    });
    return f;
  });

  fastify.put('/audits/:id/findings/:fid', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { fid } = request.params as { fid: string };
    const parsed = findingSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateFinding(fastify.db, fid, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'editar',
      entidad: 'audit_findings',
      entidad_id: fid,
      valores_nuevos: parsed.data,
    });
    return updated;
  });

  fastify.delete('/audits/:id/findings/:fid', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    deleteFinding(fastify.db, (request.params as any).fid);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'eliminar',
      entidad: 'audit_findings',
      entidad_id: (request.params as any).fid,
    });
    return { ok: true };
  });

  // Export findings to Excel
  fastify.get('/audits/:id/findings/export', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const findings = getFindingsByAudit(fastify.db, id);
    const audit = fastify.db.prepare('SELECT * FROM audits WHERE id = ?').get(id);
    
    // Create Excel using ExcelJS
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Hallazgos');
    
    ws.columns = [
      { header: 'ID', key: 'id', width: 12 },
      { header: 'Tipo', key: 'tipo', width: 20 },
      { header: 'Descripción', key: 'descripcion', width: 50 },
      { header: 'Requisito', key: 'requisito', width: 30 },
      { header: 'Evidencia', key: 'evidencia', width: 30 },
      { header: 'Responsable', key: 'responsable', width: 20 },
      { header: 'Fecha Límite', key: 'fecha_limite', width: 15 },
      { header: 'Estado', key: 'estado', width: 15 },
      { header: 'Acción Correctiva', key: 'accion_correctiva', width: 40 },
      { header: 'Evidencia Cierre', key: 'evidencia_cierre', width: 30 },
      { header: 'Fecha Cierre', key: 'fecha_cierre', width: 15 },
    ];
    
    for (const f of findings) {
      ws.addRow({
        id: f.id,
        tipo: f.tipo,
        descripcion: f.descripcion,
        requisito: f.requisito || '',
        evidencia: f.evidencia || '',
        responsable: f.responsable,
        fecha_limite: f.fecha_limite,
        estado: f.estado,
        accion_correctiva: f.accion_correctiva || '',
        evidencia_cierre: f.evidencia_cierre || '',
        fecha_cierre: f.fecha_cierre || '',
      });
    }
    
    const buf = await wb.xlsx.writeBuffer();
    reply.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename=hallazgos_auditoria_${audit?.anio}_${audit?.tipo}.xlsx`);
    return buf;
  });
};

// ===== AUDIT LOGS (Bitácora de trazabilidad) =====
const auditLogsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /audit-logs - Solo administrador puede ver la bitácora completa
  fastify.get('/audit-logs', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador puede consultar la bitácora de auditoría' });

    const { limit = '100', offset = '0', entidad, accion, usuario_id, desde, hasta } = request.query as {
      limit?: string;
      offset?: string;
      entidad?: string;
      accion?: string;
      usuario_id?: string;
      desde?: string;
      hasta?: string;
    };

    let where = '1=1';
    const params: any[] = [];

    if (entidad) {
      where += ' AND entidad = ?';
      params.push(entidad);
    }
    if (accion) {
      where += ' AND accion = ?';
      params.push(accion);
    }
    if (usuario_id) {
      where += ' AND usuario_id = ?';
      params.push(usuario_id);
    }
    if (desde) {
      where += ' AND date(creado_en) >= date(?)';
      params.push(desde);
    }
    if (hasta) {
      where += ' AND date(creado_en) <= date(?)';
      params.push(hasta);
    }

    const logs = fastify.db
      .prepare(
        `SELECT * FROM audit_logs WHERE ${where} ORDER BY creado_en DESC LIMIT ? OFFSET ?`
      )
      .all(...params, parseInt(limit, 10), parseInt(offset, 10)) as Array<{
        id: string;
        usuario_id: string | null;
        usuario_email: string | null;
        accion: string;
        entidad: string;
        entidad_id: string | null;
        valores_anteriores: string | null;
        valores_nuevos: string | null;
        ip: string | null;
        creado_en: string;
      }>;

    const total = fastify.db
      .prepare(`SELECT COUNT(*) as c FROM audit_logs WHERE ${where}`)
      .get(...params) as { c: number };

    return { logs, total: total.c };
  });

  // GET /audit-logs/stats - Resumen estadístico de la bitácora
  fastify.get('/audit-logs/stats', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });

    const total = fastify.db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as { c: number };
    const porEntidad = fastify.db
      .prepare('SELECT entidad, COUNT(*) as c FROM audit_logs GROUP BY entidad ORDER BY c DESC')
      .all() as Array<{ entidad: string; c: number }>;
    const porAccion = fastify.db
      .prepare('SELECT accion, COUNT(*) as c FROM audit_logs GROUP BY accion ORDER BY c DESC')
      .all() as Array<{ accion: string; c: number }>;
    const porUsuario = fastify.db
      .prepare(
        'SELECT usuario_email, COUNT(*) as c FROM audit_logs WHERE usuario_email IS NOT NULL GROUP BY usuario_email ORDER BY c DESC'
      )
      .all() as Array<{ usuario_email: string; c: number }>;

    return { total: total.c, porEntidad, porAccion, porUsuario };
  });
};

export { actionsRoutes, auditsRoutes, auditLogsRoutes, documentsRoutes };
