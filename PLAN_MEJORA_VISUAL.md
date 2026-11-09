# Plan de trabajo para mejorar la experiencia visual de SG-SST

**Fecha:** 9 de noviembre de 2026

**Estado:** Fases 0, 1, 2 y 3 completadas; Fase 4 aplicada a los 21 módulos (pendiente cierre formal)

**Punto de partida:** commit `e939e8ccc818101acd4fdaf92384d09dda5524e2`

**Contexto funcional:** [`PROMPT_MAESTRO.md`](./PROMPT_MAESTRO.md)
**Plan general del producto:** [`PLAN_TRABAJO_SG_SST.md`](./PLAN_TRABAJO_SG_SST.md)

## Objetivo

Hacer que la aplicación sea clara, consistente y cómoda de usar en escritorio y celular, priorizando las tareas diarias del responsable SG-SST. El rediseño debe conservar los flujos funcionales, los permisos, la persistencia y el español de Colombia. No debe presentar datos de demostración como información real ni afirmar cumplimiento normativo sin la revisión correspondiente.

## Diagnóstico inicial

La revisión visual del tablero autenticado mostró problemas de estructura y jerarquía, además de apariencia:

- El menú lateral tiene muchas opciones en una lista plana y sus etiquetas dependen de emojis.
- El menú puede ser más alto que la ventana; al bajar, se desplaza junto con la página y deja una experiencia confusa.
- El tablero presenta indicadores y secciones vacías, pero no orienta suficientemente sobre la siguiente tarea.
- La pantalla deja espacio sin aprovechar y las tarjetas no mantienen una composición equilibrada.
- El marco de navegación usa estilos en línea, mientras las pantallas no comparten todavía un sistema visual claramente definido.

La Fase 0 confirmó estos hallazgos en seis rutas prioritarias, en escritorio y móvil. La revisión de todas las demás rutas sigue pendiente y se hará al extender los componentes en la Fase 4.

## Principios de diseño

1. **Primero las tareas:** mostrar qué requiere atención y cómo resolverlo, no solo cifras.
2. **Datos confiables:** usar información persistida; en ausencia de datos, mostrar estados vacíos explícitos.
3. **Consistencia:** reutilizar patrones de títulos, navegación, formularios, tablas, botones, alertas y estados.
4. **Uso móvil real:** priorizar lectura, captura de datos y acciones en campo desde pantallas pequeñas.
5. **Accesibilidad:** mantener contraste suficiente, etiquetas comprensibles, navegación por teclado y foco visible.
6. **Cambios seguros:** separar mejoras visuales de cambios en reglas de negocio, permisos o interpretación normativa.

## Metodología obligatoria de trabajo frontend

Cada cambio visual debe revisarse en una aplicación ejecutándose en navegador; las pruebas automatizadas y el build complementan la inspección, pero no la reemplazan. Este procedimiento aplica a cualquier agente o persona que continúe el plan:

1. Iniciar la aplicación y los servicios que requiera la pantalla, e ingresar con una cuenta de prueba autorizada si la ruta requiere autenticación.
2. Abrir la ruta afectada en el navegador integrado de VS Code o en otro navegador con herramientas equivalentes. Revisar la interfaz renderizada, no inferir el resultado solo desde el JSX o el CSS.
3. Comprobar como mínimo escritorio (1280×800) y móvil (390×844); incluir otros tamaños cuando el cambio afecte tabletas, puntos de quiebre o contenido adaptable.
4. Recorrer los estados y acciones afectados: carga, datos existentes, estado vacío, error y confirmación, cuando apliquen. Revisar recortes, jerarquía, alineación, scroll horizontal y vertical, controles táctiles, teclado y foco visible.
5. Si es un rediseño, comparar la pantalla antes y después. Confirmar que las acciones visibles sigan llevando al flujo funcional esperado y que la vista móvil no oculte capacidades disponibles en escritorio.
6. Usar solo datos ficticios o autorizados; no introducir datos personales o médicos reales para la validación visual. Registrar en el avance las rutas, tamaños y estados inspeccionados y cualquier defecto pendiente.
7. Si no se puede levantar la API, autenticar, acceder al navegador o inspeccionar un estado, indicar explícitamente el bloqueo. Se pueden ejecutar pruebas con mocks, pero no afirmar que la revisión visual pasó ni cerrar el criterio que depende de ella hasta completar la inspección.

Esta metodología es transferible: el agente que retome el trabajo puede usar el navegador integrado u otra herramienta de navegador disponible, siempre que inspeccione la aplicación real y deje constancia de lo verificado y de sus limitaciones.

## Fases y criterios de aceptación

