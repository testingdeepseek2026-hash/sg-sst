import fs from 'node:fs';
import path from 'node:path';

/**
 * Sale con código 1 si el build de producción está desactualizado respecto a
 * las fuentes, para que iniciar-proyecto.bat sepa que debe recompilar.
 */

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'server', 'dist', 'index.js');

if (!fs.existsSync(dist)) {
  console.log('Build pendiente: no existe server/dist/index.js');
  process.exit(1);
}

let newest = 0;
function revisar(ruta) {
  const stat = fs.statSync(ruta);
  if (stat.isDirectory()) {
    for (const entrada of fs.readdirSync(ruta, { withFileTypes: true })) {
      revisar(path.join(ruta, entrada.name));
    }
    return;
  }
  if (stat.mtimeMs > newest) newest = stat.mtimeMs;
}

const fuentes = [
  'server/src',
  'web/src',
  'server/package.json',
  'web/package.json',
  'web/vite.config.ts',
  'web/index.html',
];
for (const fuente of fuentes) {
  const ruta = path.join(root, fuente);
  if (fs.existsSync(ruta)) revisar(ruta);
}

const distTime = fs.statSync(dist).mtimeMs;
if (newest > distTime) {
  console.log('Build pendiente: hay fuentes más recientes que server/dist');
  process.exit(1);
}
console.log('Build al día');
process.exit(0);
