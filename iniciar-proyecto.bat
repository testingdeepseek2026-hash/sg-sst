@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   SG-SST - Inicializador del Proyecto
echo ========================================
echo.

echo 1. Limpiando caché de TypeScript...
if exist "dist" rmdir /s /q "dist" 2>nul
if exist "web/dist" rmdir /s /q "web/dist" 2>nul
if exist "server/dist" rmdir /s /q "server/dist" 2>nul

echo.
echo 2. Instalando dependencias (si es necesario)...
pnpm install

echo.
echo 3. Inicializando base de datos con datos semilla...
set SEED=true
pnpm run dev &

timeout /t 10 /nobreak >nul

echo.
echo ========================================
echo   Servidor iniciado en:
echo   - Backend:  http://localhost:4000
echo   - Frontend: http://localhost:5173
echo   - Health:   http://localhost:4000/api/health
echo.
echo   Credenciales de prueba:
echo   - admin@sg-sst.local / Admin1234!
echo ========================================
echo.
pause