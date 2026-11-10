import { useEffect, useState } from 'react';

import { api } from '@/lib/api';

interface Empresa {
  id: string;
  razon_social: string;
  nit: string;
  direccion: string;
  telefono: string;
  email: string;
  clase_riesgo: string;
  actividad_economica: string;
  numero_trabajadores: number;
  tiene_vigia_sst: boolean;
  tiene_comite_convivencia: boolean;
  tiene_brigada: boolean;
  canal_alertas: string;
  estandar_set: string;
}

const CANAL_LABELS: Record<string, string> = {
  email: 'Correo electrónico',
  whatsapp: 'Correo + WhatsApp',
  app: 'Solo en la app',
};

export default function Empresa() {
  const [c, setC] = useState<Empresa | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadCompany = () => {
    api
      .get('/companies')
      .then((data) => setC(data as Empresa))
      .catch(() => setC(null))
      .finally(() => setLoading(false));
  };

  useEffect(loadCompany, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.post('/companies', form);
      setMessage({ type: 'success', text: 'Configuración de la empresa guardada correctamente' });
      loadCompany();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error guardando la configuración' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="ui-page empresa-page">
        <p className="ui-empty">Cargando configuración de la empresa...</p>
      </div>
    );
  }

  if (!c) {
    return (
      <div className="ui-page empresa-page">
        <h1 className="ui-page-title">Configuración de la Empresa</h1>
        <p className="ui-empty">No se pudo cargar la configuración de la empresa.</p>
      </div>
    );
  }

  return (
    <div className="ui-page empresa-page">
      <header className="ui-page-header empresa-page-header">
        <div>
          <h1 className="ui-page-title">Configuración de la Empresa</h1>
          <p className="ui-page-description">
            Datos generales, clase de riesgo en ARL y órganos del SG-SST.
          </p>
        </div>
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

      <section aria-label="Resumen de configuración" className="ui-surface empresa-resumen">
        <div className="empresa-resumen-item">
          <span className="empresa-resumen-label">Clase de riesgo (ARL)</span>
          <span className="empresa-resumen-value">{c.clase_riesgo}</span>
        </div>
        <div className="empresa-resumen-item">
          <span className="empresa-resumen-label">Estándares aplicables</span>
          <span className="empresa-resumen-value">{c.estandar_set} ítems</span>
        </div>
        <div className="empresa-resumen-item">
          <span className="empresa-resumen-label">Trabajadores</span>
          <span className="empresa-resumen-value">{c.numero_trabajadores ?? '—'}</span>
        </div>
        <div className="empresa-resumen-item">
          <span className="empresa-resumen-label">Canal de alertas</span>
          <span className="empresa-resumen-value">
            {CANAL_LABELS[c.canal_alertas] ?? c.canal_alertas}
          </span>
        </div>
      </section>

      <section aria-labelledby="empresa-form-title" className="ui-surface empresa-form">
        <h2 id="empresa-form-title" className="empresa-form-title">
          Datos de la empresa
        </h2>
        <form onSubmit={handleSave}>
          <div className="empresa-form-grid">
            <div>
              <label className="ui-field-label" htmlFor="empresa-razon">
                Razón social *
              </label>
              <input
                id="empresa-razon"
                value={(form.razon_social as string) ?? c.razon_social}
                onChange={(e) => setForm({ ...form, razon_social: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="empresa-nit">
                NIT *
              </label>
              <input
                id="empresa-nit"
                value={(form.nit as string) ?? c.nit}
                onChange={(e) => setForm({ ...form, nit: e.target.value })}
                required
              />
            </div>
            <div className="empresa-span-2">
              <label className="ui-field-label" htmlFor="empresa-direccion">
                Dirección
              </label>
              <input
                id="empresa-direccion"
                value={(form.direccion as string) ?? c.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="empresa-telefono">
                Teléfono
              </label>
              <input
                id="empresa-telefono"
                value={(form.telefono as string) ?? c.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="empresa-email">
                Correo
              </label>
              <input
                id="empresa-email"
                value={(form.email as string) ?? c.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                type="email"
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="empresa-riesgo">
                Clase de riesgo (ARL) *
              </label>
              <select
                id="empresa-riesgo"
                value={(form.clase_riesgo as string) ?? c.clase_riesgo}
                onChange={(e) => setForm({ ...form, clase_riesgo: e.target.value })}
                required
              >
                <option value="I">I - mínimo</option>
                <option value="II">II - bajo</option>
                <option value="III">III - medio</option>
                <option value="IV">IV - alto</option>
                <option value="V">V - máximo</option>
              </select>
            </div>
            <div>
              <label className="ui-field-label" htmlFor="empresa-sector">
                Sector / actividad económica
              </label>
              <input
                id="empresa-sector"
                value={(form.actividad_economica as string) ?? c.actividad_economica}
                onChange={(e) => setForm({ ...form, actividad_economica: e.target.value })}
              />
            </div>
            <div className="empresa-span-2">
              <label className="ui-field-label" htmlFor="empresa-trabajadores">
                Número de trabajadores
              </label>
              <input
                id="empresa-trabajadores"
                value={(form.numero_trabajadores as number) ?? c.numero_trabajadores}
                onChange={(e) => setForm({ ...form, numero_trabajadores: Number(e.target.value) })}
                type="number"
              />
            </div>
            <div className="empresa-span-2">
              <span className="ui-field-label">Órganos SST</span>
              <div className="empresa-checks">
                <label className="empresa-check" htmlFor="empresa-vigia">
                  <input
                    id="empresa-vigia"
                    type="checkbox"
                    checked={Boolean(form.tiene_vigia_sst ?? c.tiene_vigia_sst)}
                    onChange={(e) => setForm({ ...form, tiene_vigia_sst: e.target.checked })}
                  />
                  Vigía SST
                </label>
                <label className="empresa-check" htmlFor="empresa-convivencia">
                  <input
                    id="empresa-convivencia"
                    type="checkbox"
                    checked={Boolean(form.tiene_comite_convivencia ?? c.tiene_comite_convivencia)}
                    onChange={(e) =>
                      setForm({ ...form, tiene_comite_convivencia: e.target.checked })
                    }
                  />
                  Comité de Convivencia
                </label>
                <label className="empresa-check" htmlFor="empresa-brigada">
                  <input
                    id="empresa-brigada"
                    type="checkbox"
                    checked={Boolean(form.tiene_brigada ?? c.tiene_brigada)}
                    onChange={(e) => setForm({ ...form, tiene_brigada: e.target.checked })}
                  />
                  Brigada de emergencias
                </label>
              </div>
            </div>
            <div className="empresa-span-2">
              <label className="ui-field-label" htmlFor="empresa-canal">
                Canal de alertas
              </label>
              <select
                id="empresa-canal"
                value={(form.canal_alertas as string) ?? c.canal_alertas}
                onChange={(e) => setForm({ ...form, canal_alertas: e.target.value })}
              >
                <option value="email">Correo electrónico</option>
                <option value="whatsapp">Correo + WhatsApp</option>
                <option value="app">Solo en la app</option>
              </select>
            </div>
          </div>
          <div className="ui-form-actions">
            <button type="submit" className="ui-primary-button" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        </form>
      </section>

      {c && (
        <section
          aria-label="Resumen de estándares aplicables"
          className="ui-surface empresa-resumen-estandares"
        >
          <h3 className="empresa-resumen-title">Estándares mínimos aplicables</h3>
          <p className="empresa-resumen-desc">
            Basado en la clase de riesgo y número de trabajadores:{' '}
            <strong>
              {c.clase_riesgo ?? '—'} / {c.numero_trabajadores ?? '—'}
            </strong>
          </p>
          <div className="empresa-resumen-grid">
            {c.clase_riesgo && c.numero_trabajadores && (
              <>
                <div className="empresa-resumen-card">
                  <p className="empresa-resumen-card-label">Conteo estándares</p>
                  <p className="empresa-resumen-card-value">
                    {Number(c.numero_trabajadores) <= 10 && /^[I-II-III]$/.test(c.clase_riesgo)
                      ? '7 estándares (Cap. I)'
                      : Number(c.numero_trabajadores) <= 10 && /^[IV-V]$/.test(c.clase_riesgo)
                        ? '21 estándares (Cap. I+II)'
                        : Number(c.numero_trabajadores) > 10 && /^[I-II-III]$/.test(c.clase_riesgo)
                          ? '21 estándares (Cap. I+II)'
                          : '32 estándares (Cap. I+II+III)'}
                  </p>
                </div>
                <div className="empresa-resumen-card">
                  <p className="empresa-resumen-card-label">Capítulos incluídos</p>
                  <p className="empresa-resumen-card-value">
                    {c.clase_riesgo === 'I'
                      ? 'Capítulo I (peso 1.0)'
                      : c.clase_riesgo === 'II'
                        ? 'Capítulos I-II (pesos 1.0, 1.5)'
                        : c.clase_riesgo === 'III'
                          ? 'Capítulos I-III (pesos 1.0, 1.5, 2.0)'
                          : 'Capítulos I-III (todos los pesos)'}
                  </p>
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
