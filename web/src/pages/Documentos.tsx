import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';

interface Document {
  id: string;
  codigo: string;
  nombre: string;
  version: string;
  tipo: string;
  archivo_url: string;
  fecha_emision: string;
  fecha_revision: string | null;
  retencion_anos: number;
  responsable: string;
  estado: 'vigente' | 'obsoleto' | 'en_revision';
  creado_en: string;
}

interface DocumentForm {
  codigo: string;
  nombre: string;
  version: string;
  tipo: string;
  archivo_url: string;
  fecha_emision: string;
  fecha_revision: string;
  retencion_anos: number;
  responsable: string;
  estado: Document['estado'];
}

const TIPO_DOC_OPTIONS = [
  { value: 'formato', label: '📋 Formato' },
  { value: 'procedimiento', label: '📖 Procedimiento' },
  { header: 'instruccion', label: '📝 Instrucción' },
  { value: 'registro', label: '📊 Registro' },
  { value: 'manual', label: '📚 Manual' },
  { value: 'politica', label: '📋 Política' },
  { value: 'plan', label: '📅 Plan' },
  { value: 'informe', label: '📊 Informe' },
  { value: 'otro', label: '📄 Otro' },
];

const ESTADO_OPTIONS = [
  { value: 'vigente', label: 'Vigente' },
  { value: 'obsoleto', label: 'Obsoleto' },
  { value: 'en_revision', label: 'En Revisión' },
];

const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  vigente: { bg: '#dcfce7', text: '#166534' },
  obsoleto: { bg: '#fef2f2', text: '#991b1b' },
  en_revision: { bg: '#fef3c7', text: '#92400e' },
};

const TIPO_LABELS: Record<string, string> = {
  formato: '📋 Formato',
  procedimiento: '📖 Procedimiento',
  instruccion: '📝 Instrucción',
  registro: '📊 Registro',
  manual: '📚 Manual',
  politica: '📋 Política',
  plan: '📅 Plan',
  informe: '📊 Informe',
  otro: '📄 Otro',
};

const RETENCION_SUGERIDA: Record<string, number> = {
  formato: 5,
  procedimiento: 5,
  instruccion: 5,
  registro: 10,
  manual: 10,
  politica: 10,
  plan: 5,
  informe: 5,
  registro_medico: 20,
  registro_exposicion: 20,
  otro: 5,
};

const initialForm: DocumentForm = {
  codigo: '',
  nombre: '',
  version: '1.0',
  tipo: 'formato',
  archivo_url: '',
  fecha_emision: new Date().toISOString().slice(0, 10),
  fecha_revision: '',
  retencion_anos: 5,
  responsable: '',
  estado: 'vigente',
};

interface DocumentForm {
  codigo: string;
  nombre: string;
  version: string;
  tipo: string;
  archivo_url: string;
  fecha_emision: string;
  fecha_revision: string;
  retencion_anos: number;
  responsable: string;
  estado: Document['estado'];
}

