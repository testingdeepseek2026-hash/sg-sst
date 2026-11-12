import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Usuarios from '../../src/pages/Usuarios';
import { render } from '../setup';

const { api } = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({ api }));

describe('Usuarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue([]);
  });

  it('muestra el estado vacío únicamente después de cargar la lista como administrador', async () => {
    render(<Usuarios rol="administrador" />);

    expect(await screen.findAllByText('No hay usuarios registrados')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Registrar usuario' })).toBeInTheDocument();
  });

  it('informa la restricción y oculta las acciones para trabajadores', () => {
    render(<Usuarios rol="trabajador" />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Solo el administrador puede consultar y gestionar los usuarios del sistema.'
    );
    expect(screen.queryByRole('button', { name: 'Registrar usuario' })).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('muestra el error de carga en lugar de un estado vacío', async () => {
    api.get.mockRejectedValueOnce(new Error('Solo administrador'));

    render(<Usuarios rol="administrador" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudieron cargar los usuarios: Solo administrador'
    );
    expect(screen.queryByText('No hay usuarios registrados')).not.toBeInTheDocument();
  });
});
