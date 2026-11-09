import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  createHazardAssessment,
  createHazardCatalogItem,
  deleteHazardAssessment,
  getHazardAssessments,
  getHazardCatalog,
  getHazardCatalogByCategory,
  updateHazardAssessment,
} from '../services/hazards.js';
import { requireRole, getAuthUser, auditLog } from '../lib/auth.js';

const catSchema = z.object({
  codigo: z.string().min(2),
  nombre: z.string().min(2),
  categoria: z.enum([
    'alturas',
    'electrico',
    'herramientas',
    'escaleras',
    'ergonomia',
    'conduccion',
    'cielos_rasos',
    'confinados',
    'locativo',
    'otro',
  ]),
  descripcion: z.string().optional(),
  riesgo_por_defecto: z.enum(['bajo', 'medio', 'alto', 'critico']).default('medio'),
  control_sugerido: z.string().optional(),
});
const assessSchema = z.object({
  cargo_oficio: z.string().min(2),
  area: z.string().optional(),
  peligro_id: z.string().optional().nullable(),
  peligro_texto: z.string().optional().nullable(),
  tarea: z.string().optional(),
  consecuencia: z.string().optional(),
  probabilidad: z.string().optional(),
  valoracion_riesgo: z.enum(['bajo', 'medio', 'alto', 'critico']).default('medio'),
  controles: z.string().optional(),
  responsable: z.string().optional(),
  fecha: z.string().optional(),
  revisado_en: z.string().optional().nullable(),
  estado: z.enum(['vigente', 'revisado', 'obsoleto']).default('vigente'),
});

const categoryParamSchema = z.enum([
  'alturas',
  'electrico',
  'herramientas',
  'escaleras',
  'ergonomia',
  'conduccion',
  'cielos_rasos',
  'confinados',
  'locativo',
  'otro',
]);

const hazardsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /hazards/catalog - Cualquier autenticado
  fastify.get('/hazards/catalog', async (request, reply) => {
    const { categoria } = request.query as { categoria?: string };
    if (categoria && categoryParamSchema.safeParse(categoria).success) {
      return getHazardCatalogByCategory(fastify.db, categoria as any);
    }
    return getHazardCatalog(fastify.db);
  });

  // GET /hazards/assessments - Cualquier autenticado
  fastify.get('/hazards/assessments', async (request, reply) => {
    return getHazardAssessments(fastify.db);
  });

  // POST /hazards/catalog - Solo administrador
  fastify.post('/hazards/catalog', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const parsed = catSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const item = createHazardCatalogItem(fastify.db, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'hazard_catalog',
      entidad_id: item.id,
      valores_nuevos: parsed.data,
    });

    return item;
  });

  // POST /hazards/assessments - Solo administrador
  fastify.post('/hazards/assessments', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const parsed = assessSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const a = createHazardAssessment(fastify.db, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'crear',
      entidad: 'hazard_assessments',
      entidad_id: a.id,
      valores_nuevos: parsed.data,
    });

    return a;
  });

  // PUT /hazards/assessments/:id - Solo administrador
  fastify.put('/hazards/assessments/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = assessSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateHazardAssessment(fastify.db, id, parsed.data);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'editar',
      entidad: 'hazard_assessments',
      entidad_id: id,
      valores_nuevos: parsed.data,
    });

    return updated;
  });

  // DELETE /hazards/assessments/:id - Solo administrador
  fastify.delete('/hazards/assessments/:id', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    deleteHazardAssessment(fastify.db, id);

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'eliminar',
      entidad: 'hazard_assessments',
      entidad_id: id,
    });

    return { ok: true };
  });
};

export default hazardsRoutes;