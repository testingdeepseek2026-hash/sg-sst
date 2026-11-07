import nodemailer from 'nodemailer';

let cachedTransporter: nodemailer.Transporter | null = null;

export function createTransporter(): nodemailer.Transporter | null {
  if (cachedTransporter) return cachedTransporter;
  
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    console.log('[ALERTAS] SMTP no configurado. Modo simulación activado.');
    return null;
  }
  
  try {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });
    
    // Verificar conexión
    cachedTransporter.verify((err) => {
      if (err) console.error('[ALERTAS] Error verificando SMTP:', err.message);
      else console.log('[ALERTAS] SMTP conectado correctamente');
    });
    
    return cachedTransporter;
  } catch (err: any) {
    console.error('[ALERTAS] Error creando transporter:', err.message);
    return null;
  }
}

export async function sendAlertEmail(
  transporter: nodemailer.Transporter | null,
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  if (!transporter) {
    // Modo simulación
    console.log('=== EMAIL SIMULADO ===');
    console.log(`Para: ${to}`);
    console.log(`Asunto: ${subject}`);
    console.log(`Texto: ${text}`);
    console.log('========================');
    return { success: true };
  }
  
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? 'SG-SST Alertas <alertas@empresa.com>',
      to,
      subject,
      html,
      text
    });
    return { success: true };
  } catch (err: any) {
    console.error('[ALERTAS] Error enviando email:', err.message);
    return { success: false, error: err.message };
  }
}

export function buildAlertEmailHtml(alerts: Array<{
  tipo: string;
  entidad: string;
  fecha_vencimiento: string;
  prioridad: string;
  worker_nombre?: string;
  worker_apellido?: string;
  item_nombre?: string;
  detalle?: string;
}>): string {
  const prioridadColors: Record<string, string> = {
    critica: '#dc2626',
    alta: '#ea580c',
    media: '#f59e0b'
  };
  
  const tipoLabels: Record<string, string> = {
    examen: '🩺 Examen Médico',
    certificado: '📜 Certificado',
    licencia_sst: '📋 Licencia SST',
    curso_50h: '📚 Curso 50h',
    inspeccion: '🔍 Inspección',
    plan: '📅 Plan Anual',
    documento: '📄 Documento'
  };
  
  const rows = alerts.map(a => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px; font-size: 13px;">${tipoLabels[a.tipo] || a.tipo}</td>
      <td style="padding: 10px; font-size: 13px;">${a.worker_nombre ? `${a.worker_nombre} ${a.worker_apellido}` : a.item_nombre || a.entidad}</td>
      <td style="padding: 10px; font-size: 13px; text-align: center;">${a.fecha_vencimiento}</td>
      <td style="padding: 10px; text-align: center;">
        <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; background: ${prioridadColors[a.prioridad] || '#6b7280'}20; color: ${prioridadColors[a.prioridad] || '#6b7280'};">
          ${a.prioridad.toUpperCase()}
        </span>
      </td>
      <td style="padding: 10px; font-size: 12px; color: #6b7280;">${a.detalle || '—'}</td>
    </tr>
  `).join('');
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 700px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
    <!-- Header -->
    <tr>
      <td style="background: #0f766e; padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 22px;">⚠️ Alertas SG-SST - Vencimientos Próximos</h1>
        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Sistema de Gestión SST - Microempresa Colombia</p>
      </td>
    </tr>
    <!-- Content -->
    <tr>
      <td style="padding: 24px;">
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">Se han detectado <strong>${alerts.length} alerta(s)</strong> con vencimientos próximos o vencidos. Revisar y tomar acción:</p>
        
        <div style="overflow-x: auto;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 12px 10px; text-align: left; font-weight: 600; color: #374151; font-size: 12px;">Tipo</th>
                <th style="padding: 12px 10px; text-align: left; font-weight: 600; color: #374151; font-size: 12px;">Trabajador / Ítem</th>
                <th style="padding: 12px 10px; text-align: center; font-weight: 600; color: #374151; font-size: 12px;">Vence</th>
                <th style="padding: 12px 10px; text-align: center; font-weight: 600; color: #374151; font-size: 12px;">Prioridad</th>
                <th style="padding: 12px 10px; text-align: left; font-weight: 600; color: #374151; font-size: 12px;">Detalle</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
        
        <p style="margin: 20px 0 0; font-size: 12px; color: #6b7280;">
          <strong>Prioridades:</strong> 🔴 Crítica (vencido) · 🟠 Alta (≤7 días) · 🟡 Media (≤30 días)
        </p>
        
        <div style="margin-top: 24px; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
          <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #0f766e;">Acciones recomendadas:</p>
          <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #4b5563; line-height: 1.8;">
            <li>Programar exámenes médicos ocupacionales vencidos</li>
            <li>Renovar certificados de alturas (vigencia 3 años - Res. 4272/2021)</li>
            <li>Actualizar licencia SST y curso 50h (actualización 20h cada 3 años)</li>
            <li>Ejecutar inspecciones programadas</li>
            <li>Revisar y actualizar documentos por vencer</li>
          </ul>
        </div>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0 0 8px; font-size: 12px; color: #6b7280;">SG-SST - Sistema de Gestión de Seguridad y Salud en el Trabajo</p>
        <p style="margin: 0; font-size: 11px; color: #9ca3af;">
          Este email se generó automáticamente. No responda a este mensaje.<br>
          Datos personales protegidos bajo Ley 1581/2012 (Colombia). No contiene información médica sensible.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function buildAlertEmailText(alerts: Array<{
  tipo: string;
  entidad: string;
  fecha_vencimiento: string;
  prioridad: string;
  worker_nombre?: string;
  worker_apellido?: string;
  item_nombre?: string;
  detalle?: string;
}>): string {
  const tipoLabels: Record<string, string> = {
    examen: 'Examen Médico',
    certificado: 'Certificado',
    licencia_sst: 'Licencia SST',
    curso_50h: 'Curso 50h',
    inspeccion: 'Inspección',
    plan: 'Plan Anual',
    documento: 'Documento'
  };
  
  let text = `ALERTAS SG-SST - VENCIMIENTOS PRÓXIMOS\n`;
  text += `==========================================\n\n`;
  text += `Se detectaron ${alerts.length} alerta(s) con vencimientos próximos o vencidos:\n\n`;
  
  for (const a of alerts) {
    text += `• ${tipoLabels[a.tipo] || a.tipo}: ${a.worker_nombre ? `${a.worker_nombre} ${a.worker_apellido}` : a.item_nombre || a.entidad}\n`;
    text += `  Vence: ${a.fecha_vencimiento} | Prioridad: ${a.prioridad.toUpperCase()}\n`;
    if (a.detalle) text += `  Detalle: ${a.detalle}\n`;
    text += `\n`;
  }
  
  text += `------------------------------------------\n`;
  text += `Prioridades: Crítica (vencido) | Alta (≤7 días) | Media (≤30 días)\n\n`;
  text += `Acciones: Programar exámenes | Renovar certificados alturas (3 años) | Actualizar licencia SST/curso 50h | Ejecutar inspecciones | Revisar documentos\n\n`;
  text += `SG-SST - Sistema de Gestión SST - Colombia\n`;
  text += `Datos protegidos bajo Ley 1581/2012. No contiene información médica sensible.\n`;
  
  return text;
}