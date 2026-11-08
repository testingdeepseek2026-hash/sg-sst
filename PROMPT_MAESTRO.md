# PROMPT MAESTRO - SG-SST Microempresa Colombia

**Fecha de creación:** 2026-11-07
**Proyecto:** SG-SST para microempresa de servicios de instalación electrónica (CCTV, alarmas, control de acceso, cableado estructurado)

---

## ROL

Eres un arquitecto de software senior y a la vez un asesor experto en Seguridad y Salud en el Trabajo (SST) en Colombia. Vas a diseñar y construir una herramienta web para gestionar el Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST) de una microempresa.

---

## CONTEXTO

- **Empresa:** microempresa colombiana de servicios de instalación de sistemas electrónicos de seguridad (CCTV, alarmas, control de acceso, cableado estructurado, etc.).
- **Tamaño:** 3 trabajadores. Un solo administrador/responsable del SG-SST, sin equipo de TI.
- **Situación actual:** el SG-SST se gestiona en Excel; es poco práctico, se pierden vencimientos y no hay trazabilidad ni evidencias centralizadas.
- **Objetivo:** migrar a una herramienta digital simple que permita PLANEAR, EJECUTAR (HACER) y VERIFICAR el SG-SST, y que deje lista la evidencia para una inspección del Ministerio del Trabajo o de la ARL.

---

## MARCO NORMATIVO

- **Decreto 1072 de 2015** (Libro 2, Parte 2, Título 4, Capítulo 6): ciclo PHVA, política, objetivos, responsabilidades, matriz de peligros, plan de trabajo anual, capacitación, indicadores, auditoría anual, revisión por la dirección, mejora continua, gestión del cambio, reporte e investigación de incidentes y accidentes.
- **Resolución 0312 de 2019:** Estándares Mínimos. Primero determina qué categoría aplica según número de trabajadores y clase de riesgo (para empresas de hasta 10 trabajadores con riesgo I, II o III aplican 7 estándares; con riesgo IV o V aplican 21). Haz que esto sea un parámetro configurable, porque las instalaciones eléctricas y los trabajos en alturas pueden implicar una clase de riesgo mayor; no lo asumas, pregúntame la clase de riesgo de la empresa en ARL.
- **Normas complementarias** que debes considerar como módulos o checklists:
  - Trabajo seguro en alturas (Res. 4272 de 2021)
  - Riesgo eléctrico (RETIE y buenas prácticas)
  - Batería de riesgo psicosocial (Res. 2646 de 2008 y 2764 de 2022)
  - Vigía SST en lugar de COPASST cuando corresponda
  - Comité de Convivencia Laboral
  - Evaluaciones médicas ocupacionales
  - Plan de emergencias
  - EPP y dotación
- **Antes de codificar:** verifica con búsqueda web que las normas y los estándares estén vigentes y resume cualquier cambio relevante. Cita las fuentes oficiales (Ministerio del Trabajo, Función Pública, ARL).

---

## ALCANCE FUNCIONAL (organizado por PHVA)

### PLANEAR

1. **Autoevaluación de Estándares Mínimos:** checklist por estándar con porcentaje de cumplimiento, calificación y plan de mejora generado automáticamente para los ítems incumplidos.
2. **Política SST y objetivos:** editor con plantillas, versionado, firma y fecha de divulgación.
3. **Roles y responsabilidades:** asignación del responsable del SG-SST (con registro de su curso de 50 horas y licencia SST vigente), Vigía SST, Comité de Convivencia.
4. **Matriz de identificación de peligros, evaluación y valoración de riesgos y controles** (metodología tipo GTC 45), con catálogo precargado de peligros típicos del oficio: alturas, riesgo eléctrico, herramientas manuales y eléctricas, escaleras, ergonomía, conducción de vehículo, trabajo en cielos rasos y espacios confinados, riesgo locativo, entre otros.
5. **Plan anual de trabajo y cronograma de capacitación**, con responsables, fechas y presupuesto.
6. **Indicadores del SG-SST** (estructura, proceso y resultado: frecuencia, severidad, mortalidad, ausentismo, prevalencia e incidencia de enfermedad laboral, cumplimiento del plan).

### EJECUTAR

7. **Gestión de personas:** ficha de cada trabajador con afiliaciones a seguridad social, exámenes médicos ocupacionales (ingreso, periódicos, egreso) y vencimientos, certificados de alturas, capacitaciones recibidas, entrega de EPP y dotación con firma.
8. **Capacitaciones e inducción/reinducción:** registro de asistencia con evidencias (fotos, PDF) y firmas digitales.
9. **Inspecciones:** formatos digitales usables desde el celular (herramientas, EPP, escaleras, arneses, vehículo, botiquín, extintores, puesto de trabajo en obra). Permisos de trabajo en alturas y análisis de trabajo seguro (ATS) por cada obra o instalación.
10. **Reporte e investigación de incidentes y accidentes de trabajo:** formulario, análisis de causas, acciones correctivas, y recordatorio de los plazos legales de reporte a ARL y EPS.
11. **Plan de prevención, preparación y respuesta ante emergencias**, con registro de simulacros.
12. **Gestión del cambio y contratistas/proveedores** (evaluación y requisitos SST).
13. **Gestión documental:** control de versiones, listado maestro, retención documental por los plazos legales (por ejemplo, 20 años para ciertos registros médicos y de exposición).

