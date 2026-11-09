import { DatabaseSync } from 'node:sqlite';

import { FastifyInstance as _FastifyInstance, FastifyRequest as _FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    db: DatabaseSync;
  }
  interface FastifyRequest {
    userId?: string;
    userEmail?: string;
    user?: {
      id: string;
      email: string;
      nombre: string;
      rol: 'administrador' | 'trabajador';
    };
  }
}
