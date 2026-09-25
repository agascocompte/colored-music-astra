export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export function emptyFeatures() {
  return {
    rms: 0,
    bass: 0,
    mid: 0,
    high: 0,
    energy: 0,
    flux: 0,
    beat: false,
    onset: false,
    lowHit: false,
    midHit: false,
    highHit: false,
    punch: 0,
    snap: 0,
    sparkle: 0,
    impact: 0,
    rise: 0,
    bpm: 0,
    beatCount: 0,
    beatAge: 10,
    spectrum: new Uint8Array(128),
    waveform: new Float32Array(256),
  };
}

/** One shared detector. Hz boundaries follow the actual AudioContext sample rate.
 * Flux uses unsmoothed magnitudes; envelopes use time-correct attack/release.
 * Beat is a one-frame event, impact is its decaying visual envelope. */
export class FeatureExtractor {
  constructor(sampleRate = 48000, fftSize = 2048) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    this.reset();
  }
  reset() {
    this.features = emptyFeatures();
    this.previous = new Float32Array(this.fftSize / 2);
    this.meanFlux = 0.002;
    this.variance = 0.00001;
    this.slowEnergy = 0;
    this.lastBeat = -10;
    this.lastOnset = -10;
    this.lastTime = null;
    this.intervals = [];
    this.warmup = 0;
    this.bandHistory = Array.from({ length: 3 }, () => ({
      mean: 0.01,
      variance: 0.001,
      level: 0,
      lastHit: -10,
    }));
  }
  process(db, waveform, time, sensitivity = 1) {
    const dt = this.lastTime === null ? 1 / 60 : clamp(time - this.lastTime, 0.001, 0.1);
    this.lastTime = time;
    this.warmup += dt;
    const f = this.features;
    let square = 0;
    for (const v of waveform) square += v * v;
    const rms = Math.sqrt(square / waveform.length);
    const bandFlux = [0, 0, 0],
      bandLevel = [0, 0, 0];
    let flux = 0,
      bass = 0,
      mid = 0,
      high = 0,
      bc = 0,
      mc = 0,
      hc = 0;
    for (let i = 0; i < db.length; i++) {
      const magnitude = Number.isFinite(db[i]) ? Math.pow(10, db[i] / 20) : 0;
      const hz = (i * this.sampleRate) / this.fftSize;
      const bandId =
        hz >= 35 && hz < 250 ? 0 : hz >= 250 && hz < 2500 ? 1 : hz >= 2500 && hz < 14000 ? 2 : -1;
      if (bandId >= 0) {
        bandFlux[bandId] += Math.max(0, magnitude - this.previous[i]);
        bandLevel[bandId] += magnitude;
      }
      if (hz >= 20 && hz < 16000) flux += Math.max(0, magnitude - this.previous[i]);
      this.previous[i] = magnitude;
      const value = clamp((db[i] + 85) / 65);
      if (hz >= 20 && hz < 250) {
        bass += value;
        bc++;
      } else if (hz >= 250 && hz < 4000) {
        mid += value;
        mc++;
      } else if (hz >= 4000 && hz < 16000) {
        high += value;
        hc++;
      }
    }
    flux /= Math.max(1, db.length / 32);
    const audible = rms > 0.0015;
    // Per-band novelty is normalized against that band's recent level. A quiet
    // snare/hat must not disappear underneath a loud, sustained bass note.
    const hits = this.bandHistory.map((history, index) => {
      const novelty = bandFlux[index] / Math.max(0.008, history.level, bandLevel[index] * 0.5);
      const gate = Math.max(0.22, history.mean + Math.sqrt(history.variance) * 1.1);
      const hit =
        audible &&
        bandLevel[index] > 0.008 &&
        novelty > gate &&
        time - history.lastHit > (index === 2 ? 0.1 : 0.18) &&
        this.warmup > 0.08;
      if (hit) history.lastHit = time;
      const adapt = 1 - Math.exp(-dt / 1.1),
        delta = novelty - history.mean;
      history.mean += delta * adapt;
      history.variance += (delta * delta - history.variance) * adapt;
      history.level += (bandLevel[index] - history.level) * (1 - Math.exp(-dt / 0.5));
      return hit;
    });
    [f.lowHit, f.midHit, f.highHit] = hits;
    for (const [index, name] of ['punch', 'snap', 'sparkle'].entries()) {
      f[name] = hits[index] ? 1 : f[name] * Math.exp(-dt * [11, 15, 22][index]);
    }
    const threshold =
      Math.max(0.0018, this.meanFlux + 1.5 * Math.sqrt(this.variance)) / sensitivity;
    f.onset =
      audible &&
      (flux > threshold || hits.some(Boolean)) &&
      time - this.lastOnset > 0.1 &&
      this.warmup > 0.08;
    if (f.onset) this.lastOnset = time;
    const rawBass = bass / Math.max(1, bc);
    f.beat =
      audible &&
      time - this.lastBeat > 0.24 &&
      (f.lowHit || f.midHit || (f.onset && flux > threshold && rawBass > 0.15));
    if (f.beat) {
      const interval = time - this.lastBeat;
      if (interval > 0.28 && interval < 1.2) {
        this.intervals.push(interval);
        if (this.intervals.length > 12) this.intervals.shift();
      }
      if (this.intervals.length >= 4) {
        const sorted = [...this.intervals].sort((a, b) => a - b);
        f.bpm = Math.round(60 / sorted[Math.floor(sorted.length / 2)]);
      }
      this.lastBeat = time;
      f.beatCount++;
      f.impact = clamp(0.45 + (flux / Math.max(0.005, threshold)) * 0.2);
    } else f.impact *= Math.exp(-dt * 6);
    f.beatAge = Math.min(10, time - this.lastBeat);
    const adapt = 1 - Math.exp(-dt / 1.2);
    const delta = flux - this.meanFlux;
    this.meanFlux += delta * adapt;
    this.variance += (delta * delta - this.variance) * adapt;
    const envelope = (current, target) =>
      current + (target - current) * (1 - Math.exp(-dt / (target > current ? 0.035 : 0.18)));
    f.rms = rms;
    f.bass = envelope(f.bass, audible ? rawBass : 0);
    f.mid = envelope(f.mid, audible ? mid / Math.max(1, mc) : 0);
    f.high = envelope(f.high, audible ? high / Math.max(1, hc) : 0);
    f.energy = envelope(f.energy, clamp(rms * 3.5));
    this.slowEnergy += (f.energy - this.slowEnergy) * (1 - Math.exp(-dt / 2.4));
    f.rise = audible ? clamp((f.energy - this.slowEnergy) * 2) : 0;
    f.flux = flux;
    for (let i = 0; i < 128; i++) {
      const lo = Math.max(
        1,
        Math.floor((30 * Math.pow(16000 / 30, i / 128) * this.fftSize) / this.sampleRate),
      );
      const hi = Math.min(
        db.length,
        Math.max(
          lo + 1,
          Math.ceil((30 * Math.pow(16000 / 30, (i + 1) / 128) * this.fftSize) / this.sampleRate),
        ),
      );
      let peak = -100;
      for (let j = lo; j < hi; j++) peak = Math.max(peak, db[j]);
      f.spectrum[i] = audible ? clamp((peak + 85) / 65) * 255 : 0;
    }
    for (let i = 0; i < 256; i++) f.waveform[i] = waveform[Math.floor((i * waveform.length) / 256)];
    return f;
  }
}
