import { CronJob } from 'cron';

import { generateAlerts } from '../services/alerts.js';
import { generateAlertsPg } from '../services/alerts.pg.js';
import { getBackupConfigFromEnv, runBackup } from '../services/backup.js';
import {
  checkPgBackupTarget,
  getPgBackupConfigFromEnv,
  runPgBackup,
} from '../services/backup.pg.js';

import { isPgBackend } from './db-pg.js';

let dailyJob: CronJob | null = null;
let backupJob: CronJob | null = null;

/**
 * Scheduler local: genera alertas de vencimiento en el panel y ejecuta el
 * respaldo diario. No envía correo ni resúmenes: las alertas se consultan y
 * marcan como atendidas dentro de la aplicación (despliegue local).
 */
export function startAlertScheduler(db: any): void {
  // En pruebas no se programan tareas.
  if (process.env.NODE_ENV === 'test') {
    console.log('[SCHEDULER] Deshabilitado (NODE_ENV=test)');
    return;
  }

  // Job diario de alertas: 07:00 America/Bogota. Solo escribe en la base;
  // el panel las muestra como pendientes.
  if (process.env.ALERTS_ENABLED === 'true') {
    dailyJob = new CronJob(
      '0 7 * * *',
      async () => {
        console.log('[SCHEDULER] Ejecutando generación diaria de alertas...');
        try {
          if (isPgBackend()) await generateAlertsPg();
          else generateAlerts(db);
          console.log('[SCHEDULER] Alertas generadas; disponibles en el panel (sin correo).');
        } catch (err: any) {
          console.error('[SCHEDULER] Error en job diario:', err.message);
        }
      },
      null,
      true,
      'America/Bogota'
    );
    console.log('[SCHEDULER] Alertas programadas: Diario 07:00 (America/Bogota), solo panel local');
  } else {
    console.log('[SCHEDULER] Alertas deshabilitadas (ALERTS_ENABLED!=true)');
  }

  // Job backup diario: 02:00 America/Bogota (hora de bajo uso).
  if (process.env.BACKUP_ENABLED === 'true') {
    if (isPgBackend()) {
      const backupConfig = getPgBackupConfigFromEnv();
      const target = checkPgBackupTarget(backupConfig);
      if (target.ok) {
        console.log(`[SCHEDULER] Destino de respaldo verificado: ${backupConfig.backupDir}`);
      } else {
        console.error(`[SCHEDULER] Advertencia de respaldo: ${target.error}`);
      }
      backupJob = new CronJob(
        '0 2 * * *',
        async () => {
          console.log('[SCHEDULER] Ejecutando respaldo PostgreSQL...');
          try {
            const result = await runPgBackup(backupConfig);
            if (result.success) {
              console.log(
                `[SCHEDULER] Respaldo PostgreSQL completado: ${result.file} (${result.deleted} antiguos eliminados)`
              );
            } else {
              console.error('[SCHEDULER] Error en respaldo PostgreSQL:', result.error);
            }
          } catch (err: any) {
            console.error('[SCHEDULER] Error en job backup PostgreSQL:', err.message);
          }
        },
        null,
        true,
        backupConfig.timezone
      );
      console.log(
        `[SCHEDULER] Backup PostgreSQL programado: Diario 02:00 (${backupConfig.timezone}), retención ${backupConfig.retentionDays} días, destino ${backupConfig.backupDir}`
      );
    } else {
      const backupConfig = getBackupConfigFromEnv();
      backupJob = new CronJob(
        '0 2 * * *',
        async () => {
          console.log('[SCHEDULER] Ejecutando respaldo diario...');
          try {
            const result = runBackup(backupConfig);
            if (result.success) {
              console.log(
                `[SCHEDULER] Respaldo completado: ${result.file} (${result.deleted} antiguos eliminados)`
              );
            } else {
              console.error('[SCHEDULER] Error en respaldo:', result.error);
            }
          } catch (err: any) {
            console.error('[SCHEDULER] Error en job backup:', err.message);
          }
        },
        null,
        true,
        backupConfig.timezone
      );
      console.log(
        `[SCHEDULER] Backup programado: Diario 02:00 (${backupConfig.timezone}), retención ${backupConfig.retentionDays} días`
      );
    }
  } else {
    console.log('[SCHEDULER] Backup deshabilitado (BACKUP_ENABLED!=true)');
  }
}

export function stopAlertScheduler(): void {
  if (dailyJob) {
    dailyJob.stop();
    dailyJob = null;
  }
  if (backupJob) {
    backupJob.stop();
    backupJob = null;
  }
  console.log('[SCHEDULER] Scheduler detenido');
}
