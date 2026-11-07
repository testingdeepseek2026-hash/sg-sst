import { test, expect } from '@playwright/test';

test.describe('Dashboard y Navegación', () => {
  test.beforeEach(async ({ page }) => {
    // Login mock
    await page.route('/api/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { user: { id: '1', email: 'admin@test.com', nombre: 'Admin', rol: 'admin' }, token: 'mock-jwt' },
        }),
      });
    });

    // Mock dashboard stats
    await page.route('/api/stats', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            workers_total: 25, workers_active: 23, exams_pending: 3, exams_expired: 1,
            certs_expiring: 5, certs_expired: 2, epp_pending_signature: 4,
            alerts_critical: 2, alerts_high: 5, alerts_medium: 8,
          },
        }),
      });
    });

    // Mock alerts
    await page.route('/api/alerts*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'a1', tipo: 'certificado', mensaje: 'Certificado vence en 5 días', prioridad: 'alta', fecha_vencimiento: '2026-06-20' },
            { id: 'a2', tipo: 'examen', mensaje: 'Examen vencido', prioridad: 'critica', fecha_vencimiento: '2026-06-10' },
          ],
        }),
      });
    });

    // Mock indicators
    await page.route('/api/indicators*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'i1', codigo: 'TRIR', nombre: 'Tasa incidentes', valor: 1.2, meta: 2.0, unidad: 'x100k hrs', tendencia: 'down' },
          ],
        }),
      });
    });

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('admin@test.com');
    await page.getByLabel('Contraseña').fill('password123');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL('/');
  });

  test('debe mostrar dashboard con estadísticas', async ({ page }) => {
    await expect(page.getByText('Resumen SG-SST')).toBeVisible();
    await expect(page.getByText('25')).toBeVisible(); // Total trabajadores
    await expect(page.getByText('23')).toBeVisible(); // Activos
  });

  test('debe navegar a módulo de Trabajadores', async ({ page }) => {
    // Mock workers list
    await page.route('/api/workers*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'w1', nombres: 'Juan', apellidos: 'Pérez', cargo: 'Electricista', estado: 'activo' },
          ],
        }),
      });
    });

    await page.getByRole('link', { name: /trabajadores/i }).click();
    await expect(page).toHaveURL(/.*trabajadores/);
    await expect(page.getByText('Gestión de Trabajadores')).toBeVisible();
    await expect(page.getByText('Juan Pérez')).toBeVisible();
  });

  test('debe navegar a módulo de Peligros', async ({ page }) => {
    await page.route('/api/hazards/catalog*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'c1', codigo: 'EL-001', nombre: 'Contacto partes vivas', categoria: 'electrico', activo: 1 }] }),
      });
    });
    await page.route('/api/hazards/assessments*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });

    await page.getByRole('link', { name: /peligros/i }).click();
    await expect(page).toHaveURL(/.*peligros/);
    await expect(page.getByText('Catálogo de Peligros')).toBeVisible();
  });

  test('debe navegar a módulo de Estándares', async ({ page }) => {
    await page.route('/api/standards*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 's1', codigo: 'ISO-45001-4.1', titulo: 'Contexto', set_aplicable: 'iso45001', activo: 1 }] }),
      });
    });
    await page.route('/api/standard-assessments*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });

    await page.getByRole('link', { name: /estandares/i }).click();
    await expect(page).toHaveURL(/.*estandares/);
    await expect(page.getByText('Estándares y Normativa')).toBeVisible();
  });

  test('debe navegar a módulo de Política', async ({ page }) => {
    await page.route('/api/policies*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'p1', titulo: 'Política SST', estado: 'vigente', version: 1 }] }),
      });
    });
    await page.route('/api/policies/*/objectives*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });

    await page.getByRole('link', { name: /politica/i }).click();
    await expect(page).toHaveURL(/.*politica/);
    await expect(page.getByText('Política de SST')).toBeVisible();
  });

  test('debe navegar a módulo de Alertas', async ({ page }) => {
    await page.route('/api/alerts*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'a1', tipo: 'certificado', mensaje: 'Alerta test', prioridad: 'alta' }] }),
      });
    });

    await page.getByRole('link', { name: /alertas/i }).click();
    await expect(page).toHaveURL(/.*alertas/);
    await expect(page.getByText('Alertas')).toBeVisible();
  });
});

