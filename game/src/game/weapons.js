// Conjured weapons: while a move plays, the absorbed spirit shapes its element into something in the hero's
// hands — a wind blade, flame claws, a water whip, stone gauntlets, a shadow scythe… It flickers into being
// at the start of the move and comes apart into motes at the end.
import { hex, mix } from "../px.js";
import { layout, NEUTRAL } from "../rig/rig.js";
import { keys } from "./boss_rig.js";

// which move conjures what. len: blade length (px), both: one in each hand
export const WEAPON_BY_MOVE = {
  // wind: chakrams that fly out and come back
  "바람 차크람": { kind: "chakram", tier: 1 }, "쌍풍 차크람": { kind: "chakram", tier: 2, both: true }, "폭풍 차크람": { kind: "chakram", tier: 3 },
  "질풍 돌진": { kind: "chakram", tier: 2, both: true, held: true },
  // fire: no weapon, just fists and feet wreathed in flame
  "화염 연권": { kind: "fist", both: true, kicks: true }, "화염 선풍각": { kind: "fist", both: true, kicks: true }, "업화 승룡권": { kind: "fist", both: true, big: true },
  "불씨탄": { kind: "orb", r: 3 },
  // water
  "물의 활": { kind: "bow", len: 15, tier: 1 }, "쌍류 화살": { kind: "bow", len: 18, tier: 2 }, "격류의 화살": { kind: "bow", len: 23, tier: 3, big: true }, "얼음창": { kind: "spear", len: 24, ramp: "ice" },
  // earth: stone gauntlets, then a hammer that keeps getting bigger
  "바위 주먹": { kind: "gauntlet", both: true }, "돌 던지기": { kind: "rock" }, "대지 망치": { kind: "hammer", len: 20, swing: "hammer", two: true }, "거암 강타": { kind: "hammer", len: 25, big: true, swing: "leapslam", two: true },
  // light: a lance of light
  "빛의 창격": { kind: "lance", len: 24, tier: 1, swing: "pierce", two: true }, "성광 연창": { kind: "lance", len: 27, tier: 2, swing: "pierce3", two: true }, "천상의 창": { kind: "lance", len: 31, tier: 3, swing: "skydrive", two: true },
  // dark: a reaper's blade, from a sickle to a great scythe
  "그림자 낫": { kind: "scythe", len: 13, hook: 8, swing: "reap2" }, "망령의 낫": { kind: "scythe", len: 22, hook: 13, swing: "reapspin", two: true }, "사신의 낫": { kind: "scythe", len: 26, hook: 16, swing: "reaper", two: true, ghost: true },
  // code
  "Ctrl+X 잘라내기": { kind: "blade", len: 21, glitch: true, swing: "spin" },
};

const rot = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };

/** World positions of both hands and the direction each forearm points. */
function hands(pose, x, y, flip) {
  const P = { ...NEUTRAL, ...pose }, f = flip ? -1 : 1, parts = layout(P);
  const rx = x + f * P.x, ry = y + P.y - P.z;
  const out = {};
  for (const name of ["armN", "armF"]) {
    const prt = parts.find((q) => q.name === name), len = prt.spec.h - prt.spec.ay;
    const [dx, dy] = rot(0, len, prt.a), hx = (prt.at[0] + dx) * P.sx, hy = (prt.at[1] + dy) * P.sy;
    out[name] = { x: rx + f * hx, y: ry + hy, dx: f * -Math.sin(prt.a), dy: Math.cos(prt.a) };
  }
  return out;
}

/** World position of the near foot and the direction the shin points. */
function footN(pose, x, y, flip) {
  const P = { ...NEUTRAL, ...pose }, f = flip ? -1 : 1, prt = layout(P).find((q) => q.name === "legN"), len = prt.spec.h - prt.spec.ay;
  const [dx, dy] = rot(0, len, prt.a);
  return { x: x + f * P.x + f * (prt.at[0] + dx) * P.sx, y: y + P.y - P.z + (prt.at[1] + dy) * P.sy, dx: f * -Math.sin(prt.a), dy: Math.cos(prt.a) };
}

/** Tongues of flame licking up from a point, with embers; k scales it. */
function flameAt(p, x, y, R, glow, a, t, k, seed) {
  const n = R.length;
  for (let i = 0; i < 5; i++) {
    const ph = (t * (3 + i * 0.7) + seed * 0.37 + i * 0.29) % 1, ox = Math.sin(i * 2.3 + seed) * 2.2 * k + Math.sin(t * 13 + i) * 0.8, h = (3 + (i % 3) * 1.6) * k;
    for (let s = 0; s < h; s++) { const u = s / h, X = Math.round(x + ox * (1 - u * 0.5) + Math.sin(t * 20 + s + i) * 0.6 * u), Y = Math.round(y - s - ph * 2); p.put(X, Y, R[Math.max(0, Math.min(n - 1, Math.round((1 - u) * (n - 1))))], a * (1 - u * 0.6)); }
  }
  for (let i = 0; i < 2; i++) { const ph = (t * 1.7 + i * 0.5 + seed * 0.13) % 1; p.put(Math.round(x + Math.sin(i * 4 + t * 3 + seed) * 4 * k), Math.round(y - 4 * k - ph * 9 * k), R[n - 1], a * (1 - ph)); }
  const G = Math.round(6 * k);
  for (let j = -G; j <= G; j++) for (let i = -G; i <= G; i++) { const d = (i * i + j * j) / (G * G); if (d < 1) p.add(Math.round(x + i), Math.round(y - 1 + j), glow, 0.22 * a * (1 - d)); }
}

/** A tilted spinning chakram held at a point. */
function heldChakram(p, x, y, R, glow, a, t, tier) {
  const n = R.length, rr = [0, 3.5, 4.2, 5.5][tier], sp = t * 14;
  for (let m = 0; m < 20; m++) { const an = m / 20 * Math.PI * 2; p.put(Math.round(x + Math.cos(an) * rr), Math.round(y + Math.sin(an) * rr * 0.55), Math.sin(an) < 0 ? R[n - 1] : R[n - 3], a); }
  for (let b = 0; b < 4; b++) { const a0 = sp + b * Math.PI / 2; for (let s = 0; s <= 4; s++) { const u = s / 4, an = a0 + u * 0.7, r2 = rr + u * 2.5; p.put(Math.round(x + Math.cos(an) * r2), Math.round(y + Math.sin(an) * r2 * 0.55), R[n - 2], a); } }
  for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) { const d = (i * i + j * j) / 36; if (d < 1) p.add(Math.round(x + i), Math.round(y + j), glow, 0.14 * a * (1 - d)); }
}

/** A line with thickness, colour by distance from the core; light along it. */
function stroke(p, x0, y0, x1, y1, w, ramp, a, glow, glowK = 0.2) {
  const L = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  const n = ramp.length;
  for (let s = 0; s <= L; s++) {
    const u = s / L, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u, ww = typeof w === "function" ? w(u) : w;
    const R = Math.ceil(ww);
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
      const d = Math.hypot(i, j);
      if (d > ww + 0.3) continue;
      const k = Math.max(0, Math.min(n - 1, Math.round((1 - d / (ww + 0.5)) * (n - 1))));
      p.put(Math.round(x + i), Math.round(y + j), ramp[k], a);
    }
    if (glow && s % 2 === 0) for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const d = i * i + j * j; if (d < 9) p.add(Math.round(x + i), Math.round(y + j), glow, glowK * a * (1 - d / 9)); }
  }
}

/**
 * Draw the conjured weapon for the hero's current move.
 * k: 0..1 how solid it is (fades in and out); t: time for flicker.
 */
