import { useCallback, useEffect, useState } from 'react';

import { SignaturePad } from '@/components/SignaturePad';
import { api } from '@/lib/api';

const ESTADO_PERMIT_COLORS: Record<string, { bg: string; text: string }> = {
  pendiente: { bg: '#fef3c7', text: '#92400e' },
  autorizado: { bg: '#dcfce7', text: '#166534' },
  rechazado: { bg: '#fee2e2', text: '#dc2626' },
  cerrado: { bg: '#f3f4f6', text: '#374151' },
};

const ESTADO_ATS_COLORS: Record<string, { bg: string; text: string }> = {
  vigente: { bg: '#dcfce7', text: '#166534' },
  cerrado: { bg: '#f3f4f6', text: '#374151' },
};

interface AlturaPermit {
  id: string;
  obra: string;
  fecha: string;
  hora_inicio?: string;
  hora_fin?: string;
  solicitante?: string;
  responsable_seguridad?: string;
  sistema_proteccion?: string;
  equipo_verificado: number;
  apto_medico: number;
  certificado_alturas: number;
  estado: string;
  at_s_id?: string;
  firma_solicitante_url?: string;
  firma_responsable_url?: string;
  archivo_fotos?: string;
  creado_en: string;
  actualizado_en: string;
}

interface ATS {
  id: string;
  obra: string;
  tarea: string;
  peligro?: string;
  control?: string;
  responsable?: string;
  fecha: string;
  estado: string;
}

interface PermitForm {
  obra: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  solicitante: string;
  responsable_seguridad: string;
  sistema_proteccion: string;
  equipo_verificado: boolean;
  apto_medico: boolean;
  certificado_alturas: boolean;
  estado: string;
  fotos: string[];
  firma_solicitante_url: string;
  firma_responsable_url: string;
}

interface ATSForm {
  obra: string;
  tarea: string;
  peligro: string;
  control: string;
  responsable: string;
  fecha: string;
  estado: string;
}

const initialPermitForm: PermitForm = {
  obra: '',
  fecha: new Date().toISOString().slice(0, 10),
  hora_inicio: '07:00',
  hora_fin: '17:00',
  solicitante: '',
  responsable_seguridad: '',
  sistema_proteccion: '',
  equipo_verificado: false,
  apto_medico: false,
  certificado_alturas: false,
  estado: 'pendiente',
  fotos: [],
  firma_solicitante_url: '',
  firma_responsable_url: '',
};

const initialATSForm: ATSForm = {
  obra: '',
  tarea: '',
  peligro: '',
  control: '',
  responsable: '',
  fecha: new Date().toISOString().slice(0, 10),
  estado: 'vigente',
};

