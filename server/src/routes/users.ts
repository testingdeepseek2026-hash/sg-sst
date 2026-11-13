import { createHash } from 'node:crypto';

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { isPgBackend, one } from '../lib/db-pg.js';
import * as UsersService from '../services/users.js';
import * as PgUsersService from '../services/users.pg.js';

import type { User } from '../services/users.js';

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
    const existing = isPgBackend()
      ? await one<{ c: number }>('SELECT COUNT(*)::int AS c FROM users')
      : (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number });
    if ((existing?.c ?? 0) > 0) {
      return reply.code(403).send({ error: 'Ya existe al menos un usuario. Use login.' });
    }
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { email, password, nombre, rol } = parsed.data;
    const password_hash = createHash('sha256').update(password).digest('hex');
    let user: User;
    if (isPgBackend()) {
      const registration = await PgUsersService.registerFirstUserPg({
        email,
        password_hash,
        nombre,
        rol,
      });
      if (registration.status === 'already_registered') {
        return reply.code(403).send({ error: 'Ya existe al menos un usuario. Use login.' });
      }
      if (registration.status === 'duplicate_email') {
        return reply.code(409).send({ error: 'El correo ya está registrado' });
      }
      user = registration.user;
    } else {
      if (UsersService.getUserByEmail(db, email)) {
        return reply.code(409).send({ error: 'El correo ya está registrado' });
      }
      user = UsersService.createUser(db, { email, password_hash, nombre, rol });
      UsersService.auditLog(db, {
        usuario_id: user.id,
        usuario_email: email,
        accion: 'crear',
        entidad: 'users',
        entidad_id: user.id,
        valores_nuevos: { email, nombre, rol },
      });
    }
    return { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol };
  });

  fastify.post('/users/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { email, password } = parsed.data;
    const user = isPgBackend()
      ? await PgUsersService.getUserByEmailPg(email)
      : UsersService.getUserByEmail(fastify.db, email);
    if (!user) return reply.code(401).send({ error: 'Credenciales invalidas' });
    const hash = createHash('sha256').update(password).digest('hex');
    if (hash !== (user as any).password_hash)
      return reply.code(401).send({ error: 'Credenciales invalidas' });
    const cookieOptions = {
      path: '/',
      httpOnly: true,
      sameSite: 'lax' as const,
      // Solo bajo HTTPS (despliegue local con Caddy). Mantener false en desarrollo HTTP.
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 7 * 24 * 60 * 60,
    };
    reply.setCookie('sg_sst_user', user.id, cookieOptions);
    reply.setCookie('sg_sst_email', user.email, cookieOptions);
    const logEntry = {
      usuario_id: user.id,
      usuario_email: email,
      accion: 'login',
      entidad: 'users',
      entidad_id: user.id,
    };
    if (isPgBackend()) await PgUsersService.auditLogPg(logEntry);
    else UsersService.auditLog(fastify.db, logEntry);
    return { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol };
  });

  fastify.post('/users/logout', async (request, reply) => {
    const user = request.user;
    if (user) {
      const logEntry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'logout',
        entidad: 'users',
        entidad_id: user.id,
      };
      if (isPgBackend()) await PgUsersService.auditLogPg(logEntry);
      else UsersService.auditLog(fastify.db, logEntry);
    }
    reply.clearCookie('sg_sst_user', { path: '/' });
    reply.clearCookie('sg_sst_email', { path: '/' });
    return { ok: true };
  });

  fastify.get('/users/me', async (request, reply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'No autenticado' });
    return user;
  });

  // CRUD usuarios (solo administrador)
  fastify.get('/users', async (request, reply) => {
    const user = request.user;
    if (!user || user.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const users = isPgBackend()
      ? await PgUsersService.getAllUsersPg()
      : UsersService.getAllUsers(fastify.db);
    return users.map(({ password_hash: _password_hash, ...u }) => u);
  });

  fastify.put('/users/:id', async (request, reply) => {
    const user = request.user;
    if (!user || user.rol !== 'administrador')
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
    const prev = isPgBackend()
      ? await PgUsersService.getUserByIdPg(id)
      : UsersService.getUserById(fastify.db, id);
    if (!prev) return reply.code(404).send({ error: 'Usuario no encontrado' });
    const updated = isPgBackend()
      ? await PgUsersService.updateUserPg(id, patch.data)
      : UsersService.updateUser(fastify.db, id, patch.data);
    if (!updated) return reply.code(404).send({ error: 'Usuario no encontrado' });
    const { password_hash: _previous_password_hash, ...previousUser } = prev;
    const logEntry = {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'editar',
      entidad: 'users',
      entidad_id: id,
      valores_anteriores: previousUser,
      valores_nuevos: patch.data,
    };
    if (isPgBackend()) await PgUsersService.auditLogPg(logEntry);
    else UsersService.auditLog(fastify.db, logEntry);
    const { password_hash: _password_hash, ...u } = updated;
    return u;
  });
  fastify.delete('/users/:id', async (request, reply) => {
    const user = request.user;
    if (!user || user.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    if (id === user.id) return reply.code(400).send({ error: 'No puede eliminarse a sí mismo' });
    if (isPgBackend()) await PgUsersService.deleteUserPg(id);
    else UsersService.deleteUser(fastify.db, id);
    const logEntry = {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'eliminar',
      entidad: 'users',
      entidad_id: id,
    };
    if (isPgBackend()) await PgUsersService.auditLogPg(logEntry);
    else UsersService.auditLog(fastify.db, logEntry);
    return { ok: true };
  });
};

export default usersRoutes;