export function drawWeapon(p, hero, pose, W, k, t) {
  if (!W || k <= 0.02) return;
  const flip = hero.spinFlip ? !hero.flip : hero.flip, H = hands(pose, hero.x, hero.y - hero.z, flip);
  const R = (W.ramp === "ice" ? hero.ramps.ice : hero.ramps.main).map((c) => (typeof c === "number" ? c : hex(c)));
  const n = R.length, bright = R.slice(Math.floor(n / 3)), glow = hero.glowC, st = hero.stage, grow = 1 + (st - 1) * 0.18, a = Math.min(1, k * 1.4);
  const flick = Math.sin(t * 40) * 0.5;
  const list = W.both ? ["armN", "armF"] : ["armN"];
  for (const arm of list) {
    const h = H[arm], dir = [h.dx, h.dy], perp = [-h.dy, h.dx];
    const len = (W.len ?? 12) * grow * (arm === "armF" ? 0.9 : 1), tip = [h.x + dir[0] * len, h.y + dir[1] * len];
    const aa = arm === "armF" ? a * 0.8 : a;
    switch (W.kind) {
      case "blade": case "greatsword": case "dagger": {
        const wide = W.kind === "greatsword" ? 2.4 : W.kind === "dagger" ? 1.1 : 1.6;
        // a crossguard of light, then a blade that tapers to the point
        stroke(p, h.x - perp[0] * 3, h.y - perp[1] * 3, h.x + perp[0] * 3, h.y + perp[1] * 3, 0.8, bright, aa);
        stroke(p, h.x + dir[0] * 1.5, h.y + dir[1] * 1.5, tip[0], tip[1], (u) => wide * grow * (1 - u * 0.75) + (W.flame ? Math.abs(Math.sin(u * 9 + t * 20)) * 0.8 : 0), bright, aa, glow, st >= 3 ? 0.3 : 0.18);
        if (W.arcs || st >= 3) for (let i = 0; i < 2; i++) { const u0 = Math.random(), u1 = Math.min(1, u0 + 0.25); const j = (q) => (Math.random() - 0.5) * 6; stroke(p, h.x + dir[0] * len * u0 + j(), h.y + dir[1] * len * u0 + j(), h.x + dir[0] * len * u1 + j(), h.y + dir[1] * len * u1 + j(), 0.4, [R[n - 1]], aa * 0.8); }
        if (W.glitch && Math.random() < 0.5) { const u = Math.random(); const gx = h.x + dir[0] * len * u, gy = h.y + dir[1] * len * u; for (let i = 0; i < 4; i++) p.put(Math.round(gx + perp[0] * (3 + i)), Math.round(gy + perp[1] * (3 + i)), R[n - 2], aa); }
        break;
      }
      case "claws": {
        // three hooked talons of the element curling out past the knuckles
        for (let c = -1; c <= 1; c++) {
          const base = [h.x + perp[0] * c * 1.6, h.y + perp[1] * c * 1.6], spread = c * 0.25;
          const d2 = [dir[0] * Math.cos(spread) - dir[1] * Math.sin(spread), dir[0] * Math.sin(spread) + dir[1] * Math.cos(spread)];
          const mid = [base[0] + d2[0] * len * 0.6, base[1] + d2[1] * len * 0.6], end = [mid[0] + (d2[0] + perp[0] * 0.5) * len * 0.5, mid[1] + (d2[1] + perp[1] * 0.5) * len * 0.5];
          stroke(p, base[0], base[1], mid[0], mid[1], 0.9, bright, aa, glow, 0.15);
          stroke(p, mid[0], mid[1], end[0], end[1], 0.5, bright, aa, glow, 0.15);
        }
        break;
      }
      case "chakram": {
        // held until it is thrown: the near one at the release, the far one a beat later
        const at = hero.act?.t ?? 1, gone = !W.held && at >= (arm === "armF" ? 0.06 : 0);
        if (!gone) heldChakram(p, h.x + dir[0] * 2, h.y + dir[1] * 2, R, glow, aa, t + (arm === "armF" ? 0.3 : 0), W.tier ?? 1);
        break;
      }
      case "fist": {
        const fr = hero.ramps.main.map((c) => (typeof c === "number" ? c : hex(c)));
        flameAt(p, h.x + dir[0] * 1.5, h.y + dir[1] * 1.5, fr, glow, aa, t, (W.big ? 1.35 : 1) * (0.85 + st * 0.15), arm === "armF" ? 3 : 0);
        if (W.kicks && arm === "armN") {
          const F = footN(pose, hero.x, hero.y - hero.z, flip);
          if (F.dx * (flip ? -1 : 1) > 0.55) flameAt(p, F.x + F.dx * 2, F.y + F.dy * 2, fr, glow, aa, t, 1.1, 7);
        }
        break;
      }
      case "orb": {
        const r = (W.r ?? 3) * grow + flick * 0.4, cx = h.x + dir[0] * 2, cy = h.y + dir[1] * 2;
        for (let j = -Math.ceil(r); j <= Math.ceil(r); j++) for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) { const d = Math.hypot(i, j); if (d <= r) p.put(Math.round(cx + i), Math.round(cy + j), R[Math.max(0, Math.min(n - 1, Math.round((1 - d / (r + 0.5)) * (n - 1))))], aa); }
        for (let j = -7; j <= 7; j++) for (let i = -7; i <= 7; i++) { const d = i * i + j * j; if (d < 49) p.add(Math.round(cx + i), Math.round(cy + j), glow, 0.12 * aa * (1 - d / 49)); }
        break;
      }
      case "bow": {
        if (arm !== "armN") break;
        // the bow grows with the spirit: a plain water bow, then a recurve with streaming ribbons (수류궁),
        // then a great crescent bow with fins, a gem at the grip and a string of light (해신궁)
        const tier = W.tier ?? 1, H2 = H.armF, at = hero.act?.t ?? 1, def = hero.act?.def;
        const two = def?.name === "쌍류 화살", wind = def?.windup ?? 0.25;
        const behind = (H2.x - h.x) * dir[0] + (H2.y - h.y) * dir[1] < -2;
        const drawn = behind && ((at < 0 && at > -wind * 0.8) || (two && at > 0.05 && at < 0.11));
        const half = len * 0.5, bend = len * (tier === 3 ? 0.24 : 0.3) * (drawn ? 0.7 : 1);
        // the bow cants while drawn and jolts forward on the release
        const rel0 = two && at > 0.11 ? at - 0.11 : at, cant = drawn ? -0.3 : rel0 > 0 && rel0 < 0.22 ? -0.3 - 0.18 * Math.sin(Math.min(1, rel0 / 0.22) * Math.PI) : 0;
        const fwd = [flip ? -1 : 1, 0];
        { const c = Math.cos(cant), sn = Math.sin(cant), d0 = [dir[0], dir[1]], q0 = [perp[0], perp[1]]; dir[0] = d0[0] * c + q0[0] * sn; dir[1] = d0[1] * c + q0[1] * sn; perp[0] = q0[0] * c - d0[0] * sn; perp[1] = q0[1] * c - d0[1] * sn; }
        const pt = (s, inset = 0) => { const rc = tier === 2 ? Math.pow(Math.abs(s), 5) * len * 0.2 : tier === 3 ? Math.pow(Math.abs(s), 4) * len * 0.12 : 0;
          return [h.x + perp[0] * s * half + dir[0] * ((1 - s * s) * bend + rc - inset), h.y + perp[1] * s * half + dir[1] * ((1 - s * s) * bend + rc - inset)]; };
        const limb = (inset, wdt, cols, gk) => { let prev = pt(-1, inset); for (let i = 1; i <= 14; i++) { const s = -1 + (i / 14) * 2, q = pt(s, inset); stroke(p, prev[0], prev[1], q[0], q[1], () => wdt * (1.15 - Math.abs(s) * 0.5), cols, aa, glow, gk); prev = q; } };
        limb(0, tier === 1 ? 0.9 : tier === 2 ? 1.2 : 1.5, bright, 0.22 + tier * 0.06);
        if (tier === 3) limb(1.6, 0.5, [R[n - 1]], 0.3);
        // the string: pulled to the drawing hand, or trembling for a moment after a release
        const rel = two && at > 0.11 ? at - 0.11 : at, buzz = !drawn && rel > 0 && rel < 0.25 ? Math.sin(rel * 90) * (1 - rel / 0.25) * 2 : 0;
        const top = pt(-1), bot = pt(1), nock = drawn ? [H2.x, H2.y] : [h.x - dir[0] * (1.5 + buzz), h.y - dir[1] * (1.5 + buzz)];
        const sc = tier === 3 ? [hex("#ffffff")] : [R[n - 1]];
        stroke(p, top[0], top[1], nock[0], nock[1], tier === 3 ? 0.5 : 0.35, sc, aa * 0.9, tier === 3 ? glow : null, 0.25);
        stroke(p, bot[0], bot[1], nock[0], nock[1], tier === 3 ? 0.5 : 0.35, sc, aa * 0.9, tier === 3 ? glow : null, 0.25);
        if (drawn) {
          const tipA = [h.x + dir[0] * (4 + tier * 2.5), h.y + dir[1] * (4 + tier * 2.5)];
          stroke(p, nock[0], nock[1], tipA[0], tipA[1], 0.5 + tier * 0.2, bright, aa, glow, 0.35);
          const gr = 4 + tier * 2; for (let j = -gr; j <= gr; j++) for (let i = -gr; i <= gr; i++) { const d = i * i + j * j; if (d < gr * gr) p.add(Math.round(tipA[0] + i), Math.round(tipA[1] + j), glow, (0.12 + tier * 0.05) * aa * (1 - d / (gr * gr))); }
        }
        if (tier >= 2) for (const sgn of [-1, 1]) {
          // ribbons of water streaming off the limb tips
          const q = pt(sgn);
          for (let k2 = 1; k2 <= 8; k2++) { const x2 = q[0] - dir[0] * k2 * 0.9 + perp[0] * Math.sin(t * 9 + k2 * 0.8 + sgn) * 1.2 + perp[0] * sgn * k2 * 0.2, y2 = q[1] - dir[1] * k2 * 0.9 + Math.sin(t * 9 + k2 * 0.8 + sgn) * 1.2 + k2 * 0.35; p.blendPx(Math.round(x2), Math.round(y2), R[n - 2], aa * 0.7 * (1 - k2 / 9)); }
        }
        if (tier === 3) {
          for (const sgn of [-1, 1]) { const m = pt(sgn * 0.55), fx = m[0] + dir[0] * 3 + perp[0] * sgn * 1.5, fy = m[1] + dir[1] * 3 + perp[1] * sgn * 1.5; stroke(p, m[0], m[1], fx, fy, 0.6, bright, aa, glow, 0.3); const tq = pt(sgn); stroke(p, tq[0], tq[1], tq[0] + perp[0] * sgn * 2.5, tq[1] + perp[1] * sgn * 2.5, 0.5, [R[n - 1]], aa); }
          const gx = h.x + dir[0] * bend * 0.9, gy = h.y + dir[1] * bend * 0.9;
          for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) p.put(Math.round(gx + i), Math.round(gy + j), i === 0 && j === 0 ? hex("#ffffff") : R[n - 2], aa);
          for (let j = -7; j <= 7; j++) for (let i = -7; i <= 7; i++) { const d = i * i + j * j; if (d < 49) p.add(Math.round(gx + i), Math.round(gy + j), glow, 0.2 * aa * (1 - d / 49)); }
          for (let i = 0; i < 3; i++) { const an = t * 3 + i * 2.1; p.put(Math.round(gx + Math.cos(an) * 6), Math.round(gy + Math.sin(an) * 3.5), R[n - 1], aa); }
        }
        for (let i = 0; i < tier; i++) { const ph = (t * 1.3 + i * 0.37) % 1, q = pt(i % 2 ? 0.8 : -0.8); p.put(Math.round(q[0]), Math.round(q[1] + ph * 6), R[n - 2], aa * (1 - ph)); }
        // while drawn, water gathers spiralling into the arrowhead
        if (drawn) for (let i = 0; i < 3 + tier * 3; i++) {
          const ph = (t * (2.2 + tier * 0.4) + i / (3 + tier * 3)) % 1, an = i * 2.4 + t * 9, rr = (1 - ph) * (8 + tier * 4);
          const cx = h.x + dir[0] * (4 + tier * 2.5) + Math.cos(an) * rr, cy = h.y + dir[1] * (4 + tier * 2.5) + Math.sin(an) * rr * 0.7;
          p.put(Math.round(cx), Math.round(cy), R[n - (ph > 0.6 ? 1 : 2)], aa * (0.4 + ph * 0.6)); p.add(Math.round(cx), Math.round(cy), glow, 0.3 * aa * ph);
        }
        // the release: a white streak off the bow and a ring of spray
        if (rel0 > 0 && rel0 < 0.16) {
          const u = rel0 / 0.16, L2 = (18 + tier * 8) * (0.4 + u), w2 = (1.6 + tier * 0.4) * (1 - u);
          stroke(p, h.x + fwd[0] * 3, h.y, h.x + fwd[0] * (3 + L2), h.y, () => w2, [hex("#ffffff"), R[n - 1]], aa * (1 - u), glow, 0.4);
          const ring = (4 + tier * 3) + u * (10 + tier * 5);
          for (let i = 0; i < 10 + tier * 4; i++) { const an = i / (10 + tier * 4) * Math.PI * 2; p.put(Math.round(h.x + Math.cos(an) * ring * 0.45 + fwd[0] * 5), Math.round(h.y + Math.sin(an) * ring), R[n - 1], aa * (1 - u)); }
          for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) { const d = i * i + j * j; if (d < 64) p.add(Math.round(h.x + fwd[0] * 5 + i), Math.round(h.y + j), glow, (0.25 + tier * 0.08) * aa * (1 - u) * (1 - d / 64)); }
        }
        break;
      }
      case "spear": {
        stroke(p, h.x - dir[0] * len * 0.45, h.y - dir[1] * len * 0.45, tip[0], tip[1], 0.8, bright, aa, glow, 0.15);
        const head = [tip[0] + dir[0] * 5, tip[1] + dir[1] * 5];
        stroke(p, tip[0] - perp[0] * 2.5, tip[1] - perp[1] * 2.5, head[0], head[1], 0.7, bright, aa);
        stroke(p, tip[0] + perp[0] * 2.5, tip[1] + perp[1] * 2.5, head[0], head[1], 0.7, bright, aa, glow, 0.3);
        break;
      }
      case "hammer": {
        // a stone shaft and a heavy head across its end
        const stone = (hero.ramps.stone ?? hero.ramps.main).map((c) => (typeof c === "number" ? c : hex(c)));
        stroke(p, h.x - dir[0] * 3, h.y - dir[1] * 3, tip[0], tip[1], 1.1, stone.slice(2, 6), aa);
        const hg = 1 + (st - 1) * 0.08, hw = (W.big ? 7.5 : 6) * hg, hl = (W.big ? 5 : 4) * hg;
        for (let j = -hl; j <= hl; j++) for (let i = -hw; i <= hw; i++) {
          const x = tip[0] + perp[0] * i + dir[0] * j, y = tip[1] + perp[1] * i + dir[1] * j;
          if (Math.abs(i) > hw - 1.2 && Math.abs(j) > hl - 1.2) continue;
          const edge = Math.abs(i) > hw - 1 || Math.abs(j) > hl - 1;
          p.put(Math.round(x), Math.round(y), edge ? stone[1] : (i + j < 0 ? stone[5] : stone[3]), aa);
        }
        stroke(p, tip[0] - perp[0] * hw, tip[1] - perp[1] * hw, tip[0] + perp[0] * hw, tip[1] + perp[1] * hw, 0.4, [hero.accent[4]], aa, glow, 0.25);
        if (W.big) for (const sg of [-1, 1]) {
          // crystal spikes jutting from both faces, glowing veins of the element
          const bx = tip[0] + perp[0] * sg * hw, by = tip[1] + perp[1] * sg * hw;
          stroke(p, bx, by, bx + perp[0] * sg * 4 + dir[0] * 2, by + perp[1] * sg * 4 + dir[1] * 2, (u) => 1.6 * (1 - u), [hero.accent[2], hero.accent[3], hero.accent[4]], aa, glow, 0.3);
          stroke(p, tip[0] + perp[0] * sg * 3 - dir[0] * hl * 0.6, tip[1] + perp[1] * sg * 3 - dir[1] * hl * 0.6, tip[0] + perp[0] * sg * 3 + dir[0] * hl * 0.6, tip[1] + perp[1] * sg * 3 + dir[1] * hl * 0.6, 0.35, [hero.accent[4]], aa, glow, 0.3);
        }
        break;
      }
      case "gauntlet": {
        // the fist cased in a block of stone, bright cracks across the knuckles
        const stone = (hero.ramps.stone ?? hero.ramps.main).map((c) => (typeof c === "number" ? c : hex(c)));
        const s2 = 3.4 * grow;
        for (let j = -s2; j <= s2; j++) for (let i = -s2; i <= s2; i++) {
          if (Math.abs(i) + Math.abs(j) > s2 * 1.6) continue;
          const x = h.x + perp[0] * i + dir[0] * j, y = h.y + perp[1] * i + dir[1] * j;
          const edge = Math.abs(i) + Math.abs(j) > s2 * 1.6 - 1.2;
          p.put(Math.round(x), Math.round(y), edge ? stone[1] : j > s2 * 0.4 ? stone[5] : stone[3], aa);
        }
        stroke(p, h.x + dir[0] * s2 * 0.6 - perp[0] * s2 * 0.7, h.y + dir[1] * s2 * 0.6 - perp[1] * s2 * 0.7, h.x + dir[0] * s2 * 0.6 + perp[0] * s2 * 0.7, h.y + dir[1] * s2 * 0.6 + perp[1] * s2 * 0.7, 0.35, [hero.accent[4]], aa, glow, 0.3);
        break;
      }
      case "rock": {
        const stone = (hero.ramps.stone ?? hero.ramps.main).map((c) => (typeof c === "number" ? c : hex(c))), r = 4.5;
        for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) { const d = Math.hypot(i, j * 1.1); if (d <= r) p.put(Math.round(h.x + i), Math.round(h.y - 2 + j), d > r - 1 ? stone[1] : i + j < -1 ? stone[5] : stone[3], aa); }
        break;
      }
      case "scythe": {
        // a long shaft with a curved blade sweeping back from the top
        stroke(p, h.x - dir[0] * len * 0.3, h.y - dir[1] * len * 0.3, tip[0], tip[1], 0.8, bright.slice(0, 4), aa);
        let prev = tip;
        for (let s = 1; s <= 10; s++) {
          const u = s / 10, ang = u * 1.6, d2 = [dir[0] * Math.cos(ang) - dir[1] * Math.sin(ang) * -1, dir[0] * Math.sin(ang) * -1 + dir[1] * Math.cos(ang)];
          const pt = [tip[0] + (perp[0] * -1) * u * 16 * grow + d2[0] * 2, tip[1] + (perp[1] * -1) * u * 16 * grow + d2[1] * 2 + Math.sin(u * Math.PI) * -4];
          stroke(p, prev[0], prev[1], pt[0], pt[1], 2.4 * (1 - u * 0.75), bright, aa, glow, 0.3);
          prev = pt;
        }
        break;
      }
      case "whip": {
        // a ribbon of water trailing behind the hand's recent path
        const pts = hero.whipPts ?? [];
        for (let i = 1; i < pts.length; i++) stroke(p, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 1.3 * (1 - i / pts.length) + 0.4, bright, aa * (1 - i / pts.length * 0.5), glow, 0.15);
        break;
      }
    }
  }
  // appearing and dissolving: motes around the hand
  if (k < 0.95) for (let i = 0; i < 4; i++) { const h = H.armN, an = Math.random() * Math.PI * 2, d = 3 + Math.random() * 8; p.put(Math.round(h.x + Math.cos(an) * d), Math.round(h.y + Math.sin(an) * d), R[n - 1], 0.8); p.add(Math.round(h.x + Math.cos(an) * d), Math.round(h.y + Math.sin(an) * d), glow, 0.4); }
}

