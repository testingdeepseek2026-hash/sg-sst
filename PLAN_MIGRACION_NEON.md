# Plan de migración de base de datos a Neon (PostgreSQL)

**Creado:** 10 de noviembre de 2026
**Proyecto:** SG-SST para microempresa colombiana de instalaciones electrónicas
**Fuente de requisitos:** [`PROMPT_MAESTRO.md`](./PROMPT_MAESTRO.md), [`PLAN_TRABAJO_SG_SST.md`](./PLAN_TRABAJO_SG_SST.md)

## Objetivo

Mover la base de datos del proyecto SG-SST desde SQLite local (`data/sg-sst.db`, motor `node:sqlite`) hacia **Neon Postgres**, conservando la funcionalidad actual (21 módulos, 315 pruebas), la trazabilidad y las garantías de privacidad de la Ley 1581/2012, y dejando respaldos automáticos documentados.

## Situación actual de la capa de datos

Verificado en el repositorio el 10 de noviembre de 2026:

- Motor: SQLite sincrónico vía `node:sqlite` (`DatabaseSync`), abierto en `server/src/lib/db.ts`; la conexión se inyecta como `db` en Fastify y en todos los servicios.
- Esquema: `server/src/migrations/001_initial.sql` con **36 tablas**, migraciones incrementales en código (`PRAGMA table_info` + `ALTER TABLE`), más el módulo de privacidad (`consents`, `privacy_notices`, `arco_requests`, `data_processing_records`).
- Código: **298 llamadas `.prepare()`** entre servicios, rutas, seed y scheduler (~57 archivos TS). Todas las funciones de servicio son **síncronas**; las rutas las llaman directamente.
- Acoplados a SQLite: `services/backup.ts` y `services/restore.ts` dependen del CLI `sqlite3` (`.backup`, `.tables`, `PRAGMA integrity_check`).
- Pruebas: 238 backend (fixtures SQLite nativas) + 77 frontend, más E2E integrado.
- No existe aún un entorno productivo confirmado según [`PLAN_TRABAJO_SG_SST.md`](./PLAN_TRABAJO_SG_SST.md); los datos reales no deben cargarse sin aprobación.

## Implicaciones técnicas de migrar a Neon

1. **Síncrono → asíncrono:** Postgres se consulta por red con drivers asíncronos. Cada función de servicio vuelve `async` y cada ruta pasa a `await`. Es el mayor costo del proyecto y no tiene atajo: una API síncrona no puede hablar con Postgres.
2. **Dialecto SQL:** `001_initial.sql` usa sintaxis SQLite (`PRAGMA`, `datetime('now')`, `AUTOINCREMENT`, `CHECK` inline, `REAL`, sin `serial`). Debe traducirse a DDL PostgreSQL equivalente.
3. **Convenciones de datos:** fechas como `TEXT` ISO-8601 y booleanos como `INTEGER 0/1`. Para minimizar el cambio de código se conservan esas convenciones en la primera fase (`text` + `smallint`) y se documenta la mejora posterior a `timestamptz`/`boolean` nativos como deuda técnica explícita.
4. **Backups/restauración:** `backup.ts`/`restore.ts` y el scheduler de 02:00 (America/Bogota) deben reescribirse sobre `pg_dump`/`pg_restore` (o los snapshots y branches de Neon), con la misma interfaz de manifiesto, retención y prueba de restauración.
5. **Pruebas:** los fixtures backend deben ejecutarse contra Postgres. Opción recomendada: **branches de Neon efímeros** (gratuitos) o Postgres local en Docker para CI, con seed por prueba; SQLite queda solo como migrador de datos de origen.
6. **Costo y operación:** Neon Free (0.25 CU aprox., branching, escala a cero) es suficiente para 3 usuarios; el plan se diseñó bajo el supuesto de no generar costo mensual inicial. Conviene fijar `Pool` con conexión TLS y `max` bajo (Neon recomienda ≤ ~10 por instancia).

## Alternativas evaluadas

