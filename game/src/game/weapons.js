// Conjured weapons: while a move plays, the absorbed spirit shapes its element into something in the hero's
// hands — a wind blade, flame claws, a water whip, stone gauntlets, a shadow scythe… It flickers into being
// at the start of the move and comes apart into motes at the end.
import { hex, mix } from "../px.js";
import { layout, NEUTRAL } from "../rig/rig.js";
import { keys } from "./boss_rig.js";

// which move conjures what. len: blade length (px), both: one in each hand
export const WEAPON_BY_MOVE = {
  // wind
  "바람 칼날": { kind: "blade", len: 16, swing: "sweep" }, "질풍 돌진": { kind: "blade", len: 18, swing: "thrust" }, "난도질": { kind: "dagger", len: 10, both: true, swing: "xcross" }, "폭풍 회전": { kind: "blade", len: 22, arcs: true, swing: "spin" },
  // fire
  "불꽃 할퀴기": { kind: "claws", len: 6, both: true }, "불씨탄": { kind: "orb", r: 3 }, "화염 회전베기": { kind: "blade", len: 19, flame: true, swing: "spin" }, "업화 강타": { kind: "greatsword", len: 27, flame: true, swing: "overhead", two: true },
  // water
  "물의 활": { kind: "bow", len: 15, tier: 1 }, "쌍류 화살": { kind: "bow", len: 18, tier: 2 }, "격류의 화살": { kind: "bow", len: 23, tier: 3, big: true }, "얼음창": { kind: "spear", len: 24, ramp: "ice" },
  // earth
  "바위 주먹": { kind: "gauntlet" }, "돌 던지기": { kind: "rock" }, "대지 망치": { kind: "hammer", len: 20, swing: "overhead", two: true }, "지진 내려찍기": { kind: "gauntlet", both: true },
  // light
  "빛의 일섬": { kind: "blade", len: 17, swing: "sweep" }, "성광 회전": { kind: "blade", len: 20, swing: "spin" }, "천상의 검": { kind: "greatsword", len: 29, swing: "overhead", two: true },
  // dark
  "그림자 할퀴기": { kind: "claws", len: 7, both: true }, "망령의 낫": { kind: "scythe", len: 24, swing: "reap", two: true }, "그림자 난무": { kind: "dagger", len: 11, both: true, swing: "xcross" },
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
        const hw = 8 * grow, hl = 5 * grow;
        for (let j = -hl; j <= hl; j++) for (let i = -hw; i <= hw; i++) {
          const x = tip[0] + perp[0] * i + dir[0] * j, y = tip[1] + perp[1] * i + dir[1] * j;
          const edge = Math.abs(i) > hw - 1 || Math.abs(j) > hl - 1;
          p.put(Math.round(x), Math.round(y), edge ? stone[1] : (i + j < 0 ? stone[5] : stone[3]), aa);
        }
        stroke(p, tip[0] - perp[0] * hw, tip[1] - perp[1] * hw, tip[0] + perp[0] * hw, tip[1] + perp[1] * hw, 0.4, [hero.accent[4]], aa, glow, 0.25);
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
  const pose = { lN: q.lN, lF: q.lF, lean: q.lean, crouch: q.crouch, x: q.x, sx: q.sx, sy: q.sy, head: q.head, turn: q.turn, z: 0 };
  if (W.swing === "spin") pose.turn = 0.55 + 0.4 * Math.cos(q.psi);        // the torso turns with the blade
  pose.aN = aim(b1);
  if (W.both) { const b2 = bladeDir(q.th2 ?? q.th, q.psi2 ?? -q.psi); blades.push({ d: b2, arm: "armF" }); pose.aF = aim(b2); }
  else if (W.two) pose.aF = pose.aN - 0.18;                                 // two-handed: the other hand on the grip
  else pose.aF = 0.4 - 0.3 * Math.sin(q.psi);                                // free hand balances
  return { pose, blades };
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
    // guard, then blade
    const px = -dy, py = dx;
    stroke(p, h.x - px * 3, h.y - py * 3, h.x + px * 3, h.y + py * 3, 0.8, bright, aa);
    stroke(p, h.x + dx * 1.5, h.y + dy * 1.5, tip[0], tip[1], (u) => wide * (0.6 + 0.4 * proj) * (1 - u * 0.75) + (W.flame ? Math.abs(Math.sin(u * 9 + t * 20)) * 0.8 : 0), bright, aa, glow, hero.stage >= 3 ? 0.3 : 0.18);
    if (W.kind === "scythe") {
      // the curved head, hooking back toward the viewer side
      let prev = tip;
      for (let s = 1; s <= 10; s++) { const u = s / 10, ang = u * 1.7; const cx2 = tip[0] + (px * Math.sin(ang) - dx * (1 - Math.cos(ang))) * 13 * grow, cy2 = tip[1] + (py * Math.sin(ang) - dy * (1 - Math.cos(ang))) * 13 * grow; stroke(p, prev[0], prev[1], cx2, cy2, 2.2 * (1 - u * 0.75), bright, aa, glow, 0.3); prev = [cx2, cy2]; }
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
    hero.swept.push({ i, g: [h.x + f * B.d.x * len * 0.3, h.y + B.d.y * len * 0.3], tp: [h.x + f * B.d.x * len * 1.15, h.y + B.d.y * len * 1.15], z: B.d.z, t: 0.11, life: 0.11 });
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