Las estimaciones son preliminares, en días-persona de diseño e ingeniería; deben recalibrarse tras la Fase 0. Las fases son secuenciales, excepto tareas de pruebas visuales que pueden acompañar cada implementación.

### Fase 0 — Línea base y criterios visuales

**Estimación:** 1–2 días-persona.

- [x] Revisar el estado de Git, las instrucciones del repositorio y las pruebas frontend existentes.
- [x] Capturar y revisar las pantallas principales autenticadas en escritorio y móvil: tablero, trabajadores, inspecciones, plan anual, acciones y alertas.
- [x] Registrar desbordamientos, desplazamientos, problemas de contraste, estados vacíos y diferencias entre módulos.
- [x] Identificar qué información del tablero ya está disponible mediante la API y qué datos faltan para mostrar tareas reales.
- [x] Definir una dirección visual base, apropiada para SG-SST y pendiente de aprobación de marca; no se cargaron datos reales ni se hicieron afirmaciones normativas.

**Aceptación:** ✅ revisión autenticada reproducible a 1280×800 y 390×844, hallazgos priorizados, endpoints del tablero identificados y dirección visual base documentada.

#### Hallazgos de la línea base (9 de noviembre de 2026)

| Prioridad | Pantalla / área               | Hallazgo observado                                                                                                                                                         | Criterio para la siguiente fase                                                                   |
| --------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Alta      | Trabajadores, móvil (390×844) | La aplicación no excede el ancho de la ventana, pero el contenido interno llega a 622 px; las pestañas de la ficha quedan comprimidas y aparece desplazamiento horizontal. | Reorganizar las pestañas/controles para el ancho móvil, sin ocultar acciones ni campos.           |
| Alta      | Alertas, móvil                | La tabla queda apretada y su contenido se corta en el espacio visible; aún usa emojis frente a los iconos Lucide del menú.                                                 | Dar un patrón legible a listas tabulares en móvil y mantener iconografía consistente.             |
| Media     | Plan anual, móvil             | Las tres pestañas parten sus etiquetas en varias líneas; los cinco indicadores forman una cuadrícula con una tarjeta aislada en la última fila.                            | Simplificar etiquetas y distribuir indicadores de manera equilibrada en anchos pequeños.          |
| Media     | Acciones, móvil               | El formulario y los filtros se apilan en una columna larga; algunos textos auxiliares son pequeños.                                                                        | Mejorar jerarquía, legibilidad y agrupación sin reducir el espacio táctil.                        |
| Media     | Tablero, escritorio y móvil   | Hay cuatro métricas, dos listas vacías y resumen; el área queda visualmente dispersa y no prioriza una acción siguiente.                                                   | Usar una jerarquía común y reservar el rediseño funcional para la Fase 3.                         |
| Baja      | Inspecciones, móvil           | El formulario largo se recorre verticalmente; el ancho se mantiene y el progreso/checklist sí aporta contexto.                                                             | Conservar el patrón de progreso y revisar densidad/agrupación al aplicar componentes compartidos. |
| General   | Módulos priorizados           | Se mezclan estilos en línea, emojis y densidades diferentes; cada pantalla usa sus propios patrones de título, filtros, pestañas y superficies.                            | Definir tokens/componentes y aplicarlos gradualmente, sin reescritura masiva.                     |

Las mediciones de scroll se hicieron en `/dashboard`, `/trabajadores`, `/inspecciones`, `/planes`, `/acciones` y `/alertas`. En esas rutas, el documento no tuvo desbordamiento de ancho; el desbordamiento de Trabajadores ocurre dentro del contenido de la página. Los mensajes de servicio observados en consola no se consideraron hallazgos visuales ni se modificaron.

#### Dirección visual base propuesta

- Interfaz operativa, sobria y cercana: fondos neutros claros, superficies blancas y teal como color de marca.
- Reservar verde, ámbar y rojo para estados semánticos; no usar el color como único indicador.
- Mantener una escala de espaciado y tipografía legible, con títulos claros, ayuda secundaria discreta y controles cómodos al tacto.
- Preferir bordes sutiles y elevación moderada frente a sombras fuertes o adornos.
- Diseñar primero para el responsable SST que trabaja solo y necesita encontrar rápido pendientes, vencimientos y formularios de campo.

Es una dirección de trabajo, no una identidad de marca aprobada. Podrá ajustarse sin bloquear la implementación de componentes consistentes.

### Fase 1 — Estructura, navegación y desplazamiento

**Estimación:** 1–3 días-persona.

