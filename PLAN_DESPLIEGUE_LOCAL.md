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

- Aplicar el esquema una vez: `corepack pnpm --dir server run migrate:pg`.
- Primera vez con base nueva: registrar el usuario administrador desde la pantalla de login (alta inicial cuando no existe ningún usuario).

## 5. Respaldos

- Con PostgreSQL y `BACKUP_ENABLED=true`, el servidor crea un respaldo diario a las 02:00 en `BACKUP_DIR` (retención 30 días, manifiesto con SHA-256).
- Verificación incluida: el destino debe existir o poder crearse y tener al menos 200 MB libres.
- Respaldos por comando: `corepack pnpm --dir server run backup:pg`; restauración: `restore:pg`.
- Recomendación mínima: copiar `BACKUP_DIR` y `uploads/` a un disco externo con periodicidad fija y probar una restauración al menos una vez al mes.
- BitLocker en el portátil y copia fuera del equipo reducen el riesgo de pérdida.

## 6. Opciones futuras (archivadas, no activas)

Si el escenario cambia (más usuarios, acceso desde otros equipos, requisitos de red), retomar de la versión anterior: HTTPS con Caddy, servicio automático con NSSM, firewall de Windows, copia semanal fuera de la sede y pruebas L0–L4. Ese contenido queda en el historial de git (commits `cae411e` y anteriores).

## 7. Criterios de aceptación

- [ ] `iniciar-proyecto.bat` abre la aplicación con doble clic y sin pasos manuales.
- [ ] Los datos se guardan y persisten al cerrar y reabrir (backend elegido en `.env`).
- [ ] El respaldo diario se crea en la carpeta definida y el manifiesto es verificable.
- [ ] No se cargaron datos reales sin aprobación de la empresa y revisión SST.
- [ ] El flujo del plan de trabajo anual (crear actividad, ejecutarla, registrar evidencia, ver cumplimiento) se puede completar de inicio a fin.
