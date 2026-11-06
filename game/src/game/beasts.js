// Spirits as luminous beasts of living element: translucent bodies lit from inside, edges that burn away
// into flame, mist or smoke, glowing ornamental markings and fierce bright eyes. Each spirit is built from
// signed-distance parts (bodies, manes, tails, horns, wings) by an archetype builder, then rendered per pixel.
// Local space: u forward (the facing side), v down, units = pixels at full (stage 3) size.
import { hex, mix, fit, noise2 } from "../px.js";

const S = Math.sin, C = Math.cos, PI = Math.PI;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k); return lerp(b, a, h) - k * h * (1 - h); };
const fract = (x) => x - Math.floor(x);

// ---------------------------------------------------------------------------------------------- shapes
export const ell = (u, v, cx, cy, rx, ry, rot = 0) => {
  let du = u - cx, dv = v - cy;
  if (rot) { const c = C(rot), s = S(rot), a = du * c + dv * s; dv = -du * s + dv * c; du = a; }
  return (Math.hypot(du / rx, dv / ry) - 1) * Math.min(rx, ry);
};
const cap = (u, v, ax, ay, bx, by, ra, rb) => {
  const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey || 1, t = clamp(((u - ax) * ex + (v - ay) * ey) / l2);
  return Math.hypot(u - ax - ex * t, v - ay - ey * t) - lerp(ra, rb, t);
};
const tri = (u, v, ax, ay, bx, by, cx, cy) => {
  const e = (px, py, qx, qy) => (u - px) * (qy - py) - (v - py) * (qx - px);
  const d1 = e(ax, ay, bx, by), d2 = e(bx, by, cx, cy), d3 = e(cx, cy, ax, ay);
  const inside = (d1 <= 0 && d2 <= 0 && d3 <= 0) || (d1 >= 0 && d2 >= 0 && d3 >= 0);
  const seg = (px, py, qx, qy) => { const ex = qx - px, ey = qy - py, t = clamp(((u - px) * ex + (v - py) * ey) / (ex * ex + ey * ey || 1)); return Math.hypot(u - px - ex * t, v - py - ey * t); };
  const d = Math.min(seg(ax, ay, bx, by), seg(bx, by, cx, cy), seg(cx, cy, ax, ay));
  return inside ? -d : d;
};
/** Points along a quadratic or cubic Bézier with radii tapering from r0 to r1. */
function curve(pts, n, r0, r1, pow = 1) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, m = 1 - t;
    let x, y;
    if (pts.length === 3) { x = m * m * pts[0][0] + 2 * m * t * pts[1][0] + t * t * pts[2][0]; y = m * m * pts[0][1] + 2 * m * t * pts[1][1] + t * t * pts[2][1]; }
    else { x = m * m * m * pts[0][0] + 3 * m * m * t * pts[1][0] + 3 * m * t * t * pts[2][0] + t * t * t * pts[3][0]; y = m * m * m * pts[0][1] + 3 * m * m * t * pts[1][1] + 3 * m * t * t * pts[2][1] + t * t * t * pts[3][1]; }
    out.push({ x, y, r: lerp(r0, r1, Math.pow(t, pow)) });
  }
  return out;
}
const strandD = (P, hold) => (u, v) => {
  let d = 1e9, at = 0;
  for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i]; const k = cap(u, v, a.x, a.y, b.x, b.y, a.r, b.r); if (k < d) { d = k; at = i; } }
  if (hold) hold.s = (at - 0.5) / (P.length - 1);
  return d;
};
const strandBB = (P) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of P) { x0 = Math.min(x0, q.x - q.r); y0 = Math.min(y0, q.y - q.r); x1 = Math.max(x1, q.x + q.r); y1 = Math.max(y1, q.y + q.r); } return [x0, y0, x1, y1]; };
const ellBB = (cx, cy, rx, ry) => { const r = Math.max(rx, ry); return [cx - r, cy - r, cx + r, cy + r]; };
const unionBB = (...bs) => [Math.min(...bs.map((b) => b[0])), Math.min(...bs.map((b) => b[1])), Math.max(...bs.map((b) => b[2])), Math.max(...bs.map((b) => b[3]))];

/** A part: d(u,v), bounding box, material and options. */
function part(d, bb, o = {}) {
  return { d, bb, mat: o.mat ?? "body", z: o.z ?? 0, flare: o.flare ?? 0, thick: o.thick ?? 4, dim: o.dim ?? 0, mark: o.mark ?? null, c: o.c ?? [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2], seed: o.seed ?? 0, ramp: o.ramp ?? null, flow: o.flow ?? null, alpha: o.alpha ?? 1, vein: o.vein ?? null };
}
const strandPart = (P, o) => { const h = {}, pt = part(strandD(P, h), strandBB(P), { c: [P[0].x, P[0].y], ...o }); pt.hold = h; return pt; };
const ellPart = (cx, cy, rx, ry, rot, o) => part((u, v) => ell(u, v, cx, cy, rx, ry, rot), ellBB(cx, cy, rx, ry), { c: [cx, cy], ...o });

// ---------------------------------------------------------------------------------------------- markings
// Each returns a function (u, v, px) → true where an ornamental line is drawn; px = design units per pixel.
const spiral = (cx, cy, r, turns = 1.6, w = 0.9, rot = 0) => (u, v, px) => {
  const du = u - cx, dv = v - cy, d = Math.hypot(du, dv);
  if (d > r + px || d < px * 0.8) return false;
  const a = (Math.atan2(dv, du) + rot + PI * 4) % (PI * 2), k = (r / turns);
  const ring = (d - a / (PI * 2) * k) / k;
  return Math.abs(fract(ring + 0.5) - 0.5) * k < Math.max(w * 0.5, px * 0.55);
};
const anyMark = (...fs) => (u, v, px) => fs.some((f) => f && f(u, v, px));
const stripes = (period, w, slant, y0, y1) => (u, v, px) => v > y0 && v < y1 && Math.abs(fract((u + v * slant) / period + S(v * 0.5) * 0.08) - 0.5) * period < Math.max(w * 0.5, px * 0.55);
const lineMark = (ax, ay, bx, by, w = 0.7) => (u, v, px) => cap(u, v, ax, ay, bx, by, Math.max(w, px * 0.55), Math.max(w, px * 0.55)) < 0;
const dotsMark = (pts, r = 0.9) => (u, v, px) => pts.some(([x, y]) => Math.hypot(u - x, v - y) < Math.max(r, px * 0.7));
const crackMark = (seed, sc = 0.22, w = 0.08) => (u, v, px) => Math.abs(noise2(u * sc + seed, v * sc, 11)) < Math.max(w, px * 0.05);
const ringMark = (cx, cy, r, w = 0.6) => (u, v, px) => Math.abs(Math.hypot(u - cx, v - cy) - r) < Math.max(w, px * 0.55);
const chevrons = (x0, x1, y, period, h, w = 0.7) => (u, v, px) => u > x0 && u < x1 && Math.abs(Math.abs(fract((u - x0) / period) - 0.5) * period - (v - y) * 0.6 - h * 0.2) < Math.max(w, px * 0.55) && Math.abs(v - y) < h;

// ---------------------------------------------------------------------------------------------- builders
// Every builder: (L look, st stage 1..3, t time, px) → { parts, eyes, head:[x,y] (crown spot), core:[x,y] }
const HS = [0, 1.32, 1.14, 1], LS = [0, 0.72, 0.88, 1];

