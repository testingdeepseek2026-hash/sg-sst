import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';

const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  pendiente: { bg: '#fef3c7', text: '#92400e' },
  aprobado: { bg: '#dcfce7', text: '#166534' },
  rechazado: { bg: '#fee2e2', text: '#dc2626' },
};

const REQUISITO_LABELS: Record<string, string> = {
  examen_medico: '🩺 Examen médico',
  capacitacion_sst: '📚 Capacitación SST',
  epp: '🛡️ EPP entregado',
};

interface Contractor {
  id: string;
  nombre: string;
  nit?: string;
  servicio: string;
  arl?: string;
  examen_medico: number;
  capacitacion_sst: number;
  epp: number;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  fecha_evaluacion?: string;
  notas?: string;
  creado_en: string;
  actualizado_en: string;
}

interface ContractorForm {
  nombre: string;
  nit: string;
  servicio: string;
  arl: string;
  examen_medico: number;
  capacitacion_sst: number;
  epp: number;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  fecha_evaluacion: string;
  notas: string;
}

const initialForm: ContractorForm = {
  nombre: '',
  nit: '',
  servicio: '',
  arl: '',
  examen_medico: 0,
  capacitacion_sst: 0,
  epp: 0,
  estado: 'pendiente',
  fecha_evaluacion: new Date().toISOString().slice(0, 10),
  notas: '',
};

