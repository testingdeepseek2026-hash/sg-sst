<# 
.SYNOPSIS
    SG-SST Backup Script para Windows PowerShell
.DESCRIPTION
    Realiza backup completo de la base de datos SQLite y archivos subidos
.USAGE
    .\scripts\backup.ps1 [-BackupDir ".\backups"]
#>

param(
    [string]$BackupDir = ".\backups"
)

$ErrorActionPreference = "Stop"

# Configuración
$DbPath = $env:DB_PATH ?? ".\data\sg-sst.db"
$UploadsDir = $env:UPLOADS_DIR ?? ".\uploads"
$Date = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupName = "sg-sst-backup-$Date"
$BackupPath = Join-Path $BackupDir $BackupName

Write-Host "=== SG-SST Backup Started ===" -ForegroundColor Green
Write-Host "Fecha: $(Get-Date)"
Write-Host "DB: $DbPath"
Write-Host "Uploads: $UploadsDir"
Write-Host "Destino: $BackupPath"

# Crear directorio de backup
New-Item -ItemType Directory -Force -Path $BackupPath | Out-Null

# 1. Backup de base de datos SQLite
Write-Host "--- Respaldando base de datos ---" -ForegroundColor Cyan
if (Test-Path $DbPath) {
    # Usar sqlite3 .backup para copia consistente
    if (Get-Command sqlite3 -ErrorAction SilentlyContinue) {
        sqlite3 $DbPath ".backup '$BackupPath\sg-sst.db'"
        Write-Host "✓ Base de datos respaldada: sg-sst.db" -ForegroundColor Green
    } else {
        # Fallback: copiar archivo directamente (requiere BD cerrada)
        Copy-Item $DbPath "$BackupPath\sg-sst.db" -Force
        Write-Host "✓ Base de datos copiada (fallback): sg-sst.db" -ForegroundColor Yellow
    }
} else {
    Write-Host "✗ Base de datos no encontrada: $DbPath" -ForegroundColor Red
    exit 1
}

# 2. Backup de archivos subidos
if (Test-Path $UploadsDir) {
    Write-Host "--- Respaldando archivos subidos ---" -ForegroundColor Cyan
    Copy-Item $UploadsDir "$BackupPath\uploads" -Recurse -Force
    Write-Host "✓ Directorio uploads respaldado" -ForegroundColor Green
} else {
    Write-Host "⚠ Directorio uploads no existe, creando vacío" -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path "$BackupPath\uploads" | Out-Null
}

# 3. Generar manifiesto
Write-Host "--- Generando manifiesto ---" -ForegroundColor Cyan
$Tables = sqlite3 $DbPath ".tables" -split ' ' | Where-Object { $_ }
$Manifest = @{
    backup_name = $BackupName
    created_at = (Get-Date).ToString("o")
    version = "1.0.0"
    database = "sg-sst.db"
    includes_uploads = $true
    tables = $Tables
}
$Manifest | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 "$BackupPath\MANIFEST.json"
Write-Host "✓ Manifiesto generado" -ForegroundColor Green

# 4. Verificar integridad
Write-Host "--- Verificando integridad ---" -ForegroundColor Cyan
$Integrity = sqlite3 "$BackupPath\sg-sst.db" "PRAGMA integrity_check;"
if ($Integrity -eq "ok") {
    Write-Host "✓ Integridad OK" -ForegroundColor Green
} else {
    Write-Host "✗ Error de integridad: $Integrity" -ForegroundColor Red
    exit 1
}

# 5. Comprimir
Write-Host "--- Comprimiendo backup ---" -ForegroundColor Cyan
Compress-Archive -Path "$BackupPath\*" -DestinationPath "$BackupDir\$BackupName.zip" -Force
Remove-Item -Recurse -Force $BackupPath
$Size = (Get-Item "$BackupDir\$BackupName.zip").Length / 1MB
Write-Host "✓ Backup comprimido: $BackupName.zip (${Size:N2} MB)" -ForegroundColor Green

Write-Host "=== Backup completado exitosamente ===" -ForegroundColor Green
Write-Host "Archivo: $BackupDir\$BackupName.zip"