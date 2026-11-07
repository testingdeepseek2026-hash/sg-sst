import { useEffect, useState } from 'react';

import SignaturePad from '../components/SignaturePad';
import { api } from '../lib/api';

type TabType = 'basicos' | 'examenes' | 'certificados' | 'epp';

interface Worker {
  id: string;
  tipo_documento: string;
  numero_documento: string;
  nombres: string;
  apellidos: string;
  cargo: string;
  fecha_ingreso: string;
  fecha_egreso: string | null;
  estado: 'activo' | 'inactivo' | 'retirado';
  eps: string | null;
  afp: string | null;
  arl: string | null;
  caja_compensacion: string | null;
  telefono: string | null;
  email: string | null;
}

interface WorkerForm {
  tipo_documento: string;
  numero_documento: string;
  nombres: string;
  apellidos: string;
  cargo: string;
  fecha_ingreso: string;
  estado: Worker['estado'];
  eps: string;
  afp: string;
  arl: string;
  caja_compensacion: string;
  telefono: string;
  email: string;
  fecha_egreso: string;
}

interface WorkerExam {
  id: string;
  worker_id: string;
  tipo: 'ingreso' | 'periodico' | 'egreso' | 'control';
  fecha: string;
  vencimiento: string | null;
  resultado: 'apto' | 'apto_con_restricciones' | 'no_apto';
  restricciones: string | null;
  medico: string | null;
  entidad: string | null;
  archivo_url: string | null;
  notas: string | null;
}

interface WorkerExamForm {
  tipo: WorkerExam['tipo'];
  fecha: string;
  vencimiento: string;
  resultado: WorkerExam['resultado'];
  restricciones: string;
  medico: string;
  entidad: string;
  archivo_url: string;
  notas: string;
}

interface WorkerCert {
  id: string;
  worker_id: string;
  tipo: 'alturas' | 'electrico' | 'primeros_auxilios' | 'brigada' | 'conduccion' | 'sst_50h' | 'otro';
  nombre_curso: string | null;
  entidad: string | null;
  fecha_emision: string;
  fecha_vencimiento: string;
  archivo_url: string | null;
  notas: string | null;
}

interface WorkerCertForm {
  tipo: WorkerCert['tipo'];
  nombre_curso: string;
  entidad: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  archivo_url: string;
  notas: string;
}

interface WorkerEpp {
  id: string;
  worker_id: string;
  item: string;
  cantidad: number;
  fecha_entrega: string;
  fecha_vencimiento: string | null;
  firmado_por_trabajador: number;
  firma_url: string | null;
  notas: string | null;
}

const initialForm = {
  tipo_documento: 'CC' as const,
  numero_documento: '',
  nombres: '',
  apellidos: '',
  cargo: '',
  fecha_ingreso: '',
  estado: 'activo' as const,
  eps: '',
  afp: '',
  arl: '',
  caja_compensacion: '',
  telefono: '',
  email: '',
  fecha_egreso: ''
};

const examFormInitial = {
  tipo: 'periodico' as const,
  fecha: '',
  vencimiento: '',
  resultado: 'apto' as const,
  restricciones: '',
  medico: '',
  entidad: '',
  archivo_url: '',
  notas: ''
};

const certFormInitial = {
  tipo: 'alturas' as const,
  nombre_curso: '',
  entidad: '',
  fecha_emision: '',
  fecha_vencimiento: '',
  archivo_url: '',
  notas: ''
};

const eppFormInitial = {
  item: '',
  cantidad: 1,
  fecha_entrega: '',
  fecha_vencimiento: '',
  notas: ''
};

const CERT_TYPES = [
  { value: 'alturas', label: '🏗️ Trabajo en Alturas (Res. 4272/2021)' },
  { value: 'electrico', label: '⚡ Riesgo Eléctrico (RETIE)' },
  { value: 'primeros_auxilios', label: '🩹 Primeros Auxilios' },
  { value: 'brigada', label: '🚒 Brigada de Emergencias' },
  { value: 'conduccion', label: '🚐 Conducción Defensiva' },
  { value: 'sst_50h', label: '📚 Curso SST 50h' },
  { value: 'otro', label: '📋 Otro' }
];

const EPP_ITEMS = [
  'Casco de seguridad',
  'Arnés de cuerpo completo',
  'Gafas de seguridad',
  'Guantes de protección',
  'Botas de seguridad',
  'Protección auditiva (tapones/orejeras)',
  'Ropa reflectiva (chaleco)',
  'Respirador / mascarilla',
  'Protección facial (careta)',
  'Cinturón de seguridad',
  'Línea de vida',
  'Dispositivo anticaídas',
  'Otro'
];

const ESTADO_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  vencido: { bg: '#fef2f2', text: '#991b1b', dot: '#ef4444' },
  por_vencer: { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
  vigente: { bg: '#ecfdf5', text: '#065f46', dot: '#10b981' },
  sin_vencimiento: { bg: '#f3f4f6', text: '#6b7280', dot: '#9ca3af' }
};

