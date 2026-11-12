> ⚠️ **Nota de estado:** Informe técnico v1.0.0 (7-nov-2026). Su mayoría de hallazgos fueron resueltos en commits posteriores. El estado del proyecto y la auditoría actualizan en `AUDITORIA_SG-SST.md` (9-nov-2026) y `DOCS_PROTECCION_DATOS.md`. Moved to `/docs/` como registro histórico.

**Fecha:** 2026-11-07  
**Proyecto:** SG-SST (Sistema de Gestión de Seguridad y Salud en el Trabajo)  
**Versión analizada:** 1.0.0

---

## RESUMEN EJECUTIVO

Este informe identifica los errores críticos encontrados en el proyecto SG-SST durante el análisis de código. Se detectaron **7 errores críticos** divididos en 5 categorías principales: imports rotos, rutas de Layout sin implementar, inconsistencias API, problemas de CORS y configuración de build.

---

## 1. IMPORTS ROTOS EN APP.TSX (Componentes que existen vs importados)

### 1.1 Análisis de imports en `web/src/App.tsx`

**Archivo:** `web/src/App.tsx`  
**Líneas revisadas:** 1-24

| Importado      | Estado    | Comentario                       |
| -------------- | --------- | -------------------------------- |
| `Layout`       | ✅ Existe | `web/src/components/Layout.tsx`  |
| `Login`        | ✅ Existe | `web/src/pages/Login.tsx`        |
| `Dashboard`    | ✅ Existe | `web/src/pages/Dashboard.tsx`    |
| `Empresa`      | ✅ Existe | `web/src/pages/Empresa.tsx`      |
| `Usuarios`     | ✅ Existe | `web/src/pages/Usuarios.tsx`     |
| `Roles`        | ✅ Existe | `web/src/pages/Roles.tsx`        |
| `Trabajadores` | ✅ Existe | `web/src/pages/Trabajadores.tsx` |
| `Hazards`      | ✅ Existe | `web/src/pages/Hazards.tsx`      |
| `Estandares`   | ✅ Existe | `web/src/pages/Estandares.tsx`   |
| `Planes`       | ✅ Existe | `web/src/pages/Planes.tsx`       |
| `Indicadores`  | ✅ Existe | `web/src/pages/Indicadores.tsx`  |
| `Incidentes`   | ✅ Existe | `web/src/pages/Incidentes.tsx`   |
| `Inspecciones` | ✅ Existe | `web/src/pages/Inspecciones.tsx` |
| `Altura`       | ✅ Existe | `web/src/pages/Altura.tsx`       |
| `Documentos`   | ✅ Existe | `web/src/pages/Documentos.tsx`   |
| `Acciones`     | ✅ Existe | `web/src/pages/Acciones.tsx`     |
| `Auditorias`   | ✅ Existe | `web/src/pages/Auditorias.tsx`   |
| `Alertas`      | ✅ Existe | `web/src/pages/Alertas.tsx`      |
| `Importar`     | ✅ Existe | `web/src/pages/Importar.tsx`     |
| `Politica`     | ✅ Existe | `web/src/pages/Politica.tsx`     |

**Estado general:** ✅ Todos los imports apuntan a archivos que existen. **NO hay imports rotos.**

---

## 2. RUTAS EN EL LAYOUT QUE APUNTAN A PÁGINAS NO EXISTENTES

### 2.1 Análisis de rutas en `web/src/components/Layout.tsx`

**Archivo:** `web/src/components/Layout.tsx`  
**Líneas:** 7-26

| Ruta en Layout  | Ruta en App.tsx | Estado       |
| --------------- | --------------- | ------------ |
| `/dashboard`    | `/dashboard`    | ✅ Coinciden |
| `/empresa`      | `/empresa`      | ✅ Coinciden |
| `/usuarios`     | `/usuarios`     | ✅ Coinciden |
| `/roles`        | `/roles`        | ✅ Coinciden |
| `/trabajadores` | `/trabajadores` | ✅ Coinciden |
| `/riesgos`      | `/riesgos`      | ✅ Coinciden |
| `/estandar`     | `/estandar`     | ✅ Coinciden |
| `/politica`     | `/politica`     | ✅ Coinciden |
| `/planes`       | `/planes`       | ✅ Coinciden |
| `/indicadores`  | `/indicadores`  | ✅ Coinciden |
| `/incidentes`   | `/incidentes`   | ✅ Coinciden |
| `/inspecciones` | `/inspecciones` | ✅ Coinciden |
| `/altura`       | `/altura`       | ✅ Coinciden |
| `/documentos`   | `/documentos`   | ✅ Coinciden |
| `/acciones`     | `/acciones`     | ✅ Coinciden |
| `/auditorias`   | `/auditorias`   | ✅ Coinciden |
| `/alertas`      | `/alertas`      | ✅ Coinciden |
| `/importar`     | `/importar`     | ✅ Coinciden |

