import test from 'node:test';
import assert from 'node:assert/strict';
import { StardustPulse } from '../src/visuals/stardust-pulse.js';
import { emptyFeatures } from '../src/audio/features.js';

const hit = (beatCount) => ({
  ...emptyFeatures(),
  beat: true,
  beatCount,
  rms: 0.15,
  lowHit: true,
  impact: 0.9,
});

test('Dense attacks produce at most one wave per 1.4 seconds, on the accepted beat', () => {
  const pulse = new StardustPulse();
  const times = [];
  for (let i = 0; i < 40; i++) {
    const before = pulse.count;
    pulse.update(i * 0.25, hit(i + 1));
    if (pulse.count > before) {
      times.push(i * 0.25);
      assert.equal(pulse.age, 0);
    }
  }
  assert.ok(times.length > 3 && times.length < 9);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 1.4);
});

test('Weak attacks, repeat draws and silence never create delayed or extra waves', () => {
  const pulse = new StardustPulse();
  pulse.update(0, hit(1));
  pulse.update(0.25, hit(2));
  pulse.update(2, hit(2));
  pulse.update(3, { ...hit(3), impact: 0.6 });
  pulse.update(4, { ...hit(4), lowHit: false, impact: 0.8 });
  pulse.update(5, emptyFeatures());
  assert.equal(pulse.count, 1);
  assert.equal(pulse.age, 5);
  pulse.update(6, { ...hit(5), lowHit: false, impact: 1 });
  assert.equal(pulse.count, 2);
  assert.equal(pulse.age, 0);
  pulse.update(6, emptyFeatures());
  assert.equal(pulse.age, 0, 'paused media time freezes the ring');
});

test('Seeking back or restarting the detector clears the old wave spacing', () => {
  const pulse = new StardustPulse();
  pulse.update(10, hit(20));
  pulse.update(2, emptyFeatures());
  assert.equal(pulse.strength, 0);
  pulse.update(2.1, hit(1));
  assert.equal(pulse.count, 1);
  pulse.update(2.2, hit(0));
  assert.equal(pulse.count, 1);
  assert.equal(pulse.age, 0);
});
