// Floor hazards that make maps play differently. All warn before they bite.
import { hex, mix, noise2 } from "../px.js";
import { DEPTH_K } from "./world.js";
import { sfx } from "../core/audio.js";

const S = Math.sin, C = Math.cos;

export class Hazard {
  constructor(spec, world, power = 1) {
    this.spec = spec; this.w = world; this.t = 0; this.power = power;
    this.src = { team: 1, stats: { atk: 6 * power, crit: 0, critDmg: 1 }, x: 0, y: 0 };
    const A = world.arena;
    this.zones = [];
    if (spec.kind === "lava" || spec.kind === "poison" || spec.kind === "whirl") {
      for (let i = 0; i < (spec.n ?? 2); i++) {
        // keep clear of the hero's start on the left
        const x = 150 + (i / Math.max(1, (spec.n ?? 2) - 1)) * 260 + (Math.random() - 0.5) * 40, y = A.y0 + 20 + Math.random() * (A.y1 - A.y0 - 40);
        this.zones.push({ x, y, r: spec.kind === "whirl" ? 34 : 24 + Math.random() * 8, tick: 0 });
      }
      if (spec.kind === "whirl") for (const z of this.zones) world.fx("water/whirlpool", { x: z.x, y: z.y, light: 0.5, bottom: true });
    }
    this.next = 3.5; this.event = null;
  }

  inZone(e, z) { return Math.hypot(e.x - z.x, (e.y - z.y) * DEPTH_K) < z.r && (e.z ?? 0) < 3 && !e.flying; }

  update(dt) {
    this.t += dt;
    const w = this.w, h = w.hero, K = this.spec.kind;
    if (!h) return;
    if (K === "lava" || K === "poison") for (const z of this.zones) {
      z.tick -= dt;
      for (const e of [h, ...w.enemies]) if (this.inZone(e, z) && z.tick <= 0 && e === h) {
        z.tick = 0.5;
        if (K === "lava") e.applyStatus({ burn: 2 }, this.src); else e.applyStatus({ slow: 1 }, this.src);
        w.hit(this.src, e, { dmg: this.src.stats.atk * (K === "lava" ? 0.6 : 0.4), spark: false, noCrit: true });
      }
    }
    if (K === "whirl") for (const z of this.zones) for (const e of [h, ...w.enemies]) {
      const dx = z.x - e.x, dy = z.y - e.y, d = Math.hypot(dx, dy * DEPTH_K);
      if (d < z.r * 1.6 && d > 3 && !e.heavy && !e.flying) { e.x += (dx / d) * 22 * dt; e.y += (dy / d) * 14 * dt; if (d < z.r) e.applyStatus({ slow: 0.4 }, this.src); }
    }
    // timed hazards: warn, then strike
    if (K === "gust" || K === "hands" || K === "laser") {
      this.next -= dt;
      if (!this.event && this.next <= 0) this.begin();
      if (this.event) this.tickEvent(dt);
    }
  }

  begin() {
    const w = this.w, h = w.hero, K = this.spec.kind;
    if (K === "gust") this.event = { t: 0, warn: 1.4, dur: 0.8, dir: Math.random() < 0.5 ? -1 : 1 };
    if (K === "hands") this.event = { t: 0, warn: 0.9, dur: 0.2, spots: [[h.x, h.y], [h.x + (Math.random() - 0.5) * 140, w.arena.y0 + Math.random() * 100]] };
    if (K === "laser") this.event = { t: 0, warn: 1.1, dur: 0.6, y: h.y };
    sfx("ui");
  }

  tickEvent(dt) {
    const w = this.w, h = w.hero, E = this.event, K = this.spec.kind;
    const was = E.t; E.t += dt;
    const fire = was < E.warn && E.t >= E.warn;
    if (K === "gust" && E.t > E.warn) {
      for (const e of [h, ...w.enemies]) if (!e.heavy) e.x += E.dir * 150 * dt;
      if (fire) { sfx("dash"); w.emit({ shake: 2 }); }
    }
    if (K === "hands" && fire) for (const [x, y] of E.spots) {
      w.fx("shadow/grasping-hands", { x, y, light: 0.8, dur: 1.4 });
      if (Math.hypot(h.x - x, (h.y - y) * DEPTH_K) < 26) { w.hit(this.src, h, { dmg: this.src.stats.atk * 1.3, spark: false, kb: 40 }); h.applyStatus({ root: 0.8 }, this.src); }
    }
    if (K === "laser" && E.t > E.warn) {
      E.tick = (E.tick ?? 0) - dt;
      if (E.tick <= 0) { E.tick = 0.15; if (Math.abs(h.y - E.y) < 8 && h.iframes <= 0) w.hit(this.src, h, { dmg: this.src.stats.atk * 0.7, spark: false, kb: 30 }); }
      if (fire) { sfx("zap"); w.emit({ shake: 2 }); }
    }
    if (E.t > E.warn + E.dur) { this.event = null; this.next = 4 + Math.random() * 3; }
  }

