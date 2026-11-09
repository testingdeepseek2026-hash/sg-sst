# Guía de Respaldo y Restauración - SG-SST

## Resumen

Este documento describe el procedimiento de respaldo automático y restauración de la aplicación SG-SST para microempresa colombiana.

**Componentes a respaldar:**

1. **Base de datos SQLite** (`data/sg-sst.db`) - Contiene toda la información operativa
2. **Archivos subidos** (`uploads/`) - Evidencias, firmas, documentos adjuntos

---

## 1. Respaldo Automático

### Scripts disponibles

| Script       | Plataforma                    | Descripción                         |
| ------------ | ----------------------------- | ----------------------------------- |
| `backup.cjs` | Node.js (Linux/macOS/Windows) | Cross-platform, usa tar/zip         |
| `backup.ps1` | PowerShell (Windows)          | Nativo Windows, usa .NET GZipStream |

### Configuración (Variables de entorno)

```bash
# Directorio de datos de la aplicación
SG_SST_DATA_DIR=/ruta/a/data

# Directorio donde guardar respaldos
BACKUP_DIR=/ruta/a/backups

# Días de retención (default: 30)
BACKUP_RETENTION_DAYS=30

# Comprimir con gzip (default: true)
BACKUP_COMPRESS=true
```

### Ejecución manual

```bash
# Node.js (recomendado)
cd server
node backup.cjs

# Con opciones
node backup.cjs --retention-days=60 --list
node backup.cjs --no-compress

# PowerShell (Windows)
cd server
.\backup.ps1
.\backup.ps1 -RetentionDays 60 -Compress $true -List
```

### Programación automática (cron / Task Scheduler)

**Linux/macOS (cron):**

```bash
# Diario a las 02:00
0 2 * * * /usr/bin/node /ruta/al/proyecto/server/backup.cjs >> /var/log/sg-sst-backup.log 2>&1

# Semanal los domingos a las 03:00 con retención 90 días
0 3 * * 0 /usr/bin/node /ruta/al/proyecto/server/backup.cjs --retention-days=90 >> /var/log/sg-sst-backup.log 2>&1
```

**Windows (Task Scheduler):**

1. Abrir "Programador de tareas"
2. Crear tarea básica → Diaria → 02:00
3. Acción: Iniciar programa
   - Programa: `powershell.exe`
   - Argumentos: `-ExecutionPolicy Bypass -File "C:\ruta\al\proyecto\server\backup.ps1"`
4. Configurar para ejecutar aunque el usuario no haya iniciado sesión

---

## 2. Restauración

### Restaurar base de datos

```bash
# Listar respaldos disponibles
node backup.cjs --list

# Restaurar desde un respaldo específico
node backup.cjs --restore=sg-sst-db-2026-11-08_02-00-00.sqlite.gz
```

**Proceso de restauración:**

1. El script descifra/descomprime el respaldo a un archivo temporal
2. Verifica integridad de la base de datos (PRAGMA integrity_check)
3. Crea una copia de seguridad de la BD actual (`sg-sst.db.pre-restore-<timestamp>`)
4. Sobrescribe la base de datos actual
5. Elimina el archivo temporal

### Restaurar archivos subidos (uploads)

```bash
# Extraer manualmente el archivo de respaldo
tar -xzf backups/sg-sst-uploads-2026-11-08_02-00-00.tar.gz -C /ruta/temporal

# Copiar contenido a uploads/
cp -r /ruta/temporal/uploads/* /ruta/proyecto/uploads/
```

---

## 3. Verificación de Respaldo

### Prueba de integridad (ejecutar mensualmente)

```bash
# 1. Crear entorno de prueba
mkdir -p /tmp/sg-sst-test
cd /tmp/sg-sst-test

# 2. Restaurar BD de prueba
node /ruta/proyecto/server/backup.cjs --restore=sg-sst-db-2026-11-08_02-00-00.sqlite.gz

# 3. Verificar integridad
sqlite3 sg-sst.db "PRAGMA integrity_check;"

# 4. Verificar conteos clave
sqlite3 sg-sst.db "SELECT 'workers', COUNT(*) FROM workers;"
sqlite3 sg-sst.db "SELECT 'incidents', COUNT(*) FROM incidents;"
sqlite3 sg-sst.db "SELECT 'audit_logs', COUNT(*) FROM audit_logs;"

# 5. Verificar archivos uploads
tar -tzf /ruta/proyecto/backups/sg-sst-uploads-2026-11-08_02-00-00.tar.gz | head -20
```

### Checklist de verificación post-restauración

