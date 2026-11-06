// Spirits as small, bright creatures with a showy trail. The body is a round little core with a few
// features that say who it is (ears, horns, wings, a crest, a shell); the trail streaming behind carries the
// element: ribbons of flame, bubbles and water, wind streaks and leaves, crystal dust, starlight, smoke,
// falling digits. Features are derived from each spirit's design entry in looks.js.
import { hex, mix, fit } from "../px.js";

const S = Math.sin, C = Math.cos, PI = Math.PI;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k); return lerp(b, a, h) - k * h * (1 - h); };
let COV = new Float32Array(4096), KK = new Float32Array(4096);
const hash = (i, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

const ell = (u, v, cx, cy, rx, ry, rot = 0) => {
  let du = u - cx, dv = v - cy;
  if (rot) { const c = C(rot), s = S(rot), a = du * c + dv * s; dv = -du * s + dv * c; du = a; }
  return (Math.hypot(du / rx, dv / ry) - 1) * Math.min(rx, ry);
};
const tri = (u, v, ax, ay, bx, by, cx, cy) => {
  const e = (px, py, qx, qy) => (u - px) * (qy - py) - (v - py) * (qx - px);
  const d1 = e(ax, ay, bx, by), d2 = e(bx, by, cx, cy), d3 = e(cx, cy, ax, ay);
  const inside = (d1 <= 0 && d2 <= 0 && d3 <= 0) || (d1 >= 0 && d2 >= 0 && d3 >= 0);
  const seg = (px, py, qx, qy) => { const ex = qx - px, ey = qy - py, t = clamp(((u - px) * ex + (v - py) * ey) / (ex * ex + ey * ey || 1)); return Math.hypot(u - px - ex * t, v - py - ey * t); };
  const d = Math.min(seg(ax, ay, bx, by), seg(bx, by, cx, cy), seg(cx, cy, ax, ay));
  return inside ? -d : d;
};
const cap = (u, v, ax, ay, bx, by, ra, rb) => { const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey || 1, t = clamp(((u - ax) * ex + (v - ay) * ey) / l2); return Math.hypot(u - ax - ex * t, v - ay - ey * t) - lerp(ra, rb, t); };

// ------------------------------------------------------------------------------------------ features
/** Turn a looks.js design into the few features a small spirit shows, and its trail. */
export function featuresOf(look, el) {
  const q = look.q ?? {}, k = look.kind;
  const F = { body: "orb", ears: null, horns: null, wings: null, crest: false, beak: false, whiskers: false, shell: false, spikes: false, mane: null, tails: 0, trail: TRAIL_BY_EL[el] ?? "dust", bigEyes: false };
  if (k === "quad") {
    F.ears = q.ears === "none" ? null : q.ears ?? "lion";
    if (q.head === "drake") F.ears = "fin";
    F.horns = q.horns ?? null;
    F.mane = q.mane && q.mane !== "none" ? q.mane : null;
    if (q.wool) F.body = "cloud";
    if (q.tail === "fox" || q.tail === "star") { F.tails = q.tails ?? 1; F.trail = "tails"; }
    if (q.tail === "ribbon") { F.tails = q.tails ?? 2; F.trail = "ribbons"; }
    if (q.back === "caps") F.cap = true;
    if (q.back === "flowers") F.flower = true;
    if (q.back === "crystal") F.crystals = true;
  } else if (k === "turtle") { F.shell = true; F.horns = q.horns ?? null; F.crystals = !!q.crystal; F.tree = !!q.tree; }
  else if (k === "dragon") { F.horns = q.horns ?? null; F.whiskers = !!q.whiskers; F.ears = "fin"; F.trail = q.wire ? "code" : "serpent"; }
  else if (k === "bird") { F.wings = q.wings === "flame" ? "flame" : q.wings === "ice" ? "ice" : "feather"; F.crest = true; F.beak = true; F.trail = "plumes"; F.halo = !!q.halo; }
  else if (k === "whale") { if (q.puffer) F.spikes = true; else { F.body = "whale"; F.fins = true; } }
  else if (k === "moth") { F.wings = "moth"; F.antennae = true; F.lamp = !!q.firefly; }
  else if (k === "bat") { F.wings = "bat"; F.ears = "bat"; F.horns = q.wyvern ? "spikes" : null; }
  else if (k === "jelly") { F.body = "bell"; F.trail = "tentacles"; }
  else if (k === "watcher") { F.body = "eye"; F.rings = true; }
  else if (k === "wraith") { F.body = "ghost"; F.trail = "smoke"; F.lantern = !!q.lantern; F.helmet = !!q.knight; }
  else if (k === "beetle") { F.shell = true; F.horns = "beetle"; }
  else if (k === "owl") { F.ears = "tuft"; F.bigEyes = true; F.wings = "feather"; }
  else if (k === "puff") { F.body = "puff"; F.trail = "seeds"; }
  else if (k === "star") { F.body = "star"; }
  return F;
}
const TRAIL_BY_EL = { fire: "flame", water: "water", wind: "wind", earth: "crystal", light: "stars", dark: "shadow", code: "code" };

// ------------------------------------------------------------------------------------------ body
// local space: (0, 0) the middle of the core, +u the facing side, v down; r = core radius
function shapes(F, st, t, r) {
  const parts = []; // [sdf, colourRole] role: 0 body, 1 accent, 2 glow
  const bob = 0;
  const P = (d, role = 0, front = true) => parts.push({ d, role, front });
  if (F.body === "orb" || F.body === "cloud") {
    P((u, v) => ell(u, v, 0, 0, r * 1.05, r));
    if (F.body === "cloud") for (let i = 0; i < 5; i++) { const a = -PI * 0.9 + i * 0.45; P((u, v) => Math.hypot(u - C(a) * r * 0.85, v - S(a) * r * 0.75) - r * 0.45); }
  } else if (F.body === "whale") P((u, v) => smin(ell(u, v, 0, 0, r * 1.35, r * 0.9), ell(u, v, -r * 1.3, r * 0.1, r * 0.5, r * 0.3), 1.5));
  else if (F.body === "bell") P((u, v) => Math.max(ell(u, v, 0, 0, r * 1.1, r), v - r * 0.35));
  else if (F.body === "eye") P((u, v) => Math.hypot(u, v) - r);
  else if (F.body === "ghost") P((u, v) => { if (v < 0) return Math.hypot(u, v) - r; const w = r * (1 - v / (r * 2.4)); return Math.max(Math.abs(u) - w, v - r * 1.6 - S(u * 1.3 + t * 5) * 1.2); });
  else if (F.body === "puff") P((u, v) => Math.hypot(u, v) - r * 0.6);
  else if (F.body === "star") P((u, v) => { const a = Math.atan2(v, u) + PI / 2 + S(t) * 0.2, d = Math.hypot(u, v); return d - r * (0.55 + 0.45 * Math.pow(Math.abs(C(a * 2.5)), 2.2)); });
  // ears
  const ey = -r * 0.75;
  if (F.ears === "fox" || F.ears === "wolf") { const h = r * (F.ears === "fox" ? 1.15 : 0.9); for (const [x, f] of [[r * 0.15, 1], [-r * 0.55, 0]]) P((u, v) => tri(u, v, x - r * 0.38, ey + 1, x + r * 0.32, ey + 1, x - r * 0.12, ey - h), 0, !!f); }
  else if (F.ears === "cat") { for (const [x, f] of [[r * 0.25, 1], [-r * 0.5, 0]]) P((u, v) => tri(u, v, x - r * 0.35, ey + 1.2, x + r * 0.35, ey + 1.2, x, ey - r * 0.65), 0, !!f); }
  else if (F.ears === "deer") { for (const [x, f] of [[r * 0.1, 1], [-r * 0.6, 0]]) P((u, v) => ell(u, v, x - r * 0.35, ey, r * 0.5, r * 0.22, -0.6), 0, !!f); }
  else if (F.ears === "lion") { for (const x of [r * 0.35, -r * 0.45]) P((u, v) => Math.hypot(u - x, v - ey * 0.95) - r * 0.28); }
  else if (F.ears === "fin") { for (const [o, f] of [[0, 1], [-2, 0]]) P((u, v) => tri(u, v, -r * 0.1 + o, ey + 2, -r * 0.4 + o, ey + 3, -r * 1.05 + o, ey - r * 0.45), 1, !!f); }
  else if (F.ears === "bat") { for (const x of [r * 0.45, -r * 0.45]) P((u, v) => tri(u, v, x - r * 0.35, ey + 1, x + r * 0.35, ey + 1, x * 1.25, ey - r * 0.95)); }
  else if (F.ears === "tuft") { for (const x of [r * 0.45, -r * 0.45]) P((u, v) => tri(u, v, x - r * 0.25, ey + 1, x + r * 0.25, ey + 1, x * 1.35, ey - r * 0.6), 1); }
  // horns
  if (st >= 2 || F.horns === "beetle") {
    const hy = -r * 0.85, k = st === 3 ? 1.25 : 1;
    if (F.horns === "single") P((u, v) => tri(u, v, r * 0.1, hy + 1, r * 0.45, hy + 1, r * 0.5, hy - r * 0.9 * k), 1);
    else if (F.horns === "antler" || F.horns === "branch") for (const [x, f] of [[r * 0.05, 1], [-r * 0.5, 0]]) {
      P((u, v) => Math.min(cap(u, v, x, hy + 1, x - r * 0.35, hy - r * 0.7 * k, 0.8, 0.5), cap(u, v, x - r * 0.2, hy - r * 0.35 * k, x + r * 0.15, hy - r * 0.75 * k, 0.6, 0.4)), 1, !!f);
    }
    else if (F.horns === "curl") for (const x of [r * 0.2, -r * 0.55]) P((u, v) => Math.abs(Math.hypot(u - x + r * 0.2, v - hy) - r * 0.32) - 0.7, 1);
    else if (F.horns === "crystal") P((u, v) => Math.min(tri(u, v, -r * 0.2, hy + 1, r * 0.2, hy + 1, 0, hy - r * 0.8 * k), tri(u, v, r * 0.15, hy + 1, r * 0.45, hy + 1, r * 0.35, hy - r * 0.5 * k)), 1);
    else if (F.horns === "spikes") for (const x of [r * 0.25, -r * 0.35]) P((u, v) => tri(u, v, x - r * 0.18, hy + 1, x + r * 0.18, hy + 1, x - r * 0.2, hy - r * 0.6 * k), 1);
    else if (F.horns === "beetle") P((u, v) => cap(u, v, r * 0.6, -r * 0.4, r * 1.25, -r * 1.25 * k, 1.1, 0.5), 1);
  }
  if (F.mane === "flame" || F.mane === "rays") for (let i = 0; i < 4 + st; i++) { const a = -PI * 0.95 + i / (3 + st) * PI * 0.8; P((u, v) => tri(u, v, C(a) * r * 0.75 - 1.2, S(a) * r * 0.75, C(a) * r * 0.75 + 1.2, S(a) * r * 0.75, C(a) * r * 1.35, S(a) * r * 1.35 - 1), 2, false); }
  if (F.mane === "ruff" || F.mane === "frost" || F.mane === "rock") for (let i = 0; i < 4; i++) { const a = PI * 0.25 + i * 0.4; P((u, v) => Math.hypot(u - C(a) * r * 0.85, v - S(a) * r * 0.55) - r * 0.32, F.mane === "ruff" ? 0 : 1); }
  if (F.shell) P((u, v) => Math.max(ell(u, v, -r * 0.15, -r * 0.05, r * 1.05, r * 0.85), v - r * 0.15), 1);
  if (F.crystals || F.tree) for (const [x, h] of [[-r * 0.3, 0.9], [r * 0.2, 0.6]]) P((u, v) => tri(u, v, x - r * 0.2, -r * 0.6, x + r * 0.2, -r * 0.6, x, -r * (0.6 + h)), 1);
  if (F.cap) P((u, v) => Math.max(ell(u, v, -r * 0.1, -r * 0.75, r * 0.95, r * 0.6), v + r * 0.6), 1);
  if (F.flower) P((u, v) => { const x = u - r * 0.15, y = v + r * 1.05, a = Math.atan2(y, x); return Math.hypot(x, y) - r * (0.22 + 0.14 * Math.abs(C(a * 2.5))); }, 1);
  if (F.spikes) for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; P((u, v) => tri(u, v, C(a) * r * 0.85 - S(a) * 1.2, S(a) * r * 0.85 + C(a) * 1.2, C(a) * r * 0.85 + S(a) * 1.2, S(a) * r * 0.85 - C(a) * 1.2, C(a) * r * 1.4, S(a) * r * 1.4), 1, false); }
  if (F.fins) P((u, v) => tri(u, v, -r * 0.1, r * 0.45, r * 0.55, r * 0.5, -r * 0.2, r * 1.15 + S(t * 6)), 1);
  if (F.beak) P((u, v) => tri(u, v, r * 0.85, -r * 0.2, r * 0.85, r * 0.25, r * 1.45, r * 0.05), 1);
  if (F.crest) for (let i = 0; i < 3; i++) { const a = -PI * 0.62 - i * 0.28; P((u, v) => cap(u, v, -r * 0.05, -r * 0.8, C(a) * r * (1.4 + i * 0.15), S(a) * r * (1.4 + i * 0.15), 1, 0.35), 2, false); }
  if (F.helmet) P((u, v) => Math.max(Math.hypot(u, v + 0.5) - r * 1.05, v + r * 0.05), 1);
  return parts;
}

