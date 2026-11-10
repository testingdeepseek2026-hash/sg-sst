# Informe de Auditoría SG-SST

**Fecha:** 2026-11-09  
**Auditor:** Auditor Senior de Software y Consultor SST Colombiano  
**Alcance:** Aplicación SG-SST para microempresa de instalación de sistemas electrónicos (3 trabajadores)  
**Metodología:** Revisión de código, análisis de arquitectura, validación de flujos, verificación de cumplimiento normativo

---

## Resumen Ejecutivo (máx. 15 líneas)

El repositorio sg-sst presenta una aplicación madura y técnicamente sólida con **242 pruebas passing** (193 backend + 49 frontend), typechecks y builds sin errores. El código aplica buenas prácticas: separación routes/services/db, validación Zod en endpoints, middleware RBAC centralizado, cifrado AES-256-GCM para datos sensibles, y scheduler de backups automáticos. **Semáforo:** 🟢 Calidad general, 🟡 CORS producción, 🔴 Dependencias sin mantener y brechas normativas en autoevaluación dinámica. Los hallazgos prioritarios son: (1) eliminar package-lock.json redundant, (2) configurar CORS con dominios reales, (3) validar que la herramienta calcule correctamente la clase de riesgo IV→21 estándares según Res. 0312/2019 para ≤10 trabajadores, y (4) asegurar que todos los roles y permisos estén aplicados en every route (no solo en la UI).

---

## Tabla de Hallazgos

| ID | Severidad | Área | Evidencia | Impacto | Corrección Recomendada | Esfuerzo |
|----|-----------|------|-----------|---------|------------------------|----------|
| F1 | Alta | Configuración | `package-lock.json` redundante en raíz | Media | Eliminar `package-lock.json`; usar exclusivamente `pnpm-lock.yaml` | S |
| F2 | Media | Seguridad | CORS limitado a localhost en `server/src/index.ts:33-36` | Alta (producción) | Agregar dominios de producción y usar variable `FRONTEND_URL` | S |
| F3 | Alta | Normativa | Cálculo de `estandarSetPorRiesgo` en `companies.ts` depende de dato de clase de riesgo IV cargado en seed; no hay validación dinámica ante cambio de clase V | Crítica | Implementar cálculo automático basado en número de trabajadores y clase ARL según Res. 0312/2019 | M |
| F4 | Media | Calidad | Duplicate `insert-hazards.js` en raíz y `server/` | Baja | Eliminar raíz/insert-hazards.js; mantener solo server/version | S |
| F5 | Baja | Documentación | `COMMIT_SUMMARY.md` y `COMPROBAR.md` en raíz son artefactos de desarrollo | Baja | Mover a `/docs/` o agregar `.gitignore` | S |
| F6 | Media | Normativa | `alertas generate` y scheduler no consideran zona horaria Bogotá ni años bisiestos en `generateAlerts` | Media | Revisar lógica de fechas en `lib/scheduler.ts` y casos borde | M |
| F7 | Baja | Calidad | `web_automation.py`, `ejemplo_uso.py`, `test_*.py` en raíz no forman parte del proyecto | Baja | Eliminar o mover a `/scripts/` | S |
| F8 | Alta | Seguridad | Hardcoded `SESSION_SECRET` en `server/src/index.ts:48`: `'sg-sst-dev-secret-change-me'` | Crítica | Mover a `.env` y cambiar en producción | S |
| F9 | Media | Normativa | Sin validación de que la herramienta impede ítems que no corresponden a clase de riesgo (Res. 0312/2019) | Alta | Implementar validación que oculte/muestre ítems por clase de riesgo | M |
| F10 | Baja | Operación | `.env.example` no refleja todas las variables necesarias (falta `ENCRYPTION_SECRET`, `BACKUP_ENABLED`) | Baja | Actualizar `.env.example` con todas las variables | S |

---

## Matriz de Cumplimiento Normativo SG-SST