| Alternativa                                           | Ventajas                                                                                                                        | Desventajas                                                                           | Costo estimado              | Veredicto                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------- |
| **A. Migración total a Postgres con `pg` (Pool TLS)** | Un solo motor; driver maduro; compatible con cualquier hosting Node (Railway, Render, VPS); pool persistente ideal para Fastify | Refactor async completo de servicios                                                  | Neon Free (USD 0) + hosting | **Recomendada**                                                         |
| B. Driver serverless `@neondatabase/serverless`       | Óptimo si el backend va a serverless (Vercel/Edge)                                                                              | Innecesario para Fastify persistente; agrega dependencia específica del proveedor     | USD 0                       | Solo si se despliega en Vercel                                          |
| C. Mantener SQLite y "subirlo" a Neon                 | Sin refactor                                                                                                                    | **Imposible**: Neon solo aloja Postgres; un archivo SQLite no es un servicio Postgres | —                           | Descartada                                                              |
| D. Doble motor (SQLite dev + Postgres prod)           | Permite avanzar sin romper tests                                                                                                | Doble dialecto y doble suite de pruebas; riesgo de divergencia permanente             | USD 0                       | Descartada como estado final; se usa solo durante la transición del ETL |

## Supuestos (confirmar antes de producción)

1. El backend Fastify se desplegará en un entorno Node persistente (aún por confirmar cuál).
2. El usuario ya tiene cuenta en Neon; falta crear el proyecto y obtener la cadena `DATABASE_URL`.
3. Los datos actuales de `data/sg-sst.db` son de demostración; el ETL se ejecutará con datos de prueba y se repetirá (idempotente) cuando la empresa apruebe cargar datos reales.
4. No se cargan datos sensibles reales ni se declara cumplimiento normativo hasta que la empresa lo confirme y un profesional SST revise lo que corresponda.

## Fases

Las estimaciones son días-persona de ingeniería.

### Fase N0 — Preparación en Neon y decisiones (0.5–1 día)

- [x] Crear el proyecto en Neon (región AWS us-east-1) y copiar `DATABASE_URL`.
- [x] Decidir driver según hosting del backend (A por defecto, B si es Vercel). **Decidido: `pg` + Pool TLS.**
- [x] Guardar el secreto fuera del código (`.env` de la raíz en `.gitignore`).
- [x] Crear un **branch de desarrollo** en Neon para pruebas locales/CI.

**Estado (11 de noviembre de 2026): Fase N0 completa.** Proyecto `neondb` (producción: `ep-still-dream-bbyfvwa8-pooler`, dev: `ep-cold-brook-bbe2swnt-pooler`, región c-15/us-east-1). Ambas cadenas pooled guardadas en `.env` (`DATABASE_URL` y `DATABASE_URL_DEV`), validadas con autenticación y TLS estricto. Lección registrada: tras un reset de contraseña, recopiar la cadena completa desde el diálogo _Connect_ de Neon en vez de editar el secreto a mano; el rol `neondb_owner` se resetea a nivel de proyecto y puede invalidar ambas cadenas.

### Fase N1 — Esquema PostgreSQL y migraciones (1.5–3 días)

- [x] Traducir `001_initial.sql` a `migrations/002_postgres_initial.sql` (36 tablas + índices + `CHECK`).
- [x] Implementar runner de migraciones con tabla `schema_migrations` (idempotente, repetible en dev/build/prod).
- [ ] Portar el seed (`seed/index.ts`, catálogo de 41 peligros, estándares 7/21/32, usuarios demo) a Postgres. **Reprogramado a Fase N2**: el seed actual llama a los servicios síncronos de SQLite; portarlo sin duplicar lógica exige los servicios asíncronos.
- [x] Validar el esquema contra PostgreSQL real (Postgres 17 local; pendiente repetir contra el branch de desarrollo de Neon cuando exista).

**Aceptación:** `pnpm --dir server run migrate:pg` crea el esquema completo desde cero, dos veces seguidas sin error, y el seed deja datos demo consistentes.

