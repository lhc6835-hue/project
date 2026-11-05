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
  }
  fit() {
    const vw = innerWidth, vh = innerHeight;
    let s = Math.min(vw / W, vh / H);
    if (s >= 2) s = Math.floor(s);          // whole pixels where there is room
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
  present(dt) {
    composite(this.frame, this.img.data, this.bg);
    const d = this.img.data;
    if (this.dim > 0) {
      const k = 1 - this.dim * 0.65;
      for (let i = 0; i < d.length; i += 4) { d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; }
    }
    if (this.flash > 0) {
      const k = Math.min(1, this.flash), [r, g, b] = this.flashColor;
      for (let i = 0; i < d.length; i += 4) { d[i] += (r - d[i]) * k; d[i + 1] += (g - d[i + 1]) * k; d[i + 2] += (b - d[i + 2]) * k; }
      this.flash = Math.max(0, this.flash - dt * 6);
    }
    this.ctx.putImageData(this.img, 0, 0);
  }
}
