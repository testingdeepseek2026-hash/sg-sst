import { Fragment, useCallback, useEffect, useState } from 'react';

import { Download, Eraser, ShieldCheck } from 'lucide-react';

import { api } from '@/lib/api';

interface AuditLog {
  id: string;
  usuario_id: string | null;
  usuario_email: string | null;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  valores_anteriores: string | null;
  valores_nuevos: string | null;
  ip: string | null;
  creado_en: string;
}

interface AuditStats {
  total: number;
  porEntidad: { entidad: string; c: number }[];
  porAccion: { accion: string; c: number }[];
  porUsuario: { usuario_email: string; c: number }[];
}

interface Filters {
  entidad: string;
  accion: string;
  usuario_id: string;
  desde: string;
  hasta: string;
}

const INITIAL_FILTERS: Filters = {
  entidad: '',
  accion: '',
  usuario_id: '',
  desde: '',
  hasta: '',
};

const ACCION_LABELS: Record<string, string> = {
  crear: 'Crear',
  editar: 'Editar',
  eliminar: 'Eliminar',
  firmar: 'Firmar',
  importar: 'Importar',
  exportar: 'Exportar',
  login: 'Inicio de sesión',
  logout: 'Cierre de sesión',
};

const buildParams = (filters: Filters, limit: number, offset: number) => {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (filters.entidad) params.append('entidad', filters.entidad);
  if (filters.accion) params.append('accion', filters.accion);
  if (filters.usuario_id) params.append('usuario_id', filters.usuario_id);
  if (filters.desde) params.append('desde', filters.desde);
  if (filters.hasta) params.append('hasta', filters.hasta);
  return params;
};