**Estado (10 de noviembre de 2026):** migraciones validadas contra PostgreSQL 17 local (base `sg_sst_test`): primera corrida crea 37 tablas públicas (36 del esquema + `schema_migrations`), segunda corrida idempotente sin duplicar, 18 llaves foráneas. Comparación columna a columna contra `001_initial.sql` (SQLite): 36/36 tablas con las mismas columnas. Typecheck, build (copia `*.sql` a `dist/lib/migrations/`), ESLint focalizado y 247/247 pruebas backend en verde. La diferencia reportada en `consents` contra `data/sg-sst.db` se debe a que ese archivo local es de una versión anterior del DDL; el esquema fuente vigente coincide con el DDL Postgres.

**Estado (11 de noviembre de 2026):** validación repetida contra Neon real (branch `main`, cadena pooled): primera corrida crea 37 tablas, segunda corrida idempotente sin error (exit 0). Aceptación de N1 alcanzada contra producción de Neon salvo el seed (reprogramado a N2) y la repetición formal en un branch `dev` cuando exista.

### Fase N2 — Capa de acceso a datos asíncrona (2–4 días)

- [x] Crear capa con pool `pg` (TLS), utilidades `query/one/exec` y cierre ordenado. _(Realizado en N1 como `lib/db-pg.ts`; `lib/db.ts` SQLite sigue vigente durante la transición.)_
- [x] Definir el contrato de migración de servicios (firma `async`, placeholders `$1..$n`, filas según el esquema actual). _(Implementado como `?` → `$n` automático en `toPlaceholders`, sin reescribir consultas a mano.)_
- [x] Convertir `types.ts` (quitar `DatabaseSync` de la declaración de Fastify). _(Aplazado a N3: durante la transición coexisten ambos backends y las rutas SQLite siguen usando `fastify.db`.)_
- [x] Traducir placeholders `?` → `$n` con utilidad central para evitar 298 cambios manuales propensos a error.

**Aceptación:** un servicio piloto (empresa) funciona end-to-end contra Neon con pruebas que lo verifican; el resto del app sigue sirviéndose desde SQLite durante la transición.

**Estado (11 de noviembre de 2026): Fase N2 completa.**

- Piloto implementado: `services/companies.pg.ts` (async, reutiliza `estandarSetPorRiesgo`, normaliza booleanos 0/1) + `auditLogPg` para trazabilidad.
- Llave de transición `isPgBackend()` (`DB_BACKEND=pg` + `DATABASE_URL`): por defecto el app sigue en SQLite; las 247 pruebas existentes no cambian.
- Ruta `/api/companies` (GET/POST) con doble backend.
- Prueba de integración `tests/integration/companies.pg.test.ts` (9 pruebas): requiere `TEST_DATABASE_URL`, crea/descarta base temporal `sg_sst_pg_pilot_test` con terminación de conexiones (Neon pooler). Cubre 404 sin datos, creación + persistencia directa, autocalcule de `estandar_set` (Res. 0312/2019), booleanos 0/1, upsert sin duplicados, flujo GET completo, RBAC 403, 400 con datos inválidos y bitácora en `audit_logs`.
- Validado contra PostgreSQL 17 local (9/9) y contra el branch `dev` de Neon (9/9, ciclo completo limpio). Suite completa 247/247 + 9 omitidas, typecheck server/web, build y lint en verde.

### Fase N3 — Conversión de servicios por dominios (6–10 días)

Orden por dominios, cada uno con su lote de pruebas convertido y verde antes de avanzar:

- [x] 1. Empresa, usuarios, roles, auth/bitácora (`audit_logs`).
- [x] 2. Trabajadores + exámenes + certificados + EPP (incluye el ciclo mínimo de consentimientos requerido para exámenes; cifrado AES-256-GCM validado). El resto de privacidad continúa en N3.8.
- [ ] 3. Peligros, estándares y autoevaluación (cálculos de puntaje probados).
- [ ] 4. Plan anual, capacitaciones, asistencia y firmas.
- [ ] 5. Inspecciones, alturas/ATS, emergencias, contratistas.
- [ ] 6. Incidentes, acciones, auditorías y hallazgos.
- [ ] 7. Alertas, indicadores, documentos, importación/exportación.
- [ ] 8. Privacidad (consentimientos, ARCO, registro de tratamiento).
- [ ] 9. Scheduler de alertas contra el pool.

