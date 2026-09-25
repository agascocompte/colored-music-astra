import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

for (const song of ['Shots', 'RiseUp']) {
  test(`${song}: real audio drives actions; detector observation does not create extra beats`, async ({
    page,
  }, testInfo) => {
    test.skip(!existsSync(resolve(`sounds/${song}.mp3`)), 'Optional local reference track');
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?debug=1');
    await page.locator('.visualizer-card').nth(5).click();
    await page.locator('#file-input').setInputFiles(resolve(`sounds/${song}.mp3`));
    await expect(page.locator('#play')).toHaveAttribute('aria-label', 'Pausar');
    await expect
      .poll(async () => Number(await page.locator('#seek').getAttribute('max')))
      .toBeGreaterThan(35);
    await page.locator('#seek').fill('35');
    const report = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const samples = [];
          const timer = setInterval(() => samples.push(window.__coloredMusicDebug()), 50);
          setTimeout(() => {
            clearInterval(timer);
            resolve({ samples, final: window.__coloredMusicDebug() });
          }, 14000);
        }),
    );
    const { events } = report.final;
    expect(report.final.beats).toBeGreaterThan(7);
    expect(report.final.jumps).toBeGreaterThan(2);
    expect(report.final.jumps).toBeLessThan(report.final.beats * 0.6);
    expect(report.final.collected).toBeGreaterThan(12);
    expect(report.final.airCollected).toBeGreaterThan(1);
    expect(report.samples.filter((s) => s.grounded).length / report.samples.length).toBeGreaterThan(
      0.3,
    );
    for (const sample of report.samples) {
      expect(sample.y).toBeLessThanOrEqual(350);
      expect(sample.y).toBeGreaterThanOrEqual(258);
    }
    expect(events.every((e) => e.kind === 'jump' && e.signal === 'music')).toBe(true);
    for (let i = 1; i < events.length; i++)
      expect(events[i].time - events[i - 1].time).toBeGreaterThanOrEqual(0.95);
    expect(events.some((e) => e.action.startsWith('Salto'))).toBe(true);
    expect(events.some((e) => e.action === 'Reentrada')).toBe(false);
    expect(report.final.x).toBeGreaterThan(1000);
    console.log(
      `${song}: ${report.final.beats} beats, ${report.final.jumps} jumps, ${report.final.collected} notes (${report.final.airCollected} upper)`,
    );
    expect(errors).toEqual([]);
    await testInfo.attach(`${song}-response.json`, {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });
    await page.screenshot({ path: `test-results/${song}-runner.png`, fullPage: true });
  });
}

test('Stardust keeps its waves sparse with real audio', async ({ page }, testInfo) => {
  test.skip(!existsSync(resolve('sounds/Shots.mp3')), 'Optional local reference track');
  await page.goto('/?debug=1');
  await page.locator('.visualizer-card').nth(4).click();
  await page.locator('#file-input').setInputFiles(resolve('sounds/Shots.mp3'));
  await expect(page.locator('#play')).toHaveAttribute('aria-label', 'Pausar');
  await expect
    .poll(async () => Number(await page.locator('#seek').getAttribute('max')))
    .toBeGreaterThan(35);
  await page.locator('#seek').fill('35');
  await page.waitForTimeout(14000);
  const report = await page.evaluate(() => window.__coloredMusicDebug());
  expect(report.features.beatCount).toBeGreaterThan(10);
  expect(report.stardustWaves).toBeGreaterThan(0);
  expect(report.stardustWaves).toBeLessThanOrEqual(11);
  expect(report.stardustWaves).toBeLessThan(report.features.beatCount * 0.5);
  console.log(`Stardust: ${report.features.beatCount} beats, ${report.stardustWaves} waves`);
  await page.locator('#play').click();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  const frozen = await page.locator('#visual').evaluate((c) => c.toDataURL());
  await page.waitForTimeout(300);
  expect(await page.locator('#visual').evaluate((c) => c.toDataURL())).toBe(frozen);
  await testInfo.attach('stardust-response.json', {
    body: JSON.stringify(report),
    contentType: 'application/json',
  });
  await page.screenshot({ path: 'test-results/stardust-sparse.png', fullPage: true });
});

test('Hyperdrive and Stardust have a visible attack at unchanged time and RMS', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { ShaderRenderer } = await import('/src/visuals/renderer.js');
    const { emptyFeatures } = await import('/src/audio/features.js');
    const canvas = document.createElement('canvas'),
      renderer = new ShaderRenderer(canvas);
    renderer.resize(640, 360);
    const gl = renderer.gl;
    const read = () => {
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    const metrics = [];
    for (const mode of [2, 4]) {
      const f = emptyFeatures();
      f.rms = 0.15;
      f.energy = 0.35;
      f.bass = 0.4;
      f.mid = 0.25;
      f.high = 0.1;
      f.spectrum.fill(85);
      renderer.draw(mode, 14, f);
      const quiet = read();
      f.punch = 1;
      f.snap = 0.8;
      f.sparkle = 0.7;
      f.impact = 1;
      f.beatAge = 0.07;
      renderer.draw(mode, 14, f);
      const hit = read();
      let delta = 0;
      for (let i = 0; i < hit.length; i++) if (i % 4 !== 3) delta += Math.abs(hit[i] - quiet[i]);
      metrics.push({ mode, meanChannelChange: delta / (hit.length * 0.75) });
    }
    renderer.dispose();
    return metrics;
  });
  for (const metric of result) expect(metric.meanChannelChange).toBeGreaterThan(8);
  await testInfo.attach('visual-attacks.json', {
    body: JSON.stringify(result),
    contentType: 'application/json',
  });
});
