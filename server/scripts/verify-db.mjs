import { openDb } from '../src/lib/db.js';

const db = openDb();

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('=== Tablas ===');
for (const t of tables) {
  const count = db.prepare(`SELECT COUNT(*) AS c FROM ${t.name}`).get().c;
  console.log(`  ${t.name}: ${count} filas`);
}

console.log('\n=== Empresa ===');
const company = db.prepare('SELECT id, razon_social, nit, clase_riesgo FROM companies').get();
console.log(company);

console.log('\n=== Usuarios ===');
const users = db.prepare('SELECT id, email, nombre, rol FROM users').all();
for (const u of users) console.log(`  ${u.email} (${u.rol}) - ${u.nombre}`);

console.log('\n=== Trabajadores ===');
const workers = db.prepare('SELECT id, nombres, apellidos, cargo, estado FROM workers').all();
for (const w of workers) console.log(`  ${w.nombres} ${w.apellidos} - ${w.cargo} (${w.estado})`);

console.log('\n=== Exámenes médicos ===');
const exams = db.prepare('SELECT id, worker_id, tipo, fecha, vencimiento, resultado FROM worker_exams').all();
for (const e of exams) console.log(`  ${e.tipo}: vence ${e.vencimiento} - ${e.resultado}`);

console.log('\n=== Certificados ===');
const certs = db.prepare('SELECT id, worker_id, tipo, fecha_vencimiento FROM worker_certs').all();
for (const c of certs) console.log(`  ${c.tipo}: vence ${c.fecha_vencimiento}`);

console.log('\n=== EPP ===');
const epps = db.prepare('SELECT id, worker_id, item, fecha_vencimiento, firmado_por_trabajador FROM worker_epp').all();
for (const e of epps) console.log(`  ${e.item}: vence ${e.fecha_vencimiento} - firmado: ${e.firmado_por_trabajador}`);

console.log('\n=== Estándares ===');
const stdCount = db.prepare('SELECT COUNT(*) AS c FROM standards').get().c;
console.log(`  ${stdCount} estándares cargados`);

console.log('\n=== Políticas ===');
const policies = db.prepare('SELECT id, titulo, estado FROM policies').all();
for (const p of policies) console.log(`  ${p.titulo} (${p.estado})`);

console.log('\n=== Objetivos ===');
const objectives = db.prepare('SELECT id, descripcion, tipo, estado FROM objectives').all();
for (const o of objectives) console.log(`  ${o.tipo}: ${o.descripcion.substring(0, 60)}... (${o.estado})`);

process.exit(0);
