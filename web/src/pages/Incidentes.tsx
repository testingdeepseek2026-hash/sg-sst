import { useCallback, useEffect, useState } from 'react';

import { api } from '../lib/api';

interface Incident {
  id: string;
  tipo: 'incidente' | 'accidente' | 'enfermedad_laboral';
  codigo: string;
  fecha_ocurrencia: string;
  fecha_reporte: string | null;
  trabajador_id: string | null;
  lugar: string | null;
  descripcion: string;
  lesiones: string | null;
  causa_raiz: string | null;
  acciones_correctivas: string | null;
  reporte_arl: boolean;
  reporte_eps: boolean;
  reporte_mintrabajo: boolean;
  dias_perdidos: number;
  estado: 'abierto' | 'investigando' | 'cerrado';
  investigador: string | null;
  fecha_cierre: string | null;
  creado_en: string;
}

interface CorrectiveAction {
  id: string;
  incident_id: string;
  descripcion: string;
  responsable: string;
  fecha_limite: string;
  estado: 'pendiente' | 'en_proceso' | 'completada' | 'vencida';
  evidencia_url: string | null;
  creado_en: string;
  completada_en: string | null;
}

interface Worker {
  id: string;
  nombres: string;
  apellidos: string;
  numero_documento: string;
  estado: 'activo' | 'inactivo' | 'retirado';
}

const TIPO_LABELS: Record<string, string> = {
  incidente: 'Incidente',
  accidente: 'Accidente de trabajo',
  enfermedad_laboral: 'Enfermedad laboral',
};

const ESTADO_LABELS: Record<string, string> = {
  abierto: 'Abierto',
  investigando: 'En investigaci\u00f3n',
  cerrado: 'Cerrado',
};

const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  abierto: { bg: '#fef2f2', text: '#991b1b' },
  investigando: { bg: '#fef3c7', text: '#92400e' },
  cerrado: { bg: '#dcfce7', text: '#166534' },
};

const ACCION_ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  pendiente: { bg: '#fef2f2', text: '#991b1b' },
  en_proceso: { bg: '#fef3c7', text: '#92400e' },
  completada: { bg: '#dcfce7', text: '#166534' },
  vencida: { bg: '#fee2e2', text: '#dc2626' },
};

const addBusinessDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      added++;
    }
  }
  return result;
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('es-CO');
};

const getDeadlineStatus = (deadlineStr: string | null, completed: boolean) => {
  if (!deadlineStr || completed)
    return { label: completed ? 'Completada' : 'Sin fecha', color: '#6b7280', bg: '#f3f4f6' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(deadlineStr);
  deadline.setHours(0, 0, 0, 0);
  const diff = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0)
    return { label: `Vencida (${Math.abs(diff)} d\u00edas)`, color: '#dc2626', bg: '#fee2e2' };
  if (diff === 0) return { label: 'Vence hoy', color: '#f59e0b', bg: '#fef3c7' };
  if (diff <= 3)
    return { label: `Por vencer (${diff} d\u00edas)`, color: '#f59e0b', bg: '#fef3c7' };
  return { label: `${diff} d\u00edas`, color: '#16a34a', bg: '#dcfce7' };
};

const getArlDeadline = (fechaOcurrencia: string) => {
  const fecha = new Date(fechaOcurrencia);
  return addBusinessDays(fecha, 2).toISOString().slice(0, 10);
};

const INITIAL_FORM = {
  tipo: 'incidente' as const,
  fecha_ocurrencia: new Date().toISOString().slice(0, 10),
  lugar: '',
  trabajador_id: '',
  descripcion: '',
  lesiones: '',
  causa_raiz: '',
  acciones_correctivas: '',
  reporte_arl: false,
  reporte_eps: false,
  reporte_mintrabajo: false,
  dias_perdidos: 0,
  estado: 'abierto' as const,
  investigador: '',
};

const INITIAL_ACTION = {
  incident_id: '',
  descripcion: '',
  responsable: '',
  fecha_limite: '',
  estado: 'pendiente' as CorrectiveAction['estado'],
  evidencia_url: null as string | null,
};

