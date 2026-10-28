import { test, expect } from '@playwright/test';
test('facturas y conciliación de pagos requieren acceso autorizado', async ({ request }) => {
  expect((await request.get('/api/invoices/00000000-0000-4000-8000-000000000001')).status()).toBe(
    401,
  );
  expect((await request.post('/api/billing/run')).status()).toBe(401);
  expect(
    (await request.post('/api/stripe/webhook', { data: { type: 'invoice.paid' } })).status(),
  ).toBe(400);
});
test('las normas del calendario son accesibles desde el menú y se adaptan a la pantalla', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Cómo funciona', exact: true })
    .click();
  await expect(page).toHaveURL(/\/como-funciona$/);
  await expect(
    page.getByRole('heading', { name: 'Un calendario fijo para aprender juntos.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '¿Puede el alumno mover una clase?' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: '¿Puede el profesor cambiarla?' })).toBeVisible();
  for (const width of [320, 900, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `ancho ${width}`,
    ).toBe(true);
  }
  await page.screenshot({ path: 'test-results/como-funciona-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'normas de asistencia', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Horario fijo del grupo' })).toBeVisible();
});
test('el catálogo público no contiene datos inventados', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tu siguiente gran jugada.' })).toBeVisible();
  await expect(page.getByText('Elena Martín', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Vista de demostración.', { exact: false })).toHaveCount(0);
  await page.getByRole('link', { name: 'Explorar todas las clases' }).click();
  await expect(page.locator('.group-card')).toHaveCount(0);
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Principiante', exact: true }).click();
  await expect(page.locator('.group-card')).toHaveCount(0);
  await page.goto('/profesores/demo-elena');
  await expect(page.getByRole('heading', { name: 'Esta jugada no existe.' })).toBeVisible();
});
test('sin sesión no se accede al panel ni a operaciones administrativas', async ({
  page,
  request,
}) => {
  await page.goto('/panel');
  await expect(page).toHaveURL(/\/acceso$/);
  const response = await request.post('/api/admin/campaign', {
    headers: { origin: 'http://127.0.0.1:3000' },
    data: {},
  });
  expect(response.status()).toBeGreaterThanOrEqual(400);
});
test('móvil 320 px sin desbordamientos y navegación accesible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Precios' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Un plan claro. Muchas buenas jugadas.' }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('Lichess es el único acceso y la falta de configuración no simula una sesión', async ({
  page,
  request,
}) => {
  await page.goto('/registro');
  await expect(page).toHaveURL(/\/acceso$/);
  await expect(page.getByRole('heading', { name: 'Entra con Lichess.' })).toBeVisible();
  await expect(page.locator('input[type=password]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Continuar con Lichess' })).toBeVisible();
  await page.getByRole('link', { name: 'Continuar con Lichess' }).click();
  await expect(page.locator('.form-error')).toContainText('pendiente de configurar');
  const legacy = await request.post('/api/auth/login', {
    headers: { origin: 'http://127.0.0.1:3000' },
    data: { email: 'test@example.test', password: 'unused' },
  });
  expect(legacy.status()).toBe(410);
});
test('la protección de origen rechaza escrituras externas', async ({ request }) => {
  const r = await request.post('/api/contact', {
    headers: { origin: 'https://external.example.test' },
    data: {},
  });
  expect(r.status()).toBe(403);
});
test('el tema de referencia alcanza formularios y desplegables abiertos', async ({ page }) => {
  await page.goto('/clases');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(25, 24, 30)');
  await page.getByRole('combobox').first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(page.locator('.select-popup')).toHaveCSS('background-color', 'rgb(39, 34, 46)');
  await page.keyboard.press('Escape');
  await page.goto('/acceso');
  await expect(page.getByRole('link', { name: 'Continuar con Lichess' })).toHaveCSS(
    'background-color',
    'rgb(242, 240, 237)',
  );
});
test('rutas públicas y navegación móvil sin desbordamiento', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  for (const path of [
    '/clases',
    '/profesores',
    '/registro',
    '/acceso',
    '/como-funciona',
    '/ser-profesor',
    '/contacto',
    '/legal/condiciones',
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    if (path === '/registro') await expect(page).toHaveURL(/\/acceso$/);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      path,
    ).toBe(true);
  }
});

test('el perfil exige acceso y el callback no acepta una sesión OAuth inventada', async ({
  page,
  request,
}) => {
  await page.goto('/completar-perfil');
  await expect(page).toHaveURL(/\/acceso$/);
  const result = await request.get('/api/auth/lichess/callback?state=fake&code=fake', {
    maxRedirects: 0,
  });
  expect(result.status()).toBe(307);
  expect(result.headers().location).toContain('/acceso?error=lichess');
  const response = await request.post('/api/profile', {
    headers: { origin: 'http://127.0.0.1:3000' },
    data: { name: 'Nombre Real', kind: 'teacher', adult: true, privacy: true, realName: true },
  });
  expect(response.status()).toBe(401);
});
