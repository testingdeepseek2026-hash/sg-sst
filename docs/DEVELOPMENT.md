# Guía de Desarrollo SG-SST

## Requisitos Previos

| Herramienta | Versión | Instalación                                                  |
| ----------- | ------- | ------------------------------------------------------------ |
| Node.js     | 22.x    | `nvm install 22` (ver `.nvmrc`)                              |
| pnpm        | 9.15.0  | `corepack enable && corepack prepare pnpm@9.15.0 --activate` |
| Git         | 2.x     | Sistema                                                      |
| SQLite      | 3.x     | Incluido en Node 22 (`node:sqlite`)                          |

## Setup Inicial

```bash
# 1. Clonar repositorio
git clone https://github.com/tu-org/sg-sst.git
cd sg-sst

# 2. Instalar dependencias (root + workspaces)
pnpm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# 4. Inicializar base de datos + seed
pnpm reset

# 5. Instalar Git hooks
pnpm prepare

# 6. Levantar desarrollo (backend + frontend)
pnpm dev
```

## Estructura de Comandos

```bash
# Desarrollo
pnpm dev                 # Backend + Frontend concurrentemente
pnpm dev:api             # Solo backend (Fastify + tsx watch)
pnpm dev:web             # Solo frontend (Vite)

# Build
pnpm build               # Build completo (web + server)
pnpm -w web run build    # Solo frontend
pnpm -w server run build # Solo backend

# Testing
pnpm test                # Tests unitarios backend + frontend
pnpm test:watch          # Tests en modo watch
pnpm test:coverage       # Tests con cobertura
pnpm -w server run test  # Solo backend
pnpm -w web run test     # Solo frontend (vitest)
pnpm -w web run test:e2e # E2E con Playwright

# Linting & Formatting
pnpm lint                # ESLint (max-warnings 0)
pnpm lint:fix            # ESLint auto-fix
pnpm format              # Prettier write
pnpm format:check        # Prettier check

# Type Checking
pnpm typecheck           # tsc --noEmit (backend + frontend)
pnpm -w server run typecheck
pnpm -w web run typecheck

# Base de Datos
pnpm seed                # Poblar datos demo
pnpm reset               # Reset DB + seed (CUIDADO: borra datos)

# Release
pnpm release             # Patch version + CHANGELOG
pnpm release:minor       # Minor version
pnpm release:major       # Major version
```

## Variables de Entorno

### Root (.env)

El backend carga automáticamente el `.env` de la raíz del repositorio, sin importar desde qué carpeta se ejecute (`pnpm dev`, `pnpm start`, seed o reset).

```bash
# Server
PORT=4000
HOST=127.0.0.1
SESSION_SECRET=tu-secret-super-seguro-cambiar-en-produccion

# Base de datos (SQLite)
# Las rutas relativas se resuelven contra la raíz del repositorio.
# SG_SST_DATA_DIR (directorio) tiene prioridad sobre DB_PATH (archivo).
SG_SST_DATA_DIR=./data
# DB_PATH=./data/sg-sst.db

# Email (alertas)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alertas@empresa.com
SMTP_PASS=app-password
SMTP_FROM=SG-SST <alertas@empresa.com>
```

No se usa un `.env` dentro de `server/`; el frontend puede usar variables `VITE_*` en `web/.env` si se necesitan.

## Workflow Git

### Convención de Commits (Conventional Commits)

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Tipos válidos**:

- `feat`: Nueva funcionalidad
- `fix`: Corrección de bug
- `docs`: Documentación
- `style`: Formato (sin lógica)
- `refactor`: Refactorización
- `perf`: Mejora rendimiento
- `test`: Tests
- `chore`: Mantenimiento
- `build`: Sistema de build
- `ci`: CI/CD
- `revert`: Revertir commit

**Ejemplos**:

```
feat(workers): agregar validación vigencia certificado alturas 3 años
fix(hazards): corregir ordenación evaluaciones IPERC por fecha
docs(api): actualizar endpoints de exámenes médicos
refactor(policies): extraer lógica de versionado a service
test(alerts): agregar tests unitarios generateAlerts
chore(deps): actualizar dependencias desarrollo
```

