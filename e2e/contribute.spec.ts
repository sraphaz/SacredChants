import { test, expect } from '@playwright/test';

test.describe('Contribute (no-code)', () => {
  test('página /contribute/ carrega e mostra login quando não autenticado', async ({ page }) => {
    await page.goto('/contribute/');
    await expect(page).toHaveTitle(/Contribute/);
    await expect(page.getByRole('heading', { name: /contribute/i }).first()).toBeVisible();
    await expect(page.locator('#contribute-login-cta')).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in with github/i })).toBeVisible();
    await expect(page.locator('#contribute-authenticated')).toBeHidden();
  });

  test('página /contribute/form/ carrega e exige login', async ({ page }) => {
    await page.goto('/contribute/form/');
    await expect(page).toHaveTitle(/New contribution|Contribute/i);
    await expect(page.getByRole('heading', { name: /new contribution/i }).first()).toBeVisible();
    await expect(page.locator('#form-login-required')).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in with github/i })).toBeVisible();
    await expect(page.locator('#form-wizard')).toBeHidden();
  });

  test('página /contribute/dashboard/ carrega e exige login', async ({ page }) => {
    await page.goto('/contribute/dashboard/');
    await expect(page).toHaveTitle(/My contributions|Contribute/i);
    await expect(page.getByRole('heading', { name: /my contributions/i }).first()).toBeVisible();
    await expect(page.locator('#dashboard-login-required')).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in with github/i })).toBeVisible();
    await expect(page.locator('#dashboard-list')).toBeHidden();
  });

  test('form tem campos de metadata e primeiro verso quando visível', async ({ page }) => {
    await page.goto('/contribute/form/');
    await expect(page.locator('#form-login-required')).toBeVisible();
    // Smoke: se no futuro o form for mostrado sem login em modo só-leitura, os campos existem
    const slug = page.locator('#slug');
    await expect(slug).toBeAttached();
    await expect(page.locator('#title')).toBeAttached();
    await expect(page.locator('#tradition')).toBeAttached();
    await expect(page.locator('#language')).toBeAttached();
    await expect(page.locator('#v_original')).toBeAttached();
    await expect(page.locator('#form-wizard')).toBeAttached();
    await expect(page.locator('#form-section-metadata')).toBeAttached();
    await expect(page.locator('#form-section-verses')).toBeAttached();
    await expect(page.locator('#form-section-review')).toBeAttached();
  });

  test('link Sign in with GitHub no index aponta para API auth', async ({ page }) => {
    await page.goto('/contribute/');
    const link = page.getByRole('link', { name: /sign in with github/i }).first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href).toMatch(/\/api\/auth\/github/);
  });
});
