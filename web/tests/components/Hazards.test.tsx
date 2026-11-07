import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Hazards from '../../src/pages/Hazards.tsx';
import { render } from '../setup.tsx';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { api } from '@/lib/api';

const mockCatalog = [
  { id: 'c1', codigo: 'EL-001', nombre: 'Contacto con partes vivas', categoria: 'electrico', riesgo_por_defecto: 'alto', activo: 1 },
  { id: 'c2', codigo: 'AL-001', nombre: 'Caída de altura', categoria: 'alturas', riesgo_por_defecto: 'critico', activo: 1 },
];

const mockAssessments = [
  { id: 'a1', cargo_oficio: 'Electricista', area: 'Mantenimiento', peligro_texto: 'Contacto con partes vivas', valoracion_riesgo: 'alto', fecha: '2026-01-15' },
  { id: 'a2', cargo_oficio: 'Trabajador alturas', area: 'Techos', peligro_texto: 'Caída de altura', valoracion_riesgo: 'critico', fecha: '2026-02-01' },
];

describe('Matriz de peligros GTC 45', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as vi.Mock).mockImplementation((path: string) => {
      if (path.startsWith('/hazards/catalog?categoria=')) {
        const category = path.split('=')[1];
        return Promise.resolve(mockCatalog.filter(item => item.categoria === category));
      }
      if (path === '/hazards/catalog') return Promise.resolve(mockCatalog);
      if (path === '/hazards/assessments') return Promise.resolve(mockAssessments);
      return Promise.reject(new Error(`Ruta inesperada: ${path}`));
    });
    (api.post as vi.Mock).mockResolvedValue({});
  });

  it('muestra la matriz, el catálogo y las evaluaciones existentes', async () => {
    render(<Hazards />);

    expect(await screen.findByText('Matriz de Peligros, Riesgos y Controles (GTC 45)')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /EL-001.*Contacto con partes vivas/i })).toBeInTheDocument();
    expect(screen.getByText('Electricista')).toBeInTheDocument();
    expect(screen.getByText('Trabajador alturas')).toBeInTheDocument();
    expect(screen.getByText('Total registros:')).toBeInTheDocument();
  });

  it('filtra el catálogo por categoría y vuelve a cargar todos los peligros', async () => {
    render(<Hazards />);
    await screen.findByText('Electricista');

    await userEvent.click(screen.getByRole('button', { name: /eléctrico/i }));
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/hazards/catalog?categoria=electrico');
    });
    expect(screen.getByRole('option', { name: /EL-001.*Contacto con partes vivas/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /AL-001.*Caída de altura/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /todas/i }));
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/hazards/catalog');
    });
    expect(screen.getByRole('option', { name: /AL-001.*Caída de altura/i })).toBeInTheDocument();
  });

  it('completa los controles sugeridos al seleccionar un peligro del catálogo', async () => {
    render(<Hazards />);
    await screen.findByText('Electricista');

    await userEvent.selectOptions(screen.getAllByRole('combobox')[0], 'c1');

    expect(screen.getByPlaceholderText('Se autollenará al seleccionar del catálogo')).toHaveValue('Contacto con partes vivas');
    expect(screen.getAllByRole('combobox')[1]).toHaveValue('alto');
  });

  it('guarda una evaluación personalizada con los datos ingresados', async () => {
    const { container } = render(<Hazards />);
    await screen.findByText('Electricista');

    await userEvent.click(screen.getByLabelText(/peligro personalizado/i));
    await userEvent.type(screen.getByPlaceholderText('Ej: Técnico Instalador CCTV'), 'Soldador');
    await userEvent.type(screen.getByPlaceholderText('Ej: Fachada, Sala de servidores, Poste'), 'Producción');
    await userEvent.type(screen.getByPlaceholderText('Describa el peligro'), 'Humos de soldadura');
    await userEvent.type(screen.getByPlaceholderText('Ej: Instalación cámara en fachada 3er piso'), 'Soldadura de estructuras');
    await userEvent.type(screen.getByPlaceholderText('Ej: Caída a diferente nivel, electrocución, corte'), 'Afección respiratoria');
    await userEvent.type(screen.getByPlaceholderText('Ej: Frecuente, Ocasional, Remota'), 'Ocasional');
    await userEvent.selectOptions(screen.getByRole('combobox'), 'alto');
    await userEvent.type(screen.getByPlaceholderText('Ej: Juan Pérez / Jefe de obra'), 'Jefe de seguridad');
    await userEvent.type(container.querySelector('textarea')!, 'Ventilación y respirador');
    await userEvent.click(screen.getByRole('button', { name: /agregar fila a la matriz/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/hazards/assessments', expect.objectContaining({
        cargo_oficio: 'Soldador',
        area: 'Producción',
        peligro_id: null,
        peligro_texto: 'Humos de soldadura',
        tarea: 'Soldadura de estructuras',
        consecuencia: 'Afección respiratoria',
        probabilidad: 'Ocasional',
        valoracion_riesgo: 'alto',
        controles: 'Ventilación y respirador',
        responsable: 'Jefe de seguridad',
      }));
    });
  });

  it('no envía la evaluación cuando faltan los campos requeridos', async () => {
    render(<Hazards />);
    await screen.findByText('Electricista');

    await userEvent.click(screen.getByLabelText(/peligro personalizado/i));
    await userEvent.click(screen.getByRole('button', { name: /agregar fila a la matriz/i }));

    expect(api.post).not.toHaveBeenCalled();
  });
});
