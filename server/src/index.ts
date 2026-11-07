import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { openDb, runMigrations, DB_PATH } from './lib/db.js';
import { genId, nowISO } from './lib/utils.js';
import { seedAll } from './seed/index.js';
import { startAlertScheduler } from './lib/scheduler.js';
import './types.js';
import companiesRoutes from './routes/companies.js';
import usersRoutes from './routes/users.js';
import rolesRoutes from './routes/roles.js';
import workersRoutes from './routes/workers.js';
import workersItemsRoutes from './routes/workers_items.js';
import hazardsRoutes from './routes/hazards.js';
import standardsRoutes from './routes/standards.js';
import plansRoutes from './routes/plans.js';
import indicatorsRoutes from './routes/indicators.js';
import incidentsRoutes from './routes/incidents.js';
import inspectionsRoutes from './routes/inspections.js';
import { alturaRoutes } from './routes/inspections.js';
import { documentsRoutes, actionsRoutes, auditsRoutes } from './routes/documents_actions_audits_alerts.js';
import alertsRoutes from './routes/alerts.js';
import exportRoutes from './routes/export.js';
import importRoutes from './routes/import.js';
import policiesRoutes from './routes/policies.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: ['http://localhost:5173', 'http://localhost:4000'],
  credentials: true
});
await app.register(cookie, { secret: process.env.SESSION_SECRET ?? 'sg-sst-dev-secret-change-me' });
await app.register(multipart, { limits: { fields: 50, files: 20, fileSize: 10 * 1024 * 1024 } });

const db = openDb();
runMigrations(db);
app.decorate('db', db);

app.addHook('preHandler', async (request) => {
  request.userId = request.cookies['sg_sst_user'] ?? undefined;
  request.userEmail = request.cookies['sg_sst_email'] ?? undefined;
});

app.register(companiesRoutes, { prefix: '/api' });
app.register(usersRoutes, { prefix: '/api' });
app.register(rolesRoutes, { prefix: '/api' });
app.register(workersRoutes, { prefix: '/api' });
app.register(workersItemsRoutes, { prefix: '/api' });
app.register(hazardsRoutes, { prefix: '/api' });
app.register(standardsRoutes, { prefix: '/api' });
app.register(plansRoutes, { prefix: '/api' });
app.register(indicatorsRoutes, { prefix: '/api' });
app.register(incidentsRoutes, { prefix: '/api' });
app.register(inspectionsRoutes, { prefix: '/api' });
app.register(alturaRoutes, { prefix: '/api' });
app.register(documentsRoutes, { prefix: '/api' });
app.register(actionsRoutes, { prefix: '/api' });
app.register(auditsRoutes, { prefix: '/api' });
app.register(alertsRoutes, { prefix: '/api' });
app.register(exportRoutes, { prefix: '/api' });
app.register(importRoutes, { prefix: '/api' });
app.register(policiesRoutes, { prefix: '/api' });

app.get('/api/health', async () => {
  try {
    db.prepare('SELECT 1').all();
    return { status: 'ok', db: 'connected', version: '1.0.0' };
  } catch (e) {
    return { status: 'degraded', db: 'error', error: String(e) };
  }
});

const publicDir = join(process.cwd(), 'dist', 'public');
if (existsSync(publicDir)) {
  await app.register(staticPlugin, { root: publicDir, prefix: '/' });
  app.setNotFoundHandler((request, reply) => {
    if (!request.url.startsWith('/api/')) {
      return reply.sendFile('index.html');
    }
    return reply.code(404).send({ error: 'Not found' });
  });
}

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '127.0.0.1';

app.listen({ port: PORT, host: HOST }, async (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`SG-SST servidor escuchando en http://${HOST}:${PORT}`);
  console.log(`Base de datos: ${DB_PATH}`);
  if (process.env.SEED === 'true') {
    await seedAll(db);
    console.log('Semilla cargada.');
  }

  // Iniciar scheduler de alertas (solo en producción, no en test)
  startAlertScheduler(db);
});
