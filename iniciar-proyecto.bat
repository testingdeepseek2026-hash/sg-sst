@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   SG-SST - Inicializador Automatico
echo ========================================
echo.

:: Verificar prerrequisitos
where pnpm >nul 2>nul
if errorlevel 1 (
    echo ERROR: pnpm no se encuentra en el PATH.
    echo Cierre esta ventana y ejecute: npm install -g pnpm
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js no se encuentra en el PATH.
    echo Instale Node.js 22.x desde https://nodejs.org/
    pause
    exit /b 1
)

echo 1. Verificando/Instalando dependencias...
if not exist "server\node_modules" (
    echo   Primera ejecucion: instalando dependencias, puede tardar unos minutos...
    call pnpm install
) else (
    echo   Dependencias detectadas, verificando consistencia...
    call pnpm install --frozen-lockfile
)
if errorlevel 1 (
    echo ERROR: Fallo la instalacion de dependencias.
    pause
    exit /b 1
)

echo.
echo 2. Limpiando builds anteriores...
if exist "dist" rmdir /s /q "dist" 2>nul
if exist "web\dist" rmdir /s /q "web\dist" 2>nul
if exist "server\dist" rmdir /s /q "server\dist" 2>nul
echo   Listo.

echo.
echo 3. Iniciando servidores (backend + frontend)...
echo   Espere 3-5 segundos mientras los servicios arrancan...
start "SG-SST Dev Server" cmd /c "call pnpm run dev & pause"

echo.
echo 4. Esperando a que el backend este listo...
set retries=0

:health_check_loop
echo   Health check intento !retries!...
curl -s --max-time 5 http://localhost:4000/api/health >nul 2>nul
if !errorlevel! equ 0 (
    echo   Health check OK.
    goto health_check_success
)
set /a retries+=1
if !retries! gtr 30 (
    echo.
    echo ERROR: El servidor no respondio despues de 30 intentos.
    echo Revise la ventana "SG-SST Dev Server" para ver el error.
    echo O ejecute manualmente: pnpm run dev:api
    pause
    exit /b 1
)
timeout /t 3 >nul
goto health_check_loop

:health_check_success
echo.
echo ========================================
echo   SG-SST ESTA CORRIENDO
echo ========================================
echo.
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:4000
echo   Health:   http://localhost:4000/api/health
echo.
echo   Credenciales de prueba:
echo   - admin@sg-sst.local / Admin1234! (administrador)
echo   - trabajador@sg-sst.local / Trab1234! (trabajador)
echo.
echo   Abriendo el navegador...
start "" http://localhost:5173
echo.
echo   Para detener: cierre la ventana "SG-SST Dev Server"
echo.
pause
