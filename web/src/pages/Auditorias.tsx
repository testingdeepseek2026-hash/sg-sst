import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';

interface Audit {
  id: string;
  anio: number;
  tipo: 'interna' | 'direccion';
  fecha: string;
  auditor: string;
  alcance: string;
  hallazgos: string;
  conclusiones: string;
  compromisos: string;
  estado: 'programada' | 'realizada' | 'cerrada';
  creado_en: string;
}

interface Finding {
  id: string;
  audit_id: string;
  descripcion: string;
  tipo: 'no_conformidad' | 'observacion' | 'oportunidad_mejora' | 'fortaleza';
  requisito: string;
  evidencia: string;
  responsable: string;
  fecha_limite: string;
  estado: 'abierto' | 'en_proceso' | 'cerrado' | 'verificado';
  accion_correctiva: string;
  evidencia_cierre: string;
  fecha_cierre: string | null;
  creado_en: string;
}

const TIPO_AUDIT_LABELS: Record<string, string> = {
  interna: '🔍 Auditoría Interna',
  direccion: '👔 Revisión por la Dirección',
};

const TIPO_FINDING_LABELS: Record<string, string> = {
  no_conformidad: '❌ No Conformidad',
  observacion: '⚠️ Observación',
  oportunidad_mejora: '💡 Oportunidad de Mejora',
  fortaleza: '✅ Fortaleza',
};

const ESTADO_AUDIT_COLORS: Record<string, { bg: string; text: string }> = {
  programada: { bg: '#eff6ff', text: '#1e40af' },
  realizada: { bg: '#fef3c7', text: '#92400e' },
  cerrada: { bg: '#dcfce7', text: '#166534' },
};

const ESTADO_FINDING_COLORS: Record<string, { bg: string; text: string }> = {
  abierto: { bg: '#fef2f2', text: '#991b1b' },
  en_proceso: { bg: '#fef3c7', text: '#92400e' },
  cerrado: { bg: '#dcfce7', text: '#166534' },
  verificado: { bg: '#e0e7ff', text: '#3730a3' },
};

const initialAuditForm = {
  anio: new Date().getFullYear(),
  tipo: 'interna' as 'interna' | 'direccion',
  fecha: new Date().toISOString().slice(0, 10),
  auditor: '',
  alcance: '',
  hallazgos: '',
  conclusiones: '',
  compromisos: '',
  estado: 'programada' as 'programada' | 'realizada' | 'cerrada',
};

const initialFindingForm = {
  audit_id: '',
  descripcion: '',
  tipo: 'observacion' as Finding['tipo'],
  requisito: '',
  evidencia: '',
  responsable: '',
  fecha_limite: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  estado: 'abierto' as Finding['estado'],
  accion_correctiva: '',
  evidencia_cierre: '',
};

