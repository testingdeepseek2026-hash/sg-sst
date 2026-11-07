import { DatabaseSync } from 'node:sqlite';
import { genId, nowISO } from './dist/lib/utils.js';

const db = new DatabaseSync('C:\\Users\\PC\\sg-sst\\server\\data\\sg-sst.db');

// Test createPolicy directly
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

function createPolicy(db, input) {
  const id = genId();
  const now = nowISO();
  const estado = input.estado ?? 'borrador';
  
  // Validar: solo una política vigente a la vez
  if (estado === 'vigente') {
    const existing = db.prepare('SELECT * FROM policies WHERE estado = ? LIMIT 1').get('vigente');
    if (existing) {
      throw new Error('Ya existe una política vigente. Archive la actual antes de crear una nueva vigente.');
    }
  }

  db.prepare(
    `INSERT INTO policies (id, version, titulo, contenido, firmado_por, fecha_firma, fecha_divulgacion, estado, creado_en, actualizado_en)
     VALUES (?, 1, ?, ?, NULL, NULL, NULL, ?, ?, ?)`
  ).run(id, input.titulo, input.contenido, estado, now, now);

  return db.prepare('SELECT * FROM policies WHERE id = ?').get(id);
}

console.log('Testing createPolicy...');
try {
  const policy = createPolicy(db, {
    titulo: 'Política SST',
    contenido: plantillaPolitica,
    estado: 'borrador'
  });
  console.log('Policy created:', policy);
} catch (e) {
  console.error('Error creating policy:', e.message);
}

const count = db.prepare('SELECT COUNT(*) as c FROM policies').get();
console.log('Total policies:', count.c);