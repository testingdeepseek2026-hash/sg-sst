import { useEffect, useMemo, useState } from 'react';

import {
  ArrowUpNarrowWide,
  Boxes,
  Building2,
  Construction,
  DoorClosed,
  House,
  ListFilter,
  NotebookPen,
  PersonStanding,
  Save,
  Truck,
  Wrench,
  Zap,
} from 'lucide-react';

import { api } from '@/lib/api';

import type { LucideIcon } from 'lucide-react';

type HazardCategory =
  | 'alturas'
  | 'electrico'
  | 'herramientas'
  | 'escaleras'
  | 'ergonomia'
  | 'conduccion'
  | 'cielos_rasos'
  | 'confinados'
  | 'locativo'
  | 'otro';
type RiskLevel = 'bajo' | 'medio' | 'alto' | 'critico';

interface HazardCatalogItem {
  id: string;
  codigo: string;
  nombre: string;
  categoria: HazardCategory;
  descripcion: string | null;
  riesgo_por_defecto: RiskLevel;
  control_sugerido: string | null;
  activo: number;
}

interface HazardAssessment {
  id: string;
  cargo_oficio: string;
  area: string | null;
  peligro_id: string | null;
  peligro_texto: string | null;
  tarea: string | null;
  consecuencia: string | null;
  probabilidad: string | null;
  valoracion_riesgo: RiskLevel;
  controles: string | null;
  responsable: string | null;
  fecha: string;
  revisado_en: string | null;
  estado: 'vigente' | 'revisado' | 'obsoleto';
}

interface FormState {
  cargo_oficio: string;
  area: string;
  peligro_id: string | null;
  peligro_texto: string;
  tarea: string;
  consecuencia: string;
  probabilidad: string;
  valoracion_riesgo: RiskLevel;
  controles: string;
  responsable: string;
  modo: 'catalogo' | 'personalizado';
}

const CATEGORIES: { value: HazardCategory; label: string; icon: LucideIcon }[] = [
  { value: 'alturas', label: 'Alturas', icon: Construction },
  { value: 'electrico', label: 'Eléctrico', icon: Zap },
  { value: 'herramientas', label: 'Herramientas', icon: Wrench },
  { value: 'escaleras', label: 'Escaleras', icon: ArrowUpNarrowWide },
  { value: 'ergonomia', label: 'Ergonomía', icon: PersonStanding },
  { value: 'conduccion', label: 'Conducción', icon: Truck },
  { value: 'cielos_rasos', label: 'Cielos rasos', icon: House },
  { value: 'confinados', label: 'Confinados', icon: DoorClosed },
  { value: 'locativo', label: 'Locativo', icon: Building2 },
  { value: 'otro', label: 'Otro', icon: NotebookPen },
];

const RISK_LEVELS: { value: RiskLevel; label: string; color: string }[] = [
  { value: 'bajo', label: 'Bajo', color: '#16a34a' },
  { value: 'medio', label: 'Medio', color: '#f59e0b' },
  { value: 'alto', label: 'Alto', color: '#ef4444' },
  { value: 'critico', label: 'Crítico', color: '#991b1b' },
];

const initialForm: FormState = {
  cargo_oficio: '',
  area: '',
  peligro_id: null,
  peligro_texto: '',
  tarea: '',
  consecuencia: '',
  probabilidad: '',
  valoracion_riesgo: 'medio',
  controles: '',
  responsable: '',
  modo: 'catalogo',
};

