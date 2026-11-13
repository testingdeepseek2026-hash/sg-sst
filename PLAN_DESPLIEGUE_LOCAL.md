# Plan de despliegue local — SG-SST (portátil)

**Estado:** simplificado y en vigor (13 de noviembre de 2026). Reemplaza la versión anterior de "equipo dedicado" (Caddy, NSSM, HTTPS, firewall), que se archiva como opción futura en la sección 6.

**Fecha:** 13 de noviembre de 2026.

## 1. Objetivo

Usar SG-SST en el portátil de la empresa con PostgreSQL local ya instalado, arrancando la aplicación con doble clic en [`iniciar-proyecto.bat`](./iniciar-proyecto.bat). Las alertas se consultan en el panel, sin correo.

El uso principal del repositorio en esta etapa es **dar seguimiento al plan de trabajo anual**: actividades, responsables, vencimientos, evidencias y porcentaje de cumplimiento.

## 2. Escenario confirmado

| Tema          | Decisión                             |
| ------------- | ------------------------------------ |
| Equipo        | Portátil personal de la empresa      |
| Base de datos | PostgreSQL local (ya instalado)      |
| Acceso        | Solo desde el portátil (localhost)   |
| Arranque      | Doble clic en `iniciar-proyecto.bat` |
| Alertas       | Solo panel local, sin correo ni SMTP |
| Uso principal | Plan de trabajo anual                |

## 3. Cómo arrancar

Doble clic en `iniciar-proyecto.bat`. El script hace todo:

1. Verifica el servicio `postgresql-x64-17` y lo inicia si está detenido.
2. Instala dependencias solo la primera vez y construye la aplicación solo si falta el build.
3. Con PostgreSQL configurado: **respaldo previo al arranque** y aplicación de migraciones.
4. Arranca **un solo servidor** (interfaz y API en el mismo proceso) en `http://127.0.0.1:4000` y abre el navegador.
5. Para detener: cerrar la ventana "SG-SST Servidor".

Estas mejoras se tomaron del arranque del ERP Gr Seguridad (verificación de PostgreSQL y respaldo al iniciar). El modo desarrollo de dos servidores sigue disponible para programar con `corepack pnpm run dev`, pero no se usa en la operación diaria.

## 4. Base de datos

El archivo `.env` (raíz, fuera del repositorio) decide el motor:

- **Desarrollo simple:** sin `DB_BACKEND`/`DATABASE_URL`, la app usa SQLite local (`data/`). Suficiente para pruebas y para revisar la interfaz.
- **PostgreSQL local (recomendado para el uso real):** en `.env` poner `DB_BACKEND=pg` y una cadena local:

  ```
  DB_BACKEND=pg
  DATABASE_URL=postgresql://postgres:<contraseña>@127.0.0.1:5432/sg_sst
  ```

- Aplicar el esquema una vez: `corepack pnpm --dir server run migrate:pg` (el `.bat` también lo hace en cada arranque).
- Primera vez con base nueva: crear el usuario administrador. **Nota:** la pantalla de login aún no tiene formulario de alta inicial; el primer usuario se crea por API (`POST /api/users/register`). Registrar este pendiente de UX.

**Estado validado (2026-11-13):** base local `sg_sst_test` con esquema al día (37 tablas), conexión y arranque contra PostgreSQL verificados (`/api/health` responde `db: connected, backend: postgresql`), administrador creado y login funcionando. Suite de pruebas completa: **292/292** (incluye las pruebas PostgreSQL que antes se omitían; el aislamiento quedó corregido en `server/tests/setup.ts`).

## 5. Respaldos

- Con PostgreSQL y `BACKUP_ENABLED=true`, el servidor crea un respaldo diario a las 02:00 en `BACKUP_DIR` (retención 30 días, manifiesto con SHA-256). Además, el `.bat` hace un **respaldo previo al arranque**.
- Verificación incluida: el destino debe existir o poder crearse y tener al menos 200 MB libres.
- Respaldos por comando: `corepack pnpm --dir server run backup:pg`; restauración: `restore:pg` (exige que la base destino ya tenga el esquema migrado; ver abajo).
- Recomendación mínima: copiar `BACKUP_DIR` y `uploads/` a un disco externo con periodicidad fija y probar una restauración al menos una vez al mes.
- BitLocker en el portátil y copia fuera del equipo reducen el riesgo de pérdida.

**Prueba de restauración validada (2026-11-13):** se restauró el respaldo `sg-sst-pg-backup-2026-11-13T23-37-23` (36 tablas, 3 filas) en una base de comprobación separada `sg_sst_restore_check` y el contenido coincidió (1 usuario administrador). Procedimiento, en dos pasos:

1. Crear la base de comprobación y aplicar el esquema: `CREATE DATABASE sg_sst_restore_check;` y luego `DATABASE_URL=<cadena hacia la base de comprobación> corepack pnpm --dir server run migrate:pg`.
2. Restaurar y verificar: `corepack pnpm --dir server run restore:pg -- --dir <nombre-del-respaldo> --url-env DATABASE_URL_RESTORE --apply` (sin `--apply` es simulación). Al terminar, eliminar la base de comprobación.

## 6. Opciones futuras (archivadas, no activas)

Si el escenario cambia (más usuarios, acceso desde otros equipos, requisitos de red), retomar de la versión anterior: HTTPS con Caddy, servicio automático con NSSM, firewall de Windows, copia semanal fuera de la sede y pruebas L0–L4. Ese contenido queda en el historial de git (commits `cae411e` y anteriores).

## 7. Criterios de aceptación

- [x] `iniciar-proyecto.bat` abre la aplicación con doble clic y sin pasos manuales. _(Validado el 2026-11-13: arranque completo con PostgreSQL verificado, respaldo previo, migraciones, servidor en 4000 y sesión iniciada en el navegador. Correcciones aplicadas: fines de línea CRLF garantizados vía `.gitattributes`, y paréntesis en mensajes `echo` dentro de bloques `if (...)`. )_
- [x] Los datos se guardan y persisten al cerrar y reabrir (backend elegido en `.env`). _(Validado contra PostgreSQL local: arranque, registro y login con datos persistidos.)_
- [x] El respaldo diario se crea en la carpeta definida y el manifiesto es verificable. _(Respaldo manual validado: 36 tablas, manifiesto SHA-256 y restauración de comprobación en base separada coincidente.)_
- [x] No se cargaron datos reales sin aprobación de la empresa y revisión SST. _(La base contiene solo el usuario administrador; sin datos de demostración mezclados.)_
- [ ] El flujo del plan de trabajo anual (crear actividad, ejecutarla, registrar evidencia, ver cumplimiento) se puede completar de inicio a fin. _(Pendiente: foco de la siguiente fase.)_