/** Keep a short history of the hand for the whip ribbon. */
export function trackWhip(hero, pose) {
  const flip = hero.spinFlip ? !hero.flip : hero.flip, h = hands(pose, hero.x, hero.y - hero.z, flip).armN;
  const pts = (hero.whipPts ??= []);
  // the ribbon trails out ahead along the arm, lagging as the hand moves
  const len = 30 * (1 + (hero.stage - 1) * 0.15), tip = [h.x + h.dx * len, h.y + h.dy * len];
  if (!hero.whipTip) hero.whipTip = tip;
  hero.whipTip = [hero.whipTip[0] + (tip[0] - hero.whipTip[0]) * 0.35, hero.whipTip[1] + (tip[1] - hero.whipTip[1]) * 0.35];
  pts.length = 0;
  for (let i = 0; i <= 8; i++) { const u = i / 8, sag = Math.sin(u * Math.PI) * 4; pts.push([h.x + (hero.whipTip[0] - h.x) * u, h.y + (hero.whipTip[1] - h.y) * u + sag]); }
}


// ------------------------------------------------------------------ swung weapons in 3D
// A blade's direction is (pitch th, yaw psi): th 0 is level, + points down; psi 0 points forward, + swings
// toward the viewer, ±π points back. It is projected with the depth axis tilted onto the screen, so a blade
// swinging past the viewer foreshortens and a blade behind the body is drawn behind it.
const DEPTH = 0.45;
export function bladeDir(th, psi) {
  const c = Math.cos(th), x = c * Math.cos(psi), y = Math.sin(th), z = c * Math.sin(psi);
  return { x, y: y + z * DEPTH, z };
}