export default function Auditorias() {
  const [activeTab, setActiveTab] = useState<'lista' | 'hallazgos' | 'seguimiento'>('lista');
  const [audits, setAudits] = useState<Audit[]>([]);
  const [auditForm, setAuditForm] = useState(initialAuditForm);
  const [editingAudit, setEditingAudit] = useState<Audit | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [findingForm, setFindingForm] = useState(initialFindingForm);
  const [editingFinding, setEditingFinding] = useState<Finding | null>(null);
  const [findingModalOpen, setFindingModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAudits = useCallback(async () => {
    try {
      const data = await api.get('/audits');
      setAudits(data as Audit[]);
    } catch (err: any) {
      console.error('Error cargando auditorías:', err);
    }
  }, []);

  useEffect(() => {
    loadAudits();
  }, [loadAudits]);

  useEffect(() => {
    if (selectedAudit) {
      loadFindings(selectedAudit.id);
    }
  }, [selectedAudit]);

  const loadFindings = async (auditId: string) => {
    try {
      const data = await api.get(`/audits/${auditId}/findings`);
      setFindings(data as Finding[]);
    } catch (err: any) {
      console.error('Error cargando hallazgos:', err);
    }
  };

  const showToast = (msg: string, isError = false) => {
    setMessage({ type: isError ? 'error' : 'success', text: msg });
    setTimeout(() => setMessage(null), 4000);
  };

  const openAudit = (a: Audit) => {
    setSelectedAudit(a);
    setActiveTab('hallazgos');
  };

  const editAudit = (a: Audit) => {
    setEditingAudit(a);
    setAuditForm({ ...initialAuditForm, ...a });
    setActiveTab('lista');
  };

  const newAudit = () => {
    setEditingAudit(null);
    setSelectedAudit(null);
    setAuditForm(initialAuditForm);
    setActiveTab('lista');
  };

  const handleAuditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (editingAudit) {
        await api.put(`/audits/${editingAudit.id}`, auditForm);
        showToast('Auditoría actualizada correctamente');
      } else {
        await api.post('/audits', auditForm);
        showToast('Auditoría registrada correctamente');
      }
      newAudit();
      loadAudits();
    } catch (err: any) {
      showToast(err.message || 'Error guardando auditoría', true);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAudit = async (id: string) => {
    if (!confirm('Eliminar esta auditoría y sus hallazgos?')) return;
    try {
      await api.delete(`/audits/${id}`);
      showToast('Auditoría eliminada');
      loadAudits();
    } catch (err: any) {
      showToast(err.message || 'Error eliminando', true);
    }
  };

  // Hallazgos handlers
  const openFinding = (f?: Finding) => {
    if (f) {
      setEditingFinding(f);
      setFindingForm({ ...initialFindingForm, ...f, audit_id: selectedAudit?.id || '' });
    } else {
      setEditingFinding(null);
      setFindingForm({ ...initialFindingForm, audit_id: selectedAudit?.id || '', fecha_limite: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) });
    }
    setFindingModalOpen(true);
  };

  const handleFindingSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAudit) return;
    setLoading(true);
    setMessage(null);
    try {
      const payload = { ...findingForm, audit_id: selectedAudit.id };
      if (editingFinding) {
        await api.put(`/audits/${selectedAudit.id}/findings/${editingFinding.id}`, payload);
        showToast('Hallazgo actualizado correctamente');
      } else {
        await api.post(`/audits/${selectedAudit.id}/findings`, payload);
        showToast('Hallazgo registrado correctamente');
      }
      setFindingModalOpen(false);
      setEditingFinding(null);
      loadFindings(selectedAudit.id);
    } catch (err: any) {
      showToast(err.message || 'Error guardando hallazgo', true);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFinding = async (id: string) => {
    if (!confirm('Eliminar este hallazgo?')) return;
    if (!selectedAudit) return;
    try {
      await api.delete(`/audits/${selectedAudit.id}/findings/${id}`);
      showToast('Hallazgo eliminado');
      loadFindings(selectedAudit.id);
    } catch (err: any) {
      showToast(err.message || 'Error eliminando', true);
    }
  };

  const handleFindingClose = async (id: string) => {
    if (!selectedAudit) return;
    try {
      await api.put(`/audits/${selectedAudit.id}/findings/${id}`, {
        estado: 'verificado',
        fecha_cierre: new Date().toISOString().slice(0, 10),
      });
      showToast('Hallazgo verificado y cerrado');
      loadFindings(selectedAudit.id);
    } catch (err: any) {
      showToast(err.message || 'Error cerrando hallazgo', true);
    }
  };

  // Exportar hallazgos
  const exportFindings = async () => {
    if (!selectedAudit) return;
    try {
      const blob = await api.get(`/audits/${selectedAudit.id}/findings/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hallazgos_auditoria_${selectedAudit.anio}_${selectedAudit.tipo}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      showToast('Hallazgos exportados a Excel');
    } catch (err: any) {
      showToast(err.message || 'Error exportando', true);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, color: '#0f766e' }}>
          Auditoría Interna y Revisión por la Dirección
        </h1>
        <button onClick={newAudit} style={{ padding: '10px 16px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
          + Nueva Auditoría
        </button>
      </div>

      {message && (
        <div style={{ background: message.type === 'success' ? '#ecfdf5' : '#fef2f2', border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`, color: message.type === 'success' ? '#065f46' : '#991b1b', padding: 10, borderRadius: 8, marginBottom: 14 }}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 16 }}>
        {[
          { id: 'lista', label: '📋 Auditorías' },
          { id: 'hallazgos', label: selectedAudit ? `🔍 Hallazgos - ${selectedAudit.anio} ${TIPO_AUDIT_LABELS[selectedAudit.tipo]}` : '🔍 Hallazgos', disabled: !selectedAudit },
          { id: 'seguimiento', label: '📊 Seguimiento Global', disabled: !selectedAudit },
        ].map((tab) => (
          <button key={tab.id} onClick={() => !tab.disabled && setActiveTab(tab.id as any)} disabled={tab.disabled} style={{ padding: '12px 20px', border: 'none', background: activeTab === tab.id ? '#fff' : 'transparent', color: activeTab === tab.id ? '#0f766e' : tab.disabled ? '#d1d5db' : '#6b7280', fontWeight: activeTab === tab.id ? 'bold' : 'normal', fontSize: 13, cursor: tab.disabled ? 'not-allowed' : 'pointer', borderBottom: `3px solid ${activeTab === tab.id ? '#0f766e' : 'transparent'}`, marginBottom: '-1px', opacity: tab.disabled ? 0.5 : 1, transition: 'all 0.15s' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: LISTA DE AUDITORÍAS */}
      {activeTab === 'lista' && (
        <>
          <div style={{ background: '#fff', padding: 16, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>{editingAudit ? 'Editar Auditoría' : 'Nueva Auditoría'}</h3>
            <form onSubmit={handleAuditSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label htmlFor="audit-anio" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Año *</label>
                  <input id="audit-anio" type="number" value={auditForm.anio} onChange={e => setAuditForm({ ...auditForm, anio: Number(e.target.value) })} min="2020" max="2030" required style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label htmlFor="audit-tipo" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Tipo *</label>
                  <select id="audit-tipo" value={auditForm.tipo} onChange={e => setAuditForm({ ...auditForm, tipo: e.target.value as any })} required style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="interna">Auditoría Interna</option>
                    <option value="direccion">Revisión por la Dirección</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="audit-fecha" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Fecha *</label>
                  <input id="audit-fecha" type="date" value={auditForm.fecha} onChange={e => setAuditForm({ ...auditForm, fecha: e.target.value })} required style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label htmlFor="audit-auditor" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Auditor / Responsable</label>
                  <input id="audit-auditor" value={auditForm.auditor} onChange={e => setAuditForm({ ...auditForm, auditor: e.target.value })} placeholder="Nombre del auditor o responsable" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <div>
                <label htmlFor="audit-alcance" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Alcance *</label>
                <textarea id="audit-alcance" value={auditForm.alcance} onChange={e => setAuditForm({ ...auditForm, alcance: e.target.value })} rows={3} placeholder="Áreas, procesos, normas auditadas..." required style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', resize: 'vertical' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="audit-hallazgos" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Hallazgos Preliminares</label>
                <textarea id="audit-hallazgos" value={auditForm.hallazgos} onChange={e => setAuditForm({ ...auditForm, hallazgos: e.target.value })} rows={3} placeholder="Resumen de hallazgos identificados durante la auditoría..." style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', resize: 'vertical' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="audit-conclusiones" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Conclusiones</label>
                <textarea id="audit-conclusiones" value={auditForm.conclusiones} onChange={e => setAuditForm({ ...auditForm, conclusiones: e.target.value })} rows={3} placeholder="Conclusiones generales de la auditoría..." style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', resize: 'vertical' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="audit-compromisos" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Compromisos / Plan de Acción</label>
                <textarea id="audit-compromisos" value={auditForm.compromisos} onChange={e => setAuditForm({ ...auditForm, compromisos: e.target.value })} rows={3} placeholder="Compromisos adquiridos, acciones de mejora..." style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', resize: 'vertical' }} />
              </div>
              <div>
                <label htmlFor="audit-estado" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Estado</label>
                <select id="audit-estado" value={auditForm.estado} onChange={e => setAuditForm({ ...auditForm, estado: e.target.value as any })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
                  <option value="programada">Programada</option>
                  <option value="realizada">Realizada</option>
                  <option value="cerrada">Cerrada</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={newAudit} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={loading} style={{ padding: '10px 16px', background: loading ? '#94a3b8' : '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Guardando...' : editingAudit ? 'Actualizar' : 'Registrar Auditoría'}
                </button>
              </div>
            </form>
          </div>

          <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Año</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Tipo</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Fecha</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Auditor</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Alcance</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((a) => {
                  const estadoColor = ESTADO_AUDIT_COLORS[a.estado] || { bg: '#f3f4f6', text: '#374151' };
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: 10 }}>{a.anio}</td>
                      <td style={{ padding: 10 }}>{TIPO_AUDIT_LABELS[a.tipo]}</td>
                      <td style={{ padding: 10 }}>{a.fecha}</td>
                      <td style={{ padding: 10 }}>{a.auditor || '—'}</td>
                      <td style={{ padding: 10 }}>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: estadoColor.bg, color: estadoColor.text }}>{a.estado}</span>
                      </td>
                      <td style={{ padding: 10, maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.alcance || '—'}</td>
                      <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                        <button onClick={() => openAudit(a)} style={{ padding: '4px 8px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Ver Hallazgos</button>
                        <button onClick={() => editAudit(a)} style={{ padding: '4px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Editar</button>
                        <button onClick={() => handleDeleteAudit(a.id)} style={{ padding: '4px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
                {audits.length === 0 && <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#9ca3af' }}>No hay auditorías registradas</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* TAB 2: HALLAZGOS */}
      {activeTab === 'hallazgos' && selectedAudit && (
        <>
          <div style={{ background: '#fff', padding: 16, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#0f766e' }}>Hallazgos - {TIPO_AUDIT_LABELS[selectedAudit.tipo]} {selectedAudit.anio}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={exportFindings} style={{ padding: '8px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>📥 Exportar Excel</button>
                <button onClick={() => openFinding()} style={{ padding: '8px 16px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>+ Nuevo Hallazgo</button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                    <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Tipo</th>
                    <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Descripción</th>
                    <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Requisito</th>
                    <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Responsable</th>
                    <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Límite</th>
                    <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th>
                    <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Acción Correctiva</th>
                    <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.map((f) => {
                    const estadoColor = ESTADO_FINDING_COLORS[f.estado] || { bg: '#f3f4f6', text: '#374151' };
                    const isOverdue = f.fecha_limite < new Date().toISOString().slice(0, 10) && f.estado !== 'cerrado' && f.estado !== 'verificado';
                    return (
                      <tr key={f.id} style={{ borderBottom: '1px solid #f3f4f6', background: isOverdue ? '#fff1f2' : '' }}>
                        <td style={{ padding: 10 }}><span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 'bold', background: '#e5e7eb', color: '#374151' }}>{TIPO_FINDING_LABELS[f.tipo]}</span></td>
                        <td style={{ padding: 10, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.descripcion}</td>
                        <td style={{ padding: 10, fontSize: 11 }}>{f.requisito || '—'}</td>
                        <td style={{ padding: 10 }}>{f.responsable || '—'}</td>
                        <td style={{ padding: 10, fontSize: 12, color: isOverdue && f.estado !== 'cerrado' ? '#dc2626' : '#374151' }}>{f.fecha_limite} {isOverdue && '⚠️'}</td>
                        <td style={{ padding: 10 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: estadoColor.bg, color: estadoColor.text }}>{f.estado}</span>
                        </td>
                        <td style={{ padding: 10, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.accion_correctiva || '—'}</td>
                        <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                          <button onClick={() => openFinding(f)} style={{ padding: '4px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Editar</button>
                          {f.estado !== 'verificado' && (
                            <button onClick={() => handleFindingClose(f.id)} style={{ padding: '4px 8px', background: '#059669', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Verificar</button>
                          )}
                          <button onClick={() => handleDeleteFinding(f.id)} style={{ padding: '4px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                  {findings.length === 0 && <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center', color: '#9ca3af' }}>No hay hallazgos registrados para esta auditoría</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal Hallazgo */}
          {findingModalOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, overflow: 'auto' }}>
              <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 700, maxHeight: '90vh', overflow: 'auto' }}>
                <div style={{ padding: 20, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, color: '#0f766e' }}>{editingFinding ? 'Editar Hallazgo' : 'Nuevo Hallazgo'}</h3>
                  <button onClick={() => { setFindingModalOpen(false); setEditingFinding(null); }} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>✕ Cerrar</button>
                </div>
                <form onSubmit={handleFindingSave} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
                    <div>
                      <label htmlFor="finding-tipo" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Tipo *</label>
                      <select id="finding-tipo" value={findingForm.tipo} onChange={e => setFindingForm({ ...findingForm, tipo: e.target.value as any })} required style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
                        <option value="no_conformidad">No Conformidad</option>
                        <option value="observacion">Observación</option>
                        <option value="oportunidad_mejora">Oportunidad de Mejora</option>
                        <option value="fortaleza">Fortaleza</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="finding-requisito" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Requisito / Norma</label>
                      <input id="finding-requisito" value={findingForm.requisito} onChange={e => setFindingForm({ ...findingForm, requisito: e.target.value })} placeholder="Ej: Res. 0312/2019 E13, ISO 45001:2018 8.2.2" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                    </div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="finding-descripcion" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Descripción del Hallazgo *</label>
                    <textarea id="finding-descripcion" value={findingForm.descripcion} onChange={e => setFindingForm({ ...findingForm, descripcion: e.target.value })} rows={3} placeholder="Describa el hallazgo de forma clara y objetiva..." required style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', resize: 'vertical' }} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="finding-evidencia" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Evidencia</label>
                    <textarea id="finding-evidencia" value={findingForm.evidencia} onChange={e => setFindingForm({ ...findingForm, evidencia: e.target.value })} rows={2} placeholder="Documentos, fotos, registros que soporten el hallazgo..." style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', resize: 'vertical' }} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                      <label htmlFor="finding-responsable" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Responsable *</label>
                      <input id="finding-responsable" value={findingForm.responsable} onChange={e => setFindingForm({ ...findingForm, responsable: e.target.value })} placeholder="Nombre del responsable de la acción correctiva" required style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label htmlFor="finding-fecha-limite" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Fecha Límite *</label>
                      <input id="finding-fecha-limite" type="date" value={findingForm.fecha_limite} onChange={e => setFindingForm({ ...findingForm, fecha_limite: e.target.value })} required style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                    </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="finding-accion" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Acción Correctiva / Preventiva *</label>
                    <textarea id="finding-accion" value={findingForm.accion_correctiva} onChange={e => setFindingForm({ ...findingForm, accion_correctiva: e.target.value })} rows={3} placeholder="Describa la acción a implementar para cerrar el hallazgo..." required style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', resize: 'vertical' }} />
                  </div>
                  {editingFinding && editingFinding.estado === 'verificado' && (
                    <div style={{ gridColumn: '1 / -1', padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                      <strong style={{ color: '#166534' }}>✅ Hallazgo verificado y cerrado el {editingFinding.fecha_cierre}</strong>
                      <div style={{ marginTop: 8 }}>
                        <label htmlFor="finding-evidencia-cierre" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Evidencia de Cierre</label>
                        <textarea id="finding-evidencia-cierre" value={findingForm.evidencia_cierre} onChange={e => setFindingForm({ ...findingForm, evidencia_cierre: e.target.value })} rows={2} placeholder="Registros, fotos, documentos que demuestren el cierre efectivo..." style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', resize: 'vertical' }} />
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                    <button type="button" onClick={() => { setFindingModalOpen(false); setEditingFinding(null); }} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                    <button type="submit" disabled={loading} style={{ padding: '10px 16px', background: loading ? '#94a3b8' : '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
                      {loading ? 'Guardando...' : editingFinding ? 'Actualizar' : 'Registrar Hallazgo'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 3: SEGUIMIENTO GLOBAL */}
      {activeTab === 'seguimiento' && (
        <div style={{ background: '#fff', padding: 16, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>Seguimiento Global de Hallazgos</h3>
          <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 16 }}>Resumen consolidado de hallazgos abiertos, en proceso y vencidos en todas las auditorías.</p>

          {/* KPIs globales - se cargarían desde backend */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#fef2f2', padding: 16, borderRadius: 10, borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: 11, color: '#991b1b', textTransform: 'uppercase' }}>Abiertos</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#dc2626' }}>—</div>
            </div>
            <div style={{ background: '#fef3c7', padding: 16, borderRadius: 10, borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: 11, color: '#92400e', textTransform: 'uppercase' }}>En Proceso</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#f59e0b' }}>—</div>
            </div>
            <div style={{ background: '#fff1f2', padding: 16, borderRadius: 10, borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: 11, color: '#991b1b', textTransform: 'uppercase' }}>Vencidos</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ef4444' }}>—</div>
            </div>
            <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 10, borderLeft: '4px solid #16a34a' }}>
              <div style={{ fontSize: 11, color: '#166534', textTransform: 'uppercase' }}>Verificados</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#16a34a' }}>—</div>
            </div>
          </div>

          <div style={{ background: '#f9fafb', padding: 16, borderRadius: 10, textAlign: 'center', color: '#6b7280' }}>
            <p>Esta vista requiere endpoint de agregación global en backend (<code>/audits/findings/summary</code>)</p>
            <p style={{ marginTop: 8, fontSize: 12 }}>Implementar en Fase 5.2 para consolidar KPIs de todas las auditorías.</p>
          </div>
        </div>
      )}
    </div>
  );
}