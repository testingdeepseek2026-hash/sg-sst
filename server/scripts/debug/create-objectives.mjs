import { DatabaseSync } from 'node:sqlite';
import { genId, nowISO } from './dist/lib/utils.js';

const db = new DatabaseSync('C:\\Users\\PC\\sg-sst\\server\\data\\sg-sst.db');

// Get the existing policy
const policy = db.prepare('SELECT * FROM policies LIMIT 1').get();
console.log('Policy:', policy.id);

function createObjective(db, input) {
  const id = genId();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO objectives (id, policy_id, descripcion, tipo, meta, responsable, fecha_limite, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.policy_id, input.descripcion, input.tipo, input.meta ?? null, input.responsable ?? null, input.fecha_limite ?? null, input.estado ?? 'pendiente');
  return db.prepare('SELECT * FROM objectives WHERE id = ?').get(id);
}

const objectives = [
  {
    policy_id: 'mw6wmdod-m9w4dnda',
    descripcion: 'Mantener actualizada la matriz de identificación de peligros y evaluación de riesgos para todas las actividades de instalación',
    tipo: 'estructura',
    meta: '100% de actividades cubiertas con matriz actualizada',
    responsable: 'Responsable SG-SST',
    fecha_limite: '2026-12-31',
    estado: 'en_proceso'
  },
  {
    policy_id: 'mw6wmdod-m9w4dnda',
    descripcion: 'Ejecutar el programa anual de capacitación en SST para todos los trabajadores',
    tipo: 'proceso',
    meta: '100% trabajadores capacitados según plan anual',
    responsable: 'Responsable SG-SST',
    fecha_limite: '2026-12-31',
    estado: 'pendiente'
  },
  {
    policy_id: 'mw6wmdod-m9w4dnda',
    descripcion: 'Alcanzar cero (0) accidentes de trabajo con tiempo perdido durante el año',
    tipo: 'resultado',
    meta: '0 accidentes con tiempo perdido',
    responsable: 'Representante Legal / Responsable SG-SST',
    fecha_limite: '2026-12-31',
    estado: 'pendiente'
  }
];

for (const obj of objectives) {
  const o = db.prepare(
    `INSERT INTO objectives (id, policy_id, descripcion, tipo, meta, responsable, fecha_limite, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(genId(), obj.policy_id, obj.descripcion, obj.tipo, obj.meta ?? null, obj.responsable ?? null, obj.fecha_limite ?? null, obj.estado ?? 'pendiente');
  console.log('Created objective:', obj.descripcion.substring(0, 50) + '...');
}

const count = db.prepare('SELECT COUNT(*) as c FROM objectives').get();
console.log('Total objectives:', count.c);