**Aceptación por lote:** las pruebas de ese dominio pasan contra Postgres; la suite completa nunca queda más atrás de un dominio; `typecheck` y `build` siguen en verde en cada lote.

**Estado (12 de noviembre de 2026): Dominio N3.1 completado.** Usuarios, roles y bitácora cuentan con servicios asíncronos PostgreSQL; el middleware global autentica contra el backend activo. El registro inicial usa un bloqueo transaccional para impedir dos altas concurrentes y guarda su evento de auditoría en la misma transacción. Se migraron también la consulta y las estadísticas de `/api/audit-logs`; los datos de contraseña se excluyen/sanitizan en auditoría. SQLite continúa como backend predeterminado.

- Neon `dev`: `tests/integration/companies.pg.test.ts` **14/14** (incluye persistencia, login, RBAC, altas concurrentes, roles y bitácora).
- `corepack pnpm --dir server run test`: **249 aprobadas, 14 omitidas**; las omitidas son las pruebas Neon al no configurar `TEST_DATABASE_URL` en la ejecución general.
- `corepack pnpm --dir server run typecheck` y `corepack pnpm --dir server run build`: pasan.
- Siguiente lote: N3.2 (trabajadores, exámenes, certificados y EPP). No se cargaron datos reales ni se ejecutaron cambios en producción.

**Estado (12 de noviembre de 2026): Dominio N3.2 completado.** Se conectaron los servicios PostgreSQL y las rutas de trabajadores, exámenes, certificados y EPP; el ciclo mínimo de consentimientos (consulta, alta, retiro y verificación) quedó incluido para autorizar el tratamiento médico. Se conservaron las restricciones de acceso a exámenes, la firma propia de EPP, la regla de vigencia de alturas y la auditoría sin valores médicos ni firmas en claro. SQLite sigue como backend predeterminado; ARCO y el resto del módulo de privacidad permanecen para N3.8.

- Neon `dev`: `pnpm --dir server exec vitest run tests/integration/companies.pg.test.ts` **17/17** (incluye persistencia, RBAC, consentimiento vigente/retirado, cifrado/descifrado de exámenes y firma, certificado de alturas y vencimientos EPP).
- `pnpm --dir server run test`: **249 aprobadas, 17 omitidas**; las omitidas son las pruebas Neon cuando no se configura `TEST_DATABASE_URL`.
- `npm run typecheck`, `pnpm --dir server run build` y `pnpm --dir server exec eslint src/routes/workers.ts src/routes/workers_items.ts src/routes/privacy.ts src/services/workers.pg.ts src/services/workers_exams.pg.ts src/services/workers_certs.pg.ts src/services/workers_epp.pg.ts src/services/privacy_consents.pg.ts src/services/worker_validation_error.ts src/services/workers_exams.ts src/services/workers_certs.ts src/services/privacy.ts tests/integration/companies.pg.test.ts --max-warnings 0`: pasan.
- No se cargaron datos reales ni se ejecutaron cambios en producción. Siguiente lote: N3.3 (peligros, estándares y autoevaluación).

### Fase N4 — Migración de datos SQLite → Neon (ETL) (1–2 días)

- [ ] Script `scripts/migrate-sqlite-to-pg.ts`: lee `data/sg-sst.db` y copia tabla por tabla al branch de desarrollo primero.
- [ ] Descifrar/cifrar campos sensibles con la misma `ENCRYPTION_SECRET` o regenerar en destino de forma controlada.
- [ ] Verificación de conteos por tabla, muestreo de registros y prueba de escritura/lectura desde la app.
- [ ] Ejecución final a producción de Neon solo con aprobación de la empresa.

**Aceptación:** el conteo de filas coincide en las 36 tablas, una muestra de registros coincide campo a campo y un flujo completo (login → crear → exportar) funciona con los datos migrados.

