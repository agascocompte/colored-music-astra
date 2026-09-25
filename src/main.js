import './style.css';
import { icon, hydrateIcons } from './icons.js';
import { AudioEngine } from './audio/engine.js';
import { emptyFeatures } from './audio/features.js';
import { readMetadata } from './audio/metadata.js';
import { loadCatalogue } from './audio/catalogue.js';
import { searchMusic } from './audio/search.js';
import { scenes } from './visuals/scenes.js';
import { ShaderRenderer, FallbackRenderer } from './visuals/renderer.js';
import { BeatWorld } from './game/director.js';
import { GameRenderer } from './game/render.js';

const $ = (id) => document.getElementById(id);
hydrateIcons();
const engine = new AudioEngine(),
  world = new BeatWorld();
let visualCanvas = $('visual'),
  renderer;
let toastTimer;
function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').hidden = true), 6500);
}
try {
  renderer = new ShaderRenderer(visualCanvas, () =>
    toast('El contexto gráfico se ha interrumpido. Prueba Beat Runner mientras se recupera.'),
  );
} catch {
  const replacement = visualCanvas.cloneNode();
  visualCanvas.replaceWith(replacement);
  visualCanvas = replacement;
  renderer = new FallbackRenderer(visualCanvas);
  toast('Modo gráfico compatible activado.');
}
const gameRenderer = new GameRenderer($('game'));
const tracks = [
  { title: 'Neon afterglow', artist: 'Colored Music · Demo original', url: null, demo: true },
];
let selectedTrack = 0,
  selectedScene = 0,
  selectionVersion = 0,
  started = false,
  busy = false,
  muted = false,
  previousVolume = 0.7,
  dirty = true;