/** Wings, drawn as their own soft shapes behind (far) and in front (near) of the core. */
function wingShapes(F, st, t, r) {
  if (!F.wings) return [];
  const flap = S(t * (F.wings === "moth" ? 7 : F.wings === "bat" ? 9 : 8)), out = [];
  const span = r * (st === 1 ? 1.25 : st === 2 ? 1.55 : 1.9);
  for (const near of [1, -1]) {
    const ang = -0.6 - flap * 0.45 + (near < 0 ? -0.25 : 0), bx = -r * 0.25, by = -r * 0.15;
    if (F.wings === "moth") {
      for (const s of [1, -1]) out.push({ near: s > 0, d: (u, v) => Math.min(ell(u, v, s * span * 0.62, -r * 0.3, span * 0.55 * (0.7 + 0.3 * Math.abs(flap)), r * 0.85, s * 0.5), ell(u, v, s * span * 0.45, r * 0.55, span * 0.38 * (0.7 + 0.3 * Math.abs(flap)), r * 0.55, -s * 0.5)) });
      break;
    }
    const tipx = bx + C(ang) * -span, tipy = by + S(ang) * span;
    if (F.wings === "bat") out.push({ near: near > 0, d: (u, v) => Math.max(tri(u, v, bx, by, tipx, tipy, bx - span * 0.6, by + r * 0.9), -(Math.hypot(u - (bx + tipx) / 2, v - by - r * 0.85) - span * 0.32)) });
    else out.push({ near: near > 0, d: (u, v) => { const d1 = cap(u, v, bx, by, tipx, tipy, r * 0.55, 0.8), d2 = cap(u, v, bx, by + r * 0.3, tipx * 0.85 + bx * 0.15, tipy + r * 0.55, r * 0.45, 0.7); return Math.min(d1, d2); } });
  }
  return out;
}

