import { FastifyPluginAsync } from 'fastify';
import PDFDocument from 'pdfkit';

import { getCompany } from '../services/companies.js';
import { getDocuments } from '../services/documents.js';
import { getHazardAssessments } from '../services/hazards.js';
import { getIncidents } from '../services/incidents.js';
import { getIndicators } from '../services/indicators.js';
import { getAnnualPlan } from '../services/plans.js';
import { getActivePolicy, getPolicies, getObjectives } from '../services/policies.js';
import { getStandards, stdCumplimiento } from '../services/standards.js';
import * as UsersService from '../services/users.js';

function pdfHandler(
  reply: any,
  filename: string,
  build: (doc: PDFKit.PDFDocument) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      reply.type('application/pdf');
      reply.header('Content-Disposition', `attachment; filename=${filename}`);
      reply.send(pdfBuffer);
      resolve();
    });
    doc.on('error', reject);

    build(doc);
    doc.end();
  });
}

const exportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/export/estandares', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const { set } = request.query as { set?: string };
    const standards = getStandards(fastify.db, set);
    const cumplimiento = stdCumplimiento(fastify.db);
    const company = getCompany(fastify.db);

    await pdfHandler(reply, `autoevaluacion_estandar_${set ?? 'todos'}.pdf`, (doc) => {
      doc.fontSize(20).text('Autoevaluación de Estándares Mínimos SG-SST', { align: 'center' });
      doc.fontSize(12).text(`${company?.razon_social ?? 'Empresa'} - NIT ${company?.nit ?? ''}`, { align: 'center' });
      doc.text(`Clase de riesgo: ${company?.clase_riesgo ?? '-'} | Estándar aplicable: ${set ?? 'todos'}`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).text('Resultado de cumplimiento');
      doc.fontSize(11).text(`Estándares evaluados: ${cumplimiento.total}`);
      doc.text(`Cumplidos: ${cumplimiento.cumplidos} | Incumplidos: ${cumplimiento.incumplidos}`);
      doc.text(`Porcentaje de cumplimiento: ${cumplimiento.porcentaje}%`);
      doc.moveDown();
      doc.fontSize(14).text('Detalle por estándar');
      doc.fontSize(10);
      for (const s of standards) {
        doc.text(`${s.codigo} - ${s.titulo} (${s.set_aplicable})`);
      }
    });
  });

  fastify.get('/export/plan-anual', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const { anio } = request.query as { anio?: string };
    const plans = getAnnualPlan(fastify.db, anio ? Number(anio) : undefined);

    await pdfHandler(reply, `plan_anual_${anio ?? 'todos'}.pdf`, (doc) => {
      doc.fontSize(20).text('Plan Anual de Trabajo SG-SST', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12);
      for (const p of plans) {
        doc.text(`Año: ${p.anio} | Objetivo: ${p.objetivo} | Responsable: ${p.responsable ?? '-'}`);
        doc.text(`Estado: ${p.estado} | Presupuesto: $${p.presupuesto ?? 0}`);
        doc.moveDown();
      }
    });
  });

  fastify.get('/export/matriz-riesgos', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const assessments = getHazardAssessments(fastify.db);

    await pdfHandler(reply, 'matriz_peligros_riesgos.pdf', (doc) => {
      doc.fontSize(20).text('Matriz de Peligros, Evaluación y Valoración de Riesgos', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10);
      for (const a of assessments) {
        doc.text(`${a.cargo_oficio} | Peligro: ${a.peligro_texto ?? a.peligro_id ?? '-'} | Valoración: ${a.valoracion_riesgo} | Responsable: ${a.responsable ?? '-'}`);
      }
    });
  });

  fastify.get('/export/indicadores', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const { periodo } = request.query as { periodo?: string };
    const indicators = getIndicators(fastify.db, periodo);

    await pdfHandler(reply, `indicadores_${periodo ?? 'todos'}.pdf`, (doc) => {
      doc.fontSize(20).text('Indicadores del SG-SST', { align: 'center' });
      doc.moveDown();
      doc.fontSize(11);
      for (const ind of indicators) {
        doc.text(`${ind.nombre} (${ind.tipo}): ${ind.valor} | Meta: ${ind.meta ?? '-'} | Periodo: ${ind.periodo}`);
      }
    });
  });

  fastify.get('/export/incidentes', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const incidents = getIncidents(fastify.db);

    await pdfHandler(reply, 'incidentes_accidentes.pdf', (doc) => {
      doc.fontSize(20).text('Reporte de Incidentes y Accidentes', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10);
      for (const inc of incidents) {
        doc.text(`${inc.fecha_ocurrencia} | ${inc.tipo} | ${inc.descripcion} | Estado: ${inc.estado}`);
      }
    });
  });

  fastify.get('/export/evidencias', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
    const docs = getDocuments(fastify.db);

    await pdfHandler(reply, 'listado_evidencias.pdf', (doc) => {
      doc.fontSize(20).text('Listado de Evidencias Documentales', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10);
      for (const d of docs) {
        doc.text(`${d.codigo} - ${d.nombre} | v${d.version} | ${d.estado} | Vencimiento retención: ${d.retencion_anos} años`);
      }
    });
  });

  // ===== EXPORT POLÍTICA SST =====
  fastify.get('/export/politica', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });

    const activePolicy = getActivePolicy(fastify.db);
    const allPolicies = getPolicies(fastify.db);
    const company = getCompany(fastify.db);

    if (!activePolicy) {
      return reply.code(404).send({ error: 'No hay política vigente para exportar' });
    }

    const objectives = getObjectives(fastify.db, activePolicy.id);

    await pdfHandler(reply, `politica_sst_v${activePolicy.version}.pdf`, (doc) => {
      // Encabezado
      doc.fontSize(20).text('Política de Seguridad y Salud en el Trabajo (SST)', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`${company?.razon_social ?? 'Empresa'} - NIT ${company?.nit ?? ''}`, { align: 'center' });
      doc.text(`Versión: ${activePolicy.version} | Estado: ${activePolicy.estado.toUpperCase()}`, { align: 'center' });
      doc.moveDown();
      
      // Línea separadora
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();

      // Contenido de la política
      doc.fontSize(14).text('CONTENIDO DE LA POLÍTICA', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      
      // Dividir el contenido en líneas y escribir
      const lines = activePolicy.contenido.split('\n');
      for (const line of lines) {
        if (line.trim() === '') {
          doc.moveDown(0.3);
        } else if (line.startsWith('FIRMAS') || line.match(/^[0-9]+\./)) {
          doc.fontSize(11).font('Helvetica-Bold').text(line);
          doc.font('Helvetica').fontSize(10);
        } else {
          doc.text(line);
        }
      }

      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();

      // Firmas y fechas
      doc.fontSize(14).text('FIRMAS Y DIVULGACIÓN', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);
      
      if (activePolicy.firmado_por) {
        doc.text(`Firmado por: ${activePolicy.firmado_por}`);
      }
      if (activePolicy.fecha_firma) {
        doc.text(`Fecha de firma: ${activePolicy.fecha_firma}`);
      }
      if (activePolicy.fecha_divulgacion) {
        doc.text(`Fecha de divulgación: ${activePolicy.fecha_divulgacion}`);
      } else {
        doc.fillColor('#dc2626').text('Fecha de divulgación: Pendiente').fillColor('black');
      }

      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();

      // Objetivos
      doc.fontSize(14).text('OBJETIVOS SST (Política Vigente)', { underline: true });
      doc.moveDown(0.5);
      
      if (objectives.length === 0) {
        doc.fillColor('#6b7280').fontSize(10).text('No hay objetivos definidos para esta política.').fillColor('black');
      } else {
        for (const obj of objectives) {
          doc.fontSize(11).font('Helvetica-Bold').text(`${obj.descripcion}`);
          doc.font('Helvetica').fontSize(10);
          doc.text(`  Tipo: ${obj.tipo.charAt(0).toUpperCase() + obj.tipo.slice(1)} | Estado: ${obj.estado.replace('_', ' ').toUpperCase()}`);
          if (obj.meta) doc.text(`  Meta: ${obj.meta}`);
          if (obj.responsable) doc.text(`  Responsable: ${obj.responsable}`);
          if (obj.fecha_limite) doc.text(`  Fecha límite: ${obj.fecha_limite}`);
          doc.moveDown(0.5);
        }
      }

      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();

      // Histórico de versiones
      doc.fontSize(14).text('HISTÓRICO DE VERSIONES', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      
      for (const p of allPolicies) {
        const estadoLabel = p.estado.toUpperCase();
        doc.font('Helvetica-Bold').text(`v${p.version} - ${p.titulo} [${estadoLabel}]`);
        doc.font('Helvetica');
        if (p.firmado_por) doc.text(`  Firmado por: ${p.firmado_por} | Fecha firma: ${p.fecha_firma ?? '—'}`);
        if (p.fecha_divulgacion) doc.text(`  Divulgada: ${p.fecha_divulgacion}`);
        doc.moveDown(0.3);
      }
    });
  });
};

export default exportRoutes;