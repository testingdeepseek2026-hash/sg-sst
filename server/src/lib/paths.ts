import path from 'node:path';

import { REPO_ROOT } from './env.js';

export { REPO_ROOT };

function resolveFromRepo(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

/**
 * Resuelve la ruta del archivo SQLite.
 * Precedencia: SG_SST_DATA_DIR (directorio) > DB_PATH (archivo) > data/ en la raíz.
 * Las rutas relativas se resuelven contra la raíz del repositorio (no contra el
 * cwd) para que `pnpm --dir server`, `pnpm start`, seed, reset y respaldos usen
 * el mismo archivo.
 */
export function resolveDbPath(): string {
  if (process.env.SG_SST_DATA_DIR) {
    return path.join(resolveFromRepo(process.env.SG_SST_DATA_DIR), 'sg-sst.db');
  }
  if (process.env.DB_PATH) return resolveFromRepo(process.env.DB_PATH);
  return path.join(REPO_ROOT, 'data', 'sg-sst.db');
}
