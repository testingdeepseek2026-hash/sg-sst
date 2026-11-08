import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  createAlturaPermit,
  createATS,
  createInspection,
  deleteAlturaPermit,
  deleteATS,
  deleteInspection,
  getAlturaPermits,
  getATS,
  getInspectionById,
  getInspections,
  updateAlturaPermit,
  updateInspection,
} from '../services/inspections.js';
import * as UsersService from '../services/users.js';

const inspSchema = z.object({
  tipo: z.enum([
    'herramientas',
    'epp',
    'escaleras',
    'arneses',
    'vehiculo',
    'botiquin',
    'extintores',
    'puesto_trabajo',
    'obra',
  ]),
  fecha: z.string(),
  lugar: z.string().optional(),
  responsable: z.string().optional(),
  estado: z.enum(['pendiente', 'aprobada', 'observaciones', 'rechazada']).default('pendiente'),
  resultado_json: z.string().optional(),
  observaciones: z.string().optional(),
  firmado_por: z.string().optional(),
  firma_url: z.string().optional(),
  archivo_fotos: z.string().optional(),
});

const inspectionsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/inspections', async () => getInspections(fastify.db));
  fastify.get('/inspections/:id', async (request, reply) => {
    const insp = getInspectionById(fastify.db, (request.params as any).id);
    if (!insp) return reply.code(404).send({ error: 'Inspección no encontrada' });
    return insp;
  });
  fastify.post('/inspections', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = inspSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const insp = createInspection(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'crear',
      entidad: 'inspections',
      entidad_id: insp.id,
      valores_nuevos: parsed.data,
    });
    return insp;
  });
  fastify.put('/inspections/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const parsed = inspSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateInspection(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'editar',
      entidad: 'inspections',
      entidad_id: id,
      valores_nuevos: parsed.data,
    });
    return updated;
  });
  fastify.delete('/inspections/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    deleteInspection(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'eliminar',
      entidad: 'inspections',
      entidad_id: (request.params as any).id,
    });
    return { ok: true };
  });
};

const alturaSchema = z.object({
  obra: z.string().min(2),
  fecha: z.string(),
  hora_inicio: z.string().optional(),
  hora_fin: z.string().optional(),
  solicitante: z.string().optional(),
  responsable_seguridad: z.string().optional(),
  sistema_proteccion: z.string().optional(),
  equipo_verificado: z.boolean().default(false),
  apto_medico: z.boolean().default(false),
  certificado_alturas: z.boolean().default(false),
  estado: z.enum(['pendiente', 'autorizado', 'rechazado', 'cerrado']).default('pendiente'),
  at_s_id: z.string().optional().nullable(),
});

const alturaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/altura/permits', async () => getAlturaPermits(fastify.db));
  fastify.post('/altura/permits', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = alturaSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const p = createAlturaPermit(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'crear',
      entidad: 'altura_permits',
      entidad_id: p.id,
      valores_nuevos: parsed.data,
    });
    return p;
  });
  fastify.put('/altura/permits/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const parsed = alturaSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = updateAlturaPermit(fastify.db, id, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'editar',
      entidad: 'altura_permits',
      entidad_id: id,
      valores_nuevos: parsed.data,
    });
    return updated;
  });
  fastify.delete('/altura/permits/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    deleteAlturaPermit(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'eliminar',
      entidad: 'altura_permits',
      entidad_id: (request.params as any).id,
    });
    return { ok: true };
  });
  fastify.get('/altura/ats', async () => getATS(fastify.db));
  fastify.post('/altura/ats', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const parsed = z
      .object({
        obra: z.string().min(2),
        tarea: z.string().min(2),
        peligro: z.string().optional(),
        control: z.string().optional(),
        responsable: z.string().optional(),
        fecha: z.string().optional(),
        estado: z.enum(['vigente', 'cerrado']).default('vigente'),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const a = createATS(fastify.db, parsed.data);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'crear',
      entidad: 'ats',
      entidad_id: a.id,
      valores_nuevos: parsed.data,
    });
    return a;
  });
  fastify.delete('/altura/ats/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    deleteATS(fastify.db, (request.params as any).id);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'eliminar',
      entidad: 'ats',
      entidad_id: (request.params as any).id,
    });
    return { ok: true };
  });
};

export default inspectionsRoutes;
export { alturaRoutes };
