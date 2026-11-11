import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { getAuthUser, requireRole } from '../lib/auth.js';
import { estandarSetPorRiesgo, getCompany, upsertCompany } from '../services/companies.js';

const companySchema = z.object({
  razon_social: z.string().min(2),
  nit: z.string().min(3),
  direccion: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  clase_riesgo: z.enum(['I', 'II', 'III', 'IV', 'V']),
  estandar_set: z.enum(['7', '21', '32']).optional(),
  sector: z.string().optional().nullable(),
  actividad_economica: z.string().optional().nullable(),
  numero_trabajadores: z.number().int().min(1).max(50).optional(),
  tiene_vigia_sst: z.preprocess(
    (v) => (typeof v === 'number' ? v === 1 : v),
    z.boolean().optional()
  ),
  tiene_copasst: z.preprocess((v) => (typeof v === 'number' ? v === 1 : v), z.boolean().optional()),
  tiene_comite_convivencia: z.preprocess(
    (v) => (typeof v === 'number' ? v === 1 : v),
    z.boolean().optional()
  ),
  tiene_brigada: z.preprocess((v) => (typeof v === 'number' ? v === 1 : v), z.boolean().optional()),
  canal_alertas: z.enum(['email', 'whatsapp', 'app']).optional(),
  // SMTP config
  smtp_host: z.string().optional().nullable(),
  smtp_port: z.number().int().positive().optional().nullable(),
  smtp_user: z.string().email().optional().nullable().or(z.literal('')),
  smtp_pass: z.string().optional().nullable(),
  smtp_from: z.string().optional().nullable(),
  alerts_enabled: z.preprocess(
    (v) => (typeof v === 'number' ? v === 1 : v),
    z.boolean().optional()
  ),
});

const companiesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /companies - Cualquier autenticado (admin o trabajador)
  fastify.get('/companies', async (request, reply) => {
    const company = getCompany(fastify.db);
    if (!company) return reply.code(404).send({ error: 'Empresa no configurada' });
    return company;
  });

  // POST /companies - Solo administrador
  fastify.post(
    '/companies',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const parsed = companySchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const data = parsed.data;
      if (!data.estandar_set) data.estandar_set = estandarSetPorRiesgo(data.clase_riesgo);
      const company = upsertCompany(fastify.db, data);

      const user = getAuthUser(request);
      // auditLog se llama desde el service o aquí; por consistencia lo mantenemos en el handler
      // Pero como upsertCompany no lo hace, lo hacemos aquí:
      const { auditLog } = await import('../services/users.js');
      auditLog(fastify.db, {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'editar',
        entidad: 'companies',
        entidad_id: company.id,
        valores_nuevos: { clase_riesgo: data.clase_riesgo, estandar_set: data.estandar_set },
      });

      return company;
    }
  );
};

export default companiesRoutes;
