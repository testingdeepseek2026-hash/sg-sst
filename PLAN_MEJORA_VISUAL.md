# Plan de trabajo para mejorar la experiencia visual de SG-SST

**Fecha:** 9 de noviembre de 2026

**Estado:** Fase 1 completada; diagnóstico de Fase 0 pendiente de cerrar

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

Este diagnóstico es preliminar. La Fase 0 debe confirmar los comportamientos en las rutas principales, con distintos tamaños de pantalla y estados de datos, antes de generalizarlo.

## Principios de diseño

1. **Primero las tareas:** mostrar qué requiere atención y cómo resolverlo, no solo cifras.
2. **Datos confiables:** usar información persistida; en ausencia de datos, mostrar estados vacíos explícitos.
3. **Consistencia:** reutilizar patrones de títulos, navegación, formularios, tablas, botones, alertas y estados.
4. **Uso móvil real:** priorizar lectura, captura de datos y acciones en campo desde pantallas pequeñas.
5. **Accesibilidad:** mantener contraste suficiente, etiquetas comprensibles, navegación por teclado y foco visible.
6. **Cambios seguros:** separar mejoras visuales de cambios en reglas de negocio, permisos o interpretación normativa.

## Fases y criterios de aceptación

Las estimaciones son preliminares, en días-persona de diseño e ingeniería; deben recalibrarse tras la Fase 0. Las fases son secuenciales, excepto tareas de pruebas visuales que pueden acompañar cada implementación.

### Fase 0 — Línea base y criterios visuales

**Estimación:** 1–2 días-persona.

- [ ] Revisar el estado de Git, las instrucciones del repositorio y las pruebas frontend existentes.
- [ ] Capturar y revisar las pantallas principales autenticadas en escritorio y móvil: tablero, trabajadores, inspecciones, plan anual, acciones y alertas.
- [ ] Registrar desbordamientos, desplazamientos, problemas de contraste, estados vacíos y diferencias entre módulos.
- [ ] Identificar qué información del tablero ya está disponible mediante la API y qué datos faltan para mostrar tareas reales.
- [ ] Acordar una dirección visual sobria y apropiada para SG-SST, sin introducir cambios normativos ni cargar datos reales sensibles.

**Aceptación:** existe una línea base reproducible, una lista priorizada de hallazgos y criterios visuales verificables para las siguientes fases.

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

- [ ] Definir tokens y reglas compartidas para color, tipografía, escala de espaciado, bordes, elevación y estados semánticos.
- [ ] Normalizar títulos, descripciones, acciones principales, botones, campos, tablas, tarjetas, etiquetas y mensajes.
- [ ] Establecer estados de carga, error, vacío y confirmación con texto claro en español de Colombia.
- [ ] Aplicar primero los patrones al marco de navegación y a componentes reutilizables; evitar una reescritura masiva de pantallas.
- [ ] Comprobar contraste, foco visible, etiquetas accesibles y controles utilizables con teclado.

**Aceptación:** los componentes compartidos presentan una apariencia y comportamiento coherentes, y los componentes existentes que los usan siguen compilando y funcionando.

### Fase 3 — Tablero útil y verificable

**Estimación:** 2–4 días-persona.

- [ ] Reordenar el contenido para priorizar vencimientos, tareas pendientes, alertas y acciones inmediatas.
- [ ] Mostrar únicamente indicadores respaldados por datos reales disponibles y definir claramente su periodo y significado.
- [ ] Añadir accesos directos a las acciones frecuentes que el usuario puede completar con sus permisos.
- [ ] Diseñar estados vacíos útiles que expliquen cómo comenzar, sin fabricar porcentajes, tendencias o nombres.
- [ ] Revisar la distribución de tarjetas y listas en móvil, tableta y escritorio.
- [ ] Probar que los enlaces del tablero abren el módulo correspondiente y que los valores coinciden con la API o base persistida.

**Aceptación:** cada bloque informa algo verificable o explica por qué aún no hay datos; las tareas prioritarias conducen a una acción real y autorizada.

### Fase 4 — Aplicación gradual a los módulos

**Estimación:** 4–8 días-persona, según el número de pantallas que requieran ajustes.

- [ ] Aplicar los patrones compartidos primero a trabajadores, inspecciones, plan anual, acciones y alertas.
- [ ] Continuar con el resto de los módulos según frecuencia de uso y hallazgos de la Fase 0.
- [ ] Mejorar formularios largos, tablas en pantallas pequeñas y presentación de errores de validación.
- [ ] Mantener intactas las reglas de negocio, persistencia, permisos y formatos de evidencia salvo que se acuerde explícitamente otro alcance.
- [ ] Añadir o actualizar pruebas de interfaz cuando cambien interacciones o estados observables.

**Aceptación:** los módulos priorizados usan patrones consistentes y sus flujos principales conservan creación, consulta y actualización de información.

### Fase 5 — Validación y cierre

**Estimación:** 1–3 días-persona.

- [ ] Repetir las capturas visuales de la línea base en escritorio y móvil.
- [ ] Probar navegación completa, scroll, formularios, estados vacíos, errores, permisos y rutas principales.
- [ ] Ejecutar pruebas frontend, typecheck y build web; ejecutar validaciones adicionales si el cambio toca servidor o contratos API.
- [ ] Revisar consola del navegador y errores de red durante los flujos acordados.
- [ ] Actualizar este documento y el registro del [`PLAN_TRABAJO_SG_SST.md`](./PLAN_TRABAJO_SG_SST.md) al cerrar cada fase, anotando cambios y validaciones.

**Aceptación:** no hay regresiones conocidas en los flujos probados; las pantallas prioritarias son legibles y utilizables en los tamaños acordados; las validaciones quedan registradas.

## Orden recomendado y alcance inicial

1. Completar la Fase 0 con la aplicación en el commit base indicado.
2. Resolver en la Fase 1 el problema observado al desplazarse por el menú y ordenar la navegación.
3. Definir los componentes compartidos antes de rediseñar el tablero.
4. Conectar el tablero a datos verificados y mejorar sus estados vacíos.
5. Extender los patrones a otros módulos, priorizando los de uso frecuente.
6. Cerrar con validación visual, funcional y responsive.

El primer incremento de implementación debería limitarse a **Fase 1**. Así se corrige el defecto más visible antes de invertir en ajustes cosméticos extensos.

## Fuera de alcance sin aprobación explícita

- Cambiar cálculos, permisos, flujos de aprobación, persistencia o interpretación normativa.
- Cargar datos personales o médicos reales para las pruebas visuales.
- Presentar resultados o documentos como evidencia de cumplimiento legal verificado.
- Reemplazar toda la interfaz o introducir dependencias grandes sin justificarlo y revisar el impacto.

## Registro de avance

| Fecha | Fase | Resultado / siguiente paso |
|---|---|---|
| 2026-11-09 | Plan creado | Propuesta documentada a partir de la revisión visual del tablero y la navegación. No se modificó código de la aplicación. Siguiente paso: ejecutar la Fase 0 y, con los hallazgos confirmados, iniciar la Fase 1. |
| 2026-11-09 | Fase 1 completada | Layout con áreas de scroll separadas, navegación agrupada en Inicio/Planear/Ejecutar/Verificar/Administración, iconos Lucide consistentes y menú móvil con foco/Escape. Validación en navegador a 1280×800 y 390×844; navegación lateral desplazable sin scroll global. Pruebas frontend 53/53, typecheck, lint focalizado, formato y build web pasan. Antes de iniciar la Fase 2 queda pendiente completar la línea base de otras rutas definida en la Fase 0. |
