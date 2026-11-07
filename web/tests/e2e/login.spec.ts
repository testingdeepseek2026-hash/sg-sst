import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('debe mostrar formulario de login', async ({ page }) => {
    await expect(page.getByLabel('Correo electrónico')).toBeVisible();
    await expect(page.getByLabel('Contraseña')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('debe mostrar errores de validación', async ({ page }) => {
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    
    await expect(page.getByText('El correo es requerido')).toBeVisible();
    await expect(page.getByText('La contraseña es requerida')).toBeVisible();
  });

  test('debe validar formato de email', async ({ page }) => {
    await page.getByLabel('Correo electrónico').fill('email-invalido');
    await page.getByLabel('Contraseña').fill('password123');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    
    await expect(page.getByText('Formato de correo inválido')).toBeVisible();
  });

  test('debe iniciar sesión exitosamente y redirigir a dashboard', async ({ page }) => {
    // Mock API response
    await page.route('/api/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            user: { id: '1', email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
            token: 'mock-jwt-token',
          },
        }),
      });
    });

    await page.getByLabel('Correo electrónico').fill('admin@test.com');
    await page.getByLabel('Contraseña').fill('password123');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    // Esperar redirección a dashboard
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Resumen SG-SST')).toBeVisible();
  });

  test('debe mostrar error en credenciales inválidas', async ({ page }) => {
    await page.route('/api/auth/login', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Credenciales inválidas' }),
      });
    });

    await page.getByLabel('Correo electrónico').fill('admin@test.com');
    await page.getByLabel('Contraseña').fill('wrong');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page.getByText('Credenciales inválidas')).toBeVisible();
  });
});

test.describe('Login - Responsive', () => {
  test('debe funcionar en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');
    
    await expect(page.getByLabel('Correo electrónico')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  });
});