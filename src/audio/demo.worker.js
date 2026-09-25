// Original 96-second electronic composition, rendered off the UI thread.
// It goes through exactly the same media element and analyser as user tracks.
const rate = 24000,
  seconds = 96,
  length = rate * seconds;
const buffer = new ArrayBuffer(44 + length * 2),
  view = new DataView(buffer);
function string(offset, s) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}
string(0, 'RIFF');
view.setUint32(4, 36 + length * 2, true);
string(8, 'WAVE');
string(12, 'fmt ');
view.setUint32(16, 16, true);
view.setUint16(20, 1, true);
view.setUint16(22, 1, true);
view.setUint32(24, rate, true);
view.setUint32(28, rate * 2, true);
view.setUint16(32, 2, true);
view.setUint16(34, 16, true);
string(36, 'data');
view.setUint32(40, length * 2, true);
const tau = Math.PI * 2,
  roots = [55, 65.406, 43.654, 49],
  melody = [0, 7, 12, 15, 19, 12, 7, 10];
let seed = 1492,
  previousNoise = 0;
for (let i = 0; i < length; i++) {
  const t = i / rate,
    beat = t / 0.5,
    bar = Math.floor(beat / 4),
    phase = t % 0.5,
    half = t % 0.25;
  const section = Math.floor(t / 16),
    quiet = section === 2 || section === 4;
  const root = roots[Math.floor(bar / 2) % 4],
    freq = root * 4 * Math.pow(2, melody[Math.floor(beat * 2) % 8] / 12);
  seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
  const noise = (seed >>> 0) / 2147483648 - 1;
  const hp = noise - previousNoise;
  previousNoise = noise;
  const kick =
    Math.sin(tau * (47 * phase + 11 * (1 - Math.exp(-phase * 35)))) * Math.exp(-phase * 16) * 0.62;
  const snare =
    bar >= 2 && Math.floor(beat) % 2 === 1
      ? (noise * 0.23 + Math.sin(tau * 175 * phase) * 0.12) * Math.exp(-phase * 27)
      : 0;
  const hat = hp * Math.exp(-half * 100) * 0.08;
  const bass =
    (Math.sin(tau * root * t) + 0.28 * Math.sin(tau * root * 2 * t)) * Math.exp(-phase * 5) * 0.17;
  const pluck =
    (Math.sin(tau * freq * t) + 0.24 * Math.sin(tau * freq * 2 * t)) *
    Math.exp(-half * (quiet ? 10 : 17)) *
    0.115;
  const pad =
    (Math.sin(tau * root * 2 * t) +
      Math.sin(tau * root * 2 * 1.4983 * t) +
      Math.sin(tau * root * 2 * 1.1892 * t)) *
    0.025 *
    (0.6 + 0.4 * Math.sin(t * 0.4));
  const drums = quiet ? (section === 4 ? kick * 0.4 + hat * 0.3 : hat * 0.25) : kick + snare + hat;
  const fade = Math.min(1, t / 0.04, (seconds - t) / 3);
  const sample = Math.tanh((drums + bass * (quiet ? 0.5 : 1) + pluck + pad) * 1.3) * 0.78 * fade;
  view.setInt16(44 + i * 2, Math.max(-32767, Math.min(32767, sample * 32767)), true);
}
self.postMessage(buffer, [buffer]);