export default function Altura() {
  const [activeTab, setActiveTab] = useState<'permisos' | 'ats'>('permisos');
  const [permits, setPermits] = useState<AlturaPermit[]>([]);
  const [atsList, setAtsList] = useState<ATS[]>([]);
  const [permitForm, setPermitForm] = useState<PermitForm>(initialPermitForm);
  const [atsForm, setAtsForm] = useState<ATSForm>(initialATSForm);
  const [editingPermit, setEditingPermit] = useState<AlturaPermit | null>(null);
  const [editingATS, setEditingATS] = useState<ATS | null>(null);
  const [viewingPermit, setViewingPermit] = useState<AlturaPermit | null>(null);
  const [signingPermit, setSigningPermit] = useState<{ permit: AlturaPermit; field: 'solicitante' | 'responsable' } | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [permitsData, atsData] = await Promise.all([
        api.get('/altura/permits'),
        api.get('/altura/ats'),
      ]);
      setPermits(permitsData as AlturaPermit[]);
      setAtsList(atsData as ATS[]);
    } catch (err: any) {
      console.error('Error cargando datos:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePhotoCapture = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'permit') => {
    const files = e.target.files;
    if (!files) return;
    const newPhotos: string[] = [];
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        const base64 = await handlePhotoCapture(file);
        newPhotos.push(base64);
      }
    }
    if (target === 'permit') {
      setPermitForm(prev => ({ ...prev, fotos: [...prev.fotos, ...newPhotos] }));
    }
  };

  const removePhoto = (index: number) => {
    setPermitForm(prev => ({ ...prev, fotos: prev.fotos.filter((_, i) => i !== index) }));
  };

  const openPermit = (p: AlturaPermit) => {
    setViewingPermit(p);
    if (p.archivo_fotos) {
      try { setPermitForm({ ...initialPermitForm, ...p, fotos: JSON.parse(p.archivo_fotos), equipo_verificado: !!p.equipo_verificado, apto_medico: !!p.apto_medico, certificado_alturas: !!p.certificado_alturas }); } catch { setPermitForm({ ...initialPermitForm, ...p, equipo_verificado: !!p.equipo_verificado, apto_medico: !!p.apto_medico, certificado_alturas: !!p.certificado_alturas }); }
    } else {
      setPermitForm({ ...initialPermitForm, ...p, equipo_verificado: !!p.equipo_verificado, apto_medico: !!p.apto_medico, certificado_alturas: !!p.certificado_alturas });
    }
  };

  const editPermit = (p: AlturaPermit) => {
    setEditingPermit(p);
    setActiveTab('permisos');
    if (p.archivo_fotos) {
      try { setPermitForm({ ...initialPermitForm, ...p, fotos: JSON.parse(p.archivo_fotos), equipo_verificado: !!p.equipo_verificado, apto_medico: !!p.apto_medico, certificado_alturas: !!p.certificado_alturas }); } catch { setPermitForm({ ...initialPermitForm, ...p, equipo_verificado: !!p.equipo_verificado, apto_medico: !!p.apto_medico, certificado_alturas: !!p.certificado_alturas }); }
    } else {
      setPermitForm({ ...initialPermitForm, ...p, equipo_verificado: !!p.equipo_verificado, apto_medico: !!p.apto_medico, certificado_alturas: !!p.certificado_alturas });
    }
  };

  const newPermit = () => {
    setEditingPermit(null);
    setViewingPermit(null);
    setPermitForm(initialPermitForm);
  };

  const handlePermitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const payload = {
        ...permitForm,
        equipo_verificado: permitForm.equipo_verificado ? 1 : 0,
        apto_medico: permitForm.apto_medico ? 1 : 0,
        certificado_alturas: permitForm.certificado_alturas ? 1 : 0,
        archivo_fotos: JSON.stringify(permitForm.fotos),
      };
      if (editingPermit) {
        await api.put(`/altura/permits/${editingPermit.id}`, payload);
        setMessage({ type: 'success', text: 'Permiso actualizado correctamente' });
      } else {
        await api.post('/altura/permits', payload);
        setMessage({ type: 'success', text: 'Permiso registrado correctamente' });
      }
      newPermit();
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error guardando permiso' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePermit = async (id: string) => {
    if (!confirm('Eliminar este permiso?')) return;
    try {
      await api.delete(`/altura/permits/${id}`);
      setMessage({ type: 'success', text: 'Permiso eliminado' });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error eliminando' });
    }
  };

  const handleSignPermit = (permit: AlturaPermit, field: 'solicitante' | 'responsable') => {
    setSigningPermit({ permit, field });
  };

  const handleSavePermitSignature = async (dataUrl: string) => {
    if (!signingPermit) return;
    try {
      const field = signingPermit.field === 'solicitante' ? 'firma_solicitante_url' : 'firma_responsable_url';
      await api.put(`/altura/permits/${signingPermit.permit.id}`, { [field]: dataUrl });
      setMessage({ type: 'success', text: 'Firma guardada' });
      loadData();
      setSigningPermit(null);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error guardando firma' });
    }
  };

  // ATS handlers
  const editATS = (a: ATS) => {
    setEditingATS(a);
    setActiveTab('ats');
    setAtsForm({ ...initialATSForm, ...a });
  };

  const newATS = () => {
    setEditingATS(null);
    setAtsForm(initialATSForm);
  };

  const handleATSSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (editingATS) {
        await api.put(`/altura/ats/${editingATS.id}`, atsForm);
        setMessage({ type: 'success', text: 'ATS actualizado correctamente' });
      } else {
        await api.post('/altura/ats', atsForm);
        setMessage({ type: 'success', text: 'ATS registrado correctamente' });
      }
      newATS();
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error guardando ATS' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteATS = async (id: string) => {
    if (!confirm('Eliminar este ATS?')) return;
    try {
      await api.delete(`/altura/ats/${id}`);
      setMessage({ type: 'success', text: 'ATS eliminado' });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error eliminando' });
    }
  };

  const _showToast = (msg: string, isError = false) => {
    setMessage({ type: isError ? 'error' : 'success', text: msg });
    setTimeout(() => setMessage(null), 4000);
  };

  return (
    <div style={{ padding: 20, maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, color: '#0f766e' }}>Trabajo en Alturas - Permiso y ATS (Res. 4272/2021)</h1>
      </div>

      {message && (
        <div style={{ background: message.type === 'success' ? '#ecfdf5' : '#fef2f2', border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`, color: message.type === 'success' ? '#065f46' : '#991b1b', padding: 10, borderRadius: 8, marginBottom: 14 }}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 16 }}>
        {[
          { id: 'permisos', label: '📋 Permisos de Trabajo en Alturas' },
          { id: 'ats', label: '📝 ATS - Análisis de Trabajo Seguro' },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{ padding: '12px 20px', border: 'none', background: activeTab === tab.id ? '#fff' : 'transparent', color: activeTab === tab.id ? '#0f766e' : '#6b7280', fontWeight: activeTab === tab.id ? 'bold' : 'normal', fontSize: 13, cursor: 'pointer', borderBottom: `3px solid ${activeTab === tab.id ? '#0f766e' : 'transparent'}`, marginBottom: '-1px', transition: 'all 0.15s' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: PERMISOS */}
      {activeTab === 'permisos' && (
        <>
          <div style={{ background: '#fff', padding: 16, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>{editingPermit ? 'Editar Permiso' : viewingPermit ? 'Ver Permiso' : 'Nuevo Permiso de Trabajo en Alturas'}</h3>
            <form onSubmit={handlePermitSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label htmlFor="permit-obra" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Obra / Instalación *</label>
                  <input id="permit-obra" value={permitForm.obra} onChange={e => setPermitForm({ ...permitForm, obra: e.target.value })} placeholder="Ej: Instalación CCTV Edificio Norte" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
                </div>
                <div>
                  <label htmlFor="permit-fecha" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Fecha *</label>
                  <input id="permit-fecha" type="date" value={permitForm.fecha} onChange={e => setPermitForm({ ...permitForm, fecha: e.target.value })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
                </div>
                <div>
                  <label htmlFor="permit-hora-inicio" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Hora inicio</label>
                  <input id="permit-hora-inicio" type="time" value={permitForm.hora_inicio} onChange={e => setPermitForm({ ...permitForm, hora_inicio: e.target.value })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label htmlFor="permit-hora-fin" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Hora fin</label>
                  <input id="permit-hora-fin" type="time" value={permitForm.hora_fin} onChange={e => setPermitForm({ ...permitForm, hora_fin: e.target.value })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label htmlFor="permit-solicitante" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Solicitante</label>
                  <input id="permit-solicitante" value={permitForm.solicitante} onChange={e => setPermitForm({ ...permitForm, solicitante: e.target.value })} placeholder="Quién solicita el permiso" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label htmlFor="permit-resp-seg" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Responsable de Seguridad</label>
                  <input id="permit-resp-seg" value={permitForm.responsable_seguridad} onChange={e => setPermitForm({ ...permitForm, responsable_seguridad: e.target.value })} placeholder="Vigía / Responsable SST" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label htmlFor="permit-sistema" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Sistema de protección</label>
                  <input id="permit-sistema" value={permitForm.sistema_proteccion} onChange={e => setPermitForm({ ...permitForm, sistema_proteccion: e.target.value })} placeholder="Ej: Línea de vida horizontal + arnés doble" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>

              {/* Controles obligatorios Res. 4272/2021 */}
              <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <strong style={{ color: '#166534', display: 'block', marginBottom: 8 }}>✅ Controles obligatorios (Res. 4272/2021 Art. 12-14)</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={permitForm.equipo_verificado} onChange={e => setPermitForm({ ...permitForm, equipo_verificado: e.target.checked })} />
                    <span>Equipos inspeccionados (arnés, línea de vida, anclajes)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={permitForm.apto_medico} onChange={e => setPermitForm({ ...permitForm, apto_medico: e.target.checked })} />
                    <span>{'Apto médico vigente (altura > 2m)'}</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={permitForm.certificado_alturas} onChange={e => setPermitForm({ ...permitForm, certificado_alturas: e.target.checked })} />
                    <span>Certificación trabajo en alturas vigente (3 años)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <select value={permitForm.estado} onChange={e => setPermitForm({ ...permitForm, estado: e.target.value })} style={{ padding: 6, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13 }}>
                      <option value="pendiente">Pendiente de autorización</option>
                      <option value="autorizado">Autorizado</option>
                      <option value="rechazado">Rechazado</option>
                      <option value="cerrado">Cerrado/Finalizado</option>
                    </select>
                    <span>Estado del permiso</span>
                  </label>
                </div>
              </div>

              {/* Fotos */}
              <div>
                <label htmlFor="permit-photo-input" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>📷 Evidencia fotográfica (condiciones, equipos, anclajes)</label>
                <input type="file" accept="image/*" multiple onChange={e => handleFileChange(e, 'permit')} style={{ display: 'none' }} id="permit-photo-input" />
                <button type="button" onClick={() => document.getElementById('permit-photo-input')?.click()} style={{ padding: '8px 16px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 6, cursor: 'pointer', fontSize: 13, marginBottom: 8 }}>📷 Agregar fotos</button>
                {permitForm.fotos.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {permitForm.fotos.map((photo, idx) => (
                      <div key={idx} style={{ position: 'relative', width: 100, height: 100, borderRadius: 6, overflow: 'hidden', border: '1px solid #d1d5db' }}>
                        <img src={photo} alt={`Foto ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button type="button" onClick={() => removePhoto(idx)} style={{ position: 'absolute', top: 2, right: 2, padding: '2px 6px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: 10, lineHeight: 1 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Firmas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                <div>
                  <label htmlFor="permit-firma-solicitante" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>✍️ Firma Solicitante</label>
                  {permitForm.firma_solicitante_url ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <img src={permitForm.firma_solicitante_url} alt="Firma solicitante" style={{ maxHeight: 50, border: '1px solid #d1d5db', borderRadius: 4 }} />
                      <button type="button" onClick={() => setPermitForm({ ...permitForm, firma_solicitante_url: '' })} style={{ padding: '4px 8px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Eliminar</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => handleSignPermit({ id: 'new' } as AlturaPermit, 'solicitante')} style={{ padding: '8px 16px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 6, cursor: 'pointer', fontSize: 13, width: '100%' }}>✍️ Firmar en pantalla</button>
                  )}
                </div>
                <div>
                  <label htmlFor="permit-firma-responsable" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>✍️ Firma Responsable Seguridad / Vigía</label>
                  {permitForm.firma_responsable_url ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <img src={permitForm.firma_responsable_url} alt="Firma responsable" style={{ maxHeight: 50, border: '1px solid #d1d5db', borderRadius: 4 }} />
                      <button type="button" onClick={() => setPermitForm({ ...permitForm, firma_responsable_url: '' })} style={{ padding: '4px 8px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Eliminar</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => handleSignPermit({ id: 'new' } as AlturaPermit, 'responsable')} style={{ padding: '8px 16px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 6, cursor: 'pointer', fontSize: 13, width: '100%' }}>✍️ Firmar en pantalla</button>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={newPermit} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={loading} style={{ padding: '10px 16px', background: loading ? '#94a3b8' : '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Guardando...' : editingPermit ? 'Actualizar' : 'Registrar Permiso'}
                </button>
              </div>
            </form>
          </div>

          {/* Lista de permisos */}
          <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Obra</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Fecha</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Horario</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Solicitante</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Resp. Seguridad</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Controles</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Fotos</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Firmas</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {permits.map((x) => {
                  const estadoColor = ESTADO_PERMIT_COLORS[x.estado] || { bg: '#f3f4f6', text: '#374151' };
                  const controles = [x.equipo_verificado, x.apto_medico, x.certificado_alturas].filter(Boolean).length;
                  const hasFotos = x.archivo_fotos && JSON.parse(x.archivo_fotos).length > 0;
                  const hasFirmaSol = !!x.firma_solicitante_url;
                  const hasFirmaResp = !!x.firma_responsable_url;
                  return (
                    <tr key={x.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: 10, fontSize: 12 }}>{x.obra}</td>
                      <td style={{ padding: 10, fontSize: 12 }}>{x.fecha}</td>
                      <td style={{ padding: 10, fontSize: 12 }}>{x.hora_inicio || '—'} - {x.hora_fin || '—'}</td>
                      <td style={{ padding: 10, fontSize: 12 }}>{x.solicitante || '—'}</td>
                      <td style={{ padding: 10, fontSize: 12 }}>{x.responsable_seguridad || '—'}</td>
                      <td style={{ padding: 10, fontSize: 12, textAlign: 'center' }}>{controles}/3 {controles === 3 ? '✅' : '⚠️'}</td>
                      <td style={{ padding: 10 }}>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: estadoColor.bg, color: estadoColor.text }}>{x.estado}</span>
                      </td>
                      <td style={{ padding: 10, textAlign: 'center' }}>{hasFotos ? '📷' : '—'}</td>
                      <td style={{ padding: 10, textAlign: 'center' }}>{hasFirmaSol && hasFirmaResp ? '✅✅' : hasFirmaSol || hasFirmaResp ? '✅' : '—'}</td>
                      <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                        <button onClick={() => openPermit(x)} style={{ padding: '4px 8px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Ver</button>
                        <button onClick={() => editPermit(x)} style={{ padding: '4px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Editar</button>
                        <button onClick={() => handleDeletePermit(x.id)} style={{ padding: '4px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
                {permits.length === 0 && <tr><td colSpan={10} style={{ padding: 30, textAlign: 'center', color: '#9ca3af' }}>No hay permisos registrados</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Modal Ver Permiso */}
          {viewingPermit && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, overflow: 'auto' }}>
              <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 900, maxHeight: '90vh', overflow: 'auto' }}>
                <div style={{ padding: 20, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, color: '#0f766e' }}>Permiso: {viewingPermit.obra} - {viewingPermit.fecha}</h3>
                  <button onClick={() => setViewingPermit(null)} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>✕ Cerrar</button>
                </div>
                <div style={{ padding: 20, maxHeight: '70vh', overflow: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                    <div><strong>Horario:</strong> {viewingPermit.hora_inicio || '—'} - {viewingPermit.hora_fin || '—'}</div>
                    <div><strong>Solicitante:</strong> {viewingPermit.solicitante || '—'}</div>
                    <div><strong>Resp. Seguridad:</strong> {viewingPermit.responsable_seguridad || '—'}</div>
                    <div><strong>Sistema protección:</strong> {viewingPermit.sistema_proteccion || '—'}</div>
                    <div><strong>Estado:</strong> <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: (ESTADO_PERMIT_COLORS[viewingPermit.estado] || { bg: '#f3f4f6' }).bg, color: (ESTADO_PERMIT_COLORS[viewingPermit.estado] || { text: '#374151' }).text }}>{viewingPermit.estado}</span></div>
                  </div>
                  <div style={{ marginBottom: 16, padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                    <strong>Controles Res. 4272/2021:</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
                      <span style={{ color: viewingPermit.equipo_verificado ? '#16a34a' : '#ef4444' }}>{viewingPermit.equipo_verificado ? '✅' : '❌'} Equipos inspeccionados</span>
                      <span style={{ color: viewingPermit.apto_medico ? '#16a34a' : '#ef4444' }}>{viewingPermit.apto_medico ? '✅' : '❌'} Apto médico</span>
                      <span style={{ color: viewingPermit.certificado_alturas ? '#16a34a' : '#ef4444' }}>{viewingPermit.certificado_alturas ? '✅' : '❌'} Cert. alturas vigente</span>
                    </div>
                  </div>
                  {viewingPermit.archivo_fotos && (
                    <details style={{ marginBottom: 16 }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#0f766e' }}>📷 Fotos ({JSON.parse(viewingPermit.archivo_fotos).length})</summary>
                      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {JSON.parse(viewingPermit.archivo_fotos).map((photo: string, idx: number) => (
                          <img key={idx} src={photo} alt={`Foto ${idx + 1}`} style={{ maxWidth: 200, maxHeight: 150, borderRadius: 6, border: '1px solid #d1d5db' }} />
                        ))}
                      </div>
                    </details>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                    <div><strong>Firma Solicitante:</strong> {viewingPermit.firma_solicitante_url ? <img src={viewingPermit.firma_solicitante_url} alt="Firma" style={{ marginTop: 8, maxHeight: 60, border: '1px solid #d1d5db', borderRadius: 4 }} /> : <span style={{ color: '#ef4444' }}>No firmado</span>}</div>
                    <div><strong>Firma Resp. Seguridad:</strong> {viewingPermit.firma_responsable_url ? <img src={viewingPermit.firma_responsable_url} alt="Firma" style={{ marginTop: 8, maxHeight: 60, border: '1px solid #d1d5db', borderRadius: 4 }} /> : <span style={{ color: '#ef4444' }}>No firmado</span>}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal Firma Permiso */}
          {signingPermit && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 20 }}>
              <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 500, padding: 20 }}>
                <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>Firma digital - {signingPermit.field === 'solicitante' ? 'Solicitante' : 'Responsable Seguridad'}</h3>
                <SignaturePad onSave={handleSavePermitSignature} onCancel={() => setSigningPermit(null)} />
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: ATS */}
      {activeTab === 'ats' && (
        <>
          <div style={{ background: '#fff', padding: 16, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>{editingATS ? 'Editar ATS' : 'Nuevo ATS - Análisis de Trabajo Seguro'}</h3>
            <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 16 }}>Res. 4272/2021 Art. 15: ATS obligatorio para trabajo en alturas. Identificar peligros, definir controles y responsable.</p>
            <form onSubmit={handleATSSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label htmlFor="ats-obra" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Obra / Instalación *</label>
                  <input id="ats-obra" value={atsForm.obra} onChange={e => setAtsForm({ ...atsForm, obra: e.target.value })} placeholder="Ej: Fachada Edificio Central" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
                </div>
                <div>
                  <label htmlFor="ats-tarea" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Tarea *</label>
                  <input id="ats-tarea" value={atsForm.tarea} onChange={e => setAtsForm({ ...atsForm, tarea: e.target.value })} placeholder="Ej: Instalación cámaras CCTV en fachada" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
                </div>
                <div>
                  <label htmlFor="ats-fecha" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Fecha *</label>
                  <input id="ats-fecha" type="date" value={atsForm.fecha} onChange={e => setAtsForm({ ...atsForm, fecha: e.target.value })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
                </div>
                <div>
                  <label htmlFor="ats-responsable" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Responsable</label>
                  <input id="ats-responsable" value={atsForm.responsable} onChange={e => setAtsForm({ ...atsForm, responsable: e.target.value })} placeholder="Quien ejecuta/supervisa" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label htmlFor="ats-peligro" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>⚠️ Peligros identificados *</label>
                  <textarea id="ats-peligro" value={atsForm.peligro} onChange={e => setAtsForm({ ...atsForm, peligro: e.target.value })} rows={4} placeholder="Caída a distinto nivel&#10;Golpe por caída de objetos&#10;Contacto con líneas eléctricas&#10;Condiciones climáticas adversas" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', resize: 'vertical' }} required />
                </div>
                <div>
                  <label htmlFor="ats-control" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>🛡️ Controles y medidas preventivas *</label>
                  <textarea id="ats-control" value={atsForm.control} onChange={e => setAtsForm({ ...atsForm, control: e.target.value })} rows={4} placeholder="Arnés doble + línea de vida&#10;Casco con barbijo&#10;Zona de exclusión + señalización&#10;Vigía + plan de rescate&#10;Suspender si viento > 40 km/h" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', resize: 'vertical' }} required />
                </div>
              </div>
              <div>
                <label htmlFor="ats-estado" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Estado</label>
                <select id="ats-estado" value={atsForm.estado} onChange={e => setAtsForm({ ...atsForm, estado: e.target.value })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
                  <option value="vigente">Vigente</option>
                  <option value="cerrado">Cerrado</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={newATS} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Nuevo</button>
                <button type="submit" disabled={loading} style={{ padding: '10px 16px', background: loading ? '#94a3b8' : '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Guardando...' : editingATS ? 'Actualizar' : 'Registrar ATS'}
                </button>
              </div>
            </form>
          </div>

          {/* Lista ATS */}
          <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Obra</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Tarea</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Fecha</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Responsable</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {atsList.map((x) => {
                  const estadoColor = ESTADO_ATS_COLORS[x.estado] || { bg: '#f3f4f6', text: '#374151' };
                  return (
                    <tr key={x.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: 10, fontSize: 12, maxWidth: '200px' }}>{x.obra}</td>
                      <td style={{ padding: 10, fontSize: 12, maxWidth: '250px' }}>{x.tarea}</td>
                      <td style={{ padding: 10, fontSize: 12 }}>{x.fecha}</td>
                      <td style={{ padding: 10, fontSize: 12 }}>{x.responsable || '—'}</td>
                      <td style={{ padding: 10 }}>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: estadoColor.bg, color: estadoColor.text }}>{x.estado}</span>
                      </td>
                      <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                        <button onClick={() => editATS(x)} style={{ padding: '4px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Editar</button>
                        <button onClick={() => handleDeleteATS(x.id)} style={{ padding: '4px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
                {atsList.length === 0 && <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: '#9ca3af' }}>No hay ATS registrados</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}