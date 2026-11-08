import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { api } from '../lib/api';

export default function Login({ onLogin }: { onLogin: (u: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const me = await api.post('/users/login', { email, password });
      onLogin(me);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f766e',
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: 32,
          borderRadius: 12,
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          width: 360,
        }}
      >
        <h2 style={{ marginBottom: 20, color: '#0f766e', textAlign: 'center' }}>
          SG-SST - Inicio de sesión
        </h2>
        {error && <div style={{ color: 'red', marginBottom: 14, fontSize: 13 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label
              htmlFor="login-email"
              style={{ display: 'block', fontSize: 13, marginBottom: 6, color: '#374151' }}
            >
              Correo electrónico
            </label>
            <input
              id="login-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="admin@sg-sst.local"
              style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 6 }}
              required
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label
              htmlFor="login-password"
              style={{ display: 'block', fontSize: 13, marginBottom: 6, color: '#374151' }}
            >
              Contraseña
            </label>
            <input
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 6 }}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: 12,
              background: '#0f766e',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontWeight: 'bold',
              fontSize: 15,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
          Usuario demo: admin@sg-sst.local / Admin1234!
          <br />
          Trabajador: trabajador@sg-sst.local / Trab1234!
        </p>
        <NavLink
          to="/empresa"
          style={{
            display: 'block',
            marginTop: 10,
            fontSize: 13,
            color: '#0f766e',
            textAlign: 'center',
          }}
        >
          Configurar empresa primero
        </NavLink>
      </div>
    </div>
  );
}
