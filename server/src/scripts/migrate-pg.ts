import '../lib/env.js';

import { closePgPool, getPgPool, runPgMigrations } from '../lib/db-pg.js';

/**
 * Aplica las migraciones PostgreSQL (Neon) desde la línea de comandos.
 * Uso: pnpm --dir server run migrate:pg
 * Requiere DATABASE_URL en el .env de la raíz (ver .env.example).
 */
async function main() {
  const pool = getPgPool();
  try {
    console.log('[MIGRATE-PG] Aplicando migraciones PostgreSQL...');
    await runPgMigrations(pool);

    const { rows } = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log(`[MIGRATE-PG] Esquema creado. Tablas públicas: ${rows.length}`);
    console.log(rows.map((r) => `  - ${String(r.table_name)}`).join('\n'));
    console.log('[MIGRATE-PG] Listo.');
  } finally {
    await closePgPool();
  }
}

main().catch((err) => {
  console.error('[MIGRATE-PG] Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
