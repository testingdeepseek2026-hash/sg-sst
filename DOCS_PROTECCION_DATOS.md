# Guía de Protección de Datos y Procedimientos de Backup/Restore

## SG-SST - Microempresa Colombia

---

## 1. Marco Normativo

- **Ley 1581 de 2012** (Ley de Protección de Datos Personales)
- **Decreto 1377 de 2013** (Reglamento Ley 1581)
- **Resolución 0312 de 2019** (Estándares Mínimos SG-SST)
- **Decreto 1072 de 2015** (Libro 2, Parte 2, Título 4, Capítulo 6)

---

## 2. Clasificación de Datos

| Categoría                     | Ejemplos                                                              | Tratamiento                                       |
| ----------------------------- | --------------------------------------------------------------------- | ------------------------------------------------- |
| **Datos Sensibles (Médicos)** | Exámenes ocupacionales, restricciones, diagnósticos, historia clínica | Cifrado AES-256-GCM en reposo + Acceso solo admin |
| **Datos Personales**          | Nombres, documento, cargo, EPS, ARL                                   | Acceso por rol (admin/trabajador)                 |
| **Datos de Seguridad**        | Contraseñas (hash), tokens, claves API                                | Hash bcrypt + Variables de entorno                |
| **Evidencias**                | Firmas digitales, fotos, PDFs                                         | Cifrado en reposo + URLs firmadas                 |

---

## 3. Controles Implementados

### 3.1 Cifrado en Reposo (AES-256-GCM)

- **Archivo**: `server/src/lib/crypto.ts`
- **Algoritmo**: AES-256-GCM (authenticated encryption)
- **Clave**: Derivada de `ENCRYPTION_SECRET` (scrypt + salt)
- **Campos cifrados**: `restricciones`, `medico`, `entidad`, `archivo_url`, `notas` (exámenes médicos)

```typescript
// Uso automático en workers_exams.ts
createExam(): cifra campos SENSITIVE_FIELDS antes de INSERT
updateExam(): cifra campos SENSITIVE_FIELDS antes de UPDATE
getExamById(includeSensitive=true): descifra para admin
getExamsByWorker(includeSensitive=false): devuelve null en campos sensibles
```

### 3.2 Control de Acceso por Rol

| Endpoint                    | Admin             | Trabajador                |
| --------------------------- | ----------------- | ------------------------- |
| `/workers/:wid/exams`       | ✓ Datos completos | ✓ Solo datos no sensibles |
| `/workers/exams/detail/:id` | ✓ Datos sensibles | ✗ 403 Forbidden           |
| `/workers/:wid/certs`       | ✓                 | ✓                         |
| `/workers/:wid/epp`         | ✓                 | ✓ (solo lectura)          |
| `/workers/epp/:id/firmar`   | ✓                 | ✓ (solo propio)           |

### 3.3 Consentimiento (Ley 1581/2012)

- Tabla `consents` registra autorización por trabajador
- `createExam()` valida consentimiento `tipo='medico'` y `autorizado=1`
- Sin consentimiento → Error 400: "El trabajador no ha autorizado el tratamiento de datos médicos"

### 3.4 Bitácora Sanitizada (Audit Logs)

- **Archivo**: `server/src/services/users.ts` → `sanitizeForAudit()`
- Campos sensibles enmascarados: `[DATO SENSIBLE - PROTEGIDO LEY 1581/2012]`
- No se filtran restricciones, diagnósticos, firmas, archivos médicos en logs

---

## 4. Secretos y Configuración

### Variables de Entorno Requeridas (`.env`)

```bash
# Base de datos
DB_PATH=./data/sg-sst.db

# Autenticación
SESSION_SECRET=clave-segura-32-caracteres-minimo

# Cifrado datos sensibles (¡CAMBIAR EN PRODUCCIÓN!)
ENCRYPTION_SECRET=clave-maestra-32-caracteres-minimo-para-aes-256

# Alertas locales (panel web; sin SMTP ni correo saliente)
ALERTS_ENABLED=false

# PWA
VITE_APP_NAME=SG-SST
```

