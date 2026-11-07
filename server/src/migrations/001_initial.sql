-- ============================================================
-- SG-SST Microempresa - Esquema de base de datos SQLite
-- Marco: Decreto 1072/2015 (Cap. 6 Tit. 4 Libro 2), Res. 0312/2019,
-- Res. 4272/2021, Res. 2646/2008 + 2764/2022, Ley 1581/2012
-- ============================================================
PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------
-- 0. Empresa / configuracion institucional
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  razon_social TEXT NOT NULL,
  nit TEXT NOT NULL,
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  clase_riesgo TEXT NOT NULL DEFAULT 'I', -- I, II, III, IV, V (configurable en ARL)
  estandar_set TEXT NOT NULL DEFAULT '7', -- '7' | '21' | '32' (autocalculable por clase_riesgo)
  sector TEXT,
  actividad_economica TEXT,
  numero_trabajadores INTEGER NOT NULL DEFAULT 3,
  tiene_vigia_sst INTEGER NOT NULL DEFAULT 0,
  tiene_copasst INTEGER NOT NULL DEFAULT 0,
  tiene_comite_convivencia INTEGER NOT NULL DEFAULT 0,
  tiene_brigada INTEGER NOT NULL DEFAULT 0,
  canal_alertas TEXT NOT NULL DEFAULT 'email', -- email | whatsapp | app
  -- Configuración SMTP para alertas
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_user TEXT,
  smtp_pass TEXT,
  smtp_from TEXT,
  alerts_enabled INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------
-- 1. Usuarios y autenticacion simple
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('administrador','trabajador')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------
-- 2. Bitacora de cambios (trazabilidad: quien, que, cuando)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  usuario_id TEXT,
  usuario_email TEXT,
  accion TEXT NOT NULL,      -- crear | editar | eliminar | firmar | importar | exportar
  entidad TEXT NOT NULL,     -- nombre de tabla/modulo
  entidad_id TEXT,
  valores_anteriores TEXT,   -- JSON
  valores_nuevos TEXT,       -- JSON
  ip TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES users(id)
);

-- ------------------------------------------------------------------
-- 3. Politica SST y objetivos (versionado, firma, divulgacion)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1,
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,     -- texto de la politica
  firmado_por TEXT,
  fecha_firma TEXT,
  fecha_divulgacion TEXT,
  estado TEXT NOT NULL DEFAULT 'borrador', -- borrador | vigente | archivada
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS objectives (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'proceso', -- estructura | proceso | resultado
  meta TEXT,
  responsable TEXT,
  fecha_limite TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | cumplido | en_proceso | incumplido
  FOREIGN KEY (policy_id) REFERENCES policies(id)
);

-- ------------------------------------------------------------------
-- 4. Roles y responsabilidades (responsable SG-SST, Vigia, Convivencia)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,               -- Responsable SG-SST | Vigia SST | Comite Convivencia | Trabajador
  descripcion TEXT,
  usuario_id TEXT,                    -- asignado a
  licencia_sst_numero TEXT,
  licencia_sst_vence TEXT,            -- fecha vencimiento licencia
  curso_50h INTEGER NOT NULL DEFAULT 0,
  curso_50h_vence TEXT,               -- fecha vencimiento curso 50h (actualizacion 20h c/3 años)
  notas TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES users(id)
);

-- ------------------------------------------------------------------
-- 5. Fichas de trabajadores (afiliaciones, examenes medicos, EPP)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY,
  tipo_documento TEXT NOT NULL DEFAULT 'CC', -- CC | CE | PP | TI
  numero_documento TEXT UNIQUE NOT NULL,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  cargo TEXT NOT NULL,
  fecha_ingreso TEXT NOT NULL,
  fecha_egreso TEXT,
  estado TEXT NOT NULL DEFAULT 'activo', -- activo | inactivo | retirado
  eps TEXT,
  afp TEXT,
  arl TEXT,
  caja_compensacion TEXT,
  telefono TEXT,
  email TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS worker_exams (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso','periodico','egreso','control')),
  fecha TEXT NOT NULL,
  vencimiento TEXT,
  resultado TEXT NOT NULL DEFAULT 'apto', -- apto | apto_con_restricciones | no_apto
  restricciones TEXT,
  medico TEXT,
  entidad TEXT,
  archivo_url TEXT,
  notas TEXT,
  FOREIGN KEY (worker_id) REFERENCES workers(id)
);

