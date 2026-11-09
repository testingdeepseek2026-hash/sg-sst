import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  FilePlus2,
  ListChecks,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

import { api } from '../lib/api';

interface ComplianceSummary {
  total?: number;
  cumplidos?: number;
  incumplidos?: number;
  porcentaje?: number;
}

interface ActionSummary {
  id: string | number;
  descripcion: string;
  estado: string;
  fecha_limite?: string | null;
}

interface IncidentSummary {
  id: string | number;
  tipo: string;
  descripcion: string;
  estado: string;
}

interface MetricCardProps {
  detail: string;
  icon: LucideIcon;
  label: string;
  to: string;
  value: number;
}

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  completada: 'Completada',
  abierto: 'Abierto',
  investigando: 'En investigación',
  cerrado: 'Cerrado',
};

const DASHBOARD_SHORTCUTS = [
  { to: '/trabajadores', label: 'Trabajadores', icon: UsersRound },
  { to: '/estandar', label: 'Estándares mínimos', icon: ClipboardCheck },
  { to: '/planes', label: 'Plan anual', icon: CalendarDays },
  { to: '/incidentes', label: 'Registrar incidente', icon: FilePlus2 },
];

function getStatusLabel(status: string) {
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

function formatDate(value: string) {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return date ? `${date[3]}/${date[2]}/${date[1]}` : value;
}

function MetricCard({ detail, icon: Icon, label, to, value }: MetricCardProps) {
  return (
    <article className="ui-surface dashboard-metric">
      <div className="dashboard-metric-heading">
        <Icon aria-hidden="true" size={18} />
        <span>{label}</span>
      </div>
      <strong className="dashboard-metric-value">{value}</strong>
      <p className="dashboard-metric-detail">{detail}</p>
      <Link className="dashboard-card-link" to={to}>
        Ver módulo <ArrowRight aria-hidden="true" size={15} />
      </Link>
    </article>
  );
}

function DashboardShortcuts() {
  return (
    <div className="dashboard-quick-links">
      {DASHBOARD_SHORTCUTS.map(({ icon: Icon, label, to }) => (
        <Link className="dashboard-quick-link" key={to} to={to}>
          <Icon aria-hidden="true" size={18} />
          {label}
          <ArrowRight aria-hidden="true" size={15} />
        </Link>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [std, setStd] = useState<ComplianceSummary | null>(null);
  const [workers, setWorkers] = useState<unknown[]>([]);
  const [actions, setActions] = useState<ActionSummary[]>([]);
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [compliance, workerList, actionList, incidentList] = await Promise.all([
          api.get('/standards/cumplimiento'),
          api.get('/workers'),
          api.get('/actions'),
          api.get('/incidents'),
        ]);
        setStd(compliance);
        setWorkers(workerList);
        setActions(actionList);
        setIncidents(incidentList);
      } catch (err) {
        console.error('Error cargando datos del dashboard:', err);
        setError(err instanceof Error ? err.message : 'No fue posible cargar los datos.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="ui-page dashboard-page" role="status">
        Cargando tablero...
      </div>
    );
  }

  if (error) {
    return (
      <div className="ui-page dashboard-page">
        <section
          aria-labelledby="dashboard-error-title"
          className="ui-surface dashboard-feedback"
          role="alert"
        >
          <div className="dashboard-feedback-icon dashboard-feedback-icon--error">
            <AlertTriangle aria-hidden="true" size={22} />
          </div>
          <h1 className="ui-page-title" id="dashboard-error-title">
            No fue posible cargar el tablero
          </h1>
          <p className="ui-page-description">{error}</p>
          <button
            className="ui-primary-button"
            onClick={() => window.location.reload()}
            type="button"
          >
            Intentar de nuevo
          </button>
        </section>
      </div>
    );
  }

  if (!std && !workers.length && !actions.length && !incidents.length) {
    return (
      <div className="ui-page dashboard-page">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">Inicio</p>
            <h1 className="ui-page-title">Bienvenido al Tablero SG-SST</h1>
            <p className="ui-page-description">
              Aún no hay datos registrados. Elige un módulo para comenzar a organizar la información
              del sistema.
            </p>
          </div>
        </header>

        <section aria-labelledby="dashboard-empty-title" className="ui-surface dashboard-empty">
          <div className="dashboard-empty-icon">
            <ClipboardCheck aria-hidden="true" size={24} />
          </div>
          <div>
            <h2 id="dashboard-empty-title">Empieza por registrar la información básica</h2>
            <p>Los indicadores aparecerán aquí cuando haya datos disponibles.</p>
          </div>
          <DashboardShortcuts />
        </section>
      </div>
    );
  }

  const pendingActions = actions.filter(
    (action) => action.estado === 'pendiente' || action.estado === 'en_proceso'
  );
  const openIncidents = incidents.filter((incident) => incident.estado !== 'cerrado');
  const hasEvaluation = (std?.total ?? 0) > 0;
  const percentage =
    typeof std?.porcentaje === 'number' && Number.isFinite(std.porcentaje) ? std.porcentaje : null;
  const progressWidth = Math.min(100, Math.max(0, percentage ?? 0));

  return (
    <div className="ui-page dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">Inicio</p>
          <h1 className="ui-page-title">Tablero de Control SG-SST</h1>
          <p className="ui-page-description">
            Un resumen de la información registrada y de los módulos que puedes revisar.
          </p>
        </div>
        <Link className="ui-primary-button dashboard-header-action" to="/planes">
          <CalendarDays aria-hidden="true" size={17} />
          Ver plan anual
        </Link>
      </header>

      <section aria-label="Indicadores principales" className="dashboard-overview">
        <article className="ui-surface dashboard-compliance">
          <div className="dashboard-compliance-heading">
            <div className="dashboard-compliance-icon">
              <ClipboardCheck aria-hidden="true" size={20} />
            </div>
            <div>
              <p className="dashboard-eyebrow">Estándares mínimos</p>
              <h2>Avance registrado</h2>
            </div>
          </div>
          {!hasEvaluation ? (
            <p className="dashboard-compliance-empty" role="status">
              No hay una evaluación de estándares registrada.
            </p>
          ) : percentage === null ? (
            <p className="dashboard-compliance-empty" role="status">
              Hay estándares evaluados, pero no se reportó el porcentaje de avance.
            </p>
          ) : (
            <>
              <p className="dashboard-compliance-value">{percentage}%</p>
              <div
                aria-label={`Avance reportado: ${percentage}%`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={progressWidth}
                className="dashboard-progress"
                role="progressbar"
              >
                <span style={{ width: `${progressWidth}%` }} />
              </div>
              <p className="dashboard-compliance-detail">
                {std?.cumplidos ?? 0} de {std?.total ?? 0} estándares evaluados como cumplidos
              </p>
            </>
          )}
          <Link className="dashboard-card-link" to="/estandar">
            Revisar estándares <ArrowRight aria-hidden="true" size={15} />
          </Link>
        </article>

        <div className="dashboard-metrics">
          <MetricCard
            detail="En el sistema"
            icon={UsersRound}
            label="Trabajadores"
            to="/trabajadores"
            value={workers.length}
          />
          <MetricCard
            detail="Pendientes o en proceso"
            icon={ListChecks}
            label="Acciones abiertas"
            to="/acciones"
            value={pendingActions.length}
          />
          <MetricCard
            detail="Sin cerrar"
            icon={AlertTriangle}
            label="Incidentes abiertos"
            to="/incidentes"
            value={openIncidents.length}
          />
        </div>
      </section>

      <section aria-label="Accesos rápidos" className="dashboard-shortcuts">
        <DashboardShortcuts />
      </section>

      <section aria-label="Actividad reciente" className="dashboard-section-grid">
        <article className="ui-surface dashboard-panel">
          <header className="dashboard-panel-header">
            <div>
              <p className="dashboard-eyebrow">Seguimiento</p>
              <h2>Acciones recientes</h2>
            </div>
            <Link className="dashboard-panel-link" to="/acciones">
              Ver todas <ArrowRight aria-hidden="true" size={15} />
            </Link>
          </header>
          {actions.length ? (
            <ul className="dashboard-record-list">
              {actions.slice(0, 5).map((action) => (
                <li className="dashboard-record" key={action.id}>
                  <div className="dashboard-record-content">
                    <strong>{action.descripcion}</strong>
                    {action.fecha_limite && (
                      <span className="dashboard-record-detail">
                        Fecha límite: {formatDate(action.fecha_limite)}
                      </span>
                    )}
                  </div>
                  <span className={`dashboard-status dashboard-status--${action.estado}`}>
                    {getStatusLabel(action.estado)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="dashboard-panel-empty">
              <p>No hay acciones registradas.</p>
              <Link to="/acciones">Revisar acciones correctivas</Link>
            </div>
          )}
        </article>

        <article className="ui-surface dashboard-panel">
          <header className="dashboard-panel-header">
            <div>
              <p className="dashboard-eyebrow">Registro</p>
              <h2>Últimos incidentes</h2>
            </div>
            <Link className="dashboard-panel-link" to="/incidentes">
              Ver todos <ArrowRight aria-hidden="true" size={15} />
            </Link>
          </header>
          {incidents.length ? (
            <ul className="dashboard-record-list">
              {incidents.slice(0, 5).map((incident) => (
                <li className="dashboard-record" key={incident.id}>
                  <div className="dashboard-record-content">
                    <strong>{incident.tipo}</strong>
                    <span className="dashboard-record-detail">{incident.descripcion}</span>
                  </div>
                  <span className={`dashboard-status dashboard-status--${incident.estado}`}>
                    {getStatusLabel(incident.estado)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="dashboard-panel-empty">
              <p>No hay incidentes registrados.</p>
              <Link to="/incidentes">Abrir módulo de incidentes</Link>
            </div>
          )}
        </article>
      </section>

      <section
        aria-labelledby="dashboard-compliance-detail"
        className="ui-surface dashboard-summary"
      >
        <div>
          <p className="dashboard-eyebrow">Estándares mínimos</p>
          <h2 id="dashboard-compliance-detail">Detalle del registro</h2>
        </div>
        <dl className="dashboard-summary-list">
          <div>
            <dt>Evaluados</dt>
            <dd>{std?.total ?? '—'}</dd>
          </div>
          <div>
            <dt>Cumplidos</dt>
            <dd className="dashboard-summary-success">{std?.cumplidos ?? '—'}</dd>
          </div>
          <div>
            <dt>Incumplidos</dt>
            <dd className="dashboard-summary-danger">{std?.incumplidos ?? '—'}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
