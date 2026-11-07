# Arquitectura SG-SST

## Visión General

SG-SST (Sistema de Gestión de Seguridad y Salud en el Trabajo) es una aplicación web full-stack diseñada para microempresas de servicios de instalación electrónica (CCTV, alarmas, control de acceso, cableado) en Colombia, cumpliendo con la normativa nacional (Decreto 1072/2015, Resolución 0312/2019, ISO 45001).

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Navegador)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   React 18   │  │ React Router │  │   PWA/       │              │
│  │   + Vite     │  │     v6       │  │   Service    │              │
│  │   TypeScript │  │              │  │   Worker     │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                      │
│         └─────────────────┼─────────────────┘                      │
│                           │ HTTPS + Cookies (httpOnly)             │
│                           ▼                                        │
└─────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (Fastify)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   CORS       │  │   Cookie     │  │  Multipart   │              │
│  │   Plugin     │  │   Plugin     │  │   Plugin     │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│         │                 │                 │                      │
│         └─────────────────┼─────────────────┘                      │
│                           ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    ROUTES (Prefijo /api)                     │  │
│  │  /companies  /users  /roles  /workers  /hazards  /standards  │  │
│  │  /plans      /indicators /incidents /inspections /policies   │  │
│  │  /alerts     /documents /actions  /audits   /export /import  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           │                                        │
│                           ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      SERVICES (Business Logic)               │  │
│  │  policies, hazards, workers, exams, certs, epp, alerts,      │  │
│  │  standards, inspections, incidents, plans, indicators,       │  │
│  │  documents, actions, audits, companies, users, roles         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           │                                        │
│                           ▼                                        │
└─────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATA LAYER (SQLite)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  node:sqlite │  │  Migraciones │  │    Seed      │              │
│  │  (Sync API)  │  │  (SQL files) │  │  (Demo data) │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

## Stack Tecnológico

### Frontend (web/)
- **React 18** - UI Library con Concurrent Features
- **TypeScript 5.7** - Tipado estricto
- **Vite 6** - Build tool y dev server ultrarrápido
- **React Router 6** - Routing SPA
- **Vite PWA Plugin** - Service Worker, offline-first
- **Lucide React** - Iconografía consistente
- **CSS Modules / Variables CSS** - Estilos sin dependencias externas

### Backend (server/)
- **Fastify 5** - Framework web alto rendimiento, schema validation
- **TypeScript 5.7** - Tipado estricto
- **node:sqlite** - Base de datos embebida, API síncrona nativa (Node 22+)
- **Zod** - Validación de esquemas (request/response)
- **JWT en Cookies httpOnly** - Autenticación stateless segura
- **Nodemailer** - Envío de alertas por email
- **PDFKit + ExcelJS** - Generación de reportes
- **Cron** - Scheduler de alertas automáticas

### Herramientas de Desarrollo
- **pnpm 9** - Package manager rápido, disk-efficient
- **ESLint 9 (Flat Config)** - Linting TypeScript/React estricto
- **Prettier 3** - Formateo consistente
- **Husky 9** - Git hooks
- **lint-staged** - Lint solo archivos staged
- **commitlint** - Conventional Commits
- **standard-version** - Versionado semántico + CHANGELOG automático
- **Vitest** - Unit/Integration testing (backend + frontend)
- **Testing Library** - Component testing React
- **Playwright** - E2E testing cross-browser
- **GitHub Actions** - CI/CD pipeline

## Decisiones Técnicas Clave

### 1. SQLite con node:sqlite (API Síncrona)
- **Por qué**: Node 22+ incluye `node:sqlite` nativo sin dependencias nativas (no node-gyp, no compilación).
- **Ventajas**: Zero-config, embebido, backup simple (copiar archivo), ACID completo, WAL mode.
- **Trade-offs**: No escalable horizontalmente (single-writer), pero ideal para microempresa (<50 users concurrentes).

### 2. Autenticación JWT en Cookies httpOnly
- **Por qué**: Evita XSS (no accesible desde JS), CSRF mitigado con SameSite=Lax + validación de origen.
- **Implementación**: Cookie firmada con secret, payload mínimo (userId, email), refresh token rotation opcional.

### 3. Monorepo con pnpm Workspaces
- **Estructura**: `server/`, `web/` como workspaces independientes, config compartida en root.
- **Ventajas**: Install único, hoisting inteligente, scripts cross-workspace, type-checking compartido.