let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
try {
  reduced =
    localStorage.getItem('colored-motion') === null
      ? reduced
      : localStorage.getItem('colored-motion') === 'true';
} catch {
  /* Private browsing can disable storage. */
}
$('motion').setAttribute('aria-pressed', String(reduced));
let demoPromise, demoWorker;
function ensureDemo() {
  if (tracks[0].url) return Promise.resolve(tracks[0].url);
  if (!demoPromise)
    demoPromise = new Promise((resolve, reject) => {
      demoWorker = new Worker(new URL('./audio/demo.worker.js', import.meta.url), {
        type: 'module',
      });
      demoWorker.onmessage = ({ data }) => {
        tracks[0].url = URL.createObjectURL(new Blob([data], { type: 'audio/wav' }));
        demoWorker.terminate();
        demoWorker = null;
        resolve(tracks[0].url);
      };
      demoWorker.onerror = () => {
        demoWorker?.terminate();
        demoWorker = null;
        demoPromise = null;
        reject(new Error('No se pudo preparar la demo. Puedes cargar tu propia música.'));
      };
    });
  return demoPromise;
}
function formatTime(time) {
  if (!Number.isFinite(time)) return '0:00';
  return `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
}
function updatePlayback() {
  dirty = true;
  const playing = engine.playing;
  for (const id of ['play', 'immersive-play']) {
    $(id).innerHTML = icon(playing ? 'pause' : 'play');
    $(id).setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
  }
  $('start-hint').hidden = started;
  $('play-status').textContent = busy
    ? 'PREPARANDO AUDIO'
    : playing
      ? 'ESCUCHANDO EN TIEMPO REAL'
      : started
        ? 'EN PAUSA'
        : 'LISTO PARA ESCUCHAR';
  $('live-dot').style.opacity = playing ? '1' : '.45';
}
function updateTrack() {
  const t = tracks[selectedTrack];
  $('track-title').textContent = t.title;
  $('track-artist').textContent = t.artist;
  $('immersive-title').textContent = t.title;
  $('demo-badge').hidden = !t.demo && !t.preview;
  $('demo-badge').textContent = t.preview ? 'FRAGMENTO' : 'DEMO';
  $('track-store').hidden = !t.storeUrl;
  if (t.storeUrl) $('track-store').href = t.storeUrl;
  else $('track-store').removeAttribute('href');
  $('track-count').textContent = tracks.length;
  renderLibrary();
}
function updateProgress() {
  const { currentTime, duration } = engine.media;
  $('elapsed').textContent = formatTime(currentTime);
  $('duration').textContent = formatTime(duration);
  $('seek').max = Number.isFinite(duration) ? duration : 0;
  $('seek').value = currentTime;
  $('seek').style.setProperty(
    '--progress',
    `${Number.isFinite(duration) && duration > 0 ? (currentTime / duration) * 100 : 0}%`,
  );
  $('seek').setAttribute('aria-valuetext', `${formatTime(currentTime)} de ${formatTime(duration)}`);
}
async function selectTrack(index, autoplay = true) {
  const version = ++selectionVersion;
  selectedTrack = (index + tracks.length) % tracks.length;
  engine.pause();
  world.reset();
  updateTrack();
  busy = true;
  updatePlayback();
  try {
    // Resume within the original user gesture, before the worker/file promise.
    const ready = autoplay ? engine.init() : Promise.resolve();
    const track = tracks[selectedTrack];
    const url = track.demo ? await ensureDemo() : track.url;
    await ready;
    if (version !== selectionVersion) return;
    engine.load(url);
    if (autoplay) {
      await engine.play();
      started = true;
    }
  } catch (error) {
    if (version === selectionVersion) {
      engine.pause();
      toast(error.message || 'No se puede reproducir este archivo. Prueba otro formato.');
    }
  } finally {
    if (version === selectionVersion) {
      busy = false;
      updatePlayback();
    }
  }
}
async function togglePlay() {
  if (busy) return;
  if (engine.playing) {
    engine.pause();
    return;
  }
  if (!engine.media.getAttribute('src')) {
    await selectTrack(selectedTrack);
    return;
  }
  try {
    await engine.play();
    started = true;
    updatePlayback();
  } catch {
    toast('No se ha podido reproducir. Comprueba el archivo o carga otra canción.');
  }
}
function renderLibrary() {
  const list = $('library-list');
  list.replaceChildren();
  tracks.forEach((track, index) => {
    const button = document.createElement('button');
    button.className = `library-item${index === selectedTrack ? ' active' : ''}`;
    button.setAttribute('aria-label', `Reproducir ${track.title}`);
    button.innerHTML = icon(index === selectedTrack ? 'wave' : 'play');
    const text = document.createElement('span'),
      title = document.createElement('strong'),
      artist = document.createElement('small');
    title.textContent = track.title;
    artist.textContent =
      track.artist +
      (track.preview ? ' · Fragmento de iTunes' : track.source === 'shared' ? ' · Compartida' : '');
    text.append(title, artist);
    button.append(text);
    button.onclick = () => {
      $('library-dialog').close();
      void selectTrack(index);
    };
    list.append(button);
  });
}
async function addFiles(files) {
  const accepted = [...files].filter(
    (f) =>
      f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|aac|opus|aiff|webm)$/i.test(f.name),
  );
  if (!accepted.length) {
    toast('Selecciona un archivo de audio: MP3, WAV, OGG, M4A…');
    return;
  }
  let first = -1;
  for (const file of accepted) {
    if (file.size > 500 * 1024 * 1024) {
      toast(`${file.name}: el límite por canción es 500 MB.`);
      continue;
    }
    const metadata = await readMetadata(file);
    if (first < 0) first = tracks.length;
    tracks.push({ ...metadata, url: URL.createObjectURL(file), demo: false });
  }
  updateTrack();
  if (first >= 0) await selectTrack(first);
  if (accepted.length !== files.length) toast('Se han omitido los archivos que no son de audio.');
}

let catalogueBusy = false;
async function refreshCatalogue() {
  if (catalogueBusy) return;
  catalogueBusy = true;
  $('library-retry').hidden = true;
  $('library-status').textContent = 'Cargando tu biblioteca compartida…';
  try {
    const shared = await loadCatalogue();
    for (const track of shared) if (!tracks.some((t) => t.id === track.id)) tracks.push(track);
    $('library-status').textContent = shared.length
      ? `${shared.length} canciones de tu biblioteca compartida. También puedes añadir archivos de este equipo.`
      : 'Tu biblioteca compartida está vacía. Puedes añadir archivos de este equipo.';
    updateTrack();
  } catch {
    $('library-status').textContent =
      'No se pudo cargar la biblioteca compartida. La demo y tus archivos locales siguen disponibles.';
    $('library-retry').hidden = false;
  } finally {
    catalogueBusy = false;
  }
}

let searchController,
  searchVersion = 0;
function libraryTab(name) {
  for (const panel of ['collection', 'search']) {
    const active = panel === name;
    $(`tab-${panel}`).setAttribute('aria-selected', String(active));
    $(`tab-${panel}`).tabIndex = active ? 0 : -1;
    $(`panel-${panel}`).hidden = !active;
  }
  if (name === 'search') $('music-query').focus();
}
function renderSearchResults(results) {
  $('search-results').replaceChildren();
  for (const track of results) {
    const row = document.createElement('div');
    row.className = 'search-result';
    const button = document.createElement('button');
    button.className = 'library-item';
    button.setAttribute('aria-label', `Escuchar fragmento de ${track.title}, ${track.artist}`);
    button.innerHTML = icon('play');
    const text = document.createElement('span'),
      title = document.createElement('strong'),
      artist = document.createElement('small');
    title.textContent = track.title;
    artist.textContent = `${track.artist} · Fragmento ≈30 s`;
    text.append(title, artist);
    button.append(text);
    button.onclick = () => {
      let index = tracks.findIndex((t) => t.id === track.id);
      if (index < 0) {
        index = tracks.length;
        tracks.push(track);
      }
      $('library-dialog').close();
      void selectTrack(index);
    };
    const store = document.createElement('a');
    store.href = track.storeUrl;
    store.target = '_blank';
    store.rel = 'noopener noreferrer';
    store.textContent = 'Ver en iTunes ↗';
    store.setAttribute('aria-label', `Ver ${track.title} en iTunes`);
    row.append(button, store);
    $('search-results').append(row);
  }
}
async function runSearch(event) {
  event.preventDefault();
  const query = $('music-query').value.trim();
  if (!query) {
    $('music-query').focus();
    return;
  }
  const version = ++searchVersion;
  searchController?.abort();
  searchController = new AbortController();
  $('search-status').textContent = 'Buscando en iTunes…';
  $('search-results').replaceChildren();
  $('search-results').setAttribute('aria-busy', 'true');
  try {
    const results = await searchMusic(query, searchController.signal);
    if (version !== searchVersion) return;
    renderSearchResults(results);
    $('search-status').textContent = results.length
      ? `${results.length} resultados. Elige un fragmento para escucharlo.`
      : 'No se han encontrado fragmentos. Prueba otro título o artista.';
  } catch (error) {
    if (version === searchVersion && error.name !== 'AbortError')
      $('search-status').textContent = error.message;
  } finally {
    if (version === searchVersion) $('search-results').setAttribute('aria-busy', 'false');
  }
}

// Real snapshots of each scene: no remote artwork or unrelated stock images.
const grid = $('visualizer-grid');
const previewFeatures = emptyFeatures();
previewFeatures.bass = 0.28;
previewFeatures.mid = 0.2;
previewFeatures.high = 0.15;
previewFeatures.energy = 0.25;
for (let i = 0; i < 128; i++)
  previewFeatures.spectrum[i] = Math.max(0, Math.sin(i * 0.13) * 0.3 + 0.38) * 255;
scenes.forEach((scene, index) => {
  const card = document.createElement('button');
  card.className = 'visualizer-card';
  card.setAttribute('aria-pressed', String(index === 0));
  card.setAttribute('aria-label', `${index + 1}. ${scene.name}`);
  card.innerHTML = `<div class="card-art"><canvas width="360" height="180" aria-hidden="true"></canvas><span class="card-number">0${index + 1}</span><span class="card-selected">${icon('check')}</span></div><div class="card-copy"><span class="card-title">${scene.name}${index === 5 ? '<span class="experimental">LAB</span>' : ''}</span><span class="card-description">${scene.tag}</span></div>`;
  card.onclick = () => selectScene(index);
  grid.append(card);
  const ctx = card.querySelector('canvas').getContext('2d');
  if (index < 5) {
    renderer.resize(360, 180);
    renderer.draw(index, 14, previewFeatures);
    ctx.drawImage(visualCanvas, 0, 0, 360, 180);
  } else {
    gameRenderer.resize(360, 180);
    gameRenderer.draw(world, previewFeatures);
    ctx.drawImage($('game'), 0, 0, 360, 180);
  }
});
function selectScene(index) {
  selectedScene = index;
  const scene = scenes[index];
  grid
    .querySelectorAll('button')
    .forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  $('scene-title').textContent = scene.name;
  $('scene-kicker').textContent = scene.kicker;
  $('scene-description').textContent = scene.description;
  $('scene-category').textContent = scene.category;
  $('scene-number').textContent = `0${index + 1} / 06`;
  $('game-hud').hidden = index !== 5;
  $('game').hidden = index !== 5;
  visualCanvas.hidden = index === 5;
  $('stage').classList.toggle('game-mode', index === 5);
  dirty = true;
  $('info-title').textContent = scene.name;
  $('info-description').textContent = scene.info;
  resize();
}
let quality = 1,
  averageFrame = 16,
  frameSamples = 0;
function resize() {
  const { width, height } = $('stage').getBoundingClientRect();
  renderer.resize(width, height, quality);
  gameRenderer.resize(width, height);
  dirty = true;
}
const observer = new ResizeObserver(resize);
observer.observe($('stage'));
selectScene(0);

let last = 0,
  visualTime = 14,
  lastUI = 0,
  frameId;
let latestFeatures = emptyFeatures();
function frame(now) {
  frameId = requestAnimationFrame(frame);
  const raw = last ? (now - last) / 1000 : 1 / 60;
  last = now;
  if (document.hidden) return;
  const dt = Math.min(raw, 0.05),
    f = engine.read();
  latestFeatures = f;
  if (engine.playing) {
    if (f.rms > 0.0015) visualTime += dt * (0.22 + f.energy * 1.8) * (reduced ? 0.25 : 1);
    if (selectedScene === 5) world.update(dt, f);
  }
  // A paused scene is stable. Silence has no fake beats or synthetic spectrum.
  if (engine.playing || dirty) {
    if (selectedScene === 5) {
      gameRenderer.draw(world, f, reduced);
      for (const [id, pulse] of [
        ['jump-cue', world.hero.accent],
        ['collect-cue', world.magnet],
        ['sparkle-cue', world.shimmer],
      ]) {
        $(id).style.setProperty('--cue', pulse);
      }
    } else renderer.draw(selectedScene, visualTime, f, reduced, engine.media.currentTime);
    dirty = false;
  }
  if (now - lastUI > 90) {
    lastUI = now;
    for (const [id, band] of [
      ['bass-meter', 'bass'],
      ['mid-meter', 'mid'],
      ['high-meter', 'high'],
    ])
      $(id).style.transform = `scaleX(${f[band]})`;
    if (selectedScene === 5) {
      $('game-action').textContent = world.action;
      $('game-reason').textContent = world.reason;
      $('game-combo').textContent = world.collected;
      $('game-jumps').textContent = world.jumpCount;
    }
  }
  if (engine.playing && raw < 0.2) {
    averageFrame = averageFrame * 0.98 + raw * 1000 * 0.02;
    frameSamples++;
    if (frameSamples > 150 && averageFrame > 26 && quality > 0.6) {
      quality = Math.max(0.6, quality - 0.15);
      frameSamples = 0;
      resize();
    }
  }
}
frameId = requestAnimationFrame(frame);
document.addEventListener('visibilitychange', () => {
  last = 0;
  engine.detector?.reset();
});

for (const event of ['play', 'pause', 'playing', 'ended'])
  engine.addEventListener(event, updatePlayback);
engine.addEventListener('timeupdate', updateProgress);
engine.addEventListener('loadedmetadata', updateProgress);
engine.addEventListener('durationchange', updateProgress);
engine.addEventListener('error', () => {
  engine.pause();
  busy = false;
  updatePlayback();
  toast('No se puede decodificar esta canción. Prueba otro archivo o formato.');
});
engine.addEventListener('waiting', () => {
  $('play-status').textContent = 'CARGANDO AUDIO';
});
engine.addEventListener('ended', () => {
  if (!engine.media.loop && selectedTrack < tracks.length - 1) void selectTrack(selectedTrack + 1);
  else {
    $('play-status').textContent = 'CANCIÓN TERMINADA';
  }
});
for (const id of ['play', 'start', 'immersive-play']) $(id).onclick = togglePlay;
$('previous').onclick = () => {
  if (engine.media.currentTime > 3) {
    engine.media.currentTime = 0;
    world.reset();
  } else void selectTrack(selectedTrack - 1);
};
$('next').onclick = () => void selectTrack(selectedTrack + 1);
$('seek').oninput = () => {
  if (Number.isFinite(engine.media.duration)) {
    engine.media.currentTime = Number($('seek').value);
    engine.detector?.reset();
    world.reset();
    updateProgress();
  }
};
function setVolume(value) {
  engine.setVolume(value);
  $('volume').value = value;
  $('volume').style.setProperty('--progress', `${value * 100}%`);
  $('volume-value').textContent = `${Math.round(value * 100)}%`;
  $('mute').innerHTML = icon(value === 0 ? 'mute' : 'volume');
  $('mute').setAttribute('aria-label', value === 0 ? 'Activar sonido' : 'Silenciar');
  muted = value === 0;
}
$('volume').oninput = () => {
  const value = Number($('volume').value);
  if (value > 0) previousVolume = value;
  setVolume(value);
};
$('mute').onclick = () => {
  if (muted) setVolume(previousVolume || 0.7);
  else {
    previousVolume = engine.volume;
    setVolume(0);
  }
};
$('loop').onclick = () => {
  engine.media.loop = !engine.media.loop;
  $('loop').setAttribute('aria-pressed', String(engine.media.loop));
};
$('motion').onclick = () => {
  reduced = !reduced;
  $('motion').setAttribute('aria-pressed', String(reduced));
  try {
    localStorage.setItem('colored-motion', String(reduced));
  } catch {}
};
for (const id of ['upload', 'library-upload'])
  $(id).onclick = () => {
    $('library-dialog').close();
    $('file-input').click();
  };
$('file-input').onchange = (event) => {
  void addFiles(event.target.files);
  event.target.value = '';
};
$('library-open').onclick = () => {
  $('library-dialog').showModal();
};
$('library-retry').onclick = refreshCatalogue;
$('music-search').onsubmit = runSearch;
for (const [index, name] of ['collection', 'search'].entries()) {
  const tab = $(`tab-${name}`);
  tab.onclick = () => libraryTab(name);
  tab.onkeydown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const target =
      event.key === 'Home'
        ? 'collection'
        : event.key === 'End'
          ? 'search'
          : ['search', 'collection'][index];
    libraryTab(target);
    $(`tab-${target}`).focus();
  };
}
$('library-dialog').addEventListener('close', () => {
  searchVersion++;
  searchController?.abort();
  if ($('search-results').getAttribute('aria-busy') === 'true') {
    $('search-status').textContent = 'Búsqueda cancelada. Puedes volver a buscar.';
    $('search-results').setAttribute('aria-busy', 'false');
  }
});
$('info').onclick = () => {
  $('info-dialog').showModal();
};
document
  .querySelectorAll('.close-dialog')
  .forEach((button) => (button.onclick = () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach((dialog) =>
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        dialog.close();
    }
  }),
);
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('stage').requestFullscreen) await $('stage').requestFullscreen();
    else toast('Este navegador no admite pantalla completa.');
  } catch {
    toast('No se ha podido activar la pantalla completa.');
  }
}
$('fullscreen').onclick = fullscreen;
$('exit-fullscreen').onclick = fullscreen;
document.addEventListener('fullscreenchange', () => {
  $('fullscreen').setAttribute(
    'aria-label',
    document.fullscreenElement ? 'Salir de pantalla completa' : 'Pantalla completa',
  );
  resize();
});
document.addEventListener('keydown', (event) => {
  if (
    event.target.closest('input,textarea,select,button,dialog') ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.repeat ||
    document.querySelector('dialog[open]')
  )
    return;
  if (event.code === 'Space') {
    event.preventDefault();
    void togglePlay();
  } else if (/^[1-6]$/.test(event.key)) selectScene(Number(event.key) - 1);
  else if (event.key.toLowerCase() === 'f') void fullscreen();
  else if (event.key.toLowerCase() === 'm') $('mute').click();
});
let dragDepth = 0;
document.addEventListener('dragenter', (e) => {
  if (e.dataTransfer.types.includes('Files')) {
    e.preventDefault();
    dragDepth++;
    $('drop-overlay').hidden = false;
  }
});
document.addEventListener('dragover', (e) => {
  if (e.dataTransfer.types.includes('Files')) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
});
document.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) $('drop-overlay').hidden = true;
});
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('drop-overlay').hidden = true;
  if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
});
window.addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  cancelAnimationFrame(frameId);
  observer.disconnect();
  renderer.dispose();
  engine.dispose();
  demoWorker?.terminate();
  searchController?.abort();
  for (const t of tracks) if (t.url?.startsWith('blob:')) URL.revokeObjectURL(t.url);
});
renderLibrary();
updatePlayback();
// Prepare the original demo without opening an AudioContext or starting playback.
void ensureDemo().catch((error) => toast(error.message));
void refreshCatalogue();

// Read-only instrumentation, opt-in and excluded from production by Vite.
// Reading it never performs a second analyser sample or changes the simulation.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('debug')) {
  window.__coloredMusicDebug = () => ({
    audioTime: engine.media.currentTime,
    features: { ...latestFeatures, spectrum: undefined, waveform: undefined },
    gameTime: world.time,
    x: world.hero.x,
    y: world.hero.y,
    vy: world.hero.vy,
    state: world.hero.state,
    events: world.events.map((event) => ({ ...event })),
    beats: world.beats,
    jumps: world.jumpCount,
    collected: world.collected,
    airCollected: world.airCollected,
    grounded: world.hero.grounded,
    stardustWaves: renderer.stardustPulse?.count || 0,
  });
}
