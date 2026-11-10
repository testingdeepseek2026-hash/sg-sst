@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   SG-SST - Inicializador Automático
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
    echo   Primera ejecución: instalando dependencias (puede tardar unos minutos)...
    pnpm install
) else (
    echo   Dependencias detectadas, verificando consistencia...
    pnpm install --frozen-lockfile
)

echo.
echo 2. Limpiando builds anteriores...
if exist "dist" rmdir /s /q "dist" 2>nul
if exist "web/dist" rmdir /s /q "web/dist" 2>nul
if exist "server/dist" rmdir /s /q "server/dist" 2>nul

echo.
echo 3. Iniciando servidores (backend + frontend)...
echo   (Espere 3-5 segundos mientras los servicios se arrancan)
start /b "" pnpm run dev

echo.
echo 4. Esperando a que el backend esté listo...
set retries=0
:health_check_loop
echo   Health check intento !retries!...
curl -s --max-time 5 http://localhost:4000/api/health >nul
set curl_error=%errorlevel%
if !curl_error! equ 0 (
    :: Health check exitoso (cualquier respuesta de http 2xx/3xx)
    echo   Health check OK.
    goto health_check_success
) else (
    set /a retries+=1
    if !gtr!retries 30 (
        echo.
        echo ERROR: El servidor no respondió después de 30 intentos.
        echo Intente detener con Ctrl+C y ejecutar: pnpm run dev:api
        pause
        exit /b 1
    )
    timeout /t 3 >nul
    goto health_check_loop
)

:health_check_success
echo.
echo ========================================
echo   SG-SST ESTÁ CORRIENDO
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
echo   El navegador se abrió en la página de login...
start "" http://localhost:5173
echo.
pause