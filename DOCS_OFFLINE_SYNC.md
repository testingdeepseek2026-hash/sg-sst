# SG-SST - Soporte Offline y Sincronización

## Estado Actual

### ✅ PWA Configurada (Workbox)

- **Archivo**: `web/vite.config.ts` + `web/public/sw.js` (generado)
- **Estrategia**: `GenerateSW` con `precacheManifest`
- **Cache**: 37 entradas (8.8 MB) - HTML, JS, CSS, assets estáticos
- **Runtime caching**: No configurado explícitamente (solo precache)

### ✅ Funciona Offline (Solo Lectura)

- Navegación entre páginas (SPA)
- Visualización de datos ya cargados en memoria/IndexedDB
- Formularios se pueden abrir y editar localmente

### ❌ No Funciona Offline (Escritura/Sync)

- **Guardar** formularios (POST/PUT/DELETE) → Error de red
- **Subir** archivos/fotos → Error de red
- **Firmas digitales** → Se guardan en estado local, no se envían
- **Sincronización** al volver online → No implementada

---

## Qué se Necesita para Offline Completo

### 1. Service Worker Avanzado (`web/src/sw-custom.ts`)

```typescript
// Estrategias necesarias:
// - StaleWhileRevalidate para GET /api/*
// - BackgroundSync para POST/PUT/DELETE (cola de mutaciones)
// - CacheFirst para assets estáticos
// - NetworkFirst con fallback para datos críticos
```

### 2. Base de Datos Local (IndexedDB / Dexie.js)

```typescript
// Tablas locales:
// - pendingMutations: { id, method, url, body, timestamp, retries }
// - localExams, localInspections, localPermits, etc.
// - Conflict resolution: server-wins / client-wins / manual
```

### 3. Detección de Conectividad

```typescript
// Hook useOnlineStatus()
// - navigator.onLine + heartbeat /api/health
// - UI indicator (banner superior)
// - Auto-sync cuando vuelve online
```

### 4. Resolución de Conflictos

| Escenario                                | Estrategia                          |
| ---------------------------------------- | ----------------------------------- |
| Mismo registro editado offline/online    | Server-wins + notificar usuario     |
| Nuevo registro offline + mismo ID online | Client-wins (IDs únicos UUID)       |
| Archivo subido offline vs online         | Mantener ambos, versionar           |
| Firma digital offline                    | Guardar local, sincronizar metadata |

---

## Implementación Recomendada (Fase Futura)

### Prioridad Alta

1. **Background Sync API** para mutaciones pendientes
2. **IndexedDB** con Dexie.js para almacenamiento local tipado
3. **Indicador visual** de estado online/offline en Layout

### Prioridad Media

1. **Conflict resolution UI** para revisar discrepancias
2. **Sync manual** (botón "Sincronizar ahora")
3. **Logs de sincronización** en auditoría

### Prioridad Baja

1. **Push notifications** para sync completado
2. **Compresión** de cola de mutaciones
3. **Métricas** de uso offline

---

## Riesgos y Mitigaciones

| Riesgo                   | Impacto | Mitigación                                         |
| ------------------------ | ------- | -------------------------------------------------- |
| Pérdida de datos offline | Alto    | Auto-guardado local cada 30s + confirmación visual |
| Conflictos de versión    | Medio   | UUIDs únicos, timestamps, revisión manual          |
| Archivos grandes (fotos) | Alto    | Comprimir antes de guardar local, sync diferido    |
| Usuario no sincroniza    | Medio   | Alerta tras 24h offline, sync forzado al login     |

---

## Decisión Actual

**La PWA actual satisface el requisito básico de "cache para assets y navegación offline".**

**NO se implementa sincronización automática completa en esta fase** porque:

1. Requiere acuerdo explícito con el usuario sobre resolución de conflictos
2. Aumenta complejidad significativamente (testing, edge cases)
3. El uso principal es en oficinas/obras con conectividad
4. Puede añadirse en fase futura sin breaking changes

**Documentado en**: `PLAN_TRABAJO_SG_SST.md` Fase 4.7 - Pendiente acuerdo con usuario.

---

## Referencias

- [Workbox Background Sync](https://developer.chrome.com/docs/workbox/modules/workbox-background-sync/)
- [IndexedDB + Dexie.js](https://dexie.org/)
- [PWA Offline Patterns](https://web.dev/offline-cookbook/)
