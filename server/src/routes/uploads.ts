import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { FastifyPluginAsync } from 'fastify';

import { auditLog, getAuthUser, requireRole } from '../lib/auth.js';
import { genId } from '../lib/utils.js';
import { saveUploadedFile } from '../services/uploads.js';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

const uploadsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/uploads - Subir archivo (imagen, PDF, etc.) - Solo administrador
  fastify.post('/uploads', { preHandler: requireRole('administrador') }, async (request, reply) => {
    const parts = await request.files();
    const files = Array.isArray(parts) ? parts : [parts];
    if (!files.length) return reply.code(400).send({ error: 'No se envió archivo' });

    const results = [];
    for (const file of files) {
      try {
        const result = await saveUploadedFile(file, 'evidencias');
        results.push(result);

        const user = getAuthUser(request);
        auditLog(fastify.db, {
          usuario_id: user.id,
          usuario_email: user.email,
          accion: 'subir_archivo',
          entidad: 'uploads',
          entidad_id: result.filename,
          valores_nuevos: { url: result.url, original_name: result.filename, size: result.size },
        });
      } catch (err: any) {
        results.push({ error: err.message, filename: file.filename });
      }
    }

    return { archivos: results };
  });

  // POST /api/uploads/base64 - Subir archivo desde base64 (para fotos firmas, etc.) - Solo administrador
  fastify.post(
    '/uploads/base64',
    { preHandler: requireRole('administrador') },
    async (request, reply) => {
      const { base64, filename, subdir } = request.body as {
        base64: string;
        filename?: string;
        subdir?: string;
      };
      if (!base64) return reply.code(400).send({ error: 'base64 requerido' });

      try {
        // Remover header data:image/...;base64, si existe
        const base64Data = base64.replace(/^data:image\/[a-z]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const ext = filename?.includes('.') ? filename.split('.').pop() : 'png';
        const uniqueName = `${genId()}.${ext}`;

        const targetDir = subdir ? join(UPLOAD_DIR, subdir) : UPLOAD_DIR;
        await mkdir(targetDir, { recursive: true });

        const filepath = join(targetDir, uniqueName);
        await writeFile(filepath, buffer);

        const url = `/uploads/${subdir ? subdir + '/' : ''}${uniqueName}`;

        const user = getAuthUser(request);
        auditLog(fastify.db, {
          usuario_id: user.id,
          usuario_email: user.email,
          accion: 'subir_archivo_base64',
          entidad: 'uploads',
          entidad_id: uniqueName,
          valores_nuevos: { url, original_name: filename || uniqueName, size: buffer.length },
        });

        return { url, filename: uniqueName, size: buffer.length };
      } catch (err: any) {
        return reply.code(400).send({ error: err.message });
      }
    }
  );
};

export default uploadsRoutes;