/** Draw the small spirit body at (x, y). L: resolved look (ramps), F: features. */
export function drawChibi(p, x, y, L, F, o) {
  const st = o.stage ?? 1, t = o.t ?? 0, f = o.flip ? -1 : 1, a0 = o.alpha ?? 1, sc = o.scale ?? 1;
  const r = [0, 4.6, 5.8, 7][st] * (L.chibi ?? 1);
  const parts = shapes(F, st, t, r), wings = wingShapes(F, st, t, r);
  const ext = r * 2.6 + 2, R = L.R, A = L.A, FR = L.F;
  const OL = mix(R[0], hex("#05040a"), 0.5);
  const sample = (u, v) => {
    // nearest layer wins: near wings, front parts, body, back parts, far wings
    let best = null, bd = 0;
    for (const w of wings) if (w.near) { const d = w.d(u, v); if (d < 0) return [d, 3]; }
    for (const P of parts) { const d = P.d(u, v); if (d < 0 && (!best || P.front)) { best = P; bd = d; if (P.front && P.role !== 0) return [d, P.role]; } }
    if (best) return [bd, best.role];
    for (const w of wings) if (!w.near) { const d = w.d(u, v); if (d < 0) return [d, 4]; }
    return null;
  };
  const near = (u, v) => { let m = 9; for (const P of parts) m = Math.min(m, P.d(u, v)); for (const w of wings) m = Math.min(m, w.d(u, v)); return m; };
  const X0 = Math.floor(x - ext * sc), X1 = Math.ceil(x + ext * sc), Y0 = Math.floor(y - ext * sc * 1.2), Y1 = Math.ceil(y + ext * sc);
  const px = 1 / sc;
  for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) {
    const u = (X + 0.5 - x) * f * px, v = (Y + 0.5 - y) * px, hit = sample(u, v);
    if (!hit) { if (near(u, v) < px) p.blendPx(X, Y, OL, 0.7 * a0); continue; }
    const [d, role] = hit, depth = -d;
    // light from the upper left: a bright face, a soft core glow, a rim of colour at the bottom right
    const lit = clamp(0.5 - (u * f > 0 ? 0 : 0) - v / (r * 2.2) - u / (r * 4) + depth / (r * 1.4), 0, 1);
    let c;
    if (role === 0) c = R[lit > 0.82 ? 7 : lit > 0.6 ? 6 : lit > 0.36 ? 5 : 4];
    else if (role === 1) c = A[lit > 0.7 ? 7 : lit > 0.45 ? 6 : 5];
    else if (role === 2) c = FR[lit > 0.6 ? 7 : 6];
    else { const wing = F.wings === "flame" ? FR : F.wings === "ice" ? A : R; c = wing[lit > 0.65 ? 7 : lit > 0.35 ? 6 : 5]; if (role === 4) c = mix(c, R[2], 0.35); }
    if (depth < px * 1.2 && role !== 2) c = mix(c, R[3], 0.45);
    p.put(X, Y, c, a0);
    if (role === 2 || lit > 0.8) p.add(X, Y, FR[6], 0.25 * a0);
  }
  // eyes: big, bright and a little sparkly; the watcher has one great eye
  const eye = (ex, ey, w, h) => {
    for (let j = -h; j <= h; j += px) for (let i = -w; i <= w; i += px) {
      if ((i * i) / (w * w) + (j * j) / (h * h) > 1) continue;
      const X = Math.round(x + (ex + i) * f * sc - 0.5), Y = Math.round(y + (ey + j) * sc - 0.5);
      p.put(X, Y, j < -h * 0.2 && i * f < 0 ? hex("#ffffff") : L.eyeDark, a0);
    }
  };
  if (F.body === "eye") { eye(r * 0.05, 0, r * 0.55, r * 0.55); for (let j = -2; j <= 2; j++) p.put(Math.round(x), Math.round(y + j), FR[6], a0); }
  else if (F.body !== "puff" || st >= 1) {
    const ew = (F.bigEyes ? 1.3 : 0.95) * (st === 3 ? 0.95 : 1), eh = (F.bigEyes ? 1.4 : 1.25), ex = r * 0.38, ey = F.body === "ghost" ? -r * 0.15 : -r * 0.05;
    eye(ex, ey, ew, eh); eye(ex - r * 0.62, ey, ew * 0.85, eh);
    // a blush
    p.put(Math.round(x + (ex + r * 0.2) * f * sc), Math.round(y + (ey + r * 0.45) * sc), mix(R[6], hex("#ff8aa8"), 0.6), a0 * 0.8);
  }
  if (F.lamp) { const lx = x - f * r * 0.2 * sc, ly = y + r * 0.9 * sc; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (i * i + j * j <= 4) { p.put(Math.round(lx + i), Math.round(ly + j), FR[i * i + j * j <= 1 ? 7 : 6], a0); } glowAt(p, lx, ly, 8, FR[6], 0.35 * a0); }
  if (F.lantern) { const lx = x + f * r * 1.1 * sc, ly = y + r * 0.7 * sc; for (let j = -2; j <= 2; j++) for (let i = -1; i <= 1; i++) p.put(Math.round(lx + i), Math.round(ly + j), FR[Math.abs(j) === 2 ? 4 : 7], a0); glowAt(p, lx, ly, 9, FR[6], 0.4 * a0); }
  if (F.halo && st >= 2) { for (let i = 0; i < 18; i++) { const an = i / 18 * PI * 2; p.put(Math.round(x + C(an) * r * 0.8 * sc), Math.round(y + (-r * 1.45 + S(an) * r * 0.25) * sc), hex("#ffe27a"), a0); } }
  if (F.rings) for (let k = 0; k < st; k++) { const rr = r * (1.5 + k * 0.35), tilt = t * 0.6 + k; for (let i = 0; i < 26; i++) { const an = i / 26 * PI * 2, u = C(an) * rr, v = S(an) * rr * 0.3; p.put(Math.round(x + (u * C(tilt) - v * S(tilt)) * sc), Math.round(y + (u * S(tilt) + v * C(tilt)) * sc), FR[5], a0 * 0.8); } }
  if (F.body === "puff") for (let i = 0; i < 6 + st * 3; i++) { const an = i / (6 + st * 3) * PI * 2 + S(t + i) * 0.1, L2 = r * (1.2 + 0.2 * hash(i)); const ex = x + C(an) * L2 * sc, ey = y + S(an) * L2 * sc; p.put(Math.round(ex), Math.round(ey), hex("#ffffff"), a0); glowAt(p, ex, ey, 2.5, FR[6], 0.3 * a0); }
  if (F.whiskers && st >= 2) for (const s of [1, -1]) for (let i = 1; i < 8; i++) p.put(Math.round(x + f * (r * 0.9 - i * 1.6) * sc), Math.round(y + (r * 0.2 + s * 0.8 + S(t * 4 + i * 0.6) * i * 0.25) * sc), FR[6], a0 * (1 - i / 9));
  // a soft glow around the whole spirit
  glowAt(p, x, y, r * 3.2 * sc, FR[5], 0.14 * (o.glow ?? 1) * a0);
  return r * sc;
}
function glowAt(p, x, y, R, c, k) { const n = Math.ceil(R); for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) { const d = (i * i + j * j) / (R * R); if (d < 1) p.add(Math.round(x + i), Math.round(y + j), c, k * (1 - d) * (1 - d)); } }

