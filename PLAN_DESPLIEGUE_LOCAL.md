# Plan de despliegue local — SG-SST

**Estado:** propuesta para revisión. No implica cambios de código ni carga de datos reales.

**Fecha:** 13 de noviembre de 2026.

## 1. Objetivo

Ejecutar SG-SST en un computador dedicado dentro de la empresa, sin dependencia de alojamiento en la nube, con PostgreSQL local, archivos y respaldos en disco, acceso desde la red interna y arranque automático. Las alertas serán locales, visibles en el panel de la aplicación, sin envío de correo.

La aplicación conserva su arquitectura actual: frontend compilado servido por Fastify, backend Node.js, PostgreSQL y carpeta local de adjuntos. No se migra a Vercel ni se reescribe el frontend.

## 2. Alcance

Incluye:

- Preparación del equipo y del sistema operativo.
- Instalación y configuración de PostgreSQL local.
- Migraciones y configuración de la aplicación contra PostgreSQL.
- Publicación del frontend compilado.
- HTTPS dentro de la red local.
- Servicio automático con reinicio ante fallos.
- Alertas locales dentro del panel, sin correo saliente ni servidor SMTP.
- Respaldo diario de base de datos y adjuntos, retención y prueba de restauración.
- Endurecimiento básico, monitoreo y documentación de operación.
- Pruebas funcionales y de aceptación con información de prueba.

No incluye:

- Adaptación a Vercel, Cloudflare R2 u otro servicio en la nube.
- Alta disponibilidad, clúster o réplica entre sedes.
- Acceso remoto por Internet.
- Envío de alertas por correo, resumen semanal por email o configuración SMTP.
- Carga de datos reales sin aprobación de la empresa y revisión SST.
- Nuevas funcionalidades del MVP.
- Compra, instalación física o cableado del equipo.

## 3. Supuestos y decisiones pendientes

| Tema              | Supuesto inicial                                      | Estado                            |
| ----------------- | ----------------------------------------------------- | --------------------------------- |
| Sistema operativo | Windows 11 Pro de 64 bits                             | Por confirmar                     |
| Alternativa       | Ubuntu Server 24.04 LTS                               | Solo si la empresa prefiere Linux |
| Equipo            | 4 núcleos, 8 GB de RAM, SSD de 256 GB o superior      | Por confirmar                     |
| Usuarios          | 3 trabajadores en una sola sede                       | Confirmado por la empresa         |
| Red               | LAN cableada; sin exposición a Internet               | Por confirmar                     |
| Nombre interno    | `sg-sst.local`                                        | Por confirmar                     |
| Alertas           | Solo panel local; sin correo, SMTP ni resumen semanal | Confirmado por la empresa         |
| Respaldo          | Disco externo o NAS; copia adicional fuera de la sede | Por definir                       |
| Energía           | UPS para equipo, monitor y switch                     | Por confirmar                     |
| Datos reales      | No se cargan hasta aprobación y revisión SST          | Restricción vigente               |

## 4. Arquitectura objetivo

```text
Equipo dedicado en la red interna
┌──────────────────────────────────────────────────────────────┐
│ Caddy :443  (HTTPS local)                                    │
│      │                                                       │
│      ▼                                                       │
│ Fastify :4000  (solo 127.0.0.1)                              │
│      ├── Alertas locales (panel web, sin correo)             │
│      ├── PostgreSQL 17 :5432 (solo 127.0.0.1)                │
│      ├── uploads/  (adjuntos y firmas)                       │
│      └── backups/  (disco externo o NAS)                     │
└──────────────────────────────────────────────────────────────┘
```

El equipo no abre puertos hacia Internet. PostgreSQL y Fastify no se exponen directamente a la LAN: Caddy es el único punto de entrada y solo acepta conexiones desde la subred autorizada. La generación diaria de alertas sigue siendo interna y su único destino es el panel de la aplicación.

## 5. Fases de trabajo

### Fase L0 — Aprobación y preparación (0,5 día)

Tareas:

- Confirmar sistema operativo, equipo, nombre interno, responsable operativo y destino de respaldos.
- Definir la ventana de actualización y el procedimiento para reinicios de Windows.
- Confirmar que no habrá acceso remoto por Internet en esta etapa.
- Preparar medios de instalación de Node.js 22 LTS, pnpm, PostgreSQL 17, Caddy y NSSM si el equipo no tendrá Internet durante la instalación.
- Verificar que el equipo tenga UPS y conexión de red cableada.

