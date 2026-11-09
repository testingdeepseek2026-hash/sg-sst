import { FastifyPluginAsync } from 'fastify';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

import { getCompany } from '../services/companies.js';
import { getDocuments } from '../services/documents.js';
import { getHazardAssessments } from '../services/hazards.js';
import { getIncidents } from '../services/incidents.js';
import { getIndicators } from '../services/indicators.js';
import { getAnnualPlan } from '../services/plans.js';
import { getActivePolicy, getObjectives, getPolicies } from '../services/policies.js';
import { getStandards, stdCumplimiento } from '../services/standards.js';
import * as UsersService from '../services/users.js';
import { getCorrectiveActions } from '../services/actions.js';
import { getFindingsByAudit } from '../services/audits_alerts.js';

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

async function excelHandler(
  reply: any,
  filename: string,
  build: (wb: ExcelJS.Workbook) => Promise<void>
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  await build(wb);
  const buf = await wb.xlsx.writeBuffer();
  reply.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  reply.header('Content-Disposition', `attachment; filename=${filename}`);
  reply.send(buf);
}

const exportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/export/estandares', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { set } = request.query as { set?: string };
    const standards = getStandards(fastify.db, set);
    const cumplimiento = stdCumplimiento(fastify.db);
    const company = getCompany(fastify.db);

    await pdfHandler(reply, `autoevaluacion_estandar_${set ?? 'todos'}.pdf`, (doc) => {
      doc.fontSize(20).text('Autoevaluación de Estándares Mínimos SG-SST', { align: 'center' });
      doc.fontSize(12).text(`${company?.razon_social ?? 'Empresa'} - NIT ${company?.nit ?? ''}`, {
        align: 'center',
      });
      doc.text(
        `Clase de riesgo: ${company?.clase_riesgo ?? '-'} | Estándar aplicable: ${set ?? 'todos'}`,
        { align: 'center' }
      );
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
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
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
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const assessments = getHazardAssessments(fastify.db);

    await pdfHandler(reply, 'matriz_peligros_riesgos.pdf', (doc) => {
      doc
        .fontSize(20)
        .text('Matriz de Peligros, Evaluación y Valoración de Riesgos', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10);
      for (const a of assessments) {
        doc.text(
          `${a.cargo_oficio} | Peligro: ${a.peligro_texto ?? a.peligro_id ?? '-'} | Valoración: ${a.valoracion_riesgo} | Responsable: ${a.responsable ?? '-'}`
        );
      }
    });
  });

  fastify.get('/export/indicadores', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { periodo } = request.query as { periodo?: string };
    const indicators = getIndicators(fastify.db, periodo);

    await pdfHandler(reply, `indicadores_${periodo ?? 'todos'}.pdf`, (doc) => {
      doc.fontSize(20).text('Indicadores del SG-SST', { align: 'center' });
      doc.moveDown();
      doc.fontSize(11);
      for (const ind of indicators) {
        doc.text(
          `${ind.nombre} (${ind.tipo}): ${ind.valor} | Meta: ${ind.meta ?? '-'} | Periodo: ${ind.periodo}`
        );
      }
    });
  });

  fastify.get('/export/incidentes', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const incidents = getIncidents(fastify.db);

    await pdfHandler(reply, 'incidentes_accidentes.pdf', (doc) => {
      doc.fontSize(20).text('Reporte de Incidentes y Accidentes', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10);
      for (const inc of incidents) {
        doc.text(
          `${inc.fecha_ocurrencia} | ${inc.tipo} | ${inc.descripcion} | Estado: ${inc.estado}`
        );
      }
    });
  });

  fastify.get('/export/evidencias', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const docs = getDocuments(fastify.db);

    await pdfHandler(reply, 'listado_evidencias.pdf', (doc) => {
      doc.fontSize(20).text('Listado de Evidencias Documentales', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10);
      for (const d of docs) {
        doc.text(
          `${d.codigo} - ${d.nombre} | v${d.version} | ${d.estado} | Vencimiento retención: ${d.retencion_anos} años`
        );
      }
    });
  });

  // ===== EXPORT POLÍTICA SST =====
  fastify.get('/export/politica', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });

    const activePolicy = getActivePolicy(fastify.db);
    const allPolicies = getPolicies(fastify.db);
    const company = getCompany(fastify.db);

    if (!activePolicy) {
      return reply.code(404).send({ error: 'No hay política vigente para exportar' });
    }

    const objectives = getObjectives(fastify.db, activePolicy.id);

    await pdfHandler(reply, `politica_sst_v${activePolicy.version}.pdf`, (doc) => {
      // Encabezado
      doc
        .fontSize(20)
        .text('Política de Seguridad y Salud en el Trabajo (SST)', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`${company?.razon_social ?? 'Empresa'} - NIT ${company?.nit ?? ''}`, {
        align: 'center',
      });
      doc.text(`Versión: ${activePolicy.version} | Estado: ${activePolicy.estado.toUpperCase()}`, {
        align: 'center',
      });
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
        doc
          .fillColor('#6b7280')
          .fontSize(10)
          .text('No hay objetivos definidos para esta política.')
          .fillColor('black');
      } else {
        for (const obj of objectives) {
          doc.fontSize(11).font('Helvetica-Bold').text(`${obj.descripcion}`);
          doc.font('Helvetica').fontSize(10);
          doc.text(
            `  Tipo: ${obj.tipo.charAt(0).toUpperCase() + obj.tipo.slice(1)} | Estado: ${obj.estado.replace('_', ' ').toUpperCase()}`
          );
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
        if (p.firmado_por)
          doc.text(`  Firmado por: ${p.firmado_por} | Fecha firma: ${p.fecha_firma ?? '—'}`);
        if (p.fecha_divulgacion) doc.text(`  Divulgada: ${p.fecha_divulgacion}`);
        doc.moveDown(0.3);
      }
    });
  });

  // ===== EXCEL EXPORTS =====
  fastify.get('/export/estandares/excel', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { set } = request.query as { set?: string };
    const standards = getStandards(fastify.db, set);
    const cumplimiento = stdCumplimiento(fastify.db);
    const company = getCompany(fastify.db);

    await excelHandler(reply, `autoevaluacion_estandar_${set ?? 'todos'}.xlsx`, async (wb) => {
      const ws = wb.addWorksheet('Autoevaluación Estándares');
      ws.columns = [
        { header: 'Código', key: 'codigo', width: 15 },
        { header: 'Título', key: 'titulo', width: 60 },
        { header: 'Descripción', key: 'descripcion', width: 80 },
        { header: 'Set Aplicable', key: 'set_aplicable', width: 15 },
        { header: 'Capítulo', key: 'capitulo', width: 12 },
      ];
      ws.addRow({
        codigo: 'EMPRESA',
        titulo: company?.razon_social ?? 'Empresa',
        descripcion: `NIT: ${company?.nit ?? ''}`,
      });
      ws.addRow({
        codigo: 'CLASE RIESGO',
        titulo: company?.clase_riesgo ?? '-',
        descripcion: `Set aplicable: ${set ?? 'todos'}`,
      });
      ws.addRow({});
      ws.addRow({
        codigo: 'RESUMEN',
        titulo: `Total: ${cumplimiento.total} | Cumplidos: ${cumplimiento.cumplidos} | Incumplidos: ${cumplimiento.incumplidos} | %: ${cumplimiento.porcentaje}%`,
      });
      ws.addRow({});
      for (const s of standards) {
        ws.addRow({
          codigo: s.codigo,
          titulo: s.titulo,
          descripcion: s.descripcion,
          set_aplicable: s.set_aplicable,
          capitulo: s.capitulo,
        });
      }
    });
  });

  fastify.get('/export/plan-anual/excel', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { anio } = request.query as { anio?: string };
    const plans = getAnnualPlan(fastify.db, anio ? Number(anio) : undefined);

    await excelHandler(reply, `plan_anual_${anio ?? 'todos'}.xlsx`, async (wb) => {
      const ws = wb.addWorksheet('Plan Anual');
      ws.columns = [
        { header: 'Año', key: 'anio', width: 10 },
        { header: 'Objetivo', key: 'objetivo', width: 50 },
        { header: 'Meta', key: 'meta', width: 40 },
        { header: 'Responsable', key: 'responsable', width: 25 },
        { header: 'Fecha Inicio', key: 'fecha_inicio', width: 15 },
        { header: 'Fecha Fin', key: 'fecha_fin', width: 15 },
        { header: 'Presupuesto', key: 'presupuesto', width: 15 },
        { header: 'Estado', key: 'estado', width: 15 },
      ];
      for (const p of plans) {
        ws.addRow({
          anio: p.anio,
          objetivo: p.objetivo,
          meta: p.meta ?? '',
          responsable: p.responsable ?? '',
          fecha_inicio: p.fecha_inicio ?? '',
          fecha_fin: p.fecha_fin ?? '',
          presupuesto: p.presupuesto ?? 0,
          estado: p.estado,
        });
      }
    });
  });

  fastify.get('/export/matriz-riesgos/excel', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const assessments = getHazardAssessments(fastify.db);

    await excelHandler(reply, 'matriz_peligros_riesgos.xlsx', async (wb) => {
      const ws = wb.addWorksheet('Matriz Peligros');
      ws.columns = [
        { header: 'Cargo/Oficio', key: 'cargo_oficio', width: 30 },
        { header: 'Área', key: 'area', width: 20 },
        { header: 'Peligro ID', key: 'peligro_id', width: 15 },
        { header: 'Peligro Texto', key: 'peligro_texto', width: 50 },
        { header: 'Tarea', key: 'tarea', width: 30 },
        { header: 'Consecuencia', key: 'consecuencia', width: 20 },
        { header: 'Probabilidad', key: 'probabilidad', width: 15 },
        { header: 'Valoración Riesgo', key: 'valoracion_riesgo', width: 18 },
        { header: 'Controles', key: 'controles', width: 50 },
        { header: 'Responsable', key: 'responsable', width: 20 },
        { header: 'Fecha', key: 'fecha', width: 15 },
        { header: 'Estado', key: 'estado', width: 15 },
      ];
      for (const a of assessments) {
        ws.addRow({
          cargo_oficio: a.cargo_oficio,
          area: a.area ?? '',
          peligro_id: a.peligro_id ?? '',
          peligro_texto: a.peligro_texto ?? a.peligro_id ?? '',
          tarea: a.tarea ?? '',
          consecuencia: a.consecuencia ?? '',
          probabilidad: a.probabilidad ?? '',
          valoracion_riesgo: a.valoracion_riesgo,
          controles: a.controles ?? '',
          responsable: a.responsable ?? '',
          fecha: a.fecha ?? '',
          estado: a.estado ?? '',
        });
      }
    });
  });

  fastify.get('/export/indicadores/excel', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { periodo } = request.query as { periodo?: string };
    const indicators = getIndicators(fastify.db, periodo);

    await excelHandler(reply, `indicadores_${periodo ?? 'todos'}.xlsx`, async (wb) => {
      const ws = wb.addWorksheet('Indicadores');
      ws.columns = [
        { header: 'Nombre', key: 'nombre', width: 30 },
        { header: 'Tipo', key: 'tipo', width: 15 },
        { header: 'Valor', key: 'valor', width: 15 },
        { header: 'Meta', key: 'meta', width: 15 },
        { header: 'Periodo', key: 'periodo', width: 15 },
        { header: 'Fecha Cálculo', key: 'fecha_calculo', width: 20 },
        { header: 'Notas', key: 'notas', width: 40 },
      ];
      for (const ind of indicators) {
        ws.addRow({
          nombre: ind.nombre,
          tipo: ind.tipo,
          valor: ind.valor,
          meta: ind.meta ?? '',
          periodo: ind.periodo,
          fecha_calculo: ind.fecha_calculo ?? '',
          notas: ind.notas ?? '',
        });
      }
    });
  });

  fastify.get('/export/incidentes/excel', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const incidents = getIncidents(fastify.db);

    await excelHandler(reply, 'incidentes_accidentes.xlsx', async (wb) => {
      const ws = wb.addWorksheet('Incidentes');
      ws.columns = [
        { header: 'Fecha Ocurrencia', key: 'fecha_ocurrencia', width: 18 },
        { header: 'Fecha Reporte', key: 'fecha_reporte', width: 18 },
        { header: 'Tipo', key: 'tipo', width: 18 },
        { header: 'Trabajador ID', key: 'trabajador_id', width: 15 },
        { header: 'Lugar', key: 'lugar', width: 25 },
        { header: 'Descripción', key: 'descripcion', width: 60 },
        { header: 'Lesiones', key: 'lesiones', width: 30 },
        { header: 'Causa Raíz', key: 'causa_raiz', width: 40 },
        { header: 'Acciones Correctivas', key: 'acciones_correctivas', width: 40 },
        { header: 'Reporte ARL', key: 'reporte_arl', width: 12 },
        { header: 'Reporte EPS', key: 'reporte_eps', width: 12 },
        { header: 'Reporte MinTrabajo', key: 'reporte_mintrabajo', width: 15 },
        { header: 'Días Perdidos', key: 'dias_perdidos', width: 15 },
        { header: 'Estado', key: 'estado', width: 15 },
        { header: 'Investigador', key: 'investigador', width: 20 },
        { header: 'Fecha Cierre', key: 'fecha_cierre', width: 15 },
      ];
      for (const inc of incidents) {
        ws.addRow({
          fecha_ocurrencia: inc.fecha_ocurrencia,
          fecha_reporte: inc.fecha_reporte ?? '',
          tipo: inc.tipo,
          trabajador_id: inc.trabajador_id ?? '',
          lugar: inc.lugar ?? '',
          descripcion: inc.descripcion,
          lesiones: inc.lesiones ?? '',
          causa_raiz: inc.causa_raiz ?? '',
          acciones_correctivas: inc.acciones_correctivas ?? '',
          reporte_arl: inc.reporte_arl ? 'Sí' : 'No',
          reporte_eps: inc.reporte_eps ? 'Sí' : 'No',
          reporte_mintrabajo: inc.reporte_mintrabajo ? 'Sí' : 'No',
          dias_perdidos: inc.dias_perdidos ?? 0,
          estado: inc.estado,
          investigador: inc.investigador ?? '',
          fecha_cierre: inc.fecha_cierre ?? '',
        });
      }
    });
  });

  fastify.get('/export/evidencias/excel', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const docs = getDocuments(fastify.db);

    await excelHandler(reply, 'listado_evidencias.xlsx', async (wb) => {
      const ws = wb.addWorksheet('Evidencias Documentales');
      ws.columns = [
        { header: 'Código', key: 'codigo', width: 15 },
        { header: 'Nombre', key: 'nombre', width: 40 },
        { header: 'Versión', key: 'version', width: 12 },
        { header: 'Tipo', key: 'tipo', width: 20 },
        { header: 'Archivo URL', key: 'archivo_url', width: 40 },
        { header: 'Fecha Emisión', key: 'fecha_emision', width: 15 },
        { header: 'Fecha Revisión', key: 'fecha_revision', width: 15 },
        { header: 'Retención (años)', key: 'retencion_anos', width: 15 },
        { header: 'Responsable', key: 'responsable', width: 20 },
        { header: 'Estado', key: 'estado', width: 15 },
      ];
      for (const d of docs) {
        ws.addRow({
          codigo: d.codigo,
          nombre: d.nombre,
          version: d.version,
          tipo: d.tipo,
          archivo_url: d.archivo_url ?? '',
          fecha_emision: d.fecha_emision ?? '',
          fecha_revision: d.fecha_revision ?? '',
          retencion_anos: d.retencion_anos ?? 5,
          responsable: d.responsable ?? '',
          estado: d.estado ?? 'vigente',
        });
      }
    });
  });

  fastify.get('/export/acciones/excel', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const actions = getCorrectiveActions(fastify.db);

    await excelHandler(reply, 'acciones_correctivas.xlsx', async (wb) => {
      const ws = wb.addWorksheet('Acciones Correctivas');
      ws.columns = [
        { header: 'Origen', key: 'origen', width: 20 },
        { header: 'Origen Detalle', key: 'origen_detalle', width: 30 },
        { header: 'Origen ID', key: 'origen_id', width: 20 },
        { header: 'Descripción', key: 'descripcion', width: 50 },
        { header: 'Responsable', key: 'responsable', width: 25 },
        { header: 'Fecha Límite', key: 'fecha_limite', width: 15 },
        { header: 'Estado', key: 'estado', width: 15 },
        { header: 'Prioridad', key: 'prioridad', width: 12 },
        { header: 'Evidencia URL', key: 'evidencia_url', width: 40 },
        { header: 'Creado En', key: 'creado_en', width: 20 },
        { header: 'Actualizado En', key: 'actualizado_en', width: 20 },
        { header: 'Completada En', key: 'completada_en', width: 20 },
        { header: 'Firmado Por', key: 'firmado_por', width: 20 },
      ];
      for (const a of actions) {
        ws.addRow({
          origen: a.origen,
          origen_detalle: a.origen_detalle ?? '',
          origen_id: a.origen_id ?? '',
          descripcion: a.descripcion,
          responsable: a.responsable,
          fecha_limite: a.fecha_limite,
          estado: a.estado,
          prioridad: a.prioridad,
          evidencia_url: a.evidencia_url ?? '',
          creado_en: a.creado_en ?? '',
          actualizado_en: a.actualizado_en ?? '',
          completada_en: a.completada_en ?? '',
          firmado_por: a.firmado_por ?? '',
        });
      }
    });
  });

  fastify.get('/export/auditoria/:id/hallazgos/excel', async (request, reply) => {
    const uid = (request as any).userId;
    const me = UsersService.getUserById(fastify.db, uid!);
    if (!me || me.rol !== 'administrador')
      return reply.code(403).send({ error: 'Solo administrador' });
    const { id } = request.params as { id: string };
    const findings = getFindingsByAudit(fastify.db, id);
    const audit = fastify.db.prepare('SELECT * FROM audits WHERE id = ?').get(id);

    await excelHandler(reply, `hallazgos_auditoria_${audit?.anio}_${audit?.tipo}.xlsx`, async (wb) => {
      const ws = wb.addWorksheet('Hallazgos');
      ws.columns = [
        { header: 'ID', key: 'id', width: 12 },
        { header: 'Tipo', key: 'tipo', width: 20 },
        { header: 'Descripción', key: 'descripcion', width: 50 },
        { header: 'Requisito', key: 'requisito', width: 30 },
        { header: 'Evidencia', key: 'evidencia', width: 30 },
        { header: 'Responsable', key: 'responsable', width: 20 },
        { header: 'Fecha Límite', key: 'fecha_limite', width: 15 },
        { header: 'Estado', key: 'estado', width: 15 },
        { header: 'Acción Correctiva', key: 'accion_correctiva', width: 40 },
        { header: 'Evidencia Cierre', key: 'evidencia_cierre', width: 30 },
        { header: 'Fecha Cierre', key: 'fecha_cierre', width: 15 },
      ];
      for (const f of findings) {
        ws.addRow({
          id: f.id,
          tipo: f.tipo,
          descripcion: f.descripcion,
          requisito: f.requisito ?? '',
          evidencia: f.evidencia ?? '',
          responsable: f.responsable,
          fecha_limite: f.fecha_limite,
          estado: f.estado,
          accion_correctiva: f.accion_correctiva ?? '',
          evidencia_cierre: f.evidencia_cierre ?? '',
          fecha_cierre: f.fecha_cierre ?? '',
        });
      }
    });
  });
};

export default exportRoutes;
