import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Indicadores() {
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0,7));
  const [inds, setInds] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});

  useEffect(() => { api.get('/indicators?periodo=' + periodo).then(setInds); }, [periodo]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/indicators', { ...form, periodo });
      setForm({});
      api.get('/indicators?periodo=' + periodo).then(setInds);
    } catch (err: any) { alert(err.message || 'Error'); }
  };

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <h1 style={{ marginBottom: 12, color: '#0f766e' }}>Indicadores del SG-SST</h1>
      <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 14 }}>Estructura, proceso y resultado (frecuencia, severidad, mortalidad, ausentismo, cumplimiento del plan).</p>
      <div style={{ marginBottom: 14 }}>
        <label style={{ marginRight: 8, fontSize: 13, color: '#374151' }}>Periodo:</label>
        <input value={periodo} onChange={(e) => setPeriodo(e.target.value)} type="month" style={{ padding: 6, borderRadius: 6, border: '1px solid #d1d5db' }} />
      </div>
      <form onSubmit={save} style={{ background: '#fff', padding: 14, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
        <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre indicador" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
        <select value={form.tipo ?? 'proceso'} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
          <option value="estructura">Estructura</option><option value="proceso">Proceso</option><option value="resultado">Resultado</option>
        </select>
        <input value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} type="number" placeholder="Valor" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
        <input value={form.meta} onChange={(e) => setForm({ ...form, meta: Number(e.target.value) || undefined })} type="number" placeholder="Meta" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
        <button type="submit" style={{ padding: '8px 14px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>Registrar</button>
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <thead><tr style={{ background: '#f3f4f6', textAlign: 'left' }}><th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Nombre</th><th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Tipo</th><th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Valor</th><th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Meta</th><th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Periodo</th></tr></thead>
        <tbody>
          {inds.map((x) => (
            <tr key={x.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: 10 }}>{x.nombre}</td>
              <td style={{ padding: 10 }}>{x.tipo}</td>
              <td style={{ padding: 10 }}>{x.valor}</td>
              <td style={{ padding: 10 }}>{x.meta ?? '-'}</td>
              <td style={{ padding: 10 }}>{x.periodo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

