import { useEffect, useMemo, useState } from 'react';

import { api } from '@/lib/api';

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

const CATEGORIES: { value: HazardCategory; label: string; icon: string }[] = [
  { value: 'alturas', label: 'Alturas', icon: '🏗️' },
  { value: 'electrico', label: 'Eléctrico', icon: '⚡' },
  { value: 'herramientas', label: 'Herramientas', icon: '🔧' },
  { value: 'escaleras', label: 'Escaleras', icon: '🪜' },
  { value: 'ergonomia', label: 'Ergonomía', icon: '🧍' },
  { value: 'conduccion', label: 'Conducción', icon: '🚐' },
  { value: 'cielos_rasos', label: 'Cielos rasos', icon: '🏠' },
  { value: 'confinados', label: 'Confinados', icon: '🕳️' },
  { value: 'locativo', label: 'Locativo', icon: '🏢' },
  { value: 'otro', label: 'Otro', icon: '📋' },
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
      <span
        style={{
          background: rl.color,
          color: '#fff',
          padding: '2px 8px',
          borderRadius: 12,
          fontSize: 11,
          fontWeight: 'bold',
        }}
      >
        {rl.label}
      </span>
    ) : (
      risk
    );
  };

  return (
    <div
      style={{ padding: 20, maxWidth: 1100, fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, color: '#0f766e', fontSize: 24 }}>
          Matriz de Peligros, Riesgos y Controles (GTC 45)
        </h1>
        <p style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>
          Catálogo precargado del oficio instalación electrónica (CCTV, alarmas, control acceso,
          cableado estructurado). Normativa: Decreto 1072/2015, Res. 4272/2021 (alturas), RETIE
          (eléctrico), GTC 45 (metodología).
        </p>
      </header>

      <section style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>Filtrar catálogo:</span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => handleCategoryChange(cat.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                border: activeCategory === cat.value ? 'none' : '1px solid #d1d5db',
                background: activeCategory === cat.value ? '#0f766e' : '#fff',
                color: activeCategory === cat.value ? '#fff' : '#374151',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.15s',
                boxShadow: activeCategory === cat.value ? '0 2px 4px rgba(15,118,110,0.3)' : 'none',
              }}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
          <button
            onClick={() => handleCategoryChange('todas')}
            style={{
              padding: '6px 12px',
              borderRadius: 20,
              border: activeCategory === 'todas' ? 'none' : '1px solid #d1d5db',
              background: activeCategory === 'todas' ? '#0f766e' : '#fff',
              color: activeCategory === 'todas' ? '#fff' : '#374151',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            📦 Todas ({catalog.length})
          </button>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        style={{
          background: '#fff',
          padding: 16,
          borderRadius: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          marginBottom: 20,
        }}
      >
        <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f3f4f6' }}>
          <label
            htmlFor="hazards-modo-catalogo"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              fontSize: 13,
              color: '#374151',
            }}
          >
            <input
              id="hazards-modo-catalogo"
              type="radio"
              name="modo"
              checked={form.modo === 'catalogo'}
              onChange={() => {}}
              style={{ accentColor: '#0f766e' }}
            />
            <strong>📋 Seleccionar del catálogo</strong> ({filteredCatalog.length} ítems en esta
            categoría)
          </label>
          <label
            htmlFor="hazards-modo-personalizado"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: '#374151',
              marginLeft: 24,
            }}
          >
            <input
              id="hazards-modo-personalizado"
              type="radio"
              name="modo"
              checked={form.modo === 'personalizado'}
              onChange={handleCustomMode}
              style={{ accentColor: '#0f766e' }}
            />
            <strong>✏️ Peligro personalizado</strong>
          </label>
        </div>

        {form.modo === 'catalogo' && filteredCatalog.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label
              htmlFor="hazards-catalogo-select"
              style={{
                display: 'block',
                fontSize: 12,
                color: '#6b7280',
                marginBottom: 4,
                fontWeight: 500,
              }}
            >
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
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 13,
                background: '#fafafa',
                cursor: 'pointer',
              }}
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          <div>
            <label
              htmlFor="hazards-cargo"
              style={{
                display: 'block',
                fontSize: 12,
                color: '#6b7280',
                marginBottom: 4,
                fontWeight: 500,
              }}
            >
              Cargo / Oficio *
            </label>
            <input
              id="hazards-cargo"
              value={form.cargo_oficio}
              onChange={(e) => handleInputChange('cargo_oficio', e.target.value)}
              placeholder="Ej: Técnico Instalador CCTV"
              required
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 13,
              }}
            />
          </div>

          <div>
            <label
              htmlFor="hazards-area"
              style={{
                display: 'block',
                fontSize: 12,
                color: '#6b7280',
                marginBottom: 4,
                fontWeight: 500,
              }}
            >
              Área / Ubicación
            </label>
            <input
              id="hazards-area"
              value={form.area}
              onChange={(e) => handleInputChange('area', e.target.value)}
              placeholder="Ej: Fachada, Sala de servidores, Poste"
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 13,
              }}
            />
          </div>

          <div>
            <label
              htmlFor="hazards-peligro"
              style={{
                display: 'block',
                fontSize: 12,
                color: '#6b7280',
                marginBottom: 4,
                fontWeight: 500,
              }}
            >
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
              required
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 13,
                background: form.modo === 'catalogo' && form.peligro_id ? '#f0fdf4' : '#fff',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="hazards-tarea"
              style={{
                display: 'block',
                fontSize: 12,
                color: '#6b7280',
                marginBottom: 4,
                fontWeight: 500,
              }}
            >
              Tarea / Actividad
            </label>
            <input
              id="hazards-tarea"
              value={form.tarea}
              onChange={(e) => handleInputChange('tarea', e.target.value)}
              placeholder="Ej: Instalación cámara en fachada 3er piso"
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 13,
              }}
            />
          </div>

          <div>
            <label
              htmlFor="hazards-consecuencia"
              style={{
                display: 'block',
                fontSize: 12,
                color: '#6b7280',
                marginBottom: 4,
                fontWeight: 500,
              }}
            >
              Consecuencia
            </label>
            <input
              id="hazards-consecuencia"
              value={form.consecuencia}
              onChange={(e) => handleInputChange('consecuencia', e.target.value)}
              placeholder="Ej: Caída a diferente nivel, electrocución, corte"
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 13,
              }}
            />
          </div>

          <div>
            <label
              htmlFor="hazards-probabilidad"
              style={{
                display: 'block',
                fontSize: 12,
                color: '#6b7280',
                marginBottom: 4,
                fontWeight: 500,
              }}
            >
              Probabilidad
            </label>
            <input
              id="hazards-probabilidad"
              value={form.probabilidad}
              onChange={(e) => handleInputChange('probabilidad', e.target.value)}
              placeholder="Ej: Frecuente, Ocasional, Remota"
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 13,
              }}
            />
          </div>

          <div>
            <label
              htmlFor="hazards-valoracion"
              style={{
                display: 'block',
                fontSize: 12,
                color: '#6b7280',
                marginBottom: 4,
                fontWeight: 500,
              }}
            >
              Valoración de Riesgo *
            </label>
            <select
              id="hazards-valoracion"
              value={form.valoracion_riesgo}
              onChange={(e) => handleInputChange('valoracion_riesgo', e.target.value as RiskLevel)}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              {RISK_LEVELS.map((r) => (
                <option
                  key={r.value}
                  value={r.value}
                  style={{ background: r.color, color: '#fff' }}
                >
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="hazards-responsable"
              style={{
                display: 'block',
                fontSize: 12,
                color: '#6b7280',
                marginBottom: 4,
                fontWeight: 500,
              }}
            >
              Responsable
            </label>
            <input
              id="hazards-responsable"
              value={form.responsable}
              onChange={(e) => handleInputChange('responsable', e.target.value)}
              placeholder="Ej: Juan Pérez / Jefe de obra"
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 13,
              }}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label
              htmlFor="hazards-controles"
              style={{
                display: 'block',
                fontSize: 12,
                color: '#6b7280',
                marginBottom: 4,
                fontWeight: 500,
              }}
            >
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
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 12,
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 20px',
              background: loading ? '#94a3b8' : '#0f766e',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 13,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Guardando...' : '💾 Guardar evaluación'}
          </button>
        </div>
      </form>

      <section>
        <h2 style={{ color: '#0f766e', fontSize: 16, marginBottom: 12 }}>
          Matriz de evaluaciones registradas
        </h2>
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
                <th style={{ padding: 10, fontSize: 11, color: '#374151' }}>Fecha</th>
                <th style={{ padding: 10, fontSize: 11, color: '#374151' }}>Cargo / Oficio</th>
                <th style={{ padding: 10, fontSize: 11, color: '#374151' }}>Área</th>
                <th style={{ padding: 10, fontSize: 11, color: '#374151' }}>Peligro</th>
                <th style={{ padding: 10, fontSize: 11, color: '#374151' }}>Tarea</th>
                <th style={{ padding: 10, fontSize: 11, color: '#374151' }}>Consecuencia</th>
                <th style={{ padding: 10, fontSize: 11, color: '#374151' }}>Prob.</th>
                <th style={{ padding: 10, fontSize: 11, color: '#374151' }}>Riesgo</th>
                <th style={{ padding: 10, fontSize: 11, color: '#374151' }}>Responsable</th>
                <th style={{ padding: 10, fontSize: 11, color: '#374151' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {assessments.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
                    No hay evaluaciones registradas. Use el formulario arriba para crear la primera.
                  </td>
                </tr>
              ) : (
                assessments.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 10, fontSize: 11 }}>{a.fecha}</td>
                    <td style={{ padding: 10, fontSize: 11 }}>{a.cargo_oficio}</td>
                    <td style={{ padding: 10, fontSize: 11 }}>{a.area || '-'}</td>
                    <td style={{ padding: 10, fontSize: 11 }}>{a.peligro_texto}</td>
                    <td style={{ padding: 10, fontSize: 11 }}>{a.tarea || '-'}</td>
                    <td style={{ padding: 10, fontSize: 11 }}>{a.consecuencia || '-'}</td>
                    <td style={{ padding: 10, fontSize: 11 }}>{a.probabilidad || '-'}</td>
                    <td style={{ padding: 10 }}>{getRiskBadge(a.valoracion_riesgo)}</td>
                    <td style={{ padding: 10, fontSize: 11 }}>{a.responsable || '-'}</td>
                    <td style={{ padding: 10 }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 10,
                          fontWeight: 500,
                          background:
                            a.estado === 'vigente'
                              ? '#dcfce7'
                              : a.estado === 'revisado'
                                ? '#e0e7ff'
                                : '#fee2e2',
                          color:
                            a.estado === 'vigente'
                              ? '#166534'
                              : a.estado === 'revisado'
                                ? '#3730a3'
                                : '#991b1b',
                        }}
                      >
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