> **⚠️ IMPORTANTE**: Nunca commitear `.env` al repositorio. Usar `.env.example` como plantilla.

---

## 5. Procedimiento de Backup

### 5.1 Backup Manual (PowerShell)

```powershell
# Backup completo
.\scripts\backup.ps1 -BackupDir ".\backups"

# Resultado: .\backups\sg-sst-backup-YYYYMMDD_HHMMSS.zip
```

### 5.2 Backup Automatizado (Windows Task Scheduler)

```powershell
# Crear tarea programada diaria 02:00 AM
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-File C:\sg-sst\scripts\backup.ps1"
$Trigger = New-ScheduledTaskTrigger -Daily -At 02:00
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd
Register-ScheduledTask -TaskName "SG-SST-Backup" -Action $Action -Trigger $Trigger -Settings $Settings -RunLevel Highest -Force
```

### 5.3 Qué incluye el Backup

- Base de datos SQLite (copia consistente via `.backup`)
- Directorio `uploads/` (firmas, fotos, evidencias)
- Manifiesto JSON con metadatos y lista de tablas
- Verificación de integridad (PRAGMA integrity_check)

### 5.4 Retención y conservación legal

| Tipo        | Frecuencia        | Retención legal | Propósito                               |
| ----------- | ----------------- | --------------- | --------------------------------------- |
| Diario      | 02:00 AM          | 30 días         | Rotación de backups recientes           |
| Semanal     | Domingo 03:00 AM  | 12 semanas      | Historial corto plazo                   |
| Mensual     | Día 1 04:00 AM    | 24 meses        | seguimiento operativo                   |
| Anual       | Enero 1 05:00 AM  | 10 años         | Datos generales de la empresa           |
| **Médicos** | **Anual / Según** | **20 años**     | **Cumplimiento Ley 1581/2012, Art. 17** |

---

**Política de conservación 20 años (exámenes médicos):**

De conformidad con la **Ley 1581 de 2012** y el **Decreto 1377 de 2013**, los exámenes médicos ocupacionales, certificados de salud ocupacional y restricciones médicas deben conservarse por un período mínimo de **20 años** desde la fecha del examen o última actualización.

**Base legal:**

- **Art. 17 Ley 1581/2012**: Los titulares tienen derecho a conocer, actualizar y solicitar la supresión de sus datos, salvo en los casos en que la ley determine su conservación.
- **Res. 0312/2019**: Los exámenes médicos hacen parte del SG-SST y hacen parte del histórico de seguridad y salud en el trabajo.
- **Decreto 1072/2015**: Cap. 6, Libro 2, Tit. 4 - Establece los plazos de conservación de los registros del SG-SST.

**Implementación en la aplicación:**

- Los exámenes médicos se cifran con AES-256-GCM (`lib/crypto.ts`)
- Los registros no se eliminan físicamente antes del plazo de 20 años
- El scheduler de backups conserva los backups por el período correspondiente
- Se documenta en `audit_logs` la fecha de creación y fecha de elegibilidad para supresión

**Procedimiento de supresión segura:**

1. Verificar que han transcurrido mínimo 20 años desde la fecha del examen
2. Cifrar y mover a almacenamiento de respaldo a largo plazo
3. Registrar en `audit_logs` la supresión con motivo de cumplimiento de plazo legal
4. Notificar al Responsable SG-SST antes de la supresión definitiva

---

## 5.5 Política de retention 20 años - Detalle por tipo de documento

| Documento                      | Plazo legal | Calculación a partir de | Observaciones                        |
| ------------------------------ | ----------- | ----------------------- | ------------------------------------ |
| Exámenes médicos ocupacionales | 20 años     | Fecha del examen        | Incluye restricciones y diagnósticos |
| Certificados de ARL            | 10 años     | Fecha expedición        | Según Res. 0312/2019                 |
| Informes de inspecciones       | 5 años      | Fecha inspección        | Solo copia simple                    |
| Registros de capacitación      | 5 años      | Última capacitación     | Evidencias y asistencias             |
| Políticas y objetivos SST      | 10 años     | Última versión versión  | Versionado en audit_logs             |
| Formularios de consentimiento  | 10 años     | Fecha firma             | Tabla `consents`                     |

