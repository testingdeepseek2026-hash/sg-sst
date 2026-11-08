import { genId } from '../lib/utils.js';

export interface WorkerCert {
  id: string;
  worker_id: string;
  tipo:
    'alturas' | 'electrico' | 'primeros_auxilios' | 'brigada' | 'conduccion' | 'sst_50h' | 'otro';
  nombre_curso: string | null;
  entidad: string | null;
  fecha_emision: string;
  fecha_vencimiento: string;
  archivo_url: string | null;
  notas: string | null;
}

export function getCertsByWorker(db: any, workerId: string): WorkerCert[] {
  return db
    .prepare('SELECT * FROM worker_certs WHERE worker_id = ? ORDER BY fecha_emision DESC')
    .all(workerId) as WorkerCert[];
}

export function getCertById(db: any, id: string): WorkerCert | undefined {
  return db.prepare('SELECT * FROM worker_certs WHERE id = ?').get(id) as WorkerCert | undefined;
}

export function crearCertificado(
  db: any,
  input: {
    worker_id: string;
    tipo: WorkerCert['tipo'];
    nombre_curso?: string | null;
    entidad?: string | null;
    fecha_emision: string;
    fecha_vencimiento: string;
    archivo_url?: string | null;
    notas?: string | null;
  }
): WorkerCert {
  // Validación estricta para certificados de alturas: vigencia 3 años (Res. 4272/2021 Art 12)
  if (input.tipo === 'alturas') {
    const vencimientoEsperadoStr = calcularVencimientoAlturas(input.fecha_emision);

    if (input.fecha_vencimiento !== vencimientoEsperadoStr) {
      throw new Error(
        `Certificado de alturas debe tener vigencia exacta de 3 años (Res. 4272/2021 Art. 12). Emisión: ${input.fecha_emision} → Vencimiento esperado: ${vencimientoEsperadoStr}, recibido: ${input.fecha_vencimiento}`
      );
    }
  }

  const id = genId();
  db.prepare(
    `INSERT INTO worker_certs (id, worker_id, tipo, nombre_curso, entidad, fecha_emision, fecha_vencimiento, archivo_url, notas)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    input.worker_id,
    input.tipo,
    input.nombre_curso ?? null,
    input.entidad ?? null,
    input.fecha_emision,
    input.fecha_vencimiento,
    input.archivo_url ?? null,
    input.notas ?? null
  );
  return getCertById(db, id)!;
}

export function updateCert(db: any, id: string, patch: Partial<WorkerCert>): WorkerCert {
  // Si se actualiza tipo a alturas o fecha_emision/vencimiento, revalidar
  const existing = getCertById(db, id);
  if (!existing) throw new Error('Certificado no encontrado');

  const nuevoTipo = patch.tipo ?? existing.tipo;
  const nuevaEmision = patch.fecha_emision ?? existing.fecha_emision;
  const nuevoVencimiento = patch.fecha_vencimiento ?? existing.fecha_vencimiento;

  if (nuevoTipo === 'alturas') {
    const vencimientoEsperadoStr = calcularVencimientoAlturas(nuevaEmision);

    if (nuevoVencimiento !== vencimientoEsperadoStr) {
      throw new Error(
        `Certificado de alturas debe tener vigencia exacta de 3 años (Res. 4272/2021 Art. 12). Emisión: ${nuevaEmision} → Vencimiento esperado: ${vencimientoEsperadoStr}, recibido: ${nuevoVencimiento}`
      );
    }
  }

  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return existing;
  db.prepare(`UPDATE worker_certs SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
  return getCertById(db, id)!;
}

export function deleteCert(db: any, id: string): void {
  db.prepare('DELETE FROM worker_certs WHERE id = ?').run(id);
}

export function getVencimientosProximos(
  db: any,
  dias = 30
): Array<{
  worker_id: string;
  nombres: string;
  apellidos: string;
  tipo: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: 'vencido' | 'por_vencer' | 'vigente';
  dias_restantes: number;
}> {
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

// Helpers para frontend
export function calcularVencimientoAlturas(fechaEmision: string): string {
  const emision = new Date(`${fechaEmision}T00:00:00.000Z`);
  const year = emision.getUTCFullYear() + 3;
  const month = emision.getUTCMonth();
  const day = Math.min(emision.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

export function validarCertificadoAlturas(
  fechaEmision: string,
  fechaVencimiento: string
): { valido: boolean; mensaje?: string } {
  const esperado = calcularVencimientoAlturas(fechaEmision);
  if (fechaVencimiento !== esperado) {
    return {
      valido: false,
      mensaje: `Vigencia debe ser 3 años exactos (Res. 4272/2021). Esperado: ${esperado}`,
    };
  }
  return { valido: true };
}