export default function Hazards() {
  const [catalog, setCatalog] = useState<HazardCatalogItem[]>([]);
  const [assessments, setAssessments] = useState<HazardAssessment[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [activeCategory, setActiveCategory] = useState<HazardCategory | 'todas'>('todas');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCatalog();
    loadAssessments();
  }, []);

  const loadCatalog = async (categoria?: HazardCategory) => {
    try {
      const url = categoria ? `/hazards/catalog?categoria=${categoria}` : '/hazards/catalog';
      const data = await api.get(url);
      setCatalog(data);
    } catch (err: any) {
      console.error('Error cargando catálogo:', err);
      alert('Error al cargar catálogo de peligros');
    }
  };

  const loadAssessments = async () => {
    try {
      const data = await api.get('/hazards/assessments');
      setAssessments(data);
    } catch (err: any) {
      console.error('Error cargando matriz:', err);
    }
  };

  const handleCategoryChange = (categoria: HazardCategory | 'todas') => {
    setActiveCategory(categoria);
    if (categoria === 'todas') {
      loadCatalog();
    } else {
      loadCatalog(categoria);
    }
  };

  const filteredCatalog = useMemo(() => {
    if (activeCategory === 'todas') return catalog;
    return catalog.filter((item) => item.categoria === activeCategory);
  }, [catalog, activeCategory]);

  const handleCatalogSelect = (item: HazardCatalogItem) => {
    setForm((prev) => ({
      ...prev,
      modo: 'catalogo',
      peligro_id: item.id,
      peligro_texto: item.nombre,
      valoracion_riesgo: item.riesgo_por_defecto,
      controles: item.control_sugerido || '',
    }));
  };

  const handleCustomMode = () => {
    setForm((prev) => ({
      ...prev,
      modo: 'personalizado',
      peligro_id: null,
      peligro_texto: '',
      valoracion_riesgo: 'medio',
      controles: '',
    }));
  };

  const handleInputChange = (field: keyof FormState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cargo_oficio.trim() || !form.peligro_texto.trim()) {
      alert('Cargo/oficio y Peligro son obligatorios');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        cargo_oficio: form.cargo_oficio,
        area: form.area || null,
        peligro_id: form.modo === 'catalogo' ? form.peligro_id : null,
        peligro_texto: form.peligro_texto,
        tarea: form.tarea || null,
        consecuencia: form.consecuencia || null,
        probabilidad: form.probabilidad || null,
        valoracion_riesgo: form.valoracion_riesgo,
        controles: form.controles || null,
        responsable: form.responsable || null,
      };
      await api.post('/hazards/assessments', payload);
      setForm(initialForm);
      loadAssessments();
    } catch (err: any) {
      alert(err.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (risk: RiskLevel) => {
    const rl = RISK_LEVELS.find((r) => r.value === risk);
    return rl ? (
      <span className={`hazards-risk-badge hazards-risk-badge--${rl.value}`}>{rl.label}</span>
    ) : (
      risk
    );
  };

  return (
    <div className="hazards-page ui-page">
      <header className="ui-page-header hazards-page-header">
        <div>
          <h1 className="ui-page-title">Matriz de Peligros, Riesgos y Controles (GTC 45)</h1>
          <p className="ui-page-description">
            Catálogo precargado del oficio instalación electrónica (CCTV, alarmas, control acceso,
            cableado estructurado). Normativa: Decreto 1072/2015, Res. 4272/2021 (alturas), RETIE
            (eléctrico), GTC 45 (metodología).
          </p>
        </div>
      </header>

      <section className="hazards-filters" aria-label="Filtrar catálogo">
        <span className="hazards-filters-label">
          <ListFilter aria-hidden="true" size={14} /> Filtrar catálogo:
        </span>
        <div className="hazards-filters-chips">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = activeCategory === cat.value;
            return (
              <button
                key={cat.value}
                type="button"
                className={`hazards-chip${active ? ' hazards-chip--active' : ''}`}
                onClick={() => handleCategoryChange(cat.value)}
              >
                <Icon aria-hidden="true" size={14} /> {cat.label}
              </button>
            );
          })}
          <button
            type="button"
            className={`hazards-chip${activeCategory === 'todas' ? ' hazards-chip--active' : ''}`}
            onClick={() => handleCategoryChange('todas')}
          >
            <Boxes aria-hidden="true" size={14} /> Todas ({catalog.length})
          </button>
        </div>
      </section>

      <form className="hazards-form ui-surface" onSubmit={handleSubmit}>
        <div className="hazards-modo">
          <label className="hazards-modo-option" htmlFor="hazards-modo-catalogo">
            <input
              id="hazards-modo-catalogo"
              type="radio"
              name="modo"
              checked={form.modo === 'catalogo'}
              onChange={() => {}}
            />
            <strong>Seleccionar del catálogo</strong> ({filteredCatalog.length} ítems en esta
            categoría)
          </label>
          <label
            className="hazards-modo-option hazards-modo-option--custom"
            htmlFor="hazards-modo-personalizado"
          >
            <input
              id="hazards-modo-personalizado"
              type="radio"
              name="modo"
              checked={form.modo === 'personalizado'}
              onChange={handleCustomMode}
            />
            <strong>Peligro personalizado</strong>
          </label>
        </div>

        {form.modo === 'catalogo' && filteredCatalog.length > 0 && (
          <div className="hazards-field hazards-field--full">
            <label className="ui-field-label" htmlFor="hazards-catalogo-select">
              Peligro del catálogo (autollenará campos sugeridos)
            </label>
            <select
              id="hazards-catalogo-select"
              value={form.peligro_id || ''}
              onChange={(e) => {
                const id = e.target.value;
                if (!id) {
                  handleCustomMode();
                  return;
                }
                const item = filteredCatalog.find((i) => i.id === id);
                if (item) handleCatalogSelect(item);
              }}
              className="hazards-catalogo-select"
            >
              <option value="">— Buscar y seleccionar un peligro —</option>
              {filteredCatalog.map((item) => (
                <option key={item.id} value={item.id}>
                  [{item.codigo}] {item.nombre} — {item.riesgo_por_defecto.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="hazards-field-grid">
          <div className="hazards-field">
            <label className="ui-field-label" htmlFor="hazards-cargo">
              Cargo / Oficio *
            </label>
            <input
              id="hazards-cargo"
              value={form.cargo_oficio}
              onChange={(e) => handleInputChange('cargo_oficio', e.target.value)}
              placeholder="Ej: Técnico Instalador CCTV"
              required
            />
          </div>

          <div className="hazards-field">
            <label className="ui-field-label" htmlFor="hazards-area">
              Área / Ubicación
            </label>
            <input
              id="hazards-area"
              value={form.area}
              onChange={(e) => handleInputChange('area', e.target.value)}
              placeholder="Ej: Fachada, Sala de servidores, Poste"
            />
          </div>

          <div className="hazards-field">
            <label className="ui-field-label" htmlFor="hazards-peligro">
              Peligro *
            </label>
            <input
              id="hazards-peligro"
              value={form.peligro_texto}
              onChange={(e) => handleInputChange('peligro_texto', e.target.value)}
              placeholder={
                form.modo === 'catalogo'
                  ? 'Se autollenará al seleccionar del catálogo'
                  : 'Describa el peligro'
              }
              className={
                form.modo === 'catalogo' && form.peligro_id
                  ? 'hazards-peligro-input--catalogo'
                  : undefined
              }
              required
            />
          </div>

          <div className="hazards-field">
            <label className="ui-field-label" htmlFor="hazards-tarea">
              Tarea / Actividad
            </label>
            <input
              id="hazards-tarea"
              value={form.tarea}
              onChange={(e) => handleInputChange('tarea', e.target.value)}
              placeholder="Ej: Instalación cámara en fachada 3er piso"
            />
          </div>

          <div className="hazards-field">
            <label className="ui-field-label" htmlFor="hazards-consecuencia">
              Consecuencia
            </label>
            <input
              id="hazards-consecuencia"
              value={form.consecuencia}
              onChange={(e) => handleInputChange('consecuencia', e.target.value)}
              placeholder="Ej: Caída a diferente nivel, electrocución, corte"
            />
          </div>

          <div className="hazards-field">
            <label className="ui-field-label" htmlFor="hazards-probabilidad">
              Probabilidad
            </label>
            <input
              id="hazards-probabilidad"
              value={form.probabilidad}
              onChange={(e) => handleInputChange('probabilidad', e.target.value)}
              placeholder="Ej: Frecuente, Ocasional, Remota"
            />
          </div>

          <div className="hazards-field">
            <label className="ui-field-label" htmlFor="hazards-valoracion">
              Valoración de Riesgo *
            </label>
            <select
              id="hazards-valoracion"
              value={form.valoracion_riesgo}
              onChange={(e) => handleInputChange('valoracion_riesgo', e.target.value as RiskLevel)}
            >
              {RISK_LEVELS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="hazards-field">
            <label className="ui-field-label" htmlFor="hazards-responsable">
              Responsable
            </label>
            <input
              id="hazards-responsable"
              value={form.responsable}
              onChange={(e) => handleInputChange('responsable', e.target.value)}
              placeholder="Ej: Juan Pérez / Jefe de obra"
            />
          </div>

          <div className="hazards-field hazards-field--full">
            <label className="ui-field-label" htmlFor="hazards-controles">
              Controles sugeridos / implementados
            </label>
            <textarea
              id="hazards-controles"
              value={form.controles}
              onChange={(e) => handleInputChange('controles', e.target.value)}
              rows={3}
              placeholder={
                form.modo === 'catalogo' && form.controles
                  ? 'Control sugerido del catálogo (editable)'
                  : 'Ej: Arnés certificado + línea de vida + anclaje + plan rescate + capacitación 4272/2021'
              }
            />
          </div>
        </div>

        <div className="hazards-form-actions">
          <button className="ui-primary-button" type="submit" disabled={loading}>
            <Save aria-hidden="true" size={16} />
            {loading ? 'Guardando...' : 'Guardar evaluación'}
          </button>
        </div>
      </form>

      <section>
        <h2 className="hazards-matriz-title">Matriz de evaluaciones registradas</h2>
        <div className="hazards-table-wrap ui-surface">
          <table className="ui-table hazards-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cargo / Oficio</th>
                <th>Área</th>
                <th>Peligro</th>
                <th>Tarea</th>
                <th>Consecuencia</th>
                <th>Prob.</th>
                <th>Riesgo</th>
                <th>Responsable</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {assessments.length === 0 ? (
                <tr>
                  <td className="hazards-empty" colSpan={10}>
                    No hay evaluaciones registradas. Use el formulario arriba para crear la primera.
                  </td>
                </tr>
              ) : (
                assessments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.fecha}</td>
                    <td>{a.cargo_oficio}</td>
                    <td>{a.area || '-'}</td>
                    <td>{a.peligro_texto}</td>
                    <td>{a.tarea || '-'}</td>
                    <td>{a.consecuencia || '-'}</td>
                    <td>{a.probabilidad || '-'}</td>
                    <td>{getRiskBadge(a.valoracion_riesgo)}</td>
                    <td>{a.responsable || '-'}</td>
                    <td>
                      <span className={`hazards-estado-badge hazards-estado-badge--${a.estado}`}>
                        {a.estado}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