Entregables:

- Ficha del equipo con nombre, ubicación, responsable y datos de red.
- Lista de software y versiones aprobadas.
- Destino de respaldo aprobado.

Aceptación:

- Decisiones anteriores registradas y responsable operativo designado.

### Fase L1 — Sistema operativo y PostgreSQL (0,5–1 día)

Tareas:

- Instalar actualizaciones y crear una cuenta administrativa separada de la cuenta diaria.
- Activar BitLocker y desactivar suspensión e hibernación.
- Reservar una dirección IP fija o una asignación DHCP estable.
- Instalar PostgreSQL 17 y configurarlo para escuchar solo en `127.0.0.1`.
- Crear la base `sg_sst`, el rol de aplicación y una contraseña fuerte; no usar el superusuario para la aplicación.
- Configurar `pg_hba.conf` con autenticación `scram-sha-256` y acceso solo local.
- Aplicar las migraciones PostgreSQL con `pnpm --dir server run migrate:pg`.
- Verificar que el esquema tenga las tablas y migraciones esperadas.

Entregables:

- PostgreSQL iniciando automáticamente.
- Base `sg_sst` creada y migrada.
- Usuario de aplicación con permisos mínimos.

Aceptación:

- El servicio de PostgreSQL inicia después de reiniciar el equipo.
- La aplicación puede conectarse con el usuario de aplicación.
- No hay acceso a PostgreSQL desde otro equipo de la red.

### Fase L2 — Aplicación, HTTPS y servicio automático (0,5–1 día)

Tareas:

- Instalar Node.js 22 LTS y habilitar pnpm con Corepack.
- Instalar dependencias con `corepack pnpm install --frozen-lockfile`.
- Crear un archivo de entorno de producción fuera del control de versiones con `DB_BACKEND=pg`, `DATABASE_URL` local, `SESSION_SECRET`, `ENCRYPTION_SECRET`, `PGPOOL_MAX=5`, `HOST=127.0.0.1`, `PORT=4000`, `ALERTS_ENABLED=true` y `FRONTEND_URL=https://sg-sst.local`. No definir `SMTP_*`, `ADMIN_EMAIL` ni ninguna credencial de correo.
- Ejecutar lint, typecheck, pruebas y build de producción.
- Publicar el frontend compilado en `server/dist/public`, que Fastify ya sirve.
- Instalar Caddy y configurar el proxy inverso hacia `127.0.0.1:4000`.
- Emitir un certificado local para `sg-sst.local` e instalar la autoridad certificadora de Caddy en los tres equipos cliente.
- Configurar NSSM para ejecutar `node server/dist/index.js` como servicio de Windows, con reinicio automático y directorio de trabajo en la raíz del repositorio.
- Confirmar que el scheduler solo genere alertas locales y que no intente enviar correo ni resúmenes semanales.
- Verificar que el servicio arranque después de reiniciar el equipo.

Entregables:

- Aplicación disponible en `https://sg-sst.local`.
- Servicio `SG-SST` con arranque automático.
- Certificado local distribuido a los equipos autorizados.

Aceptación:

- Un reinicio completo del equipo deja PostgreSQL, Caddy y SG-SST disponibles sin intervención manual.
- Los tres equipos acceden por HTTPS al nombre interno.
- Los puertos 4000 y 5432 no son accesibles desde otros equipos.

### Fase L3 — Respaldos, restauración y seguridad (0,5–1 día)

Tareas:

- Configurar `BACKUP_DIR` en un disco externo o NAS, nunca en el mismo SSD del sistema.
- Mantener `BACKUP_ENABLED=true`, `BACKUP_TIMEZONE=America/Bogota` y retención inicial de 30 días.
- Confirmar que el respaldo incluye base de datos, manifiesto y carpeta `uploads/`.
- Programar una copia semanal rotada fuera de la sede.
- Documentar y ejecutar una restauración de prueba en una base separada, por ejemplo `sg_sst_restore_check`.
- Activar BitLocker en el disco de respaldo cuando sea posible.
- Restringir permisos del archivo de entorno y de la carpeta de respaldos al servicio y al administrador.
- Configurar el firewall de Windows para permitir solo 443 desde la subred interna.
- Activar cookies seguras y reconocer el proxy inverso cuando se use HTTPS.
- Revisar que los logs no contengan datos médicos, firmas, secretos ni contenido de correo.
- Verificar que el antivirus no bloquee los archivos de PostgreSQL ni los adjuntos, sin excluir toda la unidad.
- Confirmar que no hay conexiones salientes a SMTP ni tareas programadas de correo.

