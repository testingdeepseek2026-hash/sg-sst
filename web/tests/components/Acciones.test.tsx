import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Acciones from '../../src/pages/Acciones';
import { render } from '../setup';

const { api } = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({ api }));

const action = {
  id: 'action-1',
  origen: 'inspeccion',
  origen_detalle: 'Revisión de equipos',
  origen_id: 'inspection-1',
  descripcion: 'Reemplazar cable deteriorado',
  responsable: 'Responsable autorizado',
  fecha_limite: '2026-12-01',
  estado: 'pendiente' as const,
  prioridad: 'alta' as const,
  evidencia_url: '',
  creado_en: '2026-11-01T10:00:00.000Z',
  actualizado_en: '2026-11-01T10:00:00.000Z',
  completada_en: null,
  firmado_por: null,
  firma_url: null,
};

describe('Acciones correctivas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue([action]);
  });

  it('presenta el listado accesible y permite editar una acción desde la tarjeta adaptable', async () => {
    render(<Acciones />);

    const mobileCard = await screen.findByRole('article');
    expect(
      within(mobileCard).getByRole('heading', { name: 'Reemplazar cable deteriorado' })
    ).toBeInTheDocument();
    expect(within(mobileCard).getByText('Revisión de equipos')).toBeInTheDocument();

    fireEvent.click(
      within(mobileCard).getByRole('button', {
        name: 'Editar acción: Reemplazar cable deteriorado',
      })
    );

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Editar acción' })).toBeInTheDocument()
    );
    expect(screen.getByLabelText('Descripción *')).toHaveValue('Reemplazar cable deteriorado');
    expect(screen.getByLabelText('Responsable *')).toHaveValue('Responsable autorizado');
  });

  it('muestra el error de carga en un mensaje accesible', async () => {
    api.get.mockRejectedValueOnce(new Error('No fue posible consultar las acciones.'));

    render(<Acciones />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No fue posible consultar las acciones.'
    );
  });
});
