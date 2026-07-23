import { test, expect } from '@playwright/test';

test.describe('Practice rail (loop · 108 · restart)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('chant-practice-loop', 'false');
        localStorage.setItem('chant-sync-enabled', 'true');
      } catch {
        /* ignore */
      }
    });
    await page.goto('/chants/hanuman-chalisa/');
    await expect(page.locator('#chant-audio')).toBeAttached({ timeout: 15000 });
    await expect(page.locator('#chant-practice-rail')).toBeVisible({ timeout: 10000 });
  });

  test('reiniciar zera o tempo e destaca o início', async ({ page }) => {
    const audio = page.locator('#chant-audio');
    await page.evaluate(async () => {
      const el = document.getElementById('chant-audio') as HTMLAudioElement;
      if (el.readyState < 1) {
        await new Promise<void>((resolve) => {
          el.addEventListener('loadedmetadata', () => resolve(), { once: true });
        });
      }
      el.currentTime = Math.min(12, Math.max(5, (el.duration || 20) / 4));
    });
    await expect
      .poll(async () => page.evaluate(() => (document.getElementById('chant-audio') as HTMLAudioElement).currentTime))
      .toBeGreaterThan(2);

    await page.locator('#chant-practice-restart').click();

    await expect
      .poll(async () => page.evaluate(() => (document.getElementById('chant-audio') as HTMLAudioElement).currentTime))
      .toBeLessThan(0.5);
    await expect(audio).toHaveJSProperty('paused', false);
  });

  test('loop reinicia após ended', async ({ page }) => {
    await page.locator('#chant-practice-loop').click();
    await expect(page.locator('#chant-practice-loop')).toHaveAttribute('aria-pressed', 'true');

    await page.evaluate(() => {
      const el = document.getElementById('chant-audio') as HTMLAudioElement;
      el.pause();
      el.dispatchEvent(new Event('ended'));
    });

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const api = (window as unknown as { SacredChantsPractice?: { getCount: () => number } })
            .SacredChantsPractice;
          return api ? api.getCount() : -1;
        })
      )
      .toBe(1);

    await expect
      .poll(async () => page.evaluate(() => (document.getElementById('chant-audio') as HTMLAudioElement).currentTime))
      .toBeLessThan(1);
    await expect(page.locator('#chant-audio')).toHaveJSProperty('paused', false);
    await expect(page.locator('#chant-practice-count')).toHaveAttribute('data-count', '1');
  });

  test('aos 108 não reinicia e mostra mala completa', async ({ page }) => {
    await page.locator('#chant-practice-loop').click();
    await expect(page.locator('#chant-practice-loop')).toHaveAttribute('aria-pressed', 'true');

    await page.evaluate(() => {
      const api = (
        window as unknown as {
          SacredChantsPractice?: {
            _setCount: (n: number) => void;
            _setMalaTarget: (n: number) => void;
          };
        }
      ).SacredChantsPractice;
      if (!api) throw new Error('SacredChantsPractice missing');
      api._setMalaTarget(3);
      api._setCount(2);
      const el = document.getElementById('chant-audio') as HTMLAudioElement;
      el.pause();
      el.dispatchEvent(new Event('ended'));
    });

    await expect(page.locator('#chant-practice-count')).toHaveAttribute('data-count', '3');
    await expect(page.locator('#chant-practice-rail')).toHaveAttribute('data-mala-complete', 'true');
    await expect(page.locator('#chant-practice-status')).toBeVisible();
    await expect(page.locator('#chant-audio')).toHaveJSProperty('paused', true);
  });

  test('reiniciar após mala completa zera a contagem para uma nova rodada', async ({ page }) => {
    await page.locator('#chant-practice-loop').click();

    await page.evaluate(() => {
      const api = (
        window as unknown as {
          SacredChantsPractice?: {
            _setCount: (n: number) => void;
            _setMalaTarget: (n: number) => void;
          };
        }
      ).SacredChantsPractice;
      if (!api) throw new Error('SacredChantsPractice missing');
      api._setMalaTarget(3);
      api._setCount(2);
      const el = document.getElementById('chant-audio') as HTMLAudioElement;
      el.pause();
      el.dispatchEvent(new Event('ended'));
    });

    await expect(page.locator('#chant-practice-count')).toHaveAttribute('data-count', '3');
    await page.locator('#chant-practice-restart').click();
    await expect(page.locator('#chant-practice-count')).toHaveAttribute('data-count', '0');
    await expect(page.locator('#chant-practice-rail')).not.toHaveAttribute('data-mala-complete', 'true');

    await page.evaluate(() => {
      const el = document.getElementById('chant-audio') as HTMLAudioElement;
      el.pause();
      el.dispatchEvent(new Event('ended'));
    });

    await expect(page.locator('#chant-practice-count')).toHaveAttribute('data-count', '1');
  });

  test('play preserva o status de mala completa enquanto o loop continua ativo', async ({ page }) => {
    await page.locator('#chant-practice-loop').click();

    await page.evaluate(() => {
      const api = (
        window as unknown as {
          SacredChantsPractice?: {
            _setCount: (n: number) => void;
            _setMalaTarget: (n: number) => void;
          };
        }
      ).SacredChantsPractice;
      if (!api) throw new Error('SacredChantsPractice missing');
      api._setMalaTarget(3);
      api._setCount(2);
      const el = document.getElementById('chant-audio') as HTMLAudioElement;
      el.pause();
      el.dispatchEvent(new Event('ended'));
      el.dispatchEvent(new Event('play'));
    });

    await expect(page.locator('#chant-practice-count')).toHaveAttribute('data-count', '3');
    await expect(page.locator('#chant-practice-rail')).toHaveAttribute('data-mala-complete', 'true');
    await expect(page.locator('#chant-practice-status')).toBeVisible();
  });

  test('sem loop, ended destaca o botão reiniciar', async ({ page }) => {
    await page.evaluate(() => {
      const el = document.getElementById('chant-audio') as HTMLAudioElement;
      el.pause();
      el.dispatchEvent(new Event('ended'));
    });

    await expect(page.locator('#chant-practice-restart')).toHaveClass(/chant-practice-rail__btn--emphasize/);
    await expect(page.locator('#chant-practice-end-chip')).toHaveCount(0);
    await page.locator('#chant-practice-restart').click();
    await expect
      .poll(async () => page.evaluate(() => (document.getElementById('chant-audio') as HTMLAudioElement).currentTime))
      .toBeLessThan(0.5);
  });
});
