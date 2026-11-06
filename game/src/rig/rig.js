// A six-part blocky puppet: head, torso, two arms, two legs, each a separate rounded block on a joint.
// Every part is rasterized pixel by pixel at its angle (nearest sampling, 1 px outline), so the figure
// can take any pose and still reads as pixel art. Origin = between the feet on the ground; y goes down.
//
// The body can turn from front-on (turn 0, like a toy standing to attention) to a three-quarter profile
// (turn 1): shoulders and hips slide toward the middle so arms and legs swing forward and back in the
// picture plane, the way they do in a side-on brawler. Feet stay planted: the hips drop by however much
// the more upright leg is angled, so a wide stride sits low and a passing step rises.
//
// Pose channels (radians / px):
//   aN aF   near / far arm, in world terms (0 hangs down, +π/2 points forward, +π straight up, − back)
//   lN lF   near / far leg (+ forward)
//   lean    torso tilt (+ forward)        head   head tilt on top of the torso (+ nods forward)
//   x y z   body offset and float height  crouch hips sink and legs squash (px)
//   sx sy   squash and stretch around the feet      turn   0 front-on … 1 profile
//   plant   false lets the feet leave the floor (jumps, run flight)

import { hex, mix, scale as scaleC } from "../px.js";

/** Default proportions (px) for the hero; bosses pass a size factor. */
export const BODY = {
  head: { w: 10, h: 9, r: 3, ax: 0, ay: 9 },     // anchor at bottom center (neck)
  torso: { w: 12, h: 12, r: 1, ax: 0, ay: 12 },  // anchor at bottom center (waist)
  arm: { w: 5, h: 12, r: 1.5, ax: 0, ay: 1.5 },  // anchor near top center (shoulder)
  leg: { w: 6, h: 12, r: 1, ax: 0, ay: 0 },      // anchor at top center (hip)
};
export const LEG = 12;

export const NEUTRAL = { x: 0, y: 0, z: 0, lean: 0, head: 0, aN: 0, aF: 0, lN: 0, lF: 0, crouch: 0, sx: 1, sy: 1, turn: 0.8 };
const CHANNELS = Object.keys(NEUTRAL);

/** Skin: a body ramp and outline. far parts use one step darker. */
export function makeSkin(base = ["#3a3848", "#6d6a80", "#a9a6b8", "#d3d1dc", "#f2f1f7"], outline = "#16141f") {
  return { ramp: base.map(hex), outline: hex(outline), eye: hex("#16141f") };
}
export const SKIN = makeSkin();

const rot = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };
const L = (a, b, t) => a + (b - a) * t;

/** How far the hips must drop so the more upright foot touches the floor. */
export function plantDrop(P) {
  if (P.plant === false) return 0;
  const th = Math.min(Math.abs(P.lN ?? 0), Math.abs(P.lF ?? 0));
  return (LEG - (P.crouch ?? 0)) * (1 - Math.cos(th));
}

/**
 * Lay the parts out for a pose: returns a draw list of parts in body space with pivot and angle.
 * k scales the whole body (bosses).
 */
