import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Empresa from '../../src/pages/Empresa';
import { render } from '../setup';

const { api } = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../src/lib/api', () => ({ api }));

const mockCompany = {
  id: 'cmp-001',
  razon_social: 'Micro Instalaciones SAS',
  nit: '900.123.456-7',
  direccion: 'Calle 10 # 20-30',
  telefono: '3001234567',
  email: 'contacto@empresa.com',
  clase_riesgo: 'IV',
  estandar_set: '21',
  sector: 'Servicios',
  actividad_economica: 'Seguridad electrónica',
  numero_trabajadores: 3,
  tiene_vigia_sst: true,
  tiene_copasst: false,
  tiene_comite_convivencia: true,
  tiene_brigada: false,
  canal_alertas: 'app',
};

describe('Empresa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra la información de la empresa cuando la API responde correctamente', async () => {
    api.get.mockResolvedValueOnce(mockCompany);
    render(<Empresa />);

    expect(screen.getByText(/cargando configuración/i)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /configuración de la empresa/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/razón social \*/i)).toHaveValue('Micro Instalaciones SAS');
    expect(screen.getByLabelText(/nit \*/i)).toHaveValue('900.123.456-7');
    expect(screen.getByText('21 ítems')).toBeInTheDocument();
  });

  it('permite guardar cambios en la configuración', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(mockCompany);
    api.post.mockResolvedValueOnce({ ...mockCompany, direccion: 'Nueva Calle 123' });

    render(<Empresa />);
    expect(await screen.findByLabelText(/razón social \*/i)).toBeInTheDocument();

    const direccionInput = screen.getByLabelText(/dirección/i);
    await user.clear(direccionInput);
    await user.type(direccionInput, 'Nueva Calle 123');

    await user.click(screen.getByRole('button', { name: /guardar configuración/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/companies',
        expect.objectContaining({
          razon_social: 'Micro Instalaciones SAS',
          nit: '900.123.456-7',
          direccion: 'Nueva Calle 123',
        })
      );
    });
  });

  it('muestra mensaje de error y botón de reintentar si la carga falla', async () => {
    api.get.mockRejectedValueOnce(new Error('Fallo al conectar'));
    render(<Empresa />);

    expect(await screen.findByText('Fallo al conectar')).toBeInTheDocument();
    expect(screen.getByText('No se pudo cargar la configuración de la empresa.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });
});