export default function Bitacora() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `/audit-logs?${buildParams(filters, limit, page * limit).toString()}`
      );
      setLogs(res.logs as AuditLog[]);
      setTotal(res.total as number);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error cargando la bitácora' });
    } finally {
      setLoading(false);
    }
  }, [filters, limit, page]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/audit-logs/stats');
      setStats(res as AuditStats);
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [fetchLogs, fetchStats]);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters(INITIAL_FILTERS);
    setPage(0);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

  const parseJsonSafe = (str: string | null) => {
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  };

  const exportLogs = async () => {
    try {
      const res = await api.get(`/audit-logs?${buildParams(filters, 10000, 0).toString()}`);
      const rows = (res.logs as AuditLog[]).map((log) => [
        log.id,
        formatDate(log.creado_en),
        log.usuario_id || '—',
        log.usuario_email || '—',
        log.accion,
        log.entidad,
        log.entidad_id || '—',
        log.ip || '—',
      ]);
      const headers = ['ID', 'Fecha', 'Usuario', 'Email', 'Acción', 'Entidad', 'Entidad ID', 'IP'];
      const csv = [
        headers.join(','),
        ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `bitacora_auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      setMessage({ type: 'success', text: 'Bitácora exportada correctamente' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al exportar la bitácora' });
    }
  };

  const kpis = [
    { label: 'Total registros', value: stats?.total ?? 0 },
    { label: 'Entidades afectadas', value: stats?.porEntidad.length ?? 0 },
    { label: 'Tipos de acción', value: stats?.porAccion.length ?? 0 },
    { label: 'Usuarios activos', value: stats?.porUsuario.length ?? 0 },
  ];

  const renderValue = (str: string | null) => {
    const parsed = parseJsonSafe(str);
    return parsed === null || parsed === undefined ? '—' : JSON.stringify(parsed, null, 2);
  };

  const detalle = (log: AuditLog) => (
    <div className="bitacora-detail">
      <div className="bitacora-detail-col">
        <span className="bitacora-detail-label">Valores anteriores</span>
        <pre className="bitacora-detail-pre">{renderValue(log.valores_anteriores)}</pre>
      </div>
      <div className="bitacora-detail-col">
        <span className="bitacora-detail-label">Valores nuevos</span>
        <pre className="bitacora-detail-pre">{renderValue(log.valores_nuevos)}</pre>
      </div>
    </div>
  );

  return (
    <div className="ui-page bitacora-page">
      <header className="ui-page-header bitacora-page-header">
        <div>
          <h1 className="ui-page-title">Bitácora de Auditoría (Trazabilidad)</h1>
          <p className="ui-page-description">
            Registro de cambios: quién, qué y cuándo. Los datos sensibles se protegen conforme a la
            Ley 1581/2012.
          </p>
        </div>
        <button type="button" className="ui-primary-button" onClick={exportLogs}>
          <Download aria-hidden="true" size={18} />
          Exportar CSV
        </button>
      </header>

      {message && (
        <div
          className={`ui-feedback ui-feedback--${message.type}`}
          role={message.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {message.text}
        </div>
      )}

      <section aria-label="Resumen de la bitácora" className="ui-kpi-grid">
        {kpis.map((k) => (
          <div className="ui-kpi" key={k.label}>
            <span className="ui-kpi-label">{k.label}</span>
            <span className="ui-kpi-value">{k.value.toLocaleString()}</span>
          </div>
        ))}
      </section>

      <section aria-label="Filtros de la bitácora" className="ui-surface bitacora-filters">
        <div className="bitacora-filters-grid">
          <div>
            <label className="ui-field-label" htmlFor="filter-entidad">
              Entidad
            </label>
            <select
              id="filter-entidad"
              value={filters.entidad}
              onChange={(e) => handleFilterChange('entidad', e.target.value)}
            >
              <option value="">Todas</option>
              {stats?.porEntidad.map((e) => (
                <option key={e.entidad} value={e.entidad}>
                  {e.entidad} ({e.c})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="ui-field-label" htmlFor="filter-accion">
              Acción
            </label>
            <select
              id="filter-accion"
              value={filters.accion}
              onChange={(e) => handleFilterChange('accion', e.target.value)}
            >
              <option value="">Todas</option>
              {stats?.porAccion.map((a) => (
                <option key={a.accion} value={a.accion}>
                  {ACCION_LABELS[a.accion] ?? a.accion} ({a.c})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="ui-field-label" htmlFor="filter-usuario">
              Usuario
            </label>
            <select
              id="filter-usuario"
              value={filters.usuario_id}
              onChange={(e) => handleFilterChange('usuario_id', e.target.value)}
            >
              <option value="">Todos</option>
              {stats?.porUsuario.map((u) => (
                <option key={u.usuario_email} value={u.usuario_email}>
                  {u.usuario_email} ({u.c})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="ui-field-label" htmlFor="filter-desde">
              Desde
            </label>
            <input
              id="filter-desde"
              type="date"
              value={filters.desde}
              onChange={(e) => handleFilterChange('desde', e.target.value)}
            />
          </div>
          <div>
            <label className="ui-field-label" htmlFor="filter-hasta">
              Hasta
            </label>
            <input
              id="filter-hasta"
              type="date"
              value={filters.hasta}
              onChange={(e) => handleFilterChange('hasta', e.target.value)}
            />
          </div>
        </div>
        <div className="bitacora-filters-actions">
          <button type="button" className="ui-action-button" onClick={clearFilters}>
            <Eraser aria-hidden="true" size={16} />
            Limpiar
          </button>
        </div>
      </section>

      <section aria-label="Registros de auditoría">
        {loading ? (
          <p className="ui-empty">Cargando bitácora...</p>
        ) : (
          <>
            <div className="ui-surface ui-table-wrap">
              <table className="ui-table bitacora-table">
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Usuario</th>
                    <th scope="col">Acción</th>
                    <th scope="col">Entidad</th>
                    <th scope="col">ID entidad</th>
                    <th scope="col">IP</th>
                    <th scope="col">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <Fragment key={log.id}>
                      <tr key={log.id}>
                        <td>{formatDate(log.creado_en)}</td>
                        <td>
                          <strong>{log.usuario_id || 'Sistema'}</strong>
                          <span className="bitacora-sub">{log.usuario_email || '—'}</span>
                        </td>
                        <td>
                          <span className="ui-badge">
                            {ACCION_LABELS[log.accion] ?? log.accion}
                          </span>
                        </td>
                        <td>{log.entidad}</td>
                        <td>{log.entidad_id || '—'}</td>
                        <td>{log.ip || '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="ui-action-button"
                            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          >
                            {expandedId === log.id ? 'Ocultar' : 'Ver cambios'}
                          </button>
                        </td>
                      </tr>
                      {expandedId === log.id && (
                        <tr key={`${log.id}-detalle`}>
                          <td colSpan={7}>{detalle(log)}</td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="ui-empty">
                        No hay registros de auditoría con los filtros actuales
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="ui-mobile-list">
              {logs.length === 0 && (
                <p className="ui-empty">No hay registros de auditoría con los filtros actuales</p>
              )}
              {logs.map((log) => (
                <article className="ui-surface ui-mobile-card" key={log.id}>
                  <header className="ui-mobile-card-header">
                    <div>
                      <h2>{ACCION_LABELS[log.accion] ?? log.accion}</h2>
                      <p>{log.entidad}</p>
                    </div>
                    <span className="ui-badge">{formatDate(log.creado_en)}</span>
                  </header>
                  <dl className="ui-mobile-details">
                    <div>
                      <dt>Usuario</dt>
                      <dd>{log.usuario_id || 'Sistema'}</dd>
                    </div>
                    <div>
                      <dt>Correo</dt>
                      <dd>{log.usuario_email || '—'}</dd>
                    </div>
                    <div>
                      <dt>Entidad ID</dt>
                      <dd>{log.entidad_id || '—'}</dd>
                    </div>
                    <div>
                      <dt>IP</dt>
                      <dd>{log.ip || '—'}</dd>
                    </div>
                  </dl>
                  <div className="ui-mobile-actions">
                    <button
                      type="button"
                      className="ui-action-button"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                      {expandedId === log.id ? 'Ocultar cambios' : 'Ver cambios'}
                    </button>
                  </div>
                  {expandedId === log.id && detalle(log)}
                </article>
              ))}
            </div>

            {total > limit && (
              <div className="bitacora-pagination">
                <span className="bitacora-pagination-info">
                  Mostrando {page * limit + 1} - {Math.min((page + 1) * limit, total)} de {total}{' '}
                  registros
                </span>
                <div className="bitacora-pagination-actions">
                  <button
                    type="button"
                    className="ui-action-button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    className="ui-action-button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={(page + 1) * limit >= total}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <div className="bitacora-legal" role="note">
        <ShieldCheck aria-hidden="true" size={18} />
        <p>
          <strong>Ley 1581/2012 - Protección de Datos Personales:</strong> esta bitácora registra
          trazabilidad operativa. Los campos sensibles (datos médicos, restricciones, diagnósticos y
          archivos) se enmascaran automáticamente como{' '}
          <code>[DATO SENSIBLE - PROTEGIDO LEY 1581/2012]</code> en los valores anteriores y nuevos.
          Solo el administrador puede acceder a esta vista.
        </p>
      </div>
    </div>
  );
}