export function layout(pose, k = 1) {
  const B = BODY, P = { ...NEUTRAL, ...pose };
  const tr = Math.max(0, Math.min(1, P.turn));
  const c = P.crouch + plantDrop(P);
  const torsoW = L(12, 9, tr), headW = L(10, 9, tr);
  const shN = [L(8.6, 1.6, tr), -22.5], shF = [L(-8.6, -1.2, tr), -22.5 - 0.6 * tr];
  const hipN = [L(3, 1.7, tr), -12], hipF = [L(-3, -1.5, tr), -12];
  const neck = [L(0, 0.6, tr), -24.5];
  const waist = [0, (-12 + c) * k];
  const tilt = (pt) => {
    const [dx, dy] = rot(pt[0] * k - waist[0], (pt[1] + c) * k - waist[1], P.lean);
    return [waist[0] + dx, waist[1] + dy];
  };
  const legH = Math.max(4, B.leg.h - P.crouch);
  const parts = [
    { name: "armF", spec: B.arm, at: tilt(shF), a: P.lean * 0.25 - P.aF, far: true },
    { name: "legF", spec: { ...B.leg, h: legH }, at: [hipF[0] * k, (hipF[1] + c) * k], a: -P.lF, far: true },
    { name: "torso", spec: { ...B.torso, w: torsoW }, at: waist, a: P.lean },
    { name: "legN", spec: { ...B.leg, h: legH }, at: [hipN[0] * k, (hipN[1] + c) * k], a: -P.lN },
    { name: "head", spec: { ...B.head, w: headW }, at: tilt(neck), a: P.lean + P.head },
    { name: "armN", spec: B.arm, at: tilt(shN), a: P.lean * 0.25 - P.aN },
  ];
  // front-on, the far arm hangs beside the body; drawn after the torso it reads as the other side
  if (tr < 0.25) { const i = parts.findIndex((p) => p.name === "armF"); const [a] = parts.splice(i, 1); parts.splice(2, 0, a); }
  parts.turn = tr;
  return parts;
}

/** Where a named point ends up (body space, before squash): hand tips, head top, chest, neck. */
export function anchor(pose, name, k = 1) {
  const parts = layout(pose, k);
  const find = (n) => parts.find((p) => p.name === n);
  const tip = (p, v) => { const [dx, dy] = rot(0, (v - p.spec.ay) * k, p.a); return [p.at[0] + dx, p.at[1] + dy]; };
  const P = { ...NEUTRAL, ...pose };
  const sq = ([x, y]) => [x * P.sx, y * P.sy];
  switch (name) {
    case "handN": return sq(tip(find("armN"), BODY.arm.h));
    case "handF": return sq(tip(find("armF"), BODY.arm.h));
    case "chest": return sq(tip(find("torso"), 6));
    case "neck": { const t = find("torso"); const [dx, dy] = rot(-2.5 * k, (0 - t.spec.ay) * k, t.a); return sq([t.at[0] + dx, t.at[1] + dy + 1]); }
    case "headTop": return sq(tip(find("head"), 0));
    default: return [0, -18 * k];
  }
}

/**
 * Draw the puppet. p: a pixelfx Painter (we use its raw put, so world pixel coords).
 * o: { x, y (feet, world), flip (face left), pose, skin, k, tint (color for hit flash), alpha,
 *      decor(name, u, v, spec) → color | 0 (paint on a part, in part space), eyes: bool }
 */
