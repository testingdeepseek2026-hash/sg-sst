import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../../src/pages/Login.tsx';
import { render } from '../setup.tsx';

const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

import { api } from '@/lib/api';

describe('Inicio de sesión', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra el formulario y el acceso a configuración de empresa', () => {
    render(<Login onLogin={vi.fn()} />);

    expect(screen.getByText('SG-SST - Inicio de sesión')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('admin@sg-sst.local')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configurar empresa primero' })).toHaveAttribute('href', '/empresa');
  });

  it('envía las credenciales, entrega el usuario y navega al tablero', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    const currentUser = { id: 'user-1', email: 'admin@example.com', nombre: 'Admin', rol: 'administrador' };
    vi.mocked(api.post).mockResolvedValue(currentUser);
    render(<Login onLogin={onLogin} />);

    await user.type(screen.getByPlaceholderText('admin@sg-sst.local'), 'admin@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/users/login', {
        email: 'admin@example.com',
        password: 'secret',
      });
      expect(onLogin).toHaveBeenCalledWith(currentUser);
      expect(navigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('muestra el error entregado por la API', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValue(new Error('Credenciales inválidas'));
    render(<Login onLogin={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('admin@sg-sst.local'), 'admin@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'incorrecta');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Credenciales inválidas')).toBeInTheDocument();
  });

  it('deshabilita el botón mientras se procesa el inicio de sesión', async () => {
    const user = userEvent.setup();
    let resolveLogin!: (value: { id: string }) => void;
    vi.mocked(api.post).mockReturnValue(new Promise(resolve => {
      resolveLogin = resolve;
    }));
    render(<Login onLogin={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('admin@sg-sst.local'), 'admin@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(screen.getByRole('button', { name: 'Ingresando...' })).toBeDisabled();
    resolveLogin({ id: 'user-1' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled());
  });
});
