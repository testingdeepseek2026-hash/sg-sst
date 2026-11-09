import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { estandarSetPorRiesgo, getCompany, upsertCompany } from '../services/companies.js';
import * as UsersService from '../services/users.js';

const companySchema = z.object({
  razon_social: z.string().min(2),
  nit: z.string().min(3),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional(),
  clase_riesgo: z.enum(['I', 'II', 'III', 'IV', 'V']),
  estandar_set: z.enum(['7', '21', '32']).optional(),
  sector: z.string().optional(),
  actividad_economica: z.string().optional(),
  numero_trabajadores: z.number().int().min(1).max(50).optional(),
  tiene_vigia_sst: z.boolean().optional(),
  tiene_copasst: z.boolean().optional(),
  tiene_comite_convivencia: z.boolean().optional(),
  tiene_brigada: z.boolean().optional(),
  canal_alertas: z.enum(['email', 'whatsapp', 'app']).optional(),
  // SMTP config
  smtp_host: z.string().optional(),
  smtp_port: z.number().int().positive().optional(),
  smtp_user: z.string().email().optional(),
  smtp_pass: z.string().optional(),
  smtp_from: z.string().optional(),
  alerts_enabled: z.boolean().optional(),
});

const companiesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/companies', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me) return reply.code(401).send({ error: 'No autenticado' });
    const company = getCompany(fastify.db);
    if (!company) return reply.code(404).send({ error: 'Empresa no configurada' });
    return company;
  });

  fastify.post('/companies', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = companySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const data = parsed.data;
    if (!data.estandar_set) data.estandar_set = estandarSetPorRiesgo(data.clase_riesgo);
    const company = upsertCompany(fastify.db, data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'editar',
      entidad: 'companies',
      entidad_id: company.id,
      valores_nuevos: { clase_riesgo: data.clase_riesgo, estandar_set: data.estandar_set },
    });
    return company;
  });
};

export default companiesRoutes;
