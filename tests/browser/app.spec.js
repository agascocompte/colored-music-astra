import { test, expect } from '@playwright/test';

test('Six visualizers, real playback, seeking, volume, fullscreen and responsive layout', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.visualizer-card')).toHaveCount(6);
  await page.screenshot({ path: 'test-results/desktop-idle.png', fullPage: true });
  await page.locator('#start').click();
  await expect(page.locator('#play')).toHaveAttribute('aria-label', 'Pausar');
  await expect(page.locator('#elapsed')).not.toHaveText('0:00', { timeout: 12000 });
  await expect
    .poll(() => page.locator('#bass-meter').evaluate((el) => el.style.transform))
    .not.toBe('scaleX(0)');
  for (let i = 0; i < 6; i++) {
    await page.locator('.visualizer-card').nth(i).click();
    await expect(page.locator('.visualizer-card').nth(i)).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: `test-results/scene-${i + 1}.png` });
  }
  await page.locator('#seek').fill('31');
  await expect(page.locator('#elapsed')).toHaveText(/0:3[1-9]/);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/runner-playing.png' });
  await page.locator('#play').click();
  await expect(page.locator('#play')).toHaveAttribute('aria-label', 'Reproducir');
  const paused = await page.locator('#seek').inputValue();
  await page.waitForTimeout(500);
  expect(Number(await page.locator('#seek').inputValue())).toBeCloseTo(Number(paused), 1);
  await page.locator('#volume').fill('0.3');
  await expect(page.locator('#volume-value')).toHaveText('30%');
  await page.locator('#mute').click();
  await expect(page.locator('#volume-value')).toHaveText('0%');
  await page.locator('#mute').click();
  await expect(page.locator('#volume-value')).toHaveText('30%');
  await page.locator('#loop').click();
  await expect(page.locator('#loop')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#info').click();
  await expect(page.locator('#info-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#fullscreen').click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await page.locator('#exit-fullscreen').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.locator('.visualizer-card').first().click();
  await page.screenshot({ path: 'test-results/mobile-resonance.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('Local WAV upload, queue selection and invalid audio feedback', async ({ page }) => {
  await page.goto('/');
  const rate = 8000,
    samples = rate * 3,
    b = Buffer.alloc(44 + samples * 2);
  b.write('RIFF');
  b.writeUInt32LE(36 + samples * 2, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    b.writeInt16LE(Math.sin((i * 2 * Math.PI * 110) / rate) * 12000, 44 + i * 2);
  await page
    .locator('#file-input')
    .setInputFiles({ name: 'Mi prueba.wav', mimeType: 'audio/wav', buffer: b });
  await expect(page.locator('#track-title')).toHaveText('Mi prueba');
  await expect(page.locator('#play')).toHaveAttribute('aria-label', 'Pausar');
  await expect(page.locator('#track-count')).toHaveText('2');
  await page.locator('#library-open').click();
  await expect(page.locator('.library-item')).toHaveCount(2);
  await page.locator('.library-item').first().click();
  await expect(page.locator('#track-title')).toHaveText('Neon afterglow');
  await page
    .locator('#file-input')
    .setInputFiles({ name: 'roto.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('broken') });
  await expect(page.locator('#toast')).toBeVisible();
  await expect(page.locator('#play')).toHaveAttribute('aria-label', 'Reproducir');
});

test('The original demo drives a collecting run with musical jumps', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('.visualizer-card').nth(5).click();
  await page.locator('#start').click();
  const observations = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const actions = new Set(),
          reasons = new Set();
        const timer = setInterval(() => {
          actions.add(document.getElementById('game-action').textContent);
          reasons.add(document.getElementById('game-reason').textContent);
        }, 60);
        setTimeout(() => {
          clearInterval(timer);
          resolve({ actions: [...actions], reasons: [...reasons] });
        }, 24000);
      }),
  );
  expect(observations.actions.some((action) => action.includes('Salto'))).toBe(true);
  expect(observations.actions).toContain('Recogiendo notas');
  expect(observations.actions.some((action) => /Espada|Esquiva/.test(action))).toBe(false);
  expect(
    observations.reasons.some((reason) => /Golpe|Transitorio|Subida de intensidad/.test(reason)),
  ).toBe(true);
  await expect
    .poll(async () => Number(await page.locator('#game-combo').textContent()))
    .toBeGreaterThan(1);
  await page.locator('#play').click();
  expect(Number(await page.locator('#game-jumps').textContent())).toBeGreaterThan(2);
  expect(Number(await page.locator('#game-combo').textContent())).toBeGreaterThan(12);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/runner-long.png', fullPage: true });
});

test('Canvas compatibility fallback and keyboard navigation remain usable', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === 'webgl' ? null : getContext.call(this, type, ...args);
    };
  });
  await page.goto('/');
  await expect(page.locator('#toast')).toHaveText('Modo gráfico compatible activado.');
  await page.keyboard.press('6');
  await expect(page.locator('#scene-title')).toHaveText('Beat Runner');
  await page.keyboard.press('1');
  await expect(page.locator('#scene-title')).toHaveText('Resonance');
  await page.keyboard.press('Space');
  await expect(page.locator('#play')).toHaveAttribute('aria-label', 'Pausar');
  await page.keyboard.press('Space');
  await expect(page.locator('#play')).toHaveAttribute('aria-label', 'Reproducir');
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
