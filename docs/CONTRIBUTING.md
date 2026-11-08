# Guía de Contribución SG-SST

Gracias por contribuir a SG-SST. Este documento describe el proceso para contribuir código, documentación, reportar bugs o sugerir mejoras.

## Código de Conducta

Este proyecto sigue el [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Al participar, se espera que mantengas un entorno respetuoso e inclusivo.

## Cómo Contribuir

### 1. Reportar Bugs

- Usa la plantilla **Bug Report** en GitHub Issues
- Incluye pasos para reproducir, comportamiento esperado vs actual, entorno
- Etiqueta: `bug`, `triage`

### 2. Sugerir Funcionalidades

- Usa la plantilla **Feature Request** en GitHub Issues
- Describe el problema, solución propuesta, alternativas
- Etiqueta: `enhancement`, `triage`

### 3. Contribuir Código

#### Setup Local

```bash
# Fork + Clone tu fork
git clone https://github.com/TU-USUARIO/sg-sst.git
cd sg-sst

# Agregar upstream
git remote add upstream https://github.com/ORG/sg-sst.git

# Instalar
pnpm install
pnpm prepare
cp .env.example .env
pnpm reset
```

#### Flujo de Trabajo

```bash
# 1. Actualizar develop
git checkout develop
git pull upstream develop

# 2. Crear rama feature
git checkout -b feat/descripcion-corta

# 3. Desarrollar con commits atómicos
# Hacer cambios...
git add .
git commit -m "feat(scope): descripción imperativa"

# 4. Verificar calidad
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test

# 5. Push y crear PR
git push origin feat/descripcion-corta
# Abrir PR en GitHub hacia develop
```

#### Convención de Commits (Obligatoria)

Usamos **Conventional Commits** v1.0.0. El hook `commit-msg` valida automáticamente.

```
<tipo>(<alcance>): <descripción corta>

[cuerpo opcional]

[footer opcional]
```

| Tipo       | Descripción          | Ejemplo                                        |
| ---------- | -------------------- | ---------------------------------------------- |
| `feat`     | Nueva funcionalidad  | `feat(workers): agregar exportación Excel`     |
| `fix`      | Corrección bug       | `fix(hazards): ordenar evaluaciones por fecha` |
| `docs`     | Documentación        | `docs(api): actualizar endpoints exámenes`     |
| `style`    | Formato (sin lógica) | `style: formatear con prettier`                |
| `refactor` | Refactorización      | `refactor(policies): extraer versionado`       |
| `perf`     | Mejora rendimiento   | `perf(alerts): optimizar query generateAlerts` |
| `test`     | Tests                | `test(alerts): add unit tests generateAlerts`  |
| `chore`    | Mantenimiento        | `chore(deps): actualizar dependencias`         |
| `build`    | Sistema build        | `build: configurar docker multi-stage`         |
| `ci`       | CI/CD                | `ci: agregar job e2e en PR a main`             |
| `revert`   | Revertir commit      | `revert: feat(workers): exportación Excel`     |

**Reglas**:

- Subject: imperativo, minúscula, sin punto final, máx 72 chars
- Scope: opcional, minúscula, kebab-case
- Body: explica QUÉ y POR QUÉ, no CÓMO
- Footer: `Closes #123`, `BREAKING CHANGE: ...`

#### Pull Request Checklist

Antes de crear PR, verifica:

- [ ] Tests pasan (`pnpm test`)
- [ ] Lint pasa (`pnpm lint`)
- [ ] Format check pasa (`pnpm format:check`)
- [ ] Typecheck pasa (`pnpm typecheck`)
- [ ] Build pasa (`pnpm build`)
- [ ] Commits siguen Conventional Commits
- [ ] PR template completado
- [ ] Documentación actualizada (si aplica)
- [ ] CHANGELOG se generará automáticamente

#### Code Review

- Mínimo 1 approval requerido (CODEOWNERS)
- Resolver todos los comentarios
- CI debe estar verde
- Squash & merge a `develop`

### 4. Mejorar Documentación

- Docs en `/docs/` (Markdown)
- README principal en root
- Comentarios en código (JSDoc/TSDoc para funciones públicas)
- Actualizar `DEVELOPMENT.md` si cambias setup

## Estándares de Código

### TypeScript

- **Strict mode** obligatorio (`strict: true`)
- No `any` explícito (usa `unknown` + type guards)
- Interfaces sobre types para objetos
- `const` assertions para literales
- Discriminated unions para estados

```typescript
// ✅ Bien
interface WorkerExam {
  tipo: 'ingreso' | 'periodico' | 'egreso' | 'control';
  resultado: 'apto' | 'apto_con_restricciones' | 'no_apto';
}

// ❌ Mal
type WorkerExam = {
  tipo: string;
  resultado: any;
};
```

### React (Frontend)

- Functional components + hooks
- Custom hooks para lógica reutilizable
- Testing Library para tests (no enzyme)
- Props tipadas con interface
- Error Boundaries en páginas principales

```tsx
// ✅ Bien
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger';
  onClick: () => void;
  children: React.ReactNode;
}

export function Button({ variant, onClick, children }: ButtonProps) {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick}>
      {children}
    </button>
  );
}
```

### Backend (Fastify)

- Pure functions en services (sin side effects salvo DB)
- Zod schemas para validación en routes
- Errores de negocio como excepciones con mensaje claro
- Tipos inferidos de Zod (`z.infer<typeof schema>`)

```typescript
// ✅ Bien - Service puro
export function createPolicy(db: DatabaseSync, input: PolicyInput): Policy {
  // Validación, lógica, DB
  return policy;
}

// Route - solo orquestación
app.post('/policies', async (request, reply) => {
  const data = createPolicySchema.parse(request.body);
  const policy = createPolicy(request.server.db, data);
  return reply.code(201).send(policy);
});
```

### Base de Datos

- UUID v4 para PKs (`genId()` utility)
- Fechas ISO 8601 en TEXT
- Foreign keys habilitadas (`PRAGMA foreign_keys=ON`)
- Índices en columnas de filtro frecuente
- Soft delete con `activo` / `estado` en lugar de DELETE

### Testing

- **Backend**: Unit (services) + Integration (Fastify inject)
- **Frontend**: Component (Testing Library) + Hooks + API client
- **E2E**: Playwright critical paths
- Factories para datos de test
- In-memory SQLite para tests backend

```typescript
// Test factory pattern
export const testFactories = {
  worker: (overrides = {}) => ({
    id: 'test-worker-1',
    nombres: 'Juan',
    apellidos: 'Pérez',
    ...overrides,
  }),
};
```

## Proceso de Release

Automatizado con **standard-version**:

```bash
# Patch (bug fixes)
pnpm release

# Minor (nuevas features, backward compatible)
pnpm release:minor

# Major (breaking changes)
pnpm release:major
```

Esto:

1. Calcula versión semántica basada en commits
2. Genera/actualiza `CHANGELOG.md`
3. Crea commit de release + tag `vX.Y.Z`
4. Push con `--follow-tags` dispara GitHub Release

## Preguntas Frecuentes

**¿Puedo hacer commit directo a main/develop?**
No. Ramas protegidas. Solo via PR con review.

**¿Qué pasa si mi commit no pasa commitlint?**
El hook `commit-msg` rechaza el commit. Corrige el mensaje y reintenta.

**¿Cómo salto hooks en emergencia?**
`git commit --no-verify -m "fix: hotfix crítico"` (solo hotfixes producción).

**¿Dónde veo la cobertura de tests?**
`pnpm test:coverage` → abre `server/coverage/index.html` y `web/coverage/index.html`.

**¿Cómo agrego una dependencia?**

```bash
# Producción
pnpm -w server add zod
pnpm -w web add react-hook-form

# Desarrollo
pnpm -w add -D vitest
```

## Contacto

- Issues: GitHub Issues (bugs, features)
- Discusiones: GitHub Discussions
- Seguridad: security@tudominio.com (no issues públicos)

---

**¡Gracias por contribuir!** 🎉
