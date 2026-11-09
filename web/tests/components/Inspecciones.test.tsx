import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import Inspecciones from '../../src/pages/Inspecciones';
import { render } from '../setup';

const { api } = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../src/lib/api', () => ({ api }));

describe('Inspecciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue([]);
  });

  it('aplica los patrones visuales compartidos al formulario y la lista', async () => {
    render(<Inspecciones />);

    expect(await screen.findByRole('heading', { name: /inspecciones en obra y puestos de trabajo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nueva inspección/i })).toHaveClass('ui-primary-button');
    expect(screen.getByLabelText('Tipo *')).toBeInTheDocument();
    expect(screen.getByText('Tipo *')).toHaveClass('ui-field-label');
    expect(screen.getByLabelText('Fecha *')).toBeInTheDocument();
    expect(screen.getByText('No hay inspecciones registradas')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveClass('inspections-table');
  });
});