export default function Documentos() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [form, setForm] = useState<DocumentForm>(initialForm);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filterTipo, setFilterTipo] = useState<string>('all');
  const [filterEstado, setFilterEstado] = useState<string>('all');
  const [showVersionHistory, setShowVersionHistory] = useState<string | null>(null);
  const [versionHistory, setVersionHistory] = useState<Document[]>([]);

  const loadDocs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/documents');
      setDocs(data as Document[]);
    } catch (err: any) {
      console.error('Error cargando documentos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const loadVersionHistory = async (codigo: string) => {
    try {
      const data = await api.get(`/documents/history/${codigo}`);
      setVersionHistory(data as Document[]);
      setShowVersionHistory(codigo);
    } catch (err: any) {
      console.error('Error cargando historial:', err);
    }
  };

  const showToast = (msg: string, isError = false) => {
    setMessage({ type: isError ? 'error' : 'success', text: msg });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleInputChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const onTipoChange = (tipo: string) => {
    setForm(prev => ({
      ...prev,
      tipo,
      retencion_anos: RETENCION_SUGERIDA[tipo] ?? 5,
    }));
  };

  const openDoc = (d: Document) => {
    setViewingDoc(d);
  };

  const editDoc = (d: Document) => {
    setEditingDoc(d);
    setForm({
      ...initialForm,
      ...d,
      fecha_emision: d.fecha_emision?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      fecha_revision: d.fecha_revision?.slice(0, 10) || '',
      retencion_anos: d.retencion_anos ?? 5,
    });
  };

  const newDoc = () => {
    setEditingDoc(null);
    setViewingDoc(null);
    setForm(initialForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (editingDoc) {
        await api.put(`/documents/${editingDoc.id}`, form);
        showToast('Documento actualizado correctamente');
      } else {
        await api.post('/documents', form);
        showToast('Documento registrado correctamente');
      }
      newDoc();
      loadDocs();
    } catch (err: any) {
      showToast(err.message || 'Error guardando documento', true);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este documento y su historial de versiones?')) return;
    try {
      await api.delete(`/documents/${id}`);
      showToast('Documento eliminado');
      loadDocs();
    } catch (err: any) {
      showToast(err.message || 'Error eliminando', true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({ ...prev, archivo_url: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const createNewVersion = (doc: Document) => {
    const newVersion = (parseFloat(doc.version) + 0.1).toFixed(1);
    setEditingDoc(doc);
    setForm({
      ...initialForm,
      codigo: doc.codigo,
      nombre: doc.nombre,
      version: newVersion,
      tipo: doc.tipo,
      archivo_url: '',
      fecha_emision: new Date().toISOString().slice(0, 10),
      fecha_revision: '',
      retencion_anos: doc.retencion_anos,
      responsable: doc.responsable,
      estado: 'en_revision',
    });
    setViewingDoc(null);
  };

  const filteredDocs = docs.filter(d => {
    if (filterTipo !== 'all' && d.tipo !== filterTipo) return false;
    if (filterEstado !== 'all' && d.estado !== filterEstado) return false;
    return true;
  });

  const getTipoStats = () => {
    const stats: Record<string, number> = {};
    docs.forEach(d => {
      stats[d.tipo] = (stats[d.tipo] || 0) + 1;
    });
    return stats;
  };

  const tipoStats = getTipoStats();

  return (
    <div style={{ padding: 20, maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, color: '#0f766e' }}>Gestión Documental y Retención Legal</h1>
        <button onClick={newDoc} style={{ padding: '10px 16px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
          + Nuevo Documento
        </button>
      </div>

      <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 16 }}>
        Registros médicos y de exposición: hasta 20 años (Ley 1581/2012, Dec. 1072/2015). 
        Control de versiones, listado maestro, estados y retención legal.
      </p>

      {message && (
        <div style={{ background: message.type === 'success' ? '#ecfdf5' : '#fef2f2', border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`, color: message.type === 'success' ? '#065f46' : '#991b1b', padding: 10, borderRadius: 8, marginBottom: 14 }}>
          {message.text}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#fff', padding: 16, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', textAlign: 'center', borderLeft: '4px solid #0f766e' }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>Total Documentos</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#0f766e' }}>{docs.length}</div>
        </div>
        <div style={{ background: '#fff', padding: 16, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', textAlign: 'center', borderLeft: '4px solid #16a34a' }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>Vigentes</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#16a34a' }}>{docs.filter(d => d.estado === 'vigente').length}</div>
        </div>
        <div style={{ background: '#fff', padding: 16, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', textAlign: 'center', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>En Revisión</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#f59e0b' }}>{docs.filter(d => d.estado === 'en_revision').length}</div>
        </div>
        <div style={{ background: '#fff', padding: 16, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', textAlign: 'center', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>Obsoletos</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ef4444' }}>{docs.filter(d => d.estado === 'obsoleto').length}</div>
        </div>
      </div>

      {/* Filtros y Stats por Tipo */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
          <option value="all">Todos los tipos</option>
          {TIPO_DOC_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
          <option value="all">Todos los estados</option>
          <option value="vigente">Vigente</option>
          <option value="en_revision">En Revisión</option>
          <option value="obsoleto">Obsoleto</option>
        </select>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>
          {Object.entries(tipoStats).map(([tipo, count]) => (
            <span key={tipo} style={{ marginRight: 16, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0fdf4', padding: '4px 8px', borderRadius: 6 }}>
              <span style={{ fontWeight: 'bold', color: '#166534' }}>{count}</span> {TIPO_LABELS[tipo] || tipo}
            </span>
          ))}
        </div>
      </div>

      {/* Formulario */}
      <div style={{ background: '#fff', padding: 16, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>{editingDoc ? 'Editar Documento' : viewingDoc ? 'Ver Documento' : 'Nuevo Documento / Nueva Versión'}</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
            <div>
              <label htmlFor="doc-codigo" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Código *</label>
              <input id="doc-codigo" value={form.codigo} onChange={e => handleInputChange('codigo', e.target.value)} placeholder="Ej: PROC-SST-001" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
            </div>
            <div>
              <label htmlFor="doc-tipo" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Tipo *</label>
              <select id="doc-tipo" value={form.tipo} onChange={e => { handleInputChange('tipo', e.target.value); onTipoChange(e.target.value); }} required style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
                {TIPO_DOC_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="doc-version" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Versión *</label>
              <input id="doc-version" value={form.version} onChange={e => handleInputChange('version', e.target.value)} placeholder="Ej: 1.0, 1.1, 2.0" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
            </div>
            <div>
              <label htmlFor="doc-estado" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Estado</label>
              <select id="doc-estado" value={form.estado} onChange={e => handleInputChange('estado', e.target.value as any)} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
                {ESTADO_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="doc-retencion" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Retención (años) *</label>
              <input id="doc-retencion" type="number" min="1" max="50" value={form.retencion_anos} onChange={e => handleInputChange('retencion_anos', parseInt(e.target.value) || 5)} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
            </div>
            <div>
              <label htmlFor="doc-responsable" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Responsable</label>
              <input id="doc-responsable" value={form.responsable} onChange={e => handleInputChange('responsable', e.target.value)} placeholder="Nombre/Área responsable" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="doc-nombre" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Nombre del Documento *</label>
            <input id="doc-nombre" value={form.nombre} onChange={e => handleInputChange('nombre', e.target.value)} placeholder="Ej: Procedimiento de Trabajo en Alturas" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
            <div>
              <label htmlFor="doc-fecha-emision" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Fecha Emisión *</label>
              <input id="doc-fecha-emision" type="date" value={form.fecha_emision} onChange={e => handleInputChange('fecha_emision', e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
            </div>
            <div>
              <label htmlFor="doc-fecha-revision" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Fecha Revisión</label>
              <input id="doc-fecha-revision" type="date" value={form.fecha_revision} onChange={e => handleInputChange('fecha_revision', e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
            </div>
          </div>
          <div>
            <label htmlFor="doc-file-input" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>📎 Archivo del Documento (PDF/Word/Excel)</label>
            <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileChange} style={{ display: 'none' }} id="doc-file-input" />
            <button type="button" onClick={() => document.getElementById('doc-file-input')?.click()} style={{ padding: '8px 16px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 6, cursor: 'pointer', fontSize: 13, marginBottom: 8 }}>
              📎 Adjuntar archivo
            </button>
            {form.archivo_url && (
              <div style={{ marginTop: 8 }}>
                <a href={form.archivo_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1', textDecoration: 'underline' }}>Ver archivo adjunto</a>
                <button type="button" onClick={() => setForm(prev => ({ ...prev, archivo_url: '' }))} style={{ marginLeft: 12, padding: '4px 8px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Eliminar</button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={newDoc} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ padding: '10px 16px', background: loading ? '#94a3b8' : '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Guardando...' : editingDoc ? 'Actualizar' : 'Registrar Documento'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de documentos */}
      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1300 }}>
          <thead>
            <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Código</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Nombre</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Tipo</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Versión</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Responsable</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Emisión</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Revisión</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Retención</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Archivo</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Versiones</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.map((d) => {
              const estadoColor = ESTADO_COLORS[d.estado] || { bg: '#f3f4f6', text: '#374151' };
              const hasFile = !!d.archivo_url;
              const versionCount = docs.filter(x => x.codigo === d.codigo).length;
              return (
                <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 10, fontSize: 12, fontWeight: 500 }}>{d.codigo}</td>
                  <td style={{ padding: 10, fontSize: 12, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre}</td>
                  <td style={{ padding: 10, fontSize: 12 }}>{TIPO_LABELS[d.tipo] || d.tipo}</td>
                  <td style={{ padding: 10, fontSize: 12, fontWeight: 500, fontFamily: 'monospace' }}>{d.version}</td>
                  <td style={{ padding: 10 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: estadoColor.bg, color: estadoColor.text }}>{d.estado}</span>
                  </td>
                  <td style={{ padding: 10, fontSize: 12 }}>{d.responsable || '—'}</td>
                  <td style={{ padding: 10, fontSize: 12 }}>{d.fecha_emision?.slice(0, 10) || '—'}</td>
                  <td style={{ padding: 10, fontSize: 12 }}>{d.fecha_revision?.slice(0, 10) || '—'}</td>
                  <td style={{ padding: 10, fontSize: 12, fontWeight: 500, color: d.retencion_anos >= 20 ? '#ef4444' : '#374151' }}>{d.retencion_anos} años</td>
                  <td style={{ padding: 10, textAlign: 'center' }}>{hasFile ? '📎' : '—'}</td>
                  <td style={{ padding: 10, textAlign: 'center' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: versionCount > 1 ? '#dbeafe' : '#f3f4f6', color: versionCount > 1 ? '#1e40af' : '#6b7280' }}>
                      v{d.version} ({versionCount} total)
                    </span>
                  </td>
                  <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                    <button onClick={() => openDoc(d)} style={{ padding: '4px 8px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Ver</button>
                    <button onClick={() => editDoc(d)} style={{ padding: '4px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Editar</button>
                    <button onClick={() => createNewVersion(d)} style={{ padding: '4px 8px', background: '#059669', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }} aria-label="Crear nueva versión">➕ Ver.</button>
                    <button onClick={() => loadVersionHistory(d.codigo)} style={{ padding: '4px 8px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }} aria-label="Historial de versiones">📜</button>
                    <button onClick={() => handleDelete(d.id)} style={{ padding: '4px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>✕</button>
                  </td>
                </tr>
              );
            })}
            {filteredDocs.length === 0 && <tr><td colSpan={12} style={{ padding: 30, textAlign: 'center', color: '#9ca3af' }}>No hay documentos registrados</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Modal Ver Documento */}
      {viewingDoc && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, overflow: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 900, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: 20, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#0f766e' }}>{viewingDoc.codigo} - {viewingDoc.nombre}</h3>
              <button onClick={() => setViewingDoc(null)} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>✕ Cerrar</button>
            </div>
            <div style={{ padding: 20, maxHeight: '70vh', overflow: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div><strong>Código:</strong> {viewingDoc.codigo}</div>
                <div><strong>Versión:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{viewingDoc.version}</span></div>
                <div><strong>Tipo:</strong> {TIPO_LABELS[viewingDoc.tipo] || viewingDoc.tipo}</div>
                <div><strong>Estado:</strong> <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: ESTADO_COLORS[viewingDoc.estado]?.bg, color: ESTADO_COLORS[viewingDoc.estado]?.text }}>{viewingDoc.estado}</span></div>
                <div><strong>Responsable:</strong> {viewingDoc.responsable || '—'}</div>
                <div><strong>Retención:</strong> {viewingDoc.retencion_anos} años {viewingDoc.retencion_anos >= 20 && <span style={{ color: '#ef4444', marginLeft: 8 }}>⚠️ 20 años (médicos/exposición)</span>}</div>
                <div><strong>Emisión:</strong> {viewingDoc.fecha_emision?.slice(0, 10) || '—'}</div>
                <div><strong>Revisión:</strong> {viewingDoc.fecha_revision?.slice(0, 10) || '—'}</div>
              </div>
              {viewingDoc.archivo_url && (
                <div style={{ marginBottom: 16 }}>
                  <strong>Archivo:</strong>
                  <div style={{ marginTop: 8 }}>
                    <a href={viewingDoc.archivo_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1', textDecoration: 'underline' }}>Ver archivo adjunto</a>
                  </div>
                </div>
              )}
              <details style={{ marginTop: 16 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#0f766e' }}>📜 Ver historial de versiones de este código</summary>
                <div style={{ marginTop: 12 }}>
                  <button onClick={() => loadVersionHistory(viewingDoc.codigo)} style={{ padding: '8px 16px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cargar historial completo</button>
                </div>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historial de Versiones */}
      {showVersionHistory && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 20, overflow: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 1000, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: 20, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#0f766e' }}>Historial de Versiones - Código: {showVersionHistory}</h3>
              <button onClick={() => { setShowVersionHistory(null); setVersionHistory([]); }} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>✕ Cerrar</button>
            </div>
            <div style={{ padding: 20, maxHeight: '70vh', overflow: 'auto' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                      <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Versión</th>
                      <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Nombre</th>
                      <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th>
                      <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Responsable</th>
                      <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Emisión</th>
                      <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Revisión</th>
                      <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Retención</th>
                      <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Archivo</th>
                      <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Creado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versionHistory.map((v) => {
                      const estadoColor = ESTADO_COLORS[v.estado] || { bg: '#f3f4f6', text: '#374151' };
                      const hasFile = !!v.archivo_url;
                      return (
                        <tr key={v.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: 10, fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' }}>{v.version}</td>
                          <td style={{ padding: 10, fontSize: 12 }}>{v.nombre}</td>
                          <td style={{ padding: 10 }}>
                            <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: estadoColor.bg, color: estadoColor.text }}>{v.estado}</span>
                          </td>
                          <td style={{ padding: 10, fontSize: 12 }}>{v.responsable || '—'}</td>
                          <td style={{ padding: 10, fontSize: 12 }}>{v.fecha_emision?.slice(0, 10) || '—'}</td>
                          <td style={{ padding: 10, fontSize: 12 }}>{v.fecha_revision?.slice(0, 10) || '—'}</td>
                          <td style={{ padding: 10, fontSize: 12 }}>{v.retencion_anos} años</td>
                          <td style={{ padding: 10, textAlign: 'center' }}>{hasFile ? '📎' : '—'}</td>
                          <td style={{ padding: 10, fontSize: 12 }}>{new Date(v.creado_en).toLocaleDateString('es-CO')}</td>
                        </tr>
                      );
                    })}
                    {versionHistory.length === 0 && <tr><td colSpan={9} style={{ padding: 30, textAlign: 'center', color: '#9ca3af' }}>No hay historial de versiones</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}