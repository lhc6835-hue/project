// Conjured weapons: while a move plays, the absorbed spirit shapes its element into something in the hero's
// hands — a wind blade, flame claws, a water whip, stone gauntlets, a shadow scythe… It flickers into being
// at the start of the move and comes apart into motes at the end.
import { hex, mix } from "../px.js";
import { layout, NEUTRAL } from "../rig/rig.js";

// which move conjures what. len: blade length (px), both: one in each hand
export const WEAPON_BY_MOVE = {
  // wind
  "바람 칼날": { kind: "blade", len: 15 }, "질풍 돌진": { kind: "blade", len: 17 }, "난도질": { kind: "dagger", len: 9, both: true }, "폭풍 회전": { kind: "blade", len: 21, arcs: true },
  // fire
  "불꽃 할퀴기": { kind: "claws", len: 6, both: true }, "불씨탄": { kind: "orb", r: 3 }, "화염 회전베기": { kind: "blade", len: 18, flame: true }, "업화 강타": { kind: "greatsword", len: 26, flame: true },
  // water
  "물방울탄": { kind: "orb", r: 3.5, both: true }, "물채찍": { kind: "whip", len: 30 }, "격류 베기": { kind: "greatsword", len: 25 }, "얼음창": { kind: "spear", len: 24, ramp: "ice" },
  // earth
  "바위 주먹": { kind: "gauntlet" }, "돌 던지기": { kind: "rock" }, "대지 망치": { kind: "hammer", len: 20 }, "지진 내려찍기": { kind: "gauntlet", both: true },
  // light
  "빛의 일섬": { kind: "blade", len: 16 }, "성광 회전": { kind: "blade", len: 19 }, "천상의 검": { kind: "greatsword", len: 28 },
  // dark
  "그림자 할퀴기": { kind: "claws", len: 7, both: true }, "망령의 낫": { kind: "scythe", len: 24 }, "그림자 난무": { kind: "dagger", len: 10, both: true },
  // code
  "Ctrl+X 잘라내기": { kind: "blade", len: 20, glitch: true },
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