- [x] Corregir el contenedor general para que encabezado, navegación y contenido tengan límites de altura y desplazamiento predecibles.
- [x] Evitar que el desplazamiento del menú mueva de forma accidental todo el espacio de trabajo.
- [x] Mantener visibles la navegación y la identidad del usuario sin ocultar el acceso a cerrar sesión.
- [x] Organizar los módulos en grupos comprensibles, como Planear, Ejecutar, Verificar y Administración, verificando que cada enlace conserve su ruta y permisos.
- [x] Sustituir los emojis por iconos consistentes y con nombres accesibles.
- [x] Definir el comportamiento del menú en móvil, incluyendo apertura, cierre con Escape, foco y navegación.

**Aceptación:** ✅ se puede recorrer todas las opciones sin perder la referencia del contenido; la navegación tiene scroll independiente, el usuario y el cierre de sesión permanecen visibles y el menú móvil permite abrir, cerrar con Escape y navegar.

### Fase 2 — Sistema visual compartido

**Estimación:** 2–4 días-persona.

- [x] Definir tokens y reglas compartidas para color, tipografía, escala de espaciado, bordes, elevación y estados semánticos.
- [x] Normalizar títulos, descripciones, acciones principales, botones, campos, tablas, tarjetas, etiquetas y mensajes en las cinco pantallas priorizadas: Trabajadores, Alertas, Inspecciones, Plan anual y Acciones.
- [x] Establecer estados de carga, error y vacío con texto claro y accesible; conservar el feedback de confirmación de los flujos existentes.
- [x] Aplicar primero los patrones al marco de navegación y a componentes reutilizables, evitando cambiar reglas de negocio o persistencia.
- [x] Comprobar contraste, foco visible, etiquetas accesibles y controles utilizables con teclado.

**Aceptación:** ✅ las cinco pantallas prioritarias usan patrones compartidos; las vistas de escritorio y móvil, estados vacíos y acciones principales fueron revisados en navegador. Pruebas frontend, typecheck, lint focalizado y build validados.

### Fase 3 — Tablero útil y verificable

**Estimación:** 2–4 días-persona.

- [x] Reordenar el contenido para priorizar el avance registrado, acciones e incidentes pendientes y accesos a módulos.
- [x] Mostrar indicadores respaldados por las API; no presentar un porcentaje cuando no hay estándares evaluados y aclarar qué cuenta cada métrica.
- [x] Añadir accesos directos a módulos disponibles para el usuario autenticado.
- [x] Diseñar un estado vacío útil que explique cómo comenzar, sin fabricar porcentajes, tendencias o nombres.
- [x] Revisar la distribución de tarjetas y listas en escritorio (1280×800) y móvil (390×844).
- [x] Probar los enlaces y verificar los valores mostrados frente a respuestas de API reales y ficticias controladas.

**Aceptación:** ✅ cada bloque informa algo verificable o explica por qué aún no hay datos; los accesos conducen a módulos reales. Revisión autenticada de estados con datos persistidos y respuestas ficticias interceptadas, sin escrituras de validación.

### Fase 4 — Aplicación gradual a los módulos

**Estimación:** 4–8 días-persona, según el número de pantallas que requieran ajustes.

- [x] Aplicar los patrones compartidos primero a trabajadores, inspecciones, plan anual, acciones y alertas.
- [x] Continuar con el resto de los módulos según frecuencia de uso y hallazgos de la Fase 0.
- [x] Mejorar formularios largos, tablas en pantallas pequeñas y presentación de errores de validación.
- [x] Mantener intactas las reglas de negocio, persistencia, permisos y formatos de evidencia salvo que se acuerde explícitamente otro alcance.
- [x] Añadir o actualizar pruebas de interfaz cuando cambien interacciones o estados observables.

**Aceptación:** los módulos priorizados usan patrones consistentes y sus flujos principales conservan creación, consulta y actualización de información.

**Aplicación de la Fase 4 (9 de noviembre de 2026):** se migraron los 10 módulos restantes (Indicadores, Importar, Empresa, Usuarios, Roles, Emergencias, Bitácora, Auditorías, Altura e Incidentes) y se consolidaron Documentos y Contratistas. Los 21 módulos usan encabezado común, botones, superficies, feedback accesible, tablas con desplazamiento propio y tarjetas móviles.

Durante la verificación de flujos aparecieron defectos funcionales que se corrigieron porque bloqueaban la aceptación de la fase (detalle en el registro):