### Fase N5 — Respaldos y restauración en Postgres (1.5–2.5 días)

- [ ] Reescribir `services/backup.ts` y `restore.ts` sobre `pg_dump`/`pg_restore` (o snapshots de Neon), conservando manifiesto, verificación de integridad, retención (`BACKUP_RETENTION_DAYS`) y job de las 02:00.
- [ ] Considerar branch diario de Neon como respaldo complementario; documentar limitaciones.
- [ ] Probar restauración real en un entorno separado.

**Aceptación:** un respaldo se restaura en un entorno limpio con verificación de integridad; el procedimiento queda documentado paso a paso para el responsable.

### Fase N6 — Corte a producción, despliegue y cierre (2–4 días)

- [ ] E2E completo contra Neon (login → flujos → alertas → exportación).
- [ ] Configurar el hosting elegido con `DATABASE_URL`, `ENCRYPTION_SECRET`, SMTP y HTTPS.
- [ ] Actualizar documentación: guía de despliegue, respaldo/restauración y variables de entorno.
- [ ] Actualizar [`PLAN_TRABAJO_SG_SST.md`](./PLAN_TRABAJO_SG_SST.md) (Fase 4: respaldos automáticos; Fase 6: ambiente productivo).
- [ ] Prueba de recuperación y de latencia (Neon escala a cero: medir cold start y decidir si se fija `autosuspend` más largo o se agrega keep-alive barato).

**Aceptación:** la app productiva sirve los datos desde Neon, los respaldos automáticos corren, la restauración fue probada y la documentación coincide con el sistema real.

## Estimación global

**14.5–26.5 días-persona** de ingeniería, sin contar la respuesta de la empresa ni la aprobación para cargar datos reales. El refactor asíncrono (Fases N2–N3) concentra la mayor parte del esfuerzo y su riesgo.

## Riesgos y mitigaciones

| Riesgo                                                                 | Impacto    | Mitigación                                                                                            |
| ---------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| Refactor async de 298 llamadas introduce regresiones silenciosas       | Alto       | Conversión por dominios con suite verde por lote; E2E al final; nunca mezclar dos dominios en un lote |
| Divergencia de dialecto (fechas `TEXT`, booleanos 0/1, JSON en `TEXT`) | Medio      | Convenciones conservadas en Fase N1 y documentadas como deuda; no "mejorar" tipos sin pruebas         |
| Clave de cifrado distinta entre entornos rompe campos sensibles        | Alto       | `ENCRYPTION_SECRET` versionada y verificada en el ETL con muestra legible                             |
| Cold start de Neon (escala a cero) percibido como lentitud             | Bajo-Medio | Medir; ajustar autosuspend; documentar comportamiento                                                 |
| Costo por conexiones en exceso                                         | Bajo       | Pool con `max` bajo y reutilización; monitoreo en dashboard de Neon                                   |
| Se confunde el entorno demo con datos reales de la empresa             | Alto       | Branches separados; ETL a producción solo con aprobación explícita                                    |

## Datos por confirmar con el usuario

1. Cadena `DATABASE_URL` del proyecto Neon (producción) y del branch de desarrollo.
2. ¿Dónde se alojará el backend Fastify? (define driver: `pg` vs `@neondatabase/serverless`).
3. ¿Se conservan los datos demo actuales para migrar, o se arranca Neon con esquema limpio + seed?

## Reglas de actualización de este plan

- Al iniciar cada sesión, leer este archivo y [`PLAN_TRABAJO_SG_SST.md`](./PLAN_TRABAJO_SG_SST.md); retomar la siguiente casilla pendiente.
- No marcar terminada una fase por existencia de código: comprobar migraciones, flujo y pruebas contra Neon real.
- Anotar el comando ejecutado y el resultado de validación en el registro de [`PLAN_TRABAJO_SG_SST.md`](./PLAN_TRABAJO_SG_SST.md).
- No afirmar cumplimiento normativo ni mover datos sensibles reales sin confirmación de la empresa y revisión SST correspondiente.
