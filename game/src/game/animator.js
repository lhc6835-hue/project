// Turns target poses into living motion: every channel chases its target on a spring, the head and the
// far limbs a little slower (overlapping action), with one-shot "kicks" layered on top — a squash when
// landing or turning, a recoil when hit. Also: a scarf that streams behind on verlet physics, a smear
// trail behind fast hands, and dust at the feet.
import { CHANNELS, NEUTRAL, anchor } from "../rig/rig.js";
import { hex, mix } from "../px.js";

const RATE = {
  move: { base: 20, head: 9, aF: 14, lF: 16, aN: 18 },
  act: { base: 46, head: 20, aF: 50, lF: 40, aN: 60 },
  hurt: { base: 30, head: 14, aF: 20, lF: 24, aN: 24 },
};

export class Animator {
  constructor() {
    this.out = { ...NEUTRAL };
    this.kick = {};              // additive offsets that spring back to 0
    this.init = false;
  }
  /** Add a decaying offset: e.g. kick({ sy: -0.12, sx: 0.1 }) for a landing squash. */
  push(off) { for (const [k, v] of Object.entries(off)) this.kick[k] = (this.kick[k] ?? 0) + v; }

  update(target, dt, mode = "move") {
    const R = RATE[mode] ?? RATE.move, o = this.out;
    if (!this.init) { Object.assign(o, NEUTRAL, target); this.init = true; }
    for (const ch of CHANNELS) {
      const tv = target[ch] ?? NEUTRAL[ch];
      const k = 1 - Math.exp(-(R[ch] ?? R.base) * dt);
      o[ch] += (tv - o[ch]) * k;
    }
    o.plant = target.plant;
    for (const ch in this.kick) { this.kick[ch] *= Math.exp(-14 * dt); if (Math.abs(this.kick[ch]) < 1e-3) delete this.kick[ch]; }
    const res = { ...o };
    for (const ch in this.kick) res[ch] = (res[ch] ?? 0) + this.kick[ch];
    return res;
  }
  /** Snap straight to a pose (for strike frames that must land exactly). */
  snap(target, chs = ["aN", "aF", "lean", "lN", "lF", "sx", "sy", "x", "z", "crouch"]) { for (const ch of chs) if (target[ch] !== undefined) this.out[ch] = target[ch]; }
}

/** A short cloth strip tied at the neck. Points in world space. */
export class Scarf {
  constructor(n = 6, seg = 3) {
    this.n = n; this.seg = seg; this.pts = null;
  }
  update(root, dt, vel, t) {
    if (!this.pts) this.pts = Array.from({ length: this.n }, (_, i) => ({ x: root[0] - i * 0.8, y: root[1] + i * this.seg, px: root[0] - i * 0.8, py: root[1] + i * this.seg }));
    const P = this.pts;
    P[0].x = P[0].px = root[0]; P[0].y = P[0].py = root[1];
    const sp = Math.abs(vel[0]);
    for (let i = 1; i < this.n; i++) {
      const p = P[i], vx = (p.x - p.px) * 0.93, vy = (p.y - p.py) * 0.93;
      p.px = p.x; p.py = p.y;
      // gravity, the wind of moving (streams the cloth back), and a flutter that grows with speed
      const ax = -vel[0] * 4.2, ay = 420 - sp * 1.6 + Math.sin(t * 11 + i * 0.8) * (30 + sp * 0.5);
      p.x += vx + ax * dt * dt; p.y += vy + ay * dt * dt;
    }
    for (let it = 0; it < 3; it++) for (let i = 1; i < this.n; i++) {
      const a = P[i - 1], b = P[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, e = (d - this.seg) / d;
      b.x -= dx * e; b.y -= dy * e;
      if (b.y < root[1] - 2) b.y = root[1] - 2; // cloth never climbs over the head
    }
  }
  draw(p, ramp, glow) {
    const P = this.pts; if (!P) return;
    for (let i = this.n - 1; i > 0; i--) {
      const a = P[i - 1], b = P[i], L = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
      const w = i < this.n - 1 ? 2 : 1;
      for (let s = 0; s <= L; s++) {
        const x = Math.round(a.x + (b.x - a.x) * s / L), y = Math.round(a.y + (b.y - a.y) * s / L);
        const c = ramp[Math.max(0, Math.min(ramp.length - 1, 3 - Math.floor(i / 2)))];
        p.put(x, y, c); if (w > 1) { p.put(x, y + 1, ramp[1]); }
        if (glow) p.add(x, y, glow, 0.12);
      }
    }
    // tie at the neck
    p.put(Math.round(P[0].x), Math.round(P[0].y), ramp[3]); p.put(Math.round(P[0].x) + 1, Math.round(P[0].y), ramp[2]);
  }
}

/** A smear behind a fast-moving hand: short-lived world points drawn as a tapered ribbon. */
export class Trail {
  constructor() { this.pts = []; }
  add(x, y, life = 0.11) { this.pts.push({ x, y, t: life, life }); }
  update(dt) { for (const q of this.pts) q.t -= dt; this.pts = this.pts.filter((q) => q.t > 0); }
  draw(p, ramp, glow) {
    const P = this.pts;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i];
      if (Math.hypot(b.x - a.x, b.y - a.y) > 30) continue;
      const k = b.t / b.life, L = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
      const rad = Math.max(0, Math.round(2.2 * k));
      for (let s = 0; s <= L; s++) {
        const x = Math.round(a.x + (b.x - a.x) * s / L), y = Math.round(a.y + (b.y - a.y) * s / L);
        for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
          if (dx * dx + dy * dy > rad * rad + 0.5) continue;
          const core = dx * dx + dy * dy <= (rad - 1) * (rad - 1);
          p.put(x + dx, y + dy, core ? ramp[ramp.length - 1] : ramp[ramp.length - 3], k + 0.15);
        }
        if (glow) p.add(x, y, glow, 0.35 * k);
      }
    }
  }
}

/** Little dust puffs and sparks at the feet. */
export class Dust {
  constructor() { this.ps = []; }
  puff(x, y, n = 4, dir = 0, c = null) {
    for (let i = 0; i < n; i++) this.ps.push({ x: x + (Math.random() - 0.5) * 4, y, z: 0, vx: (dir || (Math.random() - 0.5)) * (20 + Math.random() * 30) + (Math.random() - 0.5) * 20, vz: 10 + Math.random() * 25, t: 0, life: 0.3 + Math.random() * 0.25, c });
  }
  update(dt) {
    for (const q of this.ps) { q.t += dt; q.x += q.vx * dt; q.vx *= Math.exp(-6 * dt); q.z += q.vz * dt; q.vz -= 60 * dt; if (q.z < 0) q.z = 0; }
    this.ps = this.ps.filter((q) => q.t < q.life);
  }
  draw(p, base = hex("#b7a8a6")) {
    for (const q of this.ps) {
      const k = 1 - q.t / q.life, x = Math.round(q.x), y = Math.round(q.y - q.z);
      const c = q.c ?? base;
      p.put(x, y, c, k * 0.9);
      if (k > 0.5) { p.put(x + 1, y, c, k * 0.6); p.put(x, y - 1, mix(c, hex("#ffffff"), 0.3), k * 0.5); }
    }
  }
}
