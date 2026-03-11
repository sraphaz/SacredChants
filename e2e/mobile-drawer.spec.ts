import { test, expect } from '@playwright/test';

/**
 * E2E: menu drawer em viewport mobile.
 * O drawer só é visível/interativo em mobile (max-width: 767px); usar project 'mobile'.
 */
test.describe('Mobile drawer', () => {
  test.use({ project: 'mobile' });

  test.beforeEach(async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'mobile') test.skip();
    await page.goto('/');
  });

  test('abre ao clicar no botão do menu', async ({ page }) => {
    const toggle = page.locator('#sc-header-menu-toggle');
    const drawer = page.locator('#sc-header-drawer');

    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveAttribute('aria-label', /open menu/i);

    await toggle.click();

    await expect(drawer).toHaveClass(/sc-header__drawer--open/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toHaveAttribute('aria-label', /close menu/i);
  });

  test('fecha ao clicar no backdrop', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /open menu/i });
    const drawer = page.locator('#sc-header-drawer');
    const backdrop = page.locator('#sc-header-drawer-backdrop');

    await toggle.click();
    await expect(drawer).toHaveClass(/sc-header__drawer--open/);

    await backdrop.click();
    await expect(drawer).not.toHaveClass(/sc-header__drawer--open/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('fecha ao pressionar Escape', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /open menu/i });
    const drawer = page.locator('#sc-header-drawer');

    await toggle.click();
    await expect(drawer).toHaveClass(/sc-header__drawer--open/);

    await page.keyboard.press('Escape');
    await expect(drawer).not.toHaveClass(/sc-header__drawer--open/);
  });

  test('fecha ao clicar num link do drawer', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /open menu/i });
    const drawer = page.locator('#sc-header-drawer');
    const chantsLink = page.locator('#sc-header-drawer').getByRole('link', { name: /chants/i }).first();

    await toggle.click();
    await expect(drawer).toHaveClass(/sc-header__drawer--open/);

    await chantsLink.click();
    await expect(page).toHaveURL(/\/chants\/?/);
    // Na nova página o drawer deve estar fechado
    await expect(page.locator('#sc-header-drawer')).not.toHaveClass(/sc-header__drawer--open/);
  });

  test('drawer ocupa área abaixo do header (não colapsado)', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /open menu/i });
    const drawer = page.locator('#sc-header-drawer');

    await toggle.click();
    await expect(drawer).toHaveClass(/sc-header__drawer--open/);

    const box = await drawer.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(100);
    expect(box!.width).toBeGreaterThan(100);
  });

  test('drawer não mostra barra de rolagem (menu em altura cheia, sem scroll)', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /open menu/i });
    const drawer = page.locator('#sc-header-drawer');
    const menu = page.locator('#sc-header-drawer .sc-header__drawer-menu');

    await toggle.click();
    await expect(drawer).toHaveClass(/sc-header__drawer--open/);

    // Drawer: sem overflow vertical (nunca mostra scrollbar)
    const drawerOverflowY = await drawer.evaluate((el) => window.getComputedStyle(el).overflowY);
    expect(drawerOverflowY, 'drawer não deve ter overflow-y auto/scroll').not.toMatch(/^(auto|scroll)$/);

    // Lista do menu: sem overflow auto/scroll (sem barra de rolagem)
    const menuOverflowY = await menu.evaluate((el) => window.getComputedStyle(el).overflowY);
    expect(menuOverflowY, 'menu do drawer não deve ter barra de rolagem').not.toMatch(/^(auto|scroll)$/);
  });
});