function quadruped(L, st, t, px) {
  const q = { len: 1, leg: 1, neck: 1, head: "lion", snout: 1, ears: "lion", tail: "flame", tails: 1, mane: "flame", horns: null, wings: null, back: null, mark: "spiral", paws: "flame", wool: false, ...L.q };
  const hs = HS[st] * (q.hs ?? 1) * 1.26, ls = LS[st] * q.leg * 0.86, b = S(t * 2.2) * 0.35, parts = [], len = q.len;
  const turtle = q.head === "turtle", nx = 8 * len;
  // chest held high, the back sloping down to the haunches: a proud, ready stance
  const Hx = nx + 7.5 + (q.neck - 1) * 4.5, Hy = (turtle ? -7 : -15.5 - (q.neck - 1) * 3) + b * 0.5;
  const torso = (u, v) => smin(ell(u, v, -2.5 * len, 0.5, 11 * len, 6.4 + b * 0.2, -0.1), ell(u, v, 5.5 * len, -2.6, 7.6, 7.9 + b * 0.3, 0.2), 3.2);
  const neck = (u, v) => cap(u, v, nx - 1, -5, Hx - 2.5, Hy + 2.5, turtle ? 3.6 : 5.4, 3.8 * hs);
  const sn = q.snout, hrx = 5.6 * hs, hry = 4.6 * hs, jaw = !["owl", "turtle"].includes(q.head), open = (S(t * 0.9) * 0.5 + 0.5) * 0.18;
  const headD = (u, v) => {
    // skull, brow and a long snout; a jaw that hangs a little open
    let d = smin(ell(u, v, Hx, Hy, hrx, hry, -0.1), ell(u, v, Hx + hrx * 0.9 * sn, Hy + 1.3 * hs, 4.3 * hs * sn, 2.4 * hs, 0.08), 1.6);
    d = smin(d, ell(u, v, Hx + 0.8 * hs, Hy - 2.6 * hs, 3.6 * hs, 1.6 * hs, -0.15), 1);
    if (jaw) d = Math.min(d, ell(u, v, Hx + 3.4 * hs * sn, Hy + 3.6 * hs, 3.9 * hs * sn, 1.25 * hs, 0.18 + open));
    return d;
  };
  let bodyD = (u, v) => smin(smin(torso(u, v), neck(u, v), 2.6), headD(u, v), 1.8);
  if (q.wool) { const base = bodyD, puffs = []; for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2; puffs.push([-1 + C(a) * 9 * len, -0.5 + S(a) * 5.5, 4.2]); } bodyD = (u, v) => { let d = base(u, v) + 1.5; for (const [x, y, r] of puffs) d = Math.min(d, Math.hypot(u - x, v - y) - r); return d; }; }
  const bodyMark = anyMark(markFor(q.mark, len, st, Hx, Hy, hs), st >= 2 && !turtle ? lineMark(Hx - 3.6 * hs, Hy - 0.6 * hs, Hx + 0.6 * hs, Hy - 1.1 * hs, 0.45) : null);
  parts.push(part(bodyD, [-14 * len - 4, Hy - hry - 3 * hs, Hx + hrx + 5 * hs * sn, 9], { z: 2, thick: 5.5, mark: bodyMark, c: [0, 0] }));
  if (jaw) {
    // the mouth line and a fang
    parts.push(strandPart([{ x: Hx + 1.4 * hs, y: Hy + 2.6 * hs, r: 0.38 }, { x: Hx + 7.6 * hs * sn, y: Hy + 2.3 * hs + open * 4, r: 0.32 }], { mat: "void", z: 2.45 }));
    if (st >= 2 && q.fangs !== false) parts.push(part((u, v) => tri(u, v, Hx + 5.3 * hs * sn, Hy + 2.3 * hs, Hx + 6.3 * hs * sn, Hy + 2.3 * hs, Hx + 5.6 * hs * sn, Hy + 4.2 * hs), [Hx + 5 * hs, Hy + 2 * hs, Hx + 7 * hs * sn, Hy + 4.5 * hs], { mat: "tooth", z: 2.5 }));
  }
  // --- legs: near pair in front, far pair behind and dimmer; at full size the near forepaw lifts, prancing
  const legs = [[6 * len, 3, 0], [-9 * len, 3.5, 1.3]];
  for (const near of [0, 1]) for (const [lx, ly, ph] of legs) {
    const sw = S(t * 2.1 + ph + near * 1.6) * 0.22, off = near ? 0 : -2.4, prance = q.prance !== false && st >= 2 && near && !ph && !turtle;
    let kx = lx + off + S(sw) * 3 - (ph ? 1.5 : 0), ky = ly + 6 * ls, fx = kx + 1.2 + sw * 3, fy = ky + 6 * ls;
    if (prance) { const up = 0.75 + S(t * 1.4) * 0.25; kx = lx + 4.5 * up; ky = ly + 4.5 * ls; fx = kx + 1 - 2 * up; fy = ky + 4 * ls; }
    const thigh = ph ? 4.4 : 3.6, P = [{ x: lx + off, y: ly, r: thigh }, { x: kx, y: ky, r: 2.4 }, { x: fx, y: fy, r: 2 }];
    parts.push(strandPart(P, { z: near ? 3 : 0, dim: near ? 0 : 1.1, thick: 2.5 }));
    if (q.paws === "flame") parts.push(ellPart(fx + 0.4, fy + 0.6, 2, 1.5, 0, { mat: "flame", flare: 2.4, z: near ? 3.1 : 0.1, thick: 2, dim: near ? 0 : 0.8, seed: lx + near, flow: [-0.6, -0.8] }));
    else if (q.paws === "hoof") parts.push(ellPart(fx + 0.3, fy + 1, 1.8, 1.2, 0, { mat: "horn", z: near ? 3.1 : 0.1, dim: near ? 0 : 1 }));
  }
  // --- tails
  const tx = -13 * len, ty = -2;
  if (q.tail === "flame" || q.tail === "lion") {
    const sw = S(t * 1.7) * 3;
    const P = curve([[tx, ty], [tx - 8, ty - 2 + sw * 0.3], [tx - 12 + sw, ty - 11], [tx - 6 + sw * 1.3, ty - 19]], 10, q.tail === "lion" ? 1.3 : 3.2, q.tail === "lion" ? 1 : 0.8);
    parts.push(strandPart(P, { mat: q.tail === "lion" ? "body" : "flame", flare: q.tail === "lion" ? 0 : 3.2, z: 1, thick: 2.2 }));
    if (q.tail === "lion") { const e = P[P.length - 1]; parts.push(ellPart(e.x, e.y - 1, 3, 3.6, 0, { mat: "flame", flare: 3, z: 1.1, thick: 2 })); }
  } else if (q.tail === "fox" || q.tail === "star") {
    // a fan of fluffy tails, from swept back to raised high, each ending in a flame
    const n = typeof q.tails === "number" ? q.tails : q.tails[st], Lt = 15 * (q.tailLen ?? 1);
    for (let i = 0; i < n; i++) {
      const k = n === 1 ? 0.45 : i / (n - 1), th = lerp(PI * 0.93, PI * 1.47, k) + S(t * 1.5 + i * 0.8) * 0.08, cx = C(th), cy = S(th), px2 = -cy, py2 = cx;
      const r0x = tx + 1, r0y = ty - 1, curl = 3.5;
      const P = curve([[r0x, r0y], [r0x + cx * Lt * 0.45 + px2 * curl, r0y + cy * Lt * 0.45 + py2 * curl], [r0x + cx * Lt * 0.85 - px2 * curl * 0.4, r0y + cy * Lt * 0.85 - py2 * curl * 0.4 - 2], [r0x + cx * Lt, r0y + cy * Lt - 4]], 10, 2, 1);
      const fl = (q.fluff ?? 1) * (n > 5 ? 0.75 : 1);
      for (let j = 0; j < P.length; j++) { const u2 = j / (P.length - 1); P[j].r = 1.3 + S(Math.pow(u2, 0.8) * PI) * 2.5 * fl; }
      const z = 1 - Math.abs(k - 0.45) * 0.6;
      parts.push(strandPart(P, { z, thick: 2.6, dim: k > 0.75 ? 0.5 : 0, mark: q.tailMark ? spiralAlong(P) : null, seed: i }));
      const e = P[P.length - 1];
      parts.push(strandPart([{ x: e.x - cx * 2, y: e.y - cy * 2, r: 2.2 }, { x: e.x + cx * 2.5, y: e.y + cy * 2.5 - 2, r: 0.8 }], { mat: "flame", flare: 2.8, z: z + 0.01, thick: 1.8, seed: 11 + i }));
    }
  } else if (q.tail === "ribbon") {
    const n = q.tails[st] ?? 2;
    for (let i = 0; i < n; i++) {
      const P = []; const L0 = 22 + i * 5;
      for (let j = 0; j <= 16; j++) { const s = j / 16; P.push({ x: tx - s * L0, y: ty - 1 - i * 4.2 + S(s * 5.5 - t * 4 + i * 1.3) * (1.2 + s * 4) - s * (3 + i * 1.5), r: lerp(1.5, 0.4, s) }); }
      parts.push(strandPart(P, { mat: "membrane", z: 1 - i * 0.2, thick: 1.2, mark: null }));
      const e = P[P.length - 1]; parts.push(ellPart(e.x, e.y, 1.6, 1.6, 0, { mat: "flame", flare: 2.2, z: 1.01 - i * 0.2, thick: 1.4, seed: 30 + i }));
    }
  } else if (q.tail === "thin") {
    const sw = S(t * 2) * 3;
    parts.push(strandPart(curve([[tx, ty], [tx - 8, ty + 4], [tx - 12 + sw, ty - 6], [tx - 9 + sw, ty - 14]], 10, 1.8, 1.2), { z: 1, thick: 1.5 }));
  } else if (q.tail === "stub") parts.push(ellPart(tx - 1, ty, 3, 2, 0.4, { z: 1 }));
  // --- mane
  if (q.mane === "flame" || q.mane === "rays" || q.mane === "rock" || q.mane === "frost") {
    const n = st === 1 ? 4 : st === 2 ? 6 : 9;
    for (let i = 0; i < n; i++) {
      const s = i / (n - 1), bx = lerp(Hx - 2 * hs, nx - 2, s), by = lerp(Hy - 3 * hs, -5, s), an = lerp(-2.3, -2.9, s) + S(t * 2 + i) * 0.12, Ln = (q.mane === "rays" ? 9 : 11) * (st === 1 ? 0.6 : st === 2 ? 0.85 : 1) * (0.75 + S(i * 1.7) * 0.25);
      if (q.mane === "rock" || q.mane === "frost") { const ex = bx + C(an) * Ln * 0.6, ey = by + S(an) * Ln * 0.6, w = 2.4; parts.push(part((u, v) => tri(u, v, bx - w, by + 1, bx + w, by + 1, ex, ey), [Math.min(bx, ex) - w, Math.min(by, ey) - w, Math.max(bx, ex) + w, Math.max(by, ey) + w], { mat: q.mane === "frost" ? "crystal" : "horn", z: 1.9 })); continue; }
      const P = curve([[bx, by], [bx + C(an) * Ln * 0.5 + 1, by + S(an) * Ln * 0.5 - 1], [bx + C(an) * Ln, by + S(an) * Ln]], 6, q.mane === "rays" ? 2.2 : 2.8, 0.4);
      parts.push(strandPart(P, { mat: "flame", flare: q.mane === "rays" ? 1.8 : 4.2, z: 1.8, thick: 2.2, seed: i * 3 }));
    }
    if (q.mane === "rays" && st >= 2) {
      // a sun disc behind the head with short rays
      parts.push(part((u, v) => Math.abs(Math.hypot(u - Hx + 1.5, v - Hy + 1) - 7.5 * hs) - 0.6, ellBB(Hx - 1.5, Hy - 1, 8.5 * hs, 8.5 * hs), { mat: "glow", z: 0.5 }));
      for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2 + t * 0.3, r0 = 8.4 * hs, r1 = (i % 2 ? 10 : 11.5) * hs, cx = Hx - 1.5, cy = Hy - 1; parts.push(strandPart([{ x: cx + C(a) * r0, y: cy + S(a) * r0, r: 0.8 }, { x: cx + C(a) * r1, y: cy + S(a) * r1, r: 0.3 }], { mat: "glow", z: 0.45 })); }
    }
  } else if (q.mane === "ruff") {
    for (let i = 0; i < 5; i++) { const a = -2.6 + i * 0.5; parts.push(ellPart(nx + 1 + C(a) * 4, -6 + S(a) * 4, 3.6, 2.6, a, { z: 2.1, thick: 2 })); }
  } else if (q.mane === "cloud") {
    for (let i = 0; i < 4; i++) parts.push(ellPart(Hx - 4 + i * 0.5, Hy - 4 + i * 1.6, 3.4, 2.8, 0, { z: 2.05, thick: 2, ramp: "light" }));
  }
  // --- ears and horns
  const ex = Hx - 1.5 * hs, ey = Hy - hry * 0.8;
  if (q.ears === "fox" || q.ears === "wolf") { const h = (q.ears === "fox" ? 7.5 : 5.5) * hs; for (const [o, z, dim] of [[0, 2.5, 0], [-2.6 * hs, 1.95, 0.8]]) parts.push(part((u, v) => tri(u, v, ex - 2.4 * hs + o, ey + 1.5, ex + 2.2 * hs + o, ey + 1.5, ex - 1.5 * hs + o, ey - h), [ex - 3 * hs + o, ey - h, ex + 3 * hs + o, ey + 2], { z, dim, mark: (u, v, px) => tri(u, v, ex - 1.2 * hs + o, ey + 1, ex + 1 * hs + o, ey + 1, ex - 1.3 * hs + o, ey - h * 0.6) < 0 })); }
  else if (q.ears === "cat") { for (const o of [0, -3 * hs]) parts.push(part((u, v) => tri(u, v, ex - 2 * hs + o, ey + 1.2, ex + 2 * hs + o, ey + 1.2, ex - 0.5 * hs + o, ey - 4.2 * hs), [ex - 3 * hs + o, ey - 5 * hs, ex + 3 * hs + o, ey + 2], { z: o ? 1.95 : 2.5, dim: o ? 0.8 : 0 })); }
  else if (q.ears === "lion") parts.push(ellPart(ex - 1, ey + 0.5, 2, 1.8, 0, { z: 2.5 }));
  else if (q.ears === "deer") { for (const o of [0, -2]) parts.push(ellPart(ex - 3 * hs + o, ey + 0.5, 3.4 * hs, 1.5 * hs, -0.5, { z: o ? 1.95 : 2.5, dim: o ? 0.8 : 0 })); }
  else if (q.ears === "fin") { for (const o of [0, -1.5]) parts.push(part((u, v) => tri(u, v, ex, ey + 2, ex - 2.5 * hs + o, ey + 4, ex - 7.5 * hs + o, ey - 3.5 * hs), [ex - 8 * hs + o, ey - 4 * hs, ex + 1, ey + 5], { mat: "membrane", z: o ? 1.95 : 2.55, dim: o ? 0.8 : 0 })); }
  if (st >= (q.hornStage ?? 2)) hornsFor(q.horns, parts, Hx, Hy, hs, st, t);
  // --- back ornaments, shell, wings
  if (q.back) backFor(q.back, parts, len, st, t);
  if (q.wings && st >= (q.wingStage ?? 3)) wingsFor(q.wings, parts, nx - 3, -7, st, t, L);
  // --- eyes
  const eyes = [{ x: Hx + 1.6 * hs, y: Hy - 0.6 * hs, w: (st === 1 ? 1.5 : 1.9) * hs, h: (st === 1 ? 1.4 : 0.95) * hs, rot: st === 1 ? 0 : -0.3, slit: st >= 2 && q.slit !== false }];
  return { parts, eyes, head: [Hx - 1, Hy - hry - (q.horns ? 6 : 3) * hs], core: [1, -3] };
}

function markFor(kind, len, st, Hx, Hy, hs) {
  if (!kind) return null;
  if (kind === "spiral") return anyMark(spiral(5 * len, -0.5, 4.2, 1.6, 0.75), spiral(-8 * len, 0.5, 4, 1.6, 0.75, 2), st >= 2 ? lineMark(Hx - 2 * hs, Hy - 1 * hs, Hx + 3 * hs, Hy - 2.8 * hs, 0.5) : null);
  if (kind === "stripe" || kind === "bolt") return anyMark(stripes(4.2, kind === "bolt" ? 0.9 : 1.3, kind === "bolt" ? 0.8 : 0.35, -8, 2), lineMark(Hx - 3 * hs, Hy - 2 * hs, Hx + 1 * hs, Hy - 3.4 * hs, 0.5));
  if (kind === "crack") return crackMark(3, 0.2, 0.07);
  if (kind === "dots") return dotsMark([[-9, -4], [-5, -6], [-1, -5.5], [3, -6.5], [-7, -1], [1, -2]], 0.9);
  if (kind === "rune") return anyMark(ringMark(5 * len, -0.5, 3.4, 0.5), lineMark(5 * len - 2.4, -0.5, 5 * len + 2.4, -0.5, 0.4), lineMark(5 * len, -2.9, 5 * len, 1.9, 0.4), ringMark(-8 * len, 0.5, 3, 0.5));
  if (kind === "lotus") return anyMark(chevrons(-12, 6, -3, 4, 3, 0.6), spiral(6 * len, -1, 3.5, 1.4, 0.6));
  return null;
}
const spiralAlong = (P) => { const m = P[Math.floor(P.length * 0.55)]; return spiral(m.x, m.y, m.r * 0.8, 1.3, 0.55); };

