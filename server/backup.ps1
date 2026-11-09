<#
.SYNOPSIS
    Script de respaldo automático SG-SST para Windows (PowerShell)
.DESCRIPTION
    Respalda la base de datos SQLite y la carpeta uploads con retención configurable.
.PARAMETER RetentionDays
    Días a retener los respaldos (default: 30)
.PARAMETER Compress
    Comprimir con gzip (default: $true)
.PARAMETER List
    Solo listar respaldos existentes
.EXAMPLE
    .\backup.ps1
    .\backup.ps1 -RetentionDays 60 -Compress $true
    .\backup.ps1 -List
#>

param(
    [int]$RetentionDays = 30,
    [bool]$Compress = $true,
    [switch]$List
)

$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $prefix = switch ($Level) {
        "ERROR" { "[ERROR] " }
        "WARN"  { "[WARN]  " }
        default { "[INFO]  " }
    }
    Write-Host "[$timestamp] $prefix$Message"
}

function Format-Bytes {
    param([long]$Bytes)
    if ($Bytes -lt 1KB) { return "$Bytes B" }
    if ($Bytes -lt 1MB) { return "{0:N1} KB" -f ($Bytes / 1KB) }
    if ($Bytes -lt 1GB) { return "{0:N1} MB" -f ($Bytes / 1MB) }
    return "{0:N1} GB" -f ($Bytes / 1GB)
}

# Configuración
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$dataDir = $env:SG_SST_DATA_DIR ?? (Join-Path $scriptDir ".." "data")
$backupDir = $env:BACKUP_DIR ?? (Join-Path $scriptDir ".." "backups")
$dbFile = "sg-sst.db"
$uploadsDir = Join-Path (Get-Location) "uploads"

Write-Log "🚀 Iniciando respaldo SG-SST"
Write-Log "📂 Directorio datos: $dataDir"
Write-Log "📦 Directorio respaldos: $backupDir"
Write-Log "🗓️ Retención: $RetentionDays días"
Write-Log "🗜️ Compresión: $(if ($Compress) { 'sí (gzip)' } else { 'no' })"

# Crear directorio de respaldos
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    Write-Log "📁 Directorio de respaldos creado: $backupDir"
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$startTime = Get-Date

# Función para respaldar base de datos
function Backup-Database {
    $dbPath = Join-Path $dataDir $dbFile
    if (-not (Test-Path $dbPath)) {
        Write-Log "⚠️ Base de datos no encontrada en $dbPath" "WARN"
        return $null
    }

    $backupName = "sg-sst-db-$timestamp.sqlite$(if ($Compress) { '.gz' } else { '' })"
    $backupPath = Join-Path $backupDir $backupName

    if ($Compress) {
        # Usar .NET GZipStream
        $sourceStream = [System.IO.File]::OpenRead($dbPath)
        $destStream = [System.IO.File]::Create($backupPath)
        $gzipStream = New-Object System.IO.Compression.GZipStream($destStream, [System.IO.Compression.CompressionMode]::Compress)
        $sourceStream.CopyTo($gzipStream)
        $gzipStream.Close()
        $destStream.Close()
        $sourceStream.Close()
    } else {
        Copy-Item -Path $dbPath -Destination $backupPath -Force
    }

    $size = (Get-Item $backupPath).Length
    Write-Log "✅ Base de datos respaldada: $backupName ($(Format-Bytes $size))"
    return $backupPath
}

# Función para respaldar uploads
function Backup-Uploads {
    if (-not (Test-Path $uploadsDir)) {
        Write-Log "⚠️ Carpeta uploads no existe en $uploadsDir, omitiendo..." "WARN"
        return $null
    }

    $files = Get-ChildItem -Path $uploadsDir -File
    if ($files.Count -eq 0) {
        Write-Log "ℹ️ Carpeta uploads vacía, omitiendo..."
        return $null
    }

    $backupName = "sg-sst-uploads-$timestamp.tar$(if ($Compress) { '.gz' } else { '' })"
    $backupPath = Join-Path $backupDir $backupName

    # Usar tar si está disponible (Git Bash, WSL), sino .NET
    $tarCmd = "tar"
    if ($Compress) { $tarCmd += " -czf" } else { $tarCmd += " -cf" }
    $tarCmd += " `"$backupPath`" -C `"$uploadsDir`" ."

    try {
        # Intentar con tar primero
        $result = & $tarCmd 2>$null
        if ($LASTEXITCODE -ne 0) {
            throw "tar falló"
        }
    } catch {
        # Fallback: usar .NET System.IO.Compression.ZipFile
        Write-Log "⚠️ tar no disponible, usando ZIP..." "WARN"
        $zipPath = $backupPath -replace '\.tar\.gz$', '.zip' -replace '\.tar$', '.zip'
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::CreateFromDirectory($uploadsDir, $zipPath)
        $backupPath = $zipPath
    }

    $size = (Get-Item $backupPath).Length
    Write-Log "✅ Uploads respaldados: $(Split-Path $backupPath -Leaf) ($(Format-Bytes $size))"
    return $backupPath
}

# Función para limpiar respaldos antiguos
function Cleanup-OldBackups {
    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    $files = Get-ChildItem -Path $backupDir -File
    $deleted = 0
    $freed = 0L

    foreach ($file in $files) {
        if ($file.LastWriteTime -lt $cutoff) {
            $freed += $file.Length
            Remove-Item -Path $file.FullName -Force
            $deleted++
        }
    }

    if ($deleted -gt 0) {
        Write-Log "🗑️ Limpieza: $deleted respaldos antiguos eliminados ($(Format-Bytes $freed) liberados)"
    } else {
        Write-Log "ℹ️ No hay respaldos antiguos para limpiar"
    }
}

# Función para listar respaldos
function List-Backups {
    if (-not (Test-Path $backupDir)) {
        Write-Log "No hay directorio de respaldos"
        return
    }

    $files = Get-ChildItem -Path $backupDir -File | Sort-Object LastWriteTime -Descending
    Write-Log "`n📦 Respaldos existentes:"
    foreach ($f in $files) {
        Write-Log "  $($f.Name)  $(Format-Bytes $f.Length)  $($f.LastWriteTime.ToString('dd/MM/yyyy HH:mm:ss'))"
    }
}

# Ejecutar
$dbBackup = Backup-Database
$uploadsBackup = Backup-Uploads
Cleanup-OldBackups

if ($List) {
    List-Backups
}

$elapsed = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
Write-Log "✅ Respaldo completado en $elapsed s"

if (-not $dbBackup -and -not $uploadsBackup) {
    Write-Log "⚠️ No se generaron respaldos (verificar rutas)" "WARN"
    exit 1
}