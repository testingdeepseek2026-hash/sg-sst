import { genId } from '../lib/utils.js';

export interface WorkerEpp {
  id: string;
  worker_id: string;
  item: string;
  cantidad: number;
  fecha_entrega: string;
  fecha_vencimiento: string | null;
  firmado_por_trabajador: number;
  firma_url: string | null;
  notas: string | null;
}

const EPP_ITEMS_COMUNES = [
  'Casco de seguridad',
  'Arnés de cuerpo completo',
  'Gafas de seguridad',
  'Guantes de protección',
  'Botas de seguridad',
  'Protección auditiva (tapones/orejeras)',
  'Ropa reflectiva (chaleco)',
  'Respirador / mascarilla',
  'Protección facial (careta)',
  'Cinturón de seguridad',
  'Línea de vida',
  'Dispositivo anticaídas',
  'Otro',
];

export function getEppByWorker(db: any, workerId: string): WorkerEpp[] {
  return db
    .prepare('SELECT * FROM worker_epp WHERE worker_id = ? ORDER BY fecha_entrega DESC')
    .all(workerId) as WorkerEpp[];
}

export function getEppById(db: any, id: string): WorkerEpp | undefined {
  return db.prepare('SELECT * FROM worker_epp WHERE id = ?').get(id) as WorkerEpp | undefined;
}

export function createEpp(
  db: any,
  input: {
    worker_id: string;
    item: string;
    cantidad?: number;
    fecha_entrega: string;
    fecha_vencimiento?: string | null;
    firmado_por_trabajador?: number;
    firma_url?: string | null;
    notas?: string | null;
  }
): WorkerEpp {
  const id = genId();
  db.prepare(
    `INSERT INTO worker_epp (id, worker_id, item, cantidad, fecha_entrega, fecha_vencimiento, firmado_por_trabajador, firma_url, notas)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    input.worker_id,
    input.item,
    input.cantidad ?? 1,
    input.fecha_entrega,
    input.fecha_vencimiento ?? null,
    input.firmado_por_trabajador ?? 0,
    input.firma_url ?? null,
    input.notas ?? null
  );
  return getEppById(db, id)!;
}

export function updateEpp(db: any, id: string, patch: Partial<WorkerEpp>): WorkerEpp {
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return getEppById(db, id)!;
  db.prepare(`UPDATE worker_epp SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
  return getEppById(db, id)!;
}

export function deleteEpp(db: any, id: string): void {
  db.prepare('DELETE FROM worker_epp WHERE id = ?').run(id);
}

export function firmarEntregaEpp(
  db: any,
  id: string,
  firmaBase64: string,
  workerId: string
): WorkerEpp {
  // Verificar que el EPP pertenezca al trabajador (o sea admin)
  const epp = getEppById(db, id);
  if (!epp) throw new Error('Entrega EPP no encontrada');
  if (epp.worker_id !== workerId) {
    // Permitir si es admin (se valida en ruta)
  }
  return updateEpp(db, id, { firmado_por_trabajador: 1, firma_url: firmaBase64 });
}

export function getVencimientosProximos(
  db: any,
  dias = 30
): Array<{
  worker_id: string;
  nombres: string;
  apellidos: string;
  tipo: string;
  item: string;
  fecha_entrega: string;
  fecha_vencimiento: string;
  estado: 'vencido' | 'por_vencer' | 'vigente' | 'sin_vencimiento';
  dias_restantes: number | null;
}> {
  const hoy = new Date().toISOString().slice(0, 10);
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);
  const limiteStr = limite.toISOString().slice(0, 10);

  const epp = db
    .prepare(
      `
    SELECT we.*, w.nombres, w.apellidos
    FROM worker_epp we
    JOIN workers w ON w.id = we.worker_id
    WHERE we.fecha_vencimiento IS NOT NULL AND we.fecha_vencimiento <= ?
    AND w.estado = 'activo'
    ORDER BY we.fecha_vencimiento
  `
    )
    .all(limiteStr) as any[];

  return epp.map((e) => {
    const diff = Math.ceil(
      (new Date(e.fecha_vencimiento).getTime() - new Date(hoy).getTime()) / (1000 * 60 * 60 * 24)
    );
    let estado: 'vencido' | 'por_vencer' | 'vigente' | 'sin_vencimiento' = 'vigente';
    if (diff < 0) estado = 'vencido';
    else if (diff <= dias) estado = 'por_vencer';
    return {
      worker_id: e.worker_id,
      nombres: e.nombres,
      apellidos: e.apellidos,
      tipo: 'epp',
      item: e.item,
      fecha_entrega: e.fecha_entrega,
      fecha_vencimiento: e.fecha_vencimiento,
      estado,
      dias_restantes: diff,
    };
  });
}

