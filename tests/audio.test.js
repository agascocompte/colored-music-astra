import test from 'node:test';
import assert from 'node:assert/strict';
import { FeatureExtractor } from '../src/audio/features.js';

function frame(rate, hz, level = 0.15) {
  const db = new Float32Array(1024).fill(-100),
    wave = new Float32Array(2048);
  const bin = Math.round((hz * 2048) / rate);
  for (let i = Math.max(1, bin - 2); i <= Math.min(1023, bin + 2); i++) db[i] = -18;
  for (let i = 0; i < wave.length; i++) wave[i] = Math.sin((i * 2 * Math.PI * hz) / rate) * level;
  return { db, wave };
}
test('Silence never generates musical events or residual spectrum', () => {
  const a = new FeatureExtractor();
  for (let i = 0; i < 600; i++) {
    const f = a.process(new Float32Array(1024).fill(-Infinity), new Float32Array(2048), i / 60);
    assert.equal(f.beat, false);
    assert.equal(f.onset, false);
    assert.equal(f.energy, 0);
    assert.equal(
      f.spectrum.some((v) => v > 0),
      false,
    );
  }
});
test('RMS and frequency bands follow Hz at both 44.1 and 48 kHz', () => {
  for (const rate of [44100, 48000])
    for (const [hz, band] of [
      [100, 'bass'],
      [1000, 'mid'],
      [8000, 'high'],
    ]) {
      const a = new FeatureExtractor(rate),
        { db, wave } = frame(rate, hz);
      let f;
      for (let i = 0; i < 90; i++) f = a.process(db, wave, i / 60);
      assert.ok(Math.abs(f.rms - 0.15 / Math.sqrt(2)) < 0.002);
      for (const other of ['bass', 'mid', 'high'].filter((b) => b !== band))
        assert.ok(f[band] > f[other]);
    }
});
test('A sustained tone is not repeatedly interpreted as a beat', () => {
  const a = new FeatureExtractor(),
    { db, wave } = frame(48000, 100);
  let beats = 0;
  for (let i = 0; i < 600; i++) {
    const f = a.process(db, wave, i / 60);
    beats += Number(f.beat);
  }
  assert.ok(beats <= 1);
});
test('120 BPM transients produce bounded events and an approximate tempo', () => {
  const a = new FeatureExtractor();
  const hit = frame(48000, 100, 0.4),
    quiet = { db: new Float32Array(1024).fill(-100), wave: new Float32Array(2048) };
  let beats = 0,
    tempo = 0;
  for (let i = 0; i < 900; i++) {
    const source = i % 30 < 4 ? hit : quiet;
    const f = a.process(source.db, source.wave, i / 60);
    if (f.beat) beats++;
    tempo = f.bpm;
  }
  assert.ok(beats >= 25 && beats <= 30, `detected ${beats}`);
  assert.ok(Math.abs(tempo - 120) < 3, `tempo ${tempo}`);
  a.reset();
  assert.equal(a.features.beatCount, 0);
  assert.equal(a.features.impact, 0);
});

test('Quiet upper-band attacks remain detectable underneath a sustained bass', () => {
  const a = new FeatureExtractor(),
    { db, wave } = frame(48000, 100, 0.3);
  let midHits = 0,
    highHits = 0;
  for (let i = 0; i < 600; i++) {
    const input = db.slice();
    if (i % 30 < 3) for (let j = 35; j < 65; j++) input[j] = -44;
    if (i % 15 < 2) for (let j = 180; j < 290; j++) input[j] = -50;
    const f = a.process(input, wave, i / 60);
    midHits += Number(f.midHit);
    highHits += Number(f.highHit);
  }
  assert.ok(midHits >= 17, 'midrange attacks survive bass masking');
  assert.ok(highHits >= 33, 'treble attacks survive bass masking');
});
