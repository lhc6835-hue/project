// Spirits as little procedural pixel creatures: shape by element, size and ornaments by stage, colours by spirit.
import { hex, mix, fit, toHex } from "../px.js";
import { ELEMENTS } from "../data/elements.js";
import { SPIRIT } from "../data/spirits.js";

const S = Math.sin, C = Math.cos;

function rampOf(id) {
  const d = SPIRIT[id], r = d.tint ?? ELEMENTS[d.el].ramp;
  return fit(r, 8).map((x) => (typeof x === "number" ? x : hex(x)));
}

// signed distances (negative inside)
const circle = (u, v, x, y, r) => Math.hypot(u - x, v - y) - r;
const ellipse = (u, v, x, y, rx, ry, a = 0) => { const c = C(a), s = S(a), du = u - x, dv = v - y, X = du * c + dv * s, Y = -du * s + dv * c; return (Math.hypot(X / rx, Y / ry) - 1) * Math.min(rx, ry); };
const tear = (u, v, x, y, r, h, wob = 0) => {
  // round bottom, pointed top at y - h
  const dv = v - y;
  if (dv >= 0) return circle(u, v, x, y, r);
  const k = Math.max(0, 1 + dv / h), w = r * Math.pow(k, 0.8) + wob * (1 - k);
  return Math.max(Math.abs(u - x - wob * (1 - k) * 0.6) - w, -dv - h);
};

/** Shapes for a spirit: returns { body(u,v)->d, extra: [(u,v)->d], r, eyes:[x,y], parts } in local px, origin = center. */
function shapes(el, stage, t, flip) {
  const r = [0, 6, 8.5, 11][stage];
  const bob = S(t * 3) * 0.8;
  switch (el) {
    case "fire": {
      const w = S(t * 9) * 1.2, w2 = S(t * 7 + 1) * 1.0;
      const body = (u, v) => Math.min(tear(u, v, 0, bob, r, r * 1.9, w), stage >= 2 ? tear(u, v, -r * 0.6, bob - r * 0.2, r * 0.4, r * 1.3, w2) : 9, stage >= 2 ? tear(u, v, r * 0.6, bob - r * 0.3, r * 0.4, r * 1.2, -w2) : 9);
      const extra = [];
      if (stage >= 2) extra.push((u, v) => ellipse(u, v, -r * 1.2, bob + r * 0.55, r * 0.55, r * 0.22, 0.5 + S(t * 5) * 0.2)); // tail
      if (stage >= 3) for (const s of [-1, 1]) extra.push((u, v) => tear(u, v, s * r * 1.35, bob - r * 0.1, r * 0.45, r * 1.5, s * 2 + S(t * 6 + s) * 1.5)); // flame wings
      return { body, extra, r, eyes: [r * 0.3, bob + r * 0.05], bob };
    }
    case "water": {
      const body = (u, v) => tear(u, v, 0, bob, r, r * 1.5, 0);
      const extra = [];
      if (stage >= 2) for (const s of [-1, 1]) extra.push((u, v) => ellipse(u, v, s * r * 1.05, bob + r * 0.2, r * 0.45, r * 0.2, s * (0.6 + S(t * 4) * 0.25))); // fins
      if (stage >= 3) extra.push((u, v) => { const a = v - bob - r * 0.6; return a < 0 || a > r * 1.3 ? 9 : Math.abs(u + S(v * 0.5 - t * 4) * 2) - Math.max(0.6, r * 0.4 - a * 0.22); }); // flowing tail
      return { body, extra, r, eyes: [r * 0.3, bob + r * 0.1], bob };
    }
    case "wind": {
      const body = (u, v) => Math.min(circle(u, v, 0, bob, r * 0.85), circle(u, v, -r * 0.55, bob + r * 0.25, r * 0.55), circle(u, v, r * 0.45, bob + r * 0.3, r * 0.5));
      const extra = [];
      extra.push((u, v) => ellipse(u, v, -r * 1.05, bob + r * 0.35, r * 0.45, r * 0.2, -0.4 + S(t * 4) * 0.2), (u, v) => circle(u, v, -r * 1.45, bob + r * 0.1, r * 0.2 + 0.3)); // a curled tail
      if (stage >= 2) for (const s of [-1, 1]) extra.push((u, v) => ellipse(u, v, s * r * 0.9, bob - r * 0.6, r * 0.7, r * 0.25, s * (0.7 + S(t * 12) * 0.35))); // flicking wings
      if (stage >= 3) for (let i = 0; i < 3; i++) extra.push((u, v) => ellipse(u, v, -r * (1.3 + i * 0.25), bob + r * (0.2 + i * 0.25), r * 0.55, r * 0.16, 0.1 + i * 0.25 + S(t * 3 + i) * 0.15)); // plumes
      return { body, extra, r, eyes: [r * 0.3, bob], bob };
    }
    case "earth": {
      const body = (u, v) => {
        const a = Math.atan2(v - bob, u), k = 1 + 0.12 * Math.round(S(a * 5 + 1.3) * 1.5) / 1.5;
        return Math.hypot(u, (v - bob) * 1.12) - r * k * 0.95;
      };
      const extra = [];
      if (stage >= 2) extra.push((u, v) => tear(u, v, -r * 0.3, bob - r * 0.75, r * 0.3, r * 0.9, 0), (u, v) => tear(u, v, r * 0.25, bob - r * 0.8, r * 0.22, r * 0.7, 0)); // crystals
      if (stage >= 3) for (const s of [-1, 1]) extra.push((u, v) => circle(u, v, s * r * 1.15, bob + r * 0.35 + S(t * 3 + s) * 1, r * 0.38)); // floating stones
      return { body, extra, r, eyes: [r * 0.28, bob + r * 0.05], bob };
    }
    default: {
      const body = (u, v) => circle(u, v, 0, bob, r);
      const extra = [];
      if (stage >= 2) for (const s of [-1, 1]) extra.push((u, v) => ellipse(u, v, s * r * 1.2, bob - r * 0.3, r * 0.8, r * 0.3, s * (0.5 + S(t * 6) * 0.3)));
      return { body, extra, r, eyes: [r * 0.3, bob], bob };
    }
  }
}