export default function Contratistas() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [form, setForm] = useState<ContractorForm>(initialForm);
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);
  const [viewingContractor, setViewingContractor] = useState<Contractor | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadContractors = useCallback(async () => {
    try {
      const data = await api.get('/contractors');
      setContractors(data as Contractor[]);
    } catch (err: any) {
      console.error('Error cargando contratistas:', err);
    }
  }, []);

  useEffect(() => {
    loadContractors();
  }, [loadContractors]);

  const showToast = (msg: string, isError = false) => {
    setMessage({ type: isError ? 'error' : 'success', text: msg });
    setTimeout(() => setMessage(null), 4000);
  };

  const openContractor = (c: Contractor) => {
    setViewingContractor(c);
    setForm({ ...initialForm, ...c, examen_medico: c.examen_medico, capacitacion_sst: c.capacitacion_sst, epp: c.epp });
  };

  const editContractor = (c: Contractor) => {
    setEditingContractor(c);
    setForm({ ...initialForm, ...c, examen_medico: c.examen_medico, capacitacion_sst: c.capacitacion_sst, epp: c.epp });
  };

  const newContractor = () => {
    setEditingContractor(null);
    setViewingContractor(null);
    setForm(initialForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (editingContractor) {
        await api.put(`/contractors/${editingContractor.id}`, form);
        showToast('Contratista actualizado correctamente');
      } else {
        await api.post('/contractors', form);
        showToast('Contratista registrado correctamente');
      }
      newContractor();
      loadContractors();
    } catch (err: any) {
      showToast(err.message || 'Error guardando contratista', true);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este contratista?')) return;
    try {
      await api.delete(`/contractors/${id}`);
      showToast('Contratista eliminado');
      loadContractors();
    } catch (err: any) {
      showToast(err.message || 'Error eliminando', true);
    }
  };

  const getRequisitosCumplidos = (c: Contractor) => {
    const items = [c.examen_medico, c.capacitacion_sst, c.epp].filter(Boolean).length;
    return `${items}/3`;
  };

  const isApto = (c: Contractor) => c.examen_medico && c.capacitacion_sst && c.epp;

  return (
    <div style={{ padding: 20, maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, color: '#0f766e' }}>Gestión de Contratistas y Proveedores</h1>
        <button onClick={newContractor} style={{ padding: '10px 16px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
          + Nuevo Contratista
        </button>
      </div>

      <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 16 }}>
        Evaluación de requisitos SST para contratistas (Res. 0312/2019 E14, E15, E19).
        Requisitos: examen médico vigente, capacitación SST, EPP entregado.
      </p>

      {message && (
        <div style={{ background: message.type === 'success' ? '#ecfdf5' : '#fef2f2', border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`, color: message.type === 'success' ? '#065f46' : '#991b1b', padding: 10, borderRadius: 8, marginBottom: 14 }}>
          {message.text}
        </div>
      )}

      {/* Formulario */}
      <div style={{ background: '#fff', padding: 16, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>{editingContractor ? 'Editar Contratista' : viewingContractor ? 'Ver Contratista' : 'Nuevo Contratista'}</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
            <div>
              <label htmlFor="cont-nombre" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Nombre / Razón Social *</label>
              <input id="cont-nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Instalaciones Eléctricas SAS" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
            </div>
            <div>
              <label htmlFor="cont-nit" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>NIT</label>
              <input id="cont-nit" value={form.nit} onChange={e => setForm({ ...form, nit: e.target.value })} placeholder="900.123.456-7" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
            </div>
            <div>
              <label htmlFor="cont-servicio" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Servicio / Actividad *</label>
              <input id="cont-servicio" value={form.servicio} onChange={e => setForm({ ...form, servicio: e.target.value })} placeholder="Ej: Instalación tableros, tendido cableado, mantenimiento UPS" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
            </div>
            <div>
              <label htmlFor="cont-arl" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>ARL</label>
              <input id="cont-arl" value={form.arl} onChange={e => setForm({ ...form, arl: e.target.value })} placeholder="Ej: Positiva, Sura, Colmena" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
            </div>
          </div>

          {/* Requisitos SST */}
          <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
            <strong style={{ color: '#166534', display: 'block', marginBottom: 8 }}>✅ Requisitos SST (Res. 0312/2019 E14, E15, E19)</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={form.examen_medico === 1} onChange={e => setForm({ ...form, examen_medico: e.target.checked ? 1 : 0 })} />
                <span>Examen médico ocupacional vigente (ingreso/periódico)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={form.capacitacion_sst === 1} onChange={e => setForm({ ...form, capacitacion_sst: e.target.checked ? 1 : 0 })} />
                <span>Capacitación SST / Inducción / Trabajo seguro</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={form.epp === 1} onChange={e => setForm({ ...form, epp: e.target.checked ? 1 : 0 })} />
                <span>EPP entregado según riesgo de la actividad</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value as any })} style={{ padding: 6, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, minWidth: 180 }}>
                  <option value="pendiente">Pendiente de evaluación</option>
                  <option value="aprobado">Aprobado - Cumple todos los requisitos</option>
                  <option value="rechazado">Rechazado - No cumple requisitos</option>
                </select>
                <span>Estado de evaluación</span>
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="cont-fecha-eval" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Fecha de evaluación</label>
            <input id="cont-fecha-eval" type="date" value={form.fecha_evaluacion} onChange={e => setForm({ ...form, fecha_evaluacion: e.target.value })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
          </div>

          <div>
            <label htmlFor="cont-notas" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Observaciones / Condiciones</label>
            <textarea id="cont-notas" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} rows={3} placeholder="Restricciones de acceso, áreas permitidas, vigencia de aprobación, contactos de emergencia..." style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', resize: 'vertical', fontSize: 13 }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={newContractor} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ padding: '10px 16px', background: loading ? '#94a3b8' : '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Guardando...' : editingContractor ? 'Actualizar' : 'Registrar Contratista'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de contratistas */}
      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
          <thead>
            <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Contratista</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>NIT</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Servicio</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>ARL</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Requisitos</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Fecha Eval.</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {contractors.map((c) => {
              const estadoColor = ESTADO_COLORS[c.estado] || { bg: '#f3f4f6', text: '#374151' };
              const apto = isApto(c);
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6', background: apto && c.estado === 'aprobado' ? '#f0fdf4' : '' }}>
                  <td style={{ padding: 10, fontSize: 12, fontWeight: 500 }}>{c.nombre}</td>
                  <td style={{ padding: 10, fontSize: 12 }}>{c.nit || '—'}</td>
                  <td style={{ padding: 10, fontSize: 12, maxWidth: '200px' }}>{c.servicio}</td>
                  <td style={{ padding: 10, fontSize: 12 }}>{c.arl || '—'}</td>
                  <td style={{ padding: 10, fontSize: 12 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 'bold', background: c.examen_medico ? '#dcfce7' : '#fee2e2', color: c.examen_medico ? '#166534' : '#991b1b' }}>{REQUISITO_LABELS.examen_medico}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 'bold', background: c.capacitacion_sst ? '#dcfce7' : '#fee2e2', color: c.capacitacion_sst ? '#166534' : '#991b1b' }}>{REQUISITO_LABELS.capacitacion_sst}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 'bold', background: c.epp ? '#dcfce7' : '#fee2e2', color: c.epp ? '#166534' : '#991b1b' }}>{REQUISITO_LABELS.epp}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{getRequisitosCumplidos(c)} {apto ? '✅' : '⚠️'}</div>
                  </td>
                  <td style={{ padding: 10 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: estadoColor.bg, color: estadoColor.text }}>{c.estado}</span>
                  </td>
                  <td style={{ padding: 10, fontSize: 12 }}>{c.fecha_evaluacion ? new Date(c.fecha_evaluacion).toLocaleDateString('es-CO') : '—'}</td>
                  <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                    <button onClick={() => openContractor(c)} style={{ padding: '4px 8px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Ver</button>
                    <button onClick={() => editContractor(c)} style={{ padding: '4px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Editar</button>
                    <button onClick={() => handleDelete(c.id)} style={{ padding: '4px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>✕</button>
                  </td>
                </tr>
              );
            })}
            {contractors.length === 0 && <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center', color: '#9ca3af' }}>No hay contratistas registrados</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Modal Ver Contratista */}
      {viewingContractor && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, overflow: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 700, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: 20, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#0f766e' }}>{viewingContractor.nombre}</h3>
              <button onClick={() => setViewingContractor(null)} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>✕ Cerrar</button>
            </div>
            <div style={{ padding: 20, maxHeight: '70vh', overflow: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div><strong>NIT:</strong> {viewingContractor.nit || '—'}</div>
                <div><strong>Servicio:</strong> {viewingContractor.servicio}</div>
                <div><strong>ARL:</strong> {viewingContractor.arl || '—'}</div>
                <div><strong>Fecha evaluación:</strong> {viewingContractor.fecha_evaluacion ? new Date(viewingContractor.fecha_evaluacion).toLocaleDateString('es-CO') : '—'}</div>
                <div><strong>Estado:</strong> <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: (ESTADO_COLORS[viewingContractor.estado] || { bg: '#f3f4f6' }).bg, color: (ESTADO_COLORS[viewingContractor.estado] || { text: '#374151' }).text }}>{viewingContractor.estado}</span></div>
                <div><strong>Requisitos:</strong> {getRequisitosCumplidos(viewingContractor)} {isApto(viewingContractor) ? '✅' : '⚠️'}</div>
              </div>
              <div style={{ marginBottom: 16, padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <strong>Detalle de requisitos:</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
                  <span style={{ color: viewingContractor.examen_medico ? '#16a34a' : '#ef4444' }}>{viewingContractor.examen_medico ? '✅' : '❌'} Examen médico</span>
                  <span style={{ color: viewingContractor.capacitacion_sst ? '#16a34a' : '#ef4444' }}>{viewingContractor.capacitacion_sst ? '✅' : '❌'} Capacitación SST</span>
                  <span style={{ color: viewingContractor.epp ? '#16a34a' : '#ef4444' }}>{viewingContractor.epp ? '✅' : '❌'} EPP entregado</span>
                </div>
              </div>
              {viewingContractor.notas && (
                <div style={{ marginBottom: 16 }}>
                  <strong>Observaciones:</strong>
                  <p style={{ marginTop: 4, whiteSpace: 'pre-wrap', background: '#f9fafb', padding: 12, borderRadius: 6 }}>{viewingContractor.notas}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}