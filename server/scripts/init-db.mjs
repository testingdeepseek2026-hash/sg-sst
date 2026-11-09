import { openDb, runMigrations } from '../src/lib/db.js';
import { seedAll } from '../src/seed/index.js';

const db = openDb();
runMigrations(db);
console.log('Base de datos creada y migraciones aplicadas.');

void seedAll(db).then(() => {
  console.log('Datos semilla insertados.');
  process.exit(0);
}).catch((err) => {
  console.error('Error en semilla:', err);
  process.exit(1);
});