Entregables:

- Respaldo diario verificable.
- Procedimiento de restauración documentado.
- Reglas de firewall y permisos aplicados.

Aceptación:

- Se crea un respaldo y se restaura en una base separada con conteos y muestras coincidentes.
- El respaldo se puede recuperar desde el disco externo.
- La aplicación sigue funcionando después de una restauración de prueba controlada.

### Fase L4 — Pruebas, aceptación y entrega (0,5–1 día)

Tareas:

- Ejecutar pruebas unitarias, integración, typecheck, lint y build.
- Probar inicio de sesión, cierre de sesión, recuperación de sesión y permisos administrador/trabajador.
- Probar creación y consulta de trabajadores, exámenes, certificados, EPP, peligros, estándares, plan, inspecciones, incidentes, documentos y alertas.
- Probar carga y descarga de adjuntos, firmas y exportaciones PDF/Excel.
- Probar desde los tres equipos cliente, incluido un equipo sin sesión previa.
- Simular corte de energía o reinicio forzado y verificar que los servicios vuelven a iniciar.
- Verificar las alertas locales: generación programada, contador en el panel, historial y marcado como atendida.
- Confirmar que no existe configuración SMTP visible ni envío de correo desde la aplicación.
- Entregar guía corta de uso, actualización, respaldo, restauración e incidentes.
- Registrar aceptación del responsable SG-SST con datos de prueba.

Entregables:

- Acta de aceptación.
- Guía de operación local.
- Inventario de respaldos y responsables.

Aceptación:

- El responsable completa los flujos acordados sin asistencia técnica continua.
- La aplicación y PostgreSQL inician solos después de reiniciar.
- Un respaldo reciente se puede restaurar y verificar.

## 6. Cambios de código previstos

Son cambios pequeños y acotados; no incluyen reescritura ni migración a otro framework.

1. **Arranque PostgreSQL-only.** Evitar que producción abra SQLite cuando `DB_BACKEND=pg`; conservar SQLite únicamente para desarrollo y pruebas.
2. **Alertas locales.** En `server/src/lib/scheduler.ts`, retirar la creación del transporter y los envíos diario y semanal; el job de 07:00 solo debe generar alertas en la base. Eliminar `sendPendingAlerts` y `sendWeeklySummary`.
3. **Rutas sin correo.** En `server/src/routes/alerts.ts`, retirar `/alerts/send`, `/alerts/test-email` y `/alerts/preview`; conservar listado, estadísticas, generación y marcado como atendida. Reutilizar el campo `enviado` como estado de atención local para no crear una migración innecesaria.
4. **Panel de alertas.** En `web/src/pages/Alertas.tsx`, retirar la pestaña de configuración SMTP, el envío manual, el email de prueba y la previsualización de correo; renombrar “Enviadas” por “Atendidas” y “Marcar como enviada” por “Marcar como atendida”.
5. **Limpieza de correo.** Retirar `server/src/lib/email.ts`, la dependencia `nodemailer` y las variables `SMTP_*`/`ADMIN_EMAIL` del ejemplo y la documentación. Las columnas SMTP existentes en la base quedan sin uso en esta etapa; su eliminación se evalúa en una limpieza posterior.
6. **Cookies seguras.** Configurar `secure` en las cookies de sesión cuando la aplicación se publique por HTTPS.
7. **Proxy inverso.** Activar la confianza en el proxy de Caddy para registrar correctamente IP y protocolo.
8. **Variables de entorno.** Añadir ejemplos locales de PostgreSQL, respaldos, HTTPS y rutas de Windows, sin variables de correo.
9. **Validación de respaldos.** Verificar que `BACKUP_DIR` exista o se pueda crear y que el disco tenga espacio suficiente.
10. **Documentación.** Crear la guía de instalación, actualización, respaldo y restauración para el equipo dedicado.

No se cambia el modelo de datos, los permisos ni los flujos funcionales. El único cambio de comportamiento es que las alertas dejan de enviarse por correo y pasan a atenderse dentro del panel.

## 7. Procedimiento de actualización

