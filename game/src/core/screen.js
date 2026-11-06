// The low-res frame everything draws into (pixelfx color + light buffers), and its trip to the canvas.
import { createFrame, clearFrame, composite, painterFor, hex, noise2 } from "../px.js";

export const W = 480, H = 270;

export class Screen {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.frame = createFrame(W, H);
    this.img = this.ctx.createImageData(W, H);
    this.bg = hex("#07060d");
    this.camX = 0; this.camY = 0;
    this.shakeT = 0; this.shakeAmp = 0;
    this.flash = 0; this.flashColor = [255, 255, 255];
    this.dim = 0;          // 0..1 darken (ultimate cut-ins)
    this.fit();
    addEventListener("resize", () => this.fit());
    for (const ev of ["fullscreenchange", "webkitfullscreenchange", "orientationchange"]) (ev === "orientationchange" ? window : document).addEventListener(ev, () => setTimeout(() => this.fit(), 60));
  }
  fit() {
    const vw = innerWidth, vh = innerHeight;
    let s = Math.min(vw / W, vh / H);
    // whole pixels when that costs little; otherwise fill the screen (fullscreen on tablets)
    if (s >= 2 && Math.floor(s) / s > 0.9) s = Math.floor(s);
    document.documentElement.style.setProperty("--u", s + "px");
    this.scale = s;
  }
  shake(amp, t = 0.2) {
    if (amp >= this.shakeAmp || this.shakeT <= 0) { this.shakeAmp = amp; this.shakeT = t; this.shakeT0 = t; }
  }
  /** Start a frame: clear, place the camera (with shake). Returns a fresh painter for world drawing. */
  begin(dt) {
    clearFrame(this.frame);
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = Math.max(0, this.shakeT / this.shakeT0) * this.shakeAmp * (window.SHAKE ?? 1);
      sx = Math.round((Math.random() * 2 - 1) * k); sy = Math.round((Math.random() * 2 - 1) * k);
    }
    this.frame.ox = Math.round(this.camX) + sx;
    this.frame.oy = Math.round(this.camY) + sy;
    return painterFor(this.frame);
  }
  /** A painter in screen space (ignores the camera) — for in-canvas HUD bits. */
  screenPainter() {
    const p = painterFor(this.frame);
    p.ox = 0; p.oy = 0;
    return p;
  }
  /**
   * Scene change: a veil of night sky sweeps across the screen. Its front edge is a ragged line of aether
   * light that sheds sparks; behind it the veil is deep ink with a slow aurora. fn runs once the screen is
   * covered and the veil keeps travelling the same way to uncover the new scene.
   */
  wipe(fn, o = {}) {
    if (this.tr && this.tr.phase === "in") { this.tr.fn = fn; return; }
    this.tr = { phase: "in", t: 0, fn, inDur: o.dur ?? 0.55, outDur: (o.dur ?? 0.55) * 1.15, soft: !!o.soft, sparks: [] };
    const ui = document.getElementById("ui"); ui.style.transition = "opacity 220ms ease-out"; ui.style.opacity = "0";
  }
  /** Per-pixel sweep position (0 left/top … 1 right/bottom) warped by noise, and the veil's ink, built once. */
  wipeMaps() {
    if (this.wq) return;
    const w = W, h = H, q = new Float32Array(w * h), ink = new Uint8ClampedArray(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, base = (x / w) * 0.78 + (y / h) * 0.22;
      // a ragged, flame-like front: big slow bends plus fine licks
      q[i] = base + noise2(x * 0.01, y * 0.014, 3) * 0.08 + noise2(x * 0.035, y * 0.05, 7) * 0.012;
      // ink: deep night with soft bands of violet and teal aurora
      const a = 0.5 + 0.5 * noise2(x * 0.008 + 3, y * 0.03, 11), b = 0.5 + 0.5 * noise2(x * 0.02, y * 0.012 + 9, 13);
      ink[i * 3] = 12 + a * 22 + b * 4; ink[i * 3 + 1] = 10 + b * 20; ink[i * 3 + 2] = 22 + a * 34 + b * 16;
      // a scatter of faint stars
      const st = noise2(x * 0.9, y * 0.9, 21); if (st > 0.86) { const l = (st - 0.86) * 900; ink[i * 3] += l; ink[i * 3 + 1] += l; ink[i * 3 + 2] += l; }
    }
    this.wq = q; this.wink = ink;
  }
  drawWipe(d, dt) {
    const T = this.tr; if (!T) return;
    this.wipeMaps();
    T.t += dt;
    const dur = T.phase === "in" ? T.inDur : T.outDur;
    let p = Math.min(1, T.t / dur);
    if (T.phase === "in" && p >= 1) {
      const fn = T.fn; T.phase = "out"; T.t = 0; p = 0;
      try { fn?.(); } catch (e) { console.error(e); }
      const ui = document.getElementById("ui"); ui.style.transition = "opacity 300ms ease-out 380ms"; ui.style.opacity = "1";
    }
    if (T.phase === "out" && p >= 1) { this.tr = null; return; }
    // the front travels from beyond the left edge to beyond the right; covering, then uncovering
    const e = T.phase === "in" ? 1 - (1 - p) * (1 - p) : p * p * (3 - 2 * p);
    const front = -0.16 + e * 1.32, RIM = 0.006, GLOW = 0.09, SHADE = 0.1;
    const Q = this.wq, INK = this.wink, n = W * H, drift = T.t * 18;
    const soft = T.soft;
    for (let i = 0; i < n; i++) {
      const b = front - Q[i];                    // > 0: the veil has passed this pixel
      const veil = T.phase === "in" ? b > 0 : b < 0;
      const k = i * 4, j = i * 3;
      if (veil) {
        const deep = T.phase === "in" ? b : -b;   // distance behind the front
        // the aurora drifts slowly inside the veil
        const ii = (i + Math.floor(drift) * 1) % n, jj = ii * 3;
        let r = INK[jj], g = INK[jj + 1], bl = INK[jj + 2];
        if (T.phase === "in" && deep < GLOW && !soft) {
          // light just behind the front: white-gold at the rim, violet glow fading into the ink
          const u = deep / GLOW;
          if (deep < RIM) { r = 255; g = 240; bl = 205; }
          else { const v = Math.pow(1 - u, 2.2); r += (230 - r) * v * 0.9; g += (150 - g) * v * 0.9; bl += (255 - bl) * v * 0.9; }
        }
        d[k] = r; d[k + 1] = g; d[k + 2] = bl;
      } else {
        const ahead = T.phase === "in" ? -b : b;  // how far the front still is from this pixel
        if (ahead < SHADE) {
          // the scene dims and takes a violet cast as the veil approaches (or as it leaves)
          const v = (1 - ahead / SHADE) * (T.phase === "in" ? 0.55 : 0.4);
          d[k] += (40 - d[k]) * v; d[k + 1] += (26 - d[k + 1]) * v; d[k + 2] += (70 - d[k + 2]) * v;
          if (T.phase === "out" && !soft) { const w2 = 1 - ahead / (RIM * 3); if (w2 > 0) { d[k] += (215 - d[k]) * w2; d[k + 1] += (190 - d[k + 1]) * w2; d[k + 2] += (255 - d[k + 2]) * w2; } }
        }
      }
    }
    // sparks shed along the front, drifting with the sweep and fading
    if (!soft) {
      const S = T.sparks;
      for (let s = 0; s < 6; s++) {
        const y = Math.random() * H, xs = (front - 0.22 * (y / H)) / 0.78 * W + (Math.random() - 0.5) * 10;
        if (xs > -4 && xs < W + 4) S.push({ x: xs, y, vx: 30 + Math.random() * 60, vy: (Math.random() - 0.5) * 30, t: 0, life: 0.35 + Math.random() * 0.4, c: Math.random() < 0.5 ? [255, 230, 160] : [190, 150, 255] });
      }
      for (const sp of S) {
        sp.t += dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy -= 10 * dt;
        const a = 1 - sp.t / sp.life; if (a <= 0) continue;
        const X = Math.round(sp.x), Y = Math.round(sp.y);
        for (const [dx, dy, kk] of [[0, 0, 1], [1, 0, 0.45], [-1, 0, 0.45], [0, 1, 0.45], [0, -1, 0.45]]) {
          const x = X + dx, y = Y + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const k = (y * W + x) * 4, m = a * kk;
          d[k] += (sp.c[0] - d[k]) * m; d[k + 1] += (sp.c[1] - d[k + 1]) * m; d[k + 2] += (sp.c[2] - d[k + 2]) * m;
        }
      }
      T.sparks = S.filter((sp) => sp.t < sp.life);
    }
  }
  present(dt) {
    composite(this.frame, this.img.data, this.bg);
    const d = this.img.data;
    if (this.dim > 0) {
      const k = 1 - this.dim * 0.65;
      for (let i = 0; i < d.length; i += 4) { d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; }
    }
    if (this.edge > 0.01) {
      // a red glow creeping in from the screen edges (hurt / danger); the middle of the arena stays clear
      const E = 34, w = this.img.width, h = this.img.height, k0 = Math.min(1, this.edge);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dd = Math.min(x, y, w - 1 - x, h - 1 - y);
        if (dd >= E) { x = w - 1 - E; continue; }
        const k = k0 * (1 - dd / E) * (1 - dd / E), i = (y * w + x) * 4;
        d[i] += (200 - d[i]) * k; d[i + 1] *= 1 - k * 0.8; d[i + 2] *= 1 - k * 0.7;
      }
    }
    if (this.flash > 0) {
      const k = Math.min(1, this.flash), [r, g, b] = this.flashColor;
      for (let i = 0; i < d.length; i += 4) { d[i] += (r - d[i]) * k; d[i + 1] += (g - d[i + 1]) * k; d[i + 2] += (b - d[i + 2]) * k; }
      this.flash = Math.max(0, this.flash - dt * 6);
    }
    this.drawWipe(d, dt);
    this.ctx.putImageData(this.img, 0, 0);
  }
}