export default function Trabajadores() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('basicos');
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [form, setForm] = useState<WorkerForm>({ ...initialForm });
  const [editingWorker, setEditingWorker] = useState<string | null>(null);
  
  // Exámenes
  const [exams, setExams] = useState<WorkerExam[]>([]);
  const [examForm, setExamForm] = useState<WorkerExamForm>({ ...examFormInitial });
  const [editingExam, setEditingExam] = useState<string | null>(null);
  const [examModalOpen, setExamModalOpen] = useState(false);
  
  // Certificados
  const [certs, setCerts] = useState<WorkerCert[]>([]);
  const [certForm, setCertForm] = useState<WorkerCertForm>({ ...certFormInitial });
  const [editingCert, setEditingCert] = useState<string | null>(null);
  const [certModalOpen, setCertModalOpen] = useState(false);
  
  // EPP
  const [epp, setEpp] = useState<WorkerEpp[]>([]);
  const [eppForm, setEppForm] = useState<typeof eppFormInitial>({ ...eppFormInitial });
  const [editingEpp, setEditingEpp] = useState<string | null>(null);
  const [eppModalOpen, setEppModalOpen] = useState(false);
  const [signingEpp, setSigningEpp] = useState<WorkerEpp | null>(null);
  
  // Loading & alerts
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Cargar trabajadores
  const loadWorkers = async () => {
    try {
      const data = await api.get('/workers');
      setWorkers(data);
    } catch (err: any) {
      setError(err.message || 'Error cargando trabajadores');
    }
  };

  useEffect(() => { loadWorkers(); }, []);

  const showToast = (msg: string, isError = false) => {
    if (isError) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(null); setSuccess(null); }, 4000);
  };

  // ===== TRABAJADOR BASE =====
  const handleWorkerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (editingWorker) {
        await api.put(`/workers/${editingWorker}`, form);
        showToast('Trabajador actualizado');
      } else {
        await api.post('/workers', form);
        showToast('Trabajador creado');
      }
      setForm({ ...initialForm });
      setEditingWorker(null);
      loadWorkers();
    } catch (err: any) {
      showToast(err.message || 'Error', true);
    } finally {
      setLoading(false);
    }
  };

  const handleEditWorker = (w: Worker) => {
    setForm({
      tipo_documento: w.tipo_documento,
      numero_documento: w.numero_documento,
      nombres: w.nombres,
      apellidos: w.apellidos,
      cargo: w.cargo,
      fecha_ingreso: w.fecha_ingreso,
      estado: w.estado,
      eps: w.eps ?? '',
      afp: w.afp ?? '',
      arl: w.arl ?? '',
      caja_compensacion: w.caja_compensacion ?? '',
      telefono: w.telefono ?? '',
      email: w.email ?? '',
      fecha_egreso: w.fecha_egreso ?? ''
    });
    setEditingWorker(w.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteWorker = async (id: string) => {
    if (!confirm('¿Eliminar trabajador? Esta acción no se puede deshacer.')) return;
    try {
      await api.delete(`/workers/${id}`);
      showToast('Trabajador eliminado');
      loadWorkers();
    } catch (err: any) {
      showToast(err.message || 'Error', true);
    }
  };

  const openWorkerDetail = async (worker: Worker) => {
    setSelectedWorker(worker);
    // Cargar datos de las pestañas
    try {
      const [ex, ce, ep] = await Promise.all([
        api.get(`/workers/${worker.id}/exams`),
        api.get(`/workers/${worker.id}/certs`),
        api.get(`/workers/${worker.id}/epp`)
      ]);
      setExams(ex);
      setCerts(ce);
      setEpp(ep);
    } catch (err: any) {
      showToast(err.message || 'Error cargando ficha', true);
    }
  };

  // ===== EXÁMENES MÉDICOS =====
  const openExamModal = (exam?: WorkerExam) => {
    if (exam) {
      setEditingExam(exam.id);
      setExamForm({
        tipo: exam.tipo,
        fecha: exam.fecha,
        vencimiento: exam.vencimiento || '',
        resultado: exam.resultado,
        restricciones: exam.restricciones || '',
        medico: exam.medico || '',
        entidad: exam.entidad || '',
        archivo_url: exam.archivo_url || '',
        notas: exam.notas || ''
      });
    } else {
      setEditingExam(null);
      setExamForm({ ...examFormInitial, fecha: new Date().toISOString().slice(0, 10) });
    }
    setExamModalOpen(true);
  };

  const handleExamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorker) return;
    try {
      setLoading(true);
      const payload = { ...examForm, worker_id: selectedWorker.id };
      if (editingExam) {
        await api.put(`/workers/exams/${editingExam}`, payload);
        showToast('Examen actualizado');
      } else {
        await api.post(`/workers/${selectedWorker.id}/exams`, payload);
        showToast('Examen registrado');
      }
      setExamModalOpen(false);
      const ex = await api.get(`/workers/${selectedWorker.id}/exams`);
      setExams(ex);
    } catch (err: any) {
      showToast(err.message || 'Error', true);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExam = async (id: string) => {
    if (!confirm('Eliminar examen médico?')) return;
    if (!selectedWorker) return;
    try {
      await api.delete(`/workers/exams/${id}`);
      showToast('Examen eliminado');
      const ex = await api.get(`/workers/${selectedWorker.id}/exams`);
      setExams(ex);
    } catch (err: any) {
      showToast(err.message || 'Error', true);
    }
  };

  const getExamStatus = (exam: WorkerExam) => {
    if (!exam.vencimiento) return { label: 'Sin vencimiento', ...ESTADO_COLORS.sin_vencimiento };
    const hoy = new Date().toISOString().slice(0, 10);
    const diff = Math.ceil((new Date(exam.vencimiento).getTime() - new Date(hoy).getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: `VENCIDO (${Math.abs(diff)} días)`, ...ESTADO_COLORS.vencido };
    if (diff <= 30) return { label: `Por vencer (${diff} días)`, ...ESTADO_COLORS.por_vencer };
    return { label: `Vigente (${diff} días)`, ...ESTADO_COLORS.vigente };
  };

  // ===== CERTIFICADOS =====
  const openCertModal = (cert?: WorkerCert) => {
    if (cert) {
      setEditingCert(cert.id);
      setCertForm({
        tipo: cert.tipo,
        nombre_curso: cert.nombre_curso || '',
        entidad: cert.entidad || '',
        fecha_emision: cert.fecha_emision,
        fecha_vencimiento: cert.fecha_vencimiento,
        archivo_url: cert.archivo_url || '',
        notas: cert.notas || ''
      });
    } else {
      setEditingCert(null);
      const hoy = new Date().toISOString().slice(0, 10);
      setCertForm({ ...certFormInitial, fecha_emision: hoy, fecha_vencimiento: hoy });
    }
    setCertModalOpen(true);
  };

  const handleCertFechaEmisionChange = async (fecha: string) => {
    let newVencimiento = '';
    // Auto-calcular vencimiento para alturas (3 años)
    if (certForm.tipo === 'alturas') {
      try {
        const res = await api.get(`/certs/alturas/calcular-vencimiento?fecha_emision=${fecha}`);
        if (res.fecha_vencimiento) newVencimiento = res.fecha_vencimiento;
      } catch {}
    }
    setCertForm(prev => {
      const newForm = { ...prev, fecha_emision: fecha };
      if (newVencimiento) newForm.fecha_vencimiento = newVencimiento;
      return newForm;
    });
  };

  const handleCertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorker) return;
    try {
      setLoading(true);
      const payload = { ...certForm, worker_id: selectedWorker.id };
      if (editingCert) {
        await api.put(`/workers/certs/${editingCert}`, payload);
        showToast('Certificado actualizado');
      } else {
        await api.post(`/workers/${selectedWorker.id}/certs`, payload);
        showToast('Certificado registrado');
      }
      setCertModalOpen(false);
      const ce = await api.get(`/workers/${selectedWorker.id}/certs`);
      setCerts(ce);
    } catch (err: any) {
      showToast(err.message || 'Error', true);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCert = async (id: string) => {
    if (!confirm('Eliminar certificado?')) return;
    if (!selectedWorker) return;
    try {
      await api.delete(`/workers/certs/${id}`);
      showToast('Certificado eliminado');
      const ce = await api.get(`/workers/${selectedWorker.id}/certs`);
      setCerts(ce);
    } catch (err: any) {
      showToast(err.message || 'Error', true);
    }
  };

  const getCertStatus = (cert: WorkerCert) => {
    const hoy = new Date().toISOString().slice(0, 10);
    const diff = Math.ceil((new Date(cert.fecha_vencimiento).getTime() - new Date(hoy).getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: `VENCIDO (${Math.abs(diff)} días)`, ...ESTADO_COLORS.vencido };
    if (diff <= 30) return { label: `Por vencer (${diff} días)`, ...ESTADO_COLORS.por_vencer };
    return { label: `Vigente (${diff} días)`, ...ESTADO_COLORS.vigente };
  };

  // ===== EPP =====
  const openEppModal = (eppItem?: WorkerEpp) => {
    if (eppItem) {
      setEditingEpp(eppItem.id);
      setEppForm({
        item: eppItem.item,
        cantidad: eppItem.cantidad,
        fecha_entrega: eppItem.fecha_entrega,
        fecha_vencimiento: eppItem.fecha_vencimiento || '',
        notas: eppItem.notas || ''
      });
    } else {
      setEditingEpp(null);
      setEppForm({ ...eppFormInitial, fecha_entrega: new Date().toISOString().slice(0, 10) });
    }
    setEppModalOpen(true);
  };

  const handleEppSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorker) return;
    try {
      setLoading(true);
      const payload = { ...eppForm, worker_id: selectedWorker.id };
      if (editingEpp) {
        await api.put(`/workers/epp/${editingEpp}`, payload);
        showToast('EPP actualizado');
      } else {
        await api.post(`/workers/${selectedWorker.id}/epp`, payload);
        showToast('EPP registrado');
      }
      setEppModalOpen(false);
      const ep = await api.get(`/workers/${selectedWorker.id}/epp`);
      setEpp(ep);
    } catch (err: any) {
      showToast(err.message || 'Error', true);
    } finally {
      setLoading(false);
    }
  };

  const handleSignEpp = (eppItem: WorkerEpp) => {
    setSigningEpp(eppItem);
  };

  const handleSaveSignature = async (base64: string) => {
    if (!signingEpp) return;
    try {
      setLoading(true);
      await api.post(`/workers/epp/${signingEpp.id}/firmar`, { firma_base64: base64 });
      showToast('Firma registrada correctamente');
      setSigningEpp(null);
      const ep = await api.get(`/workers/${selectedWorker!.id}/epp`);
      setEpp(ep);
    } catch (err: any) {
      showToast(err.message || 'Error guardando firma', true);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEpp = async (id: string) => {
    if (!confirm('Eliminar registro de EPP?')) return;
    if (!selectedWorker) return;
    try {
      await api.delete(`/workers/epp/${id}`);
      showToast('EPP eliminado');
      const ep = await api.get(`/workers/${selectedWorker.id}/epp`);
      setEpp(ep);
    } catch (err: any) {
      showToast(err.message || 'Error', true);
    }
  };

  const getEppStatus = (item: WorkerEpp) => {
    if (!item.fecha_vencimiento) return { label: 'Sin vencimiento', ...ESTADO_COLORS.sin_vencimiento };
    const hoy = new Date().toISOString().slice(0, 10);
    const diff = Math.ceil((new Date(item.fecha_vencimiento).getTime() - new Date(hoy).getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: `VENCIDO (${Math.abs(diff)} días)`, ...ESTADO_COLORS.vencido };
    if (diff <= 30) return { label: `Por vencer (${diff} días)`, ...ESTADO_COLORS.por_vencer };
    return { label: `Vigente (${diff} días)`, ...ESTADO_COLORS.vigente };
  };

  // ===== CONTADORES ALERTAS POR PESTAÑA =====
  const examAlerts = exams.filter(e => e.vencimiento && getExamStatus(e).dot === '#ef4444').length;
  const examWarnings = exams.filter(e => e.vencimiento && getExamStatus(e).dot === '#f59e0b').length;
  const certAlerts = certs.filter(c => getCertStatus(c).dot === '#ef4444').length;
  const certWarnings = certs.filter(c => getCertStatus(c).dot === '#f59e0b').length;
  const eppAlerts = epp.filter(e => e.fecha_vencimiento && getEppStatus(e).dot === '#ef4444').length;
  const eppWarnings = epp.filter(e => e.fecha_vencimiento && getEppStatus(e).dot === '#f59e0b').length;
  const eppUnsigned = epp.filter(e => !e.firmado_por_trabajador).length;

  if (loading && !workers.length) return <div style={{padding:20, textAlign:'center'}}>Cargando…</div>;

  return (
    <div style={{ padding: 20, maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, color: '#0f766e' }}>Gestión de Trabajadores</h1>
        <button onClick={() => { setForm({...initialForm, fecha_ingreso: new Date().toISOString().slice(0,10)}); setEditingWorker(null); }} style={{ padding: '8px 14px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>Nuevo Trabajador</button>
      </div>

      {success && <div style={{ background: '#ecfdf5', color: '#065f46', padding: 10, borderRadius: 8, marginBottom: 14 }}>{success}</div>}
      {error && <div style={{ background: '#fef2f2', color: '#991b1b', padding: 10, borderRadius: 8, marginBottom: 14 }}>{error}</div>}

      {/* ===== VISTA DETALLE TRABAJADOR (MODAL CON TABS) ===== */}
      {selectedWorker && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 980, maxHeight: '90vh', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            {/* Header */}
            <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h2 style={{ margin: 0, color: '#0f766e', fontSize: 18 }}>{selectedWorker.nombres} {selectedWorker.apellidos}</h2>
                <p style={{ margin: 2, fontSize: 12, color: '#6b7280' }}>
                  {selectedWorker.cargo} • {selectedWorker.tipo_documento} {selectedWorker.numero_documento} • {selectedWorker.estado.toUpperCase()}
                </p>
              </div>
              <button onClick={() => { setSelectedWorker(null); setExams([]); setCerts([]); setEpp([]); }} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6b7280', padding: 4 }}>×</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', overflowX: 'auto', padding: '0 16' }}>
              {[
                { id: 'basicos', label: '📋 Datos Básicos', icon: '' },
                { id: 'examenes', label: `🩺 Exámenes Médicos ${(examAlerts || examWarnings) ? `(${examAlerts + examWarnings})` : ''}`, icon: '' },
                { id: 'certificados', label: `📜 Certificados ${(certAlerts || certWarnings) ? `(${certAlerts + certWarnings})` : ''}`, icon: '' },
                { id: 'epp', label: `🦺 EPP/Dotación ${(eppAlerts || eppWarnings || eppUnsigned) ? `(${eppAlerts + eppWarnings + eppUnsigned})` : ''}`, icon: '' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  style={{
                    padding: '12px 16px',
                    border: 'none',
                    background: activeTab === tab.id ? '#fff' : 'transparent',
                    color: activeTab === tab.id ? '#0f766e' : '#6b7280',
                    fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                    fontSize: 13,
                    cursor: 'pointer',
                    borderBottom: `3px solid ${activeTab === tab.id ? '#0f766e' : 'transparent'}`,
                    marginBottom: '-1px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Panels */}
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>

              {/* TAB 1: DATOS BÁSICOS */}
              {activeTab === 'basicos' && (
                <form onSubmit={handleWorkerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <h3 style={{ color: '#0f766e', marginBottom: 12 }}>Información Personal y Laboral</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Tipo Doc. *</label>
                      <select value={form.tipo_documento} onChange={e => setForm({...form, tipo_documento: e.target.value as any})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
                        <option value="CC">CC</option><option value="CE">CE</option><option value="PP">PP</option><option value="TI">TI</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Número Doc. *</label>
                      <input value={form.numero_documento} onChange={e => setForm({...form, numero_documento: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Nombres *</label>
                      <input value={form.nombres} onChange={e => setForm({...form, nombres: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Apellidos *</label>
                      <input value={form.apellidos} onChange={e => setForm({...form, apellidos: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Cargo *</label>
                      <input value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Fecha Ingreso *</label>
                      <input type="date" value={form.fecha_ingreso} onChange={e => setForm({...form, fecha_ingreso: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Fecha Egreso</label>
                      <input type="date" value={form.fecha_egreso} onChange={e => setForm({...form, fecha_egreso: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Estado</label>
                      <select value={form.estado} onChange={e => setForm({...form, estado: e.target.value as any})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
                        <option value="activo">Activo</option><option value="inactivo">Inactivo</option><option value="retirado">Retirado</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>EPS</label>
                      <input value={form.eps} onChange={e => setForm({...form, eps: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>AFP</label>
                      <input value={form.afp} onChange={e => setForm({...form, afp: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>ARL</label>
                      <input value={form.arl} onChange={e => setForm({...form, arl: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Caja Compensación</label>
                      <input value={form.caja_compensacion} onChange={e => setForm({...form, caja_compensacion: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Teléfono</label>
                      <input value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Email</label>
                      <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                    <button type="button" onClick={() => { setForm({...initialForm}); setEditingWorker(null); }} style={{ padding: '8px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                    <button type="submit" disabled={loading} style={{ padding: '8px 16px', background: loading ? '#94a3b8' : '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>
                      {editingWorker ? 'Actualizar' : 'Guardar'} Trabajador
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: EXÁMENES MÉDICOS */}
              {activeTab === 'examenes' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ color: '#0f766e', margin: 0 }}>Exámenes Médicos Ocupacionales</h3>
                    <button onClick={() => openExamModal()} disabled={!selectedWorker || !exams.some(e => e.tipo === 'ingreso')} style={{ padding: '8px 14px', background: exams.some(e => e.tipo === 'ingreso') ? '#0f766e' : '#94a3b8', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: exams.some(e => e.tipo === 'ingreso') ? 'pointer' : 'not-allowed' }}>
                      + Agregar Examen
                    </button>
                  </div>
                  
                  {!exams.some(e => e.tipo === 'ingreso') && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 12, borderRadius: 8, marginBottom: 12, color: '#991b1b', fontSize: 13 }}>
                      ⚠️ <strong>Falta examen de ingreso obligatorio.</strong> Todo trabajador debe tener examen de ingreso (Res. 0312/2019 E13). 
                      <button onClick={() => openExamModal()} style={{ marginLeft: 8, padding: '4px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Registrar Ahora</button>
                    </div>
                  )}

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                      <thead><tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                        <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Tipo</th>
                        <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Fecha</th>
                        <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Vencimiento</th>
                        <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Resultado</th>
                        <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Médico / Entidad</th>
                        <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th>
                        <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Acciones</th>
                      </tr></thead>
                      <tbody>
                        {exams.map(ex => {
                          const status = getExamStatus(ex);
                          return (
                            <tr key={ex.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: 10, fontWeight: 500, textTransform: 'capitalize' }}>{ex.tipo}</td>
                              <td style={{ padding: 10 }}>{ex.fecha.slice(0,10)}</td>
                              <td style={{ padding: 10 }}>{ex.vencimiento ? ex.vencimiento.slice(0,10) : '—'}</td>
                              <td style={{ padding: 10 }}>
                                <span style={{ 
                                  display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold',
                                  background: ex.resultado === 'no_apto' ? '#fee2e2' : ex.resultado === 'apto_con_restricciones' ? '#fef3c7' : '#dcfce7',
                                  color: ex.resultado === 'no_apto' ? '#991b1b' : ex.resultado === 'apto_con_restricciones' ? '#92400e' : '#166534'
                                }}>
                                  {ex.resultado.replace('_', ' ')}
                                </span>
                              </td>
                              <td style={{ padding: 10, fontSize: 12, color: '#4b5563' }}>{ex.medico || '—'} / {ex.entidad || '—'}</td>
                              <td style={{ padding: 10 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 'bold', color: status.text }}>
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: status.dot }}></span>
                                  {status.label}
                                </span>
                              </td>
                              <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                                <button onClick={() => openExamModal(ex)} style={{ padding: '4px 8px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Editar</button>
                                <button onClick={() => handleDeleteExam(ex.id)} style={{ padding: '4px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Eliminar</button>
                              </td>
                            </tr>
                          );
                        })}
                        {exams.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>No hay exámenes registrados</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: CERTIFICADOS */}
              {activeTab === 'certificados' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ color: '#0f766e', margin: 0 }}>Certificados y Capacitaciones</h3>
                    <button onClick={() => openCertModal()} style={{ padding: '8px 14px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>+ Agregar Certificado</button>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                      <thead><tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                        <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Tipo</th>
                        <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Curso</th>
                        <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Entidad</th>
                        <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Emisión</th>
                        <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Vencimiento</th>
                        <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th>
                        <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Acciones</th>
                      </tr></thead>
                      <tbody>
                        {certs.map(cert => {
                          const status = getCertStatus(cert);
                          const tipoLabel = CERT_TYPES.find(t => t.value === cert.tipo)?.label || cert.tipo;
                          return (
                            <tr key={cert.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: 10, fontSize: 12 }}>{tipoLabel}</td>
                              <td style={{ padding: 10 }}>{cert.nombre_curso || '—'}</td>
                              <td style={{ padding: 10, fontSize: 12 }}>{cert.entidad || '—'}</td>
                              <td style={{ padding: 10 }}>{cert.fecha_emision.slice(0,10)}</td>
                              <td style={{ padding: 10 }}>
                                {cert.fecha_vencimiento.slice(0,10)}
                                {cert.tipo === 'alturas' && (
                                  <span style={{ display: 'inline-block', marginLeft: 6, fontSize: 10, background: '#dbeafe', color: '#1e40af', padding: '1px 4px', borderRadius: 4 }}>3 años (Res. 4272/2021)</span>
                                )}
                              </td>
                              <td style={{ padding: 10 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 'bold', color: status.text }}>
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: status.dot }}></span>
                                  {status.label}
                                </span>
                              </td>
                              <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                                <button onClick={() => openCertModal(cert)} style={{ padding: '4px 8px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Editar</button>
                                <button onClick={() => handleDeleteCert(cert.id)} style={{ padding: '4px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Eliminar</button>
                              </td>
                            </tr>
                          );
                        })}
                        {certs.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>No hay certificados registrados</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: EPP / DOTACIÓN */}
              {activeTab === 'epp' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ color: '#0f766e', margin: 0 }}>Entrega de EPP y Dotación (Res. 0312/2019 E19)</h3>
                    <button onClick={() => openEppModal()} style={{ padding: '8px 14px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>+ Registrar Entrega</button>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                      <thead><tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                        <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Ítem</th>
                        <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Cant.</th>
                        <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Entrega</th>
                        <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Vencimiento</th>
                        <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Firma</th>
                        <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th>
                        <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Acciones</th>
                      </tr></thead>
                      <tbody>
                        {epp.map(item => {
                          const status = getEppStatus(item);
                          return (
                            <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: 10, fontWeight: 500 }}>{item.item}</td>
                              <td style={{ padding: 10, textAlign: 'center' }}>{item.cantidad}</td>
                              <td style={{ padding: 10 }}>{item.fecha_entrega.slice(0,10)}</td>
                              <td style={{ padding: 10 }}>{item.fecha_vencimiento ? item.fecha_vencimiento.slice(0,10) : '—'}</td>
                              <td style={{ padding: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                {item.firmado_por_trabajador ? (
                                  <>
                                    <span style={{ color: '#10b981', fontSize: 16 }}>✅</span>
                                    <button onClick={() => window.open(item.firma_url!, '_blank')} style={{ padding: '2px 6px', background: '#dcfce7', color: '#166534', border: 'none', borderRadius: 4, fontSize: 10, cursor: 'pointer' }}>Ver firma</button>
                                  </>
                                ) : (
                                  <button onClick={() => handleSignEpp(item)} style={{ padding: '4px 8px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>🖊️ Firmar</button>
                                )}
                              </td>
                              <td style={{ padding: 10 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 'bold', color: status.text }}>
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: status.dot }}></span>
                                  {status.label}
                                </span>
                              </td>
                              <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                                <button onClick={() => openEppModal(item)} style={{ padding: '4px 8px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Editar</button>
                                <button onClick={() => handleDeleteEpp(item.id)} style={{ padding: '4px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Eliminar</button>
                              </td>
                            </tr>
                          );
                        })}
                        {epp.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>No hay entregas de EPP registradas</td></tr>}
                      </tbody>
                    </table>
                  </div>

                  {eppUnsigned > 0 && (
                    <div style={{ marginTop: 12, padding: 12, background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, color: '#92400e', fontSize: 13 }}>
                      ⚠️ <strong>{eppUnsigned} entrega(s) de EPP pendientes de firma del trabajador.</strong> La firma es obligatoria según Res. 0312/2019 E19.
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Modales internos */}
            {examModalOpen && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
                <div style={{ background: '#fff', width: '90%', maxWidth: 500, maxHeight: '90vh', borderRadius: 12, padding: 20, overflow: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>{editingExam ? 'Editar Examen' : 'Nuevo Examen Médico'}</h3>
                  <form onSubmit={handleExamSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 'bold', color: '#374151' }}>Tipo *</label>
                      <select value={examForm.tipo} onChange={e => setExamForm({...examForm, tipo: e.target.value as any})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
                        <option value="ingreso">Ingreso</option>
                        <option value="periodico">Periódico</option>
                        <option value="egreso">Egreso</option>
                        <option value="control">Control</option>
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 'bold', color: '#374151' }}>Fecha *</label>
                        <input type="date" value={examForm.fecha} onChange={e => setExamForm({...examForm, fecha: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 'bold', color: '#374151' }}>Vencimiento</label>
                        <input type="date" value={examForm.vencimiento} onChange={e => setExamForm({...examForm, vencimiento: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 'bold', color: '#374151' }}>Resultado *</label>
                      <select value={examForm.resultado} onChange={e => setExamForm({...examForm, resultado: e.target.value as any})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
                        <option value="apto">Apto</option>
                        <option value="apto_con_restricciones">Apto con restricciones</option>
                        <option value="no_apto">No apto</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 'bold', color: '#374151' }}>Restricciones</label>
                      <textarea value={examForm.restricciones} onChange={e => setExamForm({...examForm, restricciones: e.target.value})} rows={2} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 'bold', color: '#374151' }}>Médico</label>
                        <input value={examForm.medico} onChange={e => setExamForm({...examForm, medico: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 'bold', color: '#374151' }}>Entidad</label>
                        <input value={examForm.entidad} onChange={e => setExamForm({...examForm, entidad: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 'bold', color: '#374151' }}>Notas</label>
                      <textarea value={examForm.notas} onChange={e => setExamForm({...examForm, notas: e.target.value})} rows={2} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                      <button type="button" onClick={() => setExamModalOpen(false)} style={{ padding: '8px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                      <button type="submit" disabled={loading} style={{ padding: '8px 16px', background: loading ? '#94a3b8' : '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>Guardar</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {certModalOpen && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
                <div style={{ background: '#fff', width: '90%', maxWidth: 500, maxHeight: '90vh', borderRadius: 12, padding: 20, overflow: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>{editingCert ? 'Editar Certificado' : 'Nuevo Certificado'}</h3>
                  <form onSubmit={handleCertSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 'bold', color: '#374151' }}>Tipo *</label>
                      <select value={certForm.tipo} onChange={e => setCertForm({...certForm, tipo: e.target.value as any})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
                        {CERT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 'bold', color: '#374151' }}>Nombre del Curso</label>
                      <input value={certForm.nombre_curso} onChange={e => setCertForm({...certForm, nombre_curso: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 'bold', color: '#374151' }}>Entidad Emisora</label>
                      <input value={certForm.entidad} onChange={e => setCertForm({...certForm, entidad: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 'bold', color: '#374151' }}>Fecha Emisión *</label>
                        <input type="date" value={certForm.fecha_emision} onChange={e => handleCertFechaEmisionChange(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 'bold', color: '#374151' }}>Fecha Vencimiento *</label>
                        <input type="date" value={certForm.fecha_vencimiento} onChange={e => setCertForm({...certForm, fecha_vencimiento: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
                      </div>
                    </div>
                    {certForm.tipo === 'alturas' && (
                      <div style={{ background: '#dbeafe', border: '1px solid #93c5fd', padding: 8, borderRadius: 6, fontSize: 11, color: '#1e40af' }}>
                        ℹ️ Para <strong>Trabajo en Alturas</strong> la vigencia es <strong>exactamente 3 años</strong> (Res. 4272/2021 Art. 12). Se calcula automáticamente al cambiar la fecha de emisión.
                      </div>
                    )}
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 'bold', color: '#374151' }}>Notas</label>
                      <textarea value={certForm.notas} onChange={e => setCertForm({...certForm, notas: e.target.value})} rows={2} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                      <button type="button" onClick={() => setCertModalOpen(false)} style={{ padding: '8px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                      <button type="submit" disabled={loading} style={{ padding: '8px 16px', background: loading ? '#94a3b8' : '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>Guardar</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {eppModalOpen && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
                <div style={{ background: '#fff', width: '90%', maxWidth: 500, maxHeight: '90vh', borderRadius: 12, padding: 20, overflow: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>{editingEpp ? 'Editar EPP' : 'Registrar Entrega de EPP'}</h3>
                  <form onSubmit={handleEppSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 'bold', color: '#374151' }}>Ítem EPP *</label>
                      <select value={eppForm.item} onChange={e => setEppForm({...eppForm, item: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
                        {EPP_ITEMS.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 'bold', color: '#374151' }}>Cantidad</label>
                        <input type="number" min="1" value={eppForm.cantidad} onChange={e => setEppForm({...eppForm, cantidad: parseInt(e.target.value) || 1})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 'bold', color: '#374151' }}>Fecha Entrega *</label>
                        <input type="date" value={eppForm.fecha_entrega} onChange={e => setEppForm({...eppForm, fecha_entrega: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 'bold', color: '#374151' }}>Fecha Vencimiento</label>
                      <input type="date" value={eppForm.fecha_vencimiento} onChange={e => setEppForm({...eppForm, fecha_vencimiento: e.target.value})} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 'bold', color: '#374151' }}>Notas</label>
                      <textarea value={eppForm.notas} onChange={e => setEppForm({...eppForm, notas: e.target.value})} rows={2} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                      <button type="button" onClick={() => setEppModalOpen(false)} style={{ padding: '8px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                      <button type="submit" disabled={loading} style={{ padding: '8px 16px', background: loading ? '#94a3b8' : '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>Guardar</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* SignaturePad Modal */}
            {signingEpp && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
                <SignaturePad
                  width={Math.min(400, window.innerWidth - 40)}
                  onSave={handleSaveSignature}
                  onCancel={() => setSigningEpp(null)}
                />
              </div>
            )}

          </div>
        </div>
      )}

      {/* ===== TABLA PRINCIPAL TRABAJADORES ===== */}
      <div style={{ marginTop: selectedWorker ? 0 : 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
          <thead>
            <tr style={{ background: '#ecfdf5', textAlign: 'left' }}>
              <th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Documento</th>
              <th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Nombre</th>
              <th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Cargo</th>
              <th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Ingreso</th>
              <th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Estado</th>
              <th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>EPS / ARL</th>
              <th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <tr key={w.id} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                <td style={{ padding: 10 }}>{w.tipo_documento} {w.numero_documento}</td>
                <td style={{ padding: 10, fontWeight: 500 }}>{w.nombres} {w.apellidos}</td>
                <td style={{ padding: 10 }}>{w.cargo}</td>
                <td style={{ padding: 10 }}>{w.fecha_ingreso.slice(0,10)}</td>
                <td style={{ padding: 10 }}>
                  <span style={{ 
                    display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold',
                    background: w.estado === 'activo' ? '#dcfce7' : w.estado === 'inactivo' ? '#fef3c7' : '#fee2e2',
                    color: w.estado === 'activo' ? '#166534' : w.estado === 'inactivo' ? '#92400e' : '#991b1c'
                  }}>
                    {w.estado}
                  </span>
                </td>
                <td style={{ padding: 10, fontSize: 12, color: '#4b5563' }}>{w.eps || '-'}{w.arl ? ' / ' + w.arl : ''}</td>
                <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                  <button onClick={() => openWorkerDetail(w)} style={{ padding: '4px 8px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>👁 Ver ficha</button>
                  <button onClick={() => handleEditWorker(w)} style={{ padding: '4px 8px', background: '#e5e7eb', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>✏️ Editar</button>
                  <button onClick={() => handleDeleteWorker(w.id)} style={{ padding: '4px 8px', background: '#fee2e2', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer', color: '#b91c1c' }}>🗑️</button>
                </td>
              </tr>
            ))}
            {workers.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>No hay trabajadores registrados</td></tr>}
          </tbody>
        </table>
      </div>

      {editingWorker && <p style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>Editando trabajador. Guarde para aplicar cambios.</p>}
    </div>
  );
}