---

## 6. Procedimiento de Restore

### 6.1 Restore Manual (PowerShell)

```powershell
# Restaurar desde backup específico
.\scripts\restore.ps1 -BackupFile ".\backups\sg-sst-backup-20260115_020000.zip"

# Restaurar en ubicación alternativa
.\scripts\restore.ps1 -BackupFile ".\backups\sg-sst-backup-20260115_020000.zip" -TargetDb ".\data\sg-sst-restore.db" -TargetUploads ".\uploads-restore"
```

### 6.2 Pasos del Restore

1. **Descomprime** backup en directorio temporal
2. **Verifica** manifiesto e integridad del backup
3. **Respalda** BD actual (pre-restore-YYYYMMDD_HHMMSS)
4. **Restaura** base de datos SQLite
5. **Verifica** integridad de BD restaurada
6. **Restaura** archivos subidos (`uploads/`)
7. **Limpia** archivos temporales
8. **Reinicia** aplicación

### 6.3 Prueba de Restore (Mensual Obligatoria)

```powershell
# 1. Crear entorno de prueba
.\scripts\restore.ps1 -BackupFile ".\backups\sg-sst-backup-LATEST.zip" -TargetDb ".\data\sg-sst-test.db" -TargetUploads ".\uploads-test"

# 2. Verificar integridad
sqlite3 .\data\sg-sst-test.db "PRAGMA integrity_check;"

# 3. Validar datos críticos
sqlite3 .\data\sg-sst-test.db "SELECT COUNT(*) FROM workers;"
sqlite3 .\data\sg-sst-test.db "SELECT COUNT(*) FROM worker_exams;"
sqlite3 .\data\sg-sst-test.db "SELECT COUNT(*) FROM audit_logs;"

# 4. Probar cifrado/descifrado
# (ejecutar test de workers_exams)

# 5. Limpiar entorno de prueba
Remove-Item .\data\sg-sst-test.db, .\uploads-test -Recurse -Force
```

---

## 7. Verificaciones de Seguridad

### Checklist Mensual

- [ ] Backup diario ejecutado y verificado (últimos 30 días)
- [ ] Prueba de restore exitosa (entorno aislado)
- [ ] Integridad BD verificada (PRAGMA integrity_check)
- [ ] Logs de auditoría revisados (sin datos sensibles expuestos)
- [ ] Certificados SSL vigentes (si HTTPS)
- [ ] Variables de entorno seguras (sin secretos en código)

### Checklist Trimestral

- [ ] Rotación de `ENCRYPTION_SECRET` (re-cifrar datos)
- [ ] Revisión de accesos y roles (principio menor privilegio)
- [ ] Prueba de restore completa documentada
- [ ] Actualización de dependencias (npm audit)
- [ ] Revisión de consentimientos vigentes (tabla `consents`)

---

## 8. Contactos y Responsables

| Rol                    | Responsable | Contacto         |
| ---------------------- | ----------- | ---------------- |
| Responsable SG-SST     | [Nombre]    | [Email/Telefono] |
| Admin Sistema          | [Nombre]    | [Email/Telefono] |
| DPO (Datos Personales) | [Nombre]    | [Email/Telefono] |

---

## 9. Referencias

- [Ley 1581/2012](https://www.funcionpublica.gov.co/eva/gestornormativo/norma_pdf.php?i=36327)
- [Decreto 1377/2013](https://www.funcionpublica.gov.co/eva/gestornormativo/norma_pdf.php?i=38729)
- [Resolución 0312/2019](https://www.mintrabajo.gov.co/portal/page/portal/MinTrabajo/Publicaciones/Resoluciones/2019/Resolucion_0312_2019.pdf)
- [Guía AEPD - Cifrado](https://www.aepd.es/sites/default/files/2019-12/guia-cifrado.pdf)

---

_Documento versión 1.0 - Actualizar tras cada cambio en arquitectura de datos_
