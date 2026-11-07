# Documentación API SG-SST

> **Base URL**: `/api` (desarrollo: `http://localhost:4000/api`, producción: `https://tu-dominio.com/api`)
> **Autenticación**: Cookie JWT `sg_sst_user` (httpOnly, SameSite=Lax, Secure en prod)
> **Formato**: JSON (request/response), `multipart/form-data` para uploads
> **Versionado**: Semántico en headers `Accept-Version` (futuro)

## Autenticación

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/auth/login` | POST | Login email/password → setea cookie JWT |
| `/auth/logout` | POST | Logout → limpia cookie |
| `/auth/me` | GET | Usuario actual desde cookie |

### Login Request
```json
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@empresa.com",
  "password": "password123"
}
```

### Login Response (200)
```json
{
  "data": {
    "user": {
      "id": "usr_abc123",
      "email": "admin@empresa.com",
      "nombre": "Admin",
      "rol": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```
> Cookie `sg_sst_user=usr_abc123; HttpOnly; SameSite=Lax; Secure; Path=/` se setea automáticamente.

---

## Empresas (`/companies`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/companies` | Listar empresas |
| GET | `/companies/:id` | Obtener empresa |
| POST | `/companies` | Crear empresa (admin) |
| PUT | `/companies/:id` | Actualizar empresa |
| DELETE | `/companies/:id` | Eliminar empresa |

### Company Schema
```typescript
interface Company {
  id: string;
  nombre: string;
  nit: string;           // Formato: 900123456-7
  direccion: string;
  ciudad: string;
  telefono: string;
  email: string;
  canal_alertas: 'email' | 'whatsapp' | 'both';
  creado_en: string;     // ISO 8601
  actualizado_en: string;
}
```

---

## Usuarios (`/users`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/users` | Listar usuarios (admin) |
| GET | `/users/:id` | Obtener usuario |
| POST | `/users` | Crear usuario (admin) |
| PUT | `/users/:id` | Actualizar usuario/perfil |
| DELETE | `/users/:id` | Desactivar usuario |
| PUT | `/users/:id/password` | Cambiar contraseña |
| PUT | `/users/:id/activate` | Activar/Desactivar |

### User Schema
```typescript
interface User {
  id: string;
  email: string;
  nombre: string;
  rol: 'admin' | 'responsable_sst' | 'supervisor' | 'worker';
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}
```

---

## Roles SST (`/roles`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/roles` | Listar roles |
| GET | `/roles/:id` | Obtener rol |
| POST | `/roles` | Asignar rol SST a usuario |
| PUT | `/roles/:id` | Actualizar rol (licencias, vigencias) |
| DELETE | `/roles/:id` | Remover rol |

### Role Schema
```typescript
interface Role {
  id: string;
  usuario_id: string;
  tipo: 'responsable_sst' | 'copasst' | 'brigadista' | 'supervisor_sst';
  licencia_sst_numero: string | null;
  licencia_sst_vence: string | null;    // YYYY-MM-DD
  curso_50h_vence: string | null;       // YYYY-MM-DD
  creado_en: string;
  actualizado_en: string;
}
```

---

## Trabajadores (`/workers`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/workers` | Listar (filtros: empresa, estado, búsqueda) |
| GET | `/workers/:id` | Obtener trabajador |
| POST | `/workers` | Crear trabajador |
| PUT | `/workers/:id` | Actualizar trabajador |
| DELETE | `/workers/:id` | Eliminar (solo si sin items asociados) |
| GET | `/workers/vencimientos` | **Unificado**: exámenes + certificados + EPP por vencer |
| GET | `/workers/epp/pending-signature` | EPPs pendientes de firma |

### Worker Schema
```typescript
interface Worker {
  id: string;
  empresa_id: string;
  nombres: string;
  apellidos: string;
  documento: string;       // CC, NIT, CE, TI
  cargo: string;
  area: string;
  fecha_ingreso: string;   // YYYY-MM-DD
  estado: 'activo' | 'inactivo' | 'retirado' | 'suspendido';
  eps: string;
  arl: string;
  fondo_pensiones: string;
  creado_en: string;
  actualizado_en: string;
}
```

### Exámenes Médicos (`/workers/:id/exams`)
```typescript
interface WorkerExam {
  id: string;
  worker_id: string;
  tipo: 'ingreso' | 'periodico' | 'egreso' | 'control';
  fecha: string;           // YYYY-MM-DD
  vencimiento: string | null; // YYYY-MM-DD
  resultado: 'apto' | 'apto_con_restricciones' | 'no_apto';
  restricciones: string | null; // Sensible - Ley 1581/2012
  medico: string | null;
  entidad: string | null;
  archivo_url: string | null;
  notas: string | null;
}
```
> **Reglas**: Solo 1 examen de ingreso por trabajador. Requiere consentimiento médico (`consents.tipo='medico'`).

### Certificados (`/workers/:id/certs`)
```typescript
interface WorkerCert {
  id: string;
  worker_id: string;
  tipo: 'alturas' | 'electrico' | 'primeros_auxilios' | 'brigada' | 'conduccion' | 'sst_50h' | 'otro';
  nombre_curso: string | null;
  entidad: string | null;
  fecha_emision: string;   // YYYY-MM-DD
  fecha_vencimiento: string; // YYYY-MM-DD
  archivo_url: string | null;
  notas: string | null;
}
```
> **Regla Res. 4272/2021 Art. 12**: Certificados de alturas **deben tener vigencia exacta de 3 años** desde emisión.

### EPP (`/workers/:id/epp`)
```typescript
interface WorkerEpp {
  id: string;
  worker_id: string;
  item: string;            // Ej: 'Casco de seguridad', 'Arnés de cuerpo completo'
  cantidad: number;
  fecha_entrega: string;   // YYYY-MM-DD
  fecha_vencimiento: string | null;
  firmado_por_trabajador: 0 | 1;
  firma_url: string | null; // Base64 PNG
  notas: string | null;
}
```
> **Firma**: `POST /workers/epp/:id/sign` con `{ firma_base64: 'data:image/png;base64,...' }`

### Consentimientos (`/workers/:id/consents`)
```typescript
interface Consent {
  id: string;
  worker_id: string;
  tipo: 'medico' | 'datos_personales' | 'foto_video';
  autorizado: boolean;
  fecha: string;           // ISO 8601
  ip: string | null;
  user_agent: string | null;
}
```
> Requerido para exámenes médicos (Ley 1581/2012).

---

## Peligros e IPERC (`/hazards`)

### Catálogo (`/hazards/catalog`)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/hazards/catalog` | Listar catálogo (filtro `?categoria=`) |
| GET | `/hazards/catalog/:id` | Obtener item |
| POST | `/hazards/catalog` | Crear item catálogo |
| PUT | `/hazards/catalog/:id` | Actualizar item |
| DELETE | `/hazards/catalog/:id` | Desactivar (soft delete) |

```typescript
interface HazardCatalogItem {
  id: string;
  codigo: string;          // Ej: 'EL-001', 'AL-001'
  nombre: string;
  categoria: 'alturas' | 'electrico' | 'herramientas' | 'escaleras' | 'ergonomia' | 'conduccion' | 'cielos_rasos' | 'confinados' | 'locativo' | 'otro';
  descripcion: string | null;
  riesgo_por_defecto: 'bajo' | 'medio' | 'alto' | 'critico';
  control_sugerido: string | null;
  activo: 0 | 1;
}
```

### Evaluaciones IPERC (`/hazards/assessments`)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/hazards/assessments` | Listar evaluaciones |
| POST | `/hazards/assessments` | Crear evaluación |
| PUT | `/hazards/assessments/:id` | Actualizar (setea `revisado_en`) |
| DELETE | `/hazards/assessments/:id` | Eliminar |

```typescript
interface HazardAssessment {
  id: string;
  cargo_oficio: string;
  area: string | null;
  peligro_id: string | null;      // Ref catálogo
  peligro_texto: string | null;   // Peligro libre
  tarea: string | null;
  consecuencia: string | null;
  probabilidad: string | null;
  valoracion_riesgo: 'bajo' | 'medio' | 'alto' | 'critico';
  controles: string | null;
  responsable: string | null;
  fecha: string;                  // YYYY-MM-DD
  revisado_en: string | null;     // ISO 8601
  estado: 'vigente' | 'revisado' | 'obsoleto';
}
```

---

## Estándares y Normativa (`/standards`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/standards` | Listar (filtro `?set=iso45001|resoluciones_colombia`) |
| GET | `/standards/:id` | Obtener estándar |
| POST | `/standards` | Crear estándar (admin) |
| PUT | `/standards/:id` | Actualizar |
| DELETE | `/standards/:id` | Desactivar |

### Evaluaciones de Estándares (`/standard-assessments`)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/standard-assessments` | Listar evaluaciones |
| POST | `/standard-assessments` | Crear evaluación |
| PUT | `/standard-assessments/:id` | Actualizar |
| DELETE | `/standard-assessments/:id` | Eliminar |
| GET | `/standards/compliance` | **Estadísticas cumplimiento global** |

```typescript
interface Standard {
  id: string;
  codigo: string;          // Ej: 'ISO-45001-4.1', 'RES-0312-10'
  titulo: string;
  descripcion: string | null;
  set_aplicable: 'iso45001' | 'resoluciones_colombia' | 'otro';
  capitulo: string;        // Ej: '4. Contexto', 'Res. 0312'
  modo_verificacion: 'documental' | 'entrevista' | 'observacion' | 'medicion' | null;
  activo: 0 | 1;
}

interface StandardAssessment {
  id: string;
  standard_id: string;
  cumple: 0 | 1;
  observaciones: string | null;
  plan_mejora: string | null;
  fecha: string;           // ISO 8601
  usuario_id: string | null;
}
```

### Compliance Response
```json
GET /api/standards/compliance
{
  "data": {
    "total": 150,
    "cumplidos": 120,
    "incumplidos": 30,
    "porcentaje": 80
  }
}
```

---

## Política SST (`/policies`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/policies` | Listar todas (orden version DESC) |
| GET | `/policies/active` | Política vigente actual |
| GET | `/policies/:id` | Obtener política |
| POST | `/policies` | Crear (borrador o vigente) |
| PUT | `/policies/:id` | Actualizar (si vigente → nueva versión borrador) |
| DELETE | `/policies/:id` | Eliminar (solo borrador) |
| POST | `/policies/:id/sign` | Firmar → pone vigente `{ firmado_por }` |
| POST | `/policies/:id/divulge` | Divulgar política vigente |
| POST | `/policies/:id/archive` | Archivar política |

### Objetivos (`/policies/:id/objectives`)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/policies/:id/objectives` | Listar objetivos de política |
| POST | `/policies/:id/objectives` | Crear objetivo |
| PUT | `/policies/objectives/:id` | Actualizar objetivo |
| DELETE | `/policies/objectives/:id` | Eliminar objetivo |

```typescript
interface Policy {
  id: string;
  version: number;
  titulo: string;
  contenido: string;
  firmado_por: string | null;
  fecha_firma: string | null;       // YYYY-MM-DD
  fecha_divulgacion: string | null; // YYYY-MM-DD
  estado: 'borrador' | 'vigente' | 'archivada';
  creado_en: string;
  actualizado_en: string;
}

interface Objective {
  id: string;
  policy_id: string;
  descripcion: string;
  tipo: 'estructura' | 'proceso' | 'resultado';
  meta: string | null;
  responsable: string | null;
  fecha_limite: string | null;     // YYYY-MM-DD
  estado: 'pendiente' | 'cumplido' | 'en_proceso' | 'incumplido';
}
```

> **Regla**: Solo **una política vigente** a la vez. Editar vigente crea nueva versión borrador y archiva anterior.

---

## Plan Anual (`/plans`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/plans` | Listar (filtro `?año=2026`) |
| GET | `/plans/:id` | Obtener plan |
| POST | `/plans` | Crear plan |
| PUT | `/plans/:id` | Actualizar |
| DELETE | `/plans/:id` | Eliminar |
| GET | `/plans/:id/activities` | Actividades del plan |

```typescript
interface AnnualPlan {
  id: string;
  año: number;
  objetivo: string;
  fecha_inicio: string;  // YYYY-MM-DD
  fecha_fin: string;     // YYYY-MM-DD
  estado: 'pendiente' | 'en_proceso' | 'cumplido' | 'no_cumplido';
  creado_en: string;
  actualizado_en: string;
}

interface PlanActivity {
  id: string;
  plan_id: string;
  descripcion: string;
  responsable: string | null;
  fecha_programada: string | null;
  fecha_real: string | null;
  estado: 'pendiente' | 'en_proceso' | 'cumplido' | 'no_cumplido';
  evidencia_url: string | null;
}
```

---

## Indicadores (`/indicators`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/indicators` | Listar indicadores |
| GET | `/indicators/:id` | Obtener con valores históricos |
| POST | `/indicators` | Crear indicador |
| PUT | `/indicators/:id` | Actualizar |
| DELETE | `/indicators/:id` | Eliminar |
| POST | `/indicators/:id/values` | Registrar valor periódico |

```typescript
interface Indicator {
  id: string;
  codigo: string;          // Ej: 'TRIR', 'LTIFR', 'TRIR-CONTRATISTAS'
  nombre: string;
  descripcion: string | null;
  formula: string | null;
  frecuencia: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  meta: number;
  unidad: string;          // Ej: 'x100k hrs', '%', 'días'
  responsable: string | null;
  activo: 0 | 1;
}

interface IndicatorValue {
  id: string;
  indicator_id: string;
  periodo: string;         // YYYY-MM o YYYY
  valor: number;
  observaciones: string | null;
  registrado_por: string | null;
  creado_en: string;
}
```

---

## Incidentes (`/incidents`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/incidents` | Listar (filtros: tipo, estado, fecha, trabajador) |
| GET | `/incidents/:id` | Obtener con investigaciones |
| POST | `/incidents` | Reportar incidente |
| PUT | `/incidents/:id` | Actualizar |
| PUT | `/incidents/:id/investigate` | Iniciar investigación |
| PUT | `/incidents/:id/close` | Cerrar incidente |
| DELETE | `/incidents/:id` | Eliminar (solo borrador) |

```typescript
interface Incident {
  id: string;
  tipo: 'accidente_trabajo' | 'incidente_sin_baja' | 'enfermedad_laboral' | 'casi_accidente' | 'daño_propiedad' | 'ambiental';
  fecha: string;           // YYYY-MM-DD
  hora: string;            // HH:MM
  lugar: string;
  descripcion: string;
  trabajador_id: string | null;
  testigos: string | null;
  lesion: string | null;
  parte_cuerpo: string | null;
  tipo_lesion: string | null;
  agente: string | null;
  mecanismo: string | null;
  estado: 'reportado' | 'en_investigacion' | 'cerrado' | 'archivado';
  reportado_por: string;
  creado_en: string;
  actualizado_en: string;
}
```

---

## Inspecciones (`/inspections`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/inspections` | Listar |
| GET | `/inspections/:id` | Obtener con checklist |
| POST | `/inspections` | Crear inspección |
| PUT | `/inspections/:id` | Actualizar |
| POST | `/inspections/:id/checklist` | Guardar checklist |
| PUT | `/inspections/:id/complete` | Completar inspección |
| DELETE | `/inspections/:id` | Eliminar |

> Incluye rutas `/altura` para inspecciones de trabajo en alturas (Res. 4272/2021).

```typescript
interface Inspection {
  id: string;
  tipo: 'periodica' | 'pre_operacional' | 'post_incidente' | 'alturas' | 'especial';
  fecha: string;           // YYYY-MM-DD
  area: string | null;
  responsable: string | null;
  estado: 'pendiente' | 'programada' | 'en_proceso' | 'completada' | 'cancelada';
  observaciones: string | null;
  creado_en: string;
  actualizado_en: string;
}
```

---

## Documentos, Acciones, Auditorías, Alertas (`/documents`, `/actions`, `/audits`, `/alerts`)

### Documentos (`/documents`)
```typescript
interface Document {
  id: string;
  titulo: string;
  tipo: 'politica' | 'procedimiento' | 'instructivo' | 'formato' | 'registro' | 'otro';
  contenido: string;
  version: number;
  estado: 'borrador' | 'en_revision' | 'aprobado' | 'vigente' | 'obsoleto';
  fecha_revision: string | null; // YYYY-MM-DD
  aprobado_por: string | null;
  creado_en: string;
  actualizado_en: string;
}
```

### Acciones Correctivas/Preventivas (`/actions`)
```typescript
interface Action {
  id: string;
  origen: 'incidente' | 'inspeccion' | 'auditoria' | 'hallazgo' | 'queja' | 'otro';
  origen_id: string | null;
  descripcion: string;
  causa_raiz: string | null;
  accion_correctiva: string | null;
  accion_preventiva: string | null;
  responsable: string;
  fecha_compromiso: string;  // YYYY-MM-DD
  fecha_cierre: string | null;
  estado: 'abierta' | 'en_proceso' | 'verificacion' | 'cerrada' | 'cancelada';
  efectividad: 'pendiente' | 'efectiva' | 'no_efectiva' | null;
}
```

### Auditorías (`/audits`)
```typescript
interface Audit {
  id: string;
  tipo: 'interna' | 'externa' | 'certificacion' | 'proveedor';
  fecha_inicio: string;  // YYYY-MM-DD
  fecha_fin: string | null;
  alcance: string;
  auditor: string;
  criterio: string;      // Ej: 'ISO 45001:2018', 'Res. 0312'
  estado: 'planificada' | 'en_proceso' | 'finalizada' | 'cerrada';
  hallazgos: string | null;
 结论: string | null;
}
```

### Alertas (`/alerts`)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/alerts` | Listar (filtros: tipo, enviado, prioridad, fechas) |
| GET | `/alerts/stats` | Estadísticas |
| POST | `/alerts/generate` | Generar alertas manualmente (scheduler) |
| POST | `/alerts/mark-sent` | Marcar como enviadas `{ ids: string[] }` |
| DELETE | `/alerts/:id` | Eliminar alerta |

```typescript
interface Alert {
  id: string;
  entidad: string;         // 'worker_exams', 'worker_certs', 'roles', 'inspections', 'annual_plan', 'documents'
  entidad_id: string;
  tipo: 'examen' | 'certificado' | 'licencia_sst' | 'curso_50h' | 'inspeccion' | 'plan' | 'documento';
  fecha_vencimiento: string; // YYYY-MM-DD
  prioridad: 'critica' | 'alta' | 'media';
  enviado: 0 | 1;
  enviado_en: string | null;
  canal: 'email' | 'whatsapp' | 'both';
  creado_en: string;
}
```

> **Scheduler**: Se ejecuta diariamente, genera alertas para vencimientos en 30 días. Prioridad: <0 días=crítica, ≤7 días=alta, ≤30 días=media.

---

## Export/Import (`/export`, `/import`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/export/workers` | Excel trabajadores |
| GET | `/export/exams` | Excel exámenes |
| GET | `/export/certs` | Excel certificados |
| GET | `/export/epp` | Excel EPP |
| GET | `/export/iperc` | Excel IPERC |
| GET | `/export/indicators` | Excel indicadores |
| GET | `/export/incidents` | Excel incidentes |
| GET | `/export/all` | ZIP con todos los reportes |
| POST | `/import/workers` | Importar trabajadores (Excel) |
| POST | `/import/hazards` | Importar catálogo peligros (Excel) |

---

## Códigos de Error Comunes

| HTTP | Código | Descripción |
|------|--------|-------------|
| 400 | `VALIDATION_ERROR` | Body/query/params inválidos (Zod) |
| 401 | `UNAUTHENTICATED` | Cookie faltante/inválida/expirada |
| 403 | `FORBIDDEN` | Sin permisos (rol insuficiente) |
| 404 | `NOT_FOUND` | Recurso no existe |
| 409 | `CONFLICT` | Violación regla negocio (ej: política vigente duplicada) |
| 422 | `BUSINESS_RULE_ERROR` | Regla de negocio (ej: vigencia certificado alturas) |
| 500 | `INTERNAL_ERROR` | Error servidor (loggeado) |

### Error Response Format
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Datos de entrada inválidos",
  "details": [
    { "field": "email", "message": "Formato de correo inválido" },
    { "field": "password", "message": "Contraseña muy corta (mín 8)" }
  ]
}
```

---

## Paginación y Filtros

### Listados estándar
```
GET /api/workers?page=1&limit=20&search=juan&estado=activo&empresa_id=xxx
```

### Response paginada
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## Rate Limiting

- **Default**: 100 req/min por IP
- **Auth endpoints**: 10 req/min (login, register)
- **File upload**: 20 req/min
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## Webhooks (Futuro)

> Para integración con sistemas externos (ERP, nómina, ARL)

| Evento | Payload |
|--------|---------|
| `worker.created` | `{ worker: Worker }` |
| `exam.expiring` | `{ exam: WorkerExam, worker: Worker, days: 30 }` |
| `cert.expiring` | `{ cert: WorkerCert, worker: Worker, days: 30 }` |
| `incident.reported` | `{ incident: Incident }` |
| `alert.generated` | `{ alerts: Alert[] }` |