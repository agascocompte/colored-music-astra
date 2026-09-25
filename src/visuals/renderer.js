import { vertex, fragment } from './shaders.js';
import { StardustPulse } from './stardust-pulse.js';

export class ShaderRenderer {
  constructor(canvas, onFailure = () => {}) {
    this.canvas = canvas;
    this.onFailure = onFailure;
    this.lost = false;
    this.stardustPulse = new StardustPulse();
    this.gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    if (!this.gl) throw new Error('WebGL no está disponible');
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      onFailure();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.setup();
      this.lost = false;
      if (this.lastDraw) this.draw(...this.lastDraw);
    });
    this.setup();
  }
  setup() {
    const gl = this.gl;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    };
    this.program = gl.createProgram();
    const vs = compile(gl.VERTEX_SHADER, vertex),
      fs = compile(gl.FRAGMENT_SHADER, fragment);
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(this.program));
    gl.useProgram(this.program);
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(this.program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    this.uniforms = Object.fromEntries(
      [
        'resolution',
        'time',
        'bass',
        'mid',
        'high',
        'energy',
        'impact',
        'punch',
        'snap',
        'sparkle',
        'beatAge',
        'stardustWaveAge',
        'stardustWaveStrength',
        'travel',
        'motion',
        'mode',
        'spectrum',
      ].map((name) => [name, gl.getUniformLocation(this.program, name)]),
    );
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  resize(width, height, quality = 1) {
    const scale = Math.min(devicePixelRatio || 1, 1.5, 1400 / width) * quality;
    const w = Math.max(1, Math.round(width * scale)),
      h = Math.max(1, Math.round(height * scale));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }
  draw(mode, time, f, reduced = false, audioTime = time) {
    const elapsed = this.lastDraw ? Math.max(0, Math.min(0.1, time - this.lastDraw[1])) : 0;
    this.travel =
      (this.travel || 0) + elapsed * (1 + f.energy * 2 + f.impact * 8 + (f.punch || 0) * 12);
    this.lastDraw = [mode, time, f, reduced, audioTime];
    this.stardustPulse.update(audioTime, f);
    if (this.lost) return;
    const gl = this.gl,
      u = this.uniforms;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.uniform2f(u.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.time, time);
    gl.uniform1i(u.mode, mode);
    gl.uniform1f(u.motion, reduced ? 0.15 : 1);
    gl.uniform1f(u.travel, this.travel);
    gl.uniform1f(u.stardustWaveAge, this.stardustPulse.age);
    gl.uniform1f(u.stardustWaveStrength, this.stardustPulse.strength);
    for (const name of [
      'bass',
      'mid',
      'high',
      'energy',
      'impact',
      'punch',
      'snap',
      'sparkle',
      'beatAge',
    ])
      gl.uniform1f(u[name], f[name] || 0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE,
      128,
      1,
      0,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      f.spectrum,
    );
    gl.uniform1i(u.spectrum, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  dispose() {
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteTexture(this.texture);
    this.gl.deleteProgram(this.program);
  }
}

/** Canvas fallback keeps all five modes selectable on devices without WebGL. */
export class FallbackRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }
  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }
  draw(mode, t, f) {
    const c = this.ctx,
      w = this.canvas.width,
      h = this.canvas.height;
    c.fillStyle = '#060c19';
    c.fillRect(0, 0, w, h);
    c.save();
    c.translate(w / 2, h / 2);
    for (let i = 0; i < 100; i++) {
      const s = f.spectrum[i] / 255,
        a = (i / 100) * Math.PI * 2 + t * 0.05,
        r = h * (0.25 + s * 0.09),
        color = `hsla(${i * 2.5 + mode * 50},80%,65%,.7)`;
      c.strokeStyle = color;
      c.fillStyle = color;
      c.lineWidth = 1.5;
      c.beginPath();
      if (mode === 0) c.ellipse(0, 0, r, h * (0.23 + s * 0.1), a, 0, Math.PI * 2);
      else if (mode === 1) {
        c.moveTo(-w / 2, -h / 2 + (i * h) / 100);
        for (let x = 0; x <= w; x += 15)
          c.lineTo(
            x - w / 2,
            Math.sin(x * 0.008 + t + i * 0.12) * (30 + s * 70) + ((i - 50) * h) / 120,
          );
      } else if (mode === 2) {
        c.moveTo(((i - 50) * w) / 100, h * 0.4);
        c.lineTo(((i - 50) * w) / 300, -s * h * 0.35);
      } else if (mode === 3) {
        c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        c.lineTo(Math.cos(a * 3) * r * 0.4, Math.sin(a * 3) * r * 0.4);
      } else
        c.arc(
          (Math.cos(a) * r * ((i % 7) + 1)) / 3,
          (Math.sin(a) * r * ((i % 7) + 1)) / 3,
          1 + s * 3,
          0,
          Math.PI * 2,
        );
      c.stroke();
    }
    c.restore();
  }
  dispose() {}
}