function hornsFor(kind, parts, Hx, Hy, hs, st, t) {
  if (!kind) return;
  const bx = Hx - 1 * hs, by = Hy - 4 * hs, k = st === 2 ? 0.7 : 1;
  const H = (P, o = {}) => parts.push(strandPart(P, { mat: "horn", z: 2.6, thick: 1.5, ...o }));
  if (kind === "single") H(curve([[Hx + 1 * hs, by + 0.5], [Hx + 3, by - 5 * k], [Hx + 1, by - 11 * k]], 6, 1.8, 0.4));
  else if (kind === "antler" || kind === "branch") {
    for (const [o, z, dim] of [[0, 2.6, 0], [-2.4, 1.9, 0.9]]) {
      const P = curve([[bx + o, by + 1], [bx - 3 + o, by - 6 * k], [bx - 9 + o, by - 11 * k]], 8, 1.4, 0.5);
      H(P, { z, dim });
      for (const s of [0.35, 0.65]) { const q = P[Math.round(s * 8)]; H(curve([[q.x, q.y], [q.x + 1.5, q.y - 3 * k], [q.x + 0.5, q.y - 6 * k]], 4, 0.9, 0.35), { z, dim }); }
      if (kind === "branch") for (const s of [0.5, 0.95]) { const q = P[Math.round(s * 8)]; parts.push(ellPart(q.x - 0.5, q.y - 1.5, 2.4, 1.8, 0.4, { mat: "leaf", z: z + 0.05, dim, thick: 1.5 })); }
    }
  } else if (kind === "curl") {
    const P = []; for (let i = 0; i <= 14; i++) { const a = -1.2 + i / 14 * 4.2, r = 5.5 * k * (1 - i / 24); P.push({ x: bx - 2 + C(a) * r * -1, y: by + 2 + S(a) * r, r: lerp(2.2, 0.7, i / 14) }); }
    H(P);
  } else if (kind === "crystal") {
    for (const [o, h] of [[0, 9], [-3, 6], [3, 5]]) parts.push(part((u, v) => tri(u, v, bx + o - 1.8, by + 2, bx + o + 1.8, by + 2, bx + o - 1, by - h * k), [bx + o - 2, by - h * k, bx + o + 2, by + 2], { mat: "crystal", z: 2.6 }));
  } else if (kind === "spikes") {
    for (const [o, a] of [[0, -2.5], [-2.5, -2.8]]) H(curve([[bx + o, by + 1], [bx + o + C(a) * 4 * k, by + S(a) * 4 * k], [bx + o + C(a - 0.3) * 8 * k, by + S(a - 0.3) * 8 * k]], 5, 1.5, 0.3), { z: o ? 1.9 : 2.6, dim: o ? 0.8 : 0 });
  }
}

function backFor(kind, parts, len, st, t) {
  if (kind === "spikes" || kind === "flamespine") {
    const n = st + 2;
    for (let i = 0; i < n; i++) {
      const x = lerp(5, -12, i / (n - 1)) * len, y = -7 + Math.abs(x) * 0.08, h = 4 + (st === 3 ? 2.5 : 1) + S(i * 2) * 1;
      if (kind === "flamespine") parts.push(strandPart(curve([[x, y + 1], [x - 1, y - h * 0.5], [x - 2.5, y - h]], 4, 2.2, 0.5), { mat: "flame", flare: 2.5, z: 1.85, thick: 1.8, seed: i }));
      else parts.push(part((u, v) => tri(u, v, x - 2, y + 1.5, x + 2, y + 1.5, x - 1.5, y - h), [x - 2.5, y - h, x + 2.5, y + 2], { mat: "horn", z: 1.85 }));
    }
  } else if (kind === "crystal") {
    for (const [x, h, w, a] of [[-2, 12, 3.2, -0.1], [-8, 8, 2.6, -0.4], [3, 7, 2.4, 0.3], [-12, 5, 2, -0.6]].slice(0, st + 1)) {
      const c = C(a), s = S(a), tx = x + s * h, ty = -6 - c * h;
      parts.push(part((u, v) => tri(u, v, x - w, -5, x + w, -5, tx, ty), [Math.min(x - w, tx) - 1, ty - 1, Math.max(x + w, tx) + 1, -4], { mat: "crystal", z: 1.85 }));
    }
  } else if (kind === "caps") {
    for (const [x, r] of [[-6, 7], [1.5, 5], [-12.5, 4]].slice(0, st)) parts.push(part((u, v) => Math.max(ell(u, v, x, -6.5, r, r * 0.8), v - (-5.6)), [x - r, -6.5 - r, x + r, -5], { mat: "cap", z: 2.2, mark: dotsMark([[x - r * 0.45, -8.2], [x + r * 0.4, -9], [x - r * 0.05, -6.5 - r * 0.6]], 0.95) }));
  } else if (kind === "shell") {
    const R = 11 + st * 0.5;
    parts.push(part((u, v) => Math.max(ell(u, v, -2, -1, R * 1.1, R * 0.82), v - 2.5), [-2 - R * 1.1, -1 - R, -2 + R * 1.1, 3], { mat: "shell", z: 2.4, thick: 4, mark: anyMark(spiral(-2, -4, 5, 1.5, 0.7), ringMark(-2, -1, R * 0.7, 0.45)) }));
  } else if (kind === "shellcrystal") {
    backFor("shell", parts, len, st, t);
    for (const [x, h, w] of [[-3, 10, 3], [-9, 7, 2.4], [3, 6, 2.2]].slice(0, st)) parts.push(part((u, v) => tri(u, v, x - w, -8, x + w, -8, x - 0.5, -8 - h), [x - w, -8 - h, x + w, -7], { mat: "crystal", z: 2.5 }));
  } else if (kind === "flowers") {
    for (const [x, y] of [[-6, -7.5], [0, -8.5], [-11, -6]].slice(0, st)) parts.push(part((u, v) => { const a = Math.atan2(v - y, u - x), d = Math.hypot(u - x, v - y); return d - (1.6 + 1.1 * Math.abs(C(a * 2.5))); }, [x - 3, y - 3, x + 3, y + 3], { mat: "petal", z: 2.3, mark: (u, v) => Math.hypot(u - x, v - y) < 0.9 }));
  }
}

function wingsFor(kind, parts, x0, y0, st, t, L) {
  const flap = S(t * (kind === "membrane" ? 5 : 3.2)) * 0.25;
  const n = kind === "feather" || kind === "flame" ? 5 : 4;
  for (const near of [0, 1]) {
    const o = near ? 0 : -2.5;
    for (let i = 0; i < n; i++) {
      const a = -1.95 - i * 0.28 + flap * (1 - i * 0.1) - (near ? 0 : 0.12), Lw = (kind === "flame" ? 16 : 15) - i * 1.4;
      const P = curve([[x0 + o, y0], [x0 + o + C(a + 0.3) * Lw * 0.55, y0 + S(a + 0.3) * Lw * 0.55], [x0 + o + C(a) * Lw, y0 + S(a) * Lw]], 6, kind === "membrane" ? 1.2 : kind === "flame" ? 1.9 : 2.6, kind === "membrane" ? 0.5 : 0.7);
      if (kind === "flame") parts.push(strandPart(P, { mat: "flame", flare: 2.4, z: near ? 2.7 : 0.3, thick: 2.2, dim: near ? 0 : 0.8, seed: i * 5 }));
      else if (kind === "membrane") parts.push(strandPart(P, { mat: "horn", z: near ? 2.75 : 0.35, thick: 1, dim: near ? 0 : 0.8 }));
      else parts.push(strandPart(P, { mat: "feather", z: near ? 2.7 - i * 0.01 : 0.3, thick: 2, dim: near ? 0 : 0.9 }));
    }
    if (kind === "membrane") {
      const tips = Array.from({ length: n }, (_, i) => { const a = -1.95 - i * 0.28 + flap * (1 - i * 0.1) - (near ? 0 : 0.12), Lw = 15 - i * 1.4; return [x0 + o + C(a) * Lw, y0 + S(a) * Lw]; });
      const poly = [[x0 + o, y0], ...tips, [x0 + o - 9, y0 + 2]];
      parts.push(part((u, v) => { let d = 1e9, s = 1; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [ax, ay] = poly[j], [bx, by] = poly[i], ex = bx - ax, ey = by - ay, wx = u - ax, wy = v - ay, tt = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey || 1)); d = Math.min(d, Math.hypot(wx - ex * tt, wy - ey * tt)); if ((ay > v) !== (by > v) && u < (ex * (v - ay)) / ey + ax) s = -s; } return s * d; }, unionBB(...poly.map(([x, y]) => [x, y, x, y])), { mat: "membrane", z: near ? 2.65 : 0.25, dim: near ? 0 : 0.8, thick: 3 }));
    }
  }
}

