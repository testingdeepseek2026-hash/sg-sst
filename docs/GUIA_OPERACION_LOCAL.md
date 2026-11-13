# Guía de operación local — SG-SST (portátil)

**Fecha:** 13 de noviembre de 2026  
**Alcance:** uso diario en el portátil, con arranque por doble clic y seguimiento del plan de trabajo anual. Instalación y configuración en [`PLAN_DESPLIEGUE_LOCAL.md`](../PLAN_DESPLIEGUE_LOCAL.md).

> Esta guía ayuda a operar la herramienta. No certifica cumplimiento normativo ni autoriza el uso de datos reales sin aprobación de la empresa y revisión de un profesional SST.

## 1. Arranque diario

1. Doble clic en `iniciar-proyecto.bat` (raíz del repositorio).
2. El script verifica PostgreSQL, hace un respaldo previo, aplica migraciones y arranca **un solo servidor** en `http://127.0.0.1:4000`; se abre el navegador automáticamente.
3. Iniciar sesión en la aplicación.
4. Para detener: cerrar la ventana "SG-SST Servidor".

Si el servidor no responde, revisar la ventana "SG-SST Servidor" y el estado de PostgreSQL.

## 2. Rutina con el plan de trabajo anual

- Revisar el módulo **Planes**: actividades del año, estado (pendiente/en ejecución/cumplida) y vencimientos.
- Al ejecutar una actividad: registrar la evidencia (archivo, foto o documento) y la fecha real.
- Cerrar el mes verificando el porcentaje de cumplimiento y las actividades rezagadas.
- Usar **Alertas → Pendientes** para los vencimientos próximos; atender y marcar como **Atendida**.

## 3. Alertas

- Generación diaria a las **07:00 (America/Bogota)** si `ALERTS_ENABLED=true`; no se envía correo.
- **Generar alertas** es útil tras registrar exámenes, certificados o EPP nuevos.

## 4. Respaldos

- Automático diario 02:00 en `BACKUP_DIR` (si `BACKUP_ENABLED=true`), con manifiesto SHA-256 y retención de 30 días.
- Manual: `corepack pnpm --dir server run backup:pg`.
- Copiar periódicamente `BACKUP_DIR` y `uploads/` a un disco externo y probar una restauración mensual (dos pasos):

```bash
# 1. Crear una base de comprobación y aplicarle el esquema (la restauración exige esquema migrado)
#    psql: CREATE DATABASE sg_sst_comprobacion;
DATABASE_URL=postgresql://postgres:<contraseña>@127.0.0.1:5432/sg_sst_comprobacion corepack pnpm --dir server run migrate:pg

# 2. Restaurar el respaldo en esa base (sin --apply es simulación)
corepack pnpm --dir server run restore:pg -- --dir <nombre-del-respaldo> --url-env DATABASE_URL --apply
```

- Tras verificar los datos, eliminar la base de comprobación (`DROP DATABASE sg_sst_comprobacion;`).

- El destino de respaldo debe tener al menos 200 MB libres; la app lo valida antes de copiar.

## 5. Actualización

1. Cerrar la ventana del servidor y hacer un respaldo manual.
2. Actualizar el código y ejecutar `corepack pnpm install --frozen-lockfile`.
3. Con PostgreSQL: `corepack pnpm --dir server run migrate:pg`.
4. Volver a ejecutar `iniciar-proyecto.bat` (reconstruye y arranca).
5. Probar inicio de sesión, una lectura, una escritura y una descarga.

## 6. Seguridad básica en el portátil

- Sesión del portátil con contraseña; cerrar sesión en la app al terminar el día.
- BitLocker activado si es posible.
- Los datos médicos son sensibles (Ley 1581 de 2012): no copiarlos a correos, chats ni equipos personales.
- No compartir `SESSION_SECRET` ni `ENCRYPTION_SECRET`.

## 7. Incidentes frecuentes

| Síntoma                     | Revisión sugerida                                            |
| --------------------------- | ------------------------------------------------------------ |
| El .bat cierra de inmediato | Node.js o pnpm no están en el PATH; leer el mensaje de error |
| No carga la página          | Ventana "SG-SST Servidor" abierta y PostgreSQL activo        |
| Error de base de datos      | Revisar `DB_BACKEND`/`DATABASE_URL` en `.env`                |
| Falla el respaldo           | `BACKUP_DIR` accesible y con espacio ≥ 200 MB                |

## 8. Límites de esta etapa

- Uso solo en el portátil; sin acceso desde otros equipos ni por Internet.
- Sin datos reales hasta aprobación de la empresa y revisión SST.
