import { FastifyPluginAsync } from 'fastify';

import { auditLog, getAuthUser, requireRole } from '../lib/auth.js';
import { isPgBackend } from '../lib/db-pg.js';
import {
  getPgBackupConfigFromEnv,
  listPgBackups,
  restorePgBackup,
  validatePgBackup,
} from '../services/backup.pg.js';
import {
  getRestoreConfigFromEnv,
  listBackups,
  restoreBackup,
  validateBackup,
} from '../services/restore.js';
import { auditLogPg } from '../services/users.pg.js';

const restoreRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /restore/backups - Listar backups disponibles (solo admin)
  fastify.get(
    '/restore/backups',
    { preHandler: requireRole('administrador') },
    async (_request, _reply) => {
      const backups = isPgBackend()
        ? listPgBackups(getPgBackupConfigFromEnv())
        : listBackups(getRestoreConfigFromEnv());
      return { backups };
    }
  );

  // GET /restore/backups/:file/validate - Validar backup sin restaurar (solo admin)
  fastify.get(
    '/restore/backups/:file/validate',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { file } = request.params as { file: string };
      const result = isPgBackend()
        ? validatePgBackup(getPgBackupConfigFromEnv(), file)
        : validateBackup(getRestoreConfigFromEnv(), file);
      if (!result.success) {
        return reply.code(400).send({ error: result.error });
      }
      return { valid: true, manifest: result.manifest };
    }
  );

  // POST /restore/backups/:file - Restaurar backup (solo admin)
  // ADVERTENCIA: Requiere servidor detenido en producción
  fastify.post(
    '/restore/backups/:file',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { file } = request.params as { file: string };

      // Validar primero
      const validation = isPgBackend()
        ? validatePgBackup(getPgBackupConfigFromEnv(), file)
        : validateBackup(getRestoreConfigFromEnv(), file);
      if (!validation.success) {
        return reply.code(400).send({ error: validation.error });
      }

      // En producción, verificar que el servidor no esté atendiendo requests
      // Para desarrollo, permitir pero advertir
      if (process.env.NODE_ENV === 'production') {
        return reply.code(400).send({
          error:
            'En producción, el servidor debe estar detenido antes de restaurar. Use script CLI.',
        });
      }

      const result = isPgBackend()
        ? await restorePgBackup(getPgBackupConfigFromEnv(), file)
        : restoreBackup(getRestoreConfigFromEnv(), file);
      if (!result.success) {
        return reply.code(500).send({ error: result.error });
      }

      const user = getAuthUser(request);
      const entry = {
        usuario_id: user.id,
        usuario_email: user.email,
        accion: 'restaurar_backup',
        entidad: 'system',
        valores_nuevos: { backup_file: file, manifest: validation.manifest },
      };
      if (isPgBackend()) await auditLogPg(entry);
      else auditLog(fastify.db, entry);

      return { success: true, message: 'Restauración completada. Reinicie el servidor.' };
    }
  );
};

export default restoreRoutes;