// --- serpentine dragon ---------------------------------------------------------------------------------
function dragon(L, st, t, px) {
  const q = { horns: "antler", mane: "flame", whiskers: true, fins: false, legs: true, wire: false, ...L.q };
  const hs = HS[st] * 1.22, lenK = [0, 0.6, 0.82, 1][st], n = 26, parts = [];
  // the body coils: down from the raised head, back under itself, up in a loop and out into the tail
  const path = [[13, -9], [8, -1], [0, 5], [-9, 6], [-17, 1], [-19, -7], [-13, -12], [-6, -9], [-9, -3], [-20, 0], [-30, -4]];
  const sample = (s) => { const f = s * (path.length - 1), i = Math.min(path.length - 2, Math.floor(f)), k = f - i, a = path[Math.max(0, i - 1)], b = path[i], c = path[i + 1], d = path[Math.min(path.length - 1, i + 2)];
    const cr = (p0, p1, p2, p3) => 0.5 * (2 * p1 + (-p0 + p2) * k + (2 * p0 - 5 * p1 + 4 * p2 - p3) * k * k + (-p0 + 3 * p1 - 3 * p2 + p3) * k * k * k);
    return [cr(a[0], b[0], c[0], d[0]), cr(a[1], b[1], c[1], d[1])]; };
  const P = [];
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1) * (0.55 + lenK * 0.45), [x, y] = sample(s), w = S(s * PI * 3 - t * 1.8) * (0.4 + s * 1.6);
    P.push({ x: x * (0.7 + lenK * 0.3), y: y * (0.7 + lenK * 0.3) + w, r: lerp(4.6, 0.9, Math.pow(i / (n - 1), 0.9)) * (st === 1 ? 1.15 : 1) });
  }
  const p0 = P[0], p1 = P[2], dx = p0.x - p1.x, dy = p0.y - p1.y, dl = Math.hypot(dx, dy) || 1, hx = dx / dl, hy = dy / dl;
  const Hx = p0.x + hx * 3, Hy = p0.y + hy * 3 - 1.5, open = (S(t * 1.3) * 0.5 + 0.5) * 0.25;
  const headD = (u, v) => smin(smin(ell(u, v, Hx, Hy, 5.4 * hs, 4.2 * hs, 0.1), ell(u, v, Hx + 5 * hs, Hy + 0.6 * hs, 4.4 * hs, 2.3 * hs, 0.05), 1.5), ell(u, v, Hx + 3.8 * hs, Hy + 2.8 * hs, 4.2 * hs, 1.3 * hs, 0.25 + open), 0.8);
  const bodyMark = q.wire ? null : anyMark(...[0.2, 0.45, 0.7].map((s) => { const m = P[Math.floor(s * (n - 1))]; return spiral(m.x, m.y, m.r * 0.85, 1.3, 0.55); }), lineMark(Hx - 2 * hs, Hy - 1.2 * hs, Hx + 4 * hs, Hy - 2.2 * hs, 0.5));
  const bodyS = strandD(P);
  parts.push(part((u, v) => smin(bodyS(u, v), headD(u, v), 2), unionBB(strandBB(P), [Hx - 6 * hs, Hy - 5 * hs, Hx + 10 * hs, Hy + 5 * hs]), { z: 2, thick: 4, mark: bodyMark, c: [p0.x, p0.y], mat: q.wire ? "wire" : "body" }));
  // spine: flames or fins every few segments
  const step = st === 1 ? 5 : 3;
  for (let i = 2; i < n - 3; i += step) {
    const a = P[i], h = (q.mane === "flame" ? 7 : 4.5) * (1 - i / n) * (st === 1 ? 0.7 : 1) + 1.5;
    if (q.mane === "flame") parts.push(strandPart(curve([[a.x, a.y - a.r * 0.6], [a.x - 2, a.y - a.r - h * 0.5], [a.x - 4, a.y - a.r - h]], 4, 2, 0.4), { mat: "flame", flare: 2.8, z: 1.8, thick: 1.6, seed: i }));
    else parts.push(part((u, v) => tri(u, v, a.x - 2.2, a.y - a.r * 0.5, a.x + 1.5, a.y - a.r * 0.5, a.x - 3, a.y - a.r - h), [a.x - 4, a.y - a.r - h, a.x + 2, a.y], { mat: q.mane === "crystal" ? "crystal" : "membrane", z: 1.8 }));
  }
  // tail tip: a fan of flame or fin
  const e = P[n - 1], e2 = P[n - 3];
  for (let k = -1; k <= 1; k++) { const a = Math.atan2(e.y - e2.y, e.x - e2.x) + k * 0.5; parts.push(strandPart(curve([[e.x, e.y], [e.x + C(a) * 4, e.y + S(a) * 4], [e.x + C(a) * 8, e.y + S(a) * 8 - 2]], 4, 1.8, 0.5), { mat: q.fins ? "membrane" : "flame", flare: q.fins ? 0 : 2.4, z: 1.9, thick: 1.4 })); }
  // little legs
  if (q.legs) for (const [i, near] of [[4, 1], [5, 0], [12, 1], [13, 0]].filter(([i]) => i < n * lenK + 2)) {
    const a = P[i], sw = S(t * 2 + i) * 1.2;
    parts.push(strandPart([{ x: a.x, y: a.y, r: 1.8 }, { x: a.x + 1.5 + sw, y: a.y + 4.5, r: 1.3 }, { x: a.x + 3 + sw, y: a.y + 6, r: 0.9 }], { z: near ? 2.5 : 0.5, dim: near ? 0 : 1, thick: 1.5 }));
    parts.push(ellPart(a.x + 3.4 + sw, a.y + 6.5, 1.6, 1.1, 0, { mat: "flame", flare: 1.6, z: near ? 2.55 : 0.55, thick: 1.2 }));
  }
  if (q.fins) for (const s of [0.18, 0.55]) { const a = P[Math.floor(s * (n - 1))]; parts.push(part((u, v) => tri(u, v, a.x, a.y, a.x - 3, a.y + 6, a.x - 8, a.y + 3), [a.x - 9, a.y - 1, a.x + 1, a.y + 7], { mat: "membrane", z: 2.4 })); }
  // head ornaments
  if (st >= 2 && q.horns) hornsFor(q.horns, parts, Hx, Hy + 0.5, hs * 0.95, st, t);
  if (q.whiskers && st >= 2) for (const s of [1, -1]) {
    const W = []; for (let j = 0; j <= 10; j++) { const k = j / 10; W.push({ x: Hx + 8 * hs - k * 18, y: Hy + 2 * hs + s * 0.8 + S(k * 5 - t * 3 + s) * (1 + k * 3) + k * 3, r: lerp(0.8, 0.45, k) }); }
    parts.push(strandPart(W, { mat: "flame", flare: 0.6, z: s > 0 ? 2.9 : 0.4, thick: 0.8 }));
  }
  if (q.mane === "flame" && st >= 2) for (let i = 0; i < 4; i++) { const a = -2.6 - i * 0.25 + S(t * 2 + i) * 0.1, bx = Hx - 3 * hs, by = Hy - 1; parts.push(strandPart(curve([[bx, by], [bx + C(a) * 5, by + S(a) * 5], [bx + C(a) * 11 * hs, by + S(a) * 9 * hs]], 5, 2.6, 0.5), { mat: "flame", flare: 3, z: 1.7, thick: 2, seed: 20 + i })); }
  return { parts, eyes: [{ x: Hx + 1.8 * hs, y: Hy - 1.2 * hs, w: 1.9 * hs, h: (st === 1 ? 1.3 : 0.9) * hs, rot: -0.35, slit: st >= 2 }], head: [Hx, Hy - 7 * hs], core: [P[6].x, P[6].y] };
}

// --- birds ----------------------------------------------------------------------------------------------
function bird(L, st, t, px) {
  const q = { wings: "feather", plumes: [0, 2, 3, 5], crest: true, plumeMat: "flame", halo: false, ...L.q };
  const hs = HS[st] * 1.05, parts = [], b = S(t * 3) * 0.6, nk = q.neck ?? 0;
  const Hx = 6 + nk * 3, Hy = -6 - nk * 7 + b;
  parts.push(part((u, v) => smin(smin(smin(ell(u, v, -1, 0 + b * 0.4, 7.2, 5.4, -0.25), nk ? cap(u, v, 4, -3 + b, Hx - 0.5, Hy + 1, 2.8, 2) : 1e9, 1.5), ell(u, v, Hx, Hy, 3.6 * hs, 3.4 * hs), 2), cap(u, v, Hx + 2.6 * hs, Hy + 0.2, Hx + 6.5 * hs, Hy + 1.8 * hs, 1.3 * hs, 0.2), 0.4), [-9, Hy - 4 * hs, Hx + 7 * hs, 6], { z: 2, thick: 3.5, mark: anyMark(chevrons(-6, 3, 1.5, 3, 2.2, 0.5), lineMark(Hx - 1, Hy - 1.4 * hs, Hx + 2.5 * hs, Hy - 2.2 * hs, 0.45)) }));
  // beak
  parts.push(part((u, v) => tri(u, v, Hx + 2.4 * hs, Hy - 0.6 * hs, Hx + 2.6 * hs, Hy + 1.4 * hs, Hx + 6.8 * hs, Hy + 0.9 * hs), [Hx + 2 * hs, Hy - 1 * hs, Hx + 7 * hs, Hy + 2 * hs], { mat: "horn", z: 2.2 }));
  // crest
  if (q.crest) for (let i = 0; i < (st === 1 ? 2 : st === 2 ? 3 : 5); i++) { const a = -2.2 - i * 0.22 + S(t * 3 + i) * 0.1, Lc = (6 + i * 1.5) * (st === 1 ? 0.6 : 1); parts.push(strandPart(curve([[Hx - 1, Hy - 2.5 * hs], [Hx - 1 + C(a) * Lc * 0.5 + 1, Hy - 2.5 * hs + S(a) * Lc * 0.5], [Hx - 1 + C(a) * Lc, Hy - 2.5 * hs + S(a) * Lc]], 4, 1.5, 0.4), { mat: q.plumeMat === "flame" ? "flame" : "feather", flare: q.plumeMat === "flame" ? 2 : 0, z: 1.9, thick: 1.2, seed: i })); }
  // wings
  const flap = S(t * (st === 1 ? 7 : 3.6));
  for (const near of [0, 1]) {
    const nf = st === 1 ? 3 : 5, x0 = -1 - (near ? 0 : 2), y0 = -2.5;
    for (let i = 0; i < nf; i++) {
      const a = -1.75 - i * 0.24 - flap * 0.45 * (1 - i * 0.12) - (near ? 0 : 0.1), Lw = (st === 1 ? 8 : st === 2 ? 12 : 16) - i * 1.1;
      const P = curve([[x0, y0], [x0 + C(a + 0.35) * Lw * 0.55, y0 + S(a + 0.35) * Lw * 0.55], [x0 + C(a) * Lw, y0 + S(a) * Lw]], 6, 2.4, 0.9);
      parts.push(strandPart(P, { mat: q.wings === "flame" ? "flame" : q.wings === "ice" ? "crystal" : "feather", flare: q.wings === "flame" ? 2.6 : 0, z: near ? 2.6 - i * 0.01 : 0.2, dim: near ? 0 : 0.9, thick: 2, seed: i * 3 + near }));
    }
    if (q.wings2 && st >= 3) for (let i = 0; i < 3; i++) { const a = -2.6 - i * 0.25 + flap * 0.3, Lw = 10 - i; parts.push(strandPart(curve([[x0 + 1, y0 + 1], [x0 + C(a) * Lw * 0.5, y0 + S(a) * Lw * 0.5 + 2], [x0 + C(a) * Lw, y0 + S(a) * Lw + 4]], 5, 2, 0.7), { mat: "feather", z: near ? 2.55 : 0.15, dim: near ? 0.2 : 1, thick: 1.6 })); }
  }
  // tail plumes, long and sweeping, with eye spots at the ends
  const np = q.plumes[st];
  for (let i = 0; i < np; i++) {
    const k = np === 1 ? 0 : i / (np - 1) - 0.5, sw = S(t * 1.5 + i) * 2, Lp = (st === 3 ? 30 : 18) * (1 - Math.abs(k) * 0.3);
    const P = curve([[-7, 2], [-7 - Lp * 0.4, 3 + k * 6], [-7 - Lp * 0.8, 1 + k * 10 + sw], [-7 - Lp, -3 + k * 14 + sw * 1.3]], 12, 1.3, 0.45);
    parts.push(strandPart(P, { mat: q.plumeMat, flare: q.plumeMat === "flame" ? 2.2 : 0, z: 1.2 - Math.abs(k), thick: 1.5, seed: 40 + i }));
    if (st >= 2) { const e = P[P.length - 1]; parts.push(ellPart(e.x, e.y, 2.2, 1.6, 0.3, { mat: "jewel", z: 1.25 - Math.abs(k) })); }
  }
  if (q.halo && st >= 2) parts.push(part((u, v) => Math.abs(ell(u, v, Hx - 1, Hy - 7 * hs, 4.5, 1.4)) - 0.55, [Hx - 6, Hy - 9 * hs, Hx + 4, Hy - 5 * hs], { mat: "glow", z: 3 }));
  // legs tucked under
  for (const o of [0, -2]) parts.push(strandPart([{ x: -1 + o, y: 4, r: 0.9 }, { x: 0 + o, y: 8, r: 0.6 }, { x: 1.5 + o, y: 9, r: 0.5 }], { mat: "horn", z: o ? 0.5 : 2.1, dim: o ? 1 : 0 }));
  return { parts, eyes: [{ x: Hx + 1 * hs, y: Hy - 0.5 * hs, w: 1.4 * hs, h: (st === 1 ? 1.3 : 0.85) * hs, rot: -0.3, slit: false }], head: [Hx, Hy - 5 * hs - (q.crest ? 3 : 0)], core: [-1, -1] };
}

