export const CATALOGUE_URL = 'https://agascocompte.github.io/colored-music-library/library.json';

export function parseCatalogue(data, base = CATALOGUE_URL) {
  if (!data || data.version !== 1 || !Array.isArray(data.tracks))
    throw new Error('Catálogo no válido');
  const seen = new Set();
  return data.tracks.flatMap((track) => {
    if (
      !track ||
      typeof track.id !== 'string' ||
      !track.id ||
      typeof track.title !== 'string' ||
      !track.title.trim() ||
      typeof track.url !== 'string'
    )
      return [];
    let url;
    try {
      url = new URL(track.url, base);
    } catch {
      return [];
    }
    if (url.protocol !== 'https:' || url.origin !== new URL(base).origin || seen.has(track.id))
      return [];
    seen.add(track.id);
    return [
      {
        id: `shared:${track.id}`,
        title: track.title.trim(),
        artist: typeof track.artist === 'string' ? track.artist : 'Biblioteca compartida',
        url: url.href,
        source: 'shared',
      },
    ];
  });
}

export async function loadCatalogue() {
  const response = await fetch(CATALOGUE_URL, {
    cache: 'no-cache',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('No se pudo cargar la biblioteca compartida');
  return parseCatalogue(await response.json());
}
