import { CronJob } from 'cron';

import { generateAlerts, getPendingAlertsForSending, markAsSent, Alert } from '../services/alerts.js';

import { createTransporter } from './email.js';

interface AlertWithEmail extends Alert {
  company_email: string;
  canal_alertas: string;
}

let dailyJob: CronJob | null = null;
let weeklyJob: CronJob | null = null;

export function startAlertScheduler(db: any): void {
  // Solo en producción y si está habilitado
  if (process.env.NODE_ENV === 'test' || process.env.ALERTS_ENABLED !== 'true') {
    console.log('[SCHEDULER] Alertas deshabilitadas (NODE_ENV=test o ALERTS_ENABLED!=true)');
    return;
  }
  
  const transporter = createTransporter();
  
  // Job diario: 07:00 America/Bogota
  dailyJob = new CronJob(
    '0 7 * * *',
    async () => {
      console.log('[SCHEDULER] Ejecutando generación diaria de alertas...');
      try {
        generateAlerts(db);
        console.log('[SCHEDULER] Alertas generadas. Enviando pendientes...');
        await sendPendingAlerts(db, transporter);
      } catch (err: any) {
        console.error('[SCHEDULER] Error en job diario:', err.message);
      }
    },
    null,
    true,
    'America/Bogota'
  );
  
  // Job semanal: Lunes 08:00 - Resumen semanal
  weeklyJob = new CronJob(
    '0 8 * * 1',
    async () => {
      console.log('[SCHEDULER] Enviando resumen semanal...');
      try {
        await sendWeeklySummary(db, transporter);
      } catch (err: any) {
        console.error('[SCHEDULER] Error en resumen semanal:', err.message);
      }
    },
    null,
    true,
    'America/Bogota'
  );
  
  console.log('[SCHEDULER] Alertas programadas: Diario 07:00, Semanal Lunes 08:00 (America/Bogota)');
}

export function stopAlertScheduler(): void {
  if (dailyJob) { dailyJob.stop(); dailyJob = null; }
  if (weeklyJob) { weeklyJob.stop(); weeklyJob = null; }
  console.log('[SCHEDULER] Scheduler detenido');
}

async function sendPendingAlerts(db: any, transporter: any): Promise<void> {
  const pending = getPendingAlertsForSending(db) as AlertWithEmail[];
  if (!pending.length) {
    console.log('[SCHEDULER] No hay alertas pendientes para enviar');
    return;
  }
  
  // Agrupar por email del trabajador
  const byEmail = new Map<string, AlertWithEmail[]>();
  for (const a of pending) {
    // Buscar email del trabajador asociado
    let email = a.company_email;
    if (a.entidad === 'worker_exams' || a.entidad === 'worker_certs' || a.entidad === 'worker_epp') {
      const worker = db.prepare('SELECT email FROM workers WHERE id = (SELECT worker_id FROM ?? WHERE id = ?)').get(a.entidad, a.entidad_id) as { email: string | null } | undefined;
      if (worker?.email) email = worker.email;
    } else if (a.entidad === 'roles') {
      const role = db.prepare('SELECT u.email FROM roles r JOIN users u ON u.id = r.usuario_id WHERE r.id = ?').get(a.entidad_id) as { email: string | null } | undefined;
      if (role?.email) email = role.email;
    }
    
    if (!email) continue;
    if (!byEmail.has(email)) byEmail.set(email, []);
    byEmail.get(email)!.push(a);
  }
  
  const { buildAlertEmailHtml, buildAlertEmailText } = await import('./email.js');
  
  let enviadas = 0;
  let errores = 0;
  
  for (const [email, alertas] of byEmail) {
    const html = buildAlertEmailHtml(alertas);
    const text = buildAlertEmailText(alertas);
    
    const result = await import('./email.js').then(m => m.sendAlertEmail(transporter, email, `⚠️ SG-SST: ${alertas.length} alerta(s) de vencimiento`, html, text));
    if (result.success) {
      enviadas++;
      markAsSent(db, alertas.map(a => a.id));
    } else {
      errores++;
      console.error(`[SCHEDULER] Error enviando a ${email}:`, result.error);
    }
  }
  
  console.log(`[SCHEDULER] Enviados: ${enviadas}, Errores: ${errores}`);
}

async function sendWeeklySummary(db: any, transporter: any): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;
  
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN enviado = 0 THEN 1 ELSE 0 END) as pendientes,
      SUM(CASE WHEN enviado = 1 THEN 1 ELSE 0 END) as enviadas,
      SUM(CASE WHEN date(fecha_vencimiento) < date('now') AND enviado = 0 THEN 1 ELSE 0 END) as vencidas
    FROM alerts
  `).get() as any;
  
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; padding: 20px; background: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden;">
    <div style="background: #0f766e; color: white; padding: 20px; text-align: center;">
      <h1 style="margin: 0;">📊 Resumen Semanal SG-SST</h1>
      <p style="margin: 8px 0 0; opacity: 0.9;">Semana ${new Date().toISOString().slice(0,10)}</p>
    </div>
    <div style="padding: 24px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 10px; font-weight: bold;">Total alertas</td><td style="padding: 10px; text-align: right;">${stats.total}</td></tr>
        <tr style="background: #f9fafb;"><td style="padding: 10px; font-weight: bold;">Pendientes de envío</td><td style="padding: 10px; text-align: right; color: #f59e0b;">${stats.pendientes}</td></tr>
        <tr><td style="padding: 10px; font-weight: bold;">Enviadas esta semana</td><td style="padding: 10px; text-align: right; color: #10b981;">${stats.enviadas}</td></tr>
        <tr style="background: #f9fafb;"><td style="padding: 10px; font-weight: bold;">Vencidas sin enviar</td><td style="padding: 10px; text-align: right; color: #dc2626;">${stats.vencidas}</td></tr>
      </table>
      <p style="margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center;">
        Acceder al panel: <a href="${process.env.APP_URL || 'http://localhost:5173'}/alertas" style="color: #0f766e;">Ver alertas</a>
      </p>
    </div>
  </div>
</body>
</html>`;
  
  await import('./email.js').then(m => m.sendAlertEmail(transporter, adminEmail, '📊 Resumen Semanal SG-SST', html, `Resumen semanal SG-SST: Total ${stats.total}, Pendientes ${stats.pendientes}, Enviadas ${stats.enviadas}, Vencidas ${stats.vencidas}`));
}