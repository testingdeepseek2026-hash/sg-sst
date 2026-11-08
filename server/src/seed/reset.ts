import { openDb, runMigrations } from '../lib/db.js';

async function main() {
  const db = openDb();
  runMigrations(db);
  db.exec(
    `DELETE FROM alerts;
     DELETE FROM corrective_actions;
     DELETE FROM drills;
     DELETE FROM emergency_plans;
     DELETE FROM incidents;
     DELETE FROM ats;
     DELETE FROM altura_permits;
     DELETE FROM inspections;
     DELETE FROM training_attendance;
     DELETE FROM trainings;
     DELETE FROM training_schedule;
     DELETE FROM annual_plan;
     DELETE FROM standard_assessments;
     DELETE FROM standards;
     DELETE FROM hazard_assessments;
     DELETE FROM hazard_catalog;
     DELETE FROM worker_epp;
     DELETE FROM worker_certs;
     DELETE FROM worker_exams;
     DELETE FROM consents;
     DELETE FROM workers;
     DELETE FROM roles;
     DELETE FROM objectives;
     DELETE FROM policies;
     DELETE FROM audit_logs;
     DELETE FROM users;
     DELETE FROM companies;
     DELETE FROM contractors;
     DELETE FROM audits;
     DELETE FROM documents;
     DELETE FROM indicators;`
  );
  console.log('Base de datos reseteada.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
