import { createHash } from 'node:crypto';

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import * as UsersService from '../services/users.js';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  nombre: z.string().min(2),
  rol: z.enum(['administrador', 'trabajador']),
});

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  // Registro inicial (solo si no hay usuarios)
  fastify.post('/users/register', async (request, reply) => {
    const db = fastify.db;
    const existing = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number };
    if (existing.c > 0) {
      return reply.code(403).send({ error: 'Ya existe al menos un usuario. Use login.' });
    }
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { email, password, nombre, rol } = parsed.data;
    const exists = UsersService.getUserByEmail(db, email);
    if (exists) return reply.code(409).send({ error: 'El correo ya está registrado' });
    const password_hash = createHash('sha256').update(password).digest('hex');
    const user = UsersService.createUser(db, { email, password_hash, nombre, rol });
    UsersService.auditLog(db, {
      usuario_id: user.id,
      usuario_email: email,
      accion: 'crear',
      entidad: 'users',
      entidad_id: user.id,
      valores_nuevos: { email, nombre, rol },
    });
    return { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol };
  });

  fastify.post('/users/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { email, password } = parsed.data;
    const user = UsersService.getUserByEmail(fastify.db, email);
    if (!user) return reply.code(401).send({ error: 'Credenciales invalidas' });
    const hash = createHash('sha256').update(password).digest('hex');
    if (hash !== (user as any).password_hash)
      return reply.code(401).send({ error: 'Credenciales invalidas' });
    reply.setCookie('sg_sst_user', user.id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
    });
    reply.setCookie('sg_sst_email', user.email, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
    });
    UsersService.auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: email,
      accion: 'login',
      entidad: 'users',
      entidad_id: user.id,
    });
    return { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol };
  });

  fastify.post('/users/logout', async (request, reply) => {
    const uid = (request as any).userId;
    const email = (request as any).userEmail;
    if (uid)
      UsersService.auditLog(fastify.db, {
        usuario_id: uid,
        usuario_email: email,
        accion: 'logout',
        entidad: 'users',
        entidad_id: uid,
      });
    reply.clearCookie('sg_sst_user', { path: '/' });
    reply.clearCookie('sg_sst_email', { path: '/' });
    return { ok: true };
  });

  fastify.get('/users/me', async (request, reply) => {
    const uid = (request as any).userId;
    if (!uid) return reply.code(401).send({ error: 'No autenticado' });
    const user = UsersService.getUserById(fastify.db, uid);
    if (!user) return reply.code(404).send({ error: 'Usuario no encontrado' });
    return { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol };
  });

  // CRUD usuarios (solo administrador)
  fastify.get('/users', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    return UsersService.getAllUsers(fastify.db).map(({ password_hash: _password_hash, ...u }) => u);
  });

  fastify.put('/users/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const patch = z
      .object({
        nombre: z.string().optional(),
        rol: z.enum(['administrador', 'trabajador']).optional(),
        email: z.string().email().optional(),
      })
      .safeParse(request.body);
    if (!patch.success) return reply.code(400).send({ error: patch.error.flatten() });
    const prev = UsersService.getUserById(fastify.db, id);
    if (!prev) return reply.code(404).send({ error: 'Usuario no encontrado' });
    const updated = UsersService.updateUser(fastify.db, id, patch.data)!;
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'editar',
      entidad: 'users',
      entidad_id: id,
      valores_anteriores: prev,
      valores_nuevos: patch.data,
    });
    const { password_hash: _password_hash, ...u } = updated;
    return u;
  });

  fastify.delete('/users/:id', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    if (id === uid) return reply.code(400).send({ error: 'No puede eliminarse a sí mismo' });
    UsersService.deleteUser(fastify.db, id);
    UsersService.auditLog(fastify.db, {
      usuario_id: uid,
      usuario_email: me.email,
      accion: 'eliminar',
      entidad: 'users',
      entidad_id: id,
    });
    return { ok: true };
  });
};

export default usersRoutes;