// --- sky whale / puffer -----------------------------------------------------------------------------------
function whale(L, st, t, px) {
  const q = { puffer: false, ...L.q }, parts = [], hs = HS[st];
  if (q.puffer) {
    const r = 7.5 + S(t * 2.5) * 0.4;
    parts.push(part((u, v) => ell(u, v, 0, 0, r * 1.05, r), [-r - 1, -r - 1, r + 1, r + 1], { z: 2, thick: 4, mark: anyMark(spiral(-1, 1, 3.5, 1.4, 0.6), dotsMark([[-4, -4], [2, -5], [-5, 2]], 0.7)) }));
    for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2 + 0.3, x = C(a) * r, y = S(a) * r; parts.push(part((u, v) => tri(u, v, x - S(a) * 1.4, y + C(a) * 1.4, x + S(a) * 1.4, y - C(a) * 1.4, x + C(a) * (3 + st), y + S(a) * (3 + st)), [x - 5, y - 5, x + 5, y + 5], { mat: "horn", z: 1.8 })); }
    const wag = S(t * 6) * 2;
    parts.push(part((u, v) => tri(u, v, -r + 1, 0, -r - 5, -4 + wag, -r - 5, 4 + wag), [-r - 6, -6, -r + 2, 6], { mat: "membrane", z: 1.5 }));
    parts.push(ellPart(1, 3, 3, 1.5, 0.6 + S(t * 7) * 0.4, { mat: "membrane", z: 2.5 }));
    return { parts, eyes: [{ x: 3.5, y: -2, w: 1.6, h: 1.6, rot: 0, slit: false }], head: [0, -r - 3], core: [0, 0] };
  }
  const len = [0, 0.6, 0.8, 1][st], b = S(t * 1.4) * 0.6, sw = S(t * 1.6) * 3;
  const P = [];
  for (let i = 0; i <= 12; i++) { const s = i / 12; P.push({ x: 10 - s * 34 * len, y: b + S(s * 2.4 - t * 1.4) * 2 * s + s * 1.5, r: (s < 0.35 ? lerp(8.5, 8, s / 0.35) : lerp(8, 1.6, (s - 0.35) / 0.65)) * (st === 1 ? 0.85 : 1) }); }
  const head = (u, v) => ell(u, v, 9, b - 0.5, 9.5, 7.5, 0.05);
  const bellyY = (u) => b + 3.5 - Math.max(0, -u) * 0.05;
  const bodyS = strandD(P);
  parts.push(part((u, v) => smin(bodyS(u, v), head(u, v), 3), unionBB(strandBB(P), [-1, b - 8, 19, b + 8]), { z: 2, thick: 6, mark: anyMark((u, v, px) => v > bellyY(u) && Math.abs(fract(v / 1.8) - 0.5) < Math.max(0.12, px * 0.3), spiral(2, b - 2.5, 4.5, 1.6, 0.7), spiral(-12 * len, b, 3, 1.4, 0.6)) }));
  const e = P[12];
  for (const s of [-1, 1]) parts.push(part((u, v) => ell(u, v, e.x - 4, e.y + s * 4 + sw * 0.4, 5.5, 2, s * 0.8), [e.x - 10, e.y - 8, e.x + 2, e.y + 8], { mat: "membrane", z: s > 0 ? 2.3 : 1.4, mark: (u, v, px) => Math.abs(v - e.y - s * 4) < px * 0.5 }));
  // great pectoral fins, rowing like wings
  for (const near of [0, 1]) { const a = 1.9 + S(t * 1.8) * 0.35 + (near ? 0 : -0.2), Lf = 12 * len + 4, x0 = 4 - (near ? 0 : 2), y0 = b + 4; parts.push(part((u, v) => smin(cap(u, v, x0, y0, x0 + C(a) * Lf, y0 + S(a) * Lf, 3.2, 1), cap(u, v, x0 + C(a) * Lf * 0.5, y0 + S(a) * Lf * 0.5, x0 + C(a - 0.5) * Lf * 0.8, y0 + S(a - 0.5) * Lf * 0.8, 1.6, 0.5), 1.5), [x0 - Lf, y0 - 4, x0 + Lf, y0 + Lf + 2], { mat: "membrane", z: near ? 2.6 : 0.6, dim: near ? 0 : 0.8, thick: 2 })); }
  if (st >= 2) parts.push(part((u, v) => tri(u, v, -4, b - 6.5, 2, b - 7, -8, b - 12 - st), [-9, b - 13 - st, 3, b - 5], { mat: "membrane", z: 1.8 }));
  if (st >= 3) for (let i = 0; i < 4; i++) parts.push(strandPart(curve([[12 - i * 4, b - 6.5], [10 - i * 4, b - 12], [6 - i * 4 + S(t * 2 + i) * 2, b - 16 - i]], 5, 1.6, 0.4), { mat: "flame", flare: 2.4, z: 1.7, thick: 1.4, seed: i }));
  return { parts, eyes: [{ x: 13, y: b - 0.5, w: 1.5 * hs, h: 1 * hs, rot: -0.2, slit: false }], head: [9, b - 10], core: [4, b] };
}

// --- moth / butterfly / firefly (seen from the front, wings spread) ------------------------------------
function moth(L, st, t, px) {
  const q = { tails: false, firefly: false, ...L.q }, parts = [], hs = HS[st], b = S(t * 2.4) * 0.8;
  const flap = q.firefly ? 0.55 + 0.45 * Math.abs(S(t * 16)) : 0.62 + 0.38 * Math.abs(S(t * 3.6));
  const sc = q.firefly ? 0.6 : [0, 0.62, 0.82, 1][st];
  parts.push(part((u, v) => smin(smin(ell(u, v, 0, b - 1, 2, 3.2), ell(u, v, 0, b - 5.6, 2.2 * hs, 2 * hs), 0.8), ell(u, v, 0, b + 5.5, 1.9, 5.5), 0.8), [-3, b - 8, 3, b + 11], { z: 3, thick: 2, mark: (u, v, px) => v > b + 1.5 && Math.abs(fract((v - b) / 2.2) - 0.5) < Math.max(0.14, px * 0.3) }));
  if (q.firefly) parts.push(ellPart(0, b + 8, 3.4, 4, 0, { mat: "lamp", z: 3.1, thick: 3 }));
  for (const s of [-1, 1]) {
    const P = curve([[s * 0.8, b - 7], [s * 2.5, b - 11], [s * (4.5 + S(t * 2) * 0.5), b - 13.5]], 6, 0.55, 0.35);
    parts.push(strandPart(P, { mat: "horn", z: 3.2, thick: 0.6 }));
    if (!q.firefly) parts.push(ellPart(P[6].x, P[6].y, 1.1, 1.1, 0, { mat: "jewel", z: 3.2 }));
    // fore and hind wing, ornate: spirals, eye rings and a bright border
    const fw = (u, v) => ell(u, v, s * 8.5 * sc * flap, b - 5 * sc, 9 * sc * flap, 6.2 * sc, -s * 0.5);
    const hw = (u, v) => ell(u, v, s * 6 * sc * flap, b + 5 * sc, 6 * sc * flap, 5.2 * sc, s * 0.6);
    const tailD = q.tails && st >= 2 ? strandD(curve([[s * 7 * sc * flap, b + 8 * sc], [s * 11 * sc * flap, b + 14 * sc], [s * (9 * sc * flap + S(t * 2) * 1.2), b + 21 * sc]], 8, 1.7, 0.9)) : null;
    const wingD = (u, v) => { let d = Math.min(fw(u, v), hw(u, v)); if (tailD) d = Math.min(d, tailD(u, v)); return d; };
    const mark = anyMark(spiral(s * 9 * sc * flap, b - 5.5 * sc, 3.6 * sc, 1.4, 0.5, s > 0 ? 0 : PI), ringMark(s * 6.5 * sc * flap, b + 5.5 * sc, 2.2 * sc, 0.5), (u, v, px) => Math.abs(fw(u, v) + 1.1) < Math.max(0.3, px * 0.5) || Math.abs(hw(u, v) + 0.9) < Math.max(0.3, px * 0.5));
    parts.push(part(wingD, [s > 0 ? -1 : -19 * sc - 2, b - 13 * sc, s > 0 ? 19 * sc + 2 : 1, b + 23 * sc], { mat: "membrane", z: 2, thick: 3.2, mark: q.firefly && st < 2 ? null : mark, c: [0, b] }));
  }
  return { parts, eyes: [-1, 1].map((s) => ({ x: s * 1.1, y: b - 5.8, w: 0.9 * hs, h: 0.95 * hs, rot: 0, slit: false })), head: [0, b - 10], core: [0, b] };
}

// --- bat / shadow wyvern (front view, wings spread) --------------------------------------------------
function bat(L, st, t, px) {
  const q = { wyvern: false, ...L.q }, parts = [], hs = HS[st], b = S(t * 3.4) * 1.2, wy = q.wyvern && st >= 2;
  const sc = wy ? 1 : [0, 0.7, 0.85, 1][st], Hy = b - (wy ? 8 : 5.5) * sc;
  const body = (u, v) => smin(ell(u, v, 0, b + 1, 4.4 * sc, 5.6 * sc), ell(u, v, 0, Hy, 3.9 * hs * sc, 3.5 * hs * sc), 1.6);
  parts.push(part(body, [-6, Hy - 5, 6, b + 8], { z: 2, thick: 3.5, mark: anyMark(chevrons(-3.4, 3.4, b + 2, 2.4, 2, 0.45), spiral(0, b + 1.4, 2.4 * sc, 1.3, 0.45)) }));
  for (const s of [-1, 1]) {
    if (wy) hornsFor("spikes", parts, s * 1.2, Hy + 1, hs * 0.9, st, t);
    else parts.push(part((u, v) => tri(u, v, s * 1.2, Hy - 2, s * 4, Hy - 1.5, s * 3.6, Hy - 8.5 * hs * sc), [s > 0 ? 0 : -5, Hy - 9 * hs, s > 0 ? 5 : 0, Hy], { z: 2.4, mark: (u, v) => tri(u, v, s * 1.9, Hy - 2.2, s * 3.4, Hy - 2, s * 3.2, Hy - 6.5 * hs * sc) < 0 }));
    // wing: finger bones fanning out, a membrane scalloped between them
    const flap = S(t * (wy ? 2.6 : 6.5)), span = (wy ? 23 : 15) * sc, x0 = s * 3 * sc, y0 = b - 2 * sc;
    const bones = [0, 1, 2, 3].map((i) => { const a = -0.55 + i * 0.42 - flap * 0.35 * (1 - i * 0.2), Lb = span * (1 - i * 0.16); return [x0 + s * C(a) * Lb, y0 + S(a) * Lb]; });
    const poly = [[x0, y0 - 1], ...bones, [x0, y0 + 5 * sc]];
    const memb = (u, v) => { let d = 1e9, sg = 1; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [ax, ay] = poly[j], [bx, by] = poly[i], ex = bx - ax, ey = by - ay, wx = u - ax, wy2 = v - ay, tt = clamp((wx * ex + wy2 * ey) / (ex * ex + ey * ey || 1)); d = Math.min(d, Math.hypot(wx - ex * tt, wy2 - ey * tt)); if ((ay > v) !== (by > v) && u < (ex * (v - ay)) / ey + ax) sg = -sg; } let r = sg * d; for (let i = 1; i < bones.length; i++) { const [ax, ay] = bones[i - 1], [bx, by] = bones[i]; r = Math.max(r, -(Math.hypot(u - (ax + bx) / 2, v - (ay + by) / 2 - 1.2) - Math.hypot(bx - ax, by - ay) * 0.34)); } return r; };
    parts.push(part(memb, unionBB(...poly.map(([x, y]) => [x - 1, y - 1, x + 1, y + 1])), { mat: "membrane", z: 1.5, thick: 2.6, flare: wy ? 2 : 0, flow: [0, 1], mark: wy ? null : (u, v, px) => Math.abs(memb(u, v) + 0.9) < Math.max(0.3, px * 0.5) }));
    for (const [bx, by] of bones) parts.push(strandPart([{ x: x0, y: y0, r: 1 }, { x: bx, y: by, r: 0.45 }], { mat: "horn", z: 1.6, thick: 0.8 }));
    parts.push(strandPart([{ x: s * 1.6, y: b + 5.5 * sc, r: 0.9 }, { x: s * 2.2, y: b + 8 * sc, r: 0.6 }], { mat: "horn", z: 2.1 }));
  }
  if (wy) {
    const P = curve([[0, b + 5], [3, b + 11], [-4, b + 15 + S(t * 2) * 1.5], [1, b + 20]], 12, 2.6, 0.5);
    parts.push(strandPart(P, { z: 1.8, thick: 2 }));
    const e = P[P.length - 1]; parts.push(part((u, v) => tri(u, v, e.x, e.y - 1, e.x - 3, e.y + 3.5, e.x + 3, e.y + 3.5), [e.x - 3.5, e.y - 1, e.x + 3.5, e.y + 4], { mat: "horn", z: 1.85 }));
  }
  return { parts, eyes: [-1, 1].map((s) => ({ x: s * 1.5 * hs * sc, y: Hy - 0.2, w: 1.1 * hs * sc, h: 0.75 * hs * sc + 0.2, rot: s * 0.35, slit: st >= 2 })), head: [0, Hy - 7 * hs * sc], core: [0, b] };
}

// --- jellyfish -------------------------------------------------------------------------------------------
function jelly(L, st, t, px) {
  const parts = [], b = S(t * 1.6) * 1.5, pulse = S(t * 3) * 0.08, sc = [0, 0.62, 0.82, 1][st], R = 9 * sc;
  parts.push(part((u, v) => { const d = ell(u, v, 0, b, R * (1 + pulse), R * (0.8 - pulse)); const frill = S(Math.atan2(v - b, u) * 10 + t * 2) * 0.5; return Math.max(d - frill * clamp((v - b + 1) / 3), v - (b + R * 0.35)); }, [-R - 2, b - R, R + 2, b + R * 0.5], { z: 2, thick: 4, mark: anyMark(spiral(0, b - R * 0.2, R * 0.55, 1.8, 0.55), ringMark(0, b, R * 0.8, 0.4)) }));
  const n = 3 + st * 2;
  for (let i = 0; i < n; i++) {
    const x0 = (i / (n - 1) - 0.5) * R * 1.5, Lt = (10 + st * 6) * (0.7 + 0.3 * S(i * 1.9)), P = [];
    for (let j = 0; j <= 12; j++) { const s = j / 12; P.push({ x: x0 + S(s * 4 - t * 3 + i) * (1 + s * 2.5) - s * 3, y: b + R * 0.3 + s * Lt, r: lerp(i % 2 ? 0.7 : 1.4, 0.35, s) }); }
    parts.push(strandPart(P, { mat: i % 2 ? "flame" : "membrane", flare: i % 2 ? 0.8 : 0, z: i % 2 ? 1 : 1.5, thick: 1, flow: [0, 1] }));
  }
  return { parts, eyes: [{ x: R * 0.3, y: b + R * 0.05, w: 1.1, h: 1.1, rot: 0, slit: false }, { x: -R * 0.25, y: b + R * 0.05, w: 1.1, h: 1.1, rot: 0, slit: false }], head: [0, b - R - 3], core: [0, b] };
}

