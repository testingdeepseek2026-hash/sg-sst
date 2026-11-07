import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Altura() {
  const [permits, setPermits] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ fecha: new Date().toISOString().slice(0,10), equipo_verificado: false, apto_medico: false, certificado_alturas: false });
  useEffect(() => { api.get('/altura/permits').then(setPermits); }, []);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.post('/altura/permits', form); setForm({ fecha: new Date().toISOString().slice(0,10), equipo_verificado: false, apto_medico: false, certificado_alturas: false }); api.get('/altura/permits').then(setPermits); } catch (err: any) { alert(err.message || 'Error'); }
  };
  const chk = (k: string) => <input type="checkbox" checked={!!form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} />;
  return (
    <div style={{ padding: 20, maxWidth: 950 }}>
      <h1 style={{ marginBottom: 12, color: '#0f766e' }}>Trabajo en Alturas - Permiso y ATS (Res. 4272/2021)</h1>
      <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 14 }}>Certificación vigente (3 años), permiso de trabajo, ATS por obra y equipos inspeccionados.</p>
      <form onSubmit={save} style={{ background: '#fff', padding: 14, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
        <input value={form.obra} onChange={(e) => setForm({ ...form, obra: e.target.value })} placeholder="Obra / instalación" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
        <input value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} type="date" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
        <input value={form.solicitante} onChange={(e) => setForm({ ...form, solicitante: e.target.value })} placeholder="Solicitante" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
        <input value={form.responsable_seguridad} onChange={(e) => setForm({ ...form, responsable_seguridad: e.target.value })} placeholder="Resp. seguridad" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{chk('equipo_verificado')} Equipo verificado</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{chk('apto_medico')} Apto médico</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{chk('certificado_alturas')} Cert. alturas vigente</div>
        <button type="submit" style={{ padding: '8px 14px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>Autorizar permiso</button>
      </form>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <thead><tr style={{ background: '#f3f4f6', textAlign: 'left' }}><th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Obra</th><th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Fecha</th><th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th></tr></thead>
        <tbody>
          {permits.map((x) => (
            <tr key={x.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: 10 }}>{x.obra}</td>
              <td style={{ padding: 10 }}>{x.fecha}</td>
              <td style={{ padding: 10 }}>{x.estado}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

