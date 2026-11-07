# Plan de trabajo para terminar SG-SST

**Actualizado:** 7 de noviembre de 2026  
**Proyecto:** Aplicación SG-SST para microempresa colombiana de instalaciones electrónicas  
**Fuente de requisitos:** [`PROMPT_MAESTRO.md`](./PROMPT_MAESTRO.md)

## Objetivo

Completar y validar una aplicación sencilla que permita planear, ejecutar y verificar el SG-SST, conservar evidencia trazable y apoyar la preparación para revisiones de la ARL o del Ministerio del Trabajo. La aplicación organiza información y evidencia; no reemplaza el criterio del empleador, del responsable SST ni de un profesional con licencia cuando corresponda.

## Estado de partida

El repositorio ya contiene una aplicación React/Vite y Fastify/SQLite, módulos de interfaz y API, datos semilla, exportación PDF, importación de algunas hojas Excel, configuración PWA y documentación técnica.

La presencia de una pantalla o ruta no se considera funcionalidad terminada. Cada módulo se dará por aceptado solo cuando su flujo se pueda completar, guarde y recupere datos correctamente, controle permisos, tenga pruebas y sea utilizable con datos reales de prueba.

Estado técnico al cierre de la última sesión:

- La migración inicial se resuelve desde el código fuente y el build. Se añadió compatibilidad aditiva para bases existentes que aún no tengan `alerts.prioridad` y `alerts.enviado_en`; la prueba de migraciones comprueba que se conservan los datos.
- El setup de pruebas backend usa SQLite nativo. Se corrigieron fixtures y contratos obsoletos, además de defectos encontrados en actualización de exámenes, fechas de certificados, consultas de alertas y protección de datos médicos.
- Pruebas focalizadas backend: 80/80 entre servicios de trabajadores/alertas y migraciones; 53/53 en rutas de políticas, peligros y trabajadores.
- Suite completa backend: 193/193 pruebas pasan.
- Instalación del workspace con `corepack pnpm install --frozen-lockfile`: pasa con Node 24.16.0 y pnpm 9.15.0; Node 22 es la versión objetivo de `.nvmrc` y CI, por el uso de `node:sqlite`. El lockfile raíz refleja los tres workspaces y las dependencias configuradas de lint/formato.
- Suite frontend actual: 49/49 pruebas en 7 archivos. Se alinearon los tests de Login, Dashboard, Estándares, Política, Peligros y Trabajadores con las respuestas JSON directas y las rutas/controles actuales; se añadió cobertura para errores HTTP y para la vista de Política sin versión vigente. Se retiró `tests/hooks/useAuth.test.ts`, que importaba un hook/contexto inexistentes y probaba una interfaz anterior.
- Typechecks de servidor y web, builds de producción de ambos workspaces y suite backend 193/193 pasan. `web/src/lib/api.ts` ahora propaga los estados HTTP no exitosos, incluidos errores de carga de archivos. Política toma la versión vigente de la lista de políticas para no depender de un 404 cuando no hay ninguna vigente.
- Se recorrieron las 17 rutas principales; la vista Política se recargó en navegador y mostró el estado vacío esperado sin solicitar `/policies/active`. Permanecen advertencias conocidas de React Router y de `listen` en Fastify.
- La configuración ya declara las dependencias de sus plugins Prettier/ESLint y excluye `**/dist/**` del lint. Aun así, el lint global sigue fallando con 258 errores y 500 advertencias, y `format:check` reporta 103 archivos sin formato. No se aplicó un reformateo masivo ni se corrigió deuda ajena a los cambios actuales; cerrar esta línea base sigue pendiente.
- Sigue pendiente confirmar con la empresa clase de riesgo, número de trabajadores y demás datos; la clase V de la semilla es demostrativa y no debe usarse como dato real.
- Existe una semilla de demostración que asigna clase de riesgo V. No asumir que esa clase corresponde a la empresa real; confirmar con el usuario y/o documentación de la ARL antes de configurar estándares o usar resultados como evidencia.
- La PWA tiene configuración de caché, pero eso no demuestra operación sin conexión ni sincronización de formularios.
- La documentación de despliegue describe opciones; no confirma que exista un entorno productivo, monitoreo o respaldo automático ya funcionando.

El resumen anterior es el punto de continuidad; verificar cambios posteriores con las validaciones anotadas en el registro antes de marcar terminada la Fase 1.