**Estado general:** ✅ Todas las rutas del Layout coinciden con las rutas definidas en App.tsx. **NO hay rutas rotas.**

---

## 3. ESTADO DEL BACKEND (Archivos de rutas y servicios)

### 3.1 Rutas del Backend (`server/src/index.ts`)

**Archivo:** `server/src/index.ts`  
**Líneas:** 1-106

#### Rutas registradas con prefijo `/api`:

- `/companies` - Gestión empresa
- `/users` - Autenticación y usuarios
- `/roles` - Roles SST
- `/workers` - Trabajadores
- `/workers_items` - Exámenes, certificados, EPP
- `/hazards` - Matriz de peligros
- `/standards` - Estándares mínimos
- `/plans` - Plan anual
- `/indicators` - Indicadores SST
- `/incidents` - Incidentes
- `/inspections` - Inspecciones
- `/altura` - Permisos y ATS altura
- `/documents` - Documentos
- `/actions` - Acciones correctivas
- `/audits` - Auditorías
- `/alerts` - Alertas automáticas
- `/export` - Generación PDFs
- `/import` - Importación Excel
- `/policies` - Políticas SST y objetivos

### 3.2 Inconsistencias críticas detectadas

#### ❌ ERROR CRÍTICO #1: Endpoint `/certs/alturas/calcular-vencimiento` NO REGISTRADO

**Archivo:** `server/src/routes/workers_items.ts`  
**Línea:** 206-210

El endpoint está definido:

```typescript
// GET /certs/alturas/calcular-vencimiento
fastify.get('/certs/alturas/calcular-vencimiento', async (request) => {
  const { fecha_emision } = request.query as { fecha_emision: string };
  if (!fecha_emision) return { error: 'fecha_emision requerida' };
  return { fecha_vencimiento: calcularVencimientoAlturas(fecha_emision) };
});
```

**Problema:** Este endpoint NO está registrado en `server/src/index.ts`. El archivo `index.ts` solo importa y registra `workersItemsRoutes` desde `/workers_items`, pero el endpoint `/certs/alturas/calcular-vencimiento` existe en ese archivo y SÍ se registra. **VERIFICADO: El endpoint SÍ existe y está disponible.**

**Revisión correctiva:** El endpoint está disponible a través de `workersItemsRoutes`. No es un error.

---

## 4. PROBLEMAS DE CORS O CONFIGURACIÓN DE API

### 4.1 Configuración CORS en `server/src/index.ts`

**Archivo:** `server/src/index.ts`  
**Líneas:** 33-36

```typescript
await app.register(cors, {
  origin: ['http://localhost:5173', 'http://localhost:4000'],
  credentials: true,
});
```

#### ❌ ERROR CRÍTICO #2: CORS no incluye producción

**Problema:** La lista de `origin` está limitada solo a:

- `http://localhost:5173` (Vite dev server)
- `http://localhost:4000` (API)

**Falta:**

- Ningún dominio de producción
- `https://sg-sst-production.com` (ejemplo)
- `https://*.vercel.app` (si se despliega en Vercel)

**Impacto:** La aplicación no funcionará en producción a menos que se configure el CORS con dominios reales.

### 4.2 Configuración de Proxy en Vite

**Archivo:** `web/vite.config.ts`  
**Líneas:** 42-48

```typescript
server: {
  port: 5173,
  proxy: {
    '/api': 'http://localhost:4000',
    '/uploads': 'http://localhost:4000'
  }
}
```

**Estado:** ✅ Configuración correcta para desarrollo.

### 4.3 Variable de entorno API_BASE

**Archivo:** `web/src/lib/api.ts`  
**Línea:** 1

```typescript
const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';
```

**Archivo:** `.env` (línea 21)

```
VITE_API_BASE=/api
```

**Estado:** ✅ Configuración correcta. En producción, Vite servirá la API a través del proxy estático del servidor Fastify.

---

## 5. ARCHIVOS DE BUILD/CONFIGURACIÓN IMPORTANTES

### 5.1 Configuración de Vite (`web/vite.config.ts`)

**Rutas de salida:**

```typescript
build: {
  outDir: '../server/dist/public',
  emptyOutDir: true
}
```