CREATE TABLE IF NOT EXISTS worker_certs (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('alturas','electrico','primeros_auxilios','brigada','conduccion','sst_50h','otro')),
  nombre_curso TEXT,
  entidad TEXT,
  fecha_emision TEXT NOT NULL,
  fecha_vencimiento TEXT NOT NULL,
  archivo_url TEXT,
  notas TEXT,
  FOREIGN KEY (worker_id) REFERENCES workers(id)
);

CREATE TABLE IF NOT EXISTS worker_epp (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  item TEXT NOT NULL,               -- casco, arnes, gafas, guantes, botas, etc.
  cantidad INTEGER NOT NULL DEFAULT 1,
  fecha_entrega TEXT NOT NULL,
  fecha_vencimiento TEXT,
  firmado_por_trabajador INTEGER NOT NULL DEFAULT 0,
  firma_url TEXT,
  notas TEXT,
  FOREIGN KEY (worker_id) REFERENCES workers(id)
);

-- ------------------------------------------------------------------
-- 6. Catalogo de peligros (precargado, oficio electronica/seguridad)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hazard_catalog (
  id TEXT PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL, -- alturas | electrico | herramientas | escaleras | ergonomia | conduccion | cielos_rasos | confinados | locativo | otro
  descripcion TEXT,
  riesgo_por_defecto TEXT NOT NULL DEFAULT 'medio', -- bajo | medio | alto | critico
  control_sugerido TEXT,
  activo INTEGER NOT NULL DEFAULT 1
);

-- ------------------------------------------------------------------
-- 7. Matriz de peligros / evaluacion y valoracion de riesgos (GTC 45)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hazard_assessments (
  id TEXT PRIMARY KEY,
  cargo_oficio TEXT NOT NULL,
  area TEXT,
  peligro_id TEXT,                    -- referencia a hazard_catalog (si es del catalogo)
  peligro_texto TEXT,                 -- texto libre si no esta en catalogo
  tarea TEXT,
  consecuencia TEXT,
  probabilidad TEXT,
  valoracion_riesgo TEXT NOT NULL DEFAULT 'medio', -- bajo | medio | alto | critico
  controles TEXT,                     -- JSON lista de controles
  responsable TEXT,
  fecha TEXT NOT NULL DEFAULT (datetime('now')),
  revisado_en TEXT,
  estado TEXT NOT NULL DEFAULT 'vigente', -- vigente | revisado | obsoleto
  FOREIGN KEY (peligro_id) REFERENCES hazard_catalog(id)
);

