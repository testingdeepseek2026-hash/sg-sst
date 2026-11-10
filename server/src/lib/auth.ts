/**
 * Middleware de Autorización Centralizado (RBAC)
 * SG-SST - Fase 4: Privacidad, permisos, trazabilidad
 *
 * Uso:
 *   fastify.addHook('preHandler', requireAuth)                    // Solo autenticado
 *   fastify.addHook('preHandler', requireRole('administrador'))  // Solo admin
 *   fastify.addHook('preHandler', requireRole('administrador', 'trabajador')) // Admin o trabajador
 *   // O por ruta individual:
 *   fastify.get('/ruta', { preHandler: requireRole('administrador') }, handler)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import * as UsersService from '../services/users.js';

// Re-export auditLog para uso consistente en routes
export const auditLog = UsersService.auditLog;

// ============================================================
// Tipos y utilidades
// ============================================================

export type UserRole = 'administrador' | 'trabajador';

export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
  rol: UserRole;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;  // Usuario autenticado completo (para usar en handlers)
  }
}

/**
 * Extrae y valida usuario desde cookie de sesión
 * Pone `request.user` si válido, sino responde 401
 * Idempotente: si request.user ya existe, no repite la búsqueda
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Health check: disponible sin autenticación para monitoreo/load balancer
  if (request.url === '/api/health') return;

  // Idempotente: si ya hay usuario (ej. hook global previo), no repetir
  if (request.user) return;

  const uid = request.cookies['sg_sst_user'] as string | undefined;
  if (!uid) {
    return reply.code(401).send({ error: 'No autenticado' });
  }

  const db = request.server.db;
  const user = UsersService.getUserById(db, uid);
  if (!user) {
    return reply.code(401).send({ error: 'Sesión inválida' });
  }

  // Adjuntar usuario tipado al request para uso en handlers
  request.user = {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
  };
}

/**
 * Crea hook que requiere uno de los roles permitidos
 * Uso: fastify.addHook('preHandler', requireRole('administrador'))
 *      fastify.get('/ruta', { preHandler: requireRole('administrador') }, handler)
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async function roleHook(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    // Primero asegurar autenticación
    await requireAuth(request, reply);
    if (reply.sent) return;

    const user = request.user!;
    if (!allowedRoles.includes(user.rol)) {
      return reply.code(403).send({
        error: `Acceso denegado. Requiere rol: ${allowedRoles.join(' o ')}`,
      });
    }
  };
}

/**
 * Hook para rutas donde el trabajador accede SOLO a sus propios datos
 * Valida que el recurso pertenezca al usuario autenticado
 * Uso: fastify.get('/workers/:id', { preHandler: requireOwnership('worker_id', 'id') }, handler)
 */
export function requireOwnership(
  userIdParam: string,      // Nombre del campo en request.user.id que identifica al dueño (ej: 'worker_id' en BD)
  routeParam: string        // Nombre del parámetro de ruta (ej: 'id' para /workers/:id)
) {
  return async function ownershipHook(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const user = request.user!;
    const params = request.params as Record<string, string>;
    const resourceId = params[routeParam];

    // Admin puede acceder a todo
    if (user.rol === 'administrador') return;

    // Trabajador: validar que el recurso le pertenece
    // NOTA: Esto asume que el trabajador tiene un user.id que coincide con worker.id
    // Si no es así, el service debe validar ownership.
    // Validación genérica: si el parámetro de ruta coincide con user.id, permitir
    if (resourceId === user.id) return;

    return reply.code(403).send({ error: 'No autorizado para acceder a este recurso' });
  };
}

/**
 * Helper para handlers: obtener usuario autenticado tipado
 * Lanza si no autenticado (debe usarse tras requireAuth)
 */
export function getAuthUser(request: FastifyRequest): AuthUser {
  if (!request.user) {
    throw new Error('Usuario no autenticado - falta hook requireAuth');
  }
  return request.user;
}

/**
 * Helper: verificar si usuario es admin
 */
export function isAdmin(request: FastifyRequest): boolean {
  return request.user?.rol === 'administrador';
}

/**
 * Helper: verificar ownership genérico (admin pasa, trabajador solo si coincide)
 */
export function checkOwnership(request: FastifyRequest, resourceUserId: string): boolean {
  if (!request.user) return false;
  if (request.user.rol === 'administrador') return true;
  return request.user.id === resourceUserId;
}

/**
 * Matriz de permisos por recurso y acción
 * Centraliza la lógica de "quién puede hacer qué"
 */
export const PERMISSIONS: Record<string, Record<string, UserRole[]>> = {
  // Recurso: { accion: [roles permitidos] }
  companies: {
    read: ['administrador', 'trabajador'],
    write: ['administrador'],
  },
  users: {
    read: ['administrador'],
    write: ['administrador'],
  },
  roles: {
    read: ['administrador', 'trabajador'],
    write: ['administrador'],
  },
  workers: {
    read: ['administrador', 'trabajador'], // Trabajador ve su ficha (validar ownership en service)
    write: ['administrador'],
  },
  worker_exams: {
    read: ['administrador'], // Datos médicos: solo admin (trabajador ve solo resumen vía endpoint dedicado)
    write: ['administrador'],
  },
  worker_certs: {
    read: ['administrador', 'trabajador'],
    write: ['administrador'],
  },
  worker_epp: {
    read: ['administrador', 'trabajador'],
    write: ['administrador'],
    sign: ['administrador', 'trabajador'], // Trabajador firma su propia entrega
  },
  hazards: {
    read: ['administrador', 'trabajador'],
    write: ['administrador'],
  },
  standards: {
    read: ['administrador', 'trabajador'],
    write: ['administrador'],
  },
  plans: {
    read: ['administrador', 'trabajador'],
    write: ['administrador'],
  },
  indicators: {
    read: ['administrador', 'trabajador'],
    write: ['administrador'],
  },
  incidents: {
    read: ['administrador'], // Trabajador reporta vía endpoint dedicado
    write: ['administrador'],
  },
  inspections: {
    read: ['administrador', 'trabajador'],
    write: ['administrador'],
  },
  altura_permits: {
    read: ['administrador', 'trabajador'],
    write: ['administrador'],
  },
  documents: {
    read: ['administrador', 'trabajador'], // Trabajador ve solo vigentes
    write: ['administrador'],
  },
  corrective_actions: {
    read: ['administrador', 'trabajador'],
    write: ['administrador'],
  },
  audits: {
    read: ['administrador'],
    write: ['administrador'],
  },
  audit_findings: {
    read: ['administrador'],
    write: ['administrador'],
  },
  alerts: {
    read: ['administrador'],
    write: ['administrador'],
  },
  contractors: {
    read: ['administrador'],
    write: ['administrador'],
  },
  emergency_plans: {
    read: ['administrador', 'trabajador'],
    write: ['administrador'],
  },
  uploads: {
    read: ['administrador', 'trabajador'],
    write: ['administrador'],
  },
};

/**
 * Verifica permiso según matriz
 */
export function hasPermission(
  resource: keyof typeof PERMISSIONS,
  action: 'read' | 'write' | 'sign',
  role: UserRole
): boolean {
  const resourcePerms = PERMISSIONS[resource];
  if (!resourcePerms) return false;
  const allowed = resourcePerms[action];
  if (!allowed) return false;
  return allowed.includes(role);
}

export default {
  requireAuth,
  requireRole,
  requireOwnership,
  getAuthUser,
  isAdmin,
  checkOwnership,
  hasPermission,
  PERMISSIONS,
};