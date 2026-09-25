import { FeatureExtractor, emptyFeatures } from './features.js';

export class AudioEngine extends EventTarget {
  constructor() {
    super();
    this.media = new Audio();
    this.media.crossOrigin = 'anonymous';
    this.media.preload = 'metadata';
    this.media.setAttribute('playsinline', '');
    this.context = null;
    this.volume = 0.7;
    this.silent = emptyFeatures();
    this.sourceVersion = 0;
    for (const event of [
      'play',
      'pause',
      'ended',
      'loadedmetadata',
      'durationchange',
      'timeupdate',
      'waiting',
      'playing',
      'error',
    ]) {
      this.media.addEventListener(event, () => this.dispatchEvent(new Event(event)));
    }
    this.media.addEventListener('seeking', () => this.detector?.reset());
  }
  async init() {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' });
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0;
      this.analyser.minDecibels = -85;
      this.analyser.maxDecibels = -20;
      this.gain = this.context.createGain();
      this.gain.gain.value = this.volume;
      this.source = this.context.createMediaElementSource(this.media);
      // Analysis before the volume control: changing listening volume doesn't alter choreography.
      this.source.connect(this.analyser);
      this.analyser.connect(this.gain);
      this.gain.connect(this.context.destination);
      this.frequency = new Float32Array(this.analyser.frequencyBinCount);
      this.waveform = new Float32Array(this.analyser.fftSize);
      this.detector = new FeatureExtractor(this.context.sampleRate, this.analyser.fftSize);
    }
    if (this.context.state !== 'running') await this.context.resume();
  }
  load(url) {
    this.sourceVersion++;
    this.media.pause();
    this.media.src = url;
    this.media.load();
    this.detector?.reset();
  }
  async play() {
    const version = this.sourceVersion;
    await this.init();
    if (version === this.sourceVersion) await this.media.play();
  }
  pause() {
    this.media.pause();
  }
  get playing() {
    return !this.media.paused && !this.media.ended && !this.media.error;
  }
  setVolume(value) {
    this.volume = value;
    if (this.gain) this.gain.gain.setTargetAtTime(value, this.context.currentTime, 0.025);
  }
  read() {
    if (!this.analyser || !this.playing || this.media.readyState < 3) return this.silent;
    this.analyser.getFloatFrequencyData(this.frequency);
    this.analyser.getFloatTimeDomainData(this.waveform);
    return this.detector.process(this.frequency, this.waveform, this.context.currentTime);
  }
  dispose() {
    this.media.pause();
    this.media.removeAttribute('src');
    this.media.load();
    this.context?.close();
  }
}