- [ ] Base de datos abre sin errores
- [ ] `PRAGMA integrity_check` retorna `ok`
- [ ] Conteo de registros coincide con fecha del respaldo
- [ ] Aplicación inicia correctamente con la BD restaurada
- [ ] Login funciona
- [ ] Módulos principales cargan datos (Dashboard, Trabajadores, Incidentes)
- [ ] Archivos uploads accesibles (fotos, firmas, documentos)

---

## 4. Consideraciones de Seguridad (Ley 1581/2012)

### Datos sensibles en respaldos

Los respaldos contienen **datos personales y sensibles**:

- Datos de identificación de trabajadores (nombres, documentos, contactos)
- **Datos médicos ocupacionales** (exámenes, restricciones, diagnósticos) - CIFRADOS en BD
- Firmas digitales y evidencias fotográficas
- Bitácora de auditoría (con datos enmascarados)

### Medidas de protección

1. **Cifrado en reposo**: Los campos médicos sensibles están cifrados con AES-256-GCM en la BD (ver `server/src/lib/crypto.ts`)
2. **Acceso restringido**: Solo el rol `administrador` puede acceder a la bitácora y datos sensibles
3. **Respaldo seguro**:
   - Guardar respaldos en ubicación con acceso controlado
   - Cifrar el disco/volumen donde se almacenan los respaldos
   - Transmitir respaldos solo por canales seguros (SFTP, HTTPS)
4. **Retención**: Configurar retención según obligaciones legales:
   - Registros médicos/exposición: **20 años** (Res. 0312/2019, Art. 2.2.4.6.38)
   - Documentos SG-SST generales: **5 años** mínimo
   - Bitácora de auditoría: **5 años** mínimo

### Eliminación segura

Al eliminar respaldos antiguos (script automático o manual):

```bash
# Linux/macOS - sobrescribir antes de borrar
shred -vfz -n 3 backups/sg-sst-db-*.sqlite.gz

# Windows - cipher /w sobrescribe espacio libre
cipher /w:C:\ruta\backups
```

---

## 5. Procedimiento de Recuperación ante Desastres

### Escenario: Pérdida total del servidor

**Tiempo objetivo de recuperación (RTO):** < 4 horas  
**Punto objetivo de recuperación (RPO):** < 24 horas (respaldos diarios)

**Pasos:**

1. **Provisionar nuevo servidor** (misma o superior especificación)
2. **Instalar dependencias:**
   ```bash
   # Node.js 22+
   corepack enable
   corepack prepare pnpm@9.15.0 --activate
   pnpm install --frozen-lockfile
   ```
3. **Configurar variables de entorno:**
   - `SG_SST_DATA_DIR`, `BACKUP_DIR`
   - `ENCRYPTION_SECRET` (¡CRÍTICO! Debe ser el mismo para descifrar datos médicos)
   - `SESSION_SECRET`, `SMTP_*`, `ADMIN_EMAIL`, `APP_URL`
4. **Restaurar base de datos:**
   ```bash
   node server/backup.cjs --restore=sg-sst-db-<último>.sqlite.gz
   ```
5. **Restaurar uploads:**
   ```bash
   tar -xzf backups/sg-sst-uploads-<último>.tar.gz -C /ruta/proyecto
   ```
6. **Verificar integridad** (ver sección 3)
7. **Iniciar aplicación:**
   ```bash
   pnpm --dir server run build
   pnpm --dir web run build
   node server/dist/index.js
   ```
8. **Probar acceso y funcionalidad crítica**

### Contactos de emergencia

| Rol                | Responsable | Contacto    |
| ------------------ | ----------- | ----------- |
| Responsable SG-SST | [Nombre]    | [Tel/Email] |
| Administrador TI   | [Nombre]    | [Tel/Email] |
| Proveedor hosting  | [Empresa]   | [Soporte]   |

---

## 6. Registro de Pruebas de Restauración

| Fecha      | Tipo     | Respaldo usado                          | Resultado  | Observaciones                                    | Responsable |
| ---------- | -------- | --------------------------------------- | ---------- | ------------------------------------------------ | ----------- |
| 2026-11-08 | Completa | sg-sst-db-2026-11-08_02-00-00.sqlite.gz | ✅ Exitosa | Integridad verificada, 47 workers, 123 incidents | [Nombre]    |

---

## 7. Referencias Normativas

- **Ley 1581/2012** - Protección de datos personales (Colombia)
- **Decreto 1072/2015** - Libro 2, Parte 2, Título 4, Capítulo 6 (SG-SST)
- **Resolución 0312/2019** - Estándares Mínimos SG-SST
- **Resolución 4272/2021** - Trabajo en alturas
- **ISO 27001** - Gestión de seguridad de la información (referencia)

---

**Última actualización:** 2026-11-08  
**Versión:** 1.0  
**Responsable:** Administrador SG-SST
