<!--
Gracias por contribuir a SG-SST. Por favor completa la siguiente información.
Los PRs que no sigan esta plantilla pueden ser cerrados.
-->

## 📋 Descripción

<!-- Describe brevemente qué cambios introduce este PR -->

## 🎯 Tipo de cambio

<!-- Marca con una `x` el tipo de cambio que aplica -->

- [ ] 🐛 **Bug fix** (corrección que no rompe compatibilidad)
- [ ] ✨ **New feature** (funcionalidad nueva que no rompe compatibilidad)
- [ ] 💥 **Breaking change** (corrección o feature que rompe compatibilidad)
- [ ] 📝 **Documentation** (cambios solo en documentación)
- [ ] 🎨 **Style** (formato, punto y coma, etc; sin cambios de lógica)
- [ ] ♻️ **Refactor** (cambio de código que ni corrige bug ni añade feature)
- [ ] ⚡ **Performance** (mejora de rendimiento)
- [ ] ✅ **Test** (añadir o corregir tests)
- [ ] 🔧 **Chore** (tareas de mantenimiento, deps, build, etc.)
- [ ] 🏗️ **Build** (cambios en sistema de build o dependencias externas)
- [ ] 🤖 **CI** (cambios en configuración CI/CD)

## 🔗 Issues relacionados

<!-- Vincula issues usando palabras clave: Closes #123, Fixes #456, Related to #789 -->

- Closes #
- Related to #

## 🧪 Testing

<!-- Describe cómo probaste tus cambios -->

- [ ] Tests unitarios pasan (`pnpm test`)
- [ ] Tests de integración pasan
- [ ] Tests E2E pasan (`pnpm -w web run test:e2e`)
- [ ] Cobertura de código mantenida (>80% server, >60% web)
- [ ] Probado manualmente en entorno local

### Checklist de testing

- [ ] Lint pasa (`pnpm lint`)
- [ ] Format check pasa (`pnpm format:check`)
- [ ] Typecheck pasa (`pnpm typecheck`)
- [ ] Build pasa (`pnpm build`)

## 📸 Capturas de pantalla (si aplica)

<!-- Añade capturas de pantalla para cambios visuales -->

## 📋 Checklist final

<!-- Confirma que has completado todos los items -->

- [ ] Mi código sigue las guías de estilo del proyecto
- [ ] He realizado una auto-revisión de mi código
- [ ] He comentado mi código en áreas complejas
- [ ] He actualizado la documentación correspondiente
- [ ] Mis cambios no generan nuevos warnings de TypeScript/ESLint
- [ ] He añadido tests que cubren mis cambios
- [ ] Todos los tests nuevos y existentes pasan
- [ ] Los cambios dependientes han sido mergeados y publicados

## 🔄 Conventional Commits

<!-- Confirma que tus commits siguen Conventional Commits -->

- [ ] Mis commits siguen el formato: `type(scope): subject`
- [ ] Los tipos usados son válidos: feat, fix, docs, style, refactor, perf, test, chore, build, ci, revert

---

**Para revisores:**

- [ ] Código revisado y aprobado
- [ ] Tests verificados
- [ ] Documentación actualizada
- [ ] Listo para merge
