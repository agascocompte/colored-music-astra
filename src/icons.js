const paths = {
  play: '<path d="m9 5 11 7-11 7Z"/>',
  pause: '<path d="M8 5h2v14H8zM15 5h2v14h-2z"/>',
  previous: '<path d="M6 5v14M19 5l-10 7 10 7Z"/>',
  next: '<path d="M18 5v14M5 5l10 7-10 7Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  volume: '<path d="m11 5-5 4H3v6h3l5 4ZM15 8q5 4 0 8M18 5q8 7 0 14"/>',
  mute: '<path d="m11 5-5 4H3v6h3l5 4ZM16 9l6 6m0-6-6 6"/>',
  repeat: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  library: '<path d="M4 4v16M9 4v16m5-15 5 14M3 4h2m3 0h2"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  wave: '<path d="M3 10v4m4-8v12m5-16v20m5-16v12m4-8v4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};
export const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.wave}</svg>`;
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
}
