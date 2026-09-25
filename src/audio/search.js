// iTunes documents JSONP for cross-origin browser searches. No proxy or API key.
let requestId = 0;
const cache = new Map();
export function normalizeResults(data) {
  const seen = new Set();
  return (Array.isArray(data?.results) ? data.results : []).flatMap((track) => {
    if (
      !Number.isSafeInteger(track.trackId) ||
      seen.has(track.trackId) ||
      typeof track.trackName !== 'string'
    )
      return [];
    let url, store;
    try {
      url = new URL(track.previewUrl);
      store = new URL(track.trackViewUrl);
    } catch {
      return [];
    }
    if (
      url.protocol !== 'https:' ||
      !url.hostname.endsWith('.itunes.apple.com') ||
      store.protocol !== 'https:' ||
      !['music.apple.com', 'itunes.apple.com'].includes(store.hostname)
    )
      return [];
    seen.add(track.trackId);
    return [
      {
        id: `itunes:${track.trackId}`,
        title: track.trackName,
        artist: String(track.artistName || 'Artista desconocido'),
        url: url.href,
        storeUrl: store.href,
        preview: true,
        source: 'itunes',
      },
    ];
  });
}

export function searchMusic(query, signal) {
  const term = query.trim().slice(0, 160);
  if (!term) return Promise.resolve([]);
  const key = term.toLocaleLowerCase();
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  return new Promise((resolve, reject) => {
    const callback = `__coloredMusicSearch${++requestId}`;
    const script = document.createElement('script');
    const url = new URL('https://itunes.apple.com/search');
    url.search = new URLSearchParams({
      term,
      media: 'music',
      entity: 'song',
      limit: '20',
      country: 'ES',
      callback,
    });
    let settled = false,
      timer;
    const finish = (error, results) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      script.remove();
      // A late JSONP response after cancellation must not touch the current UI.
      window[callback] = () => {};
      setTimeout(() => delete window[callback], 30000);
      if (error) reject(error);
      else {
        if (cache.size >= 20) cache.delete(cache.keys().next().value);
        cache.set(key, results);
        resolve(results);
      }
    };
    const abort = () => finish(new DOMException('Búsqueda cancelada', 'AbortError'));
    window[callback] = (data) => finish(null, normalizeResults(data));
    script.onerror = () =>
      finish(new Error('No se pudo conectar con iTunes. Vuelve a intentarlo.'));
    timer = setTimeout(
      () => finish(new Error('iTunes tarda en responder. Vuelve a intentarlo.')),
      12000,
    );
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });
    script.src = url.href;
    document.head.append(script);
  });
}
