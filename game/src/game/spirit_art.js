// Spirits: a small bright body (see chibi.js) with a trail streaming behind it that carries the element.
// Each on-screen spirit keeps a short history of where it has been (by o.key), so the trail follows it.
import { hex, mix, createFrame, clearFrame, painterFor } from "../px.js";
import { ELEMENTS } from "../data/elements.js";
import { SPIRIT } from "../data/spirits.js";
import { LOOKS } from "../data/looks.js";
import { makeLook } from "./beasts.js";
import { featuresOf, drawChibi, drawTrail } from "./chibi.js";

const S = Math.sin;
const looks = new Map();
export function lookOf(id) {
  if (!looks.has(id)) {
    const d = SPIRIT[id], L = makeLook(d, LOOKS[id] ?? {}, ELEMENTS[d.el].ramp);
    L.eyeDark = mix(L.R[0], hex("#05040a"), 0.4);
    L.feat = featuresOf(LOOKS[id] ?? {}, d.el);
    looks.set(id, L);
  }
  return looks.get(id);
}

const trails = new Map();
const LIFE = [0, 0.85, 1.1, 1.4];

/**
 * Draw a spirit with its middle at (x, y). o: { id, stage, t, flip, alpha, glow, scale, fit (fit inside a box
 * this many px wide, for icons), still (no floating bob), key (which on-screen spirit this is) }
 */
export function drawSpirit(p, x, y, o) {
  const d = SPIRIT[o.id], L = lookOf(o.id), F = L.feat, st = o.stage ?? 1, t = o.t ?? 0;
  let sc = o.scale ?? 1, bx = x, by = y;
  if (o.fit) { const r = [0, 4.6, 5.8, 7][st]; sc = o.fit / (r * 4.6); bx = x + r * sc * 0.55; }
  const bob = o.fit || o.still ? 0 : S(t * 2.2) * 1.4;
  by += bob;
  // the trail: real history for spirits that move, a resting plume for still ones
  let pts;
  if (o.fit) pts = Array.from({ length: 10 }, (_, i) => ({ x: bx, y: by, age: i * LIFE[st] / 10, id: i }));
  else {
    const key = o.key ?? o.id;
    let T = trails.get(key);
    if (!T || t < T.last - 0.5 || t - T.last > 1) { T = { pts: [], last: t }; trails.set(key, T); if (trails.size > 120) trails.delete(trails.keys().next().value); }
    if (t - T.last >= 1 / 18 || !T.pts.length) { T.pts.unshift({ x: bx, y: by, t0: t }); T.last = t; }
    T.pts = T.pts.filter((q) => t - q.t0 < LIFE[st]);
    pts = [{ x: bx, y: by, age: 0, id: -1 }, ...T.pts.map((q) => ({ x: q.x, y: q.y, age: t - q.t0, id: Math.round(q.t0 * 18) }))];
  }
  const oo = { ...o, scale: sc, el: d.el };
  drawTrail(p, pts, L, F, oo);
  const r = drawBody(p, bx, by, L, F, oo, o.id);
  if (d.crown) {
    const X = Math.round(bx), Y = Math.round(by - r * 1.9) - (F.horns ? 3 : 1), g = hex("#ffd84a"), w = hex("#fff6c0");
    for (const dx of [-2, 0, 2]) p.put(X + dx, Y - (dx === 0 ? 1 : 0), dx === 0 ? w : g, o.alpha ?? 1);
    for (let dx = -2; dx <= 2; dx++) p.put(X + dx, Y + 1, g, o.alpha ?? 1);
  }
  return { sc, r };
}

// bodies are small but made of many little shapes: each (spirit, stage, facing, size, 1/10 s frame of a
// 2 s loop) is drawn once into a tiny frame and stamped after that
const bodies = new Map();
function drawBody(p, x, y, L, F, o, id) {
  if (o.fit) return drawChibi(p, x, y, L, F, o);
  const st = o.stage ?? 1, qt = Math.floor((o.t ?? 0) * 10) % 20, a = Math.round((o.alpha ?? 1) * 10) / 10, g = Math.round((o.glow ?? 1) * 5) / 5;
  const key = `${id}|${st}|${o.flip ? 1 : 0}|${o.scale}|${qt}|${a}|${g}`;
  let B = bodies.get(key);
  if (!B) {
    const half = Math.ceil([0, 4.6, 5.8, 7][st] * (L.chibi ?? 1) * 3.4 * o.scale) + 3;
    const Fr = createFrame(half * 2, half * 2, -half, -half); clearFrame(Fr);
    const r = drawChibi(painterFor(Fr), 0, 0, L, F, { ...o, t: qt / 10, alpha: a, glow: g });
    B = { Fr, r }; bodies.set(key, B);
    if (bodies.size > 900) bodies.delete(bodies.keys().next().value);
  } else { bodies.delete(key); bodies.set(key, B); }
  const Fr = B.Fr, W = Fr.w, X0 = Math.round(x) + Fr.ox, Y0 = Math.round(y) + Fr.oy;
  for (let j = 0; j < Fr.h; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, col = Fr.color[k], lt = Fr.light[k];
    if (col) { const al = col >>> 24; if (al >= 250) p.put(X0 + i, Y0 + j, col); else p.blendPx(X0 + i, Y0 + j, (col | 0xff000000) >>> 0, al / 255); }
    if (lt) p.add(X0 + i, Y0 + j, lt, 1);
  }
  return B.r;
}

/** About half the drawn height, for shadows and layout. */
export const spiritRadius = (stage) => [0, 6, 7, 9][stage];
