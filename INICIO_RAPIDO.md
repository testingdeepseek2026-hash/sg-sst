# Guía de Inicio Rápido - SG-SST

## 🚀 Problemas Comunes y Soluciones

### ❌ Problema: Dashboard vacío o módulos no responden

**Causa más probable:** La base de datos no tiene datos semilla inicializados.

### ✅ Solución

#### Opción 1: Inicializar base de datos automáticamente

```bash
# 1. Detener servidores (Ctrl+C si están corriendo)

# 2. Ejecutar servidor con SEMILLA
SEED=true pnpm run dev:api

# 3. En otra terminal, iniciar el frontend
pnpm run dev:web
```

#### Opción 2: Inicializar manualmente

```bash
# Solo inicializar datos semilla
pnpm run seed
```

#### Opción 3: Reiniciar completamente

```bash
# 1. Resetear base de datos
pnpm run reset

# 2. Ejecutar semilla
pnpm run seed

# 3. Iniciar todo
pnpm run dev
```

---

## 🔑 Credenciales de Acceso (Datos semilla)

| Usuario                   | Contraseña   | Rol           |
| ------------------------- | ------------ | ------------- |
| `admin@sg-sst.local`      | `Admin1234!` | administrador |
| `trabajador@sg-sst.local` | `Trab1234!`  | trabajador    |

---

## 📍 URLs de Desarrollo

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:4000
- **Health Check:** http://localhost:4000/api/health

---

## 🛠️ Comandos Útiles

```bash
# Verificar tipos TypeScript
pnpm run typecheck

# Formatear código
pnpm run format

# Compilar para producción
pnpm run build
```

---

## 🔧 CORS y Errores Comunes

Si aparecen errores de CORS en consola:

```bash
# Para producción, configurar variable de entorno:
export FRONTEND_URL=https://tu-dominio.com
```

---

## 📁 Estructura de Archivos Clave

```
├── web/                    # Frontend React
│   ├── src/
│   │   ├── main.tsx       # Punto de entrada
│   │   ├── App.tsx        # Rutas principales
│   │   ├── pages/         # Vistas (Dashboard, Trabajadores, etc.)
│   │   └── lib/api.ts     # Cliente API
│   └── vite.config.ts     # Configuración Vite
│
├── server/                 # Backend Fastify
│   ├── src/
│   │   ├── index.ts       # Archivo principal
│   │   ├── routes/        # Endpoints API
│   │   ├── services/      # Lógica de negocio
│   │   └── seed/          # Datos semilla
│   └── tsconfig.json
│
└── data/                   # Base de datos SQLite
    └── sg-sst.db
```

---

## 🐛 Si sigue sin funcionar...

1. **Verificar backend está corriendo:**

   ```bash
   curl http://localhost:4000/api/health
   # Debería retornar: {"status":"ok","db":"connected","version":"1.0.0"}
   ```

2. **Verificar login:**

   ```bash
   curl -X POST http://localhost:4000/api/users/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@sg-sst.local","password":"Admin1234!"}' \
     -c cookies.txt
   ```

3. **Verificar datos:**
   ```bash
   curl http://localhost:4000/api/workers \
     -b cookies.txt
   ```

---

## 🪟 Solución de problemas (Windows / PowerShell)

### Error: "pnpm no se reconoce"

Solución: reinicie PowerShell y ejecute:

```powershell
npm install -g pnpm
```

### Error: "Puerto en uso"

Mata los procesos en los puertos:

```powershell
netstat -ano | findstr ":5173"
netstat -ano | findstr ":4000"
# Busca el PID y mata con:
taskkill /PID <numero> /F
```

### Error: "Base de datos vacía"

Asegúrese de ver en consola:

```
Semilla cargada.
```

### Limpieza y reinstalación completa

```powershell
Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "web\dist" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "server\dist" -ErrorAction SilentlyContinue
pnpm install --frozen-lockfile
$env:SEED="true"
pnpm run dev
```

---

## ✅ Verificación final

Después de iniciar sesión, debería ver:

1. **Dashboard:** Estadísticas de cumplimiento, trabajadores, acciones
2. **Trabajadores:** Lista con el trabajador "Juan Pérez"
3. **Matriz de Peligros:** Catálogo de riesgos
4. **Política SST:** Plantilla editable
