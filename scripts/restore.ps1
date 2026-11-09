<# 
.SYNOPSIS
    SG-SST Restore Script para Windows PowerShell
.DESCRIPTION
    Restaura base de datos y archivos desde backup
.USAGE
    .\scripts\restore.ps1 -BackupFile ".\backups\sg-sst-backup-20260101_120000.zip" [-TargetDb ".\data\sg-sst.db"] [-TargetUploads ".\uploads"]
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    
    [string]$TargetDb = ".\data\sg-sst.db",
    [string]$TargetUploads = ".\uploads"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
    Write-Host "✗ Archivo de backup no encontrado: $BackupFile" -ForegroundColor Red
    exit 1
}

Write-Host "=== SG-SST Restore Started ===" -ForegroundColor Green
Write-Host "Fecha: $(Get-Date)"
Write-Host "Backup: $BackupFile"
Write-Host "DB destino: $TargetDb"
Write-Host "Uploads destino: $TargetUploads"

# Directorio temporal
$TempDir = [System.IO.Path]::GetTempPath() + "sg-sst-restore-" + [Guid]::NewGuid()
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

Write-Host "--- Descomprimiendo backup ---" -ForegroundColor Cyan
Expand-Archive -Path $BackupFile -DestinationPath $TempDir -Force

$BackupDir = Get-ChildItem -Path $TempDir -Directory -Filter "sg-sst-backup-*" | Select-Object -First 1
if (-not $BackupDir) {
    Write-Host "✗ Estructura de backup inválida" -ForegroundColor Red
    Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "Backup encontrado: $($BackupDir.FullName)" -ForegroundColor Cyan

# Verificar manifiesto
if (Test-Path "$($BackupDir.FullName)\MANIFEST.json") {
    Write-Host "--- Verificando manifiesto ---" -ForegroundColor Cyan
    Get-Content "$($BackupDir.FullName)\MANIFEST.json" | ConvertFrom-Json | Format-List
    
    Write-Host "--- Verificando integridad de BD en backup ---" -ForegroundColor Cyan
    $Integrity = sqlite3 "$($BackupDir.FullName)\sg-sst.db" "PRAGMA integrity_check;"
    if ($Integrity -ne "ok") {
        Write-Host "✗ Error de integridad en backup: $Integrity" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Integridad OK" -ForegroundColor Green
} else {
    Write-Host "⚠ Manifiesto no encontrado, continuando..." -ForegroundColor Yellow
}

# Backup de BD actual (por seguridad)
if (Test-Path $TargetDb) {
    $CurrentBackup = "$TargetDb.pre-restore-$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Write-Host "--- Respaldando BD actual en $CurrentBackup ---" -ForegroundColor Cyan
    Copy-Item $TargetDb $CurrentBackup -Force
    Write-Host "✓ BD actual respaldada" -ForegroundColor Green
}

# Restaurar base de datos
Write-Host "--- Restaurando base de datos ---" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path (Split-Path $TargetDb -Parent) | Out-Null
Copy-Item "$($BackupDir.FullName)\sg-sst.db" $TargetDb -Force
Write-Host "✓ Base de datos restaurada" -ForegroundColor Green

# Verificar BD restaurada
Write-Host "--- Verificando BD restaurada ---" -ForegroundColor Cyan
$Integrity = sqlite3 $TargetDb "PRAGMA integrity_check;"
if ($Integrity -ne "ok") {
    Write-Host "✗ Error de integridad en BD restaurada: $Integrity" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Integridad OK" -ForegroundColor Green

# Restaurar archivos subidos
if (Test-Path "$($BackupDir.FullName)\uploads") {
    Write-Host "--- Restaurando archivos subidos ---" -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $TargetUploads | Out-Null
    Copy-Item "$($BackupDir.FullName)\uploads\*" $TargetUploads -Recurse -Force
    Write-Host "✓ Archivos subidos restaurados" -ForegroundColor Green
} else {
    Write-Host "⚠ No hay directorio uploads en backup" -ForegroundColor Yellow
}

# Limpiar temporal
Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue

Write-Host "=== Restore completado exitosamente ===" -ForegroundColor Green
Write-Host "Base de datos: $TargetDb"
Write-Host "Archivos: $TargetUploads"
Write-Host ""
Write-Host "IMPORTANTE: Reiniciar la aplicación para cargar la nueva BD" -ForegroundColor Yellow