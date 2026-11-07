import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { getIncidents, getIncidentById, createIncident, updateIncident, deleteIncident } from '../services/incidents.js';
import * as UsersService from '../services/users.js';

const incSchema = z.object({
  tipo: z.enum(['incidente', 'accidente', 'enfermedad_laboral']), fecha_ocurrencia: z.string(),
  fecha_reporte: z.string().optional().nullable(), trabajador_id: z.string().optional().nullable(),
  lugar: z.string().optional(), descripcion: z.string().min(2), lesiones: z.string().optional(),
  causa_raiz: z.string().optional(), acciones_correctivas: z.string().optional(),
  reporte_arl: z.boolean().default(false), reporte_eps: z.boolean().default(false),
  reporte_mintrabajo: z.boolean().default(false), dias_perdidos: z.number().int().nonnegative().default(0),
  estado: z.enum(['abierto','investigando','cerrado']).default('abierto'),
  investigador: z.string().optional(), fecha_cierre: z.string().optional().nullable()
});

const incidentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/incidents', async () => getIncidents(fastify.db));
  fastify.get('/incidents/:id', async (request, reply) => {
    const inc = getIncidentById(fastify.db, (request.params as any).id);
    if (!inc) return reply.code(404).send({ error: 'Incidente no encontrado' });
    return inc;
  });
  fastify.post('/incidents', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = incSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const inc = createIncident(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'crear', entidad: 'incidents', entidad_id: inc.id, valores_nuevos: parsed.data });
    return inc;
  });
  fastify.put('/incidents/:id', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const parsed = incSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateIncident(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'editar', entidad: 'incidents', entidad_id: id, valores_nuevos: parsed.data });
    return updated;
  });
  fastify.delete('/incidents/:id', async (request, reply) => {
    const uid = (request as any).userId; const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    deleteIncident(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, { usuario_id: uid, usuario_email: me.email, accion: 'eliminar', entidad: 'incidents', entidad_id: (request.params as any).id });
    return { ok: true };
  });
};

export default incidentsRoutes;
