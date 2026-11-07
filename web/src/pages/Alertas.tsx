import { useEffect, useState } from 'react';

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
    alerts_enabled: false
  });
  const [testEmail, setTestEmail] = useState('');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'pendientes') {
        const [a, s] = await Promise.all([
          api.get('/alerts?enviado=0&limit=200'),
          api.get('/alerts/stats')
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
            alerts_enabled: !!company.alerts_enabled
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string, isError = false) => {
    if (isError) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(null); setSuccess(null); }, 4000);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(alerts.map(a => a.id));
    else setSelectedIds([]);
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
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
      await api.post('/companies', { ...smtpConfig, smtp_port: parseInt(smtpConfig.smtp_port, 10) });
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
    const colors: Record<string, { bg: string; text: string }> = {
      critica: { bg: '#fee2e2', text: '#991b1b' },
      alta: { bg: '#fef3c7', text: '#92400e' },
      media: { bg: '#dbeafe', text: '#1e40af' }
    };
    const c = colors[p] || { bg: '#f3f4f6', text: '#374151' };
    return <span style={{ background: c.bg, color: c.text, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold' }}>{p.toUpperCase()}</span>;
  };

  const getTipoLabel = (t: string) => {
    const labels: Record<string, string> = {
      examen: '🩺 Examen Médico',
      certificado: '📜 Certificado',
      licencia_sst: '📋 Licencia SST',
      curso_50h: '📚 Curso 50h',
      inspeccion: '🔍 Inspección',
      plan: '📅 Plan Anual',
      documento: '📄 Documento'
    };
    return labels[t] || t;
  };

  return (
    <div style={{ padding: 20, maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, color: '#0f766e' }}>Alertas y Recordatorios de Vencimiento</h1>
      </div>

      {success && <div style={{ background: '#ecfdf5', color: '#065f46', padding: 10, borderRadius: 8, marginBottom: 14 }}>{success}</div>}
      {error && <div style={{ background: '#fef2f2', color: '#991b1b', padding: 10, borderRadius: 8, marginBottom: 14 }}>{error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 16 }}>
        {[
          { id: 'pendientes', label: `📬 Pendientes ${stats?.pendientes ? `(${stats.pendientes})` : ''}` },
          { id: 'historial', label: `📤 Enviadas ${sentAlerts.length ? `(${sentAlerts.length})` : ''}` },
          { id: 'config', label: '⚙️ Configuración' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: activeTab === tab.id ? '#fff' : 'transparent',
              color: activeTab === tab.id ? '#0f766e' : '#6b7280',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              fontSize: 13,
              cursor: 'pointer',
              borderBottom: `3px solid ${activeTab === tab.id ? '#0f766e' : 'transparent'}`,
              marginBottom: '-1px',
              transition: 'all 0.15s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: PENDIENTES */}
      {activeTab === 'pendientes' && (
        <div>
          {/* Stats Cards */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#fff', padding: 16, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pendientes</div>
                <div style={{ fontSize: 28, fontWeight: 'bold', color: '#f59e0b' }}>{stats.pendientes}</div>
              </div>
              <div style={{ background: '#fff', padding: 16, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', borderLeft: '4px solid #10b981' }}>
                <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enviadas</div>
                <div style={{ fontSize: 28, fontWeight: 'bold', color: '#10b981' }}>{stats.enviadas}</div>
              </div>
              <div style={{ background: '#fff', padding: 16, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', borderLeft: '4px solid #ef4444' }}>
                <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vencidas</div>
                <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ef4444' }}>{stats.vencidas}</div>
              </div>
              <div style={{ background: '#fff', padding: 16, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', borderLeft: '4px solid #0f766e' }}>
                <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
                <div style={{ fontSize: 28, fontWeight: 'bold', color: '#0f766e' }}>{stats.total}</div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button onClick={handleGenerate} disabled={loading || sending} style={{ padding: '8px 14px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: loading || sending ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Generando...' : '🔄 Generar alertas'}
            </button>
            <button onClick={handleSendAll} disabled={!alerts.length || sending} style={{ padding: '8px 14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: alerts.length && !sending ? 'pointer' : 'not-allowed' }}>
              {sending ? 'Enviando...' : `📤 Enviar todas (${alerts.length})`}
            </button>
            {selectedIds.length > 0 && (
              <button onClick={handleSendSelected} disabled={sending} style={{ padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: sending ? 'not-allowed' : 'pointer' }}>
                ✅ Marcar {selectedIds.length} como enviada(s)
              </button>
            )}
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
              <thead>
                <tr style={{ background: '#fef2f2', textAlign: 'left' }}>
                  <th style={{ padding: 10, fontSize: 12, width: 40 }}><input type="checkbox" checked={selectedIds.length === alerts.length && alerts.length > 0} onChange={e => handleSelectAll(e.target.checked)} /></th>
                  <th style={{ padding: 10, fontSize: 12, color: '#991b1b' }}>Tipo</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#991b1b' }}>Trabajador / Ítem</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#991b1b' }}>Vence</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#991b1b' }}>Prioridad</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#991b1b' }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 10, textAlign: 'center' }}>
                      <input type="checkbox" checked={selectedIds.includes(a.id)} onChange={e => handleSelectOne(a.id, e.target.checked)} />
                    </td>
                    <td style={{ padding: 10, fontSize: 12 }}>{getTipoLabel(a.tipo)}</td>
                    <td style={{ padding: 10, fontSize: 12 }}>
                      {a.worker_nombre ? `${a.worker_nombre} ${a.worker_apellido}` : a.item_nombre || a.entidad}
                    </td>
                    <td style={{ padding: 10, fontSize: 12, fontWeight: 500 }}>{a.fecha_vencimiento}</td>
                    <td style={{ padding: 10 }}>{getPrioridadBadge(a.prioridad)}</td>
                    <td style={{ padding: 10, fontSize: 12, color: '#6b7280' }}>{a.detalle || '—'}</td>
                  </tr>
                ))}
                {alerts.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 30, textAlign: 'center', color: '#9ca3af' }}>No hay alertas pendientes</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: HISTORIAL ENVIADAS */}
      {activeTab === 'historial' && (
        <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr style={{ background: '#ecfdf5', textAlign: 'left' }}>
                <th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Tipo</th>
                <th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Trabajador / Ítem</th>
                <th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Vencía</th>
                <th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Prioridad</th>
                <th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Enviada</th>
              </tr>
            </thead>
            <tbody>
              {sentAlerts.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 10, fontSize: 12 }}>{getTipoLabel(a.tipo)}</td>
                  <td style={{ padding: 10, fontSize: 12 }}>{a.worker_nombre ? `${a.worker_nombre} ${a.worker_apellido}` : a.item_nombre || a.entidad}</td>
                  <td style={{ padding: 10, fontSize: 12 }}>{a.fecha_vencimiento}</td>
                  <td style={{ padding: 10 }}>{getPrioridadBadge(a.prioridad)}</td>
                  <td style={{ padding: 10, fontSize: 12, color: '#10b981' }}>{a.enviado_en ? new Date(a.enviado_en).toLocaleString('es-CO') : '—'}</td>
                </tr>
              ))}
              {sentAlerts.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 30, textAlign: 'center', color: '#9ca3af' }}>No hay alertas enviadas aún</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: CONFIGURACIÓN */}
      {activeTab === 'config' && (
        <div style={{ maxWidth: 700 }}>
          <div style={{ background: '#fff', padding: 20, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
            <h2 style={{ color: '#0f766e', marginBottom: 16 }}>Configuración SMTP para Alertas</h2>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>
              Configure el servidor de correo para envío automático de alertas. 
              Si deja campos vacíos, el sistema funcionará en <strong>modo simulación</strong> (logs en consola).
            </p>
            
            <form onSubmit={handleSaveSmtp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Servidor SMTP (Host) *</label>
                  <input value={smtpConfig.smtp_host} onChange={e => setSmtpConfig({...smtpConfig, smtp_host: e.target.value})} placeholder="smtp.gmail.com" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Puerto *</label>
                  <input type="number" value={smtpConfig.smtp_port} onChange={e => setSmtpConfig({...smtpConfig, smtp_port: e.target.value})} placeholder="587" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Usuario *</label>
                <input type="email" value={smtpConfig.smtp_user} onChange={e => setSmtpConfig({...smtpConfig, smtp_user: e.target.value})} placeholder="alertas@empresa.com" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Contraseña / App Password *</label>
                <input type="password" value={smtpConfig.smtp_pass} onChange={e => setSmtpConfig({...smtpConfig, smtp_pass: e.target.value})} placeholder="••••••••" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Remitente (From) *</label>
                <input value={smtpConfig.smtp_from} onChange={e => setSmtpConfig({...smtpConfig, smtp_from: e.target.value})} placeholder="SG-SST Alertas <alertas@empresa.com>" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={smtpConfig.alerts_enabled} onChange={e => setSmtpConfig({...smtpConfig, alerts_enabled: e.target.checked})} />
                  <span>Activar scheduler automático (diario 07:00, semanal lunes 08:00)</span>
                </label>
              </div>
              <button type="submit" style={{ padding: '10px 18px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', alignSelf: 'flex-start' }}>Guardar configuración</button>
            </form>
          </div>

          <div style={{ background: '#fff', padding: 20, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
            <h2 style={{ color: '#0f766e', marginBottom: 16 }}>Pruebas y Previsualización</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
              <div style={{ flex: 1, minWidth: 250 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Email destino para prueba</label>
                <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="admin@empresa.com" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
              </div>
              <button onClick={handleTestEmail} disabled={!testEmail || sending} style={{ padding: '10px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: testEmail && !sending ? 'pointer' : 'not-allowed' }}>
                {sending ? 'Enviando...' : '🧪 Enviar email de prueba'}
              </button>
              <button onClick={handlePreview} disabled={sending} style={{ padding: '10px 18px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: sending ? 'not-allowed' : 'pointer' }}>
                👁 Previsualizar plantilla
              </button>
            </div>
          </div>

          {/* Preview Modal */}
          {previewHtml && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
              <div style={{ background: '#fff', width: '100%', maxWidth: 800, maxHeight: '90vh', borderRadius: 12, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, color: '#0f766e' }}>Previsualización Plantilla Email</h3>
                  <button onClick={() => setPreviewHtml(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6b7280' }}>×</button>
                </div>
                <div style={{ padding: 16, overflow: 'auto', maxHeight: '80vh' }}>
                  <iframe
                    srcDoc={previewHtml}
                    style={{ width: '100%', height: '600px', border: 'none', borderRadius: 8 }}
                    title="Previsualización email"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}