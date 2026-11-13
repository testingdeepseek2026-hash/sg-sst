-- Fase N3.5: evidencias del permiso de trabajo en alturas.
-- El formulario web ya captura fotos y firmas de solicitante y responsable,
-- pero la tabla original no tenía dónde persistirlas.

ALTER TABLE altura_permits ADD COLUMN IF NOT EXISTS archivo_fotos TEXT;
ALTER TABLE altura_permits ADD COLUMN IF NOT EXISTS firma_solicitante_url TEXT;
ALTER TABLE altura_permits ADD COLUMN IF NOT EXISTS firma_responsable_url TEXT;
