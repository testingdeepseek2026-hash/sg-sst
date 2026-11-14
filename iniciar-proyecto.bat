@echo off
title SG-SST - Inicio local
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==========================================
echo   SG-SST - Inicio local (portatil)
echo ==========================================
echo.

:: 0. Verificar Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js no esta en el PATH. Instale Node.js 22 LTS.
    pause
    exit /b 1
)

:: 1. Verificar PostgreSQL: iniciarlo si esta detenido (idea del ERP Gr Seguridad)
echo [1/5] Verificando PostgreSQL...
sc query postgresql-x64-17 >nul 2>nul
if errorlevel 1 (
    echo    Nota: no se encontro el servicio "postgresql-x64-17".
    echo    Si el servicio tiene otro nombre o usa SQLite, puede continuar igual.
) else (
    sc query postgresql-x64-17 | find "RUNNING" >nul
    if errorlevel 1 (
        echo    ^> PostgreSQL detenido. Intentando iniciarlo...
        net start postgresql-x64-17
        if errorlevel 1 echo    ^> No se pudo iniciar el servicio. Ejecute este .bat como administrador.
        timeout /t 5 >nul
    )
    echo    ^> PostgreSQL OK
)
echo.

:: 2. Dependencias (solo la primera vez)
if not exist "server\node_modules" (
    echo [2/5] Instalando dependencias, puede tardar varios minutos...
    call corepack pnpm install
    if errorlevel 1 (
        echo ERROR: fallo la instalacion de dependencias.
        pause
        exit /b 1
    )
) else (
    echo [2/5] Dependencias OK.
)
echo.

:: 3. Build de produccion cuando falta o cuando el codigo cambio
set "NECESITA_BUILD=0"
if not exist "server\dist\public\index.html" set "NECESITA_BUILD=1"
node scripts\build-pendiente.mjs >nul 2>nul
if errorlevel 1 set "NECESITA_BUILD=1"
if "!NECESITA_BUILD!"=="1" (
    echo [3/5] Construyendo la aplicacion, espere unos minutos...
    call corepack pnpm run build
    if errorlevel 1 (
        echo ERROR: fallo el build. Revise el mensaje anterior.
        pause
        exit /b 1
    )
) else (
    echo [3/5] Aplicacion ya construida y al dia.
)
echo.

:: 4. Respaldo previo al arranque y migraciones (idea del ERP: prestart backup)
::    Solo aplica con PostgreSQL; con SQLite se usa la base local de desarrollo.
echo [4/5] Respaldos y base de datos...
findstr /r /c:"^DATABASE_URL=" .env >nul 2>nul
if errorlevel 1 (
    echo    Nota: sin DATABASE_URL en .env se usa la base local SQLite.
) else (
    echo    ^> Respaldo previo al arranque...
    call corepack pnpm --dir server run backup:pg
    if errorlevel 1 echo    ^> El respaldo previo fallo; no bloquea el arranque. Revise BACKUP_DIR.
    echo    ^> Aplicando migraciones...
    call corepack pnpm --dir server run migrate:pg
    if errorlevel 1 echo    ^> migrate:pg fallo. Revise DATABASE_URL en .env.
)
echo.

:: 5. Si ya esta corriendo, solo abrir; si se recompilo, reiniciar para aplicar la version nueva
curl -s --max-time 3 http://127.0.0.1:4000/api/health >nul 2>nul
if !errorlevel! equ 0 (
    if "!NECESITA_BUILD!"=="1" (
        echo [5/5] Reiniciando el servidor para aplicar la actualizacion...
        powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
        timeout /t 2 >nul
    ) else (
        echo [5/5] La aplicacion ya esta corriendo.
        start "" http://127.0.0.1:4000
        timeout /t 2 >nul
        exit /b 0
    )
)

echo [5/5] Iniciando servidor unico...
start "SG-SST Servidor" cmd /k "cd /d %~dp0server && node dist\index.js"

echo    Esperando al servidor...
set /a intentos=0
:esperar
curl -s --max-time 3 http://127.0.0.1:4000/api/health >nul 2>nul
if !errorlevel! equ 0 goto listo
set /a intentos+=1
if !intentos! gtr 30 (
    echo.
    echo ERROR: el servidor no respondio. Revise la ventana "SG-SST Servidor".
    pause
    exit /b 1
)
timeout /t 2 >nul
goto esperar

:listo
echo.
echo   ==========================================
echo     SG-SST corriendo en http://127.0.0.1:4000
echo   ==========================================
echo.
echo   Un solo servidor: interfaz y API en el mismo puerto.
echo   Primera vez con base nueva: registre el usuario administrador
echo   desde la pantalla de login (alta inicial).
echo   Para detener: cierre la ventana "SG-SST Servidor".
echo.
start "" http://127.0.0.1:4000
timeout /t 3 >nul
exit /b 0
