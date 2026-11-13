import { useCallback, useEffect, useState } from 'react';

import { Bell, CheckCheck, RefreshCw } from 'lucide-react';

import { api } from '../lib/api';

export default function Alertas() {
  const [activeTab, setActiveTab] = useState<'pendientes' | 'historial'>('pendientes');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [attendedAlerts, setAttendedAlerts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      if (activeTab === 'pendientes') {
        const [a, s] = await Promise.all([
          api.get('/alerts?enviado=0&limit=200'),
          api.get('/alerts/stats'),
        ]);
        setAlerts(a);
        setStats(s);
      } else {
        const a = await api.get('/alerts?enviado=1&limit=200');
        setAttendedAlerts(a);
      }
    } catch (err: any) {
      setError(err.message || 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showToast = (msg: string, isError = false) => {
    if (isError) setError(msg);
    else setSuccess(msg);
    setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 4000);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(alerts.map((a) => a.id));
    else setSelectedIds([]);
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((i) => i !== id)));
  };

  const markAsAttended = async (ids: string[]) => {
    if (!ids.length) return showToast('Seleccione al menos una alerta', true);
    try {
      setSending(true);
      await api.post('/alerts/mark-sent', { ids });
      showToast(`${ids.length} alerta(s) marcada(s) como atendida(s)`);
      setSelectedIds([]);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error', true);
    } finally {
      setSending(false);
    }
  };

  const handleMarkSelected = () => markAsAttended(selectedIds);

  const handleMarkAll = () => markAsAttended(alerts.map((a) => a.id));

  const handleGenerate = async () => {
    try {
      setSending(true);
      const res = await api.post('/alerts/generate');
      showToast(`${res.generadas} alerta(s) generada(s)`);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error', true);
    } finally {
      setSending(false);
    }
  };

  const getPrioridadBadge = (p: string) => {
    const clases: Record<string, string> = {
      critica: 'ui-badge ui-badge--danger',
      alta: 'ui-badge ui-badge--warn',
      media: 'ui-badge ui-badge--info',
    };
    return <span className={clases[p] || 'ui-badge'}>{p.toUpperCase()}</span>;
  };

  const getTipoLabel = (t: string) => {
    const labels: Record<string, string> = {
      examen: 'Examen médico',
      certificado: 'Certificado',
      licencia_sst: 'Licencia SST',
      curso_50h: 'Curso de 50 horas',
      inspeccion: 'Inspección',
      plan: 'Plan anual',
      documento: 'Documento',
    };
    return labels[t] || t;
  };

  return (
    <div className="ui-page alerts-page">
      <div className="ui-page-header">
        <h1 className="ui-page-title">Alertas y recordatorios de vencimiento</h1>
      </div>

      {success && <div className="ui-feedback ui-feedback--success">{success}</div>}
      {error && <div className="ui-feedback ui-feedback--error">{error}</div>}

      {/* Tabs */}
      <div aria-label="Secciones de alertas" className="ui-tabs alerts-tabs" role="tablist">
        {[
          {
            id: 'pendientes',
            label: `Pendientes ${stats?.pendientes ? `(${stats.pendientes})` : ''}`,
            icon: Bell,
          },
          {
            id: 'historial',
            label: `Atendidas ${attendedAlerts.length ? `(${attendedAlerts.length})` : ''}`,
            icon: CheckCheck,
          },
        ].map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className="ui-tab"
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'pendientes' | 'historial')}
            role="tab"
            type="button"
          >
            <tab.icon aria-hidden="true" size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: PENDIENTES */}
      {activeTab === 'pendientes' && (
        <div>
          {/* Resumen */}
          {stats && (
            <div className="ui-kpi-grid">
              <div className="ui-kpi ui-kpi--warn">
                <div className="ui-kpi-label">Pendientes</div>
                <div className="ui-kpi-value">{stats.pendientes}</div>
              </div>
              <div className="ui-kpi ui-kpi--ok">
                <div className="ui-kpi-label">Atendidas</div>
                <div className="ui-kpi-value">{stats.enviadas}</div>
              </div>
              <div className="ui-kpi ui-kpi--danger">
                <div className="ui-kpi-label">Vencidas</div>
                <div className="ui-kpi-value">{stats.vencidas}</div>
              </div>
              <div className="ui-kpi">
                <div className="ui-kpi-label">Total</div>
                <div className="ui-kpi-value">{stats.total}</div>
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="alerts-actions">
            <button
              className="ui-primary-button"
              disabled={loading || sending}
              onClick={handleGenerate}
              type="button"
            >
              <RefreshCw aria-hidden="true" size={16} />
              {loading ? 'Generando...' : 'Generar alertas'}
            </button>
            <button
              className="ui-primary-button alerts-button--ok"
              disabled={!alerts.length || sending}
              onClick={handleMarkAll}
              type="button"
            >
              <CheckCheck aria-hidden="true" size={16} />
              {sending ? 'Marcando...' : `Marcar todas como atendidas (${alerts.length})`}
            </button>
            {selectedIds.length > 0 && (
              <button
                className="ui-primary-button alerts-button--info"
                disabled={sending}
                onClick={handleMarkSelected}
                type="button"
              >
                <CheckCheck aria-hidden="true" size={16} />
                Marcar {selectedIds.length} como atendida(s)
              </button>
            )}
          </div>

          {/* Tabla */}
          <div className="ui-surface ui-table-wrap alerts-table-desktop">
            <table className="ui-table alerts-table">
              <thead>
                <tr>
                  <th className="alerts-table-check">
                    <input
                      aria-label="Seleccionar todas las alertas"
                      checked={selectedIds.length === alerts.length && alerts.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      type="checkbox"
                    />
                  </th>
                  <th>Tipo</th>
                  <th>Trabajador / Ítem</th>
                  <th>Vence</th>
                  <th>Prioridad</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id}>
                    <td className="alerts-table-check">
                      <input
                        aria-label={`Seleccionar fila de ${a.worker_nombre || a.item_nombre || a.entidad}`}
                        checked={selectedIds.includes(a.id)}
                        onChange={(e) => handleSelectOne(a.id, e.target.checked)}
                        type="checkbox"
                      />
                    </td>
                    <td>{getTipoLabel(a.tipo)}</td>
                    <td>
                      {a.worker_nombre
                        ? `${a.worker_nombre} ${a.worker_apellido}`
                        : a.item_nombre || a.entidad}
                    </td>
                    <td>{a.fecha_vencimiento}</td>
                    <td>{getPrioridadBadge(a.prioridad)}</td>
                    <td>{a.detalle || '—'}</td>
                  </tr>
                ))}
                {alerts.length === 0 && (
                  <tr>
                    <td className="alerts-empty-cell" colSpan={6}>
                      No hay alertas pendientes
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div aria-label="Alertas pendientes" className="alerts-mobile-list">
            {alerts.map((alert) => (
              <article className="alerts-mobile-card" key={alert.id}>
                <div className="alerts-mobile-card-header">
                  <label className="alerts-mobile-select">
                    <input
                      aria-label={`Seleccionar alerta de ${alert.worker_nombre || alert.item_nombre || alert.entidad}`}
                      checked={selectedIds.includes(alert.id)}
                      onChange={(event) => handleSelectOne(alert.id, event.target.checked)}
                      type="checkbox"
                    />
                    <span>{getTipoLabel(alert.tipo)}</span>
                  </label>
                  {getPrioridadBadge(alert.prioridad)}
                </div>
                <h2>
                  {alert.worker_nombre
                    ? `${alert.worker_nombre} ${alert.worker_apellido}`
                    : alert.item_nombre || alert.entidad}
                </h2>
                <dl>
                  <div>
                    <dt>Vence</dt>
                    <dd>{alert.fecha_vencimiento}</dd>
                  </div>
                  <div>
                    <dt>Detalle</dt>
                    <dd>{alert.detalle || 'Sin detalle adicional'}</dd>
                  </div>
                </dl>
              </article>
            ))}
            {alerts.length === 0 && (
              <p className="alerts-mobile-empty">No hay alertas pendientes</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: HISTORIAL ATENDIDAS */}
      {activeTab === 'historial' && (
        <div className="ui-surface ui-table-wrap alerts-table-desktop">
          <table className="ui-table alerts-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Trabajador / Ítem</th>
                <th>Vencía</th>
                <th>Prioridad</th>
                <th>Atendida</th>
              </tr>
            </thead>
            <tbody>
              {attendedAlerts.map((a) => (
                <tr key={a.id}>
                  <td>{getTipoLabel(a.tipo)}</td>
                  <td>
                    {a.worker_nombre
                      ? `${a.worker_nombre} ${a.worker_apellido}`
                      : a.item_nombre || a.entidad}
                  </td>
                  <td>{a.fecha_vencimiento}</td>
                  <td>{getPrioridadBadge(a.prioridad)}</td>
                  <td>{a.enviado_en ? new Date(a.enviado_en).toLocaleString('es-CO') : '—'}</td>
                </tr>
              ))}
              {attendedAlerts.length === 0 && (
                <tr>
                  <td className="alerts-empty-cell" colSpan={5}>
                    No hay alertas atendidas aún
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {activeTab === 'historial' && (
        <div aria-label="Alertas atendidas" className="alerts-mobile-list">
          {attendedAlerts.map((alert) => (
            <article className="alerts-mobile-card" key={alert.id}>
              <div className="alerts-mobile-card-header">
                <span>{getTipoLabel(alert.tipo)}</span>
                {getPrioridadBadge(alert.prioridad)}
              </div>
              <h2>
                {alert.worker_nombre
                  ? `${alert.worker_nombre} ${alert.worker_apellido}`
                  : alert.item_nombre || alert.entidad}
              </h2>
              <dl>
                <div>
                  <dt>Vencía</dt>
                  <dd>{alert.fecha_vencimiento}</dd>
                </div>
                <div>
                  <dt>Atendida</dt>
                  <dd>
                    {alert.enviado_en
                      ? new Date(alert.enviado_en).toLocaleString('es-CO')
                      : 'Sin fecha registrada'}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
          {attendedAlerts.length === 0 && (
            <p className="alerts-mobile-empty">No hay alertas atendidas aún</p>
          )}
        </div>
      )}
    </div>
  );
}