/**
 * Draw a spirit with its center at (x, y). o: { id, stage, t, flip, alpha, glow (0..1), blink }
 */
export function drawSpirit(p, x, y, o) {
  const d = SPIRIT[o.id], el = d.el, stage = o.stage ?? 1, t = o.t ?? 0, R = rampOf(o.id), f = o.flip ? -1 : 1;
  const sh = shapes(el, stage, t, o.flip), r = sh.r, a = o.alpha ?? 1;
  const ext = Math.ceil(r * 2.6) + 3;
  const W = ext * 2 + 1, mask = new Int8Array(W * W); // 0 out, 1 body, 2 extra
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
    const u = (i - ext + 0.5) * f, v = j - ext + 0.5;
    if (sh.body(u, v) <= 0) mask[j * W + i] = 1;
    else if (sh.extra.some((fn) => fn(u, v) <= 0)) mask[j * W + i] = 2;
  }
  const at = (i, j) => (i < 0 || j < 0 || i >= W || j >= W ? 0 : mask[j * W + i]);
  const OL = mix(R[0], hex("#05040a"), 0.4);
  const blink = o.blink ?? (S(t * 0.9) > 0.97);
  p.reset?.();
  const glowK = o.glow ?? 1;
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
    const m = mask[j * W + i], X = Math.round(x) + i - ext, Y = Math.round(y) + j - ext;
    if (!m) {
      if (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1)) p.put(X, Y, OL, a);
      continue;
    }
    const u = (i - ext + 0.5), v = j - ext + 0.5;
    // shade: bright core near the upper-left, darker toward the rim and bottom
    const rim = !at(i - 1, j) || !at(i, j - 1);
    const dark = !at(i + 1, j) || !at(i, j + 1);
    let k = 5 - (v - sh.bob) / (r * 1.6) * 2 - Math.hypot(u + r * 0.25, v - sh.bob + r * 0.25) / r * 1.6;
    if (m === 2) k -= 0.7;
    if (rim) k += 1.2;
    if (dark) k -= 1.4;
    k = Math.max(1, Math.min(7, Math.round(k)));
    let c = R[k];
    // eyes
    const [ex, ey] = sh.eyes;
    const uu = u * f;
    const eyeW = stage >= 2 ? 1.6 : 1.2;
    const inEye = (cx) => Math.abs(uu - cx) < eyeW * 0.6 && v >= ey - (blink ? 0 : eyeW) && v < ey + 0.7;
    if (m === 1 && (inEye(ex) || inEye(ex - r * 0.75))) c = hex("#120c16");
    if (m === 1 && stage >= 2 && !blink && (Math.abs(uu - ex - 0.4) < 0.5 && Math.abs(v - (ey - eyeW + 0.4)) < 0.5)) c = hex("#ffffff");
    // cheeks
    if (m === 1 && stage <= 2 && Math.abs(uu - ex - 1.6) < 0.8 && Math.abs(v - ey - 1.6) < 0.6) c = mix(c, hex("#ff8aa0"), 0.5);
    p.put(X, Y, c, a);
    if (k >= 6) p.add(X, Y, R[6], 0.25 * glowK * a);
  }
  // soft glow around
  const gc = R[5], gr = r * 2.2;
  for (let j = -gr; j <= gr; j++) for (let i = -gr; i <= gr; i++) {
    const dd = (i * i + j * j) / (gr * gr);
    if (dd < 1) p.add(Math.round(x + i), Math.round(y + sh.bob + j), gc, 0.07 * glowK * a * (1 - dd));
  }
  // particles by element
  const n = 3 + stage * 2;
  for (let i = 0; i < n; i++) {
    const ph = (t * (0.5 + (i % 3) * 0.2) + i / n) % 1;
    let px, py;
    if (el === "fire") { px = x + S(i * 2.3 + t * 2) * r * 0.8; py = y - r * 1.4 - ph * r * 2; }
    else if (el === "water") { px = x + S(i * 1.7) * r * 1.2; py = y + r - ph * r * 3; }
    else if (el === "wind") { const an = i / n * 6.28 + t * 3; px = x + C(an) * r * (1.6 + ph); py = y + S(an) * r * 0.7; }
    else { px = x + S(i * 3.1) * r * 1.4; py = y + r * 1.1 - ph * r * 0.8; }
    p.put(Math.round(px), Math.round(py), R[ph < 0.5 ? 6 : 4], a * (1 - ph));
    p.add(Math.round(px), Math.round(py), R[5], 0.4 * a * (1 - ph));
  }
  if (d.crown && stage >= 1) {
    const cy = Math.round(y + sh.bob - r * (el === "fire" ? 2.1 : 1.6)) - 2, gold = hex("#ffd84a");
    for (const dx of [-2, 0, 2]) { p.put(Math.round(x) + dx, cy - (dx === 0 ? 1 : 0), gold, a); p.add(Math.round(x) + dx, cy, gold, 0.6 * a); }
    for (let dx = -2; dx <= 2; dx++) p.put(Math.round(x) + dx, cy + 1, gold, a);
  }
}

/** Approximate size for layout. */
export const spiritRadius = (stage) => [0, 6, 8.5, 11][stage];
