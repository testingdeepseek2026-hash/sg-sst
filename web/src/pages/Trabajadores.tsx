import { useEffect, useState } from 'react';

import { SignaturePad } from '@/components/SignaturePad';
import { api } from '@/lib/api';

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
  eps: string | null;
  afp: string | null;
  arl: string | null;
  caja_compensacion: string | null;
  telefono: string | null;
  email: string | null;
  fecha_egreso: string | null;
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
  tipo:
    'alturas' | 'electrico' | 'primeros_auxilios' | 'brigada' | 'conduccion' | 'sst_50h' | 'otro';
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

interface WorkerEppForm {
  item: string;
  cantidad: number;
  fecha_entrega: string;
  fecha_vencimiento: string;
  notas: string;
}

const _EXAM_TYPES: { value: WorkerExam['tipo']; label: string }[] = [
  { value: 'ingreso', label: 'Ingreso' },
  { value: 'periodico', label: 'Periódico' },
  { value: 'egreso', label: 'Egreso' },
  { value: 'control', label: 'Control' },
];

const CERT_TYPES: { value: WorkerCert['tipo']; label: string }[] = [
  { value: 'alturas', label: 'Trabajo en Alturas' },
  { value: 'electrico', label: 'Riesgo Eléctrico' },
  { value: 'primeros_auxilios', label: 'Primeros Auxilios' },
  { value: 'brigada', label: 'Brigada Emergencias' },
  { value: 'conduccion', label: 'Conducción' },
  { value: 'sst_50h', label: 'Curso SST 50h' },
  { value: 'otro', label: 'Otro' },
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
  'Otro',
];

const initialForm: WorkerForm = {
  tipo_documento: 'CC',
  numero_documento: '',
  nombres: '',
  apellidos: '',
  cargo: '',
  fecha_ingreso: new Date().toISOString().slice(0, 10),
  estado: 'activo',
  eps: '',
  afp: '',
  arl: '',
  caja_compensacion: '',
  telefono: '',
  email: '',
  fecha_egreso: '',
};

const initialExamForm: WorkerExamForm = {
  tipo: 'periodico',
  fecha: new Date().toISOString().slice(0, 10),
  vencimiento: '',
  resultado: 'apto',
  restricciones: '',
  medico: '',
  entidad: '',
  archivo_url: '',
  notas: '',
};

const initialCertForm: WorkerCertForm = {
  tipo: 'alturas',
  nombre_curso: '',
  entidad: '',
  fecha_emision: new Date().toISOString().slice(0, 10),
  fecha_vencimiento: '',
  archivo_url: '',
  notas: '',
};

const initialEppForm: WorkerEppForm = {
  item: 'Casco de seguridad',
  cantidad: 1,
  fecha_entrega: new Date().toISOString().slice(0, 10),
  fecha_vencimiento: '',
  notas: '',
};