export function drawRig(p, o) {
  const k = o.k ?? 1, f = o.flip ? -1 : 1, pose = { ...NEUTRAL, ...o.pose };
  const sx = pose.sx || 1, sy = pose.sy || 1;
  const rx = Math.round(o.x + f * pose.x * k), ry = Math.round(o.y + (pose.y - pose.z) * k);
  const skin = o.skin ?? SKIN, R = skin.ramp, OL = skin.outline, a = o.alpha ?? 1;
  const parts = layout(pose, k), tr = parts.turn;
  for (const part of parts) {
    const s = part.spec, w = s.w * k, h = s.h * k, r = s.r * k, ax = s.ax * k, ay = s.ay * k;
    const [px, py] = part.at, A = part.a, ca = Math.cos(A), sa = Math.sin(A);
    // bounding box: rotate the four corners into body space, then squash
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [u, v] of [[-w / 2, 0], [w / 2, 0], [-w / 2, h], [w / 2, h]]) {
      const lx = u - ax, ly = v - ay, bx = (px + lx * ca - ly * sa) * sx, by = (py + lx * sa + ly * ca) * sy;
      x0 = Math.min(x0, bx); x1 = Math.max(x1, bx); y0 = Math.min(y0, by); y1 = Math.max(y1, by);
    }
    const wx0 = Math.floor(rx + Math.min(f * x0, f * x1)) - 1, wx1 = Math.ceil(rx + Math.max(f * x0, f * x1)) + 1;
    const wy0 = Math.floor(ry + y0) - 1, wy1 = Math.ceil(ry + y1) + 1;
    const MW = wx1 - wx0 + 1, MH = wy1 - wy0 + 1;
    const mask = new Uint8Array(MW * MH), U = new Float32Array(MW * MH), V = new Float32Array(MW * MH);
    const hw = w / 2 - r, hh = h / 2 - r;
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++) {
        const bx = ((wx0 + i + 0.5 - rx) * f) / sx, by = (wy0 + j + 0.5 - ry) / sy;
        const dx = bx - px, dy = by - py;
        const u = dx * ca + dy * sa + ax, v = -dx * sa + dy * ca + ay;
        const qx = Math.max(Math.abs(u) - hw, 0), qy = Math.max(Math.abs(v - h / 2) - hh, 0);
        if (qx * qx + qy * qy <= r * r + 0.15) { const m = j * MW + i; mask[m] = 1; U[m] = u; V[m] = v; }
      }
    const inside = (i, j) => i >= 0 && j >= 0 && i < MW && j < MH && mask[j * MW + i];
    const step = part.far ? 1 : 0;
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++) {
        const m = j * MW + i, X = wx0 + i, Y = wy0 + j;
        if (!mask[m]) {
          if (inside(i - 1, j) || inside(i + 1, j) || inside(i, j - 1) || inside(i, j + 1)) p.put(X, Y, o.tint ? mix(o.tint, OL, 0.5) : OL, a);
          continue;
        }
        const u = U[m], v = V[m];
        // one light from the upper left in screen space: lit rim on the left/top, shade on the right/bottom
        const lit = !inside(i - 1, j) || !inside(i, j - 1), shade = !inside(i + 1, j) || !inside(i, j + 1);
        let ci = 2;
        if (lit && !shade) ci = 3;
        if (shade) ci = 1;
        if (!inside(i - 1, j) && !inside(i, j - 1)) ci = 4;
        let c = R[Math.max(0, Math.min(R.length - 1, ci - step))];
        if (part.name === "head" && o.eyes !== false) {
          // two eyes looking the way we face; they slide toward the front as the body turns
          const ey = h * 0.52, ew = 1.3 * k;
          const c1 = L(-1.9, 1.0, tr) * k, c2 = L(1.9, 3.3, tr) * k;
          if (v >= ey - 0.5 * k && v < ey + 1.6 * k && (Math.abs(u - c1) < ew / 2 + 0.05 || Math.abs(u - c2) < ew / 2 + 0.05)) c = skin.eye;
        }
        if (o.decor) { const d = o.decor(part.name, u / k, v / k, s, part.far); if (d) c = d; }
        if (o.tint) c = mix(c, o.tint, o.tintK ?? 0.85);
        p.put(X, Y, c, a);
      }
  }
}

/** Soft ground shadow under a body. */
export function drawShadow(p, x, y, w = 16, z = 0) {
  const k = Math.max(0.45, 1 - z / 60);
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -Math.ceil(w * k / 2); dx <= Math.ceil(w * k / 2); dx++) {
      const e = (dx / (w * k / 2)) ** 2 + (dy / 2.6) ** 2;
      if (e <= 1) p.blendPx(Math.round(x + dx), Math.round(y + dy), 0xff000000, 0.42 * (1 - e * 0.5));
    }
}

/** Lerp two poses channel by channel (missing channels take the neutral value). */
export function lerpPose(a, b, t) {
  const o = {};
  for (const key of CHANNELS) o[key] = (a[key] ?? NEUTRAL[key]) + ((b[key] ?? NEUTRAL[key]) - (a[key] ?? NEUTRAL[key])) * t;
  o.plant = t < 0.5 ? a.plant : b.plant;
  return o;
}

export { scaleC as scaleColor, CHANNELS };
