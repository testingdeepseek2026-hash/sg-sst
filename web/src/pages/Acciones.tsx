import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { SignaturePad } from '@/components/SignaturePad';

const ORIGEN_LABELS: Record<string, string> = {
  auditoria: '🔍 Auditoría',
  inspeccion: '🔎 Inspección',
  incidente: '🚨 Incidente',
  estandar: '✅ Estándar',
  revision_direccion: '👔 Revisión Dirección',
  otro: '📝 Otro',
};

const ORIGEN_OPTIONS = [
  { value: 'auditoria', label: '🔍 Auditoría' },
  { value: 'inspeccion', label: '🔎 Inspección' },
  { value: 'incidente', label: '🚨 Incidente' },
  { value: 'estandar', label: '✅ Estándar' },
  { value: 'revision_direccion', label: '👔 Revisión Dirección' },
  { value: 'otro', label: '📝 Otro' },
];

const PRIORIDAD_LABELS: Record<string, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
};

const PRIORIDAD_COLORS: Record<string, { bg: string; text: string }> = {
  baja: { bg: '#dcfce7', text: '#166534' },
  media: { bg: '#fef3c7', text: '#92400e' },
  alta: { bg: '#fee2e2', text: '#991b1b' },
  critica: { bg: '#fecaca', text: '#7f1d1d' },
};

const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En Proceso',
  completada: 'Completada',
  vencida: 'Vencida',
};

const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  pendiente: { bg: '#eff6ff', text: '#1e40af' },
  en_proceso: { bg: '#fef3c7', text: '#92400e' },
  completada: { bg: '#dcfce7', text: '#166534' },
  vencida: { bg: '#fee2e2', text: '#dc2626' },
};

interface Action {
  id: string;
  origen: string;
  origen_detalle: string;
  origen_id: string;
  descripcion: string;
  responsable: string;
  fecha_limite: string;
  estado: 'pendiente' | 'en_proceso' | 'completada' | 'vencida';
  prioridad: 'baja' | 'media' | 'alta' | 'critica';
  evidencia_url: string;
  creado_en: string;
  actualizado_en: string;
  completada_en: string | null;
  firmado_por: string | null;
  firma_url: string | null;
}

interface ActionForm {
  origen: string;
  origen_detalle: string;
  origen_id: string;
  descripcion: string;
  responsable: string;
  fecha_limite: string;
  estado: Action['estado'];
  prioridad: Action['prioridad'];
  evidencia_url: string;
}

const initialForm: ActionForm = {
  origen: 'auditoria',
  origen_detalle: '',
  origen_id: '',
  descripcion: '',
  responsable: '',
  fecha_limite: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  estado: 'pendiente',
  prioridad: 'media',
  evidencia_url: '',
};

