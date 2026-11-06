// The low-res frame everything draws into (pixelfx color + light buffers), and its trip to the canvas.
import { createFrame, clearFrame, composite, painterFor, hex } from "../px.js";

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
   * Scene change: a rift of diamonds closes over the screen from the edges in, fn runs while it is shut,
   * then it opens again from the middle out. Each diamond's rim glows gold to violet.
   */
  wipe(fn, o = {}) {
    if (this.tr && this.tr.phase === "in") { this.tr.fn = fn; return; }
    this.tr = { phase: "in", t: 0, fn, dur: o.dur ?? 0.36, soft: !!o.soft };
    const ui = document.getElementById("ui"); ui.style.transition = "opacity 180ms ease-out"; ui.style.opacity = "0";
  }
  drawWipe(d, dt) {
    const T = this.tr; if (!T) return;
    T.t += dt;
    let p = Math.min(1, T.t / T.dur);
    if (T.phase === "in" && p >= 1) {
      const fn = T.fn; T.phase = "out"; T.t = 0; p = 0;
      try { fn?.(); } catch (e) { console.error(e); }
      const ui = document.getElementById("ui"); ui.style.transition = "opacity 260ms ease-out 120ms"; ui.style.opacity = "1";
    }
    if (T.phase === "out" && p >= 1) { this.tr = null; return; }
    const w = this.img.width, h = this.img.height, CELL = 12, half = CELL / 2, ease = (x) => x * x * (3 - 2 * x);
    const cover = T.phase === "in" ? ease(p) : 1 - ease(p);
    const maxD = Math.hypot(w / 2, h / 2), glow = T.soft ? 0 : 1;
    for (let cy = 0; cy < h; cy += CELL) for (let cx = 0; cx < w; cx += CELL) {
      // closing: edges first; opening: the middle first
      const dn = Math.hypot(cx + half - w / 2, cy + half - h / 2) / maxD, lag = T.phase === "in" ? 1 - dn : dn;
      const R = (cover * 1.7 - lag * 0.7) * (CELL + 1);
      if (R <= 0) continue;
      const gr = 255, gg = Math.round(216 - dn * 120), gb = Math.round(74 + dn * 180);   // gold at the middle → violet at the rim
      for (let y = cy; y < Math.min(h, cy + CELL); y++) for (let x = cx; x < Math.min(w, cx + CELL); x++) {
        const m = Math.abs(x - cx - half + 0.5) + Math.abs(y - cy - half + 0.5);
        if (m >= R) continue;
        const i = (y * w + x) * 4;
        if (glow && m > R - 1.6 && R < CELL) { d[i] = gr; d[i + 1] = gg; d[i + 2] = gb; }
        else { d[i] = 11; d[i + 1] = 10; d[i + 2] = 16; }
      }
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
