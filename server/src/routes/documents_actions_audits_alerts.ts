import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getDocuments, getDocumentById, createDocument, updateDocument, deleteDocument } from '../services/documents.js';
import { getCorrectiveActions, createCorrectiveAction, updateCorrectiveAction, deleteCorrectiveAction } from '../services/actions.js';
import { getAudits, createAudit, updateAudit, deleteAudit } from '../services/audits_alerts.js';
import * as UsersService from '../services/users.js';

const docSchema = z.object({
  codigo: z.string().min(2), nombre: z.string().min(2), version: z.string().default('1.0'),
  tipo: z.string(), archivo_url: z.string().optional(), fecha_emision: z.string().optional(),
  fecha_revision: z.string().optional().nullable(), retencion_anos: z.number().int().positive().default(5),
  responsable: z.string().optional(), estado: z.enum(['vigente','obsoleto','en_revision']).default('vigente')
});

const documentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/documents', async () => getDocuments(fastify.db));
  fastify.get('/documents/:id', async (request, reply) => {
    const d = getDocumentById(fastify.db, (request.params as any).id);
    if (!d) return reply.code(404).send({ error: 'Documento no encontrado' });
    return d;
  });
  fastify.post('/documents', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = docSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = createDocument(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'crear', entidad: 'documents', entidad_id: d.id, valores_nuevos: parsed.data });
    return d;
  });
  fastify.put('/documents/:id', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const parsed = docSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateDocument(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'editar', entidad: 'documents', entidad_id: id, valores_nuevos: parsed.data });
    return updated;
  });
  fastify.delete('/documents/:id', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    deleteDocument(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'eliminar', entidad: 'documents', entidad_id: (request.params as any).id });
    return { ok: true };
  });
};

const actionSchema = z.object({
  origen: z.string(), descripcion: z.string().min(2), responsable: z.string().min(2),
  fecha_limite: z.string(), estado: z.enum(['pendiente','en_proceso','completada','vencida']).default('pendiente'),
  prioridad: z.enum(['baja','media','alta','critica']).default('media')
});

const actionsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/actions', async () => getCorrectiveActions(fastify.db));
  fastify.post('/actions', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = actionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const a = createCorrectiveAction(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'crear', entidad: 'corrective_actions', entidad_id: a.id, valores_nuevos: parsed.data });
    return a;
  });
  fastify.put('/actions/:id', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const parsed = actionSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateCorrectiveAction(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'editar', entidad: 'corrective_actions', entidad_id: id, valores_nuevos: parsed.data });
    return updated;
  });
  fastify.delete('/actions/:id', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    deleteCorrectiveAction(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'eliminar', entidad: 'corrective_actions', entidad_id: (request.params as any).id });
    return { ok: true };
  });
};

const auditSchema = z.object({
  anio: z.number().int(), tipo: z.enum(['interna','direccion']), fecha: z.string(),
  auditor: z.string().optional(), alcance: z.string().optional(), hallazgos: z.string().optional(),
  conclusiones: z.string().optional(), compromisos: z.string().optional(),
  estado: z.enum(['programada','realizada','cerrada']).default('programada')
});

const auditsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/audits', async () => getAudits(fastify.db));
  fastify.post('/audits', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = auditSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const a = createAudit(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'crear', entidad: 'audits', entidad_id: a.id, valores_nuevos: parsed.data });
    return a;
  });
  fastify.put('/audits/:id', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const parsed = auditSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateAudit(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'editar', entidad: 'audits', entidad_id: id, valores_nuevos: parsed.data });
    return updated;
  });
  fastify.delete('/audits/:id', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    deleteAudit(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'eliminar', entidad: 'audits', entidad_id: (request.params as any).id });
    return { ok: true };
  });
};

export { documentsRoutes, actionsRoutes, auditsRoutes };