-- ------------------------------------------------------------------
-- 8. Estándares mínimos (7 / 21 / 32 segun Res. 0312/2019)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS standards (
  id TEXT PRIMARY KEY,
  codigo TEXT NOT NULL,               -- E1..E60
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  set_aplicable TEXT NOT NULL,        -- '7' | '21' | '32'
  capitulo TEXT NOT NULL,             -- 'I' | 'II' | 'III'
  modo_verificacion TEXT,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS standard_assessments (
  id TEXT PRIMARY KEY,
  standard_id TEXT NOT NULL,
  cumple INTEGER NOT NULL DEFAULT 0,  -- 0 no | 1 si
  observaciones TEXT,
  plan_mejora TEXT,                   -- generado automaticamente para incumplidos
  fecha TEXT NOT NULL DEFAULT (datetime('now')),
  usuario_id TEXT,
  FOREIGN KEY (standard_id) REFERENCES standards(id),
  FOREIGN KEY (usuario_id) REFERENCES users(id)
);

-- ------------------------------------------------------------------
-- 9. Plan anual de trabajo y cronograma de capacitacion
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS annual_plan (
  id TEXT PRIMARY KEY,
  anio INTEGER NOT NULL,
  objetivo TEXT NOT NULL,
  meta TEXT,
  responsable TEXT,
  fecha_inicio TEXT,
  fecha_fin TEXT,
  presupuesto REAL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | en_proceso | cumplido | incumplido
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS training_schedule (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,                 -- induccion | reinduccion | capacitacion | alturas | electrico | emergencia
  fecha TEXT NOT NULL,
  duracion_horas REAL,
  responsable TEXT,
  objetivo TEXT,
  estado TEXT NOT NULL DEFAULT 'programada', -- programada | realizada | cancelada
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------
-- 10. Indicadores SG-SST (estructura, proceso, resultado)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS indicators (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('estructura','proceso','resultado')),
  valor REAL NOT NULL,
  meta REAL,
  periodo TEXT NOT NULL,              -- ej. '2026-11'
  fecha_calculo TEXT NOT NULL DEFAULT (datetime('now')),
  notas TEXT
);

-- ------------------------------------------------------------------
-- 11. Capacitaciones e induccion (asistencia, evidencias, firmas)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trainings (
  id TEXT PRIMARY KEY,
  schedule_id TEXT,
  nombre TEXT NOT NULL,
  fecha TEXT NOT NULL,
  instructor TEXT,
  archivo_evidencia TEXT,             -- PDF/fotos
  estado TEXT NOT NULL DEFAULT 'programada',
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (schedule_id) REFERENCES training_schedule(id)
);

CREATE TABLE IF NOT EXISTS training_attendance (
  id TEXT PRIMARY KEY,
  training_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  firmado INTEGER NOT NULL DEFAULT 0,
  firma_url TEXT,
  FOREIGN KEY (training_id) REFERENCES trainings(id),
  FOREIGN KEY (worker_id) REFERENCES workers(id)
);

-- ------------------------------------------------------------------
-- 12. Inspecciones (formatos digitales, celular, sin conexion)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspections (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('herramientas','epp','escaleras','arneses','vehiculo','botiquin','extintores','puesto_trabajo','obra')),
  fecha TEXT NOT NULL,
  lugar TEXT,
  responsable TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | aprobada | observaciones | rechazada
  resultado_json TEXT,                -- checklist respuestas
  observaciones TEXT,
  firmado_por TEXT,
  firma_url TEXT,
  archivo_fotos TEXT,                 -- JSON lista de urls
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------
-- 13. Permiso de trabajo en alturas y ATS (Res. 4272/2021)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS altura_permits (
  id TEXT PRIMARY KEY,
  obra TEXT NOT NULL,
  fecha TEXT NOT NULL,
  hora_inicio TEXT,
  hora_fin TEXT,
  solicitante TEXT,
  responsable_seguridad TEXT,
  sistema_proteccion TEXT,
  equipo_verificado INTEGER NOT NULL DEFAULT 0,
  apto_medico INTEGER NOT NULL DEFAULT 0,
  certificado_alturas INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | autorizado | rechazado | cerrado
  at_s_id TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ats (
  id TEXT PRIMARY KEY,
  obra TEXT NOT NULL,
  tarea TEXT NOT NULL,
  peligro TEXT,
  control TEXT,
  responsable TEXT,
  fecha TEXT NOT NULL DEFAULT (datetime('now')),
  estado TEXT NOT NULL DEFAULT 'vigente'
);

-- ------------------------------------------------------------------
-- 14. Incidentes y accidentes (reporte, investigacion, plazos legales)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('incidente','accidente','enfermedad_laboral')),
  fecha_ocurrencia TEXT NOT NULL,
  fecha_reporte TEXT,
  trabajador_id TEXT,
  lugar TEXT,
  descripcion TEXT NOT NULL,
  lesiones TEXT,
  causa_raiz TEXT,
  acciones_correctivas TEXT,
  reporte_arl INTEGER NOT NULL DEFAULT 0,   -- plazo 2 dias habiles
  reporte_eps INTEGER NOT NULL DEFAULT 0,
  reporte_mintrabajo INTEGER NOT NULL DEFAULT 0, -- graves/mortales
  dias_perdidos INTEGER DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'abierto', -- abierto | investigando | cerrado
  investigador TEXT,
  fecha_cierre TEXT,
  FOREIGN KEY (trabajador_id) REFERENCES workers(id)
);

-- ------------------------------------------------------------------
-- 15. Plan de emergencias y simulacros
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS emergency_plans (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo_emergencia TEXT NOT NULL, -- incendio | sismo | evacuacion | electrico | otro
  contenido TEXT,
  fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
  vigente INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS drills (
  id TEXT PRIMARY KEY,
  emergency_plan_id TEXT,
  fecha TEXT NOT NULL,
  tipo TEXT NOT NULL,
  participantes INTEGER,
  observaciones TEXT,
  estado TEXT NOT NULL DEFAULT 'realizado',
  FOREIGN KEY (emergency_plan_id) REFERENCES emergency_plans(id)
);

-- ------------------------------------------------------------------
-- 16. Gestion documental (versiones, retencion legal)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  tipo TEXT NOT NULL, -- formato | procedimiento | instruccion | registro
  archivo_url TEXT,
  fecha_emision TEXT NOT NULL DEFAULT (datetime('now')),
  fecha_revision TEXT,
  retencion_anos INTEGER NOT NULL DEFAULT 5, -- 20 para medicos/exposicion
  responsable TEXT,
  estado TEXT NOT NULL DEFAULT 'vigente', -- vigente | obsoleto | en_revision
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------
-- 17. Acciones correctivas / preventivas / mejora
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS corrective_actions (
  id TEXT PRIMARY KEY,
  origen TEXT NOT NULL,               -- auditoria | inspeccion | incidente | revision_direccion | estandar
  descripcion TEXT NOT NULL,
  responsable TEXT NOT NULL,
  fecha_limite TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | en_proceso | completada | vencida
  prioridad TEXT NOT NULL DEFAULT 'media', -- baja | media | alta | critica
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------
-- 18. Auditoria interna anual y revision por la direccion
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audits (
  id TEXT PRIMARY KEY,
  anio INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('interna','direccion')),
  fecha TEXT NOT NULL,
  auditor TEXT,
  alcance TEXT,
  hallazgos TEXT,                     -- JSON
  conclusiones TEXT,
  compromisos TEXT,
  estado TEXT NOT NULL DEFAULT 'programada', -- programada | realizada | cerrada
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------
-- 19. Contratistas / proveedores (evaluacion requisitos SST)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contractors (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  nit TEXT,
  servicio TEXT,
  arl TEXT,
  examen_medico INTEGER NOT NULL DEFAULT 0,
  capacitacion_sst INTEGER NOT NULL DEFAULT 0,
  epp INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | aprobado | rechazado
  fecha_evaluacion TEXT,
  notas TEXT
);

-- ------------------------------------------------------------------
-- 20. Alertas y recordatorios
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  entidad TEXT NOT NULL,
  entidad_id TEXT NOT NULL,
  tipo TEXT NOT NULL,                 -- examen | certificado | licencia | curso | inspeccion | plan | documento
  fecha_vencimiento TEXT NOT NULL,
  prioridad TEXT NOT NULL DEFAULT 'media' CHECK (prioridad IN ('critica','alta','media')),
  enviado INTEGER NOT NULL DEFAULT 0,
  enviado_en TEXT,
  canal TEXT NOT NULL DEFAULT 'email',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------
-- 21. Consentimiento tratamiento de datos (Ley 1581/2012) - datos sensibles
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('medico','general')),
  autorizado INTEGER NOT NULL DEFAULT 0,
  fecha TEXT NOT NULL DEFAULT (datetime('now')),
  medio TEXT,                         -- escrito | digital
  FOREIGN KEY (worker_id) REFERENCES workers(id)
);

CREATE INDEX IF NOT EXISTS idx_worker_exams_worker ON worker_exams(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_certs_worker ON worker_certs(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_epp_worker ON worker_epp(worker_id);
CREATE INDEX IF NOT EXISTS idx_hazard_assessment_cargo ON hazard_assessments(cargo_oficio);
CREATE INDEX IF NOT EXISTS idx_standard_assessments_set ON standard_assessments(id);
CREATE INDEX IF NOT EXISTS idx_incidents_fecha ON incidents(fecha_ocurrencia);
CREATE INDEX IF NOT EXISTS idx_alerts_venc ON alerts(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_audit_logs_fecha ON audit_logs(creado_en);
