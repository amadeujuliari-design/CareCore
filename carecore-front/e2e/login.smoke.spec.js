import { expect, test } from '@playwright/test';

test('carrega login e trata falha de autenticacao sem backend real', async ({ page }) => {
  await page.route('http://127.0.0.1:8000/api/login', async (route) => {
    const request = route.request();
    expect(request.headers()['x-carecore-request-id']).toBeTruthy();

    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Credenciais inválidas.' }),
    });
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Entrar no CARECORE\+/i })).toBeVisible();
  await expect(page.getByPlaceholder('usuario@instituicao.org')).toBeVisible();
  await expect(page.getByPlaceholder('Digite sua senha')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Criar instituição' })).toBeVisible();

  await page.getByPlaceholder('usuario@instituicao.org').fill('usuario@carecore.test');
  await page.getByPlaceholder('Digite sua senha').fill('SenhaInvalida@123');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByText('Credenciais inválidas.')).toBeVisible();
});
