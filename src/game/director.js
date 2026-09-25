import { clamp } from '../audio/features.js';
export const FLOOR_Y = 350;
export const JUMP_SPACING = 0.95;
export const terrainHash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** A musical collecting run. Only a fresh, prominent beat can start a jump.
 * Airborne/closely spaced beats illuminate the world instead of restarting the
 * arc. No queued jump fires later, so accepted jumps stay on the actual sound. */
export class BeatWorld {
  constructor() {
    this.reset();
  }
  reset() {
    this.time = this.camera = this.distance = 0;
    this.platforms = [{ id: 0, x: -200, w: 580, y: FLOOR_Y }];
    this.particles = [];
    this.rings = [];
    this.orbs = [];
    this.events = [];
    this.collected = this.airCollected = this.beats = this.jumpCount = 0;
    this.flash = this.magnet = this.shimmer = this.pickup = 0;
    this.lastJump = -10;
    this.lastLanding = -10;
    this.nextNoteX = 140;
    this.hero = {
      x: 100,
      y: FLOOR_Y,
      vy: 0,
      vx: 0,
      grounded: true,
      state: 'idle',
      facing: 1,
      step: 0,
      land: 0,
      accent: 0,
      hop: null,
    };
    this.action = 'Escuchando';
    this.reason = 'Un camino de notas por descubrir';
    this.generate();
  }
  generate() {
    while (this.platforms.at(-1).x < this.hero.x + 2200) {
      const prev = this.platforms.at(-1),
        id = prev.id + 1;
      this.platforms.push({ id, x: prev.x + prev.w, w: 420, y: FLOOR_Y });
    }
    // Both trails exist ahead of the character, independently of jump timing.
    // The low trail is walkable; the upper arches reward musical jumps.
    while (this.nextNoteX < this.hero.x + 2200) {
      const x = this.nextNoteX,
        phase = Math.floor(x / 52) % 8;
      this.orbs.push({ x, y: FLOOR_Y - 22, taken: false, upper: false, attracted: false });
      if (phase < 5)
        this.orbs.push({
          x,
          y: FLOOR_Y - 62 - Math.sin((phase / 4) * Math.PI) * 54,
          taken: false,
          upper: true,
          attracted: false,
        });
      this.nextNoteX += 52;
    }
    this.platforms = this.platforms.filter((p) => p.x + p.w > this.hero.x - 1100);
    this.orbs = this.orbs.filter((o) => !o.taken && o.x > this.hero.x - 180);
  }
  emit(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const a = i * 2.39996,
        speed = 25 + terrainHash(i + this.time) * 70;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 25,
        life: 0.45 + terrainHash(i) * 0.3,
        max: 0.75,
        color,
      });
    }
    if (this.particles.length > 180) this.particles.splice(0, this.particles.length - 180);
  }
  jump(f) {
    const h = this.hero;
    const duration = 0.58 + clamp(f.energy) * 0.08,
      height = 52 + clamp(f.bass) * 40;
    h.hop = { elapsed: 0, duration, height };
    h.grounded = false;
    h.accent = 1;
    h.land = 0;
    this.jumpCount++;
    this.lastJump = this.time;
    this.action = 'Salto musical';
    this.reason = 'Golpe marcado → salto hacia las notas';
    this.events.push({ time: this.time, action: this.action, kind: 'jump', signal: 'music' });
    if (this.events.length > 120) this.events.shift();
    this.rings.push({ x: h.x, y: FLOOR_Y, r: 6, life: 0.45 });
    this.emit(h.x, h.y, '#79ffe0', 9);
  }
  update(dt, f) {
    if (dt <= 0) return;
    this.time += dt;
    const h = this.hero,
      audible = f.rms > 0.0015;
    h.land *= Math.exp(-dt * 14);
    h.accent *= Math.exp(-dt * 9);
    this.flash *= Math.exp(-dt * 7);
    this.magnet *= Math.exp(-dt * 5);
    this.shimmer *= Math.exp(-dt * 10);
    this.pickup *= Math.exp(-dt * 6);
    if (audible && f.midHit) this.magnet = 1;
    if (audible && f.highHit) this.shimmer = 1;
    if (audible && f.beat) {
      this.beats++;
      this.flash = 0.15 + clamp(f.rise) * 0.3;
      const prominent = f.lowHit || f.impact >= 0.78;
      if (
        prominent &&
        h.grounded &&
        this.time - this.lastJump >= JUMP_SPACING &&
        this.time - this.lastLanding >= 0.22
      )
        this.jump(f);
    }
    // Smooth intensity-driven running avoids a start/stop jerk on every hat.
    const speed = audible ? 145 + clamp(f.energy) * 110 : 0;
    h.vx += (speed - h.vx) * (1 - Math.exp(-dt / 0.35));
    if (!audible && h.vx < 0.1) h.vx = 0;
    h.x += h.vx * dt;
    if (h.hop) {
      const hop = h.hop;
      hop.elapsed = Math.min(hop.duration, hop.elapsed + dt);
      const u = hop.elapsed / hop.duration;
      h.y = FLOOR_Y - 4 * hop.height * u * (1 - u);
      h.vy = (-4 * hop.height * (1 - 2 * u)) / hop.duration;
      if (u >= 1) {
        h.y = FLOOR_Y;
        h.vy = 0;
        h.grounded = true;
        h.hop = null;
        h.land = 1;
        this.lastLanding = this.time;
        this.emit(h.x, h.y, '#8ce9dd', 5);
      }
    }
    h.state = !h.grounded ? 'jump' : h.vx > 100 ? 'run' : h.vx > 5 ? 'walk' : 'idle';
    if (h.grounded) {
      this.action = audible ? 'Recogiendo notas' : 'Escuchando';
      this.reason = audible
        ? 'Los medios acercan las notas · los agudos las iluminan'
        : 'Un camino de notas por descubrir';
    }
    for (const o of this.orbs) {
      const dx = h.x - o.x,
        dy = h.y - 22 - o.y,
        distance = Math.hypot(dx, dy);
      // A local attraction, never a remote or automatic score increment.
      if (audible && this.magnet > 0.3 && distance < 66) o.attracted = true;
      if (o.attracted) {
        const follow = 1 - Math.exp(-dt * 14);
        o.x += dx * follow;
        o.y += dy * follow;
      }
      if (!o.taken && Math.hypot(o.x - h.x, o.y - h.y + 22) < 19) {
        o.taken = true;
        this.collected++;
        if (o.upper) this.airCollected++;
        this.pickup = 1;
        this.emit(o.x, o.y, o.upper ? '#ffd29e' : '#d9efa2', 3);
      }
    }
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const r of this.rings) {
      r.r += 170 * dt;
      r.life -= dt;
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    h.step += Math.abs(h.vx) * dt * 0.055;
    this.distance = Math.max(this.distance, h.x - 100);
    this.camera += (h.x - 100 - this.camera) * (1 - Math.exp(-dt * 8));
    this.generate();
  }
}
