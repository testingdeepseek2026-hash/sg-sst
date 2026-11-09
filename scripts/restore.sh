#!/bin/bash
# SG-SST Restore Script
# Uso: ./scripts/restore.sh <archivo_backup.tar.gz> [directorio_destino_db]

set -euo pipefail

# Configuración
BACKUP_FILE="${1}"
TARGET_DB="${2:-./data/sg-sst.db}"
TARGET_UPLOADS="${3:-./uploads}"
TEMP_DIR=$(mktemp -d)

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "✗ Archivo de backup no encontrado: ${BACKUP_FILE}"
    exit 1
fi

echo "=== SG-SST Restore Started ==="
echo "Fecha: $(date)"
echo "Backup: ${BACKUP_FILE}"
echo "DB destino: ${TARGET_DB}"
echo "Uploads destino: ${TARGET_UPLOADS}"

# 1. Descomprimir backup
echo "--- Descomprimiendo backup ---"
tar -xzf "${BACKUP_FILE}" -C "${TEMP_DIR}"

BACKUP_DIR=$(find "${TEMP_DIR}" -maxdepth 1 -type d -name "sg-sst-backup-*" | head -1)
if [ -z "${BACKUP_DIR}" ]; then
    echo "✗ Estructura de backup inválida"
    rm -rf "${TEMP_DIR}"
    exit 1
fi

echo "Backup encontrado: ${BACKUP_DIR}"

# 2. Verificar manifiesto
if [ -f "${BACKUP_DIR}/MANIFEST.json" ]; then
    echo "--- Verificando manifiesto ---"
    cat "${BACKUP_DIR}/MANIFEST.json" | jq .
    
    # Verificar integridad de la BD en el backup
    echo "--- Verificando integridad de BD en backup ---"
    sqlite3 "${BACKUP_DIR}/sg-sst.db" "PRAGMA integrity_check;" | grep -q "ok" && echo "✓ Integridad OK" || { echo "✗ Error de integridad en backup"; exit 1; }
else
    echo "⚠ Manifiesto no encontrado, continuando..."
fi

# 3. Backup de BD actual (por seguridad)
if [ -f "${TARGET_DB}" ]; then
    CURRENT_BACKUP="${TARGET_DB}.pre-restore-$(date +%Y%m%d_%H%M%S)"
    echo "--- Respaldando BD actual en ${CURRENT_BACKUP} ---"
    cp "${TARGET_DB}" "${CURRENT_BACKUP}"
    echo "✓ BD actual respaldada"
fi

# 4. Restaurar base de datos
echo "--- Restaurando base de datos ---"
mkdir -p "$(dirname "${TARGET_DB}")"
cp "${BACKUP_DIR}/sg-sst.db" "${TARGET_DB}"
echo "✓ Base de datos restaurada"

# 5. Verificar integridad de BD restaurada
echo "--- Verificando BD restaurada ---"
sqlite3 "${TARGET_DB}" "PRAGMA integrity_check;" | grep -q "ok" && echo "✓ Integridad OK" || { echo "✗ Error de integridad en BD restaurada"; exit 1; }

# 6. Restaurar archivos subidos
if [ -d "${BACKUP_DIR}/uploads" ]; then
    echo "--- Restaurando archivos subidos ---"
    mkdir -p "${TARGET_UPLOADS}"
    # Usar rsync si está disponible, sino cp
    if command -v rsync &> /dev/null; then
        rsync -a "${BACKUP_DIR}/uploads/" "${TARGET_UPLOADS}/"
    else
        cp -r "${BACKUP_DIR}/uploads/"* "${TARGET_UPLOADS}/" 2>/dev/null || true
    fi
    echo "✓ Archivos subidos restaurados"
else
    echo "⚠ No hay directorio uploads en backup"
fi

# 7. Limpiar temporal
rm -rf "${TEMP_DIR}"

echo "=== Restore completado exitosamente ==="
echo "Base de datos: ${TARGET_DB}"
echo "Archivos: ${TARGET_UPLOADS}"
echo ""
echo "IMPORTANTE: Reiniciar la aplicación para cargar la nueva BD"