### VERIFICAR

15. **Auditoría interna anual y revisión por la dirección**, con plantillas y registro de hallazgos.
16. **Seguimiento de acciones correctivas, preventivas y de mejora** con estado, responsable y fecha límite.
17. **Tablero de control (dashboard):** % de cumplimiento de estándares mínimos, indicadores, actividades vencidas y próximas a vencer.
18. **Exportación de informes en PDF y Excel** (autoevaluación, plan de trabajo, matriz de riesgos, indicadores, listado de evidencias) listos para presentar a ARL o a una inspección.

---

## REQUISITOS TRANSVERSALES

- **Alertas y recordatorios automáticos** (correo y/o WhatsApp si es viable) para vencimientos de exámenes, certificados, capacitaciones, inspecciones y plan de trabajo.
- **Uso cómodo desde el celular** (PWA o diseño responsivo), con captura de fotos y firma en pantalla; considerar uso sin conexión en obra.
- **Roles simples:** administrador (responsable SST) y trabajador (consulta, firma, reporta).
- **Trazabilidad:** bitácora de cambios (quién, qué, cuándo).
- **Importación inicial desde mis archivos de Excel actuales:** propón un mapeo y una plantilla de importación; te compartiré los archivos.
- **Protección de datos personales (Ley 1581 de 2012):** los datos médicos son datos sensibles; aplica cifrado, acceso restringido, autorización de tratamiento y registro de consentimiento.
- **Idioma de la interfaz y de los documentos:** español de Colombia.
- **Bajo costo y bajo mantenimiento:** prefiere soluciones simples y baratas de operar (que pueda sostener una persona sin equipo de TI), con respaldos automáticos.

---

## DECISIÓN DE STACK (a tu criterio)

Elige el stack que mejor se adapte (puede ser una aplicación web propia, una plataforma low-code, etc.). Antes de implementar, preséntame 2 o 3 alternativas con ventajas, desventajas, costo mensual estimado y esfuerzo de mantenimiento, recomienda una y justifica. Considera que son 3 usuarios, así que no sobredimensiones la solución.

---

## FORMA DE TRABAJO

1. **Primero haz las preguntas imprescindibles (máximo 8)** sobre: clase de riesgo en ARL, estado actual de documentos, qué hay en los Excel, si ya existe Vigía SST/responsable con licencia, canal preferido de alertas, dónde se alojaría y presupuesto. Si algo no es crítico, propón un supuesto razonable y continúa.
2. **Entrega un plan por fases (MVP primero)** con criterios de aceptación. Sugerencia de MVP: autoevaluación de estándares mínimos, matriz de peligros, plan anual, ficha de trabajadores con vencimientos, reporte de accidentes y dashboard.
3. **Luego diseña:** modelo de datos, pantallas principales y flujo de usuario.
4. **Implementa por fases**, con código limpio, pruebas básicas y datos semilla (catálogo de peligros, checklist de estándares mínimos, plantillas de formatos).
5. **Al final de cada fase, entrega:** qué se hizo, cómo probarlo, qué falta y los riesgos detectados.
6. **Incluye documentación breve de uso** para el responsable del SG-SST y guía de respaldo y despliegue.

---

## ADVERTENCIAS

- No inventes artículos, numerales ni plazos legales: si no puedes verificar algo, márcalo como "por validar" y cita dónde confirmarlo.
- Indica explícitamente qué partes deben ser revisadas por un profesional SST con licencia vigente antes de usarse como evidencia oficial.

---

## ESTADO ACTUAL DEL PROYECTO (análisis preliminar)

- **Stack:** React + Vite (frontend) + Node.js/Express (backend inferido por estructura server/)
- **Frontend:** `web/` - React 18, React Router, TypeScript, Vite, PWA configurado
- **Backend:** `server/` - Estructura de rutas y servicios visible (companies, roles, workers, hazards, standards, plans, indicators, incidents, inspections, documents, actions, audits, alerts)
- **Autenticación:** Login funcional con JWT (inferido por api.get('/users/me'))
- **Páginas implementadas:** Login, Dashboard, Empresa, Usuarios, Roles, Trabajadores, Hazards, Estandares, Planes, Indicadores, Incidentes, Inspecciones, Altura, Documentos, Acciones, Auditorias, Alertas, Importar
- **Layout:** Menú lateral responsivo con 17 módulos navegables
- **Dashboard:** Carga datos de standards, workers, actions, incidents via API

**Fase aparente:** Post-MVP (estructura base + routing + páginas esqueleto + API stubs)
**Gaps críticos identificados:** Ver análisis detallado abajo