// --- watcher eye ---------------------------------------------------------------------------------------
function watcher(L, st, t, px) {
  const parts = [], b = S(t * 1.5) * 1.6, sc = [0, 0.65, 0.85, 1][st], R = 8 * sc;
  parts.push(part((u, v) => ell(u, v, 0, b, R, R), [-R, b - R, R, b + R], { mat: "eye", z: 2, thick: R }));
  // lids
  parts.push(part((u, v) => Math.max(ell(u, v, 0, b - R * 0.55, R * 1.3, R * 0.75, 0), -ell(u, v, 0, b + R * 0.1, R * 1.05, R * 0.8)), [-R * 1.3, b - R * 1.4, R * 1.3, b], { z: 2.2, thick: 2, mark: chevrons(-R, R, b - R * 0.9, 2.5, 1.2, 0.45) }));
  for (let i = 0; i < 2 + st * 2; i++) {
    const a = PI * 0.25 + i / (1 + st * 2) * PI * 0.5, x0 = C(a) * R * 0.8 * (i % 2 ? 1 : -1) * 0.8, P = [];
    for (let j = 0; j <= 10; j++) { const s = j / 10; P.push({ x: x0 + S(s * 4 - t * 3 + i) * (1 + s * 3), y: b + R * 0.7 + s * (8 + st * 5), r: lerp(1.6, 0.3, s) }); }
    parts.push(strandPart(P, { mat: "flame", flare: 1.6, z: 1, thick: 1.2, flow: [0, 1], seed: i }));
  }
  if (st >= 2) for (let k = 0; k < st - 1; k++) { const rr = R * (1.6 + k * 0.45), tilt = 0.35 + k * 0.4 + t * 0.2; parts.push(part((u, v) => { const du = u, dv = (v - b), c = C(tilt), s = S(tilt), a = du * c + dv * s, bb = -du * s + dv * c; return Math.abs(Math.hypot(a, bb * 3.2) - rr) - 0.55; }, [-rr - 1, b - rr - 1, rr + 1, b + rr + 1], { mat: "glow", z: k % 2 ? 3 : 0.5 })); }
  if (st >= 3) for (let i = 0; i < 5; i++) { const a = t * 0.6 + i / 5 * PI * 2, x = C(a) * R * 2, y = b + S(a) * R * 0.9 - 2; parts.push(part((u, v) => tri(u, v, x, y - 2.4, x + 1.1, y + 1.4, x - 1.1, y + 1.4), [x - 2, y - 3, x + 2, y + 2], { mat: "crystal", z: S(a) > 0 ? 3 : 0.4 })); }
  return { parts, eyes: [], head: [0, b - R - 4], core: [0, b], iris: { x: 0, y: b, r: R } };
}

// --- wraiths: hooded lantern-bearers and spectral knights -----------------------------------------------
function wraith(L, st, t, px) {
  const q = { knight: false, lantern: true, ...L.q }, parts = [], b = S(t * 1.8) * 1.4, sc = [0, 0.66, 0.84, 1][st];
  const hy = -9 * sc + b, H = 13 * sc;
  parts.push(part((u, v) => { const yy = v - hy; if (yy < 0) return ell(u, v, 0, hy, 5.2 * sc, 5.4 * sc); const w = lerp(5.2, 7.8, clamp(yy / H)) * sc + S(yy * 0.6 - t * 4) * 0.6; return Math.max(Math.abs(u + yy * 0.12) - w, yy - H - S(u * 1.2 + t * 5) * 1.5); }, [-9 * sc - 2, hy - 6 * sc, 9 * sc + 2, hy + H + 3], { z: 2, thick: 3.5, flare: 2.4, flow: [-0.4, 1], mark: q.knight ? anyMark(lineMark(0, hy + 5 * sc, 0, hy + H, 0.5), chevrons(-5 * sc, 5 * sc, hy + 8 * sc, 3, 1.5, 0.5)) : anyMark(ringMark(0, hy + 7 * sc, 2.6 * sc, 0.45), lineMark(-4 * sc, hy + H - 2, 4 * sc, hy + H - 2, 0.4)) }));
  // the face: a dark hollow with eyes
  parts.push(ellPart(1.4 * sc, hy + 0.5, 3.4 * sc, 3.3 * sc, 0, { mat: "void", z: 2.5 }));
  if (q.knight) {
    parts.push(part((u, v) => Math.max(ell(u, v, 0.5, hy - 0.5, 5.6 * sc, 5.6 * sc), -(Math.max(Math.abs(u - 2.5 * sc) - 2.6 * sc, Math.abs(v - hy - 0.6) - 0.9))), [-6, hy - 6, 6.5, hy + 5], { mat: "horn", z: 2.6, mark: lineMark(0.5, hy - 5.5 * sc, 0.5, hy - 1.2, 0.45) }));
    parts.push(strandPart(curve([[0, hy - 5.5 * sc], [-4, hy - 9 * sc], [-9 * sc, hy - 6 * sc + S(t * 3)]], 6, 1.8, 0.5), { mat: "flame", flare: 2.5, z: 2.4, thick: 1.4 }));
    for (const s of [1, -1]) parts.push(ellPart(s * 5 * sc, hy + 6 * sc, 3.4 * sc, 2.2 * sc, s * 0.3, { mat: "horn", z: s > 0 ? 2.7 : 1.2, dim: s > 0 ? 0 : 0.8 }));
    // spectral sword
    const sx = 8 * sc, sy = hy + 9 * sc;
    parts.push(part((u, v) => tri(u, v, sx - 1.3, sy, sx + 1.3, sy, sx + 0.3, sy - 22 * sc), [sx - 2, sy - 22 * sc, sx + 2, sy], { mat: "glow", z: 2.8 }));
    parts.push(strandPart([{ x: sx - 3, y: sy, r: 0.8 }, { x: sx + 3, y: sy, r: 0.8 }], { mat: "horn", z: 2.85 }));
  } else {
    parts.push(part((u, v) => { const yy = v - hy; return Math.max(ell(u, v, -0.5, hy, 6.4 * sc, 6.6 * sc), -ell(u, v, 2, hy + 1, 4.5 * sc, 4.6 * sc), -(yy - 2) - 9); }, [-7, hy - 7, 7, hy + 6], { z: 2.4, thick: 2 }));
  }
  if (q.lantern) {
    const lx = 9 * sc + S(t * 1.6) * 0.8, ly = hy + 9 * sc + Math.abs(S(t * 1.6)) * 0.6, lr = 3 * sc + 1;
    parts.push(strandPart([{ x: 3 * sc, y: hy + 6 * sc, r: 1.3 }, { x: lx - 1, y: ly - lr - 2, r: 0.9 }], { z: 2.3, thick: 1 }));
    parts.push(part((u, v) => Math.abs(ell(u, v, lx, ly, lr, lr * 1.25)) - 0.5, [lx - lr - 1, ly - lr * 1.3 - 1, lx + lr + 1, ly + lr * 1.3 + 1], { mat: "horn", z: 2.9 }));
    parts.push(ellPart(lx, ly + 0.3, lr * 0.65, lr * 0.9, 0, { mat: "lamp", z: 2.85, flare: 1, thick: 2 }));
  }
  return { parts, eyes: [{ x: 2.6 * sc, y: hy + 0.6, w: 1.2, h: 0.75, rot: -0.2, slit: false }, { x: -0.2 * sc, y: hy + 0.6, w: 1, h: 0.7, rot: -0.2, slit: false }], head: [0, hy - 8 * sc], core: [0, hy + 3] };
}

// --- beetle ---------------------------------------------------------------------------------------------
function beetle(L, st, t, px) {
  const parts = [], hs = HS[st], sc = [0, 0.66, 0.85, 1][st], b = Math.abs(S(t * 3)) * -0.6;
  const R = 10 * sc;
  parts.push(part((u, v) => smin(Math.max(ell(u, v, -1, b, R * 1.15, R * 0.85), v - b - R * 0.3), ell(u, v, R * 0.95, b + 0.5, 4 * hs * sc + 1.5, 3.4 * hs * sc + 1), 1.2), [-R * 1.2 - 1, b - R, R + 6, b + R * 0.4], { mat: "shell", z: 2, thick: 4, mark: anyMark(lineMark(-R * 0.1, b - R * 0.82, -R * 0.4, b + R * 0.3, 0.45), spiral(-R * 0.5, b - R * 0.3, R * 0.35, 1.3, 0.55), spiral(R * 0.25, b - R * 0.35, R * 0.28, 1.3, 0.5)) }));
  const hx = R * 1.1 + 2, hy = b - 1, k = [0, 0.6, 0.85, 1][st];
  parts.push(strandPart(curve([[hx - 1, hy], [hx + 5 * k, hy - 3 * k], [hx + 6 * k, hy - 10 * k], [hx + 3 * k, hy - 14 * k]], 8, 2, 0.6), { mat: "horn", z: 2.5 }));
  if (st >= 2) parts.push(strandPart(curve([[hx + 5.5 * k, hy - 9 * k], [hx + 8 * k, hy - 11 * k], [hx + 9 * k, hy - 13 * k]], 4, 0.9, 0.4), { mat: "horn", z: 2.5 }));
  for (let i = 0; i < 3; i++) for (const near of [0, 1]) { const x = (i - 1) * R * 0.6 + 1, sw = S(t * 8 + i * 2 + near) * 1; parts.push(strandPart([{ x, y: b + R * 0.2, r: 1.1 }, { x: x + 2 + sw, y: b + R * 0.2 + 3, r: 0.8 }, { x: x + 1 + sw, y: b + R * 0.2 + 6, r: 0.6 }], { mat: "horn", z: near ? 2.6 : 0.4, dim: near ? 0 : 0.9 })); }
  if (st >= 3) for (const s of [0, 1]) parts.push(ellPart(-R * 0.9, b - R * 0.7 - s * 2, R * 0.9, R * 0.35, -0.6 - s * 0.3 + S(t * 14) * 0.15, { mat: "membrane", z: s ? 0.3 : 0.2, thick: 2 }));
  return { parts, eyes: [{ x: R * 1.25 + 1, y: b - 0.4, w: 1.3, h: 1.1, rot: 0, slit: false }], head: [R, b - R - 6], core: [-1, b - 2] };
}