const STANCE = { lN: 0.34, lF: -0.32, lean: 0.12, crouch: 1, turn: 0.85, x: 0, sx: 1, sy: 1, head: 0 };
const S2 = (o) => ({ ...STANCE, ...o });

/** Swing keyframes: blade angles plus body, around the release (t = 0). W = wind-up, R = recovery. */
function swingKeys(kind, W, R) {
  const w = (k) => -W * k, r = (k) => R * k;
  switch (kind) {
    case "sweep": return [ // cocked behind on the far side, ripped across the front toward the viewer, carried through
      [w(1), S2({ th: 0.4, psi: 0.2 })],
      [w(0.35), S2({ th: -0.1, psi: -2.6, turn: 1, lean: -0.15, x: -2, crouch: 2, lN: 0.25, lF: -0.5, sy: 0.95, head: -0.1 }), "out"],
      [0, S2({ th: 0.05, psi: -0.6, turn: 0.8, lean: 0.28, x: 3, lN: 0.6, lF: -0.45, sx: 1.06 }), "in"],
      [0.07, S2({ th: 0.12, psi: 1.1, turn: 0.45, lean: 0.36, x: 5, lN: 0.66, lF: -0.5, sx: 1.08, crouch: 2 }), "lin"],
      [0.15, S2({ th: 0.22, psi: 2.0, turn: 0.35, lean: 0.32, x: 6, lN: 0.66, lF: -0.5, crouch: 2 }), "out"],
      [r(1), S2({ th: 0.5, psi: 0.6 }), "io"],
    ];
    case "reap": return [ // a wide, low scything sweep from far behind to the near side
      [w(1), S2({ th: 0.5, psi: 0.3 })],
      [w(0.35), S2({ th: 0.25, psi: -2.8, turn: 1, lean: -0.1, x: -2, crouch: 3, lN: 0.3, lF: -0.55, sy: 0.94 }), "out"],
      [0, S2({ th: 0.35, psi: -0.9, turn: 0.75, lean: 0.25, x: 3, crouch: 4, lN: 0.65, lF: -0.5, sx: 1.06 }), "in"],
      [0.12, S2({ th: 0.4, psi: 1.3, turn: 0.4, lean: 0.35, x: 6, crouch: 5, lN: 0.7, lF: -0.55, sx: 1.08 }), "lin"],
      [0.22, S2({ th: 0.45, psi: 2.2, turn: 0.35, lean: 0.3, x: 6, crouch: 4 }), "out"],
      [r(1), S2({ th: 0.5, psi: 0.4 }), "io"],
    ];
    case "overhead": return [ // up over the shoulder and down through a great arc, ending low
      [w(1), S2({ th: 0.4, psi: 0.15 })],
      [w(0.4), S2({ th: -2.0, psi: -0.35, turn: 0.95, lean: -0.25, x: -1, lN: 0.35, lF: -0.4, sy: 1.05, head: -0.25 }), "out"],
      [w(0.1), S2({ th: -2.25, psi: -0.4, turn: 0.95, lean: -0.3, x: -2, lN: 0.38, lF: -0.42, sy: 1.06, head: -0.3 }), "io"],
      [0, S2({ th: -0.35, psi: 0.15, turn: 0.75, lean: 0.35, x: 3, lN: 0.65, lF: -0.5, sx: 1.06 }), "in"],
      [0.06, S2({ th: 1.0, psi: 0.35, turn: 0.6, lean: 0.52, x: 5, crouch: 4, lN: 0.75, lF: -0.6, sx: 1.1, sy: 0.9 }), "lin"],
      [0.16, S2({ th: 1.4, psi: 0.5, turn: 0.6, lean: 0.55, x: 5, crouch: 5, lN: 0.75, lF: -0.6, sy: 0.92 }), "out"],
      [r(1), S2({ th: 0.6, psi: 0.3 }), "io"],
    ];
    case "rising": return [ // from low behind, up across the front, finishing high
      [w(1), S2({ th: 0.5, psi: 0.2 })],
      [w(0.35), S2({ th: 0.9, psi: -2.4, turn: 0.95, lean: 0.25, x: -1, crouch: 5, lN: 0.55, lF: -0.5, sy: 0.92 }), "out"],
      [0, S2({ th: 0.3, psi: -0.4, turn: 0.75, lean: 0.15, x: 3, crouch: 2, lN: 0.6, lF: -0.5 }), "in"],
      [0.08, S2({ th: -1.1, psi: 0.7, turn: 0.5, lean: -0.15, x: 5, lN: 0.5, lF: -0.6, sy: 1.06 }), "lin"],
      [0.18, S2({ th: -1.55, psi: 1.0, turn: 0.45, lean: -0.22, x: 5, sy: 1.04 }), "out"],
      [r(1), S2({ th: 0.5, psi: 0.3 }), "io"],
    ];
    case "spin": return [ // the blade circles the body once; the body twists to follow it
      [w(1), S2({ th: 0.3, psi: 0.2 })],
      [w(0.35), S2({ th: 0.1, psi: -1.4, turn: 1, lean: -0.1, crouch: 3, lN: 0.45, lF: -0.5, sy: 0.93 }), "out"],
      [0, S2({ th: 0.1, psi: -0.3, crouch: 1, lN: 0.35, lF: -0.3, sx: 1.05 }), "in"],
      [0.27, S2({ th: 0.12, psi: Math.PI * 2 - 0.3, crouch: 1, lN: 0.35, lF: -0.3 }), "lin"],
      [0.33, S2({ th: 0.3, psi: Math.PI * 2 + 0.5, crouch: 3, lean: 0.25, lN: 0.5, lF: -0.45 }), "out"],
      [r(1), S2({ th: 0.5, psi: Math.PI * 2 + 0.3 }), "io"],
    ];
    case "thrust": return [ // drawn back, then driven straight through
      [w(1), S2({ th: 0.3, psi: 0.1 })],
      [w(0.4), S2({ th: 0.05, psi: -2.9, turn: 1, lean: 0.4, crouch: 4, lN: 0.7, lF: -0.7, sy: 0.9 }), "out"],
      [0, S2({ th: 0.02, psi: 0.05, turn: 0.95, lean: 0.6, x: 2, lN: 0.85, lF: -0.95, sx: 1.15, sy: 0.9 }), "in"],
      [0.16, S2({ th: 0.15, psi: 0.6, turn: 0.7, lean: 0.4, x: 2, crouch: 3, lN: 0.65, lF: -0.6 }), "out"],
      [r(1), S2({ th: 0.4, psi: 0.3 }), "io"],
    ];
    // ---- the lance. arm: the forearm angle (0 down, π/2 forward), fa: how far it follows the shaft instead
    case "pierce": return [ // pulled to the hip, then driven out at full stretch in one lunge
      [w(1), S2({ th: 0.15, psi: 0.1, arm: 0.9, fa: 0 })],
      [w(0.45), S2({ th: 0.06, psi: 0.05, arm: 0.15, fa: 0, turn: 1, lean: -0.22, x: -3, crouch: 3, lN: 0.5, lF: -0.62, sx: 0.95, head: 0.05 }), "out"],
      [0, S2({ th: -0.02, psi: 0, arm: 1.6, fa: 0, turn: 1, lean: 0.52, x: 6, crouch: 2, lN: 0.88, lF: -0.82, sx: 1.17, sy: 0.92 }), "snap"],
      [0.07, S2({ th: 0, psi: 0, arm: 1.62, fa: 0, turn: 1, lean: 0.55, x: 7, crouch: 2.5, lN: 0.88, lF: -0.82, sx: 1.08 }), "out"],
      [r(0.6), S2({ th: 0.1, psi: 0.05, arm: 1.0, fa: 0, turn: 0.95, lean: 0.25, x: 4, crouch: 1.5 }), "back"],
      [r(1), S2({ th: 0.15, psi: 0.1, arm: 0.9, fa: 0 }), "io"],
    ];
    case "pierce3": { // three thrusts, each further forward and quicker, then the shaft whipped across the front
      const ext = (x, th, k = 1) => S2({ th, psi: 0, arm: 1.6, fa: 0, turn: 1, lean: 0.5, x, crouch: 2, lN: 0.85, lF: -0.8, sx: 1 + 0.12 * k, sy: 0.93 });
      const ret = (x) => S2({ th: 0.08, psi: 0.04, arm: 0.55, fa: 0, turn: 1, lean: 0.22, x, crouch: 2.5, lN: 0.7, lF: -0.7, sx: 0.98 });
      return [
        [w(1), S2({ th: 0.15, psi: 0.1, arm: 0.9, fa: 0 })],
        [w(0.5), S2({ th: 0.06, psi: 0.05, arm: 0.15, fa: 0, turn: 1, lean: -0.2, x: -3, crouch: 3, lN: 0.5, lF: -0.62, sx: 0.95 }), "out"],
        [0, ext(5, -0.02)], [0.035, ret(4), "out"],
        [0.07, ext(8, -0.12, 1.1), "snap"], [0.1, ret(7), "out"],
        [0.13, ext(11, 0.06, 1.4), "snap"],
        [0.19, S2({ th: 0.05, psi: -2.3, arm: 0, fa: 1, turn: 1, lean: -0.12, x: 9, crouch: 3, lN: 0.5, lF: -0.6, sy: 0.95 }), "out"],
        [0.25, S2({ th: 0.12, psi: 0.4, arm: 0, fa: 1, turn: 0.6, lean: 0.42, x: 12, crouch: 2, lN: 0.82, lF: -0.7, sx: 1.1 }), "in"],
        [0.31, S2({ th: 0.25, psi: 1.7, arm: 0, fa: 1, turn: 0.45, lean: 0.36, x: 12, crouch: 3.5 }), "out"],
        [r(1), S2({ th: 0.15, psi: 0.1, arm: 0.9, fa: 0 }), "io"],
      ];
    }
    case "skydrive": return [ // coiled low and back while light gathers, then a blinding charge straight through
      [w(1), S2({ th: 0.15, psi: 0.1, arm: 0.9, fa: 0 })],
      [w(0.7), S2({ th: 0.12, psi: 0.05, arm: 0.1, fa: 0, turn: 1, lean: -0.3, x: -4, crouch: 5, lN: 0.62, lF: -0.82, sx: 0.94, sy: 1.02, head: 0.1 }), "out"],
      [w(0.1), S2({ th: 0.1, psi: 0.05, arm: 0.05, fa: 0, turn: 1, lean: -0.36, x: -5, crouch: 6, lN: 0.65, lF: -0.85, sx: 0.92, sy: 1.04, head: 0.12 }), "io"],
      [0, S2({ th: 0, psi: 0, arm: 1.6, fa: 0, turn: 1, lean: 0.68, x: 4, crouch: 2, lN: 1.02, lF: -1.02, sx: 1.26, sy: 0.88 }), "snap"],
      [0.1, S2({ th: 0, psi: 0, arm: 1.6, fa: 0, turn: 1, lean: 0.62, x: 5, crouch: 2, lN: 1.0, lF: -1.0, sx: 1.16, sy: 0.9 }), "lin"],
      [0.17, S2({ th: 0.05, psi: 0.05, arm: 1.5, fa: 0, turn: 1, lean: 0.42, x: 6, crouch: 5, lN: 0.85, lF: -0.8, sx: 1.05, sy: 0.9 }), "out"],
      [r(0.7), S2({ th: 0.15, psi: 0.1, arm: 1.0, fa: 0, lean: 0.2, x: 4, crouch: 2 }), "back"],
      [r(1), S2({ th: 0.15, psi: 0.1, arm: 0.9, fa: 0 }), "io"],
    ];
    // ---- the hammer
    case "hammer": return [ // dragged low behind, heaved up over the head with a hop, brought down and left in the ground
      [w(1), S2({ th: 0.4, psi: 0.15 })],
      [w(0.62), S2({ th: 0.9, psi: -2.4, turn: 1, lean: 0.22, crouch: 4, x: -1, lN: 0.45, lF: -0.5, sy: 0.9, sx: 1.05 }), "out"],
      [w(0.15), S2({ th: -2.25, psi: -0.45, turn: 0.95, lean: -0.34, x: -1, z: 5, lN: 0.55, lF: -0.15, sy: 1.1, sx: 0.93, head: -0.3 }), "out"],
      [0, S2({ th: -0.5, psi: 0.1, turn: 0.75, lean: 0.4, x: 3, z: 3, lN: 0.7, lF: -0.5, sx: 1.06 }), "in"],
      [0.06, S2({ th: 1.15, psi: 0.3, turn: 0.6, lean: 0.6, x: 5, crouch: 6, lN: 0.85, lF: -0.7, sx: 1.14, sy: 0.86 }), "lin"],
      [0.22, S2({ th: 1.3, psi: 0.35, turn: 0.6, lean: 0.55, x: 5, crouch: 5, lN: 0.85, lF: -0.7, sy: 0.9 }), "out"],
      [r(1), S2({ th: 0.5, psi: 0.2 }), "io"],
    ];
    case "leapslam": return [ // a crouch, a huge leap with the hammer wound behind the head, and the whole weight brought down
      [w(1), S2({ th: 0.5, psi: 0.2 })],
      [w(0.78), S2({ th: 1.0, psi: -2.3, turn: 1, lean: 0.32, crouch: 6, x: -2, lN: 0.6, lF: -0.6, sy: 0.85, sx: 1.08 }), "out"],
      [w(0.45), S2({ th: -1.6, psi: -0.6, turn: 0.95, lean: -0.3, z: 17, lN: 0.9, lF: 0.3, sy: 1.12, sx: 0.92, head: -0.3 }), "out"],
      [w(0.12), S2({ th: -2.55, psi: -0.5, turn: 0.95, lean: -0.44, z: 21, lN: 0.8, lF: 0.4, sy: 1.08, head: -0.36 }), "io"],
      [0, S2({ th: -0.4, psi: 0.15, turn: 0.8, lean: 0.45, z: 8, lN: 0.9, lF: -0.3, sx: 1.05 }), "in"],
      [0.05, S2({ th: 1.25, psi: 0.3, turn: 0.65, lean: 0.66, crouch: 7, lN: 0.92, lF: -0.82, sx: 1.18, sy: 0.84, x: 4 }), "lin"],
      [0.26, S2({ th: 1.35, psi: 0.35, turn: 0.65, lean: 0.56, crouch: 6, lN: 0.92, lF: -0.82, sy: 0.88, x: 4 }), "out"],
      [r(1), S2({ th: 0.5, psi: 0.2 }), "io"],
    ];
    // ---- the reaper
    case "reap2": return [ // a sickle hooked across the front, then ripped straight back the other way
      [w(1), S2({ th: 0.4, psi: 0.3 })],
      [w(0.5), S2({ th: -0.6, psi: -2.4, turn: 1, lean: -0.18, x: -2, crouch: 2, lN: 0.3, lF: -0.5, sy: 0.96, head: -0.1 }), "out"],
      [0, S2({ th: 0.2, psi: -0.3, turn: 0.8, lean: 0.3, x: 3, lN: 0.62, lF: -0.48, sx: 1.06 }), "in"],
      [0.05, S2({ th: 0.35, psi: 1.4, turn: 0.5, lean: 0.36, x: 5, crouch: 2, lN: 0.66, lF: -0.5, sx: 1.08 }), "lin"],
      [0.1, S2({ th: 0.1, psi: 2.1, turn: 0.45, lean: 0.2, x: 6, crouch: 2.5 }), "out"],
      [0.15, S2({ th: 0.15, psi: 0.4, turn: 0.85, lean: 0.4, x: 8, crouch: 2, lN: 0.7, lF: -0.55, sx: 1.08 }), "in"],
      [0.2, S2({ th: 0.3, psi: -1.7, turn: 1, lean: 0.3, x: 9, crouch: 3 }), "lin"],
      [r(1), S2({ th: 0.4, psi: 0.3 }), "io"],
    ];
    case "reapspin": return [ // the great scythe reaps across the front and the body follows it all the way round
      [w(1), S2({ th: 0.5, psi: 0.3 })],
      [w(0.4), S2({ th: 0.25, psi: -2.8, turn: 1, lean: -0.12, x: -2, crouch: 3, lN: 0.3, lF: -0.55, sy: 0.94 }), "out"],
      [0, S2({ th: 0.35, psi: -0.6, turn: 0.75, lean: 0.3, x: 3, crouch: 4, lN: 0.65, lF: -0.5, sx: 1.08 }), "in"],
      [0.08, S2({ th: 0.4, psi: 1.6, turn: 0.4, lean: 0.36, x: 6, crouch: 5, lN: 0.7, lF: -0.55, sx: 1.08 }), "lin"],
      [0.24, S2({ th: 0.3, psi: Math.PI * 2 - 0.6, turn: 0.8, lean: 0.2, x: 7, crouch: 3, lN: 0.5, lF: -0.5, z: 3 }), "lin"],
      [0.32, S2({ th: 0.42, psi: Math.PI * 2 + 1.4, turn: 0.45, lean: 0.36, x: 8, crouch: 5, lN: 0.7, lF: -0.55 }), "out"],
      [r(1), S2({ th: 0.5, psi: Math.PI * 2 + 0.3 }), "io"],
    ];
    case "reaper": return [ // leaping overhead reap that sends a crescent out, then a low reap back across
      [w(1), S2({ th: 0.5, psi: 0.3 })],
      [w(0.6), S2({ th: 0.6, psi: -2.6, turn: 1, lean: 0.2, crouch: 5, x: -2, lN: 0.5, lF: -0.6, sy: 0.88, sx: 1.06 }), "out"],
      [w(0.2), S2({ th: -2.3, psi: -0.4, turn: 0.95, lean: -0.36, z: 10, lN: 0.7, lF: 0.2, sy: 1.1, sx: 0.93, head: -0.3 }), "out"],
      [w(0.04), S2({ th: -2.5, psi: -0.4, turn: 0.95, lean: -0.42, z: 11, lN: 0.72, lF: 0.25, sy: 1.08, head: -0.32 }), "io"],
      [0, S2({ th: -0.3, psi: 0.1, turn: 0.8, lean: 0.4, z: 6, lN: 0.7, lF: -0.4, sx: 1.06 }), "in"],
      [0.07, S2({ th: 1.2, psi: 0.35, turn: 0.65, lean: 0.6, crouch: 6, lN: 0.85, lF: -0.7, sx: 1.14, sy: 0.86, x: 4 }), "lin"],
      [0.16, S2({ th: 0.3, psi: -2.5, turn: 1, lean: 0.1, crouch: 4, x: 4, lN: 0.6, lF: -0.6 }), "out"],
      [0.22, S2({ th: 0.35, psi: 0, turn: 0.7, lean: 0.42, crouch: 4, x: 7, lN: 0.75, lF: -0.6, sx: 1.1 }), "in"],
      [0.3, S2({ th: 0.4, psi: 1.8, turn: 0.4, lean: 0.38, crouch: 5, x: 8 }), "lin"],
      [r(1), S2({ th: 0.5, psi: 0.4 }), "io"],
    ];
    case "xcross": { // two blades crossing back and forth, a step forward with each cut
      const k = [[w(1), S2({ th: 0.3, psi: 0.3, th2: 0.3, psi2: -0.3 })], [w(0.3), S2({ th: 0.1, psi: -2.2, th2: 0.1, psi2: 2.0, crouch: 3, lN: 0.4, lF: -0.45, sy: 0.93 }), "out"]];
      [0, 0.055, 0.11, 0.165, 0.22, 0.275].forEach((t0, i) => {
        const odd = i % 2;
        k.push([t0 + 0.045, S2({ th: 0.15 + 0.1 * odd, psi: odd ? -1.8 : 1.6, th2: 0.2, psi2: odd ? 1.7 : -1.9, x: 2 + i, lean: 0.3, turn: odd ? 0.9 : 0.55, lN: 0.55, lF: -0.45, sx: 1.04 }), "out"]);
      });
      k.push([0.42, S2({ th: 0.4, psi: 1.9, th2: 0.4, psi2: 1.7, x: 9, lean: 0.42, turn: 0.4, crouch: 3, lN: 0.7, lF: -0.55, sx: 1.08 }), "out"]);
      k.push([r(1), S2({ th: 0.5, psi: 0.5, th2: 0.5, psi2: -0.3 }), "io"]);
      return k;
    }
  }
  return [[w(1), S2({ th: 0.4, psi: 0 })], [r(1), S2({ th: 0.4, psi: 0 })]];
}