## Datos por confirmar con la empresa

Antes de configurar información normativa, cargar datos reales o desplegar, resolver estas preguntas (máximo ocho):

1. ¿Cuál es la clase de riesgo reportada por la ARL y cuántos trabajadores hay actualmente?
2. ¿Qué documentos SG-SST ya existen y cuáles necesitan digitalizarse?
3. ¿Qué hojas, columnas y formatos contienen los Excel actuales? Solicitar una copia anonimizada si se necesita mapearlos.
4. ¿Quién es el responsable SG-SST? ¿Cuenta con licencia y formación requeridas y vigentes?
5. ¿Hay Vigía SST, COPASST y/o Comité de Convivencia constituido, según aplique?
6. ¿Qué canal de alertas se prefiere (correo u otro) y quién administrará sus credenciales?
7. ¿Dónde se alojará la aplicación y quién tendrá acceso a los respaldos?
8. ¿Cuál es el presupuesto disponible para alojamiento, correo y mantenimiento?

Si no hay respuesta, usar datos ficticios de demostración, marcar supuestos explícitamente y no presentar la configuración o los documentos generados como cumplimiento legal verificado.

## Fases y criterios de aceptación

Las estimaciones son días-persona de desarrollo, no fechas calendario. No incluyen el tiempo de respuesta de la empresa, la ARL ni la revisión profesional SST.

### Fase 0 — Alineación, alcance y validación normativa

**Estimación:** 1–3 días-persona, más el tiempo de revisión externa.

- [ ] Recoger las respuestas anteriores y acordar alcance del MVP, presupuesto y alojamiento.
- [ ] Verificar vigencia y aplicabilidad normativa en fuentes oficiales y confiables; registrar enlaces, fecha de consulta y asuntos por validar.
- [ ] Confirmar clase de riesgo, número de trabajadores y estándar aplicable; corregir cualquier valor de demostración que pueda confundirse con el real.
- [ ] Comparar 2–3 alternativas de stack/operación con costos aproximados y recomendar la opción de menor mantenimiento compatible con privacidad y respaldo.
- [ ] Definir modelo de datos, pantallas y flujo de usuario a partir de las tareas reales y de los archivos que entregue la empresa.
- [ ] Identificar qué plantillas, evaluaciones y resultados requieren revisión de profesional SST con licencia vigente antes de usarse oficialmente.

**Aceptación:** decisiones, supuestos, fuentes oficiales, alcance del MVP y responsables de revisión quedan documentados; no se afirma cumplimiento normativo sin evidencia.

### Fase 1 — Línea base técnica, pruebas y confiabilidad

**Estimación:** 3–6 días-persona.

- [x] Asegurar instalación reproducible con la versión de Node y pnpm documentadas (`corepack pnpm install --frozen-lockfile`).
- [x] Hacer que las migraciones se resuelvan correctamente desde desarrollo, pruebas y build de producción; cubrir columnas de alertas para bases existentes.
- [x] Corregir el setup y mocks de pruebas para reflejar los contratos reales de API.
- [x] Ejecutar y estabilizar pruebas unitarias, integración y componentes; registrar fallos restantes y su causa.
- [x] Ejecutar typecheck y builds de frontend y servidor sin errores.
- [x] Revisar errores de consola/API y flujos principales, sin cambiar comportamiento no relacionado.
- [ ] Resolver la línea base de lint y formato antes de cerrar los controles de calidad de CI.

**Aceptación:** instalación limpia, migraciones repetibles, typecheck/build exitosos y pruebas reproducibles con resultados documentados.

### Fase 2 — MVP funcional de planeación y seguimiento

**Estimación:** 5–9 días-persona.

- [ ] Autoevaluación configurable de Estándares Mínimos: evaluación por ítem, observaciones/evidencias, puntaje calculado de forma consistente y acciones de mejora para incumplimientos.
- [ ] Matriz de peligros: catálogo pertinente al trabajo, tareas/exposición, controles y valoración; confirmar metodología con profesional SST antes de tomarla como oficial.
- [ ] Plan anual: actividades, responsable, fecha, recursos/presupuesto, estado y seguimiento de vencimientos.
- [ ] Ficha de trabajadores: afiliaciones y registro de exámenes, certificados, capacitaciones y EPP, con alertas por vencimiento y firmas donde correspondan.
- [ ] Registro e investigación de incidentes/accidentes con seguimiento de acciones y recordatorios; todo plazo normativo debe verificarse y citar fuente.
- [ ] Dashboard que derive sus cifras de datos persistidos y muestre cumplimiento, acciones y vencimientos sin confundir datos faltantes con cumplimiento.
- [ ] Formularios validados y mensajes claros para permisos, errores de red y datos inválidos.