// --- owl -------------------------------------------------------------------------------------------------
function owl(L, st, t, px) {
  const parts = [], sc = [0, 0.66, 0.85, 1][st], b = S(t * 2.4) * 0.8, R = 8 * sc;
  parts.push(part((u, v) => smin(ell(u, v, 0, b + 2, R, R * 1.15), ell(u, v, 1, b - R * 0.6, R * 0.95, R * 0.8), 2), [-R - 1, b - R * 1.5, R + 2, b + R * 1.4], { z: 2, thick: 4, mark: anyMark(chevrons(-R * 0.6, R * 0.6, b + 4, 2.6, 2.2, 0.5), ringMark(1, b - R * 0.6, R * 0.68, 0.45)) }));
  for (const o of [0, 1]) parts.push(strandPart(curve([[o ? -3 * sc : 4 * sc, b - R * 1.1], [o ? -5 * sc : 5 * sc, b - R * 1.6], [o ? -6 * sc : 3 * sc, b - R * 2.1 + S(t * 3 + o)]], 4, 1.8, 0.4), { mat: "flame", flare: 2, z: o ? 1.8 : 2.2, thick: 1.4 }));
  parts.push(part((u, v) => tri(u, v, 2.6, b - R * 0.45, 4.4, b - R * 0.45, 3.4, b - R * 0.1), [2, b - R * 0.5, 5, b], { mat: "horn", z: 2.5 }));
  const open = st >= 3 ? 1 : 0.35, flap = S(t * 2.6) * 0.2;
  for (const near of [0, 1]) for (let i = 0; i < 5; i++) {
    const a = (near ? -1.9 : -1.3) - i * 0.25 * open + flap - (st >= 3 ? 0.4 : 0), x0 = near ? -R * 0.3 : R * 0.3, y0 = b - 1, Lw = R * (open * 1.4 + 0.8) - i;
    parts.push(strandPart(curve([[x0, y0], [x0 + C(a + 0.3) * Lw * 0.5, y0 + S(a + 0.3) * Lw * 0.5], [x0 + C(a) * Lw, y0 + S(a) * Lw + (st >= 3 ? 0 : R)]], 5, 2.2, 0.8), { mat: "feather", z: near ? 2.6 : 0.3, dim: near ? 0 : 0.8, thick: 1.6 }));
  }
  for (const o of [0, 2]) parts.push(strandPart([{ x: -1 + o, y: b + R * 1.05, r: 0.9 }, { x: -0.5 + o, y: b + R * 1.35, r: 0.7 }], { mat: "horn", z: 2.5 }));
  return { parts, eyes: [{ x: 4 * sc, y: b - R * 0.65, w: 1.8 * sc + 0.5, h: 1.8 * sc + 0.5, rot: 0, slit: true, round: true }, { x: -1.6 * sc, y: b - R * 0.65, w: 1.7 * sc + 0.4, h: 1.7 * sc + 0.4, rot: 0, slit: true, round: true }], head: [1, b - R * 2.2], core: [0, b] };
}

// --- dandelion puff ---------------------------------------------------------------------------------------
function puff(L, st, t, px) {
  const parts = [], sc = [0, 0.66, 0.85, 1][st], b = S(t * 1.6) * 1.6, R = 5 * sc + 1;
  parts.push(ellPart(0, b, R, R, 0, { z: 2, thick: 3, mark: spiral(0, b + 0.5, R * 0.7, 1.5, 0.5) }));
  const n = 8 + st * 4;
  for (let i = 0; i < n; i++) {
    const a = i / n * PI * 2 + S(t * 1.3 + i) * 0.08, L0 = R + (5 + st * 2.5) * (0.85 + 0.15 * S(i * 2.3)), x = C(a) * L0, y = b + S(a) * L0;
    parts.push(strandPart([{ x: C(a) * R * 0.8, y: b + S(a) * R * 0.8, r: 0.5 }, { x, y, r: 0.35 }], { mat: "membrane", z: 1.5, thick: 0.5 }));
    parts.push(ellPart(x, y, 1.6, 1.6, 0, { mat: "flame", flare: 1, z: 1.6, thick: 1.2, seed: i, flow: [-1, -0.3] }));
  }
  return { parts, eyes: [{ x: R * 0.35, y: b - 0.2, w: 1, h: 1.1, rot: 0, slit: false }, { x: -R * 0.3, y: b - 0.2, w: 1, h: 1.1, rot: 0, slit: false }], head: [0, b - R - 9], core: [0, b] };
}

// --- star sprite --------------------------------------------------------------------------------------------
function star(L, st, t, px) {
  const parts = [], sc = [0, 0.66, 0.85, 1][st], b = S(t * 2) * 1.2, R = 8 * sc, rot = S(t * 0.8) * 0.2;
  parts.push(part((u, v) => { const a = Math.atan2(v - b, u) + rot - PI / 2, d = Math.hypot(u, v - b), k = 0.5 + 0.5 * Math.pow(Math.abs(C(a * 2.5)), 2.4); return d - R * k; }, [-R, b - R, R, b + R], { z: 2, thick: 4, mark: spiral(0, b + 0.5, R * 0.42, 1.4, 0.5) }));
  for (let i = 0; i < 4 + st * 2; i++) { const a = t * 1.2 + i / (4 + st * 2) * PI * 2, rr = R * 1.6, x = C(a) * rr, y = b + S(a) * rr * 0.5; parts.push(ellPart(x, y, 1.2, 1.2, 0, { mat: "flame", flare: 0.8, z: S(a) > 0 ? 3 : 0.5, thick: 1 })); }
  if (st >= 2) parts.push(part((u, v) => Math.abs(Math.hypot(u, (v - b) * 2.4) - R * 1.6) - 0.5, [-R * 1.7, b - R, R * 1.7, b + R], { mat: "glow", z: 0.4 }));
  return { parts, eyes: [{ x: R * 0.25, y: b, w: 1.1, h: 1.2, rot: 0, slit: false }, { x: -R * 0.25, y: b, w: 1.1, h: 1.2, rot: 0, slit: false }], head: [0, b - R - 3], core: [0, b] };
}

// --- turtle: a great domed shell carried on stubby legs, a small wise head on a reaching neck --------------
function turtle(L, st, t, px) {
  const q = { crystal: false, moss: false, tree: false, ...L.q }, parts = [], hs = HS[st] * 1.1, b = S(t * 1.6) * 0.4, sw = S(t * 1.2) * 0.6;
  const R = 11.5, top = -2 + b;
  parts.push(part((u, v) => Math.max(ell(u, v, -1, top, R, R * 0.82), v - (top + 2.6)), [-1 - R, top - R, R, top + 3], { mat: "shell", z: 2.4, thick: 4.5, mark: anyMark(ringMark(-1, top + 1, R * 0.62, 0.5), spiral(-1, top - 3.2, 3.6, 1.4, 0.55), lineMark(-1 - R * 0.62, top - 1, -1 - R * 0.95, top - 3.5, 0.45), lineMark(-1 + R * 0.62, top - 1, -1 + R * 0.92, top - 4, 0.45)) }));
  parts.push(ellPart(-1, top + 2.6, R + 1, 2, 0, { mat: "horn", z: 2.45 }));
  const Hx = 15 + sw, Hy = top - 1.5 + sw * 0.5;
  parts.push(part((u, v) => smin(smin(smin(ell(u, v, 0, top + 4.5, 10, 3.6), cap(u, v, 8, top + 3, Hx - 1.5, Hy + 0.6, 3.4, 2.6 * hs), 1.5), ell(u, v, Hx, Hy, 3.6 * hs, 3 * hs), 1.2), ell(u, v, Hx + 3 * hs, Hy + 0.8 * hs, 2.4 * hs, 1.7 * hs), 0.8), [-11, Hy - 4 * hs, Hx + 6 * hs, top + 9], { z: 2, thick: 3, mark: lineMark(Hx - 2.5 * hs, Hy - 0.8 * hs, Hx + 0.6 * hs, Hy - 1.4 * hs, 0.4) }));
  parts.push(strandPart([{ x: Hx + 1 * hs, y: Hy + 1.5 * hs, r: 0.32 }, { x: Hx + 5 * hs, y: Hy + 1.4 * hs, r: 0.3 }], { mat: "void", z: 2.1 }));
  for (const near of [0, 1]) for (const [lx, ph] of [[6, 0], [-8, 1.5]]) {
    const o = near ? 0 : -2.5, k = S(t * 1.6 + ph + near) * 0.8, P = [{ x: lx + o, y: top + 5, r: 2.8 }, { x: lx + o + 1.4 + k, y: top + 8.5, r: 2.4 }];
    parts.push(strandPart(P, { z: near ? 3 : 0.5, dim: near ? 0 : 1, thick: 2 }));
    parts.push(ellPart(lx + o + 2 + k, top + 10, 1.9, 1.3, 0, { mat: "flame", flare: 2, z: near ? 3.05 : 0.55, thick: 1.6, dim: near ? 0 : 0.8, seed: lx + near, flow: [-0.6, -0.8] }));
  }
  parts.push(strandPart([{ x: -10, y: top + 4, r: 1.6 }, { x: -14, y: top + 5.5, r: 0.6 }], { z: 1.9 }));
  if (q.crystal) for (const [x, h, w, a] of [[-2, 9, 2.8, -0.1], [-7, 6, 2.2, -0.45], [3.5, 5, 2, 0.35]].slice(0, st)) {
    const tx = x + S(a) * h, ty = top - R * 0.75 - C(a) * h;
    parts.push(part((u, v) => tri(u, v, x - w, top - R * 0.6, x + w, top - R * 0.6, tx, ty), [Math.min(x - w, tx) - 1, ty - 1, Math.max(x + w, tx) + 1, top - R * 0.5], { mat: "crystal", z: 2.5 }));
  }
  if (q.moss) for (const [x, y, r] of [[-6, top - R * 0.55, 2.6], [3, top - R * 0.6, 2.2], [-10, top - R * 0.2, 1.8]].slice(0, st + 1)) parts.push(ellPart(x, y, r, r * 0.7, 0, { mat: "leaf", z: 2.42, thick: 1.5 }));
  if (q.tree && st >= 3) {
    parts.push(strandPart(curve([[2, top - R * 0.7], [3, top - R - 3], [1, top - R - 7]], 5, 1.1, 0.6), { mat: "horn", z: 2.55 }));
    for (const [x, y, r] of [[1, top - R - 9, 3.4], [-2.5, top - R - 7.5, 2.4], [4.5, top - R - 7, 2.2]]) parts.push(ellPart(x, y, r, r * 0.85, 0, { mat: "leaf", z: 2.56, thick: 2, mark: dotsMark([[x - 1, y - 1]], 0.6) }));
  }
  if (q.horns && st >= 2) hornsFor(q.horns, parts, Hx, Hy + 1, hs * 0.7, st, t);
  return { parts, eyes: [{ x: Hx + 1 * hs, y: Hy - 0.6 * hs, w: 1.1 * hs, h: (st === 1 ? 1.1 : 0.8) * hs, rot: -0.2, slit: false }], head: [-1, top - R - (q.tree && st >= 3 ? 13 : 3)], core: [-1, top] };
}

const BUILD = { quad: quadruped, turtle, dragon, bird, whale, moth, bat, jelly, watcher, wraith, beetle, owl, puff, star };

// ---------------------------------------------------------------------------------------------- render
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
// flame tongues: noise stretched along the flow direction and rushing that way
const flameN = (u, v, t, seed, fx, fy) => {
  const a = u * fx + v * fy, b = -u * fy + v * fx, x = b * 0.72, y = (a - t * 12) * 0.2;
  return clamp(0.5 + 0.5 * (noise2(x, y, seed) * 0.7 + noise2(x * 2.3, y * 2.3, seed + 5) * 0.3));
};

/**
 * Draw a beast. look: { kind, q, R (8-colour main ramp), A (accent ramp), F (flame ramp), markC, eyeC, flow }.
 * o: { stage, t, flip, alpha, glow, scale, fit (box px) }. (x, y): where the creature's middle goes.
 */
