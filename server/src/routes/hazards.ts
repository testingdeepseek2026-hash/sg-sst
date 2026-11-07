import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getHazardCatalog, getHazardCatalogByCategory, createHazardCatalogItem, getHazardAssessments, createHazardAssessment, updateHazardAssessment, deleteHazardAssessment } from '../services/hazards.js';
import * as UsersService from '../services/users.js';

const catSchema = z.object({
  codigo: z.string().min(2), nombre: z.string().min(2),
  categoria: z.enum(['alturas','electrico','herramientas','escaleras','ergonomia','conduccion','cielos_rasos','confinados','locativo','otro']),
  descripcion: z.string().optional(), riesgo_por_defecto: z.enum(['bajo','medio','alto','critico']).default('medio'),
  control_sugerido: z.string().optional()
});
const assessSchema = z.object({
  cargo_oficio: z.string().min(2), area: z.string().optional(), peligro_id: z.string().optional().nullable(),
  peligro_texto: z.string().optional().nullable(), tarea: z.string().optional(), consecuencia: z.string().optional(),
  probabilidad: z.string().optional(), valoracion_riesgo: z.enum(['bajo','medio','alto','critico']).default('medio'),
  controles: z.string().optional(), responsable: z.string().optional(), fecha: z.string().optional(),
  revisado_en: z.string().optional().nullable(), estado: z.enum(['vigente','revisado','obsoleto']).default('vigente')
});

const categoryParamSchema = z.enum(['alturas','electrico','herramientas','escaleras','ergonomia','conduccion','cielos_rasos','confinados','locativo','otro']);

const hazardsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/hazards/catalog', async (request) => {
    const { categoria } = request.query as { categoria?: string };
    if (categoria && categoryParamSchema.safeParse(categoria).success) {
      return getHazardCatalogByCategory(fastify.db, categoria as any);
    }
    return getHazardCatalog(fastify.db);
  });
  
  fastify.post('/hazards/catalog', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = catSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const item = createHazardCatalogItem(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'crear', entidad: 'hazard_catalog', entidad_id: item.id, valores_nuevos: parsed.data });
    return item;
  });
  
  fastify.get('/hazards/assessments', async () => getHazardAssessments(fastify.db));
  
  fastify.post('/hazards/assessments', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = assessSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const a = createHazardAssessment(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'crear', entidad: 'hazard_assessments', entidad_id: a.id, valores_nuevos: parsed.data });
    return a;
  });
  
  fastify.put('/hazards/assessments/:id', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const parsed = assessSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateHazardAssessment(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'editar', entidad: 'hazard_assessments', entidad_id: id, valores_nuevos: parsed.data });
    return updated;
  });
  
  fastify.delete('/hazards/assessments/:id', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    deleteHazardAssessment(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'eliminar', entidad: 'hazard_assessments', entidad_id: (request.params as any).id });
    return { ok: true };
  });
};

export default hazardsRoutes;