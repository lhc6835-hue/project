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


// ------------------------------------------------------------------ creature forms
// Each form builds { body, extra[], r, eyes, bob, eyeW?, eyeGap?, oneEye?, alt?(u,v) } for a stage.
// extra shapes take the spirit's accent colours when it has them (tails, caps, wings, fins).
const box = (u, v, x, y, hw, hh, rr = 0) => { const qx = Math.abs(u - x) - hw + rr, qy = Math.abs(v - y) - hh + rr; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr; };
const tri = (u, v, ax, ay, bx, by, cx, cy) => {
  const e = (px, py, qx, qy) => (u - px) * (qy - py) - (v - py) * (qx - px);
  const d1 = e(ax, ay, bx, by), d2 = e(bx, by, cx, cy), d3 = e(cx, cy, ax, ay);
  const inside = (d1 <= 0 && d2 <= 0 && d3 <= 0) || (d1 >= 0 && d2 >= 0 && d3 >= 0);
  const seg = (px, py, qx, qy) => { const ex = qx - px, ey = qy - py, t = Math.max(0, Math.min(1, ((u - px) * ex + (v - py) * ey) / (ex * ex + ey * ey))); return Math.hypot(u - px - ex * t, v - py - ey * t); };
  const d = Math.min(seg(ax, ay, bx, by), seg(bx, by, cx, cy), seg(cx, cy, ax, ay));
  return inside ? -d : d;
};
const R0 = [0, 6, 8.5, 11];
export const FORMS = {
  fox(stage, t) {
    const r = R0[stage], bob = S(t * 3) * 0.8, sw = S(t * 4) * 0.25, tails = stage >= 3 ? 3 : 1;
    const body = (u, v) => Math.min(ellipse(u, v, 0, bob + r * 0.1, r * 0.95, r * 0.8), tri(u, v, -r * 0.75, bob - r * 0.35, -r * 0.2, bob - r * 0.6, -r * 0.6, bob - r * 1.35), tri(u, v, r * 0.2, bob - r * 0.6, r * 0.75, bob - r * 0.35, r * 0.6, bob - r * 1.35));
    // fluffy tails sweeping back and curling up from the rump (three when awakened)
    const extra = [];
    for (let i = 0; i < tails; i++) {
      const rot = -0.55 - (i - (tails - 1) / 2) * 0.5 + sw;
      extra.push((u, v) => ellipse(u, v, -r * 1.25 + (Math.abs(i - (tails - 1) / 2)) * r * 0.1, bob + r * 0.05 - (i - (tails - 1) / 2) * r * 0.25, r * 0.85, r * 0.4, rot));
    }
    return { body, extra, r, eyes: [r * 0.32, bob], bob, alt: (u, v, m) => m === 2 && u < -r * 1.3 };
  },
  bird(stage, t) {
    const r = R0[stage] * 0.92, bob = S(t * 4) * 1, flap = S(t * 14);
    const body = (u, v) => Math.min(ellipse(u, v, 0, bob, r, r * 0.85), tri(u, v, r * 0.85, bob - r * 0.15, r * 1.45, bob + r * 0.05, r * 0.85, bob + r * 0.25));
    const extra = [(u, v) => ellipse(u, v, -r * 0.25, bob - r * 0.05 - flap * r * 0.25, r * 0.75, r * 0.32, -0.5 - flap * 0.5), (u, v) => tri(u, v, -r * 0.8, bob + r * 0.1, -r * (1.6 + stage * 0.2), bob - r * 0.25, -r * (1.5 + stage * 0.2), bob + r * 0.45)];
    if (stage >= 2) extra.push((u, v) => tri(u, v, -r * 0.1, bob - r * 0.8, r * 0.25, bob - r * 0.75, -r * 0.2, bob - r * 1.5));
    if (stage >= 3) for (let i = 0; i < 2; i++) extra.push((u, v) => ellipse(u, v, -r * (2 + i * 0.45), bob + r * (0.15 + i * 0.3), r * 0.7, r * 0.12, 0.25 + i * 0.25 + S(t * 3 + i) * 0.1));
    return { body, extra, r, eyes: [r * 0.38, bob - r * 0.15], bob, eyeGap: 0.55 };
  },
  fish(stage, t) {
    const r = R0[stage], bob = S(t * 2.2) * 1.2, wag = S(t * 7) * 0.35;
    const body = (u, v) => ellipse(u, v, 0, bob, r * 1.15, r * 0.75);
    const extra = [(u, v) => tri(u, v, -r * 0.95, bob, -r * 1.8, bob - r * (0.7 + wag), -r * 1.8, bob + r * (0.7 - wag)), (u, v) => tri(u, v, -r * 0.4, bob - r * 0.6, r * 0.3, bob - r * 0.65, -r * 0.5, bob - r * 1.25)];
    if (stage >= 2) extra.push((u, v) => ellipse(u, v, r * 0.05, bob + r * 0.45, r * 0.4, r * 0.15, 0.5 + wag));
    if (stage >= 3) extra.push((u, v) => ellipse(u, v, r * 0.6, bob - r * 0.95, r * 0.12, r * 0.45, 0.3), (u, v) => circle(u, v, r * 0.85, bob - r * 1.35, r * 0.22));
    return { body, extra, r, eyes: [r * 0.55, bob - r * 0.1], bob, eyeGap: 0.45 };
  },
  serpent(stage, t) {
    const r = R0[stage] * 0.8, bob = S(t * 2) * 0.8, n = 3 + stage;
    const segs = Array.from({ length: n }, (_, i) => [-i * r * 0.75, bob + S(t * 4 - i * 0.9) * r * 0.35 + i * r * 0.12, r * (0.75 - i * 0.07)]);
    const body = (u, v) => Math.min(ellipse(u, v, r * 0.35, bob - r * 0.15, r * 0.95, r * 0.7), ...segs.slice(1).map(([x, y, rr]) => circle(u, v, x, y, rr)));
    const extra = [(u, v) => tri(u, v, -r * 0.2, bob - r * 0.6, r * 0.15, bob - r * 0.7, -r * 0.55, bob - r * (1.2 + stage * 0.15)), (u, v) => tri(u, v, r * 0.3, bob - r * 0.7, r * 0.6, bob - r * 0.6, r * 0.25, bob - r * (1.15 + stage * 0.15))];
    if (stage >= 2) segs.slice(1, -1).forEach(([x, y, rr]) => extra.push((u, v) => tri(u, v, x - rr * 0.4, y - rr * 0.8, x + rr * 0.4, y - rr * 0.8, x, y - rr * 1.5)));
    return { body, extra, r, eyes: [r * 0.75, bob - r * 0.25], bob, eyeGap: 0.6 };
  },
  mushroom(stage, t) {
    const r = R0[stage], bob = Math.abs(S(t * 3)) * -1.2;
    const body = (u, v) => box(u, v, 0, bob + r * 0.35, r * 0.55, r * 0.6, r * 0.3);
    const extra = [(u, v) => Math.max(ellipse(u, v, 0, bob - r * 0.3, r * 1.25, r * 0.85), v - (bob - r * 0.15))];
    if (stage >= 3) extra.push((u, v) => Math.max(ellipse(u, v, r * 0.9, bob - r * 1.1, r * 0.55, r * 0.4), v - (bob - r * 1.0)));
    return { body, extra, r, eyes: [r * 0.22, bob + r * 0.3], bob, eyeGap: 0.6, spots: true };
  },
  crystal(stage, t) {
    const r = R0[stage], bob = S(t * 2) * 1.4, spin = t * 1.3;
    const body = (u, v) => Math.max(Math.abs(u) / (r * 0.8) + Math.abs(v - bob) / (r * 1.25) - 1, 0) * r * 0.6 + (Math.abs(u) / (r * 0.8) + Math.abs(v - bob) / (r * 1.25) <= 1 ? -(1 - (Math.abs(u) / (r * 0.8) + Math.abs(v - bob) / (r * 1.25))) * r * 0.6 : 0);
    const extra = [];
    for (let i = 0; i < stage + 1; i++) { const a = spin + (i / (stage + 1)) * Math.PI * 2, x = C(a) * r * 1.5, y = bob + S(a) * r * 0.5; extra.push((u, v) => Math.abs(u - x) / (r * 0.22) + Math.abs(v - y) / (r * 0.38) - 1); }
    return { body, extra, r, eyes: [r * 0.25, bob + r * 0.05], bob, eyeGap: 0.55, gem: true };
  },
  jelly(stage, t) {
    const r = R0[stage], bob = S(t * 1.8) * 1.6, pulse = S(t * 3) * 0.08;
    const body = (u, v) => Math.max(ellipse(u, v, 0, bob, r * (1 + pulse), r * (0.85 - pulse)), v - (bob + r * 0.3));
    const extra = [];
    const n = 3 + stage;
    for (let i = 0; i < n; i++) { const x0 = (i / (n - 1) - 0.5) * r * 1.4; extra.push((u, v) => { const yy = v - bob - r * 0.3; return yy < 0 || yy > r * (0.9 + stage * 0.25) ? 9 : Math.abs(u - x0 - S(yy * 0.5 - t * 5 + i) * 1.2) - Math.max(0.5, 0.9 - yy * 0.05); }); }
    return { body, extra, r, eyes: [r * 0.3, bob - r * 0.1], bob };
  },
  owl(stage, t) {
    const r = R0[stage], bob = S(t * 2.4) * 0.8, blinkTilt = S(t * 0.7) * 0.1;
    const body = (u, v) => Math.min(ellipse(u, v, 0, bob, r * 0.95, r * 1.05), tri(u, v, -r * 0.7, bob - r * 0.6, -r * 0.3, bob - r * 0.85, -r * 0.75, bob - r * 1.35), tri(u, v, r * 0.3, bob - r * 0.85, r * 0.7, bob - r * 0.6, r * 0.75, bob - r * 1.35));
    const extra = [(u, v) => ellipse(u, v, -r * 0.85, bob + r * 0.15, r * 0.35, r * 0.75, 0.25 + blinkTilt), (u, v) => ellipse(u, v, r * 0.85, bob + r * 0.15, r * 0.35, r * 0.75, -0.25 - blinkTilt)];
    if (stage >= 3) extra.push((u, v) => tri(u, v, -r * 0.2, bob - r * 1.0, r * 0.2, bob - r * 1.0, 0, bob - r * 1.7));
    return { body, extra, r, eyes: [r * 0.42, bob - r * 0.2], bob, eyeW: 2.6, eyeGap: 0.84, bigEyes: true };
  },
  cat(stage, t) {
    const r = R0[stage], bob = Math.abs(S(t * 2.5)) * -0.8, tail = S(t * 3);
    const body = (u, v) => Math.min(ellipse(u, v, 0, bob + r * 0.1, r * 1.0, r * 0.82), tri(u, v, -r * 0.8, bob - r * 0.25, -r * 0.25, bob - r * 0.62, -r * 0.82, bob - r * 1.25), tri(u, v, r * 0.25, bob - r * 0.62, r * 0.8, bob - r * 0.25, r * 0.82, bob - r * 1.25));
    const extra = [(u, v) => { const x0 = -r * 0.9, y0 = bob + r * 0.4, a = Math.atan2(v - y0, u - x0), d = Math.hypot(u - x0, v - y0); const want = r * 0.55; return a > -2.8 + tail * 0.3 && a < 0.2 ? 9 : Math.abs(d - want) - r * 0.14; }];
    if (stage >= 2) for (const s of [-1, 1]) extra.push((u, v) => box(u, v, s * r * 1.25, bob + r * 0.08, r * 0.35, 0.3));
    return { body, extra, r, eyes: [r * 0.34, bob], bob, eyeGap: 0.7, catEyes: true };
  },
  beetle(stage, t) {
    const r = R0[stage], bob = Math.abs(S(t * 5)) * -0.6, leg = S(t * 10);
    const body = (u, v) => ellipse(u, v, 0, bob, r * 1.05, r * 0.8);
    const extra = [(u, v) => Math.min(tri(u, v, r * 0.6, bob - r * 0.4, r * 0.95, bob - r * 0.25, r * 1.1, bob - r * (1.1 + stage * 0.2)), circle(u, v, r * 1.1, bob - r * (1.1 + stage * 0.2), r * 0.15))];
    for (const i of [-1, 0, 1]) extra.push((u, v) => box(u, v, i * r * 0.55 + leg * (i % 2 ? 0.6 : -0.6), bob + r * 0.85, r * 0.12, r * 0.25));
    return { body, extra, r, eyes: [r * 0.6, bob - r * 0.05], bob, eyeGap: 0.4, shellLine: true };
  },
  lantern(stage, t) {
    const r = R0[stage], sway = S(t * 1.6) * 0.15, bob = S(t * 2) * 0.8;
    const body = (u, v) => box(u, v, 0, bob, r * 0.75, r * 0.95, r * 0.2);
    const extra = [(u, v) => box(u, v, 0, bob - r * 1.05, r * 0.9, r * 0.18, 0.5), (u, v) => box(u, v, 0, bob + r * 1.05, r * 0.9, r * 0.18, 0.5), (u, v) => { const d = Math.hypot(u, v - (bob - r * 1.25)); return v > bob - r * 1.2 ? 9 : Math.abs(d - r * 0.45) - 0.6; }];
    return { body, extra, r, eyes: [r * 0.28, bob + r * 0.05], bob, eyeGap: 0.6, flameIn: true, sway };
  },
  star(stage, t) {
    const r = R0[stage] * 1.1, bob = S(t * 2) * 1, rot = S(t) * 0.15;
    const body = (u, v) => { const a = Math.atan2(v - bob, u) + rot, d = Math.hypot(u, v - bob), k = 0.55 + 0.45 * Math.pow(Math.abs(C(a * 2.5)), 3); return d - r * k; };
    const extra = [];
    if (stage >= 2) for (let i = 0; i < 4 * (stage - 1); i++) { const a = t * 1.5 + (i / (4 * (stage - 1))) * Math.PI * 2; extra.push((u, v) => circle(u, v, C(a) * r * 1.5, bob + S(a) * r * 1.5, r * 0.12)); }
    return { body, extra, r, eyes: [r * 0.22, bob + r * 0.05], bob, eyeGap: 0.6 };
  },
  butterfly(stage, t) {
    const r = R0[stage], bob = S(t * 2.5) * 1.3, f = 0.55 + 0.45 * Math.abs(S(t * 9));
    const body = (u, v) => ellipse(u, v, 0, bob, r * 0.32, r * 0.75);
    const extra = [(u, v) => ellipse(u, v, -r * 0.75 * f, bob - r * 0.35, r * 0.75 * f, r * 0.7, 0.4), (u, v) => ellipse(u, v, r * 0.75 * f, bob - r * 0.35, r * 0.75 * f, r * 0.7, -0.4), (u, v) => ellipse(u, v, -r * 0.6 * f, bob + r * 0.45, r * 0.5 * f, r * 0.45, -0.3), (u, v) => ellipse(u, v, r * 0.6 * f, bob + r * 0.45, r * 0.5 * f, r * 0.45, 0.3)];
    extra.push((u, v) => Math.min(circle(u, v, -r * 0.35, bob - r * 1.25, 0.9), circle(u, v, r * 0.35, bob - r * 1.25, 0.9)));
    return { body, extra, r, eyes: [r * 0.12, bob - r * 0.35], bob, eyeGap: 2.0, eyeW: 0.9 };
  },
  bat(stage, t) {
    const r = R0[stage], bob = S(t * 3.5) * 1.4, flap = S(t * 11);
    const wing = (s) => (u, v) => { const yy = v - bob + flap * r * 0.3, uu = s * u - r * 0.6; if (uu < 0 || uu > r * 1.5) return 9; const top = -r * 0.5 - uu * 0.25, bot = r * 0.35 - Math.abs(S(uu / r * 4.7)) * r * 0.35; return Math.max(top - yy, yy - bot); };
    const body = (u, v) => Math.min(circle(u, v, 0, bob, r * 0.8), tri(u, v, -r * 0.6, bob - r * 0.3, -r * 0.15, bob - r * 0.65, -r * 0.5, bob - r * 1.25), tri(u, v, r * 0.15, bob - r * 0.65, r * 0.6, bob - r * 0.3, r * 0.5, bob - r * 1.25));
    return { body, extra: [wing(-1), wing(1)], r, eyes: [r * 0.3, bob], bob, eyeGap: 0.75, fangs: true };
  },
  eye(stage, t) {
    const r = R0[stage], bob = S(t * 1.6) * 1.5;
    const body = (u, v) => circle(u, v, 0, bob, r);
    const extra = [];
    const n = 2 + stage * 2;
    for (let i = 0; i < n; i++) { const a = Math.PI * 0.3 + (i / (n - 1)) * Math.PI * 0.4; extra.push((u, v) => { const x0 = C(a) * r * 0.9 * (i % 2 ? 1 : -1), yy = v - bob - r * 0.6; return yy < 0 || yy > r * 1.1 ? 9 : Math.abs(u - x0 - S(yy * 0.4 - t * 4 + i) * 1.5) - 0.7; }); }
    return { body, extra, r, eyes: [0, bob], bob, oneEye: true };
  },
  sprout(stage, t) {
    const r = R0[stage], bob = Math.abs(S(t * 3)) * -1, sw = S(t * 2.5) * 0.2;
    const body = (u, v) => ellipse(u, v, 0, bob + r * 0.15, r * 0.9, r * 0.8);
    const extra = [(u, v) => box(u, v, 0, bob - r * 0.85, 0.5, r * 0.25), (u, v) => ellipse(u, v, -r * 0.45, bob - r * 1.15, r * 0.5, r * 0.22, 0.5 + sw), (u, v) => ellipse(u, v, r * 0.45, bob - r * 1.2, r * 0.5, r * 0.22, -0.5 + sw)];
    if (stage >= 2) extra.push((u, v) => ellipse(u, v, 0, bob - r * 1.45, r * 0.22, r * 0.4, sw));
    if (stage >= 3) extra.push((u, v) => circle(u, v, 0, bob - r * 1.85, r * 0.3));
    return { body, extra, r, eyes: [r * 0.3, bob + r * 0.1], bob };
  },
  cloud(stage, t) {
    const r = R0[stage], bob = S(t * 1.5) * 1.4;
    const body = (u, v) => Math.min(circle(u, v, 0, bob - r * 0.15, r * 0.75), circle(u, v, -r * 0.7, bob + r * 0.15, r * 0.55), circle(u, v, r * 0.7, bob + r * 0.1, r * 0.6), ellipse(u, v, 0, bob + r * 0.35, r * 1.2, r * 0.4));
    const extra = [];
    for (let i = 0; i < stage; i++) { const ph = (t * 1.5 + i / stage) % 1; extra.push((u, v) => tear(u, v, (i - (stage - 1) / 2) * r * 0.6, bob + r * (0.95 + ph * 1.2), r * 0.14, r * 0.3, 0)); }
    return { body, extra, r, eyes: [r * 0.28, bob], bob };
  },
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
    case "code": {
      // a little floating monitor with an antenna; brackets orbit it as it grows
      const box = (u, v, x, y, hw, hh, rr) => { const qx = Math.abs(u - x) - hw + rr, qy = Math.abs(v - y) - hh + rr; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr; };
      const body = (u, v) => Math.min(box(u, v, 0, bob, r * 1.05, r * 0.8, 1.5), box(u, v, 0, bob + r * 0.95, r * 0.35, r * 0.2, 0.5));
      const extra = [(u, v) => Math.min(box(u, v, r * 0.4, bob - r * 1.15, 0.5, r * 0.35, 0), circle(u, v, r * 0.4, bob - r * 1.55, 1.2))];
      if (stage >= 2) for (const s of [-1, 1]) extra.push((u, v) => { const x = s * r * (1.55 + 0.1 * S(t * 3)), y = bob; return Math.max(Math.abs(u - x) - 0.8, Math.abs(v - y) - r * 0.6) ; });
      return { body, extra, r, eyes: [r * 0.3, bob], bob, code: true };
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
  const sh = d.form && FORMS[d.form] ? FORMS[d.form](stage, t) : shapes(el, stage, t, o.flip), r = sh.r, a = o.alpha ?? 1;
  const RA = d.accent ? fit(d.accent, 8).map((x) => (typeof x === "number" ? x : hex(x))) : R;
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
    let c = (m === 2 ? RA : R)[k];
    const uu = u * f;
    // form details on the body
    if (sh.spots && m === 2 && ((Math.round(uu * 0.6 + 7) * 3 + Math.round(v * 0.6 + 7) * 5) % 7 === 0) && k > 2) c = hex("#fff6e8");
    if (sh.shellLine && m === 1 && Math.abs(uu + r * 0.15) < 0.5 && v < sh.bob + r * 0.6) c = R[1];
    if (sh.gem && m === 1 && (Math.abs(uu) < 0.5 || Math.abs(v - sh.bob) < 0.5)) c = R[Math.min(7, k + 1)];
    if (sh.flameIn && m === 1) { const fy = v - sh.bob, fl = Math.abs(uu) < r * (0.45 - fy * 0.03) && fy > -r * 0.6 && fy < r * 0.7; if (fl) c = fy < 0 ? hex("#fff0a0") : hex("#ffb84a"); }
    // eyes
    const [ex, ey] = sh.eyes;
    const eyeW = (sh.eyeW ?? (stage >= 2 ? 1.6 : 1.2));
    const gap = r * (sh.eyeGap ?? 0.75);
    const inEye = (cx) => Math.abs(uu - cx) < eyeW * 0.6 && v >= ey - (blink ? 0 : eyeW) && v < ey + 0.7;
    if (sh.code && m === 1) {
      const su = uu, sv = v - sh.bob, inScreen = Math.abs(su) < r * 0.82 && Math.abs(sv) < r * 0.58;
      if (inScreen) {
        c = R[1];
        const gx = su + r * 0.35, gy = sv + 0.2;
        if (Math.abs(gy) <= 1.6 && Math.abs(gx - (1.6 - Math.abs(gy))) < 0.6) c = R[7];
        if (Math.floor(t * 2.5) % 2 === 0 && Math.abs(sv - 1.3) < 0.55 && su > r * 0.15 && su < r * 0.6) c = R[7];
        if (Math.floor(sv + 40) % 2 === 0 && c === R[1]) c = R[2];
      }
    } else if (sh.oneEye && m === 1) {
      // one great eye: white, a coloured iris that looks around, a slit
      const lx = S(t * 0.8) * r * 0.2, dd = Math.hypot(uu - lx, v - ey);
      if (blink && Math.abs(v - ey) < r * 0.5) c = R[2];
      else if (dd < r * 0.62) c = dd < r * 0.18 ? hex("#0b0710") : dd < r * 0.38 ? R[6] : hex("#f4eef8");
      if (dd < r * 0.62 && Math.abs(uu - lx) < 0.6 && Math.abs(v - ey) < r * 0.3 && !blink) c = hex("#0b0710");
    } else if (sh.bigEyes && m === 1) {
      for (const cx of [ex, ex - gap]) { const dd = Math.hypot(uu - cx, v - ey); if (dd < eyeW) c = blink ? R[2] : dd < eyeW * 0.5 ? hex("#120c16") : hex("#fff6c4"); }
    } else if (m === 1 && (inEye(ex) || inEye(ex - gap))) c = sh.catEyes && Math.abs(uu - ex) > 0.4 && Math.abs(uu - (ex - gap)) > 0.4 ? hex("#ffe066") : hex("#120c16");
    if (!sh.code && !sh.oneEye && !sh.bigEyes && m === 1 && stage >= 2 && !blink && (Math.abs(uu - ex - 0.4) < 0.5 && Math.abs(v - (ey - eyeW + 0.4)) < 0.5)) c = hex("#ffffff");
    if (sh.fangs && m === 1 && !blink && Math.abs(v - ey - 2) < 0.6 && (Math.abs(uu - ex + gap * 0.25) < 0.5 || Math.abs(uu - ex + gap * 0.75) < 0.5)) c = hex("#ffffff");
    // cheeks
    if (!sh.code && !sh.oneEye && m === 1 && stage <= 2 && Math.abs(uu - ex - 1.6) < 0.8 && Math.abs(v - ey - 1.6) < 0.6) c = mix(c, hex("#ff8aa0"), 0.5);
    p.put(X, Y, c, a);
    if (k >= 6) p.add(X, Y, R[6], 0.25 * glowK * a);
  }
  if (sh.flameIn) for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) { const dd = (i * i + j * j) / 64; if (dd < 1) p.add(Math.round(x + i), Math.round(y + sh.bob + j), hex("#ffb84a"), 0.18 * a * (1 - dd)); }
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
    else if (el === "light") { const an = i / n * 6.28 + t; px = x + C(an) * r * 1.5; py = y + S(an) * r * 1.5 - ph * 4; if (ph < 0.3) { p.put(Math.round(px) + 1, Math.round(py), R[7], a); p.put(Math.round(px) - 1, Math.round(py), R[7], a); p.put(Math.round(px), Math.round(py) + 1, R[7], a); p.put(Math.round(px), Math.round(py) - 1, R[7], a); } }
    else if (el === "dark") { px = x + S(i * 2.9 + t) * r * 1.2; py = y + r * 0.8 - ph * r * 2.4; }
    else if (el === "code") { px = x + S(i * 2.1) * r * 1.6; py = y - r * 1.2 + ph * r * 2.6; p.text(i % 2 ? "1" : "0", Math.round(px), Math.round(py), R[ph < 0.5 ? 6 : 4], { font: "mini", align: "center", a: a * (1 - ph) }); continue; }
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
