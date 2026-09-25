/** Sparse accents for Stardust only; stars still consume the full audio signal.
 * Media time keeps spacing independent of energy, rendering rate and pauses. */
export class StardustPulse {
  constructor() {
    this.reset();
  }
  reset() {
    this.lastTime = -Infinity;
    this.lastPulse = -Infinity;
    this.lastBeatCount = -1;
    this.age = 10;
    this.strength = 0;
    this.count = 0;
  }
  update(time, f) {
    if (time < this.lastTime || (f.beat && f.beatCount < this.lastBeatCount)) this.reset();
    this.lastTime = time;
    if (f.beat && f.beatCount !== this.lastBeatCount && f.rms > 0.0015) {
      this.lastBeatCount = f.beatCount;
      const prominent = f.impact >= 0.78 && (f.lowHit || f.rise > 0.12 || f.impact >= 0.92);
      // Discard intermediate attacks; never queue a wave for a later instant.
      if (prominent && time - this.lastPulse >= 1.4) {
        this.lastPulse = time;
        this.strength = Math.min(1, f.impact);
        this.count++;
      }
    }
    this.age = Math.min(10, Math.max(0, time - this.lastPulse));
  }
}
