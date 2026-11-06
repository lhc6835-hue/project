// A small 2D skeleton for bosses: bones with parents, lengths and angles (forward kinematics), poses blended
// by springs so every joint settles naturally, and helpers to draw sculpted parts that ride on bones.
// Angles: 0 points straight down, +π/2 points forward (the facing side), π points straight up.
import { sculpt } from "./sculpt.js";

export const ease = {
  lin: (u) => u, io: (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2), out: (u) => 1 - (1 - u) ** 3, in: (u) => u * u * u,
  back: (u) => { const c = 1.7; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2; },
};

export class Skeleton {
  /** bones: [{ name, parent, at: [across, along] (offset on the parent), len, a0 (rest angle) }] in order. */
  constructor(bones) {
    this.bones = bones; this.by = Object.fromEntries(bones.map((b) => [b.name, b]));
    this.pose = Object.fromEntries(bones.map((b) => [b.name, 0]));
    this.vel = Object.fromEntries(bones.map((b) => [b.name, 0]));
    this.root = { x: 0, y: 0, lean: 0 }; this.rootV = { x: 0, y: 0, lean: 0 };
    this.W = {};
  }
  /** Spring every joint toward a target pose (critically damped-ish with a little overshoot). */
  drive(target, dt, stiff = 120, damp = 16, rootTarget = null) {
    const step = (cur, vel, tgt, k, d) => { const acc = (tgt - cur) * k - vel * d; vel += acc * dt; return [cur + vel * dt, vel]; };
    for (const b of this.bones) {
      const k = stiff * (b.stiff ?? 1), d = damp * Math.sqrt(b.stiff ?? 1);
      [this.pose[b.name], this.vel[b.name]] = step(this.pose[b.name], this.vel[b.name], target[b.name] ?? 0, k, d);
    }
    if (rootTarget) for (const ch of ["x", "y", "lean"]) [this.root[ch], this.rootV[ch]] = step(this.root[ch], this.rootV[ch], rootTarget[ch] ?? 0, stiff, damp);
  }
  /** World transforms for every bone. f: facing (1 right, -1 left). Returns map name → { x, y, a, ex, ey }. */
  solve(ox, oy, f) {
    const W = this.W;
    for (const b of this.bones) {
      let x, y, a;
      const local = (b.a0 ?? 0) + this.pose[b.name];
      if (!b.parent) { x = this.root.x; y = this.root.y; a = local + this.root.lean; }
      else {
        const P = W[b.parent], [u, v] = b.at ?? [0, 0], along = b.fromEnd ? P.len + v : v;
        x = P.lx + u * Math.cos(P.a) + along * Math.sin(P.a);
        y = P.ly - u * Math.sin(P.a) + along * Math.cos(P.a);
        a = P.a + local;
      }
      const ex = x + Math.sin(a) * b.len, ey = y + Math.cos(a) * b.len;
      W[b.name] = { lx: x, ly: y, a, len: b.len, x: ox + f * x, y: oy + y, ex: ox + f * ex, ey: oy + ey, wa: f * a };
    }
    return W;
  }
}

/**
 * Draw a sculpted part riding on a bone. The shape is authored with v running down the bone from its start
 * and u across it (+u = the facing side). at: how far along the bone (0..1) the shape's origin sits.
 */
export function part(p, bone, f, shape, o = {}) {
  const t = o.at ?? 0, x = bone.x + (bone.ex - bone.x) * t, y = bone.y + (bone.ey - bone.y) * t;
  const ox = o.off ? f * o.off[0] : 0, oy = o.off ? o.off[1] : 0;
  sculpt(p, x + ox, y + oy, shape, { ...o, rot: -bone.wa, flip: f < 0 });
}

/** Sample keyframes [t, pose, ease] (poses are maps of bone → angle plus root x/y/lean). */
export function keys(list, t) {
  if (t <= list[0][0]) return list[0][1];
  for (let i = 0; i < list.length - 1; i++) {
    const [t0, p0] = list[i], [t1, p1, mode = "io"] = list[i + 1];
    if (t < t1) {
      if (mode === "snap") return p0;
      const u = (ease[mode] ?? ease.io)((t - t0) / (t1 - t0 || 1)), out = {};
      for (const k of new Set([...Object.keys(p0), ...Object.keys(p1)])) out[k] = (p0[k] ?? 0) + ((p1[k] ?? 0) - (p0[k] ?? 0)) * u;
      return out;
    }
  }
  return list[list.length - 1][1];
}

/** A verlet strand (hair, veil, robe hem, tendrils). */
export class Strand {
  constructor(n, seg, grav = 300, drag = 0.92) { this.n = n; this.seg = seg; this.grav = grav; this.drag = drag; this.p = null; }
  update(root, dt, wind = [0, 0], dir = [0, 1]) {
    if (!this.p) this.p = Array.from({ length: this.n }, (_, i) => ({ x: root[0] + dir[0] * i * this.seg, y: root[1] + dir[1] * i * this.seg, px: root[0] + dir[0] * i * this.seg, py: root[1] + dir[1] * i * this.seg }));
    const P = this.p;
    P[0].x = P[0].px = root[0]; P[0].y = P[0].py = root[1];
    for (let i = 1; i < this.n; i++) {
      const q = P[i], vx = (q.x - q.px) * this.drag, vy = (q.y - q.py) * this.drag;
      q.px = q.x; q.py = q.y;
      q.x += vx + wind[0] * dt * dt; q.y += vy + (this.grav + wind[1]) * dt * dt;
    }
    for (let it = 0; it < 3; it++) for (let i = 1; i < this.n; i++) {
      const a = P[i - 1], b = P[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, e = (d - this.seg) / d;
      b.x -= dx * e; b.y -= dy * e;
    }
  }
}
