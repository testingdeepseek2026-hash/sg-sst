import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Trabajadores from '../../src/pages/Trabajadores.tsx';
import { render } from '../setup.tsx';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '@/lib/api';

const mockWorkers = [
  { id: 'w1', tipo_documento: 'CC', numero_documento: '1234567890', nombres: 'Juan', apellidos: 'Pérez', cargo: 'Electricista', fecha_ingreso: '2024-01-15', estado: 'activo', eps: 'Nueva EPS', arl: 'Positiva', afp: 'Porvenir' },
  { id: 'w2', tipo_documento: 'CC', numero_documento: '0987654321', nombres: 'María', apellidos: 'González', cargo: 'Auxiliar', fecha_ingreso: '2024-03-01', estado: 'activo', eps: 'Sanitas', arl: 'Colpatria', afp: 'Protección' },
];

const mockExams = [
  { id: 'ex1', worker_id: 'w1', tipo: 'ingreso', fecha: '2026-01-15', vencimiento: '2027-01-15', resultado: 'apto', medico: 'Dra. López', entidad: 'IPS Salud' },
];

const mockCerts = [
  { id: 'c1', worker_id: 'w1', tipo: 'alturas', nombre_curso: 'Trabajo en alturas', fecha_emision: '2023-01-15', fecha_vencimiento: '2026-01-15' },
];

const mockEpp = [
  { id: 'e1', worker_id: 'w1', item: 'Casco de seguridad', cantidad: 1, fecha_entrega: '2026-01-15', fecha_vencimiento: '2027-01-15', firmado_por_trabajador: 0, firma_url: null },
];

const openWorkerDetails = async (user: ReturnType<typeof userEvent.setup>) => {
  await screen.findByText('Juan Pérez');
  const workerRow = screen.getByText('Juan Pérez').closest('tr')!;
  await user.click(within(workerRow).getByRole('button', { name: /ver ficha/i }));
  await screen.findByRole('heading', { name: 'Juan Pérez' });
};

const openWorkerTab = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) => {
  await openWorkerDetails(user);
  await user.click(screen.getByRole('button', { name }));
};

describe('Gestión de trabajadores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as vi.Mock).mockImplementation((path: string) => {
      if (path === '/workers') return Promise.resolve(mockWorkers);
      if (path === '/workers/w1/exams') return Promise.resolve(mockExams);
      if (path === '/workers/w1/certs') return Promise.resolve(mockCerts);
      if (path === '/workers/w1/epp') return Promise.resolve(mockEpp);
      if (path.startsWith('/certs/alturas/calcular-vencimiento')) {
        return Promise.resolve({ fecha_vencimiento: '2029-01-15' });
      }
      return Promise.reject(new Error(`Ruta inesperada: ${path}`));
    });
    (api.post as vi.Mock).mockResolvedValue({});
    (api.put as vi.Mock).mockResolvedValue({});
    (api.delete as vi.Mock).mockResolvedValue(null);
  });

  it('carga y muestra trabajadores con sus datos laborales', async () => {
    render(<Trabajadores />);

    expect(await screen.findByText('Gestión de Trabajadores')).toBeInTheDocument();
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('Electricista')).toBeInTheDocument();
    expect(screen.getByText('María González')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/workers');
  });

  it('abre la ficha y carga exámenes, certificados y EPP del trabajador', async () => {
    const user = userEvent.setup();
    render(<Trabajadores />);

    await openWorkerDetails(user);

    expect(api.get).toHaveBeenCalledWith('/workers/w1/exams');
    expect(api.get).toHaveBeenCalledWith('/workers/w1/certs');
    expect(api.get).toHaveBeenCalledWith('/workers/w1/epp');
    expect(screen.getByRole('button', { name: /exámenes médicos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /certificados/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /epp\/dotación/i })).toBeInTheDocument();
  });

  it('muestra exámenes y habilita el registro de un nuevo examen', async () => {
    const user = userEvent.setup();
    render(<Trabajadores />);
    await openWorkerTab(user, /exámenes médicos/i);

    expect(await screen.findByText('ingreso')).toBeInTheDocument();
    expect(screen.getByText('apto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ agregar examen/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /\+ agregar examen/i }));
    expect(await screen.findByRole('heading', { name: 'Nuevo Examen Médico' })).toBeInTheDocument();
  });

  it('registra un examen ocupacional del trabajador seleccionado', async () => {
    const user = userEvent.setup();
    const { container } = render(<Trabajadores />);
    await openWorkerTab(user, /exámenes médicos/i);
    await user.click(screen.getByRole('button', { name: /\+ agregar examen/i }));

    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0], 'periodico');
    await user.selectOptions(selects[1], 'apto');
    await user.clear(container.querySelector('input[type="date"]')!);
    await user.type(container.querySelector('input[type="date"]')!, '2026-06-15');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/workers/w1/exams', expect.objectContaining({
        tipo: 'periodico',
        fecha: '2026-06-15',
        resultado: 'apto',
        worker_id: 'w1',
      }));
    });
  });

  it('muestra el error de API al fallar el registro de un examen', async () => {
    const user = userEvent.setup();
    (api.post as vi.Mock).mockRejectedValueOnce(new Error('No ha autorizado tratamiento de datos médicos'));
    render(<Trabajadores />);
    await openWorkerTab(user, /exámenes médicos/i);
    await user.click(screen.getByRole('button', { name: /\+ agregar examen/i }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(/no ha autorizado tratamiento de datos médicos/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nuevo Examen Médico' })).toBeInTheDocument();
  });

  it('muestra certificados y calcula el vencimiento de alturas al cambiar la emisión', async () => {
    const user = userEvent.setup();
    const { container } = render(<Trabajadores />);
    await openWorkerTab(user, /certificados/i);

    expect(await screen.findByText('Trabajo en alturas')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /\+ agregar certificado/i }));
    await user.selectOptions(screen.getAllByRole('combobox')[0], 'alturas');

    const dateInput = container.querySelector('input[type="date"]')!;
    await user.clear(dateInput);
    await user.type(dateInput, '2026-01-15');

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/certs/alturas/calcular-vencimiento?fecha_emision=2026-01-15');
      expect(container.querySelectorAll('input[type="date"]')[1]).toHaveValue('2029-01-15');
    });
  });

  it('muestra los elementos de protección entregados y permite abrir el registro de EPP', async () => {
    const user = userEvent.setup();
    render(<Trabajadores />);
    await openWorkerTab(user, /epp\/dotación/i);

    expect(await screen.findByText('Casco de seguridad')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /firmar/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /\+ registrar entrega/i }));
    expect(await screen.findByRole('heading', { name: 'Registrar Entrega de EPP' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Arnés de cuerpo completo' })).toBeInTheDocument();
  });

  it('registra una entrega de EPP asociada al trabajador seleccionado', async () => {
    const user = userEvent.setup();
    render(<Trabajadores />);
    await openWorkerTab(user, /epp\/dotación/i);
    await user.click(screen.getByRole('button', { name: /\+ registrar entrega/i }));

    await user.selectOptions(screen.getAllByRole('combobox')[0], 'Arnés de cuerpo completo');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/workers/w1/epp', expect.objectContaining({
        item: 'Arnés de cuerpo completo',
        cantidad: 1,
        worker_id: 'w1',
      }));
    });
  });
});
