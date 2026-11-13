import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { auditLog, getAuthUser, requireRole } from '../lib/auth.js';
import { isPgBackend } from '../lib/db-pg.js';
import {
  createHazardAssessment,
  createHazardCatalogItem,
  deleteHazardAssessment,
  getHazardAssessments,
  getHazardCatalog,
  getHazardCatalogByCategory,
  updateHazardAssessment,
} from '../services/hazards.js';
import * as PgHazards from '../services/hazards.pg.js';
import { auditLogPg } from '../services/users.pg.js';

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
  fastify.get('/hazards/catalog', async (request, _reply) => {
    const { categoria } = request.query as { categoria?: string };
    const validCategory =
      categoria && categoryParamSchema.safeParse(categoria).success
        ? (categoria as z.infer<typeof categoryParamSchema>)
        : undefined;

    if (isPgBackend()) {
      return validCategory
        ? PgHazards.getHazardCatalogByCategoryPg(validCategory)
        : PgHazards.getHazardCatalogPg();
    }
    return validCategory
      ? getHazardCatalogByCategory(fastify.db, validCategory)
      : getHazardCatalog(fastify.db);
  });

  // GET /hazards/assessments - Cualquier autenticado
  fastify.get('/hazards/assessments', async (_request, _reply) => {
    return isPgBackend() ? PgHazards.getHazardAssessmentsPg() : getHazardAssessments(fastify.db);
  });

  // POST /hazards/catalog - Solo administrador
  fastify.post(
    '/hazards/catalog',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const parsed = catSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const item = isPgBackend()
        ? await PgHazards.createHazardCatalogItemPg(parsed.data)
        : createHazardCatalogItem(fastify.db, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'crear',
        entidad: 'hazard_catalog',
        entidad_id: item.id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return item;
    }
  );

  // POST /hazards/assessments - Solo administrador
  fastify.post(
    '/hazards/assessments',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const parsed = assessSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const assessment = isPgBackend()
        ? await PgHazards.createHazardAssessmentPg(parsed.data)
        : createHazardAssessment(fastify.db, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'crear',
        entidad: 'hazard_assessments',
        entidad_id: assessment.id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return assessment;
    }
  );

  // PUT /hazards/assessments/:id - Solo administrador
  fastify.put(
    '/hazards/assessments/:id',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = assessSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const updated = isPgBackend()
        ? await PgHazards.updateHazardAssessmentPg(id, parsed.data)
        : updateHazardAssessment(fastify.db, id, parsed.data);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'editar',
        entidad: 'hazard_assessments',
        entidad_id: id,
        valores_nuevos: parsed.data,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return updated;
    }
  );

  // DELETE /hazards/assessments/:id - Solo administrador
  fastify.delete(
    '/hazards/assessments/:id',
    { preHandler: requireRole('administrador') },
    async (request, _reply) => {
      const { id } = request.params as { id: string };
      if (isPgBackend()) await PgHazards.deleteHazardAssessmentPg(id);
      else deleteHazardAssessment(fastify.db, id);

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'eliminar',
        entidad: 'hazard_assessments',
        entidad_id: id,
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { ok: true };
    }
  );
};

export default hazardsRoutes;
