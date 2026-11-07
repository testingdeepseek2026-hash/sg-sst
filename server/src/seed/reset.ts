import { DatabaseSync } from 'node:sqlite';
import { openDb, runMigrations } from '../lib/db.js';

async function main() {
  const db = openDb();
  runMigrations(db);
  db.exec(`DELETE FROM standard_assessments; DELETE FROM standards; DELETE FROM workers; DELETE FROM users; DELETE FROM companies; DELETE FROM roles;`);
  console.log('Base de datos reseteada.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
