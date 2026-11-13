import { DatabaseSync } from 'node:sqlite';

import { estandarSetPorRiesgo, getCompany } from '../services/companies.js';
import { createHazardCatalogItem } from '../services/hazards.js';
import { createObjective, createPolicy } from '../services/policies.js';
import { createRole } from '../services/roles.js';
import { createStandard } from '../services/standards.js';
import * as UsersService from '../services/users.js';
import { createWorker, getWorkerByDocumento } from '../services/workers.js';
import { crearCertificado } from '../services/workers_certs.js';
import { createEpp } from '../services/workers_epp.js';
import { createExam } from '../services/workers_exams.js';

import { hazardCatalogSeed } from './hazard-catalog-seed.js';

export async function seedAll(db: DatabaseSync) {
  // Empresa demostrativa: Riesgo IV, 3 trabajadores, Vigía SST + Comité Convivencia, alertas solo in-app
  const existing = getCompany(db);
  if (!existing) {
    const id = 'cmp-001';
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO companies (id, razon_social, nit, direccion, telefono, email, clase_riesgo, estandar_set,
        sector, actividad_economica, numero_trabajadores, tiene_vigia_sst, tiene_copasst,
        tiene_comite_convivencia, tiene_brigada, canal_alertas,
        smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, alerts_enabled,
        creado_en, actualizado_en)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      id,
      'Micro Instalaciones Electrónicas SAS',
      '900.123.456-7',
      'Calle 10 # 20-30, Oficina 201',
      '3001234567',
      'sg-sst@microempresa.com.co',
      'IV',
      estandarSetPorRiesgo('IV', 3),
      'Servicios',
      'Instalación de sistemas electrónicos de seguridad',
      3,
      1,
      0,
      1,
      0,
      'app',
      null,
      null,
      null,
      null,
      null,
      0,
      now,
      now
    );
  }

  // Usuario administrador por defecto
  if (!UsersService.getUserByEmail(db, 'admin@sg-sst.local')) {
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256').update('Admin1234!').digest('hex');
    const u = UsersService.createUser(db, {
      email: 'admin@sg-sst.local',
      password_hash: hash,
      nombre: 'Responsable SG-SST',
      rol: 'administrador',
    });
    createRole(db, {
      nombre: 'Responsable SG-SST',
      descripcion: 'Diseña e implementa el SG-SST (profesional con licencia SST)',
      usuario_id: u.id,
      curso_50h: 1,
      notas: 'Curso 50h aprobado; licencia SST vigente (verificar vencimiento)',
    });
  }
  if (!UsersService.getUserByEmail(db, 'trabajador@sg-sst.local')) {
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256').update('Trab1234!').digest('hex');
    UsersService.createUser(db, {
      email: 'trabajador@sg-sst.local',
      password_hash: hash,
      nombre: 'Trabajador 1',
      rol: 'trabajador',
    });
  }

  // Estándares mínimos precargados (32 ítems Capítulo III) para riesgo IV/V
  const ya = db.prepare('SELECT COUNT(*) AS c FROM standards').get() as { c: number };
  if (ya.c === 0) {
    const std32 = [
      [
        'E01',
        'Asignación de persona que diseñe e implemente el SG-SST',
        'Profesional en SST con licencia vigente y curso 50h',
        '32',
        'III',
        'Soporte de asignación y hoja de vida',
      ],
      [
        'E02',
        'Asignación de responsabilidades en SST',
        'Documentar responsabilidades específicas en SST a todos los niveles',
        '32',
        'III',
        'Soporte de asignación de responsabilidades',
      ],
      [
        'E03',
        'Asignación de recursos para el SG-SST',
        'Definir y asignar talento humano, financieros, técnicos y tecnológicos',
        '32',
        'III',
        'Soporte de asignación de recursos',
      ],
      [
        'E04',
        'Afiliación al Sistema de Seguridad Social Integral',
        'Afiliación a Salud, Pensión y Riesgos Laborales',
        '32',
        'III',
        'Soporte de afiliación y pago',
      ],
      [
        'E05',
        'Conformación y funcionamiento del COPASST o Vigía SST',
        'Conformar, capacitar y verificar responsabilidades',
        '32',
        'III',
        'Actas de conformación, reuniones e informes',
      ],
      [
        'E06',
        'Conformación y funcionamiento del Comité de Convivencia Laboral',
        'Conformar, capacitar y verificar responsabilidades',
        '32',
        'III',
        'Actas de reuniones e informes',
      ],
      [
        'E07',
        'Programa de capacitación',
        'Elaborar y ejecutar programa de promoción y prevención',
        '32',
        'III',
        'Programa y soportes de ejecución con firmas',
      ],
      [
        'E08',
        'Política de SST',
        'Elaborar política escrita, firmada, fechada y comunicada',
        '32',
        'III',
        'Política escrita y soportes de divulgación',
      ],
      [
        'E09',
        'Plan Anual de Trabajo',
        'Elaborar plan firmado por el empleador con objetivos, metas, responsabilidades, recursos y cronograma',
        '32',
        'III',
        'Documento del plan anual de trabajo',
      ],
      [
        'E10',
        'Archivo y retención documental',
        'Mantener archivo por el término establecido en la normatividad vigente',
        '32',
        'III',
        'Revisión del archivo con soportes',
      ],
      [
        'E11',
        'Descripción sociodemográfica y diagnóstico de condiciones de salud',
        'Identificar características de la población y diagnóstico de salud',
        '32',
        'III',
        'Documento con perfil sociodemográfico y diagnóstico',
      ],
      [
        'E12',
        'Actividades de medicina del trabajo y prevención',
        'Desarrollar actividades conforme a prioridades identificadas',
        '32',
        'III',
        'Evidencias de definición y ejecución',
      ],
      [
        'E13',
        'Evaluaciones médicas ocupacionales',
        'Realizar conforme a normatividad y peligros/riesgos',
        '32',
        'III',
        'Conceptos del médico evaluador',
      ],
      [
        'E14',
        'Restricciones y recomendaciones médicas laborales',
        'Cumplir recomendaciones y restricciones de EPS/ARL',
        '32',
        'III',
        'Soportes de recomendaciones emitidas y actuación',
      ],
      [
        'E15',
        'Reporte de accidentes y enfermedades laborales',
        'Reportar a ARL y EPS dentro de 2 días hábiles',
        '32',
        'III',
        'Registro de reportes FURAT/FUREL',
      ],
      [
        'E16',
        'Investigación de incidentes y accidentes',
        'Investigar con participación del COPASST/Vigía',
        '32',
        'III',
        'Verificación por muestreo',
      ],
      [
        'E17',
        'Identificación de peligros y evaluación/valoración de riesgos',
        'Identificar, evaluar, valorar y establecer controles',
        '32',
        'III',
        'Documento de identificación y valoración',
      ],
      [
        'E18',
        'Mantenimiento periódico de instalaciones, equipos, máquinas y herramientas',
        'Realizar mantenimientos conforme a manuales/fichas técnicas',
        '32',
        'III',
        'Reportes de mantenimiento',
      ],
      [
        'E19',
        'Entrega de EPP y capacitación en uso adecuado',
        'Entregar EPP según oficio y capacitar en uso',
        '32',
        'III',
        'Evidencia de entrega y capacitación',
      ],
      [
        'E20',
        'Plan de prevención, preparación y respuesta ante emergencias',
        'Elaborar plan de emergencias',
        '32',
        'III',
        'Plan y evidencias de divulgación',
      ],
      [
        'E21',
        'Brigada de prevención, preparación y respuesta ante emergencias',
        'Conformar, capacitar y dotar la brigada',
        '32',
        'III',
        'Documento de conformidad, capacitación y dotación',
      ],
      [
        'E22',
        'Revisión por la alta dirección',
        'Revisar al menos una vez al año los resultados del SG-SST',
        '32',
        'III',
        'Soportes de la revisión',
      ],
      [
        'E23',
        'Auditoría interna del SG-SST',
        'Realizar auditoría interna anual',
        '32',
        'III',
        'Programa de auditoría y resultados',
      ],
      [
        'E24',
        'Indicadores del SG-SST',
        'Medir y evaluar la gestión',
        '32',
        'III',
        'Registro de indicadores',
      ],
      [
        'E25',
        'Plan de mejora',
        'Acciones correctivas y preventivas con estado y fecha límite',
        '32',
        'III',
        'Registro de acciones',
      ],
      [
        'E26',
        'Gestión del cambio',
        'Evaluar impactos SST de cambios organizacionales',
        '32',
        'III',
        'Registro de evaluación de cambios',
      ],
      [
        'E27',
        'Contratistas y proveedores',
        'Evaluar y verificar requisitos SST',
        '32',
        'III',
        'Registro de evaluación de contratistas',
      ],
      [
        'E28',
        'Capacitación en SST continua',
        'Capacitación en peligros prioritarios y medidas de control',
        '32',
        'III',
        'Planillas de capacitación con firmas',
      ],
      [
        'E29',
        'Inducción y reinducción',
        'Inducir al ingreso y reinducir periódicamente',
        '32',
        'III',
        'Planillas de inducción',
      ],
      [
        'E30',
        'Investigación de enfermedades laborales',
        'Investigar diagnosticadas como laborales',
        '32',
        'III',
        'Informes de investigación',
      ],
      [
        'E31',
        'Vigilancia epidemiológica',
        'Desarrollar sistemas de vigilancia epidemiológica',
        '32',
        'III',
        'Reportes de vigilancia',
      ],
      [
        'E32',
        'Comunicación de riesgos',
        'Comunicar peligros y controles a los trabajadores',
        '32',
        'III',
        'Evidencias de comunicación',
      ],
    ];
    for (const s of std32) {
      createStandard(db, {
        codigo: s[0],
        titulo: s[1],
        descripcion: s[2],
        set_aplicable: s[3],
        capitulo: s[4],
        modo_verificacion: s[5],
      });
    }
    // También cargar el set de 7 (I-III) como referencia
    const std7 = [
      [
        'E01',
        'Asignación de persona que diseñe el SG-SST',
        'Técnico en SST con licencia vigente, 1 año experiencia y curso 50h',
        '7',
        'I',
        'Documento soporte y hoja de vida',
      ],
      [
        'E02',
        'Afiliación al Sistema de Seguridad Social Integral',
        'Afiliación a Salud, Pensión y Riesgos Laborales',
        '7',
        'I',
        'Soporte de afiliación y pago',
      ],
      [
        'E03',
        'Capacitación en SST',
        'Programa de capacitación en promoción y prevención',
        '7',
        'I',
        'Planillas con firmas',
      ],
      [
        'E04',
        'Plan Anual de Trabajo',
        'Plan firmado con objetivos, metas, responsabilidades, recursos y cronograma',
        '7',
        'I',
        'Documento del plan anual',
      ],
      [
        'E05',
        'Evaluaciones médicas ocupacionales',
        'Conforme a normatividad y peligros/riesgos',
        '7',
        'I',
        'Conceptos del médico evaluador',
      ],
      [
        'E06',
        'Identificación de peligros y evaluación/valoración de riesgos',
        'Con acompañamiento de la ARL',
        '7',
        'I',
        'Documento y acta de visita ARL',
      ],
      [
        'E07',
        'Medidas de prevención y control',
        'Ejecutar actividades de prevención y control',
        '7',
        'I',
        'Soporte de acciones ejecutadas',
      ],
    ];
    for (const s of std7) {
      createStandard(db, {
        codigo: s[0],
        titulo: s[1],
        descripcion: s[2],
        set_aplicable: s[3],
        capitulo: s[4],
        modo_verificacion: s[5],
      });
    }
  }

  // Trabajador de semilla
  if ((db.prepare('SELECT COUNT(*) AS c FROM workers').get() as { c: number }).c === 0) {
    createWorker(db, {
      tipo_documento: 'CC',
      numero_documento: '10000001',
      nombres: 'Juan',
      apellidos: 'Pérez',
      cargo: 'Técnico Instalador',
      fecha_ingreso: '2025-01-15',
      estado: 'activo',
      eps: 'Nueva EPS',
      arl: 'SURA',
    });
  }

  // Catálogo de peligros precargado (oficio instalación electrónica)
  const catCount = db.prepare('SELECT COUNT(*) AS c FROM hazard_catalog').get() as { c: number };
  if (catCount.c === 0) {
    for (const h of hazardCatalogSeed) {
      createHazardCatalogItem(db, h);
    }
  }

  // Consentimiento médico para trabajador semilla (Ley 1581/2012 - datos sensibles)
  const workerSeed = getWorkerByDocumento(db, '10000001');
  if (workerSeed) {
    const consentCount = db
      .prepare('SELECT COUNT(*) AS c FROM consents WHERE worker_id = ? AND tipo = ?')
      .get(workerSeed.id, 'medico') as { c: number };
    if (consentCount.c === 0) {
      const { genId, nowISO } = await import('../lib/utils.js');
      db.prepare(
        `INSERT INTO consents (id, worker_id, tipo, autorizado, fecha, medio) VALUES (?,?,?,?,?,?)`
      ).run(genId(), workerSeed.id, 'medico', 1, nowISO(), 'digital');
    }
  }

  // Datos semilla: Exámenes médicos, Certificados, EPP
  if (workerSeed) {
    // Exámenes médicos
    const examCount = db
      .prepare('SELECT COUNT(*) AS c FROM worker_exams WHERE worker_id = ?')
      .get(workerSeed.id) as { c: number };
    if (examCount.c === 0) {
      // Examen de ingreso (obligatorio Res. 0312/2019 E13)
      createExam(db, {
        worker_id: workerSeed.id,
        tipo: 'ingreso',
        fecha: '2025-01-10',
        vencimiento: '2026-01-10', // 1 año
        resultado: 'apto',
        medico: 'Dr. Carlos Méndez',
        entidad: 'Clínica Ocupacional Salud Total',
        notas:
          'Examen de ingreso según Res. 0312/2019 E13. Apto para trabajo en alturas y riesgo eléctrico.',
      });

      // Examen periódico (vencido para probar alerta)
      createExam(db, {
        worker_id: workerSeed.id,
        tipo: 'periodico',
        fecha: '2024-06-15',
        vencimiento: '2025-06-15', // Vencido
        resultado: 'apto_con_restricciones',
        restricciones:
          'Evitar exposición prolongada a ruido >85dB. Uso obligatorio de protección auditiva.',
        medico: 'Dra. Ana Rodríguez',
        entidad: 'Clínica Ocupacional Salud Total',
        notas: 'Examen periódico anual. Restricción por hipoacusia leve bilateral.',
      });

      // Examen de control (próximo a vencer)
      createExam(db, {
        worker_id: workerSeed.id,
        tipo: 'control',
        fecha: '2025-11-01',
        vencimiento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 15 días
        resultado: 'apto',
        medico: 'Dr. Carlos Méndez',
        entidad: 'Clínica Ocupacional Salud Total',
        notas: 'Control post-incapacidad por lumbalgia. Apto sin restricciones.',
      });
    }

    // Certificados
    const certCount = db
      .prepare('SELECT COUNT(*) AS c FROM worker_certs WHERE worker_id = ?')
      .get(workerSeed.id) as { c: number };
    if (certCount.c === 0) {
      // Certificado alturas VIGENTE (3 años según Res. 4272/2021 Art 12)
      const alturasEmision = '2024-03-15';
      const alturasVenc = new Date(alturasEmision);
      alturasVenc.setFullYear(alturasVenc.getFullYear() + 3);

      crearCertificado(db, {
        worker_id: workerSeed.id,
        tipo: 'alturas',
        nombre_curso: 'Trabajo Seguro en Alturas - Nivel Avanzado',
        entidad: 'Instituto Colombiano de Seguridad en Alturas (ICSA)',
        fecha_emision: alturasEmision,
        fecha_vencimiento: alturasVenc.toISOString().split('T')[0],
        notas:
          'Vigencia 3 años según Res. 4272/2021 Art 12. Incluye rescate en alturas y uso de sistemas de protección contra caídas.',
      });

      // Certificado alturas VENCIDO (para probar alerta)
      const alturasVencidoEmision = '2021-01-10';
      const alturasVencidoVenc = new Date(alturasVencidoEmision);
      alturasVencidoVenc.setFullYear(alturasVencidoVenc.getFullYear() + 3);

      crearCertificado(db, {
        worker_id: workerSeed.id,
        tipo: 'alturas',
        nombre_curso: 'Trabajo Seguro en Alturas - Nivel Básico',
        entidad: 'SENA Regional Antioquia',
        fecha_emision: alturasVencidoEmision,
        fecha_vencimiento: alturasVencidoVenc.toISOString().split('T')[0],
        notas:
          'VENCIDO - Requiere recertificación urgente. Vigencia 3 años según Res. 4272/2021 Art 12.',
      });

      // Certificado primeros auxilios
      crearCertificado(db, {
        worker_id: workerSeed.id,
        tipo: 'primeros_auxilios',
        nombre_curso: 'Primeros Auxilios y RCP Básico',
        entidad: 'Cruz Roja Colombiana',
        fecha_emision: '2024-08-20',
        fecha_vencimiento: '2026-08-20', // 2 años
        notas: 'Certificación en primeros auxilios, RCP y DEA. Vigencia 2 años.',
      });

      // Certificado brigada
      crearCertificado(db, {
        worker_id: workerSeed.id,
        tipo: 'brigada',
        nombre_curso: 'Brigada de Emergencias - Nivel Operativo',
        entidad: 'Cuerpo de Bomberos Voluntarios',
        fecha_emision: '2024-05-10',
        fecha_vencimiento: '2025-05-10', // 1 año
        notas: 'Brigadista capacitado en emergencias, evacuación y uso de extintores.',
      });
    }

    // EPP / Dotación
    const eppCount = db
      .prepare('SELECT COUNT(*) AS c FROM worker_epp WHERE worker_id = ?')
      .get(workerSeed.id) as { c: number };
    if (eppCount.c === 0) {
      // Simular firma base64 (canvas vacío 1x1 PNG transparente)
      const firmaSimulada =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      createEpp(db, {
        worker_id: workerSeed.id,
        item: 'Casco de seguridad',
        cantidad: 1,
        fecha_entrega: '2025-01-15',
        fecha_vencimiento: '2027-01-15', // 2 años
        firmado_por_trabajador: 1,
        firma_url: firmaSimulada,
        notas: 'Casco clase G (general), color blanco. Entregado en inducción.',
      });

      createEpp(db, {
        worker_id: workerSeed.id,
        item: 'Arnés de seguridad',
        cantidad: 1,
        fecha_entrega: '2025-01-15',
        fecha_vencimiento: '2026-01-15', // 1 año (próximo a vencer)
        firmado_por_trabajador: 1,
        firma_url: firmaSimulada,
        notas: 'Arnés cuerpo completo tipo A, certificado ANSI Z359.11. Para trabajo en alturas.',
      });

      createEpp(db, {
        worker_id: workerSeed.id,
        item: 'Gafas de protección',
        cantidad: 1,
        fecha_entrega: '2025-01-15',
        fecha_vencimiento: '2026-07-15',
        firmado_por_trabajador: 1,
        firma_url: firmaSimulada,
        notas: 'Gafas anti-impacto con protección lateral, norma ANSI Z87.1.',
      });

      createEpp(db, {
        worker_id: workerSeed.id,
        item: 'Botas de seguridad',
        cantidad: 1,
        fecha_entrega: '2025-01-15',
        fecha_vencimiento: '2026-01-15',
        firmado_por_trabajador: 0, // Sin firmar - para probar flujo de firma
        firma_url: null,
        notas:
          'Botas dieléctricas punta de acero, suela antideslizante. Pendiente firma trabajador.',
      });

      createEpp(db, {
        worker_id: workerSeed.id,
        item: 'Protección auditiva',
        cantidad: 2,
        fecha_entrega: '2025-02-01',
        fecha_vencimiento: '2025-08-01', // Vencido
        firmado_por_trabajador: 1,
        firma_url: firmaSimulada,
        notas: 'Tapones auditivos tipo copa, NRR 27dB. Vencidos - requieren reemplazo.',
      });
    }
  }

  // Política SST plantilla (Decreto 1072/2015 Art 2.2.4.6.8)
  const policyCount = db.prepare('SELECT COUNT(*) AS c FROM policies').get() as { c: number };
  if (policyCount.c === 0) {
    const plantillaPolitica = `POLÍTICA DE SEGURIDAD Y SALUD EN EL TRABAJO (SST)

Micro Instalaciones Electrónicas SAS

NIT: 900.123.456-7

1. COMPROMISO DE LA ALTA DIRECCIÓN
La alta dirección de Micro Instalaciones Electrónicas SAS, en cumplimiento del Decreto 1072 de 2015 (Capítulo 6, Título 4, Libro 2) y la Resolución 0312 de 2019, declara su compromiso inequívoco con la Seguridad y Salud en el Trabajo (SST) como parte fundamental de la gestión empresarial.

2. OBJETIVO GENERAL
Prevenir el deterioro de la salud de los trabajadores, contratistas, visitantes y público en general, mediante la identificación de peligros, evaluación y valoración de riesgos, y la implementación de controles efectivos en todas nuestras actividades de instalación de sistemas electrónicos de seguridad (CCTV, alarmas, control de acceso, cableado estructurado).

3. PRINCIPIOS FUNDAMENTALES
3.1. Prevención del deterioro de la salud: La prevención es prioritaria sobre la corrección. Se identificarán, evaluarán y controlarán los riesgos en su origen.
3.2. Cumplimiento de requisitos legales y otros: Cumpliremos con la normatividad colombiana aplicable (Decreto 1072/2015, Res. 0312/2019, Res. 4272/2021, RETIE, Ley 1581/2012) y demás requisitos que la organización suscriba.
3.3. Mejora continua del SG-SST: Estableceremos objetivos medibles, indicadores de estructura, proceso y resultado, y revisaremos periódicamente el desempeño para mejorar continuamente.
3.4. Participación de los trabajadores: Garantizaremos la consulta y participación de los trabajadores y sus representantes (Vigía SST) en la identificación de peligros, evaluación de riesgos, investigación de incidentes y toma de decisiones en SST.
3.5. Revisión periódica: La alta dirección revisará el SG-SST al menos una vez al año para evaluar su idoneidad, adecuación y eficacia.

4. ALCANCE
Esta política aplica a todas las actividades, procesos, instalaciones y personal (propio y contratistas) de Micro Instalaciones Electrónicas SAS, incluyendo trabajos en obra, instalaciones en alturas, riesgo eléctrico, espacios confinados y conducción de vehículos.

5. RESPONSABILIDADES
- Representante Legal: Aprobar, firmar y divulgar la política; asignar recursos necesarios.
- Responsable SG-SST: Diseñar, implementar, mantener y mejorar el SG-SST; reportar a la alta dirección.
- Vigía SST: Velar por el cumplimiento, participar en inspecciones e investigaciones, recibir quejas y sugerencias.
- Trabajadores: Cumplir normas de SST, usar EPP, reportar condiciones inseguras y participar en capacitaciones.

6. COMUNICACIÓN Y DIVULGACIÓN
Esta política será comunicada a todos los trabajadores mediante inducción, reinducción, carteleras, medios digitales y reuniones. Se mantendrá disponible en lugar visible y accesible.

7. REVISIÓN Y ACTUALIZACIÓN
La política se revisará anualmente en la Revisión por la Dirección o cuando ocurran cambios significativos en la organización, normatividad o resultados del SG-SST.

FIRMAS

__________________________________________
Representante Legal
Fecha: _______________

__________________________________________
Responsable SG-SST
Fecha: _______________

Fecha de divulgación: _______________

Versión: 1`;

    // Crear política como borrador
    const policy = createPolicy(db, {
      titulo: 'Política SST',
      contenido: plantillaPolitica,
      estado: 'borrador',
    });

    // Crear 3 objetivos de ejemplo (estructura, proceso, resultado)
    createObjective(db, {
      policy_id: policy.id,
      descripcion:
        'Mantener actualizada la matriz de identificación de peligros y evaluación de riesgos para todas las actividades de instalación',
      tipo: 'estructura',
      meta: '100% de actividades cubiertas con matriz actualizada',
      responsable: 'Responsable SG-SST',
      fecha_limite: '2026-12-31',
      estado: 'en_proceso',
    });

    createObjective(db, {
      policy_id: policy.id,
      descripcion: 'Ejecutar el programa anual de capacitación en SST para todos los trabajadores',
      tipo: 'proceso',
      meta: '100% trabajadores capacitados según plan anual',
      responsable: 'Responsable SG-SST',
      fecha_limite: '2026-12-31',
      estado: 'pendiente',
    });

    createObjective(db, {
      policy_id: policy.id,
      descripcion: 'Alcanzar cero (0) accidentes de trabajo con tiempo perdido durante el año',
      tipo: 'resultado',
      meta: '0 accidentes con tiempo perdido',
      responsable: 'Representante Legal / Responsable SG-SST',
      fecha_limite: '2026-12-31',
      estado: 'pendiente',
    });
  }
}
