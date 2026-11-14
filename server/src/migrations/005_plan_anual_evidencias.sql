-- Fase 2: Plan anual de trabajo alineado al Excel real (PL-SGSST-01).
-- - programa: programa/tema agrupador de la actividad (columna 1 del Excel).
-- - evidencia_esperada: descripción de la evidencia requerida (columna 5).
-- - meses: cronograma mensual (JSON con números de mes 1-12).
-- - annual_plan_evidences: soportes reales adjuntos a cada actividad.

ALTER TABLE annual_plan ADD COLUMN IF NOT EXISTS programa TEXT;
ALTER TABLE annual_plan ADD COLUMN IF NOT EXISTS evidencia_esperada TEXT;
ALTER TABLE annual_plan ADD COLUMN IF NOT EXISTS meses TEXT;

CREATE TABLE IF NOT EXISTS annual_plan_evidences (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES annual_plan(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  nombre_original TEXT NOT NULL,
  mime TEXT,
  tamano INTEGER,
  subido_por TEXT,
  creado_en TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_annual_plan_evidences_plan
  ON annual_plan_evidences(plan_id);
