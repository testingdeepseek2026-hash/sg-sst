import { useCallback, useEffect, useState } from 'react';

import { Camera, ClipboardCheck, FileText, PenLine } from 'lucide-react';

import { SignaturePad } from '@/components/SignaturePad';
import { api } from '@/lib/api';

const ESTADO_PERMIT_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  autorizado: 'Autorizado',
  rechazado: 'Rechazado',
  cerrado: 'Cerrado',
};

const ESTADO_ATS_LABELS: Record<string, string> = {
  vigente: 'Vigente',
  cerrado: 'Cerrado',
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

const buildPermitForm = (p: AlturaPermit): PermitForm => {
  let fotos: string[] = [];
  if (p.archivo_fotos) {
    try {
      fotos = JSON.parse(p.archivo_fotos);
    } catch {
      fotos = [];
    }
  }
  return {
    ...initialPermitForm,
    ...p,
    fotos,
    equipo_verificado: !!p.equipo_verificado,
    apto_medico: !!p.apto_medico,
    certificado_alturas: !!p.certificado_alturas,
  };
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
  const [signingField, setSigningField] = useState<'solicitante' | 'responsable' | null>(null);
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
      setMessage({ type: 'error', text: err.message || 'Error cargando los datos' });
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePhotoCapture = async (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newPhotos: string[] = [];
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        const base64 = await handlePhotoCapture(file);
        newPhotos.push(base64);
      }
    }
    setPermitForm((prev) => ({ ...prev, fotos: [...prev.fotos, ...newPhotos] }));
  };

  const removePhoto = (index: number) => {
    setPermitForm((prev) => ({ ...prev, fotos: prev.fotos.filter((_, i) => i !== index) }));
  };

  const openPermit = (p: AlturaPermit) => {
    setViewingPermit(p);
    setPermitForm(buildPermitForm(p));
  };

  const editPermit = (p: AlturaPermit) => {
    setEditingPermit(p);
    setActiveTab('permisos');
    setPermitForm(buildPermitForm(p));
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

  const handleSavePermitSignature = async (dataUrl: string) => {
    if (!signingField) return;
    const field =
      signingField === 'solicitante' ? 'firma_solicitante_url' : 'firma_responsable_url';
    try {
      if (editingPermit) {
        await api.put(`/altura/permits/${editingPermit.id}`, { [field]: dataUrl });
        setMessage({ type: 'success', text: 'Firma guardada' });
        loadData();
      } else {
        // El permiso aún no existe: conservar la firma en el formulario hasta guardarlo.
        setPermitForm((prev) => ({ ...prev, [field]: dataUrl }));
        setMessage({
          type: 'success',
          text: 'Firma capturada; guarde el permiso para conservarla',
        });
      }
      setSigningField(null);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error guardando firma' });
    }
  };

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

  const kpis = [
    { label: 'Permisos registrados', value: permits.length },
    {
      label: 'Pendientes de autorización',
      value: permits.filter((p) => p.estado === 'pendiente').length,
    },
    { label: 'ATS vigentes', value: atsList.filter((a) => a.estado === 'vigente').length },
    { label: 'ATS registrados', value: atsList.length },
  ];

  const controles = (p: AlturaPermit) =>
    [p.equipo_verificado, p.apto_medico, p.certificado_alturas].filter(Boolean).length;

  const fotosDe = (p: AlturaPermit): string[] => {
    if (!p.archivo_fotos) return [];
    try {
      return JSON.parse(p.archivo_fotos) as string[];
    } catch {
      return [];
    }
  };

  const renderControles = (p: AlturaPermit) => (
    <div className="altura-controles">
      <span
        className={p.equipo_verificado ? 'altura-control altura-control--ok' : 'altura-control'}
      >
        Equipos inspeccionados
      </span>
      <span className={p.apto_medico ? 'altura-control altura-control--ok' : 'altura-control'}>
        Apto médico
      </span>
      <span
        className={p.certificado_alturas ? 'altura-control altura-control--ok' : 'altura-control'}
      >
        Certificación vigente
      </span>
    </div>
  );

  const renderAccionesPermiso = (p: AlturaPermit) => (
    <div className="ui-row-actions">
      <button type="button" className="ui-icon-button" onClick={() => openPermit(p)}>
        Ver
      </button>
      <button
        type="button"
        className="ui-icon-button ui-icon-button--edit"
        onClick={() => editPermit(p)}
      >
        Editar
      </button>
      <button
        type="button"
        className="ui-icon-button ui-icon-button--delete"
        onClick={() => handleDeletePermit(p.id)}
      >
        Eliminar
      </button>
    </div>
  );

  const renderAccionesATS = (a: ATS) => (
    <div className="ui-row-actions">
      <button
        type="button"
        className="ui-icon-button ui-icon-button--edit"
        onClick={() => editATS(a)}
      >
        Editar
      </button>
      <button
        type="button"
        className="ui-icon-button ui-icon-button--delete"
        onClick={() => handleDeleteATS(a.id)}
      >
        Eliminar
      </button>
    </div>
  );

  return (
    <div className="ui-page altura-page">
      <header className="ui-page-header altura-page-header">
        <div>
          <h1 className="ui-page-title">Trabajo en Alturas: Permiso y ATS</h1>
          <p className="ui-page-description">
            Permisos de trabajo y análisis de trabajo seguro conforme a la Resolución 4272/2021.
          </p>
        </div>
        <button
          className="ui-primary-button"
          onClick={() => {
            newPermit();
            setActiveTab('permisos');
          }}
          type="button"
        >
          <ClipboardCheck aria-hidden="true" size={18} />
          Nuevo permiso
        </button>
      </header>

      {message && (
        <div
          className={`ui-feedback ui-feedback--${message.type}`}
          role={message.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {message.text}
        </div>
      )}

      <div
        aria-label="Secciones de trabajo en alturas"
        className="ui-tabs altura-tabs"
        role="tablist"
      >
        {[
          { id: 'permisos' as const, label: 'Permisos de trabajo', icon: ClipboardCheck },
          { id: 'ats' as const, label: 'ATS - Análisis de trabajo seguro', icon: FileText },
        ].map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            aria-controls={activeTab === tab.id ? `altura-panel-${tab.id}` : undefined}
            className="ui-tab"
            id={`altura-tab-${tab.id}`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            <tab.icon aria-hidden="true" size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <section aria-label="Resumen de trabajo en alturas" className="ui-kpi-grid">
        {kpis.map((k) => (
          <div className="ui-kpi" key={k.label}>
            <span className="ui-kpi-label">{k.label}</span>
            <span className="ui-kpi-value">{k.value}</span>
          </div>
        ))}
      </section>

      {activeTab === 'permisos' && (
        <section
          aria-labelledby="altura-tab-permisos"
          className="altura-tab-panel"
          id="altura-panel-permisos"
          role="tabpanel"
          tabIndex={0}
        >
          <section aria-labelledby="altura-permit-form-title" className="ui-surface altura-form">
            <h2 id="altura-permit-form-title" className="altura-form-title">
              {editingPermit
                ? 'Editar permiso'
                : viewingPermit
                  ? 'Ver permiso'
                  : 'Nuevo permiso de trabajo en alturas'}
            </h2>
            <form onSubmit={handlePermitSubmit}>
              <div className="ui-form-grid">
                <div>
                  <label className="ui-field-label" htmlFor="permit-obra">
                    Obra / instalación *
                  </label>
                  <input
                    id="permit-obra"
                    value={permitForm.obra}
                    onChange={(e) => setPermitForm({ ...permitForm, obra: e.target.value })}
                    placeholder="Ej: Instalación CCTV Edificio Norte"
                    required
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="permit-fecha">
                    Fecha *
                  </label>
                  <input
                    id="permit-fecha"
                    type="date"
                    value={permitForm.fecha}
                    onChange={(e) => setPermitForm({ ...permitForm, fecha: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="permit-hora-inicio">
                    Hora inicio
                  </label>
                  <input
                    id="permit-hora-inicio"
                    type="time"
                    value={permitForm.hora_inicio}
                    onChange={(e) => setPermitForm({ ...permitForm, hora_inicio: e.target.value })}
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="permit-hora-fin">
                    Hora fin
                  </label>
                  <input
                    id="permit-hora-fin"
                    type="time"
                    value={permitForm.hora_fin}
                    onChange={(e) => setPermitForm({ ...permitForm, hora_fin: e.target.value })}
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="permit-solicitante">
                    Solicitante
                  </label>
                  <input
                    id="permit-solicitante"
                    value={permitForm.solicitante}
                    onChange={(e) => setPermitForm({ ...permitForm, solicitante: e.target.value })}
                    placeholder="Quién solicita el permiso"
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="permit-resp-seg">
                    Responsable de seguridad
                  </label>
                  <input
                    id="permit-resp-seg"
                    value={permitForm.responsable_seguridad}
                    onChange={(e) =>
                      setPermitForm({ ...permitForm, responsable_seguridad: e.target.value })
                    }
                    placeholder="Vigía / responsable SST"
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="permit-sistema">
                    Sistema de protección
                  </label>
                  <input
                    id="permit-sistema"
                    value={permitForm.sistema_proteccion}
                    onChange={(e) =>
                      setPermitForm({ ...permitForm, sistema_proteccion: e.target.value })
                    }
                    placeholder="Ej: línea de vida horizontal + arnés doble"
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="permit-estado">
                    Estado del permiso
                  </label>
                  <select
                    id="permit-estado"
                    value={permitForm.estado}
                    onChange={(e) => setPermitForm({ ...permitForm, estado: e.target.value })}
                  >
                    {Object.entries(ESTADO_PERMIT_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="altura-controles-box">
                <strong className="altura-controles-title">
                  Controles obligatorios (Res. 4272/2021 Art. 12-14)
                </strong>
                <div className="altura-controles-form">
                  <label className="altura-check" htmlFor="permit-equipo">
                    <input
                      id="permit-equipo"
                      type="checkbox"
                      checked={permitForm.equipo_verificado}
                      onChange={(e) =>
                        setPermitForm({ ...permitForm, equipo_verificado: e.target.checked })
                      }
                    />
                    Equipos inspeccionados (arnés, línea de vida, anclajes)
                  </label>
                  <label className="altura-check" htmlFor="permit-apto">
                    <input
                      id="permit-apto"
                      type="checkbox"
                      checked={permitForm.apto_medico}
                      onChange={(e) =>
                        setPermitForm({ ...permitForm, apto_medico: e.target.checked })
                      }
                    />
                    Apto médico vigente (altura mayor a 2 m)
                  </label>
                  <label className="altura-check" htmlFor="permit-cert">
                    <input
                      id="permit-cert"
                      type="checkbox"
                      checked={permitForm.certificado_alturas}
                      onChange={(e) =>
                        setPermitForm({ ...permitForm, certificado_alturas: e.target.checked })
                      }
                    />
                    Certificación trabajo en alturas vigente (3 años)
                  </label>
                </div>
              </div>

              <div className="altura-field-full">
                <span className="ui-field-label">
                  Evidencia fotográfica (condiciones, equipos, anclajes)
                </span>
                <input
                  id="permit-photo-input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="altura-sr-only"
                />
                <button
                  type="button"
                  className="altura-photo-button"
                  onClick={() => document.getElementById('permit-photo-input')?.click()}
                >
                  <Camera aria-hidden="true" size={16} />
                  Agregar fotos
                </button>
                {permitForm.fotos.length > 0 && (
                  <div className="altura-photos">
                    {permitForm.fotos.map((photo, idx) => (
                      <div className="altura-photo" key={idx}>
                        <img src={photo} alt={`Foto ${idx + 1}`} />
                        <button
                          type="button"
                          className="altura-photo-remove"
                          onClick={() => removePhoto(idx)}
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="altura-signatures">
                <div>
                  <span className="ui-field-label">Firma solicitante</span>
                  {permitForm.firma_solicitante_url ? (
                    <div className="altura-signature">
                      <img src={permitForm.firma_solicitante_url} alt="Firma solicitante" />
                      <button
                        type="button"
                        className="ui-action-button"
                        onClick={() => setPermitForm({ ...permitForm, firma_solicitante_url: '' })}
                      >
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="altura-sign-button"
                      onClick={() => setSigningField('solicitante')}
                    >
                      <PenLine aria-hidden="true" size={16} />
                      Firmar en pantalla
                    </button>
                  )}
                </div>
                <div>
                  <span className="ui-field-label">Firma responsable de seguridad / vigía</span>
                  {permitForm.firma_responsable_url ? (
                    <div className="altura-signature">
                      <img src={permitForm.firma_responsable_url} alt="Firma responsable" />
                      <button
                        type="button"
                        className="ui-action-button"
                        onClick={() => setPermitForm({ ...permitForm, firma_responsable_url: '' })}
                      >
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="altura-sign-button"
                      onClick={() => setSigningField('responsable')}
                    >
                      <PenLine aria-hidden="true" size={16} />
                      Firmar en pantalla
                    </button>
                  )}
                </div>
              </div>

              <div className="ui-form-actions">
                <button type="button" className="ui-action-button" onClick={newPermit}>
                  Cancelar
                </button>
                <button type="submit" className="ui-primary-button" disabled={loading}>
                  {loading ? 'Guardando...' : editingPermit ? 'Actualizar' : 'Registrar permiso'}
                </button>
              </div>
            </form>
          </section>

          <section aria-label="Permisos registrados">
            <div className="ui-surface ui-table-wrap">
              <table className="ui-table altura-table">
                <thead>
                  <tr>
                    <th scope="col">Obra</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Horario</th>
                    <th scope="col">Solicitante</th>
                    <th scope="col">Resp. seguridad</th>
                    <th scope="col">Controles</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Fotos</th>
                    <th scope="col">Firmas</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {permits.map((x) => (
                    <tr key={x.id}>
                      <td>{x.obra}</td>
                      <td>{x.fecha}</td>
                      <td>
                        {x.hora_inicio || '—'} - {x.hora_fin || '—'}
                      </td>
                      <td>{x.solicitante || '—'}</td>
                      <td>{x.responsable_seguridad || '—'}</td>
                      <td>
                        {controles(x)}/3 {controles(x) === 3 ? 'Completo' : 'Por completar'}
                      </td>
                      <td>
                        <span className="ui-badge">
                          {ESTADO_PERMIT_LABELS[x.estado] ?? x.estado}
                        </span>
                      </td>
                      <td>{fotosDe(x).length || '—'}</td>
                      <td>
                        {x.firma_solicitante_url && x.firma_responsable_url
                          ? 'Solicitante y responsable'
                          : x.firma_solicitante_url || x.firma_responsable_url
                            ? 'Una firma'
                            : '—'}
                      </td>
                      <td>{renderAccionesPermiso(x)}</td>
                    </tr>
                  ))}
                  {permits.length === 0 && (
                    <tr>
                      <td colSpan={10} className="ui-empty">
                        No hay permisos registrados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="ui-mobile-list">
              {permits.length === 0 && <p className="ui-empty">No hay permisos registrados</p>}
              {permits.map((x) => (
                <article className="ui-surface ui-mobile-card" key={x.id}>
                  <header className="ui-mobile-card-header">
                    <div>
                      <h2>{x.obra}</h2>
                      <p>
                        {x.fecha} · {x.hora_inicio || '—'} - {x.hora_fin || '—'}
                      </p>
                    </div>
                    <span className="ui-badge">{ESTADO_PERMIT_LABELS[x.estado] ?? x.estado}</span>
                  </header>
                  <dl className="ui-mobile-details">
                    <div>
                      <dt>Solicitante</dt>
                      <dd>{x.solicitante || '—'}</dd>
                    </div>
                    <div>
                      <dt>Resp. seguridad</dt>
                      <dd>{x.responsable_seguridad || '—'}</dd>
                    </div>
                    <div>
                      <dt>Controles</dt>
                      <dd>
                        {controles(x)}/3 {controles(x) === 3 ? 'Completo' : 'Por completar'}
                      </dd>
                    </div>
                    <div>
                      <dt>Fotos / firmas</dt>
                      <dd>
                        {fotosDe(x).length || 0} fotos ·{' '}
                        {x.firma_solicitante_url || x.firma_responsable_url
                          ? 'con firmas'
                          : 'sin firmas'}
                      </dd>
                    </div>
                  </dl>
                  <div className="ui-mobile-actions">{renderAccionesPermiso(x)}</div>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}

      {activeTab === 'ats' && (
        <section
          aria-labelledby="altura-tab-ats"
          className="altura-tab-panel"
          id="altura-panel-ats"
          role="tabpanel"
          tabIndex={0}
        >
          <section aria-labelledby="altura-ats-form-title" className="ui-surface altura-form">
            <h2 id="altura-ats-form-title" className="altura-form-title">
              {editingATS ? 'Editar ATS' : 'Nuevo ATS - Análisis de Trabajo Seguro'}
            </h2>
            <p className="ui-page-description">
              Res. 4272/2021 Art. 15: el ATS es obligatorio para trabajo en alturas. Identifique
              peligros, defina controles y responsable.
            </p>
            <form onSubmit={handleATSSubmit}>
              <div className="ui-form-grid">
                <div>
                  <label className="ui-field-label" htmlFor="ats-obra">
                    Obra / instalación *
                  </label>
                  <input
                    id="ats-obra"
                    value={atsForm.obra}
                    onChange={(e) => setAtsForm({ ...atsForm, obra: e.target.value })}
                    placeholder="Ej: Fachada Edificio Central"
                    required
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="ats-tarea">
                    Tarea *
                  </label>
                  <input
                    id="ats-tarea"
                    value={atsForm.tarea}
                    onChange={(e) => setAtsForm({ ...atsForm, tarea: e.target.value })}
                    placeholder="Ej: Instalación de cámaras CCTV en fachada"
                    required
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="ats-fecha">
                    Fecha *
                  </label>
                  <input
                    id="ats-fecha"
                    type="date"
                    value={atsForm.fecha}
                    onChange={(e) => setAtsForm({ ...atsForm, fecha: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="ats-responsable">
                    Responsable
                  </label>
                  <input
                    id="ats-responsable"
                    value={atsForm.responsable}
                    onChange={(e) => setAtsForm({ ...atsForm, responsable: e.target.value })}
                    placeholder="Quién ejecuta o supervisa"
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="ats-estado">
                    Estado
                  </label>
                  <select
                    id="ats-estado"
                    value={atsForm.estado}
                    onChange={(e) => setAtsForm({ ...atsForm, estado: e.target.value })}
                  >
                    {Object.entries(ESTADO_ATS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="altura-ats-grid">
                <div>
                  <label className="ui-field-label" htmlFor="ats-peligro">
                    Peligros identificados *
                  </label>
                  <textarea
                    id="ats-peligro"
                    value={atsForm.peligro}
                    onChange={(e) => setAtsForm({ ...atsForm, peligro: e.target.value })}
                    placeholder="Caída a distinto nivel&#10;Golpe por caída de objetos&#10;Contacto con líneas eléctricas&#10;Condiciones climáticas adversas"
                    required
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="ats-control">
                    Controles y medidas preventivas *
                  </label>
                  <textarea
                    id="ats-control"
                    value={atsForm.control}
                    onChange={(e) => setAtsForm({ ...atsForm, control: e.target.value })}
                    placeholder="Arnés doble + línea de vida&#10;Casco con barbijo&#10;Zona de exclusión + señalización&#10;Vigía + plan de rescate&#10;Suspender si viento > 40 km/h"
                    required
                  />
                </div>
              </div>
              <div className="ui-form-actions">
                <button type="button" className="ui-action-button" onClick={newATS}>
                  Nuevo
                </button>
                <button type="submit" className="ui-primary-button" disabled={loading}>
                  {loading ? 'Guardando...' : editingATS ? 'Actualizar' : 'Registrar ATS'}
                </button>
              </div>
            </form>
          </section>

          <section aria-label="ATS registrados">
            <div className="ui-surface ui-table-wrap">
              <table className="ui-table altura-table">
                <thead>
                  <tr>
                    <th scope="col">Obra</th>
                    <th scope="col">Tarea</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Responsable</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {atsList.map((x) => (
                    <tr key={x.id}>
                      <td>{x.obra}</td>
                      <td>{x.tarea}</td>
                      <td>{x.fecha}</td>
                      <td>{x.responsable || '—'}</td>
                      <td>
                        <span className="ui-badge">{ESTADO_ATS_LABELS[x.estado] ?? x.estado}</span>
                      </td>
                      <td>{renderAccionesATS(x)}</td>
                    </tr>
                  ))}
                  {atsList.length === 0 && (
                    <tr>
                      <td colSpan={6} className="ui-empty">
                        No hay ATS registrados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="ui-mobile-list">
              {atsList.length === 0 && <p className="ui-empty">No hay ATS registrados</p>}
              {atsList.map((x) => (
                <article className="ui-surface ui-mobile-card" key={x.id}>
                  <header className="ui-mobile-card-header">
                    <div>
                      <h2>{x.tarea}</h2>
                      <p>{x.obra}</p>
                    </div>
                    <span className="ui-badge">{ESTADO_ATS_LABELS[x.estado] ?? x.estado}</span>
                  </header>
                  <dl className="ui-mobile-details">
                    <div>
                      <dt>Fecha</dt>
                      <dd>{x.fecha}</dd>
                    </div>
                    <div>
                      <dt>Responsable</dt>
                      <dd>{x.responsable || '—'}</dd>
                    </div>
                    <div>
                      <dt>Peligros</dt>
                      <dd>{x.peligro || '—'}</dd>
                    </div>
                    <div>
                      <dt>Controles</dt>
                      <dd>{x.control || '—'}</dd>
                    </div>
                  </dl>
                  <div className="ui-mobile-actions">{renderAccionesATS(x)}</div>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}

      {viewingPermit && (
        <div
          className="altura-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setViewingPermit(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setViewingPermit(null);
          }}
          role="presentation"
        >
          <div
            className="altura-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="altura-view-title"
            tabIndex={-1}
          >
            <header className="altura-modal-header">
              <h3 id="altura-view-title">
                Permiso: {viewingPermit.obra} - {viewingPermit.fecha}
              </h3>
              <button
                type="button"
                className="ui-action-button"
                onClick={() => setViewingPermit(null)}
              >
                Cerrar
              </button>
            </header>
            <div className="altura-modal-body">
              <dl className="altura-view-grid">
                <div>
                  <dt>Horario</dt>
                  <dd>
                    {viewingPermit.hora_inicio || '—'} - {viewingPermit.hora_fin || '—'}
                  </dd>
                </div>
                <div>
                  <dt>Solicitante</dt>
                  <dd>{viewingPermit.solicitante || '—'}</dd>
                </div>
                <div>
                  <dt>Resp. seguridad</dt>
                  <dd>{viewingPermit.responsable_seguridad || '—'}</dd>
                </div>
                <div>
                  <dt>Sistema de protección</dt>
                  <dd>{viewingPermit.sistema_proteccion || '—'}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>
                    <span className="ui-badge">
                      {ESTADO_PERMIT_LABELS[viewingPermit.estado] ?? viewingPermit.estado}
                    </span>
                  </dd>
                </div>
              </dl>
              <div className="altura-controles-box">
                <strong className="altura-controles-title">Controles Res. 4272/2021</strong>
                {renderControles(viewingPermit)}
              </div>
              {fotosDe(viewingPermit).length > 0 && (
                <div>
                  <strong className="altura-controles-title">
                    Fotos ({fotosDe(viewingPermit).length})
                  </strong>
                  <div className="altura-photos">
                    {fotosDe(viewingPermit).map((photo, idx) => (
                      <img
                        className="altura-photo-img"
                        key={idx}
                        src={photo}
                        alt={`Foto ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="altura-signatures-view">
                <div>
                  <strong>Firma solicitante</strong>
                  {viewingPermit.firma_solicitante_url ? (
                    <img
                      className="altura-signature-img"
                      src={viewingPermit.firma_solicitante_url}
                      alt="Firma solicitante"
                    />
                  ) : (
                    <span className="altura-missing">No firmado</span>
                  )}
                </div>
                <div>
                  <strong>Firma responsable seguridad</strong>
                  {viewingPermit.firma_responsable_url ? (
                    <img
                      className="altura-signature-img"
                      src={viewingPermit.firma_responsable_url}
                      alt="Firma responsable"
                    />
                  ) : (
                    <span className="altura-missing">No firmado</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {signingField && (
        <div
          className="altura-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSigningField(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setSigningField(null);
          }}
          role="presentation"
        >
          <div
            className="altura-modal altura-modal--sign"
            role="dialog"
            aria-modal="true"
            aria-labelledby="altura-sign-title"
            tabIndex={-1}
          >
            <div className="altura-modal-body">
              <h3 id="altura-sign-title">
                Firma digital -{' '}
                {signingField === 'solicitante' ? 'Solicitante' : 'Responsable de seguridad'}
              </h3>
              <SignaturePad
                onSave={handleSavePermitSignature}
                onCancel={() => setSigningField(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