// ------------------------------------------------------------------------------------------ trails
/**
 * pts: recent positions, newest first, each { x, y, age } (seconds). The trail streams away from the
 * body: points drift with the element's flow as they age, so even a resting spirit trails a plume.
 */
export function drawTrail(p, pts, L, F, o) {
  const st = o.stage ?? 1, t = o.t ?? 0, a0 = o.alpha ?? 1, FR = L.F, R = L.R, A = L.A, sc = o.scale ?? 1;
  const r = [0, 4.6, 5.8, 7][st] * sc, n = pts.length, f = o.flip ? -1 : 1;
  if (n < 2) return;
  const flow = FLOW[F.trail] ?? [0, -10];
  const P = pts.map((q, i) => ({ x: q.x + (flow[0] - f * 20) * q.age, y: q.y + flow[1] * q.age + S(t * 2.6 - q.age * 5) * q.age * 5, k: i / (n - 1) }));
  // a ribbon is rasterised as one smooth strip (distance to the offset polyline), bright core, soft edge,
  // fading and thinning toward the tail like a comet
  const ribbon = (offset, w0, colA, colB, alpha = 0.9, wave = 0, ph = 0) => {
    const Q = [];
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[Math.min(n - 1, i + 1)], c = P[Math.max(0, i - 1)], dx = b.x - c.x, dy = b.y - c.y, dl = Math.hypot(dx, dy) || 1;
      const off = offset * (0.25 + a.k) + S(t * 4 - a.k * 5 + ph) * wave * a.k;
      Q.push({ x: a.x - dy / dl * off, y: a.y + dx / dl * off, k: a.k, w: w0 * Math.pow(1 - a.k, 0.7) + 0.5 });
    }
    // stamp discs along the polyline into a coverage buffer (max, so overlaps never double up), then blend once
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const q of Q) { x0 = Math.min(x0, q.x - q.w); y0 = Math.min(y0, q.y - q.w); x1 = Math.max(x1, q.x + q.w); y1 = Math.max(y1, q.y + q.w); }
    x0 = Math.floor(x0) - 1; y0 = Math.floor(y0) - 1; const BW = Math.ceil(x1) - x0 + 2, BH = Math.ceil(y1) - y0 + 2;
    if (BW <= 0 || BH <= 0 || BW * BH > 40000) return;
    const cov = COV.length >= BW * BH ? COV : (COV = new Float32Array(BW * BH * 2)), kk = KK.length >= BW * BH ? KK : (KK = new Float32Array(BW * BH * 2));
    cov.fill(0, 0, BW * BH);
    for (let i = 1; i < Q.length; i++) {
      const A2 = Q[i - 1], B2 = Q[i], L2 = Math.hypot(B2.x - A2.x, B2.y - A2.y), steps = Math.max(1, Math.ceil(L2));
      for (let sI = 0; sI <= steps; sI++) {
        const u = sI / steps, cx = A2.x + (B2.x - A2.x) * u - x0, cy = A2.y + (B2.y - A2.y) * u - y0, w = A2.w + (B2.w - A2.w) * u, k = A2.k + (B2.k - A2.k) * u, wi = Math.ceil(w);
        const fade = Math.pow(1 - k, 1.3);
        for (let j = -wi; j <= wi; j++) { const Y = Math.round(cy + j); if (Y < 0 || Y >= BH) continue; for (let ii = -wi; ii <= wi; ii++) {
          const X = Math.round(cx + ii); if (X < 0 || X >= BW) continue;
          const dd = Math.hypot(X - cx, Y - cy) / w; if (dd >= 1) continue;
          const v = fade * (dd < 0.7 ? 1 : (1 - dd) / 0.3) * (dd < 0.45 && k < 0.6 ? 2 : 1), at = Y * BW + X;
          if (v > cov[at]) { cov[at] = v; kk[at] = dd; }
        } }
      }
    }
    for (let Y = 0; Y < BH; Y++) for (let X = 0; X < BW; X++) {
      const at = Y * BW + X, v = cov[at]; if (v <= 0.01) continue;
      const core = v > 1, a = core ? v - 1 : v;
      p.blendPx(X + x0, Y + y0, core ? colA : colB, alpha * Math.min(1, core ? v / 2 + 0.3 : a) * a0);
      p.add(X + x0, Y + y0, FR[6], (core ? 0.3 : 0.12) * Math.min(1, a) * a0);
    }
  };
  const motes = (kind, count) => {
    for (let i = 0; i < n; i += Math.max(1, Math.floor(n / count))) {
      const q = P[i], id = pts[i].id ?? i, h = hash(id, st), h2 = hash(id, 7), al = Math.pow(1 - q.k, 1.2) * a0;
      if (h > 0.75) continue;
      const mx = Math.round(q.x + (h2 - 0.5) * r * 2.4 * (0.4 + q.k)), my = Math.round(q.y + (hash(id, 3) - 0.5) * r * 2 * (0.4 + q.k));
      if (kind === "ember") { p.put(mx, my, FR[7], al); p.add(mx, my, FR[6], 0.6 * al); }
      else if (kind === "bubble") { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.put(mx + dx, my + dy, FR[6], al * 0.8); p.put(mx - 1, my - 1, hex("#ffffff"), al); }
      else if (kind === "leaf") { p.put(mx, my, A[6], al); p.put(mx + 1, my - 1, A[5], al); p.put(mx - 1, my + 1, A[4], al); }
      else if (kind === "gem") { p.put(mx, my, A[7], al); p.put(mx, my - 1, A[6], al); p.add(mx, my, FR[6], 0.5 * al); }
      else if (kind === "star") { const c = hex("#ffffff"); p.put(mx, my, c, al); if (h < 0.35) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.put(mx + dx, my + dy, FR[6], al * 0.8); p.add(mx, my, FR[6], 0.6 * al); }
      else if (kind === "smoke") { for (let j = -2; j <= 2; j++) for (let ii = -2; ii <= 2; ii++) if (ii * ii + j * j <= 4) p.blendPx(mx + ii, my + j, R[2], 0.35 * al); p.put(mx, my, FR[6], al); }
      else if (kind === "digit") p.text(h < 0.37 ? "1" : "0", mx, my, FR[h < 0.2 ? 7 : 5], { font: "mini", align: "center", a: al });
      else if (kind === "seed") { p.put(mx, my, hex("#ffffff"), al); p.put(mx, my + 1, A[4], al); }
    }
  };
  const tr = F.trail, big = st === 3 ? 1.35 : st === 2 ? 1.15 : 1;
  if (tr === "flame") { ribbon(0, r * 0.85 * big, FR[6], FR[4], 0.85, 2); ribbon(0, r * 0.38 * big, FR[7], FR[7], 0.95, 2, 0.3); motes("ember", 12 + st * 5); }
  else if (tr === "water") { ribbon(0, r * 0.75 * big, FR[7], FR[5], 0.75, 2.5); ribbon(r * 0.5, r * 0.2 * big, FR[7], FR[6], 0.8, 3, 1.5); motes("bubble", 7 + st * 3); }
  else if (tr === "wind") { for (const [o2, ph] of [[r * 0.7, 0], [-r * 0.7, 2], [0, 4]]) ribbon(o2, r * 0.26 * big, FR[7], FR[6], 0.85, 3.5, ph); motes("leaf", 6 + st * 3); }
  else if (tr === "crystal") { ribbon(0, r * 0.6 * big, A[7], A[5], 0.75, 1.5); motes("gem", 10 + st * 4); }
  else if (tr === "stars") { ribbon(0, r * 0.75 * big, FR[7], FR[6], 0.8, 1.5); ribbon(0, r * 0.3 * big, hex("#ffffff"), FR[7], 0.9, 1.5); motes("star", 12 + st * 5); }
  else if (tr === "shadow") { ribbon(0, r * 0.85 * big, FR[5], FR[3], 0.75, 2.5); ribbon(0, r * 0.3 * big, FR[7], FR[6], 0.8, 2.5, 1); motes("smoke", 6 + st * 3); motes("ember", 5 + st * 2); }
  else if (tr === "code") { ribbon(0, r * 0.4 * big, FR[7], FR[5], 0.75, 1); motes("digit", 10 + st * 4); }
  else if (tr === "tails") {
    const nt = Array.isArray(F.tails) ? F.tails[st] : F.tails;
    for (let i = 0; i < nt; i++) { const s = nt === 1 ? 0 : i / (nt - 1) - 0.5; ribbon(s * r * (1.4 + nt * 0.15), r * 0.42 * big, FR[7], R[6], 0.85, 2.5, i * 1.1); }
    motes(TRAIL_MOTE[o.el] ?? "ember", 6 + st * 3);
  }
  else if (tr === "ribbons") { const nt = Array.isArray(F.tails) ? F.tails[st] : F.tails; for (let i = 0; i < nt; i++) ribbon((i - (nt - 1) / 2) * r * 0.9, r * 0.25 * big, FR[7], FR[5], 0.8, 3.5, i * 1.3); motes("leaf", 5 + st * 3); }
  else if (tr === "serpent") { ribbon(0, r * 0.8 * big, R[7], R[5], 0.95, 3); ribbon(0, r * 0.28 * big, FR[7], A[7], 0.95, 3); motes(TRAIL_MOTE[o.el] ?? "bubble", 6 + st * 3); }
  else if (tr === "plumes") { const nt = st + 1; for (let i = 0; i < nt; i++) ribbon((i - (nt - 1) / 2) * r * 0.8, r * 0.36 * big, FR[7], F.wings === "flame" ? FR[5] : R[6], 0.85, 2.5, i); motes(TRAIL_MOTE[o.el] ?? "star", 6 + st * 3); }
  else if (tr === "tentacles") { for (let i = 0; i < 2 + st; i++) ribbon((i - (1 + st) / 2) * r * 0.6, r * 0.22 * big, FR[7], FR[5], 0.85, 3, i * 1.7); motes("bubble", 4 + st * 2); }
  else if (tr === "smoke") { ribbon(0, r * 0.9 * big, FR[5], FR[3], 0.65, 2.5); ribbon(0, r * 0.3 * big, FR[7], FR[6], 0.8, 2.5); motes("smoke", 8 + st * 3); motes("ember", 3 + st); }
  else if (tr === "seeds") { ribbon(0, r * 0.2, hex("#ffffff"), A[5], 0.5, 2); motes("seed", 10 + st * 4); }
  else { ribbon(0, r * 0.5, FR[6], FR[4], 0.7, 1.5); motes("star", 8); }
}
const FLOW = { flame: [0, -26], water: [0, 10], wind: [-6, -4], crystal: [0, -6], stars: [0, -10], shadow: [-4, -16], code: [0, 18], tails: [0, -4], ribbons: [-4, -4], serpent: [0, 2], plumes: [0, 4], tentacles: [0, 14], smoke: [0, -14], seeds: [-6, -12] };
const TRAIL_MOTE = { fire: "ember", water: "bubble", wind: "leaf", earth: "gem", light: "star", dark: "smoke", code: "digit" };