1. Detener el servicio SG-SST.
2. Crear un respaldo manual y verificar el manifiesto.
3. Actualizar el código desde la rama aprobada.
4. Instalar dependencias con el lockfile.
5. Ejecutar migraciones PostgreSQL.
6. Ejecutar lint, typecheck, pruebas y build.
7. Iniciar el servicio y verificar `/api/health`.
8. Probar inicio de sesión, una lectura, una escritura y una descarga.
9. Si falla, restaurar la versión anterior y el respaldo correspondiente.

## 8. Riesgos y mitigaciones

| Riesgo                                      | Impacto | Mitigación                                                                  |
| ------------------------------------------- | ------- | --------------------------------------------------------------------------- |
| Falla del disco o del equipo                | Alto    | UPS, SSD de calidad, respaldo externo y copia semanal fuera de la sede      |
| Robo o incendio en la sede                  | Alto    | BitLocker, equipo en área restringida y copia física fuera de la sede       |
| Reinicio por actualizaciones de Windows     | Medio   | Ventana programada, arranque automático y verificación posterior            |
| Certificado local no confiado en un cliente | Medio   | Instalar la CA de Caddy en los tres equipos y documentar el procedimiento   |
| PostgreSQL mal configurado o expuesto       | Alto    | Escuchar solo en loopback, firewall y usuario de aplicación sin privilegios |
| Respaldo dañado o incompleto                | Alto    | Manifiesto, SHA-256, retención y restauración de prueba mensual             |
| Falta de espacio en disco                   | Medio   | Monitoreo semanal, retención y alerta de capacidad                          |
| Pérdida de la clave `ENCRYPTION_SECRET`     | Alto    | Guardar copia segura fuera del equipo y restringir su acceso                |
| Dependencia de una sola persona             | Medio   | Guía de operación, responsable suplente y credenciales en sobre sellado     |
| Restos de configuración de correo           | Medio   | Retirar rutas, UI y variables SMTP; probar que no haya envíos ni conexiones |
| Acceso remoto no disponible                 | Bajo    | Aceptado para esta etapa; evaluar VPN si se necesita más adelante           |

## 9. Estimación

**2–4 días-persona** de instalación, configuración, pruebas y documentación, con apoyo técnico. Incluye el ajuste de alertas locales y el retiro del correo; puede aumentar medio día si se eliminan también las columnas SMTP de la base. No incluye compra del equipo, instalación eléctrica, tiempo de aprobación de la empresa ni pruebas de aceptación del responsable SST.

## 10. Criterios de aceptación final

- [ ] PostgreSQL local inicia automáticamente y solo acepta conexiones locales.
- [ ] SG-SST inicia automáticamente después de reiniciar el equipo.
- [ ] Los tres usuarios acceden por HTTPS al nombre interno.
- [ ] Login, permisos, adjuntos, exportaciones y alertas funcionan con datos de prueba.
- [ ] Las alertas se generan y consultan solo en el panel; no se envía correo ni hay configuración SMTP visible.
- [ ] Los puertos de aplicación y base de datos no están expuestos a la red.
- [ ] El respaldo diario se crea en un disco distinto al del sistema.
- [ ] Existe una copia semanal fuera de la sede.
- [ ] La restauración se probó en una base separada y fue verificada.
- [ ] La documentación de operación, actualización y recuperación está entregada.
- [ ] No se cargaron datos reales sin aprobación de la empresa y revisión SST.

## 11. Rollback

- La base de datos se protege con un respaldo previo a cada actualización.
- La versión anterior del código se conserva en un directorio de liberación o en un commit etiquetado.
- Si una actualización falla, se detiene el servicio, se restaura el respaldo y se vuelve a la versión anterior.
- Si falla Caddy o el certificado, se puede acceder temporalmente por `http://127.0.0.1:4000` solo desde el equipo dedicado para diagnóstico; no se abre ese puerto a la LAN.

## 12. Decisiones que debe confirmar la empresa

1. Windows 11 Pro o Ubuntu Server.
2. Características y ubicación del equipo dedicado.
3. Nombre interno y subred autorizada.
4. Disco externo, NAS o ambos para respaldos.
5. Responsable operativo y suplente.
6. Ventana de actualizaciones y reinicios.
7. Confirmar que “alerta local” significa panel web con contador e historial, sin notificación de escritorio, sonido ni correo.
8. Confirmación de que no se requiere acceso remoto en esta etapa.
9. Aprobación para reemplazar la opción de alojamiento en la nube por despliegue local.
