// Sculpted pixel shapes for bosses: a signed-distance shape is filled with lambert shading from a light at
// the upper left (normals from the distance gradient, rounded toward the middle), quantized to a colour ramp
// with ordered dither, then outlined. Lets a boss be built from big chunky "rocks" and "cloth" that read as
// solid volumes at any angle.
import { hex, noise2 } from "../px.js";

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
const LX = -0.55, LY = -0.7, LZ = 0.46;

export const sd = {
  ellipse: (u, v, rx, ry) => { const k = Math.hypot(u / rx, v / ry); return (k - 1) * Math.min(rx, ry); },
  box: (u, v, hw, hh, r = 0) => { const qx = Math.abs(u) - hw + r, qy = Math.abs(v) - hh + r; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; },
  /** A lumpy rock: an ellipse whose rim wobbles with seeded noise (faceted by rounding the angle). */
  rock: (u, v, rx, ry, seed = 1, rough = 0.18, facets = 7) => {
    const a = Math.atan2(v / ry, u / rx), fa = Math.round(a / (Math.PI * 2) * facets) / facets * Math.PI * 2;
    const w = 1 + rough * (noise2(Math.cos(fa) * 2 + seed, Math.sin(fa) * 2 + seed, seed) - 0.5) * 2;
    return (Math.hypot(u / rx, v / ry) - w) * Math.min(rx, ry);
  },
  poly: (u, v, pts) => {
    let d = Infinity, s = 1;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [ax, ay] = pts[j], [bx, by] = pts[i], ex = bx - ax, ey = by - ay, wx = u - ax, wy = v - ay;
      const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey)));
      d = Math.min(d, Math.hypot(wx - ex * t, wy - ey * t));
      if ((ay > v) !== (by > v) && u < (ex * (v - ay)) / ey + ax) s = -s;
    }
    return s * d;
  },
};

/**
 * Fill a shape. p: painter (world coords via put/add). (cx, cy): world position of local (0, 0).
 * shape(u, v) → signed distance (px). o: { rot, sx, sy, ramp (dark→bright numbers), outline, r (bbox radius),
 *   paint(u, v, d, shade) → colour override | 0, glow: [colour, k] (light added on bright pixels), alpha, flip,
 *   tint (hit flash), rim: colour for a 1 px lit rim on the light side }
 */
export function sculpt(p, cx, cy, shape, o) {
  const R = o.ramp, n = R.length, rot = o.rot ?? 0, c = Math.cos(rot), s = Math.sin(rot);
  const sx = (o.sx ?? 1) * (o.flip ? -1 : 1), sy = o.sy ?? 1, rad = Math.ceil(o.r ?? 40), a = o.alpha ?? 1;
  const OL = o.outline ?? hex("#08070c"), soft = o.soft ?? 5;
  const X0 = Math.floor(cx - rad), Y0 = Math.floor(cy - rad), W = rad * 2 + 2;
  const D = new Float32Array(W * W);
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
    const dx = X0 + i + 0.5 - cx, dy = Y0 + j + 0.5 - cy;
    const u = (dx * c + dy * s) / sx, v = (-dx * s + dy * c) / sy;
    D[j * W + i] = shape(u, v);
  }
  const at = (i, j) => (i < 0 || j < 0 || i >= W || j >= W ? 9 : D[j * W + i]);
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
    const d = D[j * W + i], X = X0 + i, Y = Y0 + j;
    if (d > 0) {
      if (d < 1.4 && (at(i - 1, j) <= 0 || at(i + 1, j) <= 0 || at(i, j - 1) <= 0 || at(i, j + 1) <= 0)) p.put(X, Y, o.tint ?? OL, a);
      continue;
    }
    // normal from the distance gradient (screen space), bulging out toward the middle
    let gx = at(i + 1, j) - at(i - 1, j), gy = at(i, j + 1) - at(i, j - 1);
    const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
    const h = Math.min(1, -d / soft), nz = h, k = Math.sqrt(Math.max(0, 1 - nz * nz));
    const nx = gx * k, ny = gy * k;
    let shade = Math.max(0, nx * LX + ny * LY + nz * LZ) * 1.15 + 0.08;
    shade += BAYER[((Y & 3) << 2) | (X & 3)] * 0.1;
    let ci = Math.max(0, Math.min(n - 1, Math.floor(shade * (n - 0.01))));
    let col = R[ci];
    if (o.rim && d > -1.2 && nx * LX + ny * LY > 0.35) col = o.rim;
    if (o.paint) { const pc = o.paint(((X + 0.5 - cx) * c + (Y + 0.5 - cy) * s) / sx, (-(X + 0.5 - cx) * s + (Y + 0.5 - cy) * c) / sy, d, shade); if (pc) col = pc; }
    if (o.tint) col = o.tint;
    p.put(X, Y, col, a);
    if (o.glow && ci >= n - 2) p.add(X, Y, o.glow[0], o.glow[1] * a);
  }
}

/** A soft additive glow disc. */
export function glow(p, x, y, r, c, k = 0.3) {
  const R = Math.ceil(r);
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) { const d = (i * i + j * j) / (r * r); if (d < 1) p.add(Math.round(x + i), Math.round(y + j), c, k * (1 - d) * (1 - d)); }
}

/** A glowing energy line (joint links between floating chunks, beams, cracks). */
export function energy(p, x0, y0, x1, y1, core, outer, w = 1, k = 0.35) {
  const L = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let s = 0; s <= L; s++) {
    const x = Math.round(x0 + (x1 - x0) * s / L), y = Math.round(y0 + (y1 - y0) * s / L);
    for (let dy = -w; dy <= w; dy++) for (let dx = -w; dx <= w; dx++) if (dx * dx + dy * dy <= w * w) p.put(x + dx, y + dy, dx === 0 && dy === 0 ? core : outer);
    if (s % 2 === 0) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const dd = dx * dx + dy * dy; if (dd < 5) p.add(x + dx, y + dy, outer, k * 0.1 * (1 - dd / 5)); }
  }
}

export const ramp = (list) => list.map((c) => (typeof c === "number" ? c : hex(c)));
