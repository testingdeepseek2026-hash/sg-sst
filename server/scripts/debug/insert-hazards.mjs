import { DatabaseSync } from 'node:sqlite';
import { hazardCatalogSeed } from './dist/seed/hazard-catalog-seed.js';
import { genId } from './dist/lib/utils.js';

const db = new DatabaseSync('C:\\Users\\PC\\sg-sst\\server\\data\\sg-sst.db');

console.log('Inserting', hazardCatalogSeed.length, 'hazard catalog items...');
let inserted = 0;
for (const h of hazardCatalogSeed) {
  const id = genId();
  db.prepare(
    'INSERT INTO hazard_catalog (id, codigo, nombre, categoria, descripcion, riesgo_por_defecto, control_sugerido, activo) VALUES (?,?,?,?,?,?,?,1)'
  ).run(id, h.codigo, h.nombre, h.categoria, h.descripcion ?? null, h.riesgo_por_defecto ?? 'medio', h.control_sugerido ?? null);
  inserted++;
}
console.log('Inserted:', inserted, 'items');

const count = db.prepare('SELECT COUNT(*) as c FROM hazard_catalog').get();
console.log('Total hazard_catalog:', count.c);
db.close();