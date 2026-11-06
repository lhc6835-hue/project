// Spirits are luminous elemental beasts (see beasts.js for how they are built and drawn, looks.js for who
// is what). This adds the drifting float, element motes around them and the crown of the legendary ones.
import { hex, createFrame, clearFrame, painterFor } from "../px.js";
import { ELEMENTS } from "../data/elements.js";
import { SPIRIT } from "../data/spirits.js";
import { LOOKS } from "../data/looks.js";
import { drawBeast, makeLook } from "./beasts.js";

const S = Math.sin, C = Math.cos;
const looks = new Map();
export function lookOf(id) {
  if (!looks.has(id)) { const d = SPIRIT[id]; looks.set(id, makeLook(d, LOOKS[id] ?? {}, ELEMENTS[d.el].ramp)); }
  return looks.get(id);
}

/**
 * Draw a spirit with its middle at (x, y). o: { id, stage, t, flip, alpha, glow, scale, fit (fit inside a box
 * this many px wide, for icons), still (no floating bob) }
 */
const sprites = new Map();
/**
 * Spirits are costly to draw, so in the world each one is rendered into its own little frame 12 times a
 * second and stamped from there in between. o.key names the instance (a garden walker's uid, say).
 */
export function drawSpirit(p, x, y, o) {
  if (o.fit || o.direct) return drawSpiritNow(p, x, y, o);
  const t = o.t ?? 0, st = o.stage ?? 1, qt = Math.floor(t * 10), a = Math.round((o.alpha ?? 1) * 20) / 20, g = Math.round((o.glow ?? 1) * 10) / 10;
  const key = `${o.key ?? o.id}|${o.id}|${st}|${o.flip ? 1 : 0}|${o.scale ?? 1}`;
  const half = Math.ceil(54 * (o.scale ?? 1) * (lookOf(o.id).size ?? 1) * [0, 0.62, 0.8, 1][st]) + 4;
  let c = sprites.get(key);
  if (!c || c.half !== half) { if (sprites.size > 160) sprites.clear(); c = { half, frame: createFrame(half * 2, half * 2, -half, -half), qt: null }; sprites.set(key, c); }
  if (c.qt !== qt || c.a !== a || c.g !== g) {
    clearFrame(c.frame);
    drawSpiritNow(painterFor(c.frame), 0, 0, { ...o, t: qt / 10, alpha: a, glow: g, still: true });
    c.qt = qt; c.a = a; c.g = g;
  }
  const F = c.frame, W = F.w, bob = o.still ? 0 : S(t * 1.7) * 1.3, X0 = Math.round(x) - half, Y0 = Math.round(y + bob) - half;
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, col = F.color[k], lt = F.light[k];
    if (col) { const al = col >>> 24; if (al >= 250) p.put(X0 + i, Y0 + j, col); else p.blendPx(X0 + i, Y0 + j, (col | 0xff000000) >>> 0, al / 255); }
    if (lt) p.add(X0 + i, Y0 + j, lt, 1);
  }
}

function drawSpiritNow(p, x, y, o) {
  const d = SPIRIT[o.id], L = lookOf(o.id), st = o.stage ?? 1, t = o.t ?? 0, a = o.alpha ?? 1;
  const bob = o.fit || o.still ? 0 : S(t * 1.7) * 1.3;
  const r = drawBeast(p, x, y + bob, L, { stage: st, t, flip: o.flip, alpha: a, glow: o.glow, scale: o.scale, fit: o.fit, crown: d.crown });
  // element motes drifting around the body
  const ext = Math.max(r.bb[2] - r.bb[0], r.bb[3] - r.bb[1]) * r.sc * 0.5, el = d.el, F = L.F, n = 2 + st * 2;
  for (let i = 0; i < n; i++) {
    const ph = (t * (0.45 + (i % 3) * 0.17) + i / n) % 1;
    let px, py;
    if (el === "fire") { px = x + S(i * 2.3 + t * 2) * ext * 0.7; py = y - ext * 0.2 - ph * ext * 1.3; }
    else if (el === "water") { px = x + S(i * 1.7) * ext; py = y + ext * 0.6 - ph * ext * 1.8; }
    else if (el === "wind") { const an = i / n * 6.28 + t * 2.5; px = x + C(an) * ext * (1.1 + ph * 0.4); py = y + S(an) * ext * 0.45; }
    else if (el === "light") { const an = i / n * 6.28 + t; px = x + C(an) * ext * 1.1; py = y + S(an) * ext - ph * 4; if (ph < 0.3) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.put(Math.round(px) + dx, Math.round(py) + dy, F[7], a * 0.8); }
    else if (el === "dark") { px = x + S(i * 2.9 + t) * ext; py = y + ext * 0.5 - ph * ext * 1.6; }
    else if (el === "code") { px = x + S(i * 2.1) * ext * 1.2; py = y - ext + ph * ext * 2; p.text(i % 2 ? "1" : "0", Math.round(px), Math.round(py), F[ph < 0.5 ? 6 : 4], { font: "mini", align: "center", a: a * (1 - ph) }); continue; }
    else { px = x + S(i * 3.1) * ext; py = y + ext * 0.7 - ph * ext * 0.6; }
    p.put(Math.round(px), Math.round(py), F[ph < 0.5 ? 7 : 5], a * (1 - ph));
    p.add(Math.round(px), Math.round(py), F[5], 0.45 * a * (1 - ph));
  }
  return r;
}

/** About half the drawn height, for shadows and layout. */
export const spiritRadius = (stage) => [0, 9, 12, 16][stage];
