# Script de Verificación y Ejecución

## ✅ Ejecuta ESTO en PowerShell o CMD:

```powershell
# Navegar a la carpeta del proyecto
cd "C:\Users\PC\sg-sst"

# Ejecutar el servidor con datos semilla
$env:SEED="true"
pnpm run dev
```

## 📋 PASOS DETALLADOS:

### 1. Abrir PowerShell como Administrador

- Win + X → "Windows PowerShell ( Administrador )"

### 2. Navegar al proyecto

```powershell
cd "C:\Users\PC\sg-sst"
```

### 3. Ejecutar el servidor

```powershell
# Método 1: Con variables de entorno
$env:SEED="true"
pnpm run dev

# Método 2: Directamente
SEED=true pnpm run dev
```

### 4. Cuando veas estos mensajes, abre el navegador:

- **Frontend:** http://localhost:5173
- **Health Check:** http://localhost:4000/api/health

### 5. Inicia sesión con:

- **Email:** `admin@sg-sst.local`
- **Password:** `Admin1234!`

---

## 🛠️ Comandos de Respaldo (si el anterior falla)

```powershell
# Limpiar y reinstalar
Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "web\dist" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "server\dist" -ErrorAction SilentlyContinue
pnpm install
$env:SEED="true"
pnpm run dev
```

---

## ❓ Problemas comunes

### Error: "pnpm no se reconoce"

Solución: Reinicia PowerShell y ejecuta:

```powershell
npm install -g pnpm
```

### Error: "Puerto en uso"

Solución: Mata procesos en los puertos:

```powershell
netstat -ano | findstr ":5173"
netstat -ano | findstr ":4000"
# Busca el PID y mata con:
taskkill /PID <numero> /F
```

### Error: "Base de datos vacía"

Asegúrate de ver en consola:

```
Semilla cargada.
```

---

## ✅ Verificación final

Después de iniciar sesión, deberías ver:

1. **Dashboard:** Estadísticas de cumplimiento, trabajadores, acciones
2. **Trabajadores:** Lista con el trabajador "Juan Pérez"
3. **Matriz de Peligros:** Catálogo de riesgos
4. **Política SST:** Plantilla editable