export default function Trabajadores() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('basicos');
  const [form, setForm] = useState<WorkerForm>(initialForm);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [exams, setExams] = useState<WorkerExam[]>([]);
  const [examForm, setExamForm] = useState<WorkerExamForm>(initialExamForm);
  const [editingExam, setEditingExam] = useState<WorkerExam | null>(null);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [certs, setCerts] = useState<WorkerCert[]>([]);
  const [certForm, setCertForm] = useState<WorkerCertForm>(initialCertForm);
  const [editingCert, setEditingCert] = useState<WorkerCert | null>(null);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [epp, setEpp] = useState<WorkerEpp[]>([]);
  const [eppForm, setEppForm] = useState<WorkerEppForm>(initialEppForm);
  const [editingEpp, setEditingEpp] = useState<WorkerEpp | null>(null);
  const [eppModalOpen, setEppModalOpen] = useState(false);
  const [signingEpp, setSigningEpp] = useState<WorkerEpp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadWorkers();
  }, []);

  useEffect(() => {
    if (selectedWorker) {
      loadWorkerDetails(selectedWorker.id);
    }
  }, [selectedWorker]);

  const loadWorkers = async () => {
    try {
      const data = await api.get('/workers');
      setWorkers(data);
    } catch (err: any) {
      setError(err.message || 'Error cargando trabajadores');
    }
  };

  const loadWorkerDetails = async (workerId: string) => {
    try {
      const [ex, ce, ep] = await Promise.all([
        api.get(`/workers/${workerId}/exams`),
        api.get(`/workers/${workerId}/certs`),
        api.get(`/workers/${workerId}/epp`),
      ]);
      setExams(ex);
      setCerts(ce);
      setEpp(ep);
    } catch (err: any) {
      setError(err.message || 'Error cargando detalle');
    }
  };

  const openWorkerDetail = (w: Worker) => {
    setSelectedWorker(w);
    setActiveTab('basicos');
    setEditingWorker(null);
    setForm({ ...initialForm, ...w });
  };

  const _handleEditWorker = (w: Worker) => {
    setEditingWorker(w);
    setForm({ ...initialForm, ...w });
    setActiveTab('basicos');
  };

  const _handleDeleteWorker = async (id: string) => {
    if (!confirm('Eliminar trabajador y todos sus registros asociados?')) return;
    try {
      setLoading(true);
      await api.delete(`/workers/${id}`);
      setSuccess('Trabajador eliminado');
      setSelectedWorker(null);
      loadWorkers();
    } catch (err: any) {
      setError(err.message || 'Error eliminando');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (editingWorker) {
        await api.put(`/workers/${editingWorker.id}`, form);
        setSuccess('Trabajador actualizado');
        setEditingWorker(null);
      } else {
        await api.post('/workers', form);
        setSuccess('Trabajador creado');
      }
      setForm(initialForm);
      loadWorkers();
    } catch (err: any) {
      setError(err.message || 'Error guardando');
    } finally {
      setLoading(false);
    }
  };

  const openExamModal = (exam?: WorkerExam) => {
    if (exam) {
      setEditingExam(exam);
      setExamForm({
        tipo: exam.tipo,
        fecha: exam.fecha.slice(0, 10),
        vencimiento: exam.vencimiento?.slice(0, 10) || '',
        resultado: exam.resultado,
        restricciones: exam.restricciones || '',
        medico: exam.medico || '',
        entidad: exam.entidad || '',
        archivo_url: exam.archivo_url || '',
        notas: exam.notas || '',
      });
    } else {
      setEditingExam(null);
      setExamForm({ ...initialExamForm, fecha: new Date().toISOString().slice(0, 10) });
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
        await api.put(`/workers/${selectedWorker.id}/exams/${editingExam.id}`, payload);
        setSuccess('Examen actualizado');
      } else {
        await api.post(`/workers/${selectedWorker.id}/exams`, payload);
        setSuccess('Examen registrado');
      }
      setExamModalOpen(false);
      loadWorkerDetails(selectedWorker.id);
    } catch (err: any) {
      setError(err.message || 'Error guardando examen');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExam = async (id: string) => {
    if (!confirm('Eliminar este examen médico?')) return;
    if (!selectedWorker) return;
    try {
      await api.delete(`/workers/${selectedWorker.id}/exams/${id}`);
      setSuccess('Examen eliminado');
      loadWorkerDetails(selectedWorker.id);
    } catch (err: any) {
      setError(err.message || 'Error eliminando');
    }
  };

  const openCertModal = (cert?: WorkerCert) => {
    if (cert) {
      setEditingCert(cert);
      setCertForm({
        tipo: cert.tipo,
        nombre_curso: cert.nombre_curso || '',
        entidad: cert.entidad || '',
        fecha_emision: cert.fecha_emision.slice(0, 10),
        fecha_vencimiento: cert.fecha_vencimiento.slice(0, 10),
        archivo_url: cert.archivo_url || '',
        notas: cert.notas || '',
      });
    } else {
      setEditingCert(null);
      setCertForm({ ...initialCertForm, fecha_emision: new Date().toISOString().slice(0, 10) });
    }
    setCertModalOpen(true);
  };

  const handleCertFechaEmisionChange = (value: string) => {
    setCertForm({ ...certForm, fecha_emision: value });
    if (certForm.tipo === 'alturas' && value) {
      const emission = new Date(value);
      if (!isNaN(emission.getTime())) {
        const venc = new Date(emission);
        venc.setFullYear(venc.getFullYear() + 3);
        setCertForm((prev) => ({ ...prev, fecha_vencimiento: venc.toISOString().slice(0, 10) }));
      }
    }
  };

  const handleCertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorker) return;
    try {
      setLoading(true);
      const payload = { ...certForm, worker_id: selectedWorker.id };
      if (editingCert) {
        await api.put(`/workers/${selectedWorker.id}/certs/${editingCert.id}`, payload);
        setSuccess('Certificado actualizado');
      } else {
        await api.post(`/workers/${selectedWorker.id}/certs`, payload);
        setSuccess('Certificado registrado');
      }
      setCertModalOpen(false);
      loadWorkerDetails(selectedWorker.id);
    } catch (err: any) {
      setError(err.message || 'Error guardando certificado');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCert = async (id: string) => {
    if (!confirm('Eliminar este certificado?')) return;
    if (!selectedWorker) return;
    try {
      await api.delete(`/workers/${selectedWorker.id}/certs/${id}`);
      setSuccess('Certificado eliminado');
      loadWorkerDetails(selectedWorker.id);
    } catch (err: any) {
      setError(err.message || 'Error eliminando');
    }
  };

  const openEppModal = (item?: WorkerEpp) => {
    if (item) {
      setEditingEpp(item);
      setEppForm({
        item: item.item,
        cantidad: item.cantidad,
        fecha_entrega: item.fecha_entrega.slice(0, 10),
        fecha_vencimiento: item.fecha_vencimiento?.slice(0, 10) || '',
        notas: item.notas || '',
      });
    } else {
      setEditingEpp(null);
      setEppForm({ ...initialEppForm, fecha_entrega: new Date().toISOString().slice(0, 10) });
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
        await api.put(`/workers/${selectedWorker.id}/epp/${editingEpp.id}`, payload);
        setSuccess('EPP actualizado');
      } else {
        await api.post(`/workers/${selectedWorker.id}/epp`, payload);
        setSuccess('EPP registrado');
      }
      setEppModalOpen(false);
      loadWorkerDetails(selectedWorker.id);
    } catch (err: any) {
      setError(err.message || 'Error guardando EPP');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEpp = async (id: string) => {
    if (!confirm('Eliminar esta entrega de EPP?')) return;
    if (!selectedWorker) return;
    try {
      await api.delete(`/workers/${selectedWorker.id}/epp/${id}`);
      setSuccess('EPP eliminado');
      loadWorkerDetails(selectedWorker.id);
    } catch (err: any) {
      setError(err.message || 'Error eliminando');
    }
  };

  const handleSignEpp = (item: WorkerEpp) => {
    setSigningEpp(item);
  };

  const handleSaveSignature = (dataUrl: string) => {
    if (!signingEpp || !selectedWorker) return;
    api
      .put(`/workers/${selectedWorker.id}/epp/${signingEpp.id}`, {
        firma_url: dataUrl,
        firmado_por_trabajador: 1,
      })
      .then(() => {
        setSuccess('Firma guardada');
        loadWorkerDetails(selectedWorker.id);
        setSigningEpp(null);
      })
      .catch((err: any) => setError(err.message || 'Error guardando firma'));
  };

  const getExamStatus = (ex: WorkerExam) => {
    if (!ex.vencimiento) return { label: 'Sin vencimiento', text: '#6b7280', dot: '#9ca3af' };
    const today = new Date().toISOString().slice(0, 10);
    if (ex.vencimiento < today) return { label: 'Vencido', text: '#dc2626', dot: '#ef4444' };
    const diff =
      (new Date(ex.vencimiento).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24);
    if (diff <= 30)
      return { label: `Por vencer (${Math.ceil(diff)} días)`, text: '#f59e0b', dot: '#f59e0b' };
    return { label: 'Vigente', text: '#10b981', dot: '#10b981' };
  };

  const getCertStatus = (cert: WorkerCert) => {
    const today = new Date().toISOString().slice(0, 10);
    if (cert.fecha_vencimiento < today)
      return { label: 'Vencido', text: '#dc2626', dot: '#ef4444' };
    const diff =
      (new Date(cert.fecha_vencimiento).getTime() - new Date(today).getTime()) /
      (1000 * 60 * 60 * 24);
    if (diff <= 30)
      return { label: `Por vencer (${Math.ceil(diff)} días)`, text: '#f59e0b', dot: '#f59e0b' };
    return { label: 'Vigente', text: '#10b981', dot: '#10b981' };
  };

  const getEppStatus = (item: WorkerEpp) => {
    if (!item.fecha_vencimiento)
      return { label: 'Sin vencimiento', text: '#6b7280', dot: '#9ca3af' };
    if (!item.firmado_por_trabajador)
      return { label: 'Pendiente firma', text: '#f59e0b', dot: '#f59e0b' };
    const today = new Date().toISOString().slice(0, 10);
    if (item.fecha_vencimiento < today)
      return { label: 'Vencido', text: '#dc2626', dot: '#ef4444' };
    const diff =
      (new Date(item.fecha_vencimiento).getTime() - new Date(today).getTime()) /
      (1000 * 60 * 60 * 24);
    if (diff <= 30)
      return { label: `Por vencer (${Math.ceil(diff)} días)`, text: '#f59e0b', dot: '#f59e0b' };
    return { label: 'Vigente', text: '#10b981', dot: '#10b981' };
  };

  const eppUnsigned = epp.filter((i) => !i.firmado_por_trabajador).length;

  const _showToast = (msg: string, isError = false) => {
    if (isError) setError(msg);
    else setSuccess(msg);
    setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 4000);
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
        <h1 style={{ margin: 0, color: '#0f766e' }}>Gestión de Trabajadores</h1>
        <button
          onClick={() => openWorkerDetail({} as Worker)}
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
          + Nuevo Trabajador
        </button>
      </div>

      {success && (
        <div
          style={{
            background: '#ecfdf5',
            color: '#065f46',
            padding: 10,
            borderRadius: 8,
            marginBottom: 14,
          }}
        >
          {success}
        </div>
      )}
      {error && (
        <div
          style={{
            background: '#fef2f2',
            color: '#991b1b',
            padding: 10,
            borderRadius: 8,
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      {selectedWorker && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <strong>
              {selectedWorker.nombres} {selectedWorker.apellidos}
            </strong>{' '}
            · {selectedWorker.tipo_documento} {selectedWorker.numero_documento} ·{' '}
            <span style={{ color: '#065f46' }}>{selectedWorker.cargo}</span>
          </div>
          <button
            onClick={() => setSelectedWorker(null)}
            style={{
              padding: '6px 12px',
              background: '#fff',
              border: '1px solid #a7f3d0',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Cerrar ficha
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 16 }}>
        {[
          { id: 'basicos', label: '👤 Básicos' },
          { id: 'examenes', label: '🩺 Exámenes' },
          { id: 'certificados', label: '📜 Certificados' },
          { id: 'epp', label: '🛡️ EPP / Dotación' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            disabled={!selectedWorker}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: activeTab === tab.id ? '#fff' : 'transparent',
              color: activeTab === tab.id ? '#0f766e' : !selectedWorker ? '#d1d5db' : '#6b7280',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              fontSize: 13,
              cursor: selectedWorker ? 'pointer' : 'not-allowed',
              borderBottom: `3px solid ${activeTab === tab.id ? '#0f766e' : 'transparent'}`,
              marginBottom: '-1px',
              opacity: selectedWorker ? 1 : 0.5,
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: BÁSICOS */}
      {activeTab === 'basicos' && (
        <div>
          <form
            onSubmit={handleWorkerSubmit}
            style={{
              background: '#fff',
              padding: 18,
              borderRadius: 10,
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
            }}
          >
            {editingWorker ? (
              <h3 style={{ color: '#0f766e', marginBottom: 12 }}>Editar Trabajador</h3>
            ) : (
              <h3 style={{ color: '#0f766e', marginBottom: 12 }}>Información Personal y Laboral</h3>
            )}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12,
              }}
            >
              <div>
                <label
                  htmlFor="worker-tipo-doc"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  Tipo Doc. *
                </label>
                <select
                  id="worker-tipo-doc"
                  value={form.tipo_documento}
                  onChange={(e) => setForm({ ...form, tipo_documento: e.target.value as any })}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                  }}
                >
                  <option value="CC">CC</option>
                  <option value="CE">CE</option>
                  <option value="PP">PP</option>
                  <option value="TI">TI</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="worker-num-doc"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  Número Doc. *
                </label>
                <input
                  id="worker-num-doc"
                  value={form.numero_documento}
                  onChange={(e) => setForm({ ...form, numero_documento: e.target.value })}
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
                  htmlFor="worker-nombres"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  Nombres *
                </label>
                <input
                  id="worker-nombres"
                  value={form.nombres}
                  onChange={(e) => setForm({ ...form, nombres: e.target.value })}
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
                  htmlFor="worker-apellidos"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  Apellidos *
                </label>
                <input
                  id="worker-apellidos"
                  value={form.apellidos}
                  onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
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
                  htmlFor="worker-cargo"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  Cargo *
                </label>
                <input
                  id="worker-cargo"
                  value={form.cargo}
                  onChange={(e) => setForm({ ...form, cargo: e.target.value })}
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
                  htmlFor="worker-fecha-ingreso"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  Fecha Ingreso *
                </label>
                <input
                  id="worker-fecha-ingreso"
                  type="date"
                  value={form.fecha_ingreso}
                  onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })}
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
                  htmlFor="worker-fecha-egreso"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  Fecha Egreso
                </label>
                <input
                  id="worker-fecha-egreso"
                  type="date"
                  value={form.fecha_egreso || ''}
                  onChange={(e) => setForm({ ...form, fecha_egreso: e.target.value })}
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
                  htmlFor="worker-estado"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  Estado
                </label>
                <select
                  id="worker-estado"
                  value={form.estado}
                  onChange={(e) => setForm({ ...form, estado: e.target.value as any })}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                  }}
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="retirado">Retirado</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="worker-eps"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  EPS
                </label>
                <input
                  id="worker-eps"
                  value={form.eps || ''}
                  onChange={(e) => setForm({ ...form, eps: e.target.value })}
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
                  htmlFor="worker-afp"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  AFP
                </label>
                <input
                  id="worker-afp"
                  value={form.afp || ''}
                  onChange={(e) => setForm({ ...form, afp: e.target.value })}
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
                  htmlFor="worker-arl"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  ARL
                </label>
                <input
                  id="worker-arl"
                  value={form.arl || ''}
                  onChange={(e) => setForm({ ...form, arl: e.target.value })}
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
                  htmlFor="worker-caja"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  Caja Compensación
                </label>
                <input
                  id="worker-caja"
                  value={form.caja_compensacion || ''}
                  onChange={(e) => setForm({ ...form, caja_compensacion: e.target.value })}
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
                  htmlFor="worker-telefono"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  Teléfono
                </label>
                <input
                  id="worker-telefono"
                  value={form.telefono || ''}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
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
                  htmlFor="worker-email"
                  style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}
                >
                  Email
                </label>
                <input
                  id="worker-email"
                  type="email"
                  value={form.email || ''}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setForm({ ...initialForm });
                  setEditingWorker(null);
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
                {editingWorker ? 'Actualizar' : 'Guardar'} Trabajador
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: EXÁMENES MÉDICOS */}
      {activeTab === 'examenes' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <h3 style={{ color: '#0f766e', margin: 0 }}>Exámenes Médicos Ocupacionales</h3>
            <button
              onClick={() => openExamModal()}
              disabled={!selectedWorker || !exams.some((e) => e.tipo === 'ingreso')}
              style={{
                padding: '8px 14px',
                background: exams.some((e) => e.tipo === 'ingreso') ? '#0f766e' : '#94a3b8',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 'bold',
                cursor: exams.some((e) => e.tipo === 'ingreso') ? 'pointer' : 'not-allowed',
              }}
            >
              + Agregar Examen
            </button>
          </div>

          {!exams.some((e) => e.tipo === 'ingreso') && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                padding: 12,
                borderRadius: 8,
                marginBottom: 12,
                color: '#991b1b',
                fontSize: 13,
              }}
            >
              ⚠️ <strong>Falta examen de ingreso obligatorio.</strong> Todo trabajador debe tener
              examen de ingreso (Res. 0312/2019 E13).
              <button
                onClick={() => openExamModal()}
                style={{
                  marginLeft: 8,
                  padding: '4px 10px',
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Registrar Ahora
              </button>
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
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Tipo</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Fecha</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Vencimiento</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Resultado</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Médico / Entidad</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((ex) => {
                  const status = getExamStatus(ex);
                  return (
                    <tr key={ex.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td
                        style={{
                          padding: 10,
                          fontWeight: 500,
                          textTransform: 'capitalize',
                        }}
                      >
                        {ex.tipo}
                      </td>
                      <td style={{ padding: 10 }}>{ex.fecha.slice(0, 10)}</td>
                      <td style={{ padding: 10 }}>
                        {ex.vencimiento ? ex.vencimiento.slice(0, 10) : '—'}
                      </td>
                      <td style={{ padding: 10 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 'bold',
                            background:
                              ex.resultado === 'no_apto'
                                ? '#fee2e2'
                                : ex.resultado === 'apto_con_restricciones'
                                  ? '#fef3c7'
                                  : '#dcfce7',
                            color:
                              ex.resultado === 'no_apto'
                                ? '#991b1b'
                                : ex.resultado === 'apto_con_restricciones'
                                  ? '#92400e'
                                  : '#166534',
                          }}
                        >
                          {ex.resultado.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: 10, fontSize: 12, color: '#4b5563' }}>
                        {ex.medico || '—'} / {ex.entidad || '—'}
                      </td>
                      <td style={{ padding: 10 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 'bold',
                            color: status.text,
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: status.dot,
                            }}
                          ></span>
                          {status.label}
                        </span>
                      </td>
                      <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => openExamModal(ex)}
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
                          onClick={() => handleDeleteExam(ex.id)}
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
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {exams.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>
                      No hay exámenes registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CERTIFICADOS */}
      {activeTab === 'certificados' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <h3 style={{ color: '#0f766e', margin: 0 }}>Certificados y Capacitaciones</h3>
            <button
              onClick={() => openCertModal()}
              style={{
                padding: '8px 14px',
                background: '#0f766e',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 'bold',
              }}
            >
              + Agregar Certificado
            </button>
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
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Tipo</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Curso</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Entidad</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Emisión</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Vencimiento</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {certs.map((cert) => {
                  const status = getCertStatus(cert);
                  const tipoLabel =
                    CERT_TYPES.find((t) => t.value === cert.tipo)?.label || cert.tipo;
                  return (
                    <tr key={cert.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: 10, fontSize: 12 }}>{tipoLabel}</td>
                      <td style={{ padding: 10 }}>{cert.nombre_curso || '—'}</td>
                      <td style={{ padding: 10, fontSize: 12 }}>{cert.entidad || '—'}</td>
                      <td style={{ padding: 10 }}>{cert.fecha_emision.slice(0, 10)}</td>
                      <td style={{ padding: 10 }}>
                        {cert.fecha_vencimiento.slice(0, 10)}
                        {cert.tipo === 'alturas' && (
                          <span
                            style={{
                              display: 'inline-block',
                              marginLeft: 6,
                              fontSize: 10,
                              background: '#dbeafe',
                              color: '#1e40af',
                              padding: '1px 4px',
                              borderRadius: 4,
                            }}
                          >
                            3 años (Res. 4272/2021)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: 10 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 'bold',
                            color: status.text,
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: status.dot,
                            }}
                          ></span>
                          {status.label}
                        </span>
                      </td>
                      <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => openCertModal(cert)}
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
                          onClick={() => handleDeleteCert(cert.id)}
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
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {certs.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>
                      No hay certificados registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: EPP / DOTACIÓN */}
      {activeTab === 'epp' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <h3 style={{ color: '#0f766e', margin: 0 }}>
              Entrega de EPP y Dotación (Res. 0312/2019 E19)
            </h3>
            <button
              onClick={() => openEppModal()}
              style={{
                padding: '8px 14px',
                background: '#0f766e',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 'bold',
              }}
            >
              + Registrar Entrega
            </button>
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
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Ítem</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Cant.</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Entrega</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Vencimiento</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Firma</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {epp.map((item) => {
                  const status = getEppStatus(item);
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: 10, fontWeight: 500 }}>{item.item}</td>
                      <td style={{ padding: 10, textAlign: 'center' }}>{item.cantidad}</td>
                      <td style={{ padding: 10 }}>{item.fecha_entrega.slice(0, 10)}</td>
                      <td style={{ padding: 10 }}>
                        {item.fecha_vencimiento ? item.fecha_vencimiento.slice(0, 10) : '—'}
                      </td>
                      <td
                        style={{
                          padding: 10,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {item.firmado_por_trabajador ? (
                          <>
                            <span style={{ color: '#10b981', fontSize: 16 }}>✅</span>
                            <button
                              onClick={() => window.open(item.firma_url!, '_blank')}
                              style={{
                                padding: '2px 6px',
                                background: '#dcfce7',
                                color: '#166534',
                                border: 'none',
                                borderRadius: 4,
                                fontSize: 10,
                                cursor: 'pointer',
                              }}
                            >
                              Ver firma
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleSignEpp(item)}
                            style={{
                              padding: '4px 8px',
                              background: '#f59e0b',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 4,
                              fontSize: 11,
                              cursor: 'pointer',
                            }}
                          >
                            🖊️ Firmar
                          </button>
                        )}
                      </td>
                      <td style={{ padding: 10 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 'bold',
                            color: status.text,
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: status.dot,
                            }}
                          ></span>
                          {status.label}
                        </span>
                      </td>
                      <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => openEppModal(item)}
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
                          onClick={() => handleDeleteEpp(item.id)}
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
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {epp.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>
                      No hay entregas de EPP registradas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {eppUnsigned > 0 && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: 8,
                color: '#92400e',
                fontSize: 13,
              }}
            >
              ⚠️{' '}
              <strong>{eppUnsigned} entrega(s) de EPP pendientes de firma del trabajador.</strong>{' '}
              La firma es obligatoria según Res. 0312/2019 E19.
            </div>
          )}
        </div>
      )}

      {/* Modales internos */}
      {examModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
          }}
        >
          <div
            style={{
              background: '#fff',
              width: '90%',
              maxWidth: 500,
              maxHeight: '90vh',
              borderRadius: 12,
              padding: 20,
              overflow: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>
              {editingExam ? 'Editar Examen' : 'Nuevo Examen Médico'}
            </h3>
            <form
              onSubmit={handleExamSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div>
                <label
                  htmlFor="exam-tipo"
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 'bold',
                    color: '#374151',
                  }}
                >
                  Tipo *
                </label>
                <select
                  id="exam-tipo"
                  value={examForm.tipo}
                  onChange={(e) => setExamForm({ ...examForm, tipo: e.target.value as any })}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                  }}
                >
                  <option value="ingreso">Ingreso</option>
                  <option value="periodico">Periódico</option>
                  <option value="egreso">Egreso</option>
                  <option value="control">Control</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label
                    htmlFor="exam-fecha"
                    style={{
                      display: 'block',
                      marginBottom: 6,
                      fontSize: 13,
                      fontWeight: 'bold',
                      color: '#374151',
                    }}
                  >
                    Fecha *
                  </label>
                  <input
                    id="exam-fecha"
                    type="date"
                    value={examForm.fecha}
                    onChange={(e) => setExamForm({ ...examForm, fecha: e.target.value })}
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
                    htmlFor="exam-vencimiento"
                    style={{
                      display: 'block',
                      marginBottom: 6,
                      fontSize: 13,
                      fontWeight: 'bold',
                      color: '#374151',
                    }}
                  >
                    Vencimiento
                  </label>
                  <input
                    id="exam-vencimiento"
                    type="date"
                    value={examForm.vencimiento}
                    onChange={(e) => setExamForm({ ...examForm, vencimiento: e.target.value })}
                    style={{
                      width: '100%',
                      padding: 8,
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                    }}
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="exam-resultado"
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 'bold',
                    color: '#374151',
                  }}
                >
                  Resultado *
                </label>
                <select
                  id="exam-resultado"
                  value={examForm.resultado}
                  onChange={(e) => setExamForm({ ...examForm, resultado: e.target.value as any })}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                  }}
                >
                  <option value="apto">Apto</option>
                  <option value="apto_con_restricciones">Apto con restricciones</option>
                  <option value="no_apto">No apto</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="exam-restricciones"
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 'bold',
                    color: '#374151',
                  }}
                >
                  Restricciones
                </label>
                <textarea
                  id="exam-restricciones"
                  value={examForm.restricciones}
                  onChange={(e) => setExamForm({ ...examForm, restricciones: e.target.value })}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label
                    htmlFor="exam-medico"
                    style={{
                      display: 'block',
                      marginBottom: 6,
                      fontSize: 13,
                      fontWeight: 'bold',
                      color: '#374151',
                    }}
                  >
                    Médico
                  </label>
                  <input
                    id="exam-medico"
                    value={examForm.medico}
                    onChange={(e) => setExamForm({ ...examForm, medico: e.target.value })}
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
                    htmlFor="exam-entidad"
                    style={{
                      display: 'block',
                      marginBottom: 6,
                      fontSize: 13,
                      fontWeight: 'bold',
                      color: '#374151',
                    }}
                  >
                    Entidad
                  </label>
                  <input
                    id="exam-entidad"
                    value={examForm.entidad}
                    onChange={(e) => setExamForm({ ...examForm, entidad: e.target.value })}
                    style={{
                      width: '100%',
                      padding: 8,
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                    }}
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="exam-notas"
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 'bold',
                    color: '#374151',
                  }}
                >
                  Notas
                </label>
                <textarea
                  id="exam-notas"
                  value={examForm.notas}
                  onChange={(e) => setExamForm({ ...examForm, notas: e.target.value })}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setExamModalOpen(false)}
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
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {certModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
          }}
        >
          <div
            style={{
              background: '#fff',
              width: '90%',
              maxWidth: 500,
              maxHeight: '90vh',
              borderRadius: 12,
              padding: 20,
              overflow: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>
              {editingCert ? 'Editar Certificado' : 'Nuevo Certificado'}
            </h3>
            <form
              onSubmit={handleCertSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div>
                <label
                  htmlFor="cert-tipo"
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 'bold',
                    color: '#374151',
                  }}
                >
                  Tipo *
                </label>
                <select
                  id="cert-tipo"
                  value={certForm.tipo}
                  onChange={(e) => setCertForm({ ...certForm, tipo: e.target.value as any })}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                  }}
                >
                  {CERT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="cert-nombre"
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 'bold',
                    color: '#374151',
                  }}
                >
                  Nombre del Curso
                </label>
                <input
                  id="cert-nombre"
                  value={certForm.nombre_curso}
                  onChange={(e) => setCertForm({ ...certForm, nombre_curso: e.target.value })}
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
                  htmlFor="cert-entidad"
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 'bold',
                    color: '#374151',
                  }}
                >
                  Entidad Emisora
                </label>
                <input
                  id="cert-entidad"
                  value={certForm.entidad}
                  onChange={(e) => setCertForm({ ...certForm, entidad: e.target.value })}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                  }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label
                    htmlFor="cert-fecha-emision"
                    style={{
                      display: 'block',
                      marginBottom: 6,
                      fontSize: 13,
                      fontWeight: 'bold',
                      color: '#374151',
                    }}
                  >
                    Fecha Emisión *
                  </label>
                  <input
                    id="cert-fecha-emision"
                    type="date"
                    value={certForm.fecha_emision}
                    onChange={(e) => handleCertFechaEmisionChange(e.target.value)}
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
                    htmlFor="cert-fecha-vencimiento"
                    style={{
                      display: 'block',
                      marginBottom: 6,
                      fontSize: 13,
                      fontWeight: 'bold',
                      color: '#374151',
                    }}
                  >
                    Fecha Vencimiento *
                  </label>
                  <input
                    id="cert-fecha-vencimiento"
                    type="date"
                    value={certForm.fecha_vencimiento}
                    onChange={(e) =>
                      setCertForm({ ...certForm, fecha_vencimiento: e.target.value })
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
              </div>
              {certForm.tipo === 'alturas' && (
                <div
                  style={{
                    background: '#dbeafe',
                    border: '1px solid #93c5fd',
                    padding: 8,
                    borderRadius: 6,
                    fontSize: 11,
                    color: '#1e40af',
                  }}
                >
                  ℹ️ Para <strong>Trabajo en Alturas</strong> la vigencia es{' '}
                  <strong>exactamente 3 años</strong> (Res. 4272/2021 Art. 12). Se calcula
                  automáticamente al cambiar la fecha de emisión.
                </div>
              )}
              <div>
                <label
                  htmlFor="cert-notas"
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 'bold',
                    color: '#374151',
                  }}
                >
                  Notas
                </label>
                <textarea
                  id="cert-notas"
                  value={certForm.notas}
                  onChange={(e) => setCertForm({ ...certForm, notas: e.target.value })}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setCertModalOpen(false)}
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
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {eppModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
          }}
        >
          <div
            style={{
              background: '#fff',
              width: '90%',
              maxWidth: 500,
              maxHeight: '90vh',
              borderRadius: 12,
              padding: 20,
              overflow: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>
              {editingEpp ? 'Editar EPP' : 'Registrar Entrega de EPP'}
            </h3>
            <form
              onSubmit={handleEppSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div>
                <label
                  htmlFor="epp-item"
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 'bold',
                    color: '#374151',
                  }}
                >
                  Ítem EPP *
                </label>
                <select
                  id="epp-item"
                  value={eppForm.item}
                  onChange={(e) => setEppForm({ ...eppForm, item: e.target.value })}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                  }}
                >
                  {EPP_ITEMS.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label
                    htmlFor="epp-cantidad"
                    style={{
                      display: 'block',
                      marginBottom: 6,
                      fontSize: 13,
                      fontWeight: 'bold',
                      color: '#374151',
                    }}
                  >
                    Cantidad
                  </label>
                  <input
                    id="epp-cantidad"
                    type="number"
                    min="1"
                    value={eppForm.cantidad}
                    onChange={(e) =>
                      setEppForm({ ...eppForm, cantidad: parseInt(e.target.value) || 1 })
                    }
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
                    htmlFor="epp-fecha-entrega"
                    style={{
                      display: 'block',
                      marginBottom: 6,
                      fontSize: 13,
                      fontWeight: 'bold',
                      color: '#374151',
                    }}
                  >
                    Fecha Entrega *
                  </label>
                  <input
                    id="epp-fecha-entrega"
                    type="date"
                    value={eppForm.fecha_entrega}
                    onChange={(e) => setEppForm({ ...eppForm, fecha_entrega: e.target.value })}
                    style={{
                      width: '100%',
                      padding: 8,
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                    }}
                    required
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="epp-fecha-vencimiento"
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 'bold',
                    color: '#374151',
                  }}
                >
                  Fecha Vencimiento
                </label>
                <input
                  id="epp-fecha-vencimiento"
                  type="date"
                  value={eppForm.fecha_vencimiento}
                  onChange={(e) => setEppForm({ ...eppForm, fecha_vencimiento: e.target.value })}
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
                  htmlFor="epp-notas"
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 'bold',
                    color: '#374151',
                  }}
                >
                  Notas
                </label>
                <textarea
                  id="epp-notas"
                  value={eppForm.notas}
                  onChange={(e) => setEppForm({ ...eppForm, notas: e.target.value })}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setEppModalOpen(false)}
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
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SignaturePad Modal */}
      {signingEpp && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
          }}
        >
          <SignaturePad
            width={Math.min(400, window.innerWidth - 40)}
            onSave={handleSaveSignature}
            onCancel={() => setSigningEpp(null)}
          />
        </div>
      )}

      {/* ===== TABLA PRINCIPAL TRABAJADORES ===== */}
      <div style={{ marginTop: selectedWorker ? 0 : 20 }}>
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
                <td style={{ padding: 10 }}>
                  {w.tipo_documento} {w.numero_documento}
                </td>
                <td style={{ padding: 10, fontWeight: 500 }}>
                  {w.nombres} {w.apellidos}
                </td>
                <td style={{ padding: 10 }}>{w.cargo}</td>
                <td style={{ padding: 10 }}>{w.fecha_ingreso.slice(0, 10)}</td>
                <td style={{ padding: 10 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 'bold',
                      background:
                        w.estado === 'activo'
                          ? '#dcfce7'
                          : w.estado === 'inactivo'
                            ? '#fef3c7'
                            : '#fee2e2',
                      color:
                        w.estado === 'activo'
                          ? '#166534'
                          : w.estado === 'inactivo'
                            ? '#92400e'
                            : '#991b1c',
                    }}
                  >
                    {w.estado}
                  </span>
                </td>
                <td style={{ padding: 10, fontSize: 12, color: '#4b5563' }}>
                  {w.eps || '-'}
                  {w.arl ? ' / ' + w.arl : ''}
                </td>
                <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => openWorkerDetail(w)}
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
                    👁 Ver ficha
                  </button>
                  <button
                    onClick={() => openWorkerDetail(w)}
                    style={{
                      padding: '4px 8px',
                      background: '#e5e7eb',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => _handleDeleteWorker(w.id)}
                    style={{
                      padding: '4px 8px',
                      background: '#fee2e2',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: 11,
                      cursor: 'pointer',
                      color: '#b91c1c',
                    }}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
            {workers.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>
                  No hay trabajadores registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingWorker && (
        <p style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>
          Editando trabajador. Guarde para aplicar cambios.
        </p>
      )}
    </div>
  );
}
