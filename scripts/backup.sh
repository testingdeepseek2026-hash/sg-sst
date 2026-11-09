#!/bin/bash
# SG-SST Backup Script
# Uso: ./scripts/backup.sh [directorio_destino]

set -euo pipefail

# Configuración
DB_PATH="${DB_PATH:-./data/sg-sst.db}"
UPLOADS_DIR="${UPLOADS_DIR:-./uploads}"
BACKUP_DIR="${1:-./backups}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="sg-sst-backup-${DATE}"

# Crear directorio de backup si no existe
mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}"

echo "=== SG-SST Backup Started ==="
echo "Fecha: $(date)"
echo "DB: ${DB_PATH}"
echo "Uploads: ${UPLOADS_DIR}"
echo "Destino: ${BACKUP_DIR}/${BACKUP_NAME}"

# 1. Backup de base de datos SQLite (usando .backup para consistencia)
echo "--- Respaldando base de datos ---"
sqlite3 "${DB_PATH}" ".backup '${BACKUP_DIR}/${BACKUP_NAME}/sg-sst.db'"

if [ $? -eq 0 ]; then
    echo "✓ Base de datos respaldada: sg-sst.db"
else
    echo "✗ Error respaldando base de datos"
    exit 1
fi

# 2. Backup de archivos subidos (evidencias, firmas, fotos)
if [ -d "${UPLOADS_DIR}" ]; then
    echo "--- Respaldando archivos subidos ---"
    cp -r "${UPLOADS_DIR}" "${BACKUP_DIR}/${BACKUP_NAME}/uploads"
    echo "✓ Directorio uploads respaldado"
else
    echo "⚠ Directorio uploads no existe, creando vacío"
    mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}/uploads"
fi

# 3. Crear manifiesto del backup
echo "--- Generando manifiesto ---"
cat > "${BACKUP_DIR}/${BACKUP_NAME}/MANIFEST.json" <<EOF
{
  "backup_name": "${BACKUP_NAME}",
  "created_at": "$(date -Iseconds)",
  "version": "1.0.0",
  "database": "sg-sst.db",
  "includes_uploads": true,
  "schema_version": "$(sqlite3 "${DB_PATH}" "PRAGMA user_version;")",
  "tables": $(sqlite3 "${DB_PATH}" ".tables" | tr ' ' '\n' | jq -R . | jq -s .)
}
EOF

# 4. Verificar integridad
echo "--- Verificando integridad ---"
sqlite3 "${BACKUP_DIR}/${BACKUP_NAME}/sg-sst.db" "PRAGMA integrity_check;" | grep -q "ok" && echo "✓ Integridad OK" || echo "✗ Error de integridad"

# 5. Comprimir (opcional)
if command -v tar &> /dev/null; then
    echo "--- Comprimiendo backup ---"
    cd "${BACKUP_DIR}"
    tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"
    rm -rf "${BACKUP_NAME}"
    echo "✓ Backup comprimido: ${BACKUP_NAME}.tar.gz"
    BACKUP_SIZE=$(du -h "${BACKUP_NAME}.tar.gz" | cut -f1)
    echo "Tamaño: ${BACKUP_SIZE}"
fi

echo "=== Backup completado exitosamente ==="
echo "Archivo: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"