/**
 * For a swung weapon: the body pose and the blades (screen direction + depth) at time t of the move.
 * Arms are aimed along the blades so the grip stays in the hand.
 */
const KCACHE = new Map();
function fitKeys(kind, W, R) {
  const id = kind + W + "/" + R;
  if (KCACHE.has(id)) return KCACHE.get(id);
  const K = swingKeys(kind, W, R), inner = K.slice(0, -1).filter((k) => k[0] > 0), m = Math.max(0, ...inner.map((k) => k[0]));
  if (m > R * 0.85) for (const k of inner) k[0] *= (R * 0.85) / m;
  KCACHE.set(id, K); return K;
}
export function swingPose(W, def, t) {
  const K = fitKeys(W.swing, def.windup ?? 0.15, def.recover ?? 0.3), q = keys(K, t);
  const b1 = bladeDir(q.th, q.psi), blades = [{ d: b1, arm: "armN" }];
  const aim = (d) => Math.atan2(d.x, d.y);   // rig arm angle: 0 down, +π/2 forward
  const pose = { lN: q.lN, lF: q.lF, lean: q.lean, crouch: q.crouch, x: q.x, sx: q.sx, sy: q.sy, head: q.head, turn: q.turn, z: q.z ?? 0 };
  if (pose.z > 1) pose.plant = false;
  if (W.swing === "spin" || (W.swing === "reapspin" && t > 0.02)) pose.turn = 0.55 + 0.4 * Math.cos(q.psi); // the torso turns with the blade
  pose.aN = aim(b1);
  // a lance is held along the forearm for sweeps but levelled from the hip for thrusts
  if (q.arm !== undefined) pose.aN = q.arm + (pose.aN - q.arm) * (q.fa ?? 0);
  if (W.both) { const b2 = bladeDir(q.th2 ?? q.th, q.psi2 ?? -q.psi); blades.push({ d: b2, arm: "armF" }); pose.aF = aim(b2); }
  else if (W.two) pose.aF = pose.aN - 0.18;                                 // two-handed: the other hand on the grip
  else pose.aF = 0.4 - 0.3 * Math.sin(q.psi);                                // free hand balances
  return { pose, blades };
}

