import { terrainHash, FLOOR_Y } from './director.js';
const TAU = Math.PI * 2;
export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
  }
  resize(width, height) {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
  }
  draw(world, f, reduced = false) {
    const c = this.ctx,
      w = this.canvas.width,
      h = this.canvas.height,
      scale = h / 500,
      vw = w / scale;
    c.setTransform(scale, 0, 0, scale, 0, 0);
    c.globalAlpha = 1;
    c.shadowBlur = 0;
    const t = world.time,
      cam = world.camera - Math.max(0, vw * 0.28 - 100),
      light = f.bass * 0.12 + (f.punch || 0) * 0.25 * (reduced ? 0.2 : 1);
    const sky = c.createLinearGradient(0, 0, 0, 500);
    sky.addColorStop(0, '#090f26');
    sky.addColorStop(0.5, '#17284a');
    sky.addColorStop(1, '#31455a');
    c.fillStyle = sky;
    c.fillRect(0, 0, vw, 500);
    // Distant stars and spectral sky beams.
    for (let i = 0; i < 95; i++) {
      const x = (((terrainHash(i) * vw - cam * 0.04) % vw) + vw) % vw,
        y = terrainHash(i + 300) * 285;
      c.globalAlpha = 0.2 + terrainHash(i + 99) * 0.45 + f.high * 0.2;
      c.fillStyle = '#bcd7e9';
      c.fillRect(x, y, i % 7 === 0 ? 2 : 1, 1);
    }
    c.globalAlpha = 1;
    const moonX = vw * 0.73 - ((cam * 0.015) % 80),
      moonY = 138;
    const halo = c.createRadialGradient(moonX, moonY, 15, moonX, moonY, 180);
    halo.addColorStop(0, `rgba(100,208,195,${0.12 + light})`);
    halo.addColorStop(1, '#54ccbb00');
    c.fillStyle = halo;
    c.fillRect(moonX - 180, 0, 360, 320);
    c.fillStyle = '#acc9b2';
    c.beginPath();
    c.arc(moonX, moonY, 43, 0, TAU);
    c.fill();
    c.fillStyle = '#9bbbab';
    c.beginPath();
    c.arc(moonX - 12, moonY - 5, 10, 0, TAU);
    c.fill();
    c.fillStyle = '#152a40';
    c.beginPath();
    c.arc(moonX - 17, moonY - 16, 40, 0, TAU);
    c.fill();
    c.strokeStyle = '#8dd2c329';
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(moonX, moonY, 76, 20, -0.45, 0, TAU);
    c.stroke();
    for (let layer = 0; layer < 3; layer++) {
      const parallax = 0.1 + layer * 0.14;
      c.fillStyle = ['#182a43', '#1c354b', '#214052'][layer];
      c.beginPath();
      c.moveTo(0, 500);
      const offset = cam * parallax;
      for (let x = -70; x <= vw + 70; x += 35) {
        const wx = x + offset,
          y =
            270 +
            layer * 39 -
            Math.sin(wx * 0.008 + layer) * 35 -
            Math.sin(wx * 0.017) * 22 -
            terrainHash(Math.floor(wx / 90) + layer) * 26;
        c.lineTo(x, y);
      }
      c.lineTo(vw, 500);
      c.closePath();
      c.fill();
    }
    // Ruined towers at a separate parallax depth.
    for (let i = -1; i < Math.ceil(vw / 145) + 2; i++) {
      const ix = Math.floor((cam * 0.3) / 145) + i,
        x = ix * 145 - cam * 0.3,
        height = 45 + terrainHash(ix + 51) * 115;
      c.fillStyle = '#163746';
      c.fillRect(x, 340 - height, 26, height);
      c.fillRect(x - 5, 337 - height, 36, 6);
      c.fillStyle = `rgba(106,224,207,${0.12 + f.mid * 0.3 + (f.snap || 0) * 0.5})`;
      c.fillRect(x + 10, 350 - height, 5, 23);
    }
    for (let i = 0; i < 9; i++) {
      const x = ((((i * 171 - cam * 0.07) % (vw + 140)) + vw + 140) % (vw + 140)) - 70;
      c.strokeStyle = `rgba(84,220,208,${0.02 + (f.spectrum[i * 13] / 255) * 0.08})`;
      c.lineWidth = 18;
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x - 150, 310);
      c.stroke();
    }
    c.save();
    c.translate(-cam, 0);
    // Solid platforms never move under the player's feet; only their light reacts.
    for (const p of world.platforms) {
      if (p.x + p.w < cam - 60 || p.x > cam + vw + 60) continue;
      const depth = 65 + terrainHash(p.id + 20) * 45;
      const grad = c.createLinearGradient(0, p.y, 0, p.y + depth);
      grad.addColorStop(0, '#173e48');
      grad.addColorStop(1, '#0a1b2d');
      c.fillStyle = grad;
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(p.x + p.w, p.y);
      c.lineTo(p.x + p.w - 18, p.y + 33);
      c.lineTo(p.x + p.w * 0.8, p.y + depth * 0.6);
      c.lineTo(p.x + p.w * 0.63, p.y + depth);
      c.lineTo(p.x + p.w * 0.35, p.y + depth * 0.65);
      c.lineTo(p.x + 23, p.y + depth * 0.85);
      c.closePath();
      c.fill();
      c.strokeStyle = '#316775';
      c.lineWidth = 1;
      for (let j = 0; j < 6; j++) {
        const x = p.x + terrainHash(j + p.id * 7) * p.w;
        c.beginPath();
        c.moveTo(x, p.y + 9);
        c.lineTo(x - 10, p.y + depth * 0.5);
        c.lineTo(x + 5, p.y + depth * 0.8);
        c.stroke();
      }
      c.fillStyle = '#427a79';
      c.fillRect(p.x, p.y, p.w, 7);
      c.fillStyle = `rgba(128,249,214,${0.35 + f.bass * 0.25 + (f.punch || 0) * 0.4})`;
      c.fillRect(p.x, p.y, p.w, 2 + (f.punch || 0) * 4);
      c.shadowBlur = reduced ? 0 : 10;
      c.shadowColor = '#7bffe2';
      c.fillStyle = '#a6ffe1';
      for (let j = 0; j < 8; j++) {
        const x = p.x + 20 + (j * (p.w - 35)) / 8;
        c.fillRect(x, p.y - 2, 3, 4);
      }
      c.shadowBlur = 0;
      for (let j = 0; j < 5; j++) {
        const x = p.x + 30 + terrainHash(j + p.id * 13) * Math.max(1, p.w - 60);
        if (Math.abs(x - (p.x + p.w * 0.6)) < 32) continue;
        const height = 10 + terrainHash(j + 15) * 16;
        c.strokeStyle = '#629e91';
        c.beginPath();
        c.moveTo(x, p.y);
        c.lineTo(x - 2, p.y - height);
        c.lineTo(x - 8, p.y - height - 5);
        c.moveTo(x - 2, p.y - height * 0.7);
        c.lineTo(x + 7, p.y - height * 0.9);
        c.stroke();
        c.fillStyle = j % 2 ? '#e498bc' : '#96ccbc';
        c.fillRect(x - 10, p.y - height - 7, 5, 3);
        c.fillRect(x + 5, p.y - height * 0.9 - 2, 4, 3);
      }
    }
    // Low notes mark the path; amber arches reward jumps. All exist in advance.
    for (const o of world.orbs) {
      if (o.taken || o.x < cam || o.x > cam + vw) continue;
      const y = o.y;
      if (o.attracted && !reduced) {
        c.strokeStyle = `rgba(255,210,158,${world.magnet * 0.3})`;
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(o.x, y);
        c.lineTo(world.hero.x, world.hero.y - 22);
        c.stroke();
      }
      c.save();
      c.translate(o.x, y);
      c.rotate(Math.PI / 4);
      c.fillStyle = o.upper ? '#ffd29e' : '#d9efa2';
      c.shadowColor = o.upper ? '#ffb778' : '#d7ff8d';
      c.shadowBlur = reduced ? 0 : 6 + world.shimmer * 12;
      const size = (o.upper ? 3.5 : 2.5) + (reduced ? 0 : world.shimmer);
      c.fillRect(-size, -size, size * 2, size * 2);
      c.restore();
    }
    for (const ring of world.rings) {
      c.globalAlpha = ring.life * 0.65 * (reduced ? 0.2 : 1);
      c.strokeStyle = '#92ffe8';
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(ring.x, ring.y, ring.r, ring.r * 0.5, 0, 0, TAU);
      c.stroke();
    }
    c.globalAlpha = 1;
    this.hero(world, f, reduced);
    for (const p of world.particles) {
      c.globalAlpha = Math.max(0, p.life / p.max);
      c.fillStyle = p.color;
      c.fillRect(p.x, p.y, 2.5, 2.5);
    }
    c.globalAlpha = 1;
    c.restore();
    const fog = c.createLinearGradient(0, 400, 0, 500);
    fog.addColorStop(0, '#08142500');
    fog.addColorStop(1, '#081425dd');
    c.fillStyle = fog;
    c.fillRect(0, 400, vw, 100);
    for (let i = 0; i < 26; i++) {
      const x = (((terrainHash(i + 900) * vw - cam * 0.6) % vw) + vw) % vw,
        y = 250 + terrainHash(i + 780) * 230 + Math.sin(t + i) * 6;
      c.fillStyle = `rgba(126,240,205,${0.15 + f.high * 0.3})`;
      c.fillRect(x, y, 2, 2);
    }
    if (world.flash > 0.02 && !reduced) {
      c.fillStyle = `rgba(150,255,220,${world.flash * 0.1})`;
      c.fillRect(0, 0, vw, 500);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
  hero(world, f, reduced) {
    const c = this.ctx,
      h = world.hero,
      t = world.time,
      air = !h.grounded;
    c.save();
    // The ground shadow stays on the path so the vertical impulse reads clearly.
    c.fillStyle = '#0004';
    c.beginPath();
    c.ellipse(h.x, FLOOR_Y + 3, 18 - (FLOOR_Y - h.y) * 0.06, 4, 0, 0, TAU);
    c.fill();
    if (air && !reduced) {
      c.strokeStyle = `rgba(121,255,224,${h.accent * 0.7})`;
      c.lineWidth = 3;
      for (const dx of [-12, 12]) {
        c.beginPath();
        c.moveTo(h.x + dx, h.y + 8);
        c.lineTo(h.x + dx, h.y + 8 + 35 * h.accent);
        c.stroke();
      }
    }
    c.translate(h.x, h.y);
    if (world.pickup > 0.1) {
      c.save();
      c.globalAlpha = world.pickup;
      c.fillStyle = '#d9efa2';
      c.font = '11px sans-serif';
      c.fillText('+1', 18, -50 - (1 - world.pickup) * 14);
      c.restore();
    }
    if (world.magnet > 0.1 && !reduced) {
      c.strokeStyle = `rgba(255,210,158,${world.magnet * 0.22})`;
      c.lineWidth = 1;
      c.beginPath();
      c.arc(0, -22, 25 + world.magnet * 25, 0, TAU);
      c.stroke();
    }
    if (!reduced) c.scale(1 + h.accent * 0.2, 1 - h.accent * 0.16);
    c.scale(h.facing, 1);
    c.translate(0, -h.land * 2);
    c.scale(1 + h.land * 0.12, 1 - h.land * 0.1);
    // Long scarf follows velocity; deliberately original procedural sprite.
    c.fillStyle = '#f59b88';
    c.beginPath();
    c.moveTo(-2, -30);
    c.lineTo(-19, -29 + Math.sin(t * 10) * 3);
    c.lineTo(-34, -24 + Math.sin(t * 10 - 1) * 5);
    c.lineTo(-23, -23 + Math.sin(t * 10 - 1) * 4);
    c.lineTo(-6, -24);
    c.closePath();
    c.fill();
    c.lineWidth = 5;
    c.lineCap = 'round';
    const stride = air ? 4 : Math.sin(h.step) * 7;
    c.strokeStyle = '#5b819b';
    c.beginPath();
    c.moveTo(-3, -13);
    c.lineTo(-4 - stride, -5);
    c.lineTo(-7 - stride, 0);
    c.moveTo(4, -13);
    c.lineTo(5 + stride, -6);
    c.lineTo(8 + stride, 0);
    c.stroke();
    c.fillStyle = '#b6d8d3';
    // A small satchel replaces the weapon.
    c.fillRect(-12, -27, 6, 13);
    c.fillRect(-7, -29, 15, 17);
    c.fillStyle = '#527b8b';
    c.fillRect(-7, -19, 15, 7);
    c.fillStyle = '#e8d0a4';
    c.fillRect(-6, -43, 14, 13);
    c.fillStyle = '#d0f7e8';
    c.fillRect(-8, -45, 17, 7);
    c.fillStyle = '#112d41';
    c.fillRect(1, -37, 7, 3);
    c.fillStyle = '#90ffdf';
    c.fillRect(4, -37, 4, 2);
    c.fillStyle = '#f3a08c';
    c.fillRect(-8, -31, 18, 4);
    c.strokeStyle = '#bfdfd6';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(5, -25);
    c.lineTo(world.magnet > 0.3 ? 17 : air ? 10 : 7, -18);
    c.stroke();
    c.restore();
    c.lineCap = 'butt';
  }
}