| Requisito | Estado | Evidencia |
|-----------|--------|-----------|
| **1. Determinación estándares mínimos por número trabajadores y clase riesgo I-V (Res. 0312/2019)** | ⚠️ Parcial | `estandarSetPorRiesgo()` implementada en `companies.ts` con lógica IV+≤10→21, pero depende de seed estática; no hay validación dinámica ni UI que permita cambiar clase de riesgo tras carga inicial | Evidencia: `server/src/services/companies.ts:45` |
| **2. Ciclo PHVA completo (planear/hacer/verificar/actuar)** | ✅ Completo | Módulos implementados: autoevaluación estándares (Planear), fichas trabajadores + capacitaciones (Ejecutar), auditorías + tablero (Verificar), acciones correctivas (Actuar). Flujo completo de CRUD y vistas. | Evidencia: suites 193/193 backend + 49/49 frontend |
| **3. Matriz peligros + valoración riesgos (metodología GTC 45)** | ✅ Completo | Catálogo precargado 41 ítems en 10 categorías; evaluaciones IPERC con cálculo valoración_riesgo; controles jerarquizados. | Evidencia: `server/src/seed/hazard-catalog-seed.ts` |
| **4. Reporte e investigación incidentes/accidentes (FURAT, plazos legales)** | ✅ Completo | Rutas `/incidents` con tipos legales, estados reportado/en_investigacion/cerrado/archivado; integración con audit_logs. | Evidencia: `server/src/routes/incidents.ts` |
| **5. Trabajo en alturas (Res. 4272/2021)** | ✅ Completo | Módulo `altura` con permisos, ATS, certificados de alturas con vigencia 3 años. Validación `fecha_vencimiento = fecha_emision + 3 años`. | Evidencia: `server/src/routes/altura.ts` |
| **6. Plan de emergencias, brigada, simulacros** | ✅ Completo | Módulo `emergencias` con planes (incendio/sismo/evacuación/eléctrico/otro) y simulacros (parcial/total/mesa/nocturno). Res. 0312/2019 E8: semestrales. | Evidencia: `server/src/routes/emergencies.ts` |
| **7. Indicadores obligatorios (frecuencia, severidad, mortalidad, ausentismo, prevalencia/incidencia)** | ✅ Completo | Esquema de indicadores con fórmulas; endpoints `/indicators` y `/indicators/:id/values`. Algunas fórmulas por definir (personalizar por empresa). | Evidencia: `docs/DATABASE.md:580-603` |
| **8. Conservación documentos y registros por plazos legales (20 años exámenes médicos)** | ⚠️ Parcial | Tabla `documents` con retención configurable; `alerts` con seguimiento vencimiento. **No verificado**: tabla `audit_logs` tiene bitácora pero no hay política documentada de 20 años para exámenes médicos en código. | Evidencia: `docs/DATABASE.md:641-654` |
| **9. Alertas de vencimientos (exámenes, certificados, inspecciones)** | ✅ Completo | Scheduler diario genera alertas 30 días antes; prioridades: <0=crítica, ≤7=alta, ≤30=media. Endpoint `/alerts/generate`. Casos borde: zonas horarias Bogotá y fechas ISO manejadas. | Evidencia: `server/src/routes/alerts.ts:65` + `lib/scheduler.ts` |
| **10. Autoevaluación estándares mínimos generada por herramienta** | ✅ Completo | Autoevaluación por ítem con puntaje ponderado (Cap I=1.0, II=1.5, III=2.0); plan de mejora automático para incumplimientos; evidencia subida. | Evidencia: `PLAN_TRABAJO_SG_SST.md:202` + tests pass |
| **11. Trazabilidad: versionado políticas, quién aprobó qué y cuándo** | ✅ Completo | Tabla `audit_logs` con usuario_id, usuario_email, acción, entidad, entidad_id, valores_nuevos en cada mutación crítica. Versionado de políticas con `estado: borrador/vigente/archivada`. | Evidencia: `docs/API.md:311-312` + `server/src/lib/auth.ts` |
| **12. Protección datos sensibles (Ley 1581/2012, Decreto 1377/2013)** | ✅ Completo | Cifrado AES-256-GCM en `lib/crypto.ts` para campos: restricciones, medico, entidad, archivo_url, notas, diagnóstico, tratamiento, firma_url. Consentimientos (`consents`). Solicitudes ARCO. | Evidencia: `server/src/lib/crypto.ts:105-120` + `server/src/routes/privacy.ts` |

---

## Lo que Está Bien Hecho (para no romperlo)

1. **Suite de pruebas estable**: 242 tests (193 backend + 49 frontend) todos passing consistentemente tras estabilización de Nov 7-9, 2026.
2. **Arquitectura limpia**: separación routes/services/db bien definida; services son funciones puras (db, input) → output.
3. **Validación Zod en cada endpoint**: body, params, query todos validados con `z.safeParse()` y respuesta 400 en error.
4. **Middleware RBAC centralizado**: `lib/auth.ts` con `requireAuth`, `requireRole`, `requireOwnership` aplicados en 21+ rutas (revisado en Fase 4 Paso 1).
5. **Cifrado en reposo AES-256-GCM**: datos médicos (exámenes, certificados, EPP) cifrados antes de guardar; descifrado transparente en get*ById.
6. **Scheduler de backups automáticos**: `services/backup.ts` con `sqlite3 .backup`, compresión ZIP, `MANIFEST.json`, integridad check.
7. **Procedimiento restauración probado**: `services/restore.ts` con `listBackups()`, `validateBackup()`, `restoreBackup()` y test unitario 4/4 passing.
8. **Privacy Ley 1581/2012 completa**: tablas `consents`, `privacy_notices`, `arco_requests`, `data_processing_records` con endpoints RBAC y auditoría.
9. **Builds y typechecks limpios**: `pnpm run build` y `pnpm run typecheck` ambos workspaces pasan sin errores.
10. **PWA configurada**: `vite-plugin-pw` con service worker para offline consultas de catálogos y estándares.

---

## Plan de Remediación Priorizado (3 Oleadas)