**Aceptación:** un administrador puede completar el flujo con información de prueba, cerrar y volver a abrir la sesión y comprobar que la información persiste; los cálculos se prueban con casos conocidos y el tablero coincide con los registros.

### Fase 3 — Ejecución en campo y evidencias

**Estimación:** 4–7 días-persona.

- [ ] Completar capacitaciones e inducciones: asistentes, fecha, contenido y evidencia adjunta.
- [ ] Completar inspecciones móviles para herramientas, EPP, escaleras, arneses, vehículo, botiquín, extintores y obra, priorizando los riesgos reales de la empresa.
- [ ] Completar permisos de trabajo en alturas y ATS por obra/instalación con firmas y controles aplicables.
- [ ] Incorporar plan de emergencias y registro de simulacros.
- [ ] Incorporar gestión de cambios y evaluación/requisitos de contratistas y proveedores.
- [ ] Verificar adjuntos, captura de fotos y firmas en dispositivos móviles; definir límites, formatos y manejo de errores.

**Aceptación:** cada flujo deja una evidencia recuperable y asociada a responsable/fecha; formularios de campo funcionan en tamaños de pantalla móviles y no declaran una tarea completada sin guardar correctamente.

### Fase 4 — Privacidad, permisos, trazabilidad y continuidad

**Estimación:** 4–7 días-persona.

- [ ] Revisar autorización, finalidad, acceso y auditoría del tratamiento de datos personales y sensibles.
- [ ] Diseñar e implementar controles adecuados para datos médicos y documentos adjuntos (cifrado en tránsito y en reposo cuando aplique, secretos fuera del código, acceso mínimo); documentar límites y operación.
- [ ] Verificar autorización del servidor en cada endpoint, no solo ocultamiento de controles en la interfaz; comprobar los roles administrador y trabajador.
- [ ] Asegurar bitácora consistente de cambios relevantes, actor, fecha y entidad, evitando exponer información médica innecesaria en los logs.
- [ ] Configurar respaldos automáticos de base de datos y adjuntos, retención y protección de copias.
- [ ] Probar restauración en un entorno separado y documentar el procedimiento.
- [ ] Implementar soporte sin conexión y sincronización solo si se acuerdan resolución de conflictos, datos locales y riesgos; la caché PWA por sí sola no satisface este requisito.

**Aceptación:** pruebas de acceso por rol pasan; los datos sensibles no se filtran en vistas/logs sin autorización; un respaldo se restaura con verificación de integridad; el alcance real de cifrado y modo offline queda descrito.

### Fase 5 — Verificación, documentos, importación y exportación

**Estimación:** 3–6 días-persona.

- [ ] Completar auditoría interna anual y revisión por la dirección con hallazgos y seguimiento.
- [ ] Consolidar acciones correctivas, preventivas y de mejora con responsable, vencimiento, estado y evidencia.
- [ ] Validar exportes de autoevaluación, plan anual, matriz de riesgos, indicadores, incidentes, política y listado de evidencias.
- [ ] Añadir Excel cuando sea necesario para cumplir el alcance; verificar contenido, encabezados, fechas, caracteres y totales en PDF/Excel.
- [ ] Entregar plantilla de importación y mapeo de columnas basado en los Excel reales; previsualizar errores antes de confirmar y no perder filas silenciosamente.
- [ ] Verificar gestión documental: versiones, listado maestro, estados y reglas de retención con fuentes normativas validadas.

**Aceptación:** documentos exportados coinciden con la información persistida, identifican empresa/fecha/filtros relevantes y se pueden abrir; importaciones presentan resumen verificable de filas aceptadas/rechazadas sin duplicar registros involuntariamente.

### Fase 6 — Aceptación de usuario, despliegue y operación

**Estimación:** 2–4 días-persona, más pruebas de aceptación del usuario.

