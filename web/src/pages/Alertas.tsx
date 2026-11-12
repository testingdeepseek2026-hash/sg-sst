import { useCallback, useEffect, useState } from 'react';

import { Bell, CheckCheck, Eye, FlaskConical, RefreshCw, Send, Settings } from 'lucide-react';

import { api } from '../lib/api';

export default function Alertas() {
  const [activeTab, setActiveTab] = useState<'pendientes' | 'historial' | 'config'>('pendientes');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sentAlerts, setSentAlerts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [smtpConfig, setSmtpConfig] = useState({
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
    smtp_from: '',
    alerts_enabled: false,
  });
  const [testEmail, setTestEmail] = useState('');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
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
      } else if (activeTab === 'historial') {
        const a = await api.get('/alerts?enviado=1&limit=200');
        setSentAlerts(a);
      } else if (activeTab === 'config') {
        const company = await api.get('/companies');
        if (company) {
          setSmtpConfig({
            smtp_host: company.smtp_host || '',
            smtp_port: String(company.smtp_port || 587),
            smtp_user: company.smtp_user || '',
            smtp_pass: company.smtp_pass || '',
            smtp_from: company.smtp_from || '',
            alerts_enabled: !!company.alerts_enabled,
          });
        }
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

  const handleSendSelected = async () => {
    if (!selectedIds.length) return showToast('Seleccione al menos una alerta', true);
    try {
      setSending(true);
      await api.post('/alerts/mark-sent', { ids: selectedIds });
      showToast(`${selectedIds.length} alerta(s) marcada(s) como enviada(s)`);
      setSelectedIds([]);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error', true);
    } finally {
      setSending(false);
    }
  };

  const handleSendAll = async () => {
    try {
      setSending(true);
      const res = await api.post('/alerts/send');
      showToast(`Enviadas: ${res.enviadas}, Errores: ${res.errores}`);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error', true);
    } finally {
      setSending(false);
    }
  };

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

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/companies', {
        ...smtpConfig,
        smtp_port: parseInt(smtpConfig.smtp_port, 10),
      });
      showToast('Configuración SMTP guardada');
    } catch (err: any) {
      showToast(err.message || 'Error guardando', true);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) return showToast('Ingrese email destino', true);
    try {
      setSending(true);
      const res = await api.get(`/alerts/test-email?to=${encodeURIComponent(testEmail)}`);
      if (res.success) showToast('Email de prueba enviado (ver consola si modo simulación)');
      else showToast(res.error || 'Error enviando', true);
    } catch (err: any) {
      showToast(err.message || 'Error', true);
    } finally {
      setSending(false);
    }
  };

  const handlePreview = async () => {
    try {
      const html = await api.get('/alerts/preview');
      setPreviewHtml(html);
    } catch (err: any) {
      showToast(err.message || 'Error', true);
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
            label: `Enviadas ${sentAlerts.length ? `(${sentAlerts.length})` : ''}`,
            icon: CheckCheck,
          },
          { id: 'config', label: 'Configuración', icon: Settings },
        ].map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className="ui-tab"
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
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
                <div className="ui-kpi-label">Enviadas</div>
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
              onClick={handleSendAll}
              type="button"
            >
              <Send aria-hidden="true" size={16} />
              {sending ? 'Enviando...' : `Enviar todas (${alerts.length})`}
            </button>
            {selectedIds.length > 0 && (
              <button
                className="ui-primary-button alerts-button--info"
                disabled={sending}
                onClick={handleSendSelected}
                type="button"
              >
                <CheckCheck aria-hidden="true" size={16} />
                Marcar {selectedIds.length} como enviada(s)
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

      {/* TAB 2: HISTORIAL ENVIADAS */}
      {activeTab === 'historial' && (
        <div className="ui-surface ui-table-wrap alerts-table-desktop">
          <table className="ui-table alerts-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Trabajador / Ítem</th>
                <th>Vencía</th>
                <th>Prioridad</th>
                <th>Enviada</th>
              </tr>
            </thead>
            <tbody>
              {sentAlerts.map((a) => (
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
              {sentAlerts.length === 0 && (
                <tr>
                  <td className="alerts-empty-cell" colSpan={5}>
                    No hay alertas enviadas aún
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {activeTab === 'historial' && (
        <div aria-label="Alertas enviadas" className="alerts-mobile-list">
          {sentAlerts.map((alert) => (
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
                  <dt>Enviada</dt>
                  <dd>
                    {alert.enviado_en
                      ? new Date(alert.enviado_en).toLocaleString('es-CO')
                      : 'Sin fecha registrada'}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
          {sentAlerts.length === 0 && (
            <p className="alerts-mobile-empty">No hay alertas enviadas aún</p>
          )}
        </div>
      )}

      {/* TAB 3: CONFIGURACIÓN */}
      {activeTab === 'config' && (
        <div className="alerts-config">
          <div className="ui-surface alerts-config-card">
            <h2 className="alerts-config-title">Configuración SMTP para Alertas</h2>
            <p className="alerts-config-help">
              Configure el servidor de correo para envío automático de alertas. Si deja campos
              vacíos, el sistema funcionará en <strong>modo simulación</strong> (logs en consola).
            </p>

            <form onSubmit={handleSaveSmtp}>
              <div className="ui-form-grid">
                <div>
                  <label className="ui-field-label" htmlFor="alertas-host">
                    Servidor SMTP (Host) *
                  </label>
                  <input
                    id="alertas-host"
                    value={smtpConfig.smtp_host}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_host: e.target.value })}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="alertas-puerto">
                    Puerto *
                  </label>
                  <input
                    id="alertas-puerto"
                    type="number"
                    value={smtpConfig.smtp_port}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_port: e.target.value })}
                    placeholder="587"
                  />
                </div>
              </div>
              <div>
                <label className="ui-field-label" htmlFor="alertas-usuario">
                  Usuario *
                </label>
                <input
                  id="alertas-usuario"
                  type="email"
                  value={smtpConfig.smtp_user}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_user: e.target.value })}
                  placeholder="alertas@empresa.com"
                />
              </div>
              <div>
                <label className="ui-field-label" htmlFor="alertas-password">
                  Contraseña / App Password *
                </label>
                <input
                  id="alertas-password"
                  type="password"
                  value={smtpConfig.smtp_pass}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_pass: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="ui-field-label" htmlFor="alertas-from">
                  Remitente (From) *
                </label>
                <input
                  id="alertas-from"
                  value={smtpConfig.smtp_from}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_from: e.target.value })}
                  placeholder="SG-SST Alertas <alertas@empresa.com>"
                />
              </div>
              <label className="alerts-config-switch" htmlFor="alertas-enabled">
                <input
                  id="alertas-enabled"
                  type="checkbox"
                  checked={smtpConfig.alerts_enabled}
                  onChange={(e) =>
                    setSmtpConfig({ ...smtpConfig, alerts_enabled: e.target.checked })
                  }
                />
                <span>Activar scheduler automático (diario 07:00, semanal lunes 08:00)</span>
              </label>
              <div className="ui-form-actions">
                <button className="ui-primary-button" type="submit">
                  Guardar configuración
                </button>
              </div>
            </form>
          </div>

          <div className="ui-surface alerts-config-card">
            <h2 className="alerts-config-title">Pruebas y Previsualización</h2>
            <div className="alerts-config-row">
              <div className="alerts-config-test">
                <label className="ui-field-label" htmlFor="alertas-test-email">
                  Email destino para prueba
                </label>
                <input
                  id="alertas-test-email"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="admin@empresa.com"
                />
              </div>
              <button
                className="ui-primary-button alerts-button--info"
                disabled={!testEmail || sending}
                onClick={handleTestEmail}
                type="button"
              >
                <FlaskConical aria-hidden="true" size={16} />
                {sending ? 'Enviando...' : 'Enviar email de prueba'}
              </button>
              <button
                className="ui-action-button"
                disabled={sending}
                onClick={handlePreview}
                type="button"
              >
                <Eye aria-hidden="true" size={16} />
                Previsualizar resumen diario
              </button>
            </div>
            {previewHtml && (
              <div className="alerts-preview">
                <div className="alerts-preview-bar">Vista previa (HTML)</div>
                <iframe
                  className="alerts-preview-frame"
                  srcDoc={previewHtml}
                  title="Previsualización de alerta"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