test.describe('CRUD Básico - Trabajadores', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { user: { id: '1', email: 'admin@test.com', nombre: 'Admin', rol: 'admin' }, token: 'mock-jwt' } }),
      });
    });

    await page.route('/api/workers*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [{ id: 'w1', nombres: 'Juan', apellidos: 'Pérez', documento: '1234567890', cargo: 'Electricista', area: 'Mantenimiento', estado: 'activo' }] }),
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { id: 'w2', ...JSON.parse(route.request().postData() || '{}') } }) });
      } else if (route.request().method() === 'PUT') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'w1', ...JSON.parse(route.request().postData() || '{}') } }) });
      } else if (route.request().method() === 'DELETE') {
        await route.fulfill({ status: 204 });
      }
    });

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('admin@test.com');
    await page.getByLabel('Contraseña').fill('password123');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.getByRole('link', { name: /trabajadores/i }).click();
  });

  test('debe crear nuevo trabajador', async ({ page }) => {
    await page.getByRole('button', { name: /nuevo trabajador/i }).click();
    
    await expect(page.getByRole('dialog', { name: /nuevo trabajador/i })).toBeVisible();
    
    await page.getByLabel('Nombres').fill('Carlos');
    await page.getByLabel('Apellidos').fill('López');
    await page.getByLabel('Documento').fill('1122334455');
    await page.getByLabel('Cargo').fill('Soldador');
    await page.getByLabel('Área').fill('Producción');
    await page.getByRole('button', { name: /crear/i }).click();
    
    // Verificar que se llamó la API
    await expect(page.getByText('Carlos López')).toBeVisible({ timeout: 5000 });
  });

  test('debe editar trabajador existente', async ({ page }) => {
    await page.getByText('Juan Pérez').click();
    await page.getByRole('button', { name: /editar/i }).click();
    
    await page.getByLabel('Cargo').fill('Electricista Senior');
    await page.getByRole('button', { name: /guardar/i }).click();
    
    await expect(page.getByText('Electricista Senior')).toBeVisible({ timeout: 5000 });
  });

  test('debe buscar trabajadores', async ({ page }) => {
    await page.getByPlaceholder(/buscar trabajador/i).fill('Juan');
    await expect(page.getByText('Juan Pérez')).toBeVisible();
    await expect(page.getByText('Carlos López')).not.toBeVisible();
  });
});

test.describe('CRUD Básico - Peligros (IPERC)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/auth/login', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { user: { id: '1', email: 'admin@test.com', rol: 'admin' }, token: 'mock-jwt' } }) });
    });
    await page.route('/api/hazards/catalog*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });
    await page.route('/api/hazards/assessments*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('admin@test.com');
    await page.getByLabel('Contraseña').fill('password123');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.getByRole('link', { name: /peligros/i }).click();
  });

  test('debe crear evaluación IPERC', async ({ page }) => {
    await page.route('/api/hazards/assessments', async route => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { id: 'a1', cargo_oficio: 'Soldador', valoracion_riesgo: 'alto' } }) });
    });

    await page.getByRole('tab', { name: /evaluaciones/i }).click();
    await page.getByRole('button', { name: /nueva evaluación/i }).click();
    
    await page.getByLabel('Cargo / Oficio').fill('Soldador');
    await page.getByLabel('Área').fill('Producción');
    await page.getByLabel('Peligro (texto)').fill('Humos de soldadura');
    await page.getByLabel('Tarea').fill('Soldadura estructuras');
    await page.getByLabel('Consecuencia').fill('Intoxicación');
    await page.getByLabel('Probabilidad').fill('Probable');
    await page.getByLabel('Valoración de riesgo').selectOption('alto');
    await page.getByLabel('Controles').fill('Ventilación, EPP');
    await page.getByLabel('Responsable').fill('Jefe seguridad');
    await page.getByRole('button', { name: /guardar/i }).click();
    
    await expect(page.getByText('Soldador')).toBeVisible({ timeout: 5000 });
  });
});