import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  archivarPolicy,
  createObjective,
  createPolicy,
  deleteObjective,
  deletePolicy,
  divulgarPolicy,
  firmarPolicy,
  getActivePolicy,
  getObjectives,
  getPolicies,
  getPolicyById,
  updateObjective,
  updatePolicy,
} from '../services/policies.js';
import { requireRole, getAuthUser, auditLog } from '../lib/auth.js';

const policyCreateSchema = z.object({
  titulo: z.string().min(2),
  contenido: z.string().min(10),
  estado: z.enum(['borrador', 'vigente', 'archivada']).default('borrador'),
});

const policyUpdateSchema = z.object({
  titulo: z.string().min(2).optional(),
  contenido: z.string().min(10).optional(),
});

const firmarSchema = z.object({
  firmado_por: z.string().min(2),
});

const objectiveSchema = z.object({
  policy_id: z.string(),
  descripcion: z.string().min(5),
  tipo: z.enum(['estructura', 'proceso', 'resultado']),
  meta: z.string().optional().nullable(),
  responsable: z.string().optional().nullable(),
  fecha_limite: z.string().optional().nullable(),
  estado: z.enum(['pendiente', 'cumplido', 'en_proceso', 'incumplido']).default('pendiente'),
});

const objectiveUpdateSchema = z.object({
  descripcion: z.string().min(5).optional(),
  tipo: z.enum(['estructura', 'proceso', 'resultado']).optional(),
  meta: z.string().optional().nullable(),
  responsable: z.string().optional().nullable(),
  fecha_limite: z.string().optional().nullable(),
  estado: z.enum(['pendiente', 'cumplido', 'en_proceso', 'incumplido']).optional(),
});

const policiesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /policies - lista todas con objetivos anidados (cualquier autenticado)
  fastify.get('/policies', async (request, reply) => {
    const policies = getPolicies(fastify.db);
    const policiesWithObjectives = policies.map((p) => ({
      ...p,
      objectives: getObjectives(fastify.db, p.id),
    }));
    return policiesWithObjectives;
  });

  // GET /policies/active - política vigente con objetivos (cualquier autenticado)
  fastify.get('/policies/active', async (request, reply) => {
    const active = getActivePolicy(fastify.db);
    if (!active) return reply.code(404).send({ error: 'No hay política vigente' });
    return {
      ...active,
      objectives: getObjectives(fastify.db, active.id),
    };
  });

  // GET /policies/:id - detalle (cualquier autenticado)
  fastify.get('/policies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const policy = getPolicyById(fastify.db, id);
    if (!policy) return reply.code(404).send({ error: 'Política no encontrada' });
    return {
      ...policy,
      objectives: getObjectives(fastify.db, id),
    };
  });

  // POST /policies (admin) - crear borrador
  fastify.post('/policies', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const parsed = policyCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const p = createPolicy(fastify.db, parsed.data);

      const user = getAuthUser(request);
      auditLog(fastify.db, {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'crear',
        entidad: 'policies',
        entidad_id: p.id,
        valores_nuevos: parsed.data,
      });

      return p;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // PUT /policies/:id (admin) - actualizar borrador
  fastify.put('/policies/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = policyUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const updated = updatePolicy(fastify.db, id, parsed.data);
      if (!updated) return reply.code(404).send({ error: 'Política no encontrada' });

      const user = getAuthUser(request);
      auditLog(fastify.db, {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'editar',
        entidad: 'policies',
        entidad_id: id,
        valores_nuevos: parsed.data,
      });

      return updated;
    } catch (err: any) {
      if (err.message.includes('no encontrada')) {
        return reply.code(404).send({ error: err.message });
      }
      return reply.code(400).send({ error: err.message });
    }
  });

  // POST /policies/:id/firmar (admin) - firmar
  fastify.post('/policies/:id/firmar', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = firmarSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const updated = firmarPolicy(fastify.db, id, parsed.data.firmado_por);
      if (!updated) return reply.code(404).send({ error: 'Política no encontrada' });

      const user = getAuthUser(request);
      auditLog(fastify.db, {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'firmar',
        entidad: 'policies',
        entidad_id: id,
        valores_nuevos: { firmado_por: parsed.data.firmado_por },
      });

      return updated;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // POST /policies/:id/divulgar (admin) - divulgar (pone vigente)
  fastify.post('/policies/:id/divulgar', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const updated = divulgarPolicy(fastify.db, id);
      if (!updated) return reply.code(404).send({ error: 'Política no encontrada' });

      const user = getAuthUser(request);
      auditLog(fastify.db, {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'divulgar',
        entidad: 'policies',
        entidad_id: id,
      });

      return updated;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // POST /policies/:id/archivar (admin) - archivar
  fastify.post('/policies/:id/archivar', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const updated = archivarPolicy(fastify.db, id);
      if (!updated) return reply.code(404).send({ error: 'Política no encontrada' });

      const user = getAuthUser(request);
      auditLog(fastify.db, {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'archivar',
        entidad: 'policies',
        entidad_id: id,
      });

      return updated;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // DELETE /policies/:id (admin) - eliminar borrador
  fastify.delete('/policies/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const deleted = deletePolicy(fastify.db, id);
      if (!deleted) return reply.code(404).send({ error: 'Política no encontrada o no es borrador' });

      const user = getAuthUser(request);
      auditLog(fastify.db, {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'eliminar',
        entidad: 'policies',
        entidad_id: id,
      });

      return { ok: true };
    } catch (err: any) {
      if (err.message.includes('no encontrada')) {
        return reply.code(404).send({ error: err.message });
      }
      return reply.code(400).send({ error: err.message });
    }
  });

  // ===== OBJETIVOS =====
  // GET /policies/:id/objectives
  fastify.get('/policies/:id/objectives', async (request, reply) => {
    const { id } = request.params as { id: string };
    return getObjectives(fastify.db, id);
  });

  // POST /policies/:id/objectives (admin)
  fastify.post('/policies/:id/objectives', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = objectiveSchema.safeParse({ ...(request.body as object), policy_id: id });
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const obj = createObjective(fastify.db, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'objectives',
      entidad_id: obj.id,
      valores_nuevos: parsed.data,
    });

    return obj;
  });

  // PUT /objectives/:oid (admin)
  fastify.put('/objectives/:oid', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { oid } = request.params as { oid: string };
    const parsed = objectiveUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateObjective(fastify.db, oid, parsed.data);
    if (!updated) return reply.code(404).send({ error: 'Objetivo no encontrado' });

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'editar',
      entidad: 'objectives',
      entidad_id: oid,
      valores_nuevos: parsed.data,
    });

    return updated;
  });

  // DELETE /objectives/:oid (admin)
  fastify.delete('/objectives/:oid', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { oid } = request.params as { oid: string };
    deleteObjective(fastify.db, oid);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'eliminar',
      entidad: 'objectives',
      entidad_id: oid,
    });

    return { ok: true };
  });

  // Exportar política a PDF
  fastify.get('/policies/:id/export', async (request, reply) => {
    const { id } = request.params as { id: string };
    const policy = getPolicyById(fastify.db, id);
    if (!policy) return reply.code(404).send({ error: 'Política no encontrada' });
    const objectives = getObjectives(fastify.db, id);

    // Generar PDF simple
    const { PDFDocument, rgb } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();

    const fontSize = 12;
    let y = height - 50;

    const primaryColor = rgb(0, 0.2, 0.6);
    page.drawText('POLÍTICA SG-SST', { x: 50, y, size: 18, color: primaryColor });
    y -= 30;
    page.drawText(`Título: ${policy.titulo}`, { x: 50, y, size: fontSize });
    y -= 20;
    page.drawText(`Versión: ${policy.version}`, { x: 50, y, size: fontSize });
    y -= 20;
    page.drawText(`Estado: ${policy.estado}`, { x: 50, y, size: fontSize });
    y -= 20;
    page.drawText(`Firmado por: ${policy.firmado_por || '—'}`, { x: 50, y, size: fontSize });
    y -= 20;
    page.drawText(`Fecha firma: ${policy.fecha_firma || '—'}`, { x: 50, y, size: fontSize });
    y -= 20;
    page.drawText(`Fecha divulgación: ${policy.fecha_divulgacion || '—'}`, { x: 50, y, size: fontSize });
    y -= 30;

    // Contenido (con saltos de línea simples)
    const lines = policy.contenido.split('\n');
    for (const line of lines) {
      if (y < 60) {
        pdfDoc.addPage([595, 842]);
        y = height - 50;
      }
      page.drawText(line, { x: 50, y, size: fontSize });
      y -= 18;
    }

    y -= 20;
    page.drawText('OBJETIVOS', { x: 50, y, size: 14, color: primaryColor });
    y -= 25;

    for (const obj of objectives) {
      if (y < 60) {
        pdfDoc.addPage([595, 842]);
        y = height - 50;
      }
      page.drawText(`• ${obj.descripcion} (${obj.tipo}) - ${obj.estado}`, { x: 60, y, size: fontSize });
      y -= 18;
      if (obj.meta) {
        page.drawText(`  Meta: ${obj.meta}`, { x: 70, y, size: fontSize - 1 });
        y -= 16;
      }
      if (obj.responsable) {
        page.drawText(`  Responsable: ${obj.responsable}`, { x: 70, y, size: fontSize - 1 });
        y -= 16;
      }
      if (obj.fecha_limite) {
        page.drawText(`  Fecha límite: ${obj.fecha_limite}`, { x: 70, y, size: fontSize - 1 });
        y -= 16;
      }
      y -= 8;
    }

    const pdfBytes = await pdfDoc.save();
    reply.type('application/pdf');
    reply.header('Content-Disposition', `attachment; filename=politica_${policy.titulo.replace(/\s+/g, '_')}.pdf`);
    return Buffer.from(pdfBytes);
  });
};

export default policiesRoutes;