import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Estandares from '../../src/pages/Estandares.tsx';
import { render } from '../setup.tsx';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { api } from '@/lib/api';

const mockStandards = [
  { id: 'std-1', codigo: '0312-1', titulo: 'Asignación de responsable', set_aplicable: '32', capitulo: 'I', activo: 1 },
  { id: 'std-2', codigo: '0312-2', titulo: 'Afiliación al sistema', set_aplicable: '32', capitulo: 'I', activo: 1 },
];

const mockCompliance = { total: 2, cumplidos: 1, incumplidos: 1, porcentaje: 50 };

describe('Autoevaluación de estándares mínimos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.mocked(api.get).mockImplementation((path: string) => Promise.resolve(
      path.includes('/cumplimiento') ? mockCompliance : mockStandards
    ));
    vi.mocked(api.post).mockResolvedValue({});
  });

  it('muestra los estándares y el porcentaje devueltos por la API', async () => {
    render(<Estandares />);

    expect(await screen.findByText('Asignación de responsable')).toBeInTheDocument();
    expect(screen.getByText('Afiliación al sistema')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText(/1\s*\/\s*2/)).toBeInTheDocument();
  });

  it('recarga los estándares al cambiar el conjunto aplicable', async () => {
    const user = userEvent.setup();
    render(<Estandares />);
    await screen.findByText('Asignación de responsable');

    await user.selectOptions(screen.getByRole('combobox'), '7');

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/standards?set=7');
    });
  });

  it('guarda una evaluación por cada estándar del conjunto cargado', async () => {
    const user = userEvent.setup();
    render(<Estandares />);
    await screen.findByText('Asignación de responsable');

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(screen.getByRole('button', { name: 'Guardar evaluación' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenNthCalledWith(1, '/standards/assessments', {
        standard_id: 'std-1',
        cumple: true,
      });
      expect(api.post).toHaveBeenNthCalledWith(2, '/standards/assessments', {
        standard_id: 'std-2',
        cumple: false,
      });
    });
    expect(api.get).toHaveBeenLastCalledWith('/standards/cumplimiento');
  });
});