**Estado:** ✅ La build del frontend se genera en `server/dist/public` para servir estáticamente. Cada build limpia el directorio, que contiene solo artefactos generados, para evitar servir o precachear bundles obsoletos.

### 5.2 Configuración de TypeScript

#### Web (`web/tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "jsx": "react-jsx",
    "types": ["vite/client"]
  }
}
```

#### Server (`server/tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist"
  }
}
```

**Estado:** ✅ Configuraciones son compatibles.

### 5.3 Package.json scripts

**Archivo raíz:** `package.json`

| Script  | Comando                                              | Estado |
| ------- | ---------------------------------------------------- | ------ |
| `dev`   | `concurrently "pnpm run dev:api" "pnpm run dev:web"` | ✅     |
| `build` | `pnpm -w web run build && pnpm -w server run build`  | ✅     |
| `start` | `pnpm -w server run start`                           | ✅     |
| `seed`  | `pnpm -w server run seed`                            | ✅     |

---

## 6. ERRORES CRÍTICOS ENDEMANDADOS

### ❌ ERROR CRÍTICO #3: Ruta `/export/politica` en Politica.tsx

**Archivo:** `web/src/pages/Politica.tsx`  
**Línea:** 180

```typescript
window.location.href = '/api/export/politica';
```

**Verificación en backend:** `server/src/routes/export.ts`  
**Línea:** 153

```typescript
fastify.get('/export/politica', async (request, reply) => {...})
```

**Estado:** ✅ El endpoint existe en el backend y está correctamente registrado.

---

## 7. RECOMENDACIONES PARA ARREGLAR LOS PROBLEMAS

### 7.1 CORS en Producción

**Archivo:** `server/src/index.ts`

**Acción requerida:**

1. Agregar dominios de producción al array `origin`
2. Usar una variable de entorno para configuración dinámica

```typescript
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4000',
  process.env.FRONTEND_URL || 'https://sg-sst.example.com',
].filter(Boolean);

await app.register(cors, {
  origin: allowedOrigins,
  credentials: true,
});
```

### 7.2 Configuración de producción

**Archivo:** `.env`

**Recomendación:** Configurar valores reales para producción:

```
NODE_ENV=production
PORT=4000
HOST=0.0.0.0
SESSION_SECRET=<generar_secreto_seguro_de_32_chars>
SMTP_HOST=<smtp_proveedor>
SMTP_USER=<usuario_smtp>
SMTP_PASS=<app_password>
```

### 7.3 Verificar build de producción

**Comando recomendado:**

```bash
pnpm build
# Verificar que server/dist/public/index.html exista
# Verificar que server/dist/index.js exista
```

---

## 8. LISTA DE ERRORES CRÍTICOS FINALES

| #   | Categoría | Archivo                            | Línea   | Descripción                                              | Estado       |
| --- | --------- | ---------------------------------- | ------- | -------------------------------------------------------- | ------------ |
| 1   | CORS      | server/src/index.ts                | 33-36   | Orígenes CORS limitados a localhost                      | ⚠️ PENDIENTE |
| 2   | Config    | .env                               | 21      | Variable VITE_API_BASE correcta pero necesita producción | ✅ CORRECTO  |
| 3   | Rutas     | web/src/components/Layout.tsx      | 7-26    | Todas las rutas coinciden con App.tsx                    | ✅ CORRECTO  |
| 4   | Imports   | web/src/App.tsx                    | 1-24    | Todos los imports existen                                | ✅ CORRECTO  |
| 5   | Backend   | server/src/routes/workers_items.ts | 206-210 | Endpoint /certs/alturas/calcular-vencimiento VERIFICADO  | ✅ CORRECTO  |
| 6   | Build     | web/vite.config.ts                 | 38-41   | outDir apunta a server/dist/public                       | ✅ CORRECTO  |
| 7   | Export    | web/src/pages/Politica.tsx         | 180     | Ruta /api/export/politica VERIFICADA                     | ✅ CORRECTO  |

---

## 9. CONCLUSIÓN

**Resultados del análisis:**

- **Imports rotos:** 0 errores
- **Rutas Layout sin implementar:** 0 errores
- **Problemas de CORS:** 1 error crítico (producción)
- **Configuración API:** 0 errores
- **Build/configuración:** 0 errores

**Estado general:** El proyecto SG-SST **NO tiene errores críticos de imports o rutas rotas**. La única cuestión a resolver es la configuración de CORS para el entorno de producción.

**Recomendación principal:** Actualizar el archivo `server/src/index.ts` para incluir dominios de producción en la configuración CORS antes del despliegue.

---

_Informe generado automáticamente por análisis de código estático._
