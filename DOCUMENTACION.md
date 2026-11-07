# SG-SST Microempresa - Documentación de uso, respaldo y despliegue

**Empresa:** Micro Instalaciones Electrónicas SAS (ejemplo) · 3 trabajadores · Riesgo V (ARL)  
**Marco normativo:** Decreto 1072/2015 (Cap. 6, Tit. 4, Libro 2), Res. 0312/2019 (32 estándares Cap. III), Res. 4272/2021 (alturas), Res. 2646/2008 + 2764/2022 (psicosocial), RETIE, Ley 1581/2012 (datos sensibles).  
**Interfaz:** español de Colombia · PWA (funciona en celular y sin conexión parcial).

---

## 1. Cuentas de prueba (semilla)

| Rol | Correo | Contraseña |
|-----|--------|------------|
| Administrador (responsable SG-SST) | admin@sg-sst.local | Admin1234! |
| Trabajador | trabajador@sg-sst.local | Trab1234! |

Cambiar contraseñas en producción.

---

## 2. Primeros pasos (responsable SG-SST)

1. Abrir `http://127.0.0.1:4000` (o el dominio/IP configurado).
2. Iniciar sesión como administrador.
3. Ir a **Empresa** y confirmar: clase de riesgo = **V** (estándares aplicables: **32**, Capítulo III). Si la ARL le asigna otro riesgo, cámbielo aquí; el sistema ajusta automáticamente el checklist (7 / 21 / 32).
4. Ir a **Roles**: verificar que exista el "Responsable SG-SST" con licencia SST vigente y curso 50 h. Registrar vencimientos para recibir alertas.
5. Ir a **Trabajadores**: dar de alta a los 3 trabajadores (documento, cargo, EPS, ARL, fecha de ingreso).
6. Ir a **Matriz Riesgos**: revisar el catálogo precargado (alturas, eléctrico, herramientas, escaleras, ergonomía, conducción, cielos rasos, confinados, locativo) y cargar la matriz por cargo/oficio.
7. Ir a **Estándares Mínimos**: completar la autoevaluación (32 ítems). Los incumplidos generan el plan de mejora automático.
8. Ir a **Plan Anual**: cargar actividades, responsables, fechas y presupuesto.
9. Ir a **Incidentes**: reportar cualquier evento (plazo ARL/EPS: 2 días hábiles).
10. Ir a **Inspecciones** y **Trabajo Alturas**: usar desde el celular en obra (fotos y firma en pantalla).
11. Ir a **Tablero**: ver cumplimiento, indicadores, acciones pendientes e incidentes abiertos.

---

## 3. Módulos por PHVA

**Planear:** Autoevaluación estándares (32 ítems), Política y objetivos, Roles y responsabilidades, Matriz de peligros (GTC 45), Plan anual + cronograma capacitación, Indicadores (estructura/proceso/resultado).

**Ejecutar:** Fichas de trabajadores (afiliaciones, exámenes médicos, certificados, EPP con firma), Capacitaciones con asistencia y evidencias, Inspecciones digitales (celular), Permiso trabajo en alturas + ATS (Res. 4272/2021), Reporte e investigación de incidentes, Plan de emergencias y simulacros, Gestión documental, Contratistas/proveedores.

**Verificar:** Auditoría interna anual y revisión por dirección, Seguimiento de acciones correctivas/preventivas, Tablero de control, Exportación PDF/Excel (autoevaluación, plan anual, matriz, indicadores, evidencias).

---

## 4. Alertas y vencimientos

Página **Alertas**: lista exámenes médicos, certificados (alturas, eléctrico), licencia SST y curso 50 h (actualización 20 h cada 3 años). Canal configurable en **Empresa** (correo recomendado). En este despliegue local los recordatorios se muestran en la app; para envío de correo real configurar SMTP (ver .env).

---

## 5. Importación desde Excel

Página **Importar Excel**: plantilla con primera fila de encabezados.
- Trabajadores: tipo_documento, numero_documento, nombres, apellidos, cargo, fecha_ingreso, estado, eps, arl
- Riesgos: cargo, area, peligro, tarea, valoracion, responsable
- Incidentes: tipo, fecha_ocurrencia, descripcion, estado

Comparta sus archivos Excel para afinar el mapeo.

---

## 6. Despliegue en su PC personal (Windows)

### Requisitos
- Node.js ≥ 22 (ya instalado: v24.16.0).
- Puerto 4000 libre.

### Estructura
```
C:\Users\PC\sg-sst\
  server/   (API Node + SQLite + build)
  web/      (frontend React + PWA, build en server/dist/public)
  data/     (base de datos sg-sst.db)
  backups/  (respaldos automáticos)
```

### Ejecutar
1. Abrir PowerShell en `C:\Users\PC\sg-sst\server`.
2. `.\runserver.bat` (inicia API en `http://127.0.0.1:4000`).
3. Abrir el navegador en esa URL. El frontend es una PWA: se puede "instalar" desde el navegador y usar en celular.

### Variables de entorno (opcional, editar `server\runserver.bat`)
- `PORT` (puerto, default 4000)
- `HOST` (default 127.0.0.1; poner 0.0.0.0 para acceder desde otros dispositivos de la red)
- `SESSION_SECRET` (secreto de sesión)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (para alertas por correo real)
- `SG_SST_DATA_DIR` (directorio de la base de datos, default `server/data`)

---

## 7. Respaldo y seguridad de datos (Ley 1581/2012)

La base de datos es un único archivo SQLite: `server/data/sg-sst.db`.

### Respaldo automático (recomendado)
Crear una tarea programada de Windows que copie el archivo diario:
```
robocopy "C:\Users\PC\sg-sst\server\data" "C:\Users\PC\sg-sst\backups" sg-sst.db /MIR /MT
```
O usar `restic`/`7zip` con cifrado (AES-256) porque el archivo contiene **datos de salud sensibles** (exámenes médicos, restricciones).

### Recomendaciones de seguridad
- No exponer el puerto 4000 a Internet sin proxy inverso (nginx/Caddy) con HTTPS.
- Los datos médicos se almacenan en la misma DB; restringir acceso al archivo `sg-sst.db` y a las carpetas `data/` y `backups/`.
- Bitácora de cambios en tabla `audit_logs` (quién, qué, cuándo).

### Restaurar
Detener el servidor, reemplazar `server/data/sg-sst.db` por el respaldo y reiniciar.

---

## 8. Pruebas básicas

Desde `C:\Users\PC\sg-sst\server`:
```
npm run test
```
Ejecuta una prueba de humo sobre SQLite (abrir, insertar, consultar).

---

## 9. Qué falta (próximas fases)

- Firma digital real (actualmente firma en pantalla como imagen).
- Envío de correo/SMTP para alertas (requiere configurar .env).
- WhatsApp Business API (opcional, costo por conversación).
- Sincronización offline completa en obra (PWA ya cachea estáticos; los datos se guardan al recuperar conexión).
- Importación masiva de EPP y exámenes desde Excel.

---

**Soporte:** este entregable cubre el MVP definido (autoevaluación estándares, matriz de peligros, plan anual, fichas de trabajadores con vencimientos, reporte de accidentes y dashboard). El resto de módulos están incluidos en la v1.0.