/** A lance of light: a long shaft through the hand, a leaf-shaped head, wings and a halo as it grows. */
function drawLance(p, h, dx, dy, px, py, len, proj, tier, R, glow, a, t, hero) {
  const n = R.length, bright = R.slice(Math.floor(n / 3)), back = len * 0.42, L = len * (0.55 + 0.45 * proj);
  const tip = [h.x + dx * L, h.y + dy * L];
  stroke(p, h.x - dx * back, h.y - dy * back, tip[0], tip[1], 0.7 + tier * 0.12, bright.slice(0, 4), a, glow, 0.12);
  // pommel and the bands of light around the grip
  stroke(p, h.x - dx * back, h.y - dy * back, h.x - dx * (back - 2), h.y - dy * (back - 2), 1.2, [R[n - 1]], a);
  const hl = 5 + tier * 1.6, hw = 1.8 + tier * 0.45;
  for (let s = 0; s <= hl * 2; s++) {
    // leaf head: widest a third of the way up, sharp at the point
    const u = s / (hl * 2), wdt = hw * Math.sin(Math.min(1, u * 1.6) * Math.PI) * (1 - u * 0.35), cx = tip[0] + dx * u * hl, cy = tip[1] + dy * u * hl;
    for (let q = -Math.ceil(wdt); q <= Math.ceil(wdt); q++) if (Math.abs(q) <= wdt + 0.2) p.put(Math.round(cx + px * q), Math.round(cy + py * q), Math.abs(q) < wdt * 0.4 ? R[n - 1] : R[n - 2], a);
  }
  const head = [tip[0] + dx * hl * 0.3, tip[1] + dy * hl * 0.3];
  if (tier >= 2) for (const sg of [-1, 1]) {
    // little wings of light swept back from the base of the head
    for (let f2 = 0; f2 < tier; f2++) { const L2 = 5 + f2 * 1.5; stroke(p, tip[0] + px * sg * 1.5, tip[1] + py * sg * 1.5, tip[0] + px * sg * (3 + f2 * 1.2) - dx * L2, tip[1] + py * sg * (3 + f2 * 1.2) - dy * L2, (u) => 0.9 * (1 - u), [R[n - 2], R[n - 1]], a, glow, 0.2); }
  }
  if (tier === 3) {
    // a halo ring around the head and sparks streaming off the point
    for (let m = 0; m < 16; m++) { const an = m / 16 * Math.PI * 2 + t * 2; p.put(Math.round(head[0] + Math.cos(an) * 2.2 * (dx * dx + 0.4) + px * Math.sin(an) * 5), Math.round(head[1] + Math.cos(an) * 2.2 * dy + py * Math.sin(an) * 5), R[n - 1], a * 0.8); }
    for (let i = 0; i < 3; i++) { const ph = (t * 3 + i / 3) % 1; p.put(Math.round(head[0] + dx * (hl + ph * 10)), Math.round(head[1] + dy * (hl + ph * 10) + Math.sin(i * 3 + t * 9) * 1.5), hex("#ffffff"), a * (1 - ph)); }
  }
  const G = 5 + tier * 2;
  for (let j = -G; j <= G; j++) for (let i = -G; i <= G; i++) { const d = (i * i + j * j) / (G * G); if (d < 1) p.add(Math.round(head[0] + i), Math.round(head[1] + j), glow, (0.12 + tier * 0.05) * a * (1 - d)); }
  // charging (the wind-up of the great charge): light gathering into the point
  const act = hero.act;
  if (tier === 3 && act && act.t < 0) for (let i = 0; i < 8; i++) {
    const ph = (t * 3 + i / 8) % 1, an = i * 2.4 + t * 6, rr = (1 - ph) * 14;
    p.put(Math.round(head[0] + Math.cos(an) * rr), Math.round(head[1] + Math.sin(an) * rr * 0.7), R[n - 1], a * ph); p.add(Math.round(head[0] + Math.cos(an) * rr), Math.round(head[1] + Math.sin(an) * rr * 0.7), glow, 0.3 * a * ph);
  }
}