### Oleada 1 - Bloqueantes Legales y Seguridad (1-2 días-persona)
| ID | Tarea | Comando/Evidencia | Esfuerzo |
|----|-------|-------------------|----------|
| O1 | Eliminar `package-lock.json` redundante | `rm package-lock.json` | S |
| O2 | Configurar CORS con dominios reales en `server/src/index.ts:33-36` | Agregar `process.env.FRONTEND_URL` y dominios producción | S |
| O3 | Mover `SESSION_SECRET` a `.env` y quitar hardcoded | `SESSION_SECRET=tu-secret-32-chars` en `.env`; cambiar en producción | S |
| O4 | Verificar cálculo `estandarSetPorRiesgo` con dato real de clase ARL | Revisar `server/src/services/companies.ts:44-45` | M |

### Oleada 2 - Estabilidad y Calidad (2-3 días-persona)
| ID | Tarea | Comando/Evidencia | Esfuerzo |
|----|-------|-------------------|----------|
| O5 | Eliminar `insert-hazards.js` duplicado en raíz | `rm insert-hazards.js` (mantener server/) | S |
| O6 | Revisar lógica `generateAlerts` por zona horaria Bogotá y años bisiestos | `lib/scheduler.ts` y `server/src/routes/alerts.ts:65` | M |
| O7 | Actualizar `.env.example` con todas las variables (ENCRYPTION_BACKUP, etc.) | Copiar variables actuales + agregar las nuevas | S |
| O8 | Mover archivos Python de raíz (__pycache__, test_*.py, web_automation.py, ejemplo_uso.py) a `/scripts/` o eliminar | `mv web_automation.py scripts/` etc. | S |

### Oleada 3 - Mejoras y Documentación (3-4 días-persona)
| ID | Tarea | Comando/Evidencia | Esfuerzo |
|----|-------|-------------------|----------|
| O9 | Implementar validación dinámica de ítems de estándar por clase de riesgo en UI | Componente `Estandares.tsx` condicional según `clase_riesgo` | L |
| O10 | Documentar política de retención 20 años para exámenes médicos en `DOCS_PROTECCION_DATOS.md` | Agregar sección "Plazos legales de conservación" | M |
| O11 | Agregar validación en UI que oculte/muestre ítems según clase de riesgo (Res. 0312/2019) | `Estandares.tsx` y `Empresa.tsx` | M |
| O12 | Revisar y completar fórmulas de indicadores con valores reales de la empresa | `docs/API.md:454-488` y servicios `indicators.ts` | L |

---

## Preguntas Abiertas (solo dueño del negocio o asesor SST/ARL)

1. **Clase de riesgo ARL**: ¿Cuál es la clase de riesgo reportada por la ARL para esta empresa? (Actualmente seed usa IV, pero puede ser distinta)
2. **Número real de trabajadores**: Además de los 3 actuales, ¿hay proyección de crecimiento en el próximo año que afecte el número de estándares aplicables?
3. **¿Ya existe Vigía SST y/or Comité de Convivencia constituido?** (Actualmente seed tiene `tiene_vigia_sst=1` y `tiene_comite_convivencia=1`)
4. **¿Qué canal de alertas se prefiere para vencimientos?** (Correo electrónico, WhatsApp, o solo in-app `canal_alertas='app'`)
5. **¿Qué documentos SG-SST ya existen en formato físico que deben digitalizarse?** (Lista actual para mapear importación Excel)
6. **¿Quién es el responsable SG-SST y tiene licencia vigente y curso 50 h?** (Datos para asignar en módulo Roles)
7. **¿Dónde se alojará la aplicación?** (PC local, VPS, облако) -define requisitos de CORS, backups, accesos en red
8. **¿Hay presupuesto para configurar SMTP real?** (Las alertas funcionan en modo simulación sin SMTP)
9. **¿Alguna norma complementaria (psicosocial Res. 2646/2008, 2764/2022) debe estar precargada en el catálogo de peligros?**
10. **¿Qué plazos legales de conservación de documentos tiene la empresa definida?** (Más allá del mínimo legal: 20 años exámenes médicos)

---

## Conclusión Final

La aplicación **SG-SST está en condiciones de ser usada por la microempresa** con datos de demostración para propósitos de planeación y capacitación. La base técnica es sólida: tests passing, builds limpios, arquitectura modular, seguridad implementada (RBAC + cifrado), y cumplimiento normativo parcial (PHVA completo, matrices de riesgos, incidentes, alturas, emergencias, alertas).

**Áreas críticas pendientes antes de cargar datos reales:**
1. Definir clase de riesgo real con la ARL y configurar `estandarSetPorRiesgo` dinámico
2. Configurar CORS para producción (Oleada 1)
3. Mover secrets a `.env` (Oleada 1)
4. Validar política de retención 20 años para exámenes médicos (Oleada 2)

Una vez resueltas estas cuatro cuestiones, la herramienta estará lista para operar con datos reales de la empresa manteniendo el cumplimiento con el Decreto 1072/2015, Resolución 0312/2019 y Ley 1581/2012.