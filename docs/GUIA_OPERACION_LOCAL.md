# Guía de operación local — SG-SST

**Fecha:** 13 de noviembre de 2026  
**Alcance:** operación diaria en el equipo dedicado de la empresa, con PostgreSQL local, HTTPS interno (Caddy) y alertas solo en el panel. No cubre instalación inicial (ver [`PLAN_DESPLIEGUE_LOCAL.md`](../PLAN_DESPLIEGUE_LOCAL.md), fases L0–L4).

> Esta guía ayuda a operar la herramienta. No certifica cumplimiento normativo ni autoriza el uso de datos reales sin aprobación de la empresa y revisión de un profesional SST.

## 1. Servicios y arranque

En el equipo dedicado deben quedar como servicio de Windows, con inicio automático:

| Servicio      | Función                            | Verificación                              |
| ------------- | ---------------------------------- | ----------------------------------------- |
| PostgreSQL 17 | Base de datos `sg_sst`             | Servicio activo en `services.msc`         |
| `SG-SST`      | API y frontend (Node.js, NSSM)     | `https://sg-sst.local/api/health`         |
| Caddy         | HTTPS y proxy hacia el puerto 4000 | Certificado local vigente en los clientes |

El equipo no expone puertos a Internet. La aplicación y PostgreSQL solo escuchan en `127.0.0.1`; Caddy es el único punto de entrada de la red interna.

## 2. Verificación diaria (2 minutos)

1. Abrir `https://sg-sst.local` y confirmar que carga el tablero.
2. Revisar **Alertas → Pendientes** y atender los vencimientos críticos.
3. Confirmar en el tablero que no hay acciones vencidas sin responsable.

El endpoint `/api/health` responde con `status: ok`, `db: connected` y `backend: postgresql` cuando todo está normal.

## 3. Alertas locales

- El scheduler genera alertas todos los días a las **07:00 (America/Bogota)** si `ALERTS_ENABLED=true`.
- No se envía correo ni existe configuración SMTP.
- Las alertas se consultan en **Pendientes**, se atienden en la operación real y se marcan con **Marcar como atendida** (o **Marcar todas como atendidas**).
- La pestaña **Atendidas** conserva el historial con la fecha de atención.
- La generación manual con **Generar alertas** es útil después de actualizar exámenes, certificados o EPP.

## 4. Respaldos

- Se ejecutan a diario a las **02:00 (America/Bogota)** si `BACKUP_ENABLED=true`.
- Destino: `BACKUP_DIR` (disco externo o NAS), nunca el SSD del sistema.
- Antes de cada copia se verifica que el destino exista o pueda crearse y que tenga al menos **200 MB libres**.
- Cada respaldo incluye base de datos, adjuntos y un manifiesto con conteos y SHA-256.
- Retención inicial: 30 días (`BACKUP_RETENTION_DAYS`).
- Mantener una copia semanal rotada **fuera de la sede**.

Respaldos manuales:

```bash
corepack pnpm --dir server run backup:pg
```

Verificar que se creó la carpeta `sg-sst-pg-backup-*` en `BACKUP_DIR` y que el `MANIFEST.json` abre correctamente.

## 5. Restauración

1. Detener el servicio `SG-SST`.
2. Crear un respaldo manual previo.
3. Restaurar en una base separada para verificar:

```bash
# Ejemplo: restaurar el respaldo más reciente en una base de comprobación
corepack pnpm --dir server run restore:pg -- --dir sg-sst-pg-backup-AAAA-MM-DDTHH-MM-SS --url-env DATABASE_URL
```

4. Comparar conteos y muestras contra el manifiesto.
5. Solo si la verificación es correcta, restaurar sobre la base productiva siguiendo el procedimiento documentado y con el servicio detenido.

Probar una restauración al menos **una vez al mes** y registrar la fecha en el control de respaldos.

## 6. Actualización

1. Avisar a los usuarios y elegir la ventana de actualización.
2. Detener el servicio `SG-SST`.
3. Crear un respaldo manual y verificar el manifiesto.
4. Actualizar el código desde la versión aprobada.
5. Instalar dependencias: `corepack pnpm install --frozen-lockfile`.
6. Aplicar migraciones: `corepack pnpm --dir server run migrate:pg`.
7. Ejecutar `typecheck`, pruebas y build.
8. Iniciar el servicio y verificar `/api/health`.
9. Probar inicio de sesión, una lectura, una escritura y una descarga.
10. Si algo falla, restaurar la versión anterior y el respaldo correspondiente.

## 7. Seguridad operativa

- La cuenta diaria no debe ser administradora del equipo.
- BitLocker activo en el disco del sistema y, si es posible, en el disco de respaldos.
- Archivo de entorno y carpeta de respaldos accesibles solo por el servicio y el administrador.
- No compartir `ENCRYPTION_SECRET` ni `SESSION_SECRET`; conservar una copia segura fuera del equipo.
- Los datos médicos son sensibles (Ley 1581 de 2012): no copiarlos a correos, chats ni equipos personales.
- Revisar que los logs no contengan datos médicos, firmas ni secretos.

## 8. Incidentes frecuentes

| Síntoma                          | Revisión sugerida                                                      |
| -------------------------------- | ---------------------------------------------------------------------- |
| La aplicación no abre            | Servicio `SG-SST`, Caddy y PostgreSQL activos; revisar `/api/health`   |
| Error 502 o certificado inválido | Certificado local de Caddy y CA instalada en el equipo cliente         |
| No se generan alertas            | `ALERTS_ENABLED=true`, hora del equipo y logs del scheduler            |
| Falla el respaldo                | `BACKUP_DIR` accesible, espacio libre ≥ 200 MB y permisos del servicio |
| No hay espacio en disco          | Revisar retención, tamaño de `uploads/` y capacidad del disco          |

Ante una falla que no se resuelva en la guía, detener el servicio, conservar los logs y los respaldos, y contactar al responsable técnico. No borrar carpetas de datos ni de respaldos para intentar "reiniciar" la aplicación.

## 9. Estado y límites

- Cambios de código del despliegue local aplicados; falta la instalación física (L0–L4) y las confirmaciones de la sección 12 del plan.
- Sin datos reales hasta aprobación de la empresa y revisión SST.
- Sin envío de correo, acceso remoto por Internet ni alta disponibilidad en esta etapa.