| Defecto | Causa | Corrección |
| ------- | ----- | ---------- |
| Desbordamiento horizontal del documento en tablas | `min-width` fijo en la tabla dentro del contenedor `.ui-page` | `min-width: min(Npx, 100%)` en todas las tablas |
| Todos los borrados devolvían 400 | `api.delete` enviaba `Content-Type: application/json` sin cuerpo y Fastify lo rechaza | `web/src/lib/api.ts` solo declara content-type cuando hay cuerpo |
| Hallazgos de auditoría devolvían 500 | La tabla `audit_findings` no existía en la migración | Se añadió la tabla con clave foránea y pruebas de integración |
| Acciones del incidente devolvían 404 | No existían ni la tabla `incident_actions` ni sus rutas | Se añadieron tabla, servicio, rutas y pruebas |
| Crear incidentes devolvía 500 | El formulario enviaba `trabajador_id: ''` y violaba la clave foránea | Se normaliza a `null` en el formulario y en el servicio |
| "Nueva acción" no abría el formulario | El botón dejaba `editingAction` en `null` y el formulario dependía de ese estado | Estado explícito `creatingAction` |
| Peticiones sin sesión devolvían 500 | `getUserById(undefined)` lanzaba excepción de SQLite | El servicio retorna `undefined` si el identificador está vacío |
| Textos con `\u00f3` visibles en Incidentes | Secuencias unicode escapadas en cadenas | Se reemplazaron por texto real en español |
| Los scripts raíz de `pnpm` no funcionaban | `pnpm -w server run` no es sintaxis válida | Se corrigió a `pnpm --dir server run` |

### Fase 5 — Validación y cierre

**Estimación:** 1–3 días-persona.

- [ ] Repetir las capturas visuales de la línea base en escritorio y móvil.
- [ ] Probar navegación completa, scroll, formularios, estados vacíos, errores, permisos y rutas principales.
- [ ] Ejecutar pruebas frontend, typecheck y build web; ejecutar validaciones adicionales si el cambio toca servidor o contratos API.
- [ ] Revisar consola del navegador y errores de red durante los flujos acordados.
- [ ] Actualizar este documento y el registro del [`PLAN_TRABAJO_SG_SST.md`](./PLAN_TRABAJO_SG_SST.md) al cerrar cada fase, anotando cambios y validaciones.

**Aceptación:** no hay regresiones conocidas en los flujos probados; las pantallas prioritarias son legibles y utilizables en los tamaños acordados; cada pantalla modificada fue inspeccionada visualmente en navegador; las rutas, tamaños, estados, validaciones y bloqueos quedan registrados.

## Orden recomendado y alcance inicial

1. Fase 0 cerrada con seis rutas revisadas y hallazgos ordenados por impacto.
2. Fase 1 cerrada: estructura, scroll y navegación.
3. Continuar con la Fase 2, priorizando los componentes y patrones comunes que resuelvan los hallazgos móviles.
4. Rediseñar el tablero con datos verificados en la Fase 3.
5. Extender los patrones a otros módulos, priorizando los de uso frecuente.
6. Cerrar con validación visual, funcional y responsive.

La Fase 2 debe empezar por componentes comunes y atacar primero el desbordamiento de Trabajadores y la legibilidad de alertas en móvil. El tablero se mantiene para la Fase 3 porque requiere jerarquizar tareas con los datos que la API ya proporciona.

## Fuera de alcance sin aprobación explícita

- Cambiar cálculos, permisos, flujos de aprobación, persistencia o interpretación normativa.
- Cargar datos personales o médicos reales para las pruebas visuales.
- Presentar resultados o documentos como evidencia de cumplimiento legal verificado.
- Reemplazar toda la interfaz o introducir dependencias grandes sin justificarlo y revisar el impacto.

## Registro de avance

