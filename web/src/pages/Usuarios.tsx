import { useEffect, useState } from 'react';

import { api } from '@/lib/api';

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: string;
}

const ROL_LABELS: Record<string, string> = {
  administrador: 'Administrador',
  trabajador: 'Trabajador',
};

const initialForm = {
  email: '',
  password: '',
  nombre: '',
  rol: 'trabajador',
};

export default function Usuarios({ rol }: { rol: string }) {
  const esAdministrador = rol === 'administrador';
  const [users, setUsers] = useState<Usuario[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadUsers = async () => {
    setLoadingUsers(true);
    setLoadError(null);
    try {
      const data = await api.get('/users');
      setUsers(data as Usuario[]);
    } catch (error: unknown) {
      setLoadError(
        error instanceof Error ? error.message : 'No fue posible cargar los usuarios registrados.'
      );
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (esAdministrador) {
      void loadUsers();
    } else {
      setLoadingUsers(false);
    }
  }, [esAdministrador]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await api.post('/users/register', form);
      setForm(initialForm);
      loadUsers();
      setMessage({ type: 'success', text: 'Usuario registrado correctamente' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error registrando el usuario' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ui-page usuarios-page">
      <header className="ui-page-header usuarios-page-header">
        <div>
          <h1 className="ui-page-title">Usuarios del Sistema</h1>
          <p className="ui-page-description">
            Roles: administrador (responsable SST) y trabajador (consulta, firma y reporta).
          </p>
        </div>
      </header>

      {!esAdministrador ? (
        <div className="ui-feedback ui-feedback--error" role="alert">
          Solo el administrador puede consultar y gestionar los usuarios del sistema.
        </div>
      ) : (
        <>
          {message && (
            <div
              className={`ui-feedback ui-feedback--${message.type}`}
              role={message.type === 'error' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {message.text}
            </div>
          )}

          {loadError && (
            <div className="ui-feedback ui-feedback--error" role="alert">
              No se pudieron cargar los usuarios: {loadError}
            </div>
          )}

          <section aria-labelledby="usuarios-form-title" className="ui-surface usuarios-form">
            <h2 id="usuarios-form-title" className="usuarios-form-title">
              Registrar usuario
            </h2>
            <form onSubmit={save}>
              <div className="ui-form-grid">
                <div>
                  <label className="ui-field-label" htmlFor="usuario-email">
                    Correo *
                  </label>
                  <input
                    id="usuario-email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    type="email"
                    placeholder="correo@empresa.com"
                    required
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="usuario-password">
                    Contraseña *
                  </label>
                  <input
                    id="usuario-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    type="password"
                    placeholder="Contraseña de acceso"
                    required
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="usuario-nombre">
                    Nombre *
                  </label>
                  <input
                    id="usuario-nombre"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Nombre y apellidos"
                    required
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="usuario-rol">
                    Rol *
                  </label>
                  <select
                    id="usuario-rol"
                    value={form.rol}
                    onChange={(e) => setForm({ ...form, rol: e.target.value })}
                  >
                    <option value="administrador">Administrador</option>
                    <option value="trabajador">Trabajador</option>
                  </select>
                </div>
              </div>
              <div className="ui-form-actions">
                <button type="submit" className="ui-primary-button" disabled={loading}>
                  {loading ? 'Guardando...' : 'Registrar usuario'}
                </button>
              </div>
            </form>
          </section>

          {!loadError && (
            <section aria-label="Usuarios registrados">
              <div className="ui-surface ui-table-wrap">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th scope="col">Correo</th>
                      <th scope="col">Nombre</th>
                      <th scope="col">Rol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.email}</td>
                        <td>{u.nombre}</td>
                        <td>
                          <span className="ui-badge">{ROL_LABELS[u.rol] ?? u.rol}</span>
                        </td>
                      </tr>
                    ))}
                    {!loadingUsers && users.length === 0 && (
                      <tr>
                        <td colSpan={3} className="ui-empty">
                          No hay usuarios registrados
                        </td>
                      </tr>
                    )}
                    {loadingUsers && (
                      <tr>
                        <td colSpan={3} className="ui-empty">
                          Cargando usuarios...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="ui-mobile-list">
                {loadingUsers && <p className="ui-empty">Cargando usuarios...</p>}
                {!loadingUsers && users.length === 0 && (
                  <p className="ui-empty">No hay usuarios registrados</p>
                )}
                {users.map((u) => (
                  <article className="ui-surface ui-mobile-card" key={u.id}>
                    <header className="ui-mobile-card-header">
                      <div>
                        <h2>{u.nombre}</h2>
                        <p>{u.email}</p>
                      </div>
                      <span className="ui-badge">{ROL_LABELS[u.rol] ?? u.rol}</span>
                    </header>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