export function drawBeast(p, x, y, look, o) {
  const st = o.stage ?? 1, t = o.t ?? 0, f = o.flip ? -1 : 1, a0 = o.alpha ?? 1, glowK = o.glow ?? 1;
  const s0 = [0, 0.56, 0.76, 1][st];
  let sc = (o.scale ?? 1) * s0 * (look.size ?? 1);
  const pxGuess = 1 / sc;
  const B = BUILD[look.kind](look, st, t, pxGuess);
  const parts = B.parts.sort((a, b) => b.z - a.z);
  for (const P of parts) P.pad = (P.flare ? P.flare * 1.5 + 1 : 0) + 1;
  let bb = unionBB(...parts.map((P) => [P.bb[0] - P.pad, P.bb[1] - P.pad, P.bb[2] + P.pad, P.bb[3] + P.pad]));
  let cx = 0, cy = 0;
  if (o.fit) { const w = bb[2] - bb[0], h = bb[3] - bb[1]; sc = Math.min(o.fit / Math.max(w, h * 1.02), (o.maxScale ?? 1.6) * s0 * 1.6); cx = (bb[0] + bb[2]) / 2; cy = (bb[1] + bb[3]) / 2; }
  const px = 1 / sc;
  const R = look.R, A = look.A, F = look.F, [fx, fy] = look.flow, MK = look.markC, OL = look.OL, fringe = (look.fringe ?? 3) * (st === 1 ? 0.7 : 1);
  const X0 = Math.floor(x + Math.min(f * (bb[0] - cx), f * (bb[2] - cx)) * sc) - 1, X1 = Math.ceil(x + Math.max(f * (bb[0] - cx), f * (bb[2] - cx)) * sc) + 1;
  const Y0 = Math.floor(y + (bb[1] - cy) * sc) - 1, Y1 = Math.ceil(y + (bb[3] - cy) * sc) + 1;
  p.reset?.();
  const wire = look.q?.wire;
  // coarse pass: 4×4 pixel cells that no part (nor its flames or fringe) can reach are skipped whole
  const CS = 4, cellR = CS * 0.71 * px + fringe + px * 1.5, cellsX = Math.ceil((X1 - X0 + 1) / CS);
  const live = [];
  for (let cyy = Y0; cyy <= Y1; cyy += CS) for (let cxx = X0; cxx <= X1; cxx += CS) {
    const u = (cxx + CS / 2 - x) * f * px + cx, v = (cyy + CS / 2 - y) * px + cy;
    // keep only the parts that can reach this cell, in draw order
    const near = [];
    for (const P of parts) {
      const m = P.pad + cellR;
      if (u < P.bb[0] - m || u > P.bb[2] + m || v < P.bb[1] - m || v > P.bb[3] + m) continue;
      if (P.d(u, v) - (P.flare ? P.flare * 1.5 + 0.5 : 0) < cellR) near.push(P);
    }
    if (near.length) live.push(cxx, cyy, near);
  }
  for (let ci = 0; ci < live.length; ci += 3) { const cellParts = live[ci + 2]; for (let Y = live[ci + 1]; Y < Math.min(Y1 + 1, live[ci + 1] + CS); Y++) for (let X = live[ci]; X < Math.min(X1 + 1, live[ci] + CS); X++) {
    const u = (X + 0.5 - x) * f * px + cx, v = (Y + 0.5 - y) * px + cy;
    let hit = null, hd = 0, near = 1e9, flareHit = 0;
    for (const P of cellParts) {
      if (u < P.bb[0] - P.pad || u > P.bb[2] + P.pad || v < P.bb[1] - P.pad || v > P.bb[3] + P.pad) continue;
      let d = P.d(u, v);
      if (P.mat === "flame") {
        // procedural fire: hot at the root, breaking into tongues toward the tip and the edges
        const fl = P.flow ?? look.flow, reach = P.flare * 1.2 + 0.5;
        if (d > reach) continue;
        let along = P.hold ? P.hold.s : clamp(0.5 + ((u - P.c[0]) * fl[0] + (v - P.c[1]) * fl[1]) / ((P.bb[2] - P.bb[0]) + 1));
        const n = flameN(u, v, t, P.seed + 3, fl[0], fl[1]);
        const ff = (1 - along) * 0.62 + 0.24 - Math.max(0, d) / reach * 0.9 + Math.min(0, d) * -0.05 + (n - 0.5) * 1.05;
        if (ff > 0.32) { hit = P; hd = Math.min(d, -0.01); flareHit = ff; break; }
        continue;
      }
      if (P.flare && d < P.flare * 1.5 + 0.5) {
        const fl = P.flow ?? look.flow, du = u - P.c[0], dv = v - P.c[1], dl = Math.hypot(du, dv) || 1;
        const dir = clamp(0.3 + 0.7 * (du * fl[0] + dv * fl[1]) / dl);
        const n = flameN(u, v, t, P.seed + 3, fl[0], fl[1]), disp = P.flare * 1.5 * n * n * dir;
        if (d < 0) d -= disp * 0.25; else { d -= disp; if (d < 0) flareHit = 1; }
      }
      if (d < 0) { hit = P; hd = d; break; }
      if (P.mat !== "glow" && P.mat !== "flame" && d < near) near = d;
    }
    if (!hit) {
      // a living edge of energy around the whole body, licking away with the element's flow
      if (near < fringe + 0.5) {
        const du = u - B.core[0], dv = v - B.core[1], dl = Math.hypot(du, dv) || 1, dir = clamp(0.2 + 0.8 * (du * fx + dv * fy) / dl);
        const fn = flameN(u, v, t, 9, fx, fy), w = fringe * fn * dir;
        if (near < w) { const k = 1 - near / (w || 1); p.blendPx(X, Y, F[k > 0.5 ? 5 : 4], (0.4 + 0.4 * k) * a0); p.add(X, Y, F[5], 0.12 * k * glowK * a0); continue; }
      }
      if (near < px * 1.05) p.blendPx(X, Y, OL, 0.45 * a0);
      continue;
    }
    const depth = -hd, inner = clamp(depth / hit.thick);
    const ramp = hit.ramp === "light" ? look.L : hit.mat === "flame" || hit.mat === "lamp" ? F : (hit.mat === "horn" || hit.mat === "crystal" || hit.mat === "cap" || hit.mat === "jewel" || hit.mat === "petal" || hit.mat === "leaf") ? A : R;
    // light from the upper left: compare with a point toward the lower right
    let lit = 0;
    if (depth < 2.6 && hit.mat !== "glow") { const d2 = hit.d(u + px * 1.2, v + px * 1.2); lit = clamp((hd - d2) / (px * 1.7), -1, 1); }
    let idx, alpha = 1, glow = 0, c;
    switch (hit.mat) {
      case "flame": {
        const ff = flareHit;
        idx = (ff > 1.02 ? 7 : ff > 0.86 ? 6 : ff > 0.68 ? 5 : ff > 0.5 ? 4 : 3) - hit.dim; alpha = clamp(0.45 + (ff - 0.32) * 1.2, 0.45, 1); glow = 0.1 + 0.35 * clamp(ff - 0.4); break;
      }
      case "lamp": idx = 4.2 + inner * 3; glow = 0.35 + 0.35 * inner; break;
      case "glow": idx = 6.5; alpha = 0.8; glow = 0.45; break;
      case "membrane": idx = 3 + inner * 1.6 + lit * 1.2 - hit.dim; alpha = 0.55 + 0.25 * inner; glow = 0.06; break;
      case "feather": idx = 3.2 + inner * 2 + lit * 1.3 - hit.dim; alpha = 0.88; glow = 0.05; break;
      case "tooth": idx = 7; break;
      case "horn": case "cap": case "jewel": case "petal": case "leaf": idx = 4 + lit * 1.6 + inner * 1.4 - hit.dim; if (hit.mat === "jewel") { idx += 1.5; glow = 0.4; } break;
      case "crystal": idx = 4.2 + lit * 2 + (fract((u - v) * 0.35) < 0.18 ? 1.5 : 0) - hit.dim; alpha = 0.85; glow = 0.15; break;
      case "shell": idx = 3 + inner * 2 + lit * 1.4; break;
      case "void": idx = 0; alpha = 0.92; break;
      case "eye": { // the watcher's great eye
        const I = B.iris, lx = I.x + S(t * 0.7) * I.r * 0.25, d = Math.hypot(u - lx, v - I.y) / I.r;
        if (d < 0.18 || (Math.abs(u - lx) < Math.max(0.35, px * 0.5) && d < 0.5)) { c = hex("#06040a"); }
        else if (d < 0.52) { c = F[Math.round(clamp(7 - d * 6, 4, 7))]; glow = 0.5; }
        else c = mix(R[6], hex("#ffffff"), 0.5);
        break;
      }
      default: { // body: lit from inside, with flowing veins of brighter energy
        const rn = 1 - Math.abs(noise2(u * 0.17 + hit.seed, v * 0.17 - t * 0.9, 7));
        idx = 1.7 + Math.pow(inner, 0.85) * 3.5 + lit * 1.15 - hit.dim + (rn > 0.84 ? (rn - 0.84) * 12 : 0);
        alpha = 0.66 + 0.34 * inner; glow = 0.04 + 0.16 * inner * inner;
      }
    }
    if (!c) c = ramp[clamp(Math.round(idx), hit.mat === "void" ? 0 : 1, 7)];
    if (wire && hit.mat === "wire") {
      const edge = depth < px * 1.1, grid = fract(u / 3) < Math.max(0.12, px * 0.33) || fract((v + t * 6) / 3) < Math.max(0.12, px * 0.33);
      if (!edge && !grid) { p.blendPx(X, Y, R[1], 0.35 * a0); continue; }
      c = edge ? R[6] : R[5]; glow = 0.3;
    }
    if (hit.mark && hit.mat !== "void" && hit.mark(u, v, px)) { c = MK; glow = 0.35; alpha = 1; }
    if (hit.mat === "body" || hit.mat === "membrane" || hit.mat === "flame" || hit.mat === "glow" || hit.mat === "crystal" || (hit.mat === "void")) p.blendPx(X, Y, c, alpha * a0);
    else p.put(X, Y, c, a0);
    if (glow) p.add(X, Y, F[6], glow * glowK * a0);
  }
  }
  // eyes
  for (const E of B.eyes) {
    const ew = E.w + px * 0.4, eh = E.h + px * 0.4, r = Math.max(ew, eh) + 1;
    for (let j = -r; j <= r; j += px) for (let i = -r; i <= r; i += px) {
      const uu = E.x + i, vv = E.y + j, d = ell(uu, vv, E.x, E.y, ew, eh, E.rot);
      if (d > 0) continue;
      const X = Math.round(x + (uu - cx) * f * sc - 0.5), Y = Math.round(y + (vv - cy) * sc - 0.5);
      const slit = E.slit && Math.abs(i) < Math.max(0.3, px * 0.45) && (E.round ? Math.abs(j) < eh * 0.75 : true);
      p.put(X, Y, slit ? hex("#08060c") : -d > Math.min(ew, eh) * 0.45 ? look.eyeC : look.eyeRim, a0);
      p.add(X, Y, look.eyeRim, 0.5 * a0);
    }
  }
  // crown for the legendary
  if (o.crown) {
    const [hx, hy] = B.head, X = Math.round(x + (hx - cx) * f * sc), Y = Math.round(y + (hy - cy) * sc) - 1, g = hex("#ffd84a"), w = hex("#fff6c0");
    for (const dx of [-3, -1.5, 0, 1.5, 3]) { p.put(Math.round(X + dx), Y - (dx === 0 ? 2 : Math.abs(dx) > 2 ? 0 : 1), dx === 0 ? w : g, a0); }
    for (let dx = -3; dx <= 3; dx++) p.put(X + dx, Y + 1, g, a0);
    for (let j = -4; j <= 4; j++) for (let i = -5; i <= 5; i++) { const d = (i * i) / 25 + (j * j) / 16; if (d < 1) p.add(X + i, Y + j, g, 0.12 * (1 - d) * a0); }
  }
  // aura
  const [ax, ay] = B.core, AX = x + (ax - cx) * f * sc, AY = y + (ay - cy) * sc, gr = Math.max(bb[2] - bb[0], bb[3] - bb[1]) * sc * 0.6;
  for (let j = -gr; j <= gr; j++) for (let i = -gr; i <= gr; i++) { const d = (i * i + j * j) / (gr * gr); if (d < 1) p.add(Math.round(AX + i), Math.round(AY + j), F[5], 0.07 * glowK * a0 * (1 - d)); }
  return { sc, bb, cx, cy, head: B.head };
}

// ---------------------------------------------------------------------------------------------- looks
const ramp8 = (r) => fit(r, 8).map((c) => (typeof c === "number" ? c : hex(c)));
const norm = ([x, y]) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
const FLOW = { fire: [0, -1], water: [-0.8, 0.3], wind: [-1, -0.25], earth: [-0.2, -0.7], light: [0, -1], dark: [-0.5, -0.8], code: [0, 1] };
/** Resolve a spirit's look: def (roster entry), lk (its design), elRamp (the element's colours). */
export function makeLook(def, lk = {}, elRamp) {
  const W = hex("#ffffff");
  const R = ramp8(lk.R ?? def.tint ?? elRamp);
  const A = ramp8(lk.A ?? def.accent ?? [R[1], R[2], R[3], mix(R[4], W, 0.15), mix(R[5], W, 0.3), mix(R[6], W, 0.4), mix(R[7], W, 0.5), W]);
  const F = ramp8(lk.F ?? [R[1], R[2], R[3], R[4], R[5], R[6], R[7], W]);
  return {
    kind: lk.kind ?? "quad", q: lk.q ?? {}, R, A, F, L: ramp8([R[3], R[4], R[5], R[6], R[7], W, W, W]), flow: norm(lk.flow ?? FLOW[def.el] ?? [0, -1]), size: lk.size ?? 1, fringe: lk.fringe,
    markC: lk.mark ? hex(lk.mark) : mix(R[7], W, 0.3), eyeC: hex(lk.eye ?? "#ffffff"), eyeRim: lk.eyeRim ? hex(lk.eyeRim) : F[6], OL: mix(R[0], hex("#05040a"), 0.5),
  };
}