### Flujo de Ramas

```
main (protegida, deploy automático)
  ↑
develop (integración continua)
  ↑
feature/* | fix/* | docs/* | refactor/*
```

### Pull Request Process

1. Crear rama desde `develop`: `git checkout -b feat/nueva-funcionalidad`
2. Commits atómicos siguiendo Conventional Commits
3. Push y crear PR hacia `develop`
4. CI debe pasar (lint, test, build, typecheck)
5. Code review obligatorio (CODEOWNERS)
6. Squash & merge a `develop`
7. Release: PR `develop` → `main` trigger `standard-version`

### Git Hooks (Husky)

- **pre-commit**: `lint-staged` (ESLint + Prettier en archivos staged)
- **commit-msg**: `commitlint` (valida Conventional Commits)

```bash
# Saltar hooks (solo emergencias)
git commit --no-verify -m "fix: hotfix crítico"
```

## Testing Strategy

### Backend (Vitest + node:sqlite en memoria)

```bash
# Tests unitarios services
pnpm -w server run test

# Tests de integración (Fastify inject)
pnpm -w server run test -- --reporter=verbose

# Coverage
pnpm -w server run test:coverage
# Abrir server/coverage/index.html
```

**Cobertura objetivo**: 80% services, 60% routes

### Frontend (Vitest + Testing Library + jsdom)

```bash
pnpm -w web run test
pnpm -w web run test:coverage
# Abrir web/coverage/index.html
```

**Cobertura objetivo**: 60% components/hooks/utils

### E2E (Playwright)

```bash
# Requiere servidor corriendo
pnpm -w web run dev &
pnpm -w web run test:e2e

# UI mode
pnpm -w web run test:e2e -- --ui
```

## Debugging

### Backend (VS Code)

```json
// .vscode/launch.json
{
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["-w", "server", "run", "dev"],
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### Frontend (VS Code + Vite)

```json
{
  "type": "chrome",
  "request": "launch",
  "name": "Debug Frontend",
  "url": "http://localhost:5173",
  "webRoot": "${workspaceFolder}/web/src"
}
```

### Logs

- Backend: `pnpm dev:api` → consola con pretty-print (Fastify logger)
- Frontend: DevTools Console + Vite HMR overlay
- SQLite: `DEBUG=sqlite* pnpm dev:api` (verbose)

## Base de Datos Local

```bash
# Ver esquema
sqlite3 data/sg-sst.db ".schema"

# Query interactiva
sqlite3 data/sg-sst.db

# Backup manual
cp data/sg-sst.db backups/manual-$(date +%Y%m%d).db

# Reset completo
pnpm reset
```

## Problemas Comunes

| Problema                    | Solución                                                 |
| --------------------------- | -------------------------------------------------------- |
| `pnpm install` falla        | `pnpm store prune && pnpm install`                       |
| Puerto 4000/5173 ocupado    | Cambiar `PORT` en .env o matar proceso                   |
| DB locked                   | Verificar que no hay otro proceso `tsx watch`            |
| Tests fallan por timeout    | Aumentar `testTimeout` en vitest.config.ts               |
| Husky no ejecuta            | `pnpm prepare` (reinstala hooks)                         |
| TypeScript errors en import | Verificar `tsconfig.json` paths y `package.json` exports |

## Extensiones VS Code Recomendadas

```json
// .vscode/extensions.json
[
  "dbaeumer.vscode-eslint",
  "esbenp.prettier-vscode",
  "bradlc.vscode-tailwindcss", // si usas tailwind
  "formulahendry.auto-rename-tag",
  "christian-kohler.path-intellisense",
  "usernamehw.errorlens",
  "vitest.explorer"
]
```

## Settings VS Code Recomendados

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "vitest.enable": true
}
```

## Scripts Útiles Adicionales

```bash
# Generar componente React (ejemplo)
pnpm -w web exec plop component

# Ver dependencias desactualizadas
pnpm outdated -r

# Auditar vulnerabilidades
pnpm audit

# Limpiar todo (node_modules, dist, coverage)
pnpm -r exec rm -rf node_modules dist coverage
pnpm install
```
