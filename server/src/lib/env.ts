import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

// El .env vive en la raíz del repositorio, no en server/. Se resuelve desde
// este archivo para que se cargue sin importar el directorio de trabajo
// (`pnpm --dir server run dev`, `node dist/index.js`, seed, reset o pruebas).
const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, '..', '..', '..');

dotenv.config({ path: join(REPO_ROOT, '.env') });
