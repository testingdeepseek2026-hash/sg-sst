import { existsSync } from 'node:fs';
import { join } from 'node:path';

import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import Fastify from 'fastify';

import { requireAuth } from './lib/auth.js';
import { getPgPool, isPgBackend } from './lib/db-pg.js';
import { DB_PATH, openDb, runMigrations } from './lib/db.js';
import { startAlertScheduler } from './lib/scheduler.js';
import alertsRoutes from './routes/alerts.js';
import companiesRoutes from './routes/companies.js';
import contractorsRoutes from './routes/contractors.js';
import {
  actionsRoutes,
  auditLogsRoutes,
  auditsRoutes,
  documentsRoutes,
} from './routes/documents_actions_audits_alerts.js';
import emergenciesRoutes from './routes/emergencies.js';
import exportRoutes from './routes/export.js';
import hazardsRoutes from './routes/hazards.js';
import importRoutes from './routes/import.js';
import incidentsRoutes from './routes/incidents.js';
import indicatorsRoutes from './routes/indicators.js';
import inspectionsRoutes from './routes/inspections.js';
import plansRoutes from './routes/plans.js';
import policiesRoutes from './routes/policies.js';
import privacyRoutes from './routes/privacy.js';
import restoreRoutes from './routes/restore.js';
import rolesRoutes from './routes/roles.js';
import standardsRoutes from './routes/standards.js';
import uploadsRoutes from './routes/uploads.js';
import usersRoutes from './routes/users.js';
import workersRoutes from './routes/workers.js';
import workersItemsRoutes from './routes/workers_items.js';
import { seedAll } from './seed/index.js';
import './types.js';

// trustProxy: detrás de Caddy (HTTPS local) para registrar IP y protocolo reales.
// Activar con TRUST_PROXY=true solo cuando exista un proxy inverso confiable.
const app = Fastify({ logger: true, trustProxy: process.env.TRUST_PROXY === 'true' });

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4000',
  process.env.FRONTEND_URL || 'https://sg-sst.example.com',
].filter(Boolean);

await app.register(cors, {
  origin: allowedOrigins,
  credentials: true,
});
await app.register(cookie, { secret: process.env.SESSION_SECRET });
await app.register(multipart, { limits: { fields: 50, files: 20, fileSize: 10 * 1024 * 1024 } });

const usePg = isPgBackend();
// Con PostgreSQL no se abre SQLite: la base activa es DATABASE_URL.
// SQLite queda solo para desarrollo y pruebas.
const db = usePg ? (null as unknown as ReturnType<typeof openDb>) : openDb();
if (!usePg) runMigrations(db);
app.decorate('db', db);

// Health check disponible sin autenticación para monitoreo/load balancer
app.get('/api/health', async () => {
  const backend = isPgBackend() ? 'postgresql' : 'sqlite';
  try {
    if (isPgBackend()) await getPgPool().query('SELECT 1');
    else db.prepare('SELECT 1').all();
    return { status: 'ok', db: 'connected', backend, version: '1.0.0' };
  } catch (e) {
    return { status: 'degraded', db: 'error', backend, error: String(e) };
  }
});

// Hook global: autenticación y adjuntar request.user tipado
// Las rutas individuales usan requireRole/requireOwnership para autorización
app.addHook('preHandler', requireAuth);
app.register(usersRoutes, { prefix: '/api' });
app.register(companiesRoutes, { prefix: '/api' });
app.register(rolesRoutes, { prefix: '/api' });
app.register(workersRoutes, { prefix: '/api' });
app.register(workersItemsRoutes, { prefix: '/api' });
app.register(hazardsRoutes, { prefix: '/api' });
app.register(standardsRoutes, { prefix: '/api' });
app.register(plansRoutes, { prefix: '/api' });
app.register(indicatorsRoutes, { prefix: '/api' });
app.register(incidentsRoutes, { prefix: '/api' });
app.register(inspectionsRoutes, { prefix: '/api' });
app.register(documentsRoutes, { prefix: '/api' });
app.register(actionsRoutes, { prefix: '/api' });
app.register(auditsRoutes, { prefix: '/api' });
app.register(auditLogsRoutes, { prefix: '/api' });
app.register(alertsRoutes, { prefix: '/api' });
app.register(exportRoutes, { prefix: '/api' });
app.register(importRoutes, { prefix: '/api' });
app.register(uploadsRoutes, { prefix: '/api' });
app.register(contractorsRoutes, { prefix: '/api' });
app.register(emergenciesRoutes, { prefix: '/api' });
app.register(policiesRoutes, { prefix: '/api' });
app.register(privacyRoutes, { prefix: '/api' });
app.register(restoreRoutes, { prefix: '/api' });

const publicDir = join(process.cwd(), 'dist', 'public');
const uploadsDir = join(process.cwd(), 'uploads');

// Registrar el plugin de archivos estáticos una sola vez.
// Sirve el frontend compilado desde dist/public y provee reply.sendFile().
if (existsSync(publicDir)) {
  await app.register(staticPlugin, { root: publicDir, prefix: '/' });
}

// Servir archivos subidos desde uploads/ bajo /uploads/.
// decorateReply:false evita registrar sendFile dos veces (ya lo provee el registro anterior).
if (existsSync(uploadsDir)) {
  await app.register(staticPlugin, {
    root: uploadsDir,
    prefix: '/uploads',
    decorateReply: false,
  });
}

app.setNotFoundHandler((request, reply) => {
  if (!request.url.startsWith('/api/') && !request.url.startsWith('/uploads/')) {
    return reply.sendFile('index.html');
  }
  return reply.code(404).send({ error: 'Not found' });
});

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '127.0.0.1';

app.listen({ port: PORT, host: HOST }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`SG-SST servidor escuchando en http://${HOST}:${PORT}`);
  console.log(`Base de datos: ${usePg ? 'PostgreSQL (DATABASE_URL)' : DB_PATH}`);
  if (process.env.SEED === 'true') {
    if (!db) {
      console.warn('[SEED] Omitido: la semilla SQLite no aplica con DB_BACKEND=pg.');
    } else {
      void seedAll(db).then(() => console.log('Semilla cargada.'));
    }
  }

  // Iniciar scheduler de alertas (solo en producción, no en test)
  startAlertScheduler(db);
});
