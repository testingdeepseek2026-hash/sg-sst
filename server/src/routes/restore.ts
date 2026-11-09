import { FastifyPluginAsync } from 'fastify';

import { listBackups, restoreBackup, validateBackup, getRestoreConfigFromEnv } from '../services/restore.js';
import { requireRole, getAuthUser, auditLog } from '../lib/auth.js';

const restoreRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /restore/backups - Listar backups disponibles (solo admin)
  fastify.get('/restore/backups', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const config = getRestoreConfigFromEnv();
    const backups = listBackups(config);
    return { backups };
  });

  // GET /restore/backups/:file/validate - Validar backup sin restaurar (solo admin)
  fastify.get('/restore/backups/:file/validate', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const config = getRestoreConfigFromEnv();
    const { file } = request.params as { file: string };
    const result = validateBackup(config, file);
    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }
    return { valid: true, manifest: result.manifest };
  });

  // POST /restore/backups/:file - Restaurar backup (solo admin)
  // ADVERTENCIA: Requiere servidor detenido en producción
  fastify.post('/restore/backups/:file', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const config = getRestoreConfigFromEnv();
    const { file } = request.params as { file: string };

    // Validar primero
    const validation = validateBackup(config, file);
    if (!validation.success) {
      return reply.code(400).send({ error: validation.error });
    }

    // En producción, verificar que el servidor no esté atendiendo requests
    // Para desarrollo, permitir pero advertir
    if (process.env.NODE_ENV === 'production') {
      return reply.code(400).send({
        error: 'En producción, el servidor debe estar detenido antes de restaurar. Use script CLI.',
      });
    }

    const result = restoreBackup(config, file);
    if (!result.success) {
      return reply.code(500).send({ error: result.error });
    }

    const user = getAuthUser(request);
    auditLog(fastify.db, {
      usuario_id: user.id,
      usuario_email: user.email,
      accion: 'restaurar_backup',
      entidad: 'system',
      valores_nuevos: { backup_file: file, manifest: validation.manifest },
    });

    return { success: true, message: 'Restauración completada. Reinicie el servidor.' };
  });
};

export default restoreRoutes;