/** Draw swung blades for the given layer ("back": blades behind the body, "front": the rest). */
export function drawSwung(p, hero, pose, W, k, t, layer) {
  if (!hero.blades || k <= 0.02) return;
  const flip = hero.spinFlip ? !hero.flip : hero.flip, f = flip ? -1 : 1, H = hands(pose, hero.x, hero.y - hero.z, flip);
  const R = (W.ramp === "ice" ? hero.ramps.ice : hero.ramps.main).map((c) => (typeof c === "number" ? c : hex(c)));
  const n = R.length, bright = R.slice(Math.floor(n / 3)), glow = hero.glowC, grow = 1 + (hero.stage - 1) * 0.18, a = Math.min(1, k * 1.4);
  for (const B of hero.blades) {
    const behind = B.d.z < -0.25;
    if ((layer === "back") !== behind) continue;
    const h = H[B.arm], len = (W.len ?? 14) * grow * (B.arm === "armF" ? 0.9 : 1);
    const dx = f * B.d.x, dy = B.d.y, tip = [h.x + dx * len, h.y + dy * len];
    const aa = (behind ? 0.75 : 1) * a;
    const wide = (W.kind === "greatsword" ? 2.4 : W.kind === "dagger" ? 1.1 : W.kind === "scythe" ? 0.9 : 1.6) * grow;
    const proj = Math.hypot(B.d.x, B.d.y); // shorter when pointing at the viewer
    if (W.kind === "hammer") { drawWeapon(p, hero, pose, { ...W, swing: null }, k, t); continue; }
    const px = -dy, py = dx;
    if (W.kind === "lance") { drawLance(p, h, dx, dy, px, py, len, proj, W.tier ?? 1, R, glow, aa, t, hero); continue; }
    // guard, then blade
    stroke(p, h.x - px * 3, h.y - py * 3, h.x + px * 3, h.y + py * 3, 0.8, bright, aa);
    stroke(p, h.x + dx * 1.5, h.y + dy * 1.5, tip[0], tip[1], (u) => wide * (0.6 + 0.4 * proj) * (1 - u * 0.75) + (W.flame ? Math.abs(Math.sin(u * 9 + t * 20)) * 0.8 : 0), bright, aa, glow, hero.stage >= 3 ? 0.3 : 0.18);
    if (W.kind === "scythe") {
      // the curved head, hooking back toward the viewer side
      let prev = tip;
      const hk = (W.hook ?? 13) * grow;
      const curve = (u, sc) => { const ang = u * 1.7; return [tip[0] + (px * Math.sin(ang) - dx * (1 - Math.cos(ang))) * hk * sc, tip[1] + (py * Math.sin(ang) - dy * (1 - Math.cos(ang))) * hk * sc]; };
      for (let s = 1; s <= 10; s++) { const u = s / 10, q = curve(u, 1); stroke(p, prev[0], prev[1], q[0], q[1], (hk / 6) * (1 - u * 0.75), bright, aa, glow, 0.3); prev = q; }
      // a bright cutting edge along the inside of the curve
      let pe = tip; for (let s = 1; s <= 10; s++) { const q = curve(s / 10, 0.86); stroke(p, pe[0], pe[1], q[0], q[1], 0.35, [R[n - 1]], aa); pe = q; }
      if (W.ghost) {
        // the reaper's blade trails a second, ghostly blade and wisps of shadow
        let pg = tip; for (let s = 1; s <= 10; s++) { const q = curve(s / 10, 1.25); p.blendPx(Math.round(q[0]), Math.round(q[1] + Math.sin(t * 12 + s) * 0.8), R[n - 2], aa * 0.5 * (1 - s / 12)); pg = q; }
        for (let i = 0; i < 3; i++) { const ph = (t * 1.8 + i / 3) % 1, q = curve(0.3 + i * 0.25, 1); p.blendPx(Math.round(q[0]), Math.round(q[1] - ph * 8), R[2], aa * 0.7 * (1 - ph)); }
      }
    }
    if (W.arcs || hero.stage >= 3) for (let i = 0; i < 2; i++) { const u0 = Math.random(), u1 = Math.min(1, u0 + 0.25), j = () => (Math.random() - 0.5) * 6; stroke(p, h.x + dx * len * u0 + j(), h.y + dy * len * u0 + j(), h.x + dx * len * u1 + j(), h.y + dy * len * u1 + j(), 0.4, [R[n - 1]], aa * 0.8); }
    if (W.glitch && Math.random() < 0.5) { const u = Math.random(), gx = h.x + dx * len * u, gy = h.y + dy * len * u; for (let i = 0; i < 4; i++) p.put(Math.round(gx + px * (3 + i)), Math.round(gy + py * (3 + i)), R[n - 2], aa); }
  }
}

