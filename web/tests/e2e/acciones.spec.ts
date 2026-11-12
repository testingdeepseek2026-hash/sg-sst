import { expect, test } from '@playwright/test';

test('el campo de evidencia oculto no desborda la vista', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route('**/api/users/me', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-test',
        email: 'auditoria@ejemplo.invalid',
        nombre: 'Usuario de prueba',
        rol: 'administrador',
      }),
    })
  );
  await page.route('**/api/actions', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );

  await page.goto('/acciones');
  await expect(page.locator('#action-evidencia-input')).toBeAttached();

  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    input: document.querySelector('#action-evidencia-input')?.getBoundingClientRect().width,
  }));
  expect(dimensions.input).toBeLessThanOrEqual(1);
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
});