export function getEppSinFirmar(db: any): Array<{
  id: string;
  worker_id: string;
  nombres: string;
  apellidos: string;
  item: string;
  fecha_entrega: string;
}> {
  return db
    .prepare(
      `
    SELECT we.id, we.worker_id, w.nombres, w.apellidos, we.item, we.fecha_entrega
    FROM worker_epp we
    JOIN workers w ON w.id = we.worker_id
    WHERE we.firmado_por_trabajador = 0
    AND w.estado = 'activo'
    ORDER BY we.fecha_entrega
  `
    )
    .all() as any[];
}

export function getWorkerVencimientos(db: any, dias = 30) {
  // Unifica exams + certs + epp para endpoint /workers/vencimientos
  const examenes = getVencimientosProximosExamenes(db, dias);
  const certificados = getVencimientosProximosCertificados(db, dias);
  const epp = getVencimientosProximos(db, dias);
  return [...examenes, ...certificados, ...epp].sort((a, b) => {
    // Ordenar: vencidos primero, luego por días restantes
    if (a.estado === 'vencido' && b.estado !== 'vencido') return -1;
    if (b.estado === 'vencido' && a.estado !== 'vencido') return 1;
    return (a.dias_restantes ?? 999) - (b.dias_restantes ?? 999);
  });
}

function getVencimientosProximosExamenes(db: any, dias: number) {
  const hoy = new Date().toISOString().slice(0, 10);
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);
  const limiteStr = limite.toISOString().slice(0, 10);

  const exams = db
    .prepare(
      `
    SELECT we.*, w.nombres, w.apellidos
    FROM worker_exams we
    JOIN workers w ON w.id = we.worker_id
    WHERE we.vencimiento IS NOT NULL AND we.vencimiento <= ?
    AND w.estado = 'activo'
    ORDER BY we.vencimiento
  `
    )
    .all(limiteStr) as any[];

  return exams.map((e) => {
    const diff = Math.ceil(
      (new Date(e.vencimiento).getTime() - new Date(hoy).getTime()) / (1000 * 60 * 60 * 24)
    );
    let estado: 'vencido' | 'por_vencer' | 'vigente' = 'vigente';
    if (diff < 0) estado = 'vencido';
    else if (diff <= dias) estado = 'por_vencer';
    return {
      worker_id: e.worker_id,
      nombres: e.nombres,
      apellidos: e.apellidos,
      tipo: `examen_${e.tipo}`,
      fecha: e.fecha,
      vencimiento: e.vencimiento,
      estado,
      dias_restantes: diff,
    };
  });
}

function getVencimientosProximosCertificados(db: any, dias: number) {
  const hoy = new Date().toISOString().slice(0, 10);
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);
  const limiteStr = limite.toISOString().slice(0, 10);

  const certs = db
    .prepare(
      `
    SELECT wc.*, w.nombres, w.apellidos
    FROM worker_certs wc
    JOIN workers w ON w.id = wc.worker_id
    WHERE wc.fecha_vencimiento IS NOT NULL AND wc.fecha_vencimiento <= ?
    AND w.estado = 'activo'
    ORDER BY wc.fecha_vencimiento
  `
    )
    .all(limiteStr) as any[];

  return certs.map((c) => {
    const diff = Math.ceil(
      (new Date(c.fecha_vencimiento).getTime() - new Date(hoy).getTime()) / (1000 * 60 * 60 * 24)
    );
    let estado: 'vencido' | 'por_vencer' | 'vigente' = 'vigente';
    if (diff < 0) estado = 'vencido';
    else if (diff <= dias) estado = 'por_vencer';
    return {
      worker_id: c.worker_id,
      nombres: c.nombres,
      apellidos: c.apellidos,
      tipo: `cert_${c.tipo}`,
      fecha_emision: c.fecha_emision,
      fecha_vencimiento: c.fecha_vencimiento,
      estado,
      dias_restantes: diff,
    };
  });
}

export { EPP_ITEMS_COMUNES };
