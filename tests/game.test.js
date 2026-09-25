import test from 'node:test';
import assert from 'node:assert/strict';
import { BeatWorld, FLOOR_Y, JUMP_SPACING } from '../src/game/director.js';
import { emptyFeatures } from '../src/audio/features.js';
const music = () => ({ ...emptyFeatures(), rms: 0.15, bass: 0.7, energy: 0.5 });
const hit = () => ({ ...music(), beat: true, lowHit: true, impact: 0.9 });

test('Dense beats leave running time and bounded trajectories at 30/60/120 fps', () => {
  for (const fps of [30, 60, 120]) {
    const world = new BeatWorld();
    let beats = 0,
      grounded = 0;
    for (let i = 0; i < 240 * fps; i++) {
      const f = music();
      f.beat = i % Math.round(fps * 0.25) === 0;
      f.lowHit = f.beat;
      f.midHit = i % 12 === 0;
      f.highHit = i % 5 === 0;
      if (f.beat) beats++;
      const before = world.jumpCount;
      world.update(1 / fps, f);
      if (world.jumpCount > before) {
        assert.equal(f.beat, true, 'jump starts on this audio event, never a timer');
        assert.equal(world.events.at(-1).time, world.time);
        assert.ok(world.hero.vy < 0);
      }
      if (world.hero.grounded) grounded++;
      assert.ok(world.hero.y <= FLOOR_Y && world.hero.y >= FLOOR_Y - 92);
      assert.ok(world.particles.length <= 180 && world.orbs.length < 100);
      assert.ok(world.platforms.length < 20);
      for (let j = 1; j < world.platforms.length; j++)
        assert.equal(world.platforms[j - 1].x + world.platforms[j - 1].w, world.platforms[j].x);
    }
    assert.ok(world.jumpCount < beats * 0.4);
    assert.ok(world.jumpCount > 100);
    assert.ok(grounded / (240 * fps) > 0.3, 'at least 30% of dense music remains on the ground');
    assert.ok(world.collected > 100 && world.airCollected > 20);
    for (let i = 1; i < world.events.length; i++)
      assert.ok(world.events[i].time - world.events[i - 1].time >= JUMP_SPACING - 1e-9);
  }
});

test('Airborne hits cannot restart a jump, and discarded hits never queue a later jump', () => {
  const world = new BeatWorld();
  world.update(1 / 60, hit());
  const hop = world.hero.hop;
  for (let i = 0; i < 20; i++) world.update(1 / 60, hit());
  assert.equal(world.hero.hop, hop);
  assert.equal(world.jumpCount, 1);
  for (let i = 0; i < 180; i++) world.update(1 / 60, music());
  assert.equal(world.jumpCount, 1);
  assert.equal(world.hero.grounded, true);
  world.update(1 / 60, hit());
  assert.equal(world.jumpCount, 2);
});

test('Weak accents and upper-band attacks affect scenery without jumping', () => {
  const world = new BeatWorld();
  for (let i = 0; i < 300; i++)
    world.update(1 / 60, {
      ...music(),
      beat: i % 30 === 0,
      midHit: true,
      highHit: true,
      impact: 0.6,
    });
  assert.equal(world.jumpCount, 0);
  assert.equal(world.hero.grounded, true);
  assert.equal(world.magnet, 1);
  assert.equal(world.shimmer, 1);
  assert.equal(world.events.length, 0);
  world.update(1 / 60, { ...music(), beat: true, impact: 0.9 });
  assert.equal(world.jumpCount, 1, 'prominent broadband beat also works without a low hit');
});

test('Only nearby collected notes score; mid attacks draw nearby notes towards the hero', () => {
  const world = new BeatWorld();
  world.orbs = [
    { x: 145, y: FLOOR_Y - 22, upper: true, taken: false, attracted: false },
    { x: 1000, y: FLOOR_Y - 100, upper: true, taken: false, attracted: false },
  ];
  const near = world.orbs[0],
    far = world.orbs[1];
  world.update(1 / 60, { ...music(), midHit: true });
  assert.equal(near.attracted, true);
  assert.ok(near.x < 145);
  assert.equal(far.x, 1000);
  for (let i = 0; i < 12; i++) world.update(1 / 60, emptyFeatures());
  assert.equal(world.collected, 1);
  assert.equal(world.airCollected, 1);
  assert.equal(far.taken, false);
});

test('Silence stops travel and a jump already in progress lands without further jumps', () => {
  const world = new BeatWorld();
  for (let i = 0; i < 300; i++) world.update(1 / 60, emptyFeatures());
  assert.equal(world.hero.x, 100);
  world.update(1 / 60, hit());
  for (let i = 0; i < 300; i++) world.update(1 / 60, emptyFeatures());
  assert.equal(world.jumpCount, 1);
  assert.equal(world.hero.y, FLOOR_Y);
  assert.equal(world.hero.vx, 0);
});

test('Moving sparse musical hits shifts jump timing by the same amount', () => {
  const run = (offset) => {
    const world = new BeatWorld();
    for (let i = 0; i < 600; i++)
      world.update(1 / 60, i >= offset && (i - offset) % 75 === 0 ? hit() : music());
    return world.events;
  };
  const a = run(0),
    b = run(15);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) assert.ok(Math.abs(b[i].time - a[i].time - 0.25) < 1e-9);
});

test('Pause freezes collection and motion; reset clears progress', () => {
  const world = new BeatWorld();
  world.update(1 / 60, hit());
  const before = JSON.stringify(world);
  world.update(0, hit());
  assert.equal(JSON.stringify(world), before);
  world.reset();
  assert.equal(world.jumpCount + world.collected, 0);
  assert.equal(world.hero.y, FLOOR_Y);
});
