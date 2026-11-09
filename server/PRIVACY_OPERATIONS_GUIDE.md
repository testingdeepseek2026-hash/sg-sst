# Documentación de Privacidad y Operación - SG-SST

**Versión:** 1.0  
**Fecha:** 2026-11-08  
**Marco legal:** Ley 1581/2012 (Colombia), Decreto 1072/2015, Res. 0312/2019

---

## 1. Finalidad del Tratamiento

La aplicación SG-SST trata datos personales para:

| Finalidad                              | Base Legal                        | Datos Involucrados                                      |
| -------------------------------------- | --------------------------------- | ------------------------------------------------------- |
| Gestión del SG-SST (Decreto 1072/2015) | Obligación legal                  | Identificación, cargo, afiliaciones                     |
| Exámenes médicos ocupacionales         | Obligación legal + Consentimiento | **Datos sensibles**: salud, restricciones, diagnósticos |
| Capacitaciones e inducciones           | Obligación legal                  | Asistencia, firmas, evidencias                          |
| Inspecciones y permisos                | Obligación legal                  | Firmas, fotos, observaciones                            |
| Reporte de incidentes/accidentes       | Obligación legal                  | Lesiones, causas, acciones correctivas                  |
| Gestión documental y trazabilidad      | Obligación legal                  | Versiones, responsable, fechas                          |
| Alertas de vencimientos                | Interés legítimo                  | Fechas, tipos, prioridades                              |

---

## 2. Categorías de Datos y Nivel de Sensibilidad

### Datos Personales (Ley 1581/2012 - Art. 5)

- **Identificación:** Nombres, apellidos, tipo/no. documento, cargo, fecha ingreso
- **Contacto:** Teléfono, email, dirección
- **Afiliaciones:** EPS, AFP, ARL, Caja de compensación
- **Laborales:** Certificados, capacitaciones, EPP entregado, firmas

### Datos Sensibles (Ley 1581/2012 - Art. 5, literal d) - **PROTECCIÓN REFORZADA**

- **Exámenes médicos:** Tipo, fecha, vencimiento, resultado, **restricciones**, **médico**, **entidad**, **archivo_url**, **notas**
- **Historia clínica ocupacional**
- **Diagnósticos y tratamientos** (si aplican)

> **IMPORTANTE:** Los campos marcados en **negrita** se cifran automáticamente en la base de datos (AES-256-GCM) y se enmascaran en bitácoras y listados.

---

## 3. Medidas Técnicas Implementadas

### 3.1 Cifrado en Reposo (Datos Sensibles)

```typescript
// server/src/lib/crypto.ts
// Algoritmo: AES-256-GCM (autenticación integrada)
// Clave: Derivada de ENCRYPTION_SECRET (scrypt, salt fijo, 32 bytes)
// IV: 12 bytes aleatorios por operación
// Formato almacenado: base64(IV + ciphertext + authTag)
```

**Campos cifrados automáticamente:**

- `worker_exams.restricciones`
- `worker_exams.medico`
- `worker_exams.entidad`
- `worker_exams.archivo_url` (si contiene datos médicos)
- `worker_exams.notas`

### 3.2 Control de Acceso Basado en Roles (RBAC)

| Rol               | Permisos                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **administrador** | Acceso total: CRUD todas las entidades, bitácora, datos sensibles (con consentimiento), exportar, importar, configuración             |
| **trabajador**    | Solo lectura: su ficha, sus certificados, sus exámenes (sin datos sensibles), firmar su EPP, reportar incidentes, ver alertas propias |

**Validación server-side:** Cada endpoint verifica `me.rol === 'administrador'` antes de operaciones sensibles.

### 3.3 Bitácora de Auditoría (Trazabilidad)

- **Tabla:** `audit_logs`
- **Registra:** quién (usuario_id, email), qué (accion, entidad, entidad_id), cuándo (creado_en), valores antes/después (JSON sanitizado)
- **Sanitización automática:** Campos sensibles se reemplazan por `[DATO SENSIBLE - PROTEGIDO LEY 1581/2012]`
- **Acceso:** Solo administrador vía `/api/audit-logs` y UI `/bitacora`

### 3.4 Consentimiento para Datos Médicos

- **Tabla:** `consents` (tipo: 'medico' | 'general')
- **Validación:** No se permite crear examen médico sin consentimiento `autorizado = 1`
- **Registro:** Fecha, medio (escrito/digital), trabajador

### 3.5 Cifrado en Tránsito

- **HTTPS obligatorio** en producción (TLS 1.2+)
- **Cookies seguras:** `Secure`, `HttpOnly`, `SameSite=Lax`
- **Headers de seguridad:** CSP, HSTS, X-Frame-Options (configurar en reverse proxy)

