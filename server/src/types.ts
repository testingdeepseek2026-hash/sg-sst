import { DatabaseSync } from 'node:sqlite';

import { FastifyInstance, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    db: DatabaseSync;
  }
  interface FastifyRequest {
    userId?: string;
    userEmail?: string;
  }
}