  drawGround(p) {
    const K = this.spec.kind, t = this.t;
    if (K === "lava" || K === "poison") for (const z of this.zones) {
      const R = K === "lava" ? [hex("#3a0a06"), hex("#c43a10"), hex("#f26a1a"), hex("#ffae35"), hex("#ffe27a")] : [hex("#0d1a0c"), hex("#265e18"), hex("#3f8a1e"), hex("#6cb82a"), hex("#a8e04a")];
      for (let j = -Math.ceil(z.r / DEPTH_K); j <= Math.ceil(z.r / DEPTH_K); j++) for (let i = -z.r; i <= z.r; i++) {
        const e = Math.hypot(i / z.r, (j * DEPTH_K) / z.r) + noise2(i * 0.2, j * 0.4, 3) * 0.12;
        if (e > 1) continue;
        const n = noise2((z.x + i) * 0.12 + t * 0.6, (z.y + j) * 0.25, 5);
        const k = e > 0.88 ? 0 : Math.min(4, 1 + Math.floor(n * 3.4 + (1 - e) * 1.2));
        p.put(Math.round(z.x + i), Math.round(z.y + j), R[k]);
        if (k >= 3) p.add(Math.round(z.x + i), Math.round(z.y + j), R[3], 0.25);
      }
      // bubbles
      for (let b = 0; b < 3; b++) { const ph = (t * 0.8 + b / 3 + z.x * 0.01) % 1; if (ph < 0.3) p.put(Math.round(z.x + S(b * 5 + z.y) * z.r * 0.5), Math.round(z.y + C(b * 3) * 3 - ph * 6), R[4]); }
    }
    if (!this.event) return;
    const E = this.event, warn = E.t < E.warn, red = hex("#ff3040"), blink = Math.floor(E.t * 12) % 2;
    if (K === "gust") {
      // streaming arrows show which way the wind will push
      const k = warn ? E.t / E.warn : 1;
      for (let row = 0; row < 5; row++) for (let i = 0; i < 6; i++) {
        const y = this.w.arena.y0 + 10 + row * 24, x = ((i * 80 + (warn ? 0 : E.t * 400) * E.dir) % 480 + 480) % 480;
        for (let a = 0; a < 8; a++) p.blendPx(Math.round(x + a * E.dir), y, hex("#c2ffe2"), (warn ? 0.35 * k : 0.6) * (a / 8));
        p.blendPx(Math.round(x + 8 * E.dir), y - 1, hex("#ffffff"), 0.6 * k); p.blendPx(Math.round(x + 8 * E.dir), y + 1, hex("#ffffff"), 0.6 * k);
      }
    }
    if (K === "hands" && warn) for (const [x, y] of E.spots) for (let a = 0; a < 60; a++) { const an = (a / 60) * Math.PI * 2; p.blendPx(Math.round(x + C(an) * 26), Math.round(y + S(an) * 26 / DEPTH_K), blink ? hex("#d0a8ff") : red, 0.8); }
    if (K === "laser") {
      const y = Math.round(E.y), A = this.w.arena;
      if (warn) { for (let x = A.x0; x < A.x1; x += 2) p.blendPx(x, y, blink ? hex("#ffffff") : red, 0.8); }
      else for (let x = A.x0; x < A.x1; x++) { for (let dy = -2; dy <= 2; dy++) p.put(x, y - 10 + dy, Math.abs(dy) < 1 ? hex("#ffffff") : hex("#4ce8d8")); p.add(x, y - 10, hex("#4ce8d8"), 0.4); p.blendPx(x, y, hex("#4ce8d8"), 0.4); }
    }
  }
}
