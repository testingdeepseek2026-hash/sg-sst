import { genId } from '../lib/utils.js';
import { encrypt, decrypt, isEncrypted, SENSITIVE_FIELDS, decryptSensitiveFields } from '../lib/crypto.js';

export interface WorkerExam {
  id: string;
  worker_id: string;
  tipo: 'ingreso' | 'periodico' | 'egreso' | 'control';
  fecha: string;
  vencimiento: string | null;
  resultado: 'apto' | 'apto_con_restricciones' | 'no_apto';
  restricciones: string | null;
  medico: string | null;
  entidad: string | null;
  archivo_url: string | null;
  notas: string | null;
}

export function getExamsByWorker(
  db: any,
  workerId: string,
  includeSensitive = false
): WorkerExam[] {
  const rows = db
    .prepare('SELECT * FROM worker_exams WHERE worker_id = ? ORDER BY fecha DESC')
    .all(workerId) as WorkerExam[];
  
  if (!includeSensitive) {
    // Ley 1581/2012: no devolver datos sensibles en listados
    return rows.map((r) => ({
      ...r,
      restricciones: null,
      medico: null,
      entidad: null,
      archivo_url: null,
      notas: null,
      resultado: r.resultado === 'no_apto' ? 'no_apto' : 'apto', // solo indicar si es apto o no
    }));
  }
  
  // Descifrar campos sensibles para admin
  return rows.map((r) => decryptSensitiveFields(r) as WorkerExam);
}

export function getExamById(db: any, id: string, includeSensitive = false): WorkerExam | undefined {
  const row = db.prepare('SELECT * FROM worker_exams WHERE id = ?').get(id) as
    WorkerExam | undefined;
  if (!row) return undefined;
  if (!includeSensitive) {
    return {
      ...row,
      restricciones: null,
      medico: null,
      entidad: null,
      archivo_url: null,
      notas: null,
      resultado: row.resultado === 'no_apto' ? 'no_apto' : 'apto',
    };
  }
  return decryptSensitiveFields(row) as WorkerExam;
}

export function createExam(
  db: any,
  input: {
    worker_id: string;
    tipo: 'ingreso' | 'periodico' | 'egreso' | 'control';
    fecha: string;
    vencimiento?: string | null;
    resultado?: 'apto' | 'apto_con_restricciones' | 'no_apto';
    restricciones?: string | null;
    medico?: string | null;
    entidad?: string | null;
    archivo_url?: string | null;
    notas?: string | null;
  }
): WorkerExam {
  // Validar consentimiento médico (Ley 1581/2012)
  const consent = db
    .prepare('SELECT * FROM consents WHERE worker_id = ? AND tipo = ? AND autorizado = 1')
    .get(input.worker_id, 'medico');
  if (!consent) {
    throw new Error(
      'El trabajador no ha autorizado el tratamiento de datos médicos (Ley 1581/2012). Registre consentimiento primero.'
    );
  }

  // Validar: solo un examen de ingreso vigente
  if (input.tipo === 'ingreso') {
    const existing = db
      .prepare('SELECT * FROM worker_exams WHERE worker_id = ? AND tipo = ?')
      .get(input.worker_id, 'ingreso');
    if (existing) {
      throw new Error(
        'Ya existe un examen de ingreso para este trabajador. Use tipo "periodico" o "control".'
      );
    }
  }

  // Cifrar campos sensibles antes de guardar (Ley 1581/2012 - datos sensibles en reposo)
  const sensitiveInput: Record<string, any> = { ...input };
  for (const field of SENSITIVE_FIELDS) {
    if (sensitiveInput[field] && typeof sensitiveInput[field] === 'string' && !isEncrypted(sensitiveInput[field])) {
      sensitiveInput[field] = encrypt(sensitiveInput[field]);
    }
  }

  const id = genId();
  db.prepare(
    `INSERT INTO worker_exams (id, worker_id, tipo, fecha, vencimiento, resultado, restricciones, medico, entidad, archivo_url, notas)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    sensitiveInput.worker_id,
    sensitiveInput.tipo,
    sensitiveInput.fecha,
    sensitiveInput.vencimiento ?? null,
    sensitiveInput.resultado ?? 'apto',
    sensitiveInput.restricciones ?? null,
    sensitiveInput.medico ?? null,
    sensitiveInput.entidad ?? null,
    sensitiveInput.archivo_url ?? null,
    sensitiveInput.notas ?? null
  );
  return getExamById(db, id, true)!;
}

export function updateExam(db: any, id: string, patch: Partial<WorkerExam>): WorkerExam {
  // Cifrar campos sensibles en el patch
  const sensitivePatch: Record<string, any> = { ...patch };
  for (const field of SENSITIVE_FIELDS) {
    if (sensitivePatch[field] && typeof sensitivePatch[field] === 'string' && !isEncrypted(sensitivePatch[field])) {
      sensitivePatch[field] = encrypt(sensitivePatch[field]);
    }
  }

  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(sensitivePatch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return getExamById(db, id, true)!;
  db.prepare(`UPDATE worker_exams SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
  return getExamById(db, id, true)!;
}

export function deleteExam(db: any, id: string): void {
  db.prepare('DELETE FROM worker_exams WHERE id = ?').run(id);
}

export function getVencimientosProximos(
  db: any,
  dias = 30
): Array<{
  worker_id: string;
  nombres: string;
  apellidos: string;
  tipo: string;
  fecha: string;
  vencimiento: string;
  estado: 'vencido' | 'por_vencer' | 'vigente';
  dias_restantes: number;
}> {
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

export function getExamenIngresoVigente(db: any, workerId: string): WorkerExam | undefined {
  return db
    .prepare(
      'SELECT * FROM worker_exams WHERE worker_id = ? AND tipo = ? ORDER BY fecha DESC LIMIT 1'
    )
    .get(workerId, 'ingreso') as WorkerExam | undefined;
}