export default function Acciones() {
  const [actions, setActions] = useState<Action[]>([]);
  const [form, setForm] = useState<ActionForm>(initialForm);
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const [viewingAction, setViewingAction] = useState<Action | null>(null);
  const [signingAction, setSigningAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filterOrigen, setFilterOrigen] = useState<string>('all');
  const [filterEstado, setFilterEstado] = useState<string>('all');

  const loadActions = useCallback(async () => {
    try {
      const data = await api.get('/actions');
      setActions(data as Action[]);
    } catch (err: any) {
      console.error('Error cargando acciones:', err);
    }
  }, []);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  const showToast = (msg: string, isError = false) => {
    setMessage({ type: isError ? 'error' : 'success', text: msg });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleInputChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const openAction = (a: Action) => {
    setViewingAction(a);
  };

  const editAction = (a: Action) => {
    setEditingAction(a);
    setForm({ ...initialForm, ...a, origen_detalle: a.origen_detalle || '', origen_id: a.origen_id || '' });
  };

  const newAction = () => {
    setEditingAction(null);
    setViewingAction(null);
    setForm(initialForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (editingAction) {
        await api.put(`/actions/${editingAction.id}`, form);
        showToast('Acción actualizada correctamente');
      } else {
        await api.post('/actions', form);
        showToast('Acción registrada correctamente');
      }
      newAction();
      loadActions();
    } catch (err: any) {
      showToast(err.message || 'Error guardando acción', true);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta acción?')) return;
    try {
      await api.delete(`/actions/${id}`);
      showToast('Acción eliminada');
      loadActions();
    } catch (err: any) {
      showToast(err.message || 'Error eliminando', true);
    }
  };

  const handleSign = (action: Action) => {
    setSigningAction(action);
  };

  const handleSaveSignature = async (dataUrl: string) => {
    if (!signingAction) return;
    try {
      await api.put(`/actions/${signingAction.id}`, {
        firma_url: dataUrl,
        firmado_por: form.responsable || 'Responsable',
        estado: 'completada',
        completada_en: new Date().toISOString(),
      });
      showToast('Firma guardada y acción completada');
      loadActions();
      setSigningAction(null);
    } catch (err: any) {
      showToast(err.message || 'Error guardando firma', true);
    }
  };

  const handleSetEstado = async (id: string, estado: string) => {
    try {
      await api.put(`/actions/${id}`, { estado });
      showToast(`Estado actualizado a ${ESTADO_LABELS[estado]}`);
      loadActions();
    } catch (err: any) {
      showToast(err.message || 'Error actualizando estado', true);
    }
  };

  const handleEvidenciaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({ ...prev, evidencia_url: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const filteredActions = actions.filter(a => {
    if (filterOrigen !== 'all' && a.origen !== filterOrigen) return false;
    if (filterEstado !== 'all' && a.estado !== filterEstado) return false;
    return true;
  });

  const isOverdue = (action: Action) => {
    return action.fecha_limite < new Date().toISOString().slice(0, 10) && action.estado !== 'completada';
  };

  return (
    <div style={{ padding: 20, maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, color: '#0f766e' }}>
          Acciones Correctivas, Preventivas y de Mejora
        </h1>
        <button onClick={newAction} style={{ padding: '10px 16px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
          + Nueva Acción
        </button>
      </div>

      {message && (
        <div style={{ background: message.type === 'success' ? '#ecfdf5' : '#fef2f2', border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`, color: message.type === 'success' ? '#065f46' : '#991b1b', padding: 10, borderRadius: 8, marginBottom: 14 }}>
          {message.text}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={filterOrigen} onChange={e => setFilterOrigen(e.target.value)} style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
          <option value="all">Todos los orígenes</option>
          {ORIGEN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
          <option value="all">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="en_proceso">En Proceso</option>
          <option value="completada">Completada</option>
          <option value="vencida">Vencida</option>
        </select>
      </div>

      {/* Formulario */}
      <div style={{ background: '#fff', padding: 16, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>{editingAction ? 'Editar Acción' : viewingAction ? 'Ver Acción' : 'Nueva Acción Correctiva / Preventiva / Mejora'}</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
            <div>
              <label htmlFor="action-origen" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Origen *</label>
              <select id="action-origen" value={form.origen} onChange={e => handleInputChange('origen', e.target.value)} required style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
                {ORIGEN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="action-origen-detalle" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Detalle Origen</label>
              <input id="action-origen-detalle" value={form.origen_detalle} onChange={e => handleInputChange('origen_detalle', e.target.value)} placeholder="Ej: Aud. Interna 2024, Inspección Obra Norte, Inc. #INC-001" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
            </div>
            <div>
              <label htmlFor="action-origen-id" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>ID Referencia</label>
              <input id="action-origen-id" value={form.origen_id} onChange={e => handleInputChange('origen_id', e.target.value)} placeholder="ID de la auditoría, inspección, incidente..." style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
            </div>
          </div>
          <div>
            <label htmlFor="action-descripcion" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Descripción *</label>
            <textarea id="action-descripcion" value={form.descripcion} onChange={e => handleInputChange('descripcion', e.target.value)} rows={3} placeholder="Describa la acción a implementar..." required style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label htmlFor="action-responsable" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Responsable *</label>
              <input id="action-responsable" value={form.responsable} onChange={e => handleInputChange('responsable', e.target.value)} placeholder="Nombre del responsable" required style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
            </div>
            <div>
              <label htmlFor="action-fecha-limite" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Fecha Límite *</label>
              <input id="action-fecha-limite" type="date" value={form.fecha_limite} onChange={e => handleInputChange('fecha_limite', e.target.value)} required style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
            </div>
            <div>
              <label htmlFor="action-prioridad" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Prioridad</label>
              <select id="action-prioridad" value={form.prioridad} onChange={e => handleInputChange('prioridad', e.target.value as any)} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
            <div>
              <label htmlFor="action-estado" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Estado</label>
              <select id="action-estado" value={form.estado} onChange={e => handleInputChange('estado', e.target.value as any)} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
                <option value="pendiente">Pendiente</option>
                <option value="en_proceso">En Proceso</option>
                <option value="completada">Completada</option>
                <option value="vencida">Vencida</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>📎 Evidencia (archivo/imagen)</label>
            <input type="file" accept="image/*,application/pdf" onChange={handleEvidenciaChange} style={{ display: 'none' }} id="action-evidencia-input" />
            <button type="button" onClick={() => document.getElementById('action-evidencia-input')?.click()} style={{ padding: '8px 16px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 6, cursor: 'pointer', fontSize: 13, marginBottom: 8 }}>
              📎 Adjuntar evidencia
            </button>
            {form.evidencia_url && (
              <div style={{ marginTop: 8 }}>
                <a href={form.evidencia_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1', textDecoration: 'underline' }}>Ver evidencia adjunta</a>
                <button type="button" onClick={() => setForm(prev => ({ ...prev, evidencia_url: '' }))} style={{ marginLeft: 12, padding: '4px 8px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Eliminar</button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={newAction} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ padding: '10px 16px', background: loading ? '#94a3b8' : '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Guardando...' : editingAction ? 'Actualizar' : 'Registrar Acción'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de acciones */}
      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
          <thead>
            <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Origen</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Descripción</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Responsable</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Límite</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Prioridad</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Evidencia</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Firma</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredActions.map((a) => {
              const estadoColor = ESTADO_COLORS[a.estado] || { bg: '#f3f4f6', text: '#374151' };
              const prioridadColor = PRIORIDAD_COLORS[a.prioridad] || { bg: '#f3f4f6', text: '#374151' };
              const overdue = isOverdue(a);
              const hasEvidencia = !!a.evidencia_url;
              const hasFirma = !!a.firma_url;
              return (
                <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6', background: overdue ? '#fff1f2' : '' }}>
                  <td style={{ padding: 10, fontSize: 12 }}>{ORIGEN_LABELS[a.origen] || a.origen} {a.origen_detalle && <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 4 }}>({a.origen_detalle})</span>}</td>
                  <td style={{ padding: 10, fontSize: 12, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.descripcion}</td>
                  <td style={{ padding: 10, fontSize: 12 }}>{a.responsable}</td>
                  <td style={{ padding: 10, fontSize: 12, color: overdue ? '#dc2626' : '#374151' }}>{a.fecha_limite} {overdue && ' ⚠️'}</td>
                  <td style={{ padding: 10, textAlign: 'center' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 'bold', background: prioridadColor.bg, color: prioridadColor.text }}>{PRIORIDAD_LABELS[a.prioridad]}</span>
                  </td>
                  <td style={{ padding: 10 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: estadoColor.bg, color: estadoColor.text }}>{ESTADO_LABELS[a.estado]}</span>
                  </td>
                  <td style={{ padding: 10, textAlign: 'center' }}>{hasEvidencia ? '📎' : '—'}</td>
                  <td style={{ padding: 10, textAlign: 'center' }}>{hasFirma ? '✅' : a.estado === 'completada' ? '⏳' : '—'}</td>
                  <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                    <button onClick={() => openAction(a)} style={{ padding: '4px 8px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Ver</button>
                    <button onClick={() => editAction(a)} style={{ padding: '4px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Editar</button>
                    {!a.firma_url && a.estado === 'completada' && (
                      <button onClick={() => handleSign(a)} style={{ padding: '4px 8px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>🖊️ Firmar</button>
                    )}
                    <button onClick={() => handleDelete(a.id)} style={{ padding: '4px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>✕</button>
                  </td>
                </tr>
              );
            })}
            {filteredActions.length === 0 && <tr><td colSpan={9} style={{ padding: 30, textAlign: 'center', color: '#9ca3af' }}>No hay acciones registradas</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Modal Ver Acción */}
      {viewingAction && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, overflow: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 800, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: 20, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#0f766e' }}>Acción - {ORIGEN_LABELS[viewingAction.origen] || viewingAction.origen}</h3>
              <button onClick={() => setViewingAction(null)} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>✕ Cerrar</button>
            </div>
            <div style={{ padding: 20, maxHeight: '70vh', overflow: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div><strong>Origen:</strong> {ORIGEN_LABELS[viewingAction.origen] || viewingAction.origen}</div>
                <div><strong>Detalle:</strong> {viewingAction.origen_detalle || '—'}</div>
                <div><strong>ID Referencia:</strong> {viewingAction.origen_id || '—'}</div>
                <div><strong>Responsable:</strong> {viewingAction.responsable}</div>
                <div><strong>Fecha Límite:</strong> {viewingAction.fecha_limite}</div>
                <div><strong>Prioridad:</strong> <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: PRIORIDAD_COLORS[viewingAction.prioridad]?.bg, color: PRIORIDAD_COLORS[viewingAction.prioridad]?.text }}>{PRIORIDAD_LABELS[viewingAction.prioridad]}</span></div>
                <div><strong>Estado:</strong> <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: ESTADO_COLORS[viewingAction.estado]?.bg, color: ESTADO_COLORS[viewingAction.estado]?.text }}>{ESTADO_LABELS[viewingAction.estado]}</span></div>
                <div><strong>Creada:</strong> {new Date(viewingAction.creado_en).toLocaleString('es-CO')}</div>
                {viewingAction.actualizado_en && <div><strong>Actualizada:</strong> {new Date(viewingAction.actualizado_en).toLocaleString('es-CO')}</div>}
                {viewingAction.completada_en && <div><strong>Completada:</strong> {new Date(viewingAction.completada_en).toLocaleString('es-CO')}</div>}
              </div>
              <div style={{ marginBottom: 16 }}>
                <strong>Descripción:</strong>
                <p style={{ marginTop: 8, whiteSpace: 'pre-wrap', background: '#f9fafb', padding: 12, borderRadius: 6 }}>{viewingAction.descripcion}</p>
              </div>
              {viewingAction.evidencia_url && (
                <div style={{ marginBottom: 16 }}>
                  <strong>Evidencia:</strong>
                  <div style={{ marginTop: 8 }}>
                    <a href={viewingAction.evidencia_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1', textDecoration: 'underline' }}>Ver evidencia</a>
                  </div>
                </div>
              )}
              {viewingAction.firma_url && (
                <div style={{ marginBottom: 16 }}>
                  <strong>Firma:</strong>
                  <div style={{ marginTop: 8 }}>
                    <img src={viewingAction.firma_url} alt="Firma" style={{ maxHeight: 80, border: '1px solid #d1d5db', borderRadius: 4 }} />
                  </div>
                </div>
              )}
              {viewingAction.firmado_por && (
                <div>
                  <strong>Firmado por:</strong> {viewingAction.firmado_por} el {viewingAction.completada_en ? new Date(viewingAction.completada_en).toLocaleString('es-CO') : '—'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Firma */}
      {signingAction && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 500, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>Firma digital - {signingAction.responsable}</h3>
            <SignaturePad onSave={handleSaveSignature} onCancel={() => setSigningAction(null)} />
          </div>
        </div>
      )}
    </div>
  );
}