### 3.6 Gestión de Secretos

```bash
# Variables de entorno REQUERIDAS en producción:
ENCRYPTION_SECRET="clave-32-bytes-minimo-aleatoria-segura"  # Para cifrado BD
SESSION_SECRET="clave-sesion-aleatoria-32-chars"             # Para cookies JWT
SMTP_PASS="contraseña-email"                                 # Para alertas
# NUNCA hardcodear secretos en código ni repositorio
```

---

## 4. Flujos de Datos y Ciclo de Vida

### 4.1 Examen Médico Ocupacional

```
1. Trabajador firma consentimiento (físico/digital) → se registra en consents
2. Administrador crea examen → valida consentimiento → cifra campos sensibles → guarda
3. Listado general: NO muestra datos sensibles (retorna null/enmascarado)
4. Detalle (solo admin): Descifra y muestra datos completos
5. Bitácora: Registra acción con valores sanitizados
6. Alerta: Generada 30/15/7/1 días antes de vencimiento
```

### 4.2 Entrega de EPP

```
1. Administrador registra entrega → guarda item, fecha, vencimiento
2. Trabajador firma digital (canvas/base64) → valida propiedad (solo SU EPP)
3. Bitácora: Registra firma con hash de imagen (no imagen completa)
4. Alerta: Por vencimiento de EPP
```

### 4.3 Reporte de Incidente

```
1. Cualquier usuario reporta → guarda datos básicos
2. Administrador investiga → agrega causa raíz, acciones correctivas
3. Alertas legales: Recordatorio reporte ARL (2 días), EPS, MinTrabajo (graves)
4. Exportación: Para entrega a autoridades (sin datos médicos de otros trabajadores)
```

---

## 5. Retención y Eliminación

| Tipo de Dato                          | Retención Mínima              | Fuente Normativa                           | Acción al Vencer     |
| ------------------------------------- | ----------------------------- | ------------------------------------------ | -------------------- |
| Exámenes médicos / exposición         | **20 años**                   | Res. 0312/2019 Art. 2.2.4.6.38             | Archivar (no borrar) |
| Registros SG-SST generales            | 5 años                        | Decreto 1072/2015                          | Evaluar / Archivar   |
| Bitácora auditoría                    | 5 años                        | ISO 27001 / Buena práctica                 | Archivar             |
| Documentos (procedimientos, formatos) | Según `retencion_anos` (5-20) | Configurable en `documents.retencion_anos` | Evaluar              |
| Alertas enviadas                      | 2 años                        | Operativo                                  | Limpiar automático   |
| Consentimientos                       | Vigencia + 5 años             | Ley 1581/2012 Art. 15                      | Archivar             |

**Configuración en BD:** Campo `documents.retencion_anos` (default 5, 20 para médicos/exposición)

---

## 6. Derechos del Titular (Ley 1581/2012 - Art. 8)

| Derecho                       | Implementación                                                      |
| ----------------------------- | ------------------------------------------------------------------- |
| **Conocer**                   | Exportar datos del trabajador (PDF/Excel desde UI)                  |
| **Actualizar/Rectificar**     | Admin edita ficha trabajador; bitácora registra cambio              |
| **Suprimir**                  | Solo si no hay obligación legal de retención; `DELETE` con bitácora |
| **Revocar consentimiento**    | Admin marca `consents.autorizado = 0`; bloquea nuevos exámenes      |
| **Acceso en formato legible** | Exportación PDF/Excel desde módulos                                 |

> **Nota:** La supresión de datos con obligación de retención legal (ej. exámenes médicos 20 años) NO procede hasta vencido el plazo.

---

## 7. Transferencia y Encargados

| Destinatario                     | Finalidad                          | Base Legal                     | Medidas                                       |
| -------------------------------- | ---------------------------------- | ------------------------------ | --------------------------------------------- |
| **ARL**                          | Reporte accidentes, afiliaciones   | Obligación legal               | Canal seguro, datos mínimos                   |
| **EPS**                          | Exámenes médicos, incapacidades    | Obligación legal               | Consentimiento trabajador                     |
| **Ministerio del Trabajo**       | Inspecciones, requerimientos       | Obligación legal               | Exportación controlada                        |
| **Profesional SST (licenciado)** | Revisión matriz riesgos, auditoría | Interés vital / Consentimiento | Acceso temporal, NDA                          |
| **Proveedor hosting/BD**         | Almacenamiento                     | Encargado del tratamiento      | Contrato DP, cifrado disco, acceso controlado |

---

## 8. Procedimientos Operativos

### 8.1 Alta de Trabajador