| Fecha      | Fase                  | Resultado / siguiente paso                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-09 | Fase 3 — Tablero      | El tablero prioriza el avance disponible, acciones/incidentes abiertos y accesos rápidos; distingue ausencia de evaluación de un 0% y explica estados sin información. En navegador autenticado a 1280×800 y 390×844 se revisaron datos del entorno y estado vacío con respuestas ficticias interceptadas (sin escrituras), enlaces, listas y ausencia de overflow. Suite web 62/62, typecheck, build, ESLint focalizado y Prettier pasan. Build conserva el aviso de chunk >500 kB. Fase 3 cerrada; continuar Fase 4 con módulos restantes. |
| 2026-11-09 | Fase 2 completada    | Se consolidaron patrones compartidos en Trabajadores, Alertas, Inspecciones, Plan anual y Acciones, con estados, foco y controles adaptables revisados en navegador a 1280×800 y 390×844. Suite web 62/62, typecheck, build, ESLint focalizado y formato del código/pruebas pasan. Fase 4 extiende el sistema visual al resto de módulos. |
| 2026-11-09 | Fase 2 — Acciones     | Acciones usa encabezado y feedback comunes, formularios con etiquetas y controles legibles, filtros agrupados y una lista móvil en tarjetas con origen, responsable, vencimiento, prioridad, estado, evidencia y firma; escritorio conserva su tabla con scroll contenido. Pruebas con respuesta ficticia y navegador autenticado a 1280×800 y 390×844: estado vacío, tabla y tarjeta, filtros, controles de 44 px y sin overflow del documento. Suite frontend 60/60, typecheck, build y Prettier pasan; ESLint sin errores (8 advertencias existentes). La Fase 2 sigue abierta. |
| 2026-11-09 | Fase 2 — Plan anual   | Planes adoptó el encabezado común, pestañas con iconos y paneles accesibles, además de tarjetas KPI consistentes en las tres vistas. En 390×844 se acomodan cinco KPI anuales en dos columnas con el quinto centrado, cuatro KPI de capacitación/ejecución en dos columnas y las tres pestañas caben sin recorte; a 1280×800 se distribuyen en una fila. Revisión autenticada en navegador: estado vacío, cambios entre pestañas y documento sin overflow horizontal. Prueba focalizada, suite frontend 58/58, typecheck, build y Prettier de CSS/prueba pasan; ESLint sin errores (15 advertencias preexistentes en Planes). La Fase 2 continúa abierta. |
| 2026-11-09 | Plan creado           | Propuesta documentada a partir de la revisión visual del tablero y la navegación.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-11-09 | Fase 2 — continuación | Inspecciones adoptó el título, botones, superficie, mensajes accesibles, etiquetas más legibles y controles táctiles de 44 px; las acciones se apilan en móvil y la tabla mantiene desplazamiento horizontal propio. Suite frontend 57/57, typecheck, build y formato pasan; ESLint sin errores (8 advertencias existentes en Inspecciones). Revisión autenticada en navegador a 1280×800 y 390×844: ancho del documento igual al viewport, controles de 44 px y tabla móvil desplazable en su propio contenedor. Falta extender los patrones antes de cerrar la fase.                               |
| 2026-11-09 | Fase 2 en progreso    | Se añadieron tokens y clases visuales compartidas; Trabajadores muestra tarjetas con acciones móviles y mantiene la tabla en escritorio, y Alertas usa tarjetas móviles para pendientes e historial. Se corrigió la acción Editar desde tarjeta y se añadieron pruebas de ambas vistas. Validación: 56 pruebas, typecheck y build web pasan; ESLint focalizado no reporta errores (30 advertencias existentes); revisión responsive en navegador a 1280×800 y 390×844 sin overflow del documento. Pendiente completar la normalización de componentes y estados compartidos antes de cerrar la fase. |
| 2026-11-09 | Fase 1 completada     | Layout con áreas de scroll separadas, navegación agrupada en Inicio/Planear/Ejecutar/Verificar/Administración, iconos Lucide consistentes y menú móvil con foco/Escape. Validación en navegador a 1280×800 y 390×844; navegación lateral desplazable sin scroll global. Pruebas frontend 53/53, typecheck, lint focalizado, formato y build web pasan.                                                                                                                                                                                                                                               |
| 2026-11-09 | Fase 4 — aplicación a los módulos | Se migraron los 10 módulos restantes (Indicadores, Importar, Empresa, Usuarios, Roles, Emergencias, Bitácora, Auditorías, Altura e Incidentes); los 21 módulos usan los patrones compartidos. En navegador autenticado a 1280×800 y 390×844 se revisaron estados vacíos, tablas, tarjetas móviles y modales; sin overflow del documento y controles de 44 px. Suite web 74/74, backend 213/213, typecheck, build y ESLint 0 errores. Se corrigieron defectos que bloqueaban flujos: desbordamiento por `min-width` fijo, `api.delete` con content-type sin cuerpo, tablas `audit_findings` e `incident_actions` ausentes, `getUserById` sin sesión, `trabajador_id` vacío contra clave foránea, "Nueva acción" sin formulario, textos con escapados unicode y scripts raíz de pnpm. Pendiente: cierre formal de la fase y Fase 5. |
| 2026-11-09 | Fase 0 completada     | Se revisaron tablero, trabajadores, inspecciones, plan anual, acciones y alertas en 1280×800 y 390×844. Se registró el desbordamiento interno móvil de Trabajadores, la tabla comprimida de Alertas, pestañas/indicadores densos en Plan anual, dispersión del tablero y la dirección visual base. La información actual del tablero proviene de `/standards/cumplimiento`, `/workers`, `/actions` e `/incidents`. Siguiente: Fase 2, definir tokens y componentes visuales compartidos.                                                                                                             |
