import { genId, nowISO } from '../lib/utils.js';

export function getCompany(db: any) {
  return db.prepare('SELECT * FROM companies LIMIT 1').get() as any | undefined;
}

export function upsertCompany(db: any, input: any) {
  const existing = getCompany(db);
  const now = nowISO();
  if (existing) {
    const sets: string[] = [];
    const vals: any[] = [];
    for (const [k, v] of Object.entries(input)) {
      if (v === undefined) continue;
      sets.push(`${k} = ?`);
      vals.push(v);
    }
    sets.push(`actualizado_en = ?`);
    vals.push(now, existing.id);
    db.prepare(`UPDATE companies SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return { ...existing, ...input, actualizado_en: now };
  }
  const numTrab = input.numero_trabajadores ?? 3;
  const estandarSet = input.estandar_set ?? estandarSetPorRiesgo(input.clase_riesgo ?? 'IV', numTrab);
  const id = genId();
  db.prepare(
    `INSERT INTO companies (id, razon_social, nit, direccion, telefono, email, clase_riesgo, estandar_set,
      sector, actividad_economica, numero_trabajadores, tiene_vigia_sst, tiene_copasst,
      tiene_comite_convivencia, tiene_brigada, canal_alertas,
      smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, alerts_enabled,
      creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    input.razon_social,
    input.nit,
    input.direccion ?? null,
    input.telefono ?? null,
    input.email ?? null,
    input.clase_riesgo ?? 'IV',
    estandarSet,
    input.sector ?? null,
    input.actividad_economica ?? null,
    numTrab,
    input.tiene_vigia_sst ?? 0,
    input.tiene_copasst ?? 0,
    input.tiene_comite_convivencia ?? 0,
    input.tiene_brigada ?? 0,
    input.canal_alertas ?? 'app',
    input.smtp_host ?? null,
    input.smtp_port ?? null,
    input.smtp_user ?? null,
    input.smtp_pass ?? null,
    input.smtp_from ?? null,
    input.alerts_enabled ?? 0,
    now,
    now
  );
  return { id, ...input, creado_en: now, actualizado_en: now };
}

export function estandarSetPorRiesgo(clase_riesgo: string, numero_trabajadores?: number): '7' | '21' | '32' {
  // Res. 0312/2019 lógica:
  // Riesgo I-III, ≤10 trab → 7 (Cap. I)
  // Riesgo I-III, 11-50 trab → 21 (Cap. I+II)
  // Riesgo I-III, >50 trab → 32 (Cap. I+II+III)
  // Riesgo IV-V, ≤10 trab → 21 (Cap. I+II)
  // Riesgo IV-V, 11-50 trab → 21 (Cap. I+II)  
  // Riesgo IV-V, >50 trab → 32 (Cap. I+II+III)
  const nt = numero_trabajadores ?? 3;
  if (['IV', 'V'].includes(clase_riesgo)) {
    return nt > 50 ? '32' : '21';
  }
  if (nt <= 10) return '7';
  if (nt <= 50) return '21';
  return '32';
}