/** Record grip/tip each frame so the swept arc can be filled in behind the blade. */
export function trackSwing(hero, pose, W, dt) {
  const flip = hero.spinFlip ? !hero.flip : hero.flip, f = flip ? -1 : 1, H = hands(pose, hero.x, hero.y - hero.z, flip), grow = 1 + (hero.stage - 1) * 0.18;
  hero.swept = hero.swept ?? [];
  for (const q of hero.swept) q.t -= dt;
  hero.swept = hero.swept.filter((q) => q.t > 0);
  if (!hero.blades) return;
  hero.blades.forEach((B, i) => {
    const h = H[B.arm], len = (W.len ?? 14) * grow * (B.arm === "armF" ? 0.9 : 1);
    const g0 = W.kind === "lance" ? 0.7 : W.kind === "hammer" ? 0.75 : 0.3, t1 = W.kind === "lance" ? 1.35 : W.kind === "scythe" ? 1.4 : 1.15;
    hero.swept.push({ i, g: [h.x + f * B.d.x * len * g0, h.y + B.d.y * len * g0], tp: [h.x + f * B.d.x * len * t1, h.y + B.d.y * len * t1], z: B.d.z, t: 0.11, life: 0.11 });
  });
}

/** Fill the swept arcs: a ribbon from grip to tip between consecutive samples, brightest at the edge. */
export function drawSwept(p, hero, layer) {
  const S = hero.swept; if (!S || S.length < 2) return;
  const R = hero.ramps.main.map((c) => (typeof c === "number" ? c : hex(c))), n = R.length, glow = hero.glowC;
  for (const id of [0, 1]) {
    const pts = S.filter((q) => q.i === id);
    for (let k = 1; k < pts.length; k++) {
      const A = pts[k - 1], B = pts[k];
      if ((layer === "back") !== (B.z < -0.25)) continue;
      const fade = B.t / B.life;
      // jumps between frames are large in a fast swing: subdivide so the arc is filled
      const steps = Math.max(2, Math.ceil(Math.hypot(B.tp[0] - A.tp[0], B.tp[1] - A.tp[1]) / 1.5));
      for (let s = 0; s <= steps; s++) {
        const u = s / steps, gx = A.g[0] + (B.g[0] - A.g[0]) * u, gy = A.g[1] + (B.g[1] - A.g[1]) * u, tx = A.tp[0] + (B.tp[0] - A.tp[0]) * u, ty = A.tp[1] + (B.tp[1] - A.tp[1]) * u;
        const L = Math.max(1, Math.ceil(Math.hypot(tx - gx, ty - gy)));
        for (let m = 0; m <= L; m++) {
          const v = m / L, x = Math.round(gx + (tx - gx) * v), y = Math.round(gy + (ty - gy) * v);
          const ci = Math.max(1, Math.min(n - 1, Math.round(v * v * (n - 1))));
          p.put(x, y, R[ci], fade * (0.25 + 0.6 * v));
          if (v > 0.8) p.add(x, y, glow, 0.12 * fade);
        }
      }
    }
  }
}