### 4. TypeScript Strict Mode en Todo el Proyecto
- `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- Elimina categorías enteras de bugs en tiempo de compilación.

### 5. Conventional Commits + standard-version
- Historial de commits semántico, CHANGELOG generado automáticamente, versionado semántico automático.

### 6. Testing Strategy
- **Backend**: Unit (services) + Integration (Fastify inject) + Migration/Seed tests. Coverage 80% services.
- **Frontend**: Component (Testing Library) + Hook tests + API client tests. Coverage 60%.
- **E2E**: Playwright critical paths (login → dashboard → CRUD modules).

### 7. PWA (Progressive Web App)
- Service Worker con Workbox (vite-plugin-pwa)
- Offline-first para consultas de catálogos, estándares, políticas
- Installable en móvil/desktop

## Estructura de Directorios

```
sg-sst/
├── .github/
│   ├── workflows/ci.yml          # CI/CD Pipeline
│   ├── dependabot.yml            # Auto-update dependencies
│   ├── CODEOWNERS                # Reviewers obligatorios
│   ├── pull_request_template.md  # PR Template
│   └── ISSUE_TEMPLATE/           # Bug/Feature templates
├── .husky/
│   ├── pre-commit                # lint-staged
│   └── commit-msg                # commitlint
├── docs/
│   ├── ARCHITECTURE.md           # Este archivo
│   ├── API.md                    # OpenAPI/Swagger endpoints
│   ├── DATABASE.md               # Esquema ER, migraciones
│   ├── DEVELOPMENT.md            # Setup local, workflow
│   ├── DEPLOYMENT.md             # Docker, env, backup, SSL
│   └── CONTRIBUTING.md           # Guía contribución
├── server/
│   ├── src/
│   │   ├── index.ts              # Entry point Fastify
│   │   ├── lib/                  # DB, utils, email, scheduler
│   │   ├── routes/               # API Routes (Fastify plugins)
│   │   ├── services/             # Business Logic (Pure functions)
│   │   ├── seed/                 # Seed data
│   │   ├── __tests__/            # Smoke tests
│   │   └── types.ts              # Augmentation types
│   ├── tests/
│   │   ├── setup.ts              # Test utilities, factories
│   │   ├── unit/services/        # Unit tests services
│   │   └── integration/          # Integration tests (routes, migrations)
│   ├── vitest.config.ts
│   ├── eslint.config.js
│   ├── tsconfig.json
│   └── package.json
├── web/
│   ├── src/
│   │   ├── main.tsx              # Entry point React
│   │   ├── App.tsx               # Router + Layout
│   │   ├── pages/                # Page components (Route components)
│   │   ├── components/           # Shared UI components
│   │   ├── lib/                  # API client, utilities
│   │   ├── hooks/                # Custom React hooks
│   │   ├── context/              # React Context (Auth)
│   │   └── tests/                # Frontend tests
│   ├── tests/
│   │   ├── setup.ts              # Test utilities
│   │   ├── components/           # Component tests
│   │   ├── hooks/                # Hook tests
│   │   ├── lib/                  # API client tests
│   │   └── e2e/                  # Playwright E2E tests
│   ├── playwright.config.ts
│   ├── vitest.config.ts
│   ├── eslint.config.js
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── package.json
├── package.json                  # Root scripts, devDependencies
├── eslint.config.js              # Root ESLint Flat Config
├── .prettierrc                   # Prettier config
├── .prettierignore
├── commitlint.config.js
├── lint-staged.config.js
├── .editorconfig
├── .nvmrc
├── .gitignore
└── CHANGELOG.md
```

## Patrones de Diseño Utilizados

### Backend
- **Repository Pattern implícito**: Services encapsulan acceso a DB, routes solo orquestan.
- **Pure Functions**: Services son funciones puras (db, input) → output, facilita testing.
- **Zod Schemas**: Validación en routes, types inferidos en services.
- **Error Handling**: Errores de negocio como excepciones con mensajes claros, HTTP status codes apropiados.

### Frontend
- **Container/Presentational**: Pages (containers) + Components (presentational).
- **Custom Hooks**: `useAuth`, `useApi` para lógica reutilizable.
- **React Context**: Auth state global.
- **Optimistic Updates**: Para mejor UX en CRUD.
- **Error Boundaries**: Captura errores de render.

## Seguridad

| Capa | Medida |
|------|--------|
| Transporte | HTTPS obligatorio en producción, HSTS |
| Autenticación | JWT en cookie httpOnly, SameSite=Lax, Secure |
| Autorización | Roles (admin, responsable_sst, supervisor, worker), middleware por ruta |
| Datos Sensibles | Ley 1581/2012 - Consentimiento médico obligatorio, ofuscación en listados |
| Validación | Zod en todos los endpoints (body, query, params) |
| Headers | Helmet-like (CSP, X-Frame-Options, etc. via Fastify plugins) |
| Rate Limiting | Fastify rate-limit plugin (configurable) |
| Dependencias | Dependabot + audit en CI, lockfile committed |

## Escalabilidad y Límites

- **Usuarios concurrentes**: ~50 (SQLite single-writer)
- **Tamaño DB**: < 100 MB típicos (años de datos)
- **Backups**: Copia archivo `.db` (consistente con WAL checkpoint)
- **Migración futura**: PostgreSQL/MySQL cambiando solo `lib/db.ts` (interfaz compatible)

## Flujo de Datos Típico

```
Usuario → Frontend (React) → API (Fastify) → Service (Logic) → SQLite
                                        ↓
                              Eventos: Alertas, Email, Scheduler
                                        ↓
                              Respuesta JSON → Frontend → UI Update
```