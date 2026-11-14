-- Importador PL-SGSST-01: cronograma ejecutado y % de cumplimiento.
-- - meses_ejecutados: meses marcados con X en la fila E (ejecutada), JSON 1-12.
-- - porcentaje: cumplimiento de la actividad (0-100), ejecutado / programado.

ALTER TABLE annual_plan ADD COLUMN IF NOT EXISTS meses_ejecutados TEXT;
ALTER TABLE annual_plan ADD COLUMN IF NOT EXISTS porcentaje DOUBLE PRECISION;
