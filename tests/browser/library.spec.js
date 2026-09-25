import { test, expect } from '@playwright/test';
const catalogueUrl = 'https://agascocompte.github.io/colored-music/library.json';
const previewUrl = 'https://audio-ssl.itunes.apple.com/test.m4a';
const sharedTrack = {
  id: 'shots',
  title: 'Shots',
  artist: 'Imagine Dragons',
  url: 'sounds/Shots.mp3',
};
const result = {
  trackId: 123,
  trackName: 'Yellow',
  artistName: 'Coldplay',
  previewUrl,
  trackViewUrl: 'https://music.apple.com/es/album/yellow/123',
};
function wav() {
  const rate = 8000,
    count = rate * 10,
    b = Buffer.alloc(44 + count * 2);
  b.write('RIFF');
  b.writeUInt32LE(36 + count * 2, 4);
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
  b.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++)
    b.writeInt16LE(Math.sin((i * Math.PI * 220) / rate) * 9000, 44 + i * 2);
  return b;
}
async function audio(route) {
  await route.fulfill({
    contentType: 'audio/wav',
    headers: { 'access-control-allow-origin': '*' },
    body: wav(),
  });
}
async function openSearch(page) {
  await page.locator('#library-open').click();
  await page.getByRole('tab', { name: 'Buscar música' }).click();
}
async function searchReply(route, results) {
  const cb = new URL(route.request().url()).searchParams.get('callback');
  await route.fulfill({
    contentType: 'text/javascript',
    body: `${cb}(${JSON.stringify({ results })})`,
  });
}

test('Shared songs play through the analyser and are removed on reload when the catalogue changes', async ({
  page,
}) => {
  let tracks = [sharedTrack];
  await page.route(catalogueUrl, (route) => route.fulfill({ json: { version: 1, tracks } }));
  await page.route('https://agascocompte.github.io/colored-music/sounds/Shots.mp3', audio);
  await page.goto('/?debug=1');
  await expect(page.locator('#track-count')).toHaveText('2');
  await page.locator('#library-open').click();
  await page.getByRole('button', { name: 'Reproducir Shots', exact: true }).click();
  await expect(page.locator('#track-title')).toHaveText('Shots');
  await expect(page.locator('#play')).toHaveAttribute('aria-label', 'Pausar');
  await expect
    .poll(() => page.evaluate(() => window.__coloredMusicDebug().features.rms))
    .toBeGreaterThan(0.01);
  tracks = [];
  await page.reload();
  await expect(page.locator('#library-status')).toContainText('está vacía');
  await expect(page.locator('#track-count')).toHaveText('1');
});

test('Search plays remote previews without duplicates, shows attribution and fits mobile', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(catalogueUrl, (route) => route.fulfill({ json: { version: 1, tracks: [] } }));
  await page.route('https://itunes.apple.com/search?**', (route) =>
    searchReply(route, [result, result]),
  );
  await page.route(previewUrl, audio);
  await page.goto('/?debug=1');
  await openSearch(page);
  await page.locator('#music-query').fill('Coldplay');
  await page.locator('#music-query').press('Enter');
  await expect(page.locator('.search-result')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Ver Yellow en iTunes' })).toHaveAttribute(
    'href',
    result.trackViewUrl,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/music-search-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole('button', { name: 'Escuchar fragmento de Yellow, Coldplay' }).click();
  await expect(page.locator('#track-title')).toHaveText('Yellow');
  await expect(page.locator('#track-store')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__coloredMusicDebug().features.rms))
    .toBeGreaterThan(0.01);
  await openSearch(page);
  await page.getByRole('button', { name: 'Escuchar fragmento de Yellow, Coldplay' }).click();
  await expect(page.locator('#track-count')).toHaveText('2');
  expect(errors).toEqual([]);
});

test('Catalogue failure can retry; empty and failed searches recover without affecting playback', async ({
  page,
}) => {
  let available = false;
  await page.route(catalogueUrl, (route) =>
    available
      ? route.fulfill({ json: { version: 1, tracks: [sharedTrack] } })
      : route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  let failSearch = false;
  await page.route('https://itunes.apple.com/search?**', (route) =>
    failSearch ? route.abort() : searchReply(route, []),
  );
  await page.goto('/');
  await page.locator('#start').click();
  await page.locator('#library-open').click();
  await expect(page.locator('#library-retry')).toBeVisible();
  available = true;
  await page.locator('#library-retry').click();
  await expect(page.locator('#library-status')).toContainText('1 canciones');
  await page.getByRole('tab', { name: 'Buscar música' }).click();
  await page.locator('#music-query').fill('Nothing');
  await page.locator('#music-query').press('Enter');
  await expect(page.locator('#search-status')).toContainText('No se han encontrado');
  failSearch = true;
  await page.locator('#music-query').fill('Unavailable');
  await page.locator('#music-query').press('Enter');
  await expect(page.locator('#search-status')).toContainText('No se pudo conectar');
  await expect(page.locator('#play')).toHaveAttribute('aria-label', 'Pausar');
});

test('A late search response cannot overwrite a newer result', async ({ page }) => {
  await page.route(catalogueUrl, (route) => route.fulfill({ json: { version: 1, tracks: [] } }));
  let resolveFirst;
  const firstSeen = new Promise((resolve) => (resolveFirst = resolve));
  let releaseFirst;
  const hold = new Promise((resolve) => (releaseFirst = resolve));
  await page.route('https://itunes.apple.com/search?**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('term') === 'First') {
      resolveFirst();
      await hold;
      await searchReply(route, [{ ...result, trackName: 'Old result' }]);
    } else await searchReply(route, [result]);
  });
  await page.goto('/');
  await openSearch(page);
  await page.locator('#music-query').fill('First');
  await page.locator('#music-query').press('Enter');
  await firstSeen;
  await page.locator('#music-query').fill('Second');
  await page.locator('#music-query').press('Enter');
  await expect(page.locator('#search-results')).toContainText('Yellow');
  releaseFirst();
  await expect(page.locator('#search-results')).not.toContainText('Old result');
});