export default function Incidentes() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [activeTab, setActiveTab] = useState<
    'registro' | 'investigacion' | 'acciones' | 'seguimiento'
  >('registro');
  const [form, setForm] = useState(INITIAL_FORM);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [actionForm, setActionForm] = useState(INITIAL_ACTION);
  const [editingAction, setEditingAction] = useState<CorrectiveAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadIncidents();
    loadWorkers();
  }, []);

  const loadIncidents = async () => {
    try {
      const data = await api.get('/incidents');
      setIncidents(data as Incident[]);
    } catch (err: any) {
      console.error('Error cargando incidentes:', err);
    }
  };

  const loadWorkers = async () => {
    try {
      const data = await api.get('/workers');
      setWorkers((data as Worker[]).filter((w) => w.estado === 'activo'));
    } catch (err: any) {
      console.error('Error cargando trabajadores:', err);
    }
  };

  const loadIncidentDetails = useCallback(async (incidentId: string) => {
    try {
      const [inc, acts] = await Promise.all([
        api.get(`/incidents/${incidentId}`),
        api.get(`/incidents/${incidentId}/actions`),
      ]);
      setSelectedIncident(inc as Incident);
      setActions(acts as CorrectiveAction[]);
      setForm({
        ...INITIAL_FORM,
        ...inc,
        reporte_arl: !!inc.reporte_arl,
        reporte_eps: !!inc.reporte_eps,
        reporte_mintrabajo: !!inc.reporte_mintrabajo,
      });
    } catch (err: any) {
      console.error('Error cargando detalle:', err);
    }
  }, []);

  const handleInputChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (selectedIncident) {
        await api.put(`/incidents/${selectedIncident.id}`, form);
        _showMessage('success', 'Incidente actualizado correctamente');
      } else {
        await api.post('/incidents', form);
        _showMessage('success', 'Incidente registrado correctamente');
        setForm(INITIAL_FORM);
      }
      loadIncidents();
    } catch (err: any) {
      _showMessage('error', err.message || 'Error guardando incidente');
    } finally {
      setLoading(false);
    }
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const payload = { ...actionForm, incident_id: selectedIncident!.id };
      if (editingAction) {
        await (api.put as (path: string, body?: any) => Promise<any>)(`/incidents/${selectedIncident!.id}/actions/${editingAction.id}`, payload);
        _showMessage('success', 'Acci\u00f3n actualizada correctamente');
      } else {
        await (api.post as (path: string, body?: any) => Promise<any>)(`/incidents/${selectedIncident!.id}/actions`, payload);
        _showMessage('success', 'Acci\u00f3n registrada correctamente');
      }
      setActionForm(INITIAL_ACTION);
      setEditingAction(null);
      loadIncidentDetails(selectedIncident!.id);
    } catch (err: any) {
      _showMessage('error', err.message || 'Error guardando acci\u00f3n');
    } finally {
      setLoading(false);
    }
  };

  const handleActionComplete = async (actionId: string) => {
    try {
      await (api.put as (path: string, body?: any) => Promise<any>)(`/incidents/${selectedIncident!.id}/actions/${actionId}`, {
        estado: 'completada',
        completada_en: new Date().toISOString(),
      });
      loadIncidentDetails(selectedIncident!.id);
    } catch (err: any) {
      _showMessage('error', err.message || 'Error completando acci\u00f3n');
    }
  };

  const handleDeleteAction = async (actionId: string) => {
    if (!confirm('Eliminar esta acci\u00f3n correctiva?')) return;
    try {
      await (api.del as (path: string) => Promise<any>)(`/incidents/${selectedIncident!.id}/actions/${actionId}`);
      loadIncidentDetails(selectedIncident!.id);
    } catch (err: any) {
      _showMessage('error', err.message || 'Error eliminando acci\u00f3n');
    }
  };

  const openIncident = (inc: Incident) => {
    setActiveTab('investigacion');
    loadIncidentDetails(inc.id);
  };

  const newIncident = () => {
    setSelectedIncident(null);
    setForm(INITIAL_FORM);
    setActiveTab('registro');
  };

  const getArlDeadlineDisplay = (inc: Incident) => {
    if (!inc.fecha_ocurrencia) return null;
    const deadline = getArlDeadline(inc.fecha_ocurrencia);
    const completed = !!inc.reporte_arl;
    const status = getDeadlineStatus(deadline, completed);
    return { deadline, status };
  };

  const _showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  return (
    <div style={{ padding: 20, maxWidth: 1100 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h1 style={{ margin: 0, color: '#0f766e' }}>
          Reporte e Investigaci\u00f3n de Incidentes y Accidentes de Trabajo
        </h1>
        <button
          onClick={newIncident}
          style={{
            padding: '10px 16px',
            background: '#0f766e',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          + Nuevo Reporte
        </button>
      </div>

      {message && (
        <div
          style={{
            background: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            color: message.type === 'success' ? '#065f46' : '#991b1b',
            padding: 10,
            borderRadius: 8,
            marginBottom: 14,
          }}
        >
          {message.text}
        </div>
      )}

      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 16 }}>
        {[
          { id: 'registro', label: '\ud83d\udcdd Registro' },
          { id: 'investigacion', label: '\ud83d\udd0d Investigaci\u00f3n' },
          { id: 'acciones', label: '\u2705 Acciones Correctivas' },
          { id: 'seguimiento', label: '\ud83d\udcca Seguimiento' },
        ].map((tab) => (
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
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: REGISTRO */}
      {activeTab === 'registro' && (
        <div>
          <div
            style={{
              background: '#fff',
              padding: 16,
              borderRadius: 10,
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              marginBottom: 16,
            }}
          >
            <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>
              Nuevo Reporte de Incidente/Accidente
            </h3>
            <form
              onSubmit={handleSubmit}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
              }}
            >
              <div>
                <label
                  htmlFor="inc-tipo"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  Tipo *
                </label>
                <select
                  id="inc-tipo"
                  value={form.tipo}
                  onChange={(e) => handleInputChange('tipo', e.target.value)}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                  }}
                  required
                >
                  <option value="incidente">Incidente (sin lesi\u00f3n)</option>
                  <option value="accidente">Accidente de trabajo (con lesi\u00f3n)</option>
                  <option value="enfermedad_laboral">Enfermedad laboral</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="inc-fecha"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  Fecha ocurrencia *
                </label>
                <input
                  id="inc-fecha"
                  type="date"
                  value={form.fecha_ocurrencia}
                  onChange={(e) => handleInputChange('fecha_ocurrencia', e.target.value)}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                  }}
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="inc-lugar"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  Lugar
                </label>
                <input
                  id="inc-lugar"
                  value={form.lugar}
                  onChange={(e) => handleInputChange('lugar', e.target.value)}
                  placeholder="Ej: Planta 2, Fachada norte, Veh\u00edculo placa XXX"
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="inc-trabajador"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  Trabajador afectado
                </label>
                <select
                  id="inc-trabajador"
                  value={form.trabajador_id}
                  onChange={(e) => handleInputChange('trabajador_id', e.target.value)}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                  }}
                >
                  <option value="">\u2014 Seleccionar \u2014</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.nombres} {w.apellidos} ({w.numero_documento})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  htmlFor="inc-desc"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  Descripci\u00f3n del suceso *
                </label>
                <textarea
                  id="inc-desc"
                  value={form.descripcion}
                  onChange={(e) => handleInputChange('descripcion', e.target.value)}
                  placeholder="Describa qu\u00e9 ocurri\u00f3, c\u00f3mo ocurri\u00f3, condiciones del entorno..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                  required
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  htmlFor="inc-lesiones"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  Lesiones / Afectaci\u00f3n a la salud
                </label>
                <textarea
                  id="inc-lesiones"
                  value={form.lesiones}
                  onChange={(e) => handleInputChange('lesiones', e.target.value)}
                  placeholder="Describa lesiones, parte del cuerpo afectada, gravedad..."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  htmlFor="inc-causa"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  An\u00e1lisis de causa ra\u00edz (m\u00e9todo 5 porqu\u00e9s, \u00e1rbol de
                  causas, etc.)
                </label>
                <textarea
                  id="inc-causa"
                  value={form.causa_raiz}
                  onChange={(e) => handleInputChange('causa_raiz', e.target.value)}
                  placeholder="Describa el an\u00e1lisis de causa ra\u00edz realizado..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  htmlFor="inc-acciones"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  Acciones correctivas inmediatas tomadas
                </label>
                <textarea
                  id="inc-acciones"
                  value={form.acciones_correctivas}
                  onChange={(e) => handleInputChange('acciones_correctivas', e.target.value)}
                  placeholder="Describa medidas inmediatas para evitar recurrencia..."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  htmlFor="inc-investigador"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  Investigador responsable
                </label>
                <input
                  id="inc-investigador"
                  value={form.investigador}
                  onChange={(e) => handleInputChange('investigador', e.target.value)}
                  placeholder="Nombre del responsable de la investigaci\u00f3n"
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  htmlFor="inc-dias"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  D\u00edas perdidos / incapacidad
                </label>
                <input
                  id="inc-dias"
                  type="number"
                  min="0"
                  value={form.dias_perdidos}
                  onChange={(e) =>
                    handleInputChange('dias_perdidos', parseInt(e.target.value) || 0)
                  }
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.reporte_arl}
                    onChange={(e) => handleInputChange('reporte_arl', e.target.checked)}
                  />
                  <span>
                    Reporte a ARL (plazo legal: 2 d\u00edas h\u00e1biles - Decreto 1072/2015 Art.
                    2.2.4.6.22)
                  </span>
                </label>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.reporte_eps}
                    onChange={(e) => handleInputChange('reporte_eps', e.target.checked)}
                  />
                  <span>Reporte a EPS (atenci\u00f3n m\u00e9dica inmediata)</span>
                </label>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.reporte_mintrabajo}
                    onChange={(e) => handleInputChange('reporte_mintrabajo', e.target.checked)}
                  />
                  <span>
                    Reporte al MinTrabajo (accidentes graves/mortales - Decreto 1072/2015 Art.
                    2.2.4.6.23)
                  </span>
                </label>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 8,
                  marginTop: 8,
                  gridColumn: '1 / -1',
                }}
              >
                <button
                  type="button"
                  onClick={newIncident}
                  style={{
                    padding: '10px 16px',
                    background: '#e5e7eb',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Limpiar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '10px 16px',
                    background: loading ? '#94a3b8' : '#0f766e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 'bold',
                  }}
                >
                  {selectedIncident ? 'Actualizar' : 'Registrar Incidente'}
                </button>
              </div>
            </form>
          </div>

          <details style={{ marginTop: 16, fontSize: 12, color: '#6b7280' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#374151' }}>
              Plazos legales de reporte (Colombia)
            </summary>
            <div
              style={{
                marginTop: 12,
                padding: 12,
                background: '#f9fafb',
                borderRadius: 6,
                lineHeight: 1.7,
              }}
            >
              <strong>Decreto 1072/2015 (Art. 2.2.4.6.22 y 2.2.4.6.23) - Res. 0312/2019:</strong>
              <ul style={{ margin: '8px 0 0 20px' }}>
                <li>
                  <strong>ARL:</strong> Reporte dentro de los{' '}
                  <strong>2 d\u00edas h\u00e1biles</strong> siguientes al accidente (Art.
                  2.2.4.6.22).
                </li>
                <li>
                  <strong>EPS:</strong> Atenci\u00f3n m\u00e9dica inmediata y reporte
                  simult\u00e1neo.
                </li>
                <li>
                  <strong>Ministerio del Trabajo:</strong> Accidentes graves y mortales dentro de
                  las <strong>24 horas</strong> (Art. 2.2.4.6.23).
                </li>
                <li>
                  <strong>Enfermedades laborales:</strong> Reporte a ARL y EPS dentro de{' '}
                  <strong>2 d\u00edas h\u00e1biles</strong> tras diagn\u00f3stico.
                </li>
              </ul>
              <p style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                Los d\u00edas h\u00e1biles excluyen s\u00e1bados, domingos y festivos. El plazo
                inicia al d\u00eda siguiente de la ocurrencia.
              </p>
            </div>
          </details>
        </div>
      )}

      {/* TAB 2: INVESTIGACI\u00d3N */}
      {activeTab === 'investigacion' && (
        <div>
          {!selectedIncident ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
              <p>
                Seleccione un incidente de la lista o cree uno nuevo en la pesta\u00f1a{' '}
                <strong>Registro</strong> para iniciar la investigaci\u00f3n.
              </p>
            </div>
          ) : (
            <div>
              <div
                style={{
                  background: '#fff',
                  padding: 16,
                  borderRadius: 10,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                  marginBottom: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 4px', color: '#0f766e' }}>
                    {TIPO_LABELS[selectedIncident.tipo]} -{' '}
                    {selectedIncident.codigo || selectedIncident.id.slice(0, 8)}
                  </h3>
                  <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
                    {selectedIncident.trabajador_id
                      ? `Trabajador: ${selectedIncident.trabajador_id}`
                      : 'Sin trabajador asignado'}{' '}
                    \u00b7 {formatDate(selectedIncident.fecha_ocurrencia)}
                  </p>
                </div>
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 'bold',
                    background: ESTADO_COLORS[selectedIncident.estado].bg,
                    color: ESTADO_COLORS[selectedIncident.estado].text,
                  }}
                >
                  {ESTADO_LABELS[selectedIncident.estado]}
                </span>
              </div>

              {message && (
                <div
                  style={{
                    background: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
                    border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                    color: message.type === 'success' ? '#065f46' : '#991b1b',
                    padding: 10,
                    borderRadius: 8,
                    marginBottom: 14,
                  }}
                >
                  {message.text}
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                style={{
                  background: '#fff',
                  padding: 16,
                  borderRadius: 10,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                  marginBottom: 16,
                }}
              >
                <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>Detalle del Incidente</h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 12,
                  }}
                >
                  <div>
                    <label
                      htmlFor="inc-tipo"
                      style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                    >
                      Tipo
                    </label>
                    <select
                      id="inc-tipo"
                      value={form.tipo}
                      onChange={(e) => handleInputChange('tipo', e.target.value)}
                      style={{
                        width: '100%',
                        padding: 8,
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                      }}
                    >
                      <option value="incidente">Incidente</option>
                      <option value="accidente">Accidente</option>
                      <option value="enfermedad_laboral">Enfermedad laboral</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="inc-fecha"
                      style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                    >
                      Fecha ocurrencia
                    </label>
                    <input
                      id="inc-fecha"
                      type="date"
                      value={form.fecha_ocurrencia}
                      onChange={(e) => handleInputChange('fecha_ocurrencia', e.target.value)}
                      style={{
                        width: '100%',
                        padding: 8,
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                      }}
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="inc-lugar"
                      style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                    >
                      Lugar
                    </label>
                    <input
                      id="inc-lugar"
                      value={form.lugar}
                      onChange={(e) => handleInputChange('lugar', e.target.value)}
                      style={{
                        width: '100%',
                        padding: 8,
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                      }}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="inc-estado"
                      style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                    >
                      Estado
                    </label>
                    <select
                      id="inc-estado"
                      value={form.estado}
                      onChange={(e) => handleInputChange('estado', e.target.value)}
                      style={{
                        width: '100%',
                        padding: 8,
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                      }}
                    >
                      <option value="abierto">Abierto</option>
                      <option value="investigando">En investigaci\u00f3n</option>
                      <option value="cerrado">Cerrado</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label
                      htmlFor="inc-descripcion"
                      style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                    >
                      Descripci\u00f3n
                    </label>
                    <textarea
                      id="inc-descripcion"
                      value={form.descripcion}
                      onChange={(e) => handleInputChange('descripcion', e.target.value)}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: 8,
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        fontFamily: 'inherit',
                        resize: 'vertical',
                      }}
                      required
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label
                      htmlFor="inc-lesiones"
                      style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                    >
                      Lesiones
                    </label>
                    <textarea
                      id="inc-lesiones"
                      value={form.lesiones}
                      onChange={(e) => handleInputChange('lesiones', e.target.value)}
                      rows={2}
                      style={{
                        width: '100%',
                        padding: 8,
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        fontFamily: 'inherit',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label
                      htmlFor="inc-causa"
                      style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                    >
                      An\u00e1lisis de causa ra\u00edz
                    </label>
                    <textarea
                      id="inc-causa"
                      value={form.causa_raiz}
                      onChange={(e) => handleInputChange('causa_raiz', e.target.value)}
                      rows={4}
                      style={{
                        width: '100%',
                        padding: 8,
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        fontFamily: 'inherit',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label
                      htmlFor="inc-acciones"
                      style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                    >
                      Acciones correctivas
                    </label>
                    <textarea
                      id="inc-acciones"
                      value={form.acciones_correctivas}
                      onChange={(e) => handleInputChange('acciones_correctivas', e.target.value)}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: 8,
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        fontFamily: 'inherit',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="inc-investigador"
                      style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                    >
                      Investigador
                    </label>
                    <input
                      id="inc-investigador"
                      value={form.investigador}
                      onChange={(e) => handleInputChange('investigador', e.target.value)}
                      style={{
                        width: '100%',
                        padding: 8,
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                      }}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="inc-dias"
                      style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                    >
                      D\u00edas perdidos
                    </label>
                    <input
                      id="inc-dias"
                      type="number"
                      min="0"
                      value={form.dias_perdidos}
                      onChange={(e) =>
                        handleInputChange('dias_perdidos', parseInt(e.target.value) || 0)
                      }
                      style={{
                        width: '100%',
                        padding: 8,
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 16,
                      alignItems: 'center',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={form.reporte_arl}
                        onChange={(e) => handleInputChange('reporte_arl', e.target.checked)}
                      />
                      <span>Reporte ARL (2 d\u00edas h\u00e1biles)</span>
                    </label>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={form.reporte_eps}
                        onChange={(e) => handleInputChange('reporte_eps', e.target.checked)}
                      />
                      <span>Reporte EPS</span>
                    </label>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={form.reporte_mintrabajo}
                        onChange={(e) => handleInputChange('reporte_mintrabajo', e.target.checked)}
                      />
                      <span>Reporte MinTrabajo (graves/mortales)</span>
                    </label>
                  </div>
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        padding: '10px 16px',
                        background: loading ? '#94a3b8' : '#0f766e',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontWeight: 'bold',
                      }}
                    >
                      {loading ? 'Guardando...' : '\ud83d\udcc8 Guardar cambios'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Plazos legales ARL */}
              {selectedIncident.fecha_ocurrencia && (
                <div
                  style={{
                    background: '#fff',
                    padding: 16,
                    borderRadius: 10,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                    marginBottom: 16,
                  }}
                >
                  <h3 style={{ margin: '0 0 12px', color: '#0f766e' }}>
                    Plazos Legales de Reporte
                  </h3>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                      }}
                    >
                      <div
                        style={{ fontSize: 11, color: '#991b1b', fontWeight: 600, marginBottom: 4 }}
                      >
                        \ud83d\udccb Reporte ARL (Decreto 1072/2015 Art. 2.2.4.6.22)
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 'bold', color: '#dc2626' }}>
                        {getArlDeadlineDisplay(selectedIncident)?.deadline
                          ? formatDate(getArlDeadlineDisplay(selectedIncident)!.deadline)
                          : '\u2014'}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: getArlDeadlineDisplay(selectedIncident)?.status.color,
                          marginTop: 4,
                        }}
                      >
                        {getArlDeadlineDisplay(selectedIncident)?.status.label}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                        Plazo: 2 d\u00edas h\u00e1biles desde ocurrencia (
                        {formatDate(selectedIncident.fecha_ocurrencia)})
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            cursor: 'pointer',
                            fontSize: 13,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIncident.reporte_arl}
                            onChange={() =>
                              handleInputChange('reporte_arl', !selectedIncident.reporte_arl)
                            }
                          />
                          <span>Marcar como reportado</span>
                        </label>
                      </div>
                    </div>
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                      }}
                    >
                      <div
                        style={{ fontSize: 11, color: '#166534', fontWeight: 600, marginBottom: 4 }}
                      >
                        \ud83c\udfe5 Reporte EPS (Atenci\u00f3n m\u00e9dica inmediata)
                      </div>
                      <div style={{ fontSize: 12, color: '#16a34a', marginBottom: 4 }}>
                        Inmediato / D\u00eda de ocurrencia
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
                        El trabajador debe ser remitido a la EPS de inmediato para atenci\u00f3n
                        m\u00e9dica.
                      </div>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIncident.reporte_eps}
                          onChange={() =>
                            handleInputChange('reporte_eps', !selectedIncident.reporte_eps)
                          }
                        />
                        <span>Marcar como reportado</span>
                      </label>
                    </div>
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                      }}
                    >
                      <div
                        style={{ fontSize: 11, color: '#92400e', fontWeight: 600, marginBottom: 4 }}
                      >
                        \u26a0\ufe0f Reporte MinTrabajo (Decreto 1072/2015 Art. 2.2.4.6.23)
                      </div>
                      <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 4 }}>
                        24 horas (accidentes graves/mortales)
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
                        Solo para accidentes graves (hospitalizaci\u00f3n \u003e24h,
                        amputaci\u00f3n, p\u00e9rdida conciencia, etc.) o mortales.
                      </div>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIncident.reporte_mintrabajo}
                          onChange={() =>
                            handleInputChange(
                              'reporte_mintrabajo',
                              !selectedIncident.reporte_mintrabajo
                            )
                          }
                        />
                        <span>Marcar como reportado</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ACCIONES CORRECTIVAS */}
      {activeTab === 'acciones' && (
        <div>
          {!selectedIncident ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
              <p>
                Seleccione un incidente en la pesta\u00f1a <strong>Investigaci\u00f3n</strong> para
                gestionar sus acciones correctivas.
              </p>
            </div>
          ) : (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <h3 style={{ margin: 0, color: '#0f766e' }}>
                  Acciones Correctivas y Preventivas - {TIPO_LABELS[selectedIncident.tipo]}
                </h3>
                <button
                  onClick={() => {
                    setEditingAction(null);
                    setActionForm({
                      ...INITIAL_ACTION,
                      incident_id: selectedIncident!.id,
                      fecha_limite: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                    });
                  }}
                  style={{
                    padding: '10px 16px',
                    background: '#0f766e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  + Nueva Acci\u00f3n
                </button>
              </div>

              {message && (
                <div
                  style={{
                    background: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
                    border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                    color: message.type === 'success' ? '#065f46' : '#991b1b',
                    padding: 10,
                    borderRadius: 8,
                    marginBottom: 14,
                  }}
                >
                  {message.text}
                </div>
              )}

              {editingAction && (
                <div
                  style={{
                    background: '#fff',
                    padding: 16,
                    borderRadius: 10,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                    marginBottom: 16,
                  }}
                >
                  <h4 style={{ margin: '0 0 12px', color: '#0f766e' }}>
                    Editar Acci\u00f3n Correctiva
                  </h4>
                  <form
                    onSubmit={handleActionSubmit}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 12,
                    }}
                  >
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label
                        htmlFor="action-descripcion"
                        style={{
                          display: 'block',
                          fontSize: 12,
                          color: '#6b7280',
                          marginBottom: 4,
                        }}
                      >
                        Descripci\u00f3n de la acci\u00f3n *
                      </label>
                      <textarea
                        id="action-descripcion"
                        value={actionForm.descripcion}
                        onChange={(e) =>
                          setActionForm({ ...actionForm, descripcion: e.target.value })
                        }
                        rows={3}
                        placeholder="Describa la acci\u00f3n correctiva/preventiva a implementar..."
                        style={{
                          width: '100%',
                          padding: 8,
                          border: '1px solid #d1d5db',
                          borderRadius: 6,
                          fontFamily: 'inherit',
                          resize: 'vertical',
                        }}
                        required
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="action-responsable"
                        style={{
                          display: 'block',
                          fontSize: 12,
                          color: '#6b7280',
                          marginBottom: 4,
                        }}
                      >
                        Responsable *
                      </label>
                      <input
                        id="action-responsable"
                        value={actionForm.responsable}
                        onChange={(e) =>
                          setActionForm({ ...actionForm, responsable: e.target.value })
                        }
                        placeholder="Nombre del responsable"
                        style={{
                          width: '100%',
                          padding: 8,
                          border: '1px solid #d1d5db',
                          borderRadius: 6,
                        }}
                        required
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="action-fecha"
                        style={{
                          display: 'block',
                          fontSize: 12,
                          color: '#6b7280',
                          marginBottom: 4,
                        }}
                      >
                        Fecha l\u00edmite *
                      </label>
                      <input
                        id="action-fecha"
                        type="date"
                        value={actionForm.fecha_limite}
                        onChange={(e) =>
                          setActionForm({ ...actionForm, fecha_limite: e.target.value })
                        }
                        style={{
                          width: '100%',
                          padding: 8,
                          border: '1px solid #d1d5db',
                          borderRadius: 6,
                        }}
                        required
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="action-estado"
                        style={{
                          display: 'block',
                          fontSize: 12,
                          color: '#6b7280',
                          marginBottom: 4,
                        }}
                      >
                        Estado
                      </label>
                      <select
                        id="action-estado"
                        value={actionForm.estado}
                        onChange={(e) =>
                          setActionForm({ ...actionForm, estado: e.target.value as any })
                        }
                        style={{
                          width: '100%',
                          padding: 8,
                          border: '1px solid #d1d5db',
                          borderRadius: 6,
                        }}
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="en_proceso">En proceso</option>
                        <option value="completada">Completada</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label
                        htmlFor="action-evidencia"
                        style={{
                          display: 'block',
                          fontSize: 12,
                          color: '#6b7280',
                          marginBottom: 4,
                        }}
                      >
                        Evidencia (URL)
                      </label>
                      <input
                        id="action-evidencia"
                        value={actionForm.evidencia_url || ''}
                        onChange={(e) =>
                          setActionForm({ ...actionForm, evidencia_url: e.target.value })
                        }
                        placeholder="URL de evidencia (foto, documento, etc.)"
                        style={{
                          width: '100%',
                          padding: 8,
                          border: '1px solid #d1d5db',
                          borderRadius: 6,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        gridColumn: '1 / -1',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 8,
                        marginTop: 8,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAction(null);
                          setActionForm(INITIAL_ACTION);
                        }}
                        style={{
                          padding: '8px 16px',
                          background: '#e5e7eb',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        style={{
                          padding: '8px 16px',
                          background: loading ? '#94a3b8' : '#0f766e',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          fontWeight: 'bold',
                        }}
                      >
                        {loading ? 'Guardando...' : '\ud83d\udcc8 Guardar Acci\u00f3n'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    background: '#fff',
                    borderRadius: 8,
                    overflow: 'hidden',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                  }}
                >
                  <thead>
                    <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                      <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Acci\u00f3n</th>
                      <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Responsable</th>
                      <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>
                        Fecha l\u00edmite
                      </th>
                      <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th>
                      <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Evidencia</th>
                      <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          style={{ padding: 30, textAlign: 'center', color: '#6b7280' }}
                        >
                          No hay acciones correctivas registradas. Haga clic en \u201cNueva
                          Acci\u00f3n\u201d para agregar la primera.
                        </td>
                      </tr>
                    ) : (
                      actions.map((a) => {
                        const completed = a.estado === 'completada';
                        const deadlineStatus = getDeadlineStatus(a.fecha_limite, completed);
                        const actionStateColor = ACCION_ESTADO_COLORS[a.estado];
                        return (
                          <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: 10, fontSize: 12, maxWidth: '300px' }}>
                              <div style={{ fontWeight: 500 }}>{a.descripcion}</div>
                              {a.evidencia_url && (
                                <a
                                  href={a.evidencia_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    fontSize: 10,
                                    color: '#0f766e',
                                    textDecoration: 'underline',
                                  }}
                                >
                                  Ver evidencia
                                </a>
                              )}
                            </td>
                            <td style={{ padding: 10, fontSize: 12 }}>{a.responsable}</td>
                            <td style={{ padding: 10, fontSize: 12 }}>
                              <div>{formatDate(a.fecha_limite)}</div>
                              <div
                                style={{ fontSize: 11, color: deadlineStatus.color, marginTop: 2 }}
                              >
                                {deadlineStatus.label}
                              </div>
                            </td>
                            <td style={{ padding: 10 }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: 12,
                                  fontSize: 11,
                                  fontWeight: 'bold',
                                  background: actionStateColor.bg,
                                  color: actionStateColor.text,
                                }}
                              >
                                {a.estado === 'pendiente'
                                  ? 'Pendiente'
                                  : a.estado === 'en_proceso'
                                    ? 'En proceso'
                                    : a.estado === 'completada'
                                      ? 'Completada'
                                      : 'Vencida'}
                              </span>
                            </td>
                            <td style={{ padding: 10, textAlign: 'center' }}>
                              {a.evidencia_url ? (
                                <a
                                  href={a.evidencia_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    padding: '4px 8px',
                                    background: '#dbeafe',
                                    color: '#1e40af',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: 500,
                                    textDecoration: 'none',
                                  }}
                                >
                                  Ver
                                </a>
                              ) : (
                                <span style={{ fontSize: 11, color: '#9ca3af' }}>\u2014</span>
                              )}
                            </td>
                            <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                              {!completed && (
                                <button
                                  onClick={() => handleActionComplete(a.id)}
                                  style={{
                                    padding: '4px 8px',
                                    background: '#10b981',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Completar
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setEditingAction(a);
                                  setActionForm({ ...INITIAL_ACTION, ...a });
                                }}
                                style={{
                                  padding: '4px 8px',
                                  background: '#0f766e',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  cursor: 'pointer',
                                }}
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDeleteAction(a.id)}
                                style={{
                                  padding: '4px 8px',
                                  background: '#dc2626',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  cursor: 'pointer',
                                }}
                              >
                                \ud83d\uddcf\ufe0f
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SEGUIMIENTO */}
      {activeTab === 'seguimiento' && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                background: '#fff',
                padding: 16,
                borderRadius: 10,
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                borderLeft: '4px solid #0f766e',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Total Incidentes
              </div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#0f766e' }}>
                {incidents.length}
              </div>
            </div>
            <div
              style={{
                background: '#fff',
                padding: 16,
                borderRadius: 10,
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                borderLeft: '4px solid #f59e0b',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                En Investigaci\u00f3n
              </div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#f59e0b' }}>
                {incidents.filter((i) => i.estado === 'investigando').length}
              </div>
            </div>
            <div
              style={{
                background: '#fff',
                padding: 16,
                borderRadius: 10,
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                borderLeft: '4px solid #10b981',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Cerrados
              </div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#10b981' }}>
                {incidents.filter((i) => i.estado === 'cerrado').length}
              </div>
            </div>
            <div
              style={{
                background: '#fff',
                padding: 16,
                borderRadius: 10,
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                borderLeft: '4px solid #ef4444',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Abiertos
              </div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ef4444' }}>
                {incidents.filter((i) => i.estado === 'abierto').length}
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                background: '#fff',
                borderRadius: 8,
                overflow: 'hidden',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              }}
            >
              <thead>
                <tr style={{ background: '#fef2f2', textAlign: 'left' }}>
                  <th style={{ padding: 10, fontSize: 12, color: '#991b1b' }}>Fecha</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#991b1b' }}>Tipo</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#991b1b' }}>Descripci\u00f3n</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#991b1b' }}>Estado</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#991b1b' }}>ARL</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#991b1b' }}>EPS</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#991b1b' }}>MinTrabajo</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#991b1b' }}>
                    D\u00edas Perdidos
                  </th>
                  <th style={{ padding: 10, fontSize: 12, color: '#991b1b' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((x) => (
                  <tr
                    key={x.id}
                    style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                    onClick={() => openIncident(x)}
                  >
                    <td style={{ padding: 10 }}>{formatDate(x.fecha_ocurrencia)}</td>
                    <td style={{ padding: 10 }}>{TIPO_LABELS[x.tipo]}</td>
                    <td
                      style={{
                        padding: 10,
                        maxWidth: '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {x.descripcion}
                    </td>
                    <td style={{ padding: 10 }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 'bold',
                          background: ESTADO_COLORS[x.estado].bg,
                          color: ESTADO_COLORS[x.estado].text,
                        }}
                      >
                        {ESTADO_LABELS[x.estado]}
                      </span>
                    </td>
                    <td style={{ padding: 10, textAlign: 'center' }}>
                      {x.reporte_arl ? '\u2705' : '\u274c'}
                    </td>
                    <td style={{ padding: 10, textAlign: 'center' }}>
                      {x.reporte_eps ? '\u2705' : '\u274c'}
                    </td>
                    <td style={{ padding: 10, textAlign: 'center' }}>
                      {x.reporte_mintrabajo ? '\u2705' : '\u274c'}
                    </td>
                    <td style={{ padding: 10, textAlign: 'center', fontWeight: 500 }}>
                      {x.dias_perdidos}
                    </td>
                    <td style={{ padding: 10 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openIncident(x);
                        }}
                        style={{
                          padding: '4px 8px',
                          background: '#0f766e',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
                {incidents.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: 30, textAlign: 'center', color: '#6b7280' }}>
                      No hay incidentes registrados. Use la pesta\u00f1a \u201cRegistro\u201d para
                      crear el primero.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