- [ ] Ejecutar pruebas de extremo a extremo desde inicio de sesión hasta guardado, alertas y exportación.
- [ ] Probar los casos principales con el responsable SST y corregir problemas de usabilidad, español de Colombia y accesibilidad móvil.
- [ ] Completar guía corta de uso, procedimiento de respaldo/restauración y guía de despliegue que coincidan con el stack real.
- [ ] Preparar ambiente productivo, dominio/HTTPS, secretos, correo, permisos de archivos y política de actualización.
- [ ] Confirmar monitoreo/health check, responsable operativo, periodicidad de respaldo y procedimiento de incidentes.
- [ ] Cargar datos reales solo tras aprobación, revisar resultados con profesional SST y hacer una prueba de recuperación antes de declarar el sistema listo.

**Aceptación:** responsable designado completa tareas acordadas sin asistencia técnica continua; build de producción se ejecuta en el entorno elegido; se verifica acceso seguro, notificaciones, exportes y restauración de respaldo.

## Orden de prioridad

1. Fase 0: confirmar datos de empresa y alcance antes de tomar decisiones normativas.
2. Fase 1: hacer confiable el proyecto y sus pruebas.
3. Fase 2: completar el MVP PHVA y probar cálculos/datos de punta a punta.
4. Fase 4 en paralelo con datos reales: proteger información antes de cargarlos.
5. Fases 3 y 5: cerrar actividades/evidencias y reportes.
6. Fase 6: aceptación de usuario y despliegue.

Las tareas de seguridad y privacidad son condición previa al uso con datos reales, aunque su fase técnica pueda ejecutarse en paralelo con el MVP.

## Reglas para actualizar este plan

- Al iniciar cada sesión de trabajo, leer este archivo y [`PROMPT_MAESTRO.md`](./PROMPT_MAESTRO.md), revisar el estado real del repositorio y retomar el siguiente criterio pendiente.
- No marcar una tarea como terminada solo porque exista un archivo, pantalla, endpoint o documentación: comprobar el flujo y sus pruebas.
- Actualizar casillas, hallazgos, fecha y riesgos al completar cada fase; anotar el comando ejecutado y el resultado de validación.
- Mantener los cambios acotados, no sobrescribir trabajo ajeno y no afirmar cumplimiento legal sin fuente y revisión profesional correspondiente.
- Distinguir funciones listas para pruebas de funciones aprobadas para operación y de funciones validadas como evidencia oficial.

## Estimación global inicial

Con el código actual como punto de partida, el esfuerzo restante se estima preliminarmente en **22–42 días-persona de ingeniería**, más decisiones del usuario, revisión normativa/profesional SST, migración de sus datos y pruebas de aceptación. Esta banda debe recalibrarse después de estabilizar las pruebas y evaluar cada flujo existente. No constituye una fecha de entrega ni una certificación de cumplimiento.

## Registro de avance

| Fecha | Hito | Resultado / siguiente paso |
|---|---|---|
| 2026-11-07 | Plan inicial y revisión preliminar | Código y módulos base presentes; suites de prueba backend/frontend fallan en la ejecución observada. Iniciar por Fase 0 y reproducir la línea base de Fase 1. |
| 2026-11-07 | Estabilización técnica inicial | Migraciones compatibles, harness SQLite y defectos acotados de trabajadores/alertas corregidos; suite backend 193/193 y typecheck/build de ambos proyectos pasan. Frontend 64 fallos/9 éxitos: actualizar primero los mocks al JSON directo de `api.get`, luego alinear rutas/expectativas que correspondan a la interfaz actual. Instalar pnpm reproduciblemente y completar la Fase 1 después de validar la suite web. |
| 2026-11-07 | Estabilización de pruebas frontend | Política 14/14, Peligros 5/5, Trabajadores 8/8; suite frontend completa 46/46 en 7 archivos y `npm run typecheck` web pasa. Se retiró el test huérfano `useAuth.test.ts` porque el hook/contexto importados no existen en el código actual. Fase 1 sigue abierta: instalar pnpm de forma reproducible y revisar errores de consola/API y flujos principales; no se repitió build en esta sesión. |
| 2026-11-07 | Instalación, API y política | Instalación congelada pasa; pnpm 9.15.0 fijado en la guía, Node 22 en CI. Backend 193/193, frontend 49/49, typechecks y builds pasan. Errores HTTP se propagan y Política evita el 404 opcional; estado vacío comprobado en navegador. Se añadieron dependencias faltantes de las configuraciones Prettier/ESLint y se corrigió el ignore de `dist`; el lint aún reporta 258 errores/500 advertencias y Prettier 103 archivos pendientes, por lo que la Fase 1 sigue abierta. |