1. Crear usuario (rol: trabajador) → envía credenciales
2. Crear ficha trabajador (datos identificación, afiliaciones)
3. Registrar consentimiento médico (físico/digital)
4. Programar examen de ingreso
5. Entregar EPP inicial → firma digital
6. Inducción SST → registro asistencia + firma

### 8.2 Baja de Trabajador

1. Cambiar estado a `retirado` / `inactivo` (no borrar)
2. Registrar examen de egreso (requiere consentimiento vigente)
3. Recuperar EPP → registrar devolución
4. Mantener registros por retención legal (20 años médicos)
5. Revocar acceso (desactivar usuario, no borrar por bitácora)

### 8.3 Incidente de Seguridad de la Información

1. Detectar (alerta, auditoría, reporte)
2. Contener (revocar credenciales, aislar BD)
3. Evaluar alcance (datos afectados, titulares)
4. Notificar (autoridad protección de datos si hay riesgo alto - Art. 20 Ley 1581)
5. Documentar en bitácora + informe
6. Medidas correctivas y comunicación a titulares

---

## 9. Configuración de Producción (Checklist)

### Servidor / Infraestructura

- [ ] HTTPS con certificado válido (TLS 1.2+)
- [ ] Headers de seguridad (HSTS, CSP, X-Frame-Options, Referrer-Policy)
- [ ] Firewall: solo puertos 80/443 expuestos, BD y Redis internos
- [ ] Disco cifrado (LUKS / BitLocker / EBS encrypted)
- [ ] Respaldos automáticos diarios + verificación mensual
- [ ] Monitoreo: health check `/api/health`, logs centralizados
- [ ] Actualizaciones de seguridad automatizadas (OS, Node.js, dependencias)

### Aplicación

- [ ] `ENCRYPTION_SECRET` generado seguro (32+ bytes aleatorios)
- [ ] `SESSION_SECRET` generado seguro
- [ ] `SMTP_*` configurado para alertas
- [ ] `ADMIN_EMAIL` para resúmenes semanales
- [ ] `APP_URL` con dominio real (para enlaces en emails)
- [ ] `NODE_ENV=production`
- [ ] `ALERTS_ENABLED=true`
- [ ] Clase de riesgo y estándares configurados según ARL real

### Datos

- [ ] Semilla de demo **NO** usada en producción
- [ ] Datos reales cargados tras aprobación y revisión SST
- [ ] Consentimientos médicos firmados y registrados
- [ ] Licencias SST y cursos 50h vigentes registrados

---

## 10. Límites y Exclusiones de Responsabilidad

| Aspecto                | Límite                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| **Cifrado BD**         | Protege datos en reposo; no protege contra acceso root al servidor ni claves comprometidas         |
| **Bitácora**           | No registra consultas SELECT (solo CREATE/UPDATE/DELETE/FIRMAR/IMPORTAR/EXPORTAR)                  |
| **Offline/PWA**        | Cache estático solo; NO sincroniza formularios offline                                             |
| **Email alertas**      | Simulación si SMTP no configurado; no garantiza entrega                                            |
| **Cumplimiento legal** | Herramienta de apoyo; **no reemplaza** criterio empleador, responsable SST, profesional licenciado |
| **Datos médicos**      | Cifrados en BD; enmascarados en logs/UI; profesional SST debe validar contenido                    |

---

## 11. Contacto - Delegado de Protección de Datos

| Rol                                 | Nombre   | Email                   | Teléfono |
| ----------------------------------- | -------- | ----------------------- | -------- |
| Responsable Tratamiento (Empleador) | [Nombre] | [email@empresa.com]     | [Tel]    |
| Responsable SG-SST / DPD            | [Nombre] | [email@empresa.com]     | [Tel]    |
| Profesional SST Licenciado          | [Nombre] | [email@profesional.com] | [Tel]    |

---

## 12. Referencias Normativas

1. **Ley 1581/2012** - Régimen general de protección de datos personales
2. **Decreto 1377/2013** - Reglamento parcial Ley 1581
3. **Decreto 1072/2015** - Libro 2, Parte 2, Título 4, Capítulo 6 (SG-SST)
4. **Resolución 0312/2019** - Estándares Mínimos SG-SST
5. **Resolución 4272/2021** - Trabajo seguro en alturas
6. **Resolución 2646/2008 / 2764/2022** - Riesgo psicosocial
7. **ISO 27001:2022** - Gestión de seguridad de la información (referencia)
8. **NIST CSF** - Marco de ciberseguridad (referencia)

---

**Aprobado por:** _________________________  
**Fecha:** _________________________  
**Próxima revisión:** 2027-11-08 (anual o tras incidente/cambio normativo)
