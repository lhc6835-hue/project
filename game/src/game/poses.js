// Motion for the puppet, built on the classic principles:
//   cycles from key poses (walk: contact, down, passing, up; run adds a flight phase), arms opposite the
//   legs and a beat late (overlap), the body bobbing low on contact and high on passing, squash on the
//   down and stretch on the push-off; attacks as anticipation → strike → follow-through → recovery with
//   root motion (a lunge), squash in the wind-up and stretch on the hit.
// Angles: radians. aN/aF near/far arm (+ forward, π up), lN/lF near/far leg (+ forward), lean (+ forward).
import { NEUTRAL, CHANNELS } from "../rig/rig.js";

const S = Math.sin, C = Math.cos, TAU = Math.PI * 2;

/** Element tempo/weight: fire bouncy, water smooth, wind quick, earth heavy. */
export const FLAVOR = {
  fire: { tempo: 1.05, bounce: 1.25, swing: 1.05 },
  water: { tempo: 0.9, bounce: 0.85, swing: 0.95 },
  wind: { tempo: 1.18, bounce: 0.9, swing: 1.1 },
  earth: { tempo: 0.86, bounce: 1.4, swing: 0.9 },
  light: { tempo: 1, bounce: 1, swing: 1 },
  dark: { tempo: 0.9, bounce: 0.8, swing: 1 },
  none: { tempo: 1, bounce: 1, swing: 1 },
};
const flavor = (el) => FLAVOR[el] ?? FLAVOR.none;

// ------------------------------------------------------------------ interpolation
const ease = {
  lin: (u) => u,
  io: (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2),
  out: (u) => 1 - (1 - u) ** 3,
  in: (u) => u * u * u,
  back: (u) => { const c = 1.9; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2; }, // overshoots then settles
};
const val = (p, k) => (p[k] ?? NEUTRAL[k]);

/** A looping cycle through key poses [phase 0..1, pose], smooth (Catmull-Rom) through every key. */
function cycle(keys, u) {
  u = ((u % 1) + 1) % 1;
  const n = keys.length;
  let i = n - 1;
  for (let j = 0; j < n; j++) if (keys[j][0] <= u) i = j;
  const k0 = keys[(i - 1 + n) % n], k1 = keys[i], k2 = keys[(i + 1) % n], k3 = keys[(i + 2) % n];
  const t1 = k1[0], t2 = k2[0] <= t1 ? k2[0] + 1 : k2[0];
  const s = (u < t1 ? u + 1 : u) - t1, f = Math.min(1, s / (t2 - t1 || 1));
  const o = {};
  for (const ch of CHANNELS) {
    const p0 = val(k0[1], ch), p1 = val(k1[1], ch), p2 = val(k2[1], ch), p3 = val(k3[1], ch);
    const f2 = f * f, f3 = f2 * f;
    o[ch] = 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f2 + (-p0 + 3 * p1 - 3 * p2 + p3) * f3);
  }
  o.plant = (f < 0.5 ? k1[1] : k2[1]).plant;
  return o;
}

/** Mirror a pose to the other leg/arm (for the second half of a cycle). */
const mirror = (p) => ({ ...p, aN: p.aF, aF: p.aN, lN: p.lF, lF: p.lN });
const halfAndMirror = (keys) => keys.concat(keys.map(([u, p]) => [u + 0.5, mirror(p)]));

/** Lay the arms over the legs with a little delay so they don't hit every pose in unison. */
function withArms(legsKeys, armsKeys, u, lag) {
  const a = cycle(armsKeys, u - lag), l = cycle(legsKeys, u);
  return { ...l, aN: a.aN, aF: a.aF };
}

// ------------------------------------------------------------------ cycles
// walk: one step per half cycle — contact, down (recoil), passing, up
const WALK = halfAndMirror([
  [0.0, { lN: 0.48, lF: -0.42, lean: 0.07, sy: 1.0, y: 0 }],
  [0.1, { lN: 0.36, lF: -0.3, lean: 0.09, sy: 0.965, y: 0.7 }],
  [0.25, { lN: -0.06, lF: 0.14, lean: 0.08, sy: 1.02, y: -0.5, head: -0.03 }],
  [0.37, { lN: -0.26, lF: 0.32, lean: 0.06, sy: 1.025, y: -0.9 }],
]);
const WALK_ARMS = halfAndMirror([
  [0.0, { aN: -0.48, aF: 0.52 }],
  [0.25, { aN: -0.16, aF: 0.26 }],
]);
// run: contact, down, push-off, flight — feet leave the floor between steps
const RUN = halfAndMirror([
  [0.0, { lN: 0.62, lF: -0.62, lean: 0.27, sy: 0.96, sx: 1.02, y: 0.4 }],
  [0.11, { lN: 0.16, lF: -0.8, lean: 0.31, sy: 0.92, sx: 1.04, y: 1.1 }],
  [0.23, { lN: -0.5, lF: 0.28, lean: 0.29, sy: 1.06, sx: 0.97, y: -2.2, plant: false }],
  [0.37, { lN: -0.66, lF: 0.56, lean: 0.26, sy: 1.03, y: -3.2, plant: false }],
]);
const RUN_ARMS = halfAndMirror([
  [0.0, { aN: -0.95, aF: 1.2 }],
  [0.22, { aN: 0.1, aF: 0.35 }],
]);

export function idlePose(stage, el, t) {
  const F = flavor(el);
  if (stage <= 1) {
    // sprout: relaxed, breathing, weight drifting from foot to foot, glancing around now and then
    const w = t * TAU / 2.6 * F.tempo, br = S(w);
    const look = smoothPulse(t, 5.3, 1.2) * -0.18 + smoothPulse(t + 2.1, 7.1, 0.9) * 0.08;
    return { turn: 0.35, sy: 1 + 0.018 * br, sx: 1 - 0.01 * br, y: 0, x: 0.4 * S(w * 0.5), lean: 0.02 + 0.015 * br, head: -0.02 * br + look,
      aN: 0.07 + 0.05 * S(w - 0.5), aF: -0.06 + 0.04 * S(w - 0.9), lN: 0.1, lF: -0.1 };
  }
  if (stage === 2) {
    // adult: a boxer's bounce — guard up, lead foot forward, sinking and springing on the beat
    const w = t * TAU / 0.62 * F.tempo, b = (1 - C(w)) / 2; // 0 up … 1 down
    return { turn: 0.85, crouch: 0.6 + 1.6 * b * F.bounce, sy: 1.01 - 0.035 * b, sx: 0.99 + 0.025 * b, lean: 0.14 + 0.03 * b,
      lN: 0.36, lF: -0.34, aN: 1.12 + 0.1 * S(w - 0.7), aF: 0.62 + 0.08 * S(w - 1.1), head: -0.06 - 0.03 * b };
  }
  // awakened: hovering, arms open, the legs and arms drifting a beat behind the body
  const w = t * TAU / 2.3 * F.tempo, b = S(w);
  return { turn: 0.8, z: 5 + 2.2 * b, plant: false, sy: 1 + 0.02 * b, lean: -0.03 + 0.03 * S(w - 0.5), head: -0.08 + 0.04 * S(w - 1),
    aN: 0.55 + 0.14 * S(w - 0.8), aF: 0.9 + 0.12 * S(w - 1.3), lN: 0.12 + 0.1 * S(w - 1.1), lF: -0.18 + 0.1 * S(w - 1.5) };
}

/** 0..1 bump that rises and falls over `len` seconds, every `period` seconds. */
function smoothPulse(t, period, len) {
  const u = (t % period) / len;
  return u > 1 ? 0 : S(u * Math.PI) ** 2;
}

/** t: seconds of walking; speed 0..1 blends a stroll into a full stride. */
export function movePose(stage, el, t, speed = 1) {
  const F = flavor(el);
  if (stage <= 1) {
    const u = t / 0.62 * F.tempo, p = withArms(WALK, WALK_ARMS, u, 0.05);
    p.y *= F.bounce; p.turn = 0.85;
    return scaleSwing(p, F.swing * (0.75 + 0.25 * speed));
  }
  if (stage === 2) {
    const u = t / 0.46 * F.tempo, p = withArms(RUN, RUN_ARMS, u, 0.04);
    p.y *= F.bounce; p.turn = 0.9; p.head = -0.1 + 0.04 * S(u * TAU * 2);
    return scaleSwing(p, F.swing);
  }
  // awakened: a low glide — leaning in, legs streaming behind, arms swept back, all a little late
  const w = t * TAU / 0.9 * F.tempo;
  return { turn: 0.9, z: 6 + 1.3 * S(w), plant: false, lean: 0.36 + 0.04 * S(w - 0.6), head: -0.24 + 0.05 * S(w - 1.2), sx: 1.03, sy: 0.98,
    lN: -0.38 + 0.12 * S(w - 0.9), lF: -0.62 + 0.12 * S(w - 1.6), aN: -0.78 + 0.14 * S(w - 0.5), aF: -1.02 + 0.12 * S(w - 1.2) };
}

function scaleSwing(p, k) {
  for (const ch of ["aN", "aF", "lN", "lF"]) p[ch] *= k;
  return p;
}

export const HURT = { lean: -0.42, aN: 0.9, aF: 1.3, head: -0.45, x: -3, lN: 0.35, lF: -0.15, sx: 0.94, sy: 1.04 };
export const DEAD = { lean: -1.45, aN: 2.4, aF: 2.8, head: -0.5, crouch: 6, lN: 1.1, lF: 0.7, x: -6, sy: 0.9 };

// ------------------------------------------------------------------ attacks
// The stance every move settles back into.
const STANCE = { lN: 0.34, lF: -0.32, aN: 0.75, aF: 0.45, lean: 0.12, crouch: 1 };

/**
 * Attack archetypes: keyframes [t, pose, ease] around the release (t = 0). W = wind-up, R = recovery.
 * ease names how we arrive at that key: "snap" cuts straight to it (the strike), "out" bursts and slows,
 * "back" overshoots and settles (follow-through), "io" eases both ends.
 */
export function archetype(name, W = 0.2, R = 0.3) {
  const w = (k) => -W * k, r = (k) => R * k;
  switch (name) {
    case "claw": return [
      [w(1), { ...STANCE }],
      [w(0.35), { aN: 2.7, aF: 2.3, lean: -0.22, lN: 0.3, lF: -0.42, crouch: 2, sy: 0.93, sx: 1.04, x: -2, head: -0.1 }, "out"],
      [0, { aN: 0.55, aF: 2.0, lean: 0.36, lN: 0.62, lF: -0.48, x: 3, sx: 1.08, sy: 0.95 }, "snap"],
      [0.05, { aN: 0.25, aF: 0.6, lean: 0.4, lN: 0.62, lF: -0.48, x: 4, sx: 1.05 }, "snap"],
      [0.1, { aN: 1.9, aF: 0.2, lean: 0.42, lN: 0.65, lF: -0.5, x: 5, crouch: 1 }, "snap"],
      [0.16, { aN: 0.2, aF: -0.1, lean: 0.44, lN: 0.65, lF: -0.5, x: 6, crouch: 2, sy: 0.96 }, "out"],
      [r(1), { ...STANCE }, "io"],
    ];
    case "slash": return [
      [w(1), { ...STANCE }],
      [w(0.3), { aN: 3.05, aF: -0.45, lean: -0.25, lN: 0.2, lF: -0.45, crouch: 1.5, sy: 0.94, x: -2, head: -0.14 }, "out"],
      [0, { aN: 1.0, aF: 0.5, lean: 0.38, lN: 0.66, lF: -0.5, x: 4, sx: 1.08, sy: 0.95 }, "snap"],
      [0.06, { aN: 0.05, aF: 0.6, lean: 0.46, lN: 0.68, lF: -0.52, x: 6, crouch: 2 }, "back"],
      [r(1), { ...STANCE }, "io"],
    ];
    case "flurry": {
      const k = [[w(1), { ...STANCE }], [w(0.3), { aN: -0.6, aF: 0.2, lean: -0.08, crouch: 3, lN: 0.4, lF: -0.45, sy: 0.92 }, "out"]];
      const hits = [0, 0.07, 0.14, 0.21, 0.28];
      hits.forEach((t, i) => k.push([t, i % 2 ? { aN: 0.5, aF: 1.75, lean: 0.3, x: 3 + i, lN: 0.58, lF: -0.48, sx: 1.05 } : { aN: 1.8, aF: 0.4, lean: 0.32, x: 3 + i, lN: 0.58, lF: -0.48, sx: 1.05 }, "snap"]));
      k.push([0.38, { aN: 2.4, aF: 0.6, lean: 0.4, x: 9, lN: 0.7, lF: -0.55, crouch: 2, sx: 1.08, sy: 0.95 }, "snap"]);
      k.push([0.44, { aN: 1.3, aF: 0.4, lean: 0.42, x: 10, lN: 0.7, lF: -0.55, crouch: 2 }, "back"]);
      k.push([r(1), { ...STANCE }, "io"]);
      return k;
    }
    case "spin": return [
      [w(1), { ...STANCE }],
      [w(0.3), { aN: -0.9, aF: 2.0, lean: -0.15, crouch: 3, lN: 0.45, lF: -0.5, sy: 0.92, sx: 1.05 }, "out"],
      [0, { aN: 1.65, aF: 1.55, lean: 0.05, crouch: 1, lN: 0.35, lF: -0.3, sx: 1.06, sy: 0.97, spin: 1 }, "snap"],
      [0.26, { aN: 1.6, aF: 1.5, lean: 0.08, crouch: 1, lN: 0.35, lF: -0.3, spin: 1 }, "lin"],
      [0.32, { aN: 0.9, aF: 0.6, lean: 0.24, crouch: 3, lN: 0.5, lF: -0.45, sy: 0.95 }, "back"],
      [r(1), { ...STANCE }, "io"],
    ];
    case "cleave": return [
      [w(1), { ...STANCE }],
      [w(0.55), { aN: 3.2, aF: 3.0, lean: -0.3, z: 2, plant: false, lN: 0.4, lF: -0.3, sy: 1.04, sx: 0.97, head: -0.25, x: -1 }, "out"],
      [w(0.15), { aN: 3.45, aF: 3.25, lean: -0.36, z: 3, plant: false, lN: 0.45, lF: -0.32, sy: 1.05, sx: 0.96, head: -0.3, x: -2 }, "io"],
      [0, { aN: 0.95, aF: 0.85, lean: 0.52, crouch: 4, lN: 0.75, lF: -0.6, x: 5, sx: 1.1, sy: 0.9 }, "snap"],
      [0.08, { aN: 0.35, aF: 0.3, lean: 0.6, crouch: 5, lN: 0.75, lF: -0.6, x: 6, sy: 0.92 }, "back"],
      [r(0.6), { aN: 0.4, aF: 0.3, lean: 0.5, crouch: 4, lN: 0.75, lF: -0.6, x: 6 }, "io"],
      [r(1), { ...STANCE }, "io"],
    ];
    case "uppercut": return [
      [w(1), { ...STANCE }],
      [w(0.35), { aN: -0.75, aF: 0.7, crouch: 5, lean: 0.32, lN: 0.6, lF: -0.5, sy: 0.88, sx: 1.06 }, "out"],
      [0, { aN: 2.9, aF: -0.3, crouch: 0, lean: -0.15, z: 4, plant: false, lN: 0.3, lF: -0.55, x: 3, head: -0.25, sy: 1.07, sx: 0.95 }, "snap"],
      [0.09, { aN: 3.15, aF: -0.4, lean: -0.22, z: 5, plant: false, lN: 0.25, lF: -0.6, x: 4, head: -0.3, sy: 1.03 }, "back"],
      [r(0.5), { aN: 1.4, aF: 0.4, lean: 0.14, crouch: 2.5, lN: 0.45, lF: -0.4, x: 4, sy: 0.94, sx: 1.04 }, "in"],
      [r(1), { ...STANCE }, "io"],
    ];
    case "throw": return [
      [w(1), { ...STANCE }],
      [w(0.3), { aN: -1.5, aF: 1.1, lean: -0.3, lN: 0.5, lF: -0.5, x: -2, sy: 0.95, head: -0.05 }, "out"],
      [0, { aN: 1.95, aF: -0.45, lean: 0.36, lN: 0.66, lF: -0.5, x: 3, sx: 1.07, sy: 0.96 }, "snap"],
      [0.08, { aN: 1.25, aF: -0.6, lean: 0.42, lN: 0.68, lF: -0.52, x: 4 }, "back"],
      [r(1), { ...STANCE }, "io"],
    ];
    case "cast": return [
      [w(1), { ...STANCE }],
      [w(0.3), { aN: -0.7, aF: -0.6, lean: -0.18, lN: 0.4, lF: -0.42, crouch: 2, sy: 0.94, head: -0.12 }, "out"],
      [0, { aN: 1.62, aF: 1.42, lean: 0.24, lN: 0.55, lF: -0.45, x: 3, sx: 1.06, sy: 0.97 }, "snap"],
      [0.08, { aN: 1.5, aF: 1.3, lean: 0.2, lN: 0.55, lF: -0.45, x: 3 }, "back"],
      [r(1), { aN: 1.3, aF: 1.0, lean: 0.16, lN: 0.45, lF: -0.4, x: 2 }, "io"],
    ];
    case "channel": return [
      [w(1), { ...STANCE }],
      [w(0.3), { aN: -0.6, aF: -0.5, lean: -0.12, lN: 0.4, lF: -0.4, crouch: 2, sy: 0.94 }, "out"],
      [0, { aN: 1.62, aF: 1.5, lean: 0.28, lN: 0.62, lF: -0.5, x: 3, crouch: 2, sx: 1.05, sy: 0.96 }, "snap"],
      [r(0.5), { aN: 1.66, aF: 1.54, lean: 0.3, lN: 0.64, lF: -0.52, x: 2, crouch: 2.5 }, "io"],
      [r(1), { aN: 1.6, aF: 1.48, lean: 0.27, lN: 0.62, lF: -0.5, x: 2, crouch: 2 }, "io"],
    ];
    case "slam": return [
      [w(1), { ...STANCE }],
      [w(0.55), { aN: 3.1, aF: 3.0, z: 9, plant: false, lean: -0.2, lN: 0.6, lF: 0.4, sy: 1.1, sx: 0.93, head: -0.25 }, "out"],
      [w(0.12), { aN: 3.2, aF: 3.1, z: 11, plant: false, lean: -0.1, lN: 0.65, lF: 0.45, sy: 1.08, head: -0.2 }, "io"],
      [0, { aN: 0.5, aF: 0.45, crouch: 5, lean: 0.48, lN: 0.8, lF: -0.7, sx: 1.12, sy: 0.86 }, "snap"],
      [0.12, { aN: 0.3, aF: 0.25, crouch: 4, lean: 0.42, lN: 0.8, lF: -0.7, sy: 0.92 }, "back"],
      [r(1), { ...STANCE }, "io"],
    ];
    case "stomp": return [
      [w(1), { ...STANCE }],
      [w(0.4), { lN: 1.55, lF: -0.05, aN: 1.3, aF: 1.5, lean: -0.18, z: 3, plant: false, sy: 1.05, head: -0.1 }, "out"],
      [0, { lN: 0.3, lF: -0.38, aN: 0.4, aF: 0.6, lean: 0.3, crouch: 4, x: 2, sx: 1.1, sy: 0.88 }, "snap"],
      [0.1, { lN: 0.3, lF: -0.38, aN: 0.5, aF: 0.6, lean: 0.26, crouch: 3, x: 2, sy: 0.95 }, "back"],
      [r(1), { ...STANCE }, "io"],
    ];
    case "raise": return [
      [w(1), { ...STANCE }],
      [w(0.4), { aN: 0.1, aF: 0.1, crouch: 4, lean: 0.18, lN: 0.4, lF: -0.4, sy: 0.9, sx: 1.05, head: 0.15 }, "out"],
      [0, { aN: 2.95, aF: 2.8, lean: -0.18, z: 3, plant: false, lN: 0.25, lF: -0.3, head: -0.3, sy: 1.1, sx: 0.94 }, "snap"],
      [0.12, { aN: 2.85, aF: 2.7, lean: -0.14, z: 3, plant: false, lN: 0.25, lF: -0.3, head: -0.25, sy: 1.04 }, "back"],
      [r(1), { aN: 2.6, aF: 2.45, lean: -0.1, z: 2, plant: false, lN: 0.25, lF: -0.25, head: -0.2 }, "io"],
    ];
    // Archery with game punch: a dip before the draw (anticipation), a deep lunge while drawing with the bow
    // canted, a held aim, then the release kicks the whole body back — string hand snapping past the ear,
    // bow arm jolting forward — and settles with an overshoot. At full power the archer leaps back as it fires.
    case "bow": case "bow3": {
      const heavy = name === "bow3", k = heavy ? 1.25 : 1;
      return [
        [w(1), { ...STANCE, turn: 0.9 }],
        [w(0.82), { turn: 1, aN: 1.2, aF: 1.2, lean: 0.18, lN: 0.42, lF: -0.42, crouch: 3 * k, sx: 1.04, sy: 0.94, head: 0.1 }, "out"],       // dip & nock
        [w(0.32), { turn: 1, aN: 1.62, aF: -1.6 * k, lean: -0.16 * k, lN: 0.72, lF: -0.72, crouch: 4 * k, x: -1.5, head: 0.14, sx: 0.97, sy: 1.03 }, "out"], // lunge & draw
        [w(0.04), { turn: 1, aN: 1.64, aF: -1.72 * k, lean: -0.2 * k, lN: 0.74, lF: -0.74, crouch: 4.5 * k, x: -2, head: 0.16, sx: 0.96, sy: 1.04 }, "io"], // aim, straining
        [0, { turn: 1, aN: 1.78, aF: -2.45, lean: -0.36 * k, lN: 0.62, lF: -0.82, crouch: 1, x: -5 * k, z: heavy ? 7 : 0, plant: !heavy, head: 0.02, sx: 1.08, sy: 0.93 }, "snap"], // release kick
        [0.1, { turn: 1, aN: 1.55, aF: -2.3, lean: -0.24, lN: 0.6, lF: -0.7, crouch: 2, x: -6 * k, z: heavy ? 5 : 0, plant: !heavy, head: 0.04 }, "out"],
        [0.2, { turn: 1, aN: 1.5, aF: -1.9, lean: -0.08, lN: 0.62, lF: -0.62, crouch: 3.5, x: -6.5 * k, z: 0, head: 0.06, sx: 1.06, sy: 0.94 }, "in"],   // land / settle
        [r(0.7), { turn: 0.95, aN: 1.2, aF: -0.4, lean: 0.04, lN: 0.5, lF: -0.5, crouch: 1.5, x: -4 }, "back"],
        [r(1), { ...STANCE }, "io"],
      ];
    }
    case "bow2": return [
      // twin shot: draw, fire, the body whips round as the hand snaps back to the string, fire again harder
      [w(1), { ...STANCE, turn: 0.9 }],
      [w(0.75), { turn: 1, aN: 1.2, aF: 1.2, lean: 0.16, lN: 0.44, lF: -0.44, crouch: 3, sx: 1.04, sy: 0.95 }, "out"],
      [w(0.08), { turn: 1, aN: 1.62, aF: -1.62, lean: -0.16, lN: 0.72, lF: -0.72, crouch: 4, x: -1.5, head: 0.14, sx: 0.97, sy: 1.03 }, "out"],
      [0, { turn: 1, aN: 1.76, aF: -2.35, lean: -0.3, lN: 0.64, lF: -0.8, crouch: 2, x: -4, sx: 1.06, sy: 0.95 }, "snap"],
      [0.045, { turn: 0.85, aN: 1.6, aF: 1.3, lean: 0.12, lN: 0.7, lF: -0.7, crouch: 4, x: -3.5, head: 0.12 }, "out"],              // whip back to the string
      [0.1, { turn: 1, aN: 1.64, aF: -1.7, lean: -0.2, lN: 0.74, lF: -0.74, crouch: 4.5, x: -3.5, head: 0.16 }, "io"],
      [0.11, { turn: 1, aN: 1.8, aF: -2.5, lean: -0.4, lN: 0.6, lF: -0.85, crouch: 1, x: -8, sx: 1.08, sy: 0.93 }, "snap"],       // second, bigger kick
      [0.24, { turn: 1, aN: 1.52, aF: -2.1, lean: -0.1, lN: 0.62, lF: -0.62, crouch: 3.5, x: -8.5, sx: 1.05, sy: 0.95 }, "out"],
      [r(1), { ...STANCE }, "io"],
    ];
    // ---- chakram throws. The body coils away from the target, holds the coil a beat (anticipation), then
    // unwinds hip-first so the throwing arm cracks out last, and is carried through past the release.
    case "chuck": return [ // a backhand sidearm throw
      [w(1), { ...STANCE }],
      [w(0.55), { turn: 1, aN: -1.3, aF: 0.9, lean: -0.12, lN: 0.3, lF: -0.5, crouch: 3, x: -2, sx: 0.96, sy: 1.02, head: 0.05 }, "out"],
      [w(0.12), { turn: 1, aN: -1.55, aF: 1.1, lean: -0.2, lN: 0.36, lF: -0.56, crouch: 3.5, x: -3, sx: 0.95, sy: 1.03, head: 0.06 }, "io"],
      [0, { turn: 0.7, aN: 1.75, aF: -0.6, lean: 0.38, lN: 0.7, lF: -0.55, crouch: 1, x: 4, sx: 1.1, sy: 0.94 }, "snap"],
      [0.07, { turn: 0.6, aN: 2.25, aF: -0.9, lean: 0.42, lN: 0.72, lF: -0.58, crouch: 2.5, x: 6, sx: 1.04 }, "out"],
      [r(0.65), { turn: 0.85, aN: 1.4, aF: 0.2, lean: 0.2, lN: 0.5, lF: -0.45, crouch: 1.5, x: 4 }, "back"],
      [r(1), { ...STANCE }, "io"],
    ];
    case "chuck2": return [ // both arms swept back like wings, then flung out one after the other
      [w(1), { ...STANCE }],
      [w(0.6), { turn: 0.95, aN: -1.25, aF: -1.05, lean: 0.2, crouch: 4, lN: 0.45, lF: -0.5, sy: 0.92, sx: 1.05, head: 0.12, x: -1 }, "out"],
      [w(0.1), { turn: 0.95, aN: -1.45, aF: -1.25, lean: 0.24, crouch: 4.5, lN: 0.48, lF: -0.52, sy: 0.91, sx: 1.06, head: 0.14, x: -1.5 }, "io"],
      [0, { turn: 0.85, aN: 1.9, aF: -1.3, lean: 0.36, x: 3, lN: 0.66, lF: -0.5, sx: 1.08, sy: 0.95, crouch: 1 }, "snap"],
      [0.06, { turn: 0.7, aN: 2.3, aF: 1.6, lean: 0.4, x: 6, lN: 0.7, lF: -0.55, crouch: 2, sx: 1.08, sy: 0.95 }, "snap"],
      [0.14, { turn: 0.7, aN: 2.0, aF: 1.9, lean: 0.36, x: 7, crouch: 3, lN: 0.7, lF: -0.55 }, "out"],
      [r(0.7), { turn: 0.85, aN: 1.2, aF: 0.9, lean: 0.2, x: 5, crouch: 1.5, lN: 0.5, lF: -0.45 }, "back"],
      [r(1), { ...STANCE }, "io"],
    ];
    case "chuck3": return [ // a hop with the storm chakram wound far behind the head, hurled down on landing
      [w(1), { ...STANCE }],
      [w(0.78), { turn: 1, aN: -0.9, aF: 1.6, lean: 0.25, crouch: 5, lN: 0.5, lF: -0.55, sy: 0.88, sx: 1.07 }, "out"],
      [w(0.5), { turn: 1, aN: 3.7, aF: 1.2, lean: -0.36, z: 7, plant: false, lN: 0.6, lF: 0.2, sy: 1.08, sx: 0.94, head: -0.2, x: -2 }, "out"],
      [w(0.1), { turn: 1, aN: 3.95, aF: 1.4, lean: -0.44, z: 9, plant: false, lN: 0.65, lF: 0.25, sy: 1.1, sx: 0.93, head: -0.26, x: -3 }, "io"],
      [0, { turn: 0.8, aN: 1.3, aF: -0.8, lean: 0.56, z: 3, plant: false, lN: 0.8, lF: -0.6, crouch: 2, x: 5, sx: 1.13, sy: 0.9 }, "snap"],
      [0.08, { turn: 0.75, aN: 0.6, aF: -1.0, lean: 0.6, lN: 0.82, lF: -0.7, crouch: 5, x: 7, sx: 1.08, sy: 0.88 }, "out"],
      [r(0.65), { turn: 0.85, aN: 1.0, aF: 0.2, lean: 0.3, crouch: 2.5, x: 6, lN: 0.6, lF: -0.5 }, "back"],
      [r(1), { ...STANCE }, "io"],
    ];
    // ---- fire: boxing. Hands up by the chin, every punch thrown from the hip and shoulder (the body slides
    // and stretches into it) and pulled straight back to the guard; the cross turns the chest to the viewer.
    case "jab3": { // straight punches pistoning from the hip: one fist drives out to full reach at shoulder height
      // while the other snaps back to the hip (eN/eF shorten the arm, so a chambered fist sits tight at the side)
      const N = (x, o = {}) => ({ turn: 1, aN: 1.6, eN: 1.08, aF: 0.05, eF: 0.6, lean: 0.12, crouch: 2, lN: 0.58, lF: -0.52, x, sx: 1.05, sy: 0.97, ...o });
      const F = (x, o = {}) => ({ turn: 1, aN: 0.05, eN: 0.6, aF: 1.6, eF: 1.12, lean: 0.14, crouch: 2, lN: 0.6, lF: -0.54, x, sx: 1.05, sy: 0.97, ...o });
      return [
        [w(1), { ...STANCE }],
        [w(0.6), { turn: 0.95, aN: 0.1, eN: 0.6, aF: 0.15, eF: 0.62, lean: 0.05, crouch: 2.8, lN: 0.5, lF: -0.48, x: -1 }, "out"], // both fists at the hips
        [-0.005, F(1.5), "out"], [0.025, F(1.8), "lin"],    // each punch lands early and is held a moment so it reads
        [0.055, N(3), "out"], [0.085, N(3.3), "lin"],
        [0.115, F(4.5), "out"], [0.14, F(4.7), "lin"],
        [0.17, { turn: 1, aN: -0.25, eN: 0.55, aF: 0.3, eF: 0.66, lean: 0.03, crouch: 2.9, lN: 0.55, lF: -0.5, x: 4.5, sx: 0.98 }, "out"], // load the last one
        [0.195, N(7.5, { eN: 1.14, lean: 0.2, sx: 1.1, sy: 0.94, lN: 0.7, lF: -0.62, aF: -0.2 }), "out"],
        [0.27, N(8.2, { eN: 1.12, lean: 0.2, lN: 0.7, lF: -0.62, aF: -0.15 }), "out"],
        [r(1), { ...STANCE }, "io"],
      ];
    }
    case "rush": { // four quick alternating punches walking forward, then a heavy straight off a deep step
      const G = (x, o = {}) => ({ turn: 0.85, aN: 1.15, aF: 1.3, lean: 0.2, crouch: 2.5, lN: 0.5, lF: -0.45, x, ...o });
      const N = (x) => ({ ...G(x), turn: 1, aN: 1.62, aF: 1.1, lean: 0.34, lN: 0.6, lF: -0.52, sx: 1.08, sy: 0.96 });
      const F = (x) => ({ ...G(x), turn: 0.6, aN: 1.0, aF: 1.62, lean: 0.38, lN: 0.64, lF: -0.56, sx: 1.08, sy: 0.96 });
      return [
        [w(1), { ...STANCE }],
        [w(0.4), G(-1, { crouch: 3, sy: 0.95 }), "out"],
        [0, N(3), "snap"], [0.03, G(3), "out"],
        [0.055, F(5), "snap"], [0.085, G(5), "out"],
        [0.11, N(7), "snap"], [0.14, G(7), "out"],
        [0.165, F(9), "snap"],
        [0.2, G(8, { turn: 1, aN: 0.8, crouch: 4, sy: 0.92, lean: 0.05, x: 7 }), "out"],
        [0.25, { ...G(14), turn: 0.95, aN: 1.6, aF: 0.9, lean: 0.5, lN: 0.85, lF: -0.75, sx: 1.18, sy: 0.92, crouch: 2 }, "snap"],
        [0.33, { ...G(15), turn: 0.95, aN: 1.58, aF: 0.95, lean: 0.5, lN: 0.85, lF: -0.75, crouch: 2.5 }, "out"],
        [r(1), { ...STANCE }, "io"],
      ];
    }
    case "shoryu": return [ // coiled to the floor, a burst forward, and a rising flame uppercut that leaves the ground
      [w(1), { ...STANCE }],
      [w(0.6), { turn: 1, aN: -0.4, aF: 1.0, lean: 0.45, crouch: 6, lN: 0.75, lF: -0.75, sy: 0.85, sx: 1.1, x: -2, head: 0.15 }, "out"],
      [w(0.1), { turn: 1, aN: -0.7, aF: 1.2, lean: 0.55, crouch: 6.5, lN: 0.8, lF: -0.8, sy: 0.84, sx: 1.12, head: 0.2 }, "io"],
      [0, { turn: 0.8, aN: 2.6, aF: 0.2, lean: 0.1, z: 6, plant: false, lN: 0.9, lF: -0.6, x: 3, sy: 1.1, sx: 0.94, head: -0.2 }, "snap"],
      [0.08, { turn: 0.7, aN: 3.15, aF: -0.3, lean: -0.2, z: 16, plant: false, lN: 1.1, lF: -0.2, x: 4, sy: 1.12, sx: 0.92, head: -0.35 }, "out"],
      [0.2, { turn: 0.75, aN: 3.05, aF: -0.2, lean: -0.15, z: 17, plant: false, lN: 1.0, lF: -0.25, x: 4, sy: 1.05, head: -0.3 }, "io"],
      [0.34, { turn: 0.85, aN: 1.0, aF: 0.8, lean: 0.3, crouch: 5, lN: 0.7, lF: -0.6, x: 4, sy: 0.88, sx: 1.1 }, "in"],
      [r(1), { ...STANCE }, "io"],
    ];
    // ---- earth: a stone jab, then the far fist driven up from the floor
    case "onetwo": return [
      [w(1), { ...STANCE }],
      [w(0.5), { turn: 0.9, aN: 0.9, aF: 1.0, lean: 0.12, crouch: 3, lN: 0.45, lF: -0.45, sy: 0.93, sx: 1.04 }, "out"],
      [0, { turn: 0.95, aN: 1.65, aF: 0.8, lean: 0.34, lN: 0.62, lF: -0.5, x: 4, sx: 1.1, sy: 0.95, crouch: 1.5 }, "snap"],
      [0.06, { turn: 0.85, aN: 1.0, aF: -0.6, lean: 0.38, lN: 0.66, lF: -0.55, crouch: 5, x: 5, sy: 0.88, sx: 1.08 }, "out"],
      [0.14, { turn: 0.6, aN: 0.6, aF: 2.95, lean: -0.18, z: 5, plant: false, lN: 0.4, lF: -0.6, x: 8, sy: 1.08, sx: 0.94, head: -0.25 }, "snap"],
      [0.22, { turn: 0.6, aN: 0.6, aF: 3.15, lean: -0.24, z: 6, plant: false, lN: 0.35, lF: -0.6, x: 9, head: -0.3 }, "back"],
      [r(0.75), { turn: 0.8, aN: 1.2, aF: 1.2, lean: 0.15, crouch: 2.5, lN: 0.45, lF: -0.4, x: 7, sy: 0.94 }, "in"],
      [r(1), { ...STANCE }, "io"],
    ];
    case "point": return [
      [w(1), { ...STANCE }],
      [w(0.3), { aN: 2.9, aF: 0.4, lean: -0.15, lN: 0.35, lF: -0.38, head: -0.2, sy: 1.03 }, "out"],
      [0, { aN: 1.4, aF: 0.15, lean: 0.2, lN: 0.5, lF: -0.42, x: 2, sx: 1.05 }, "snap"],
      [0.08, { aN: 1.3, aF: 0.1, lean: 0.18, lN: 0.5, lF: -0.42, x: 2 }, "back"],
      [r(1), { aN: 1.2, aF: 0.2, lean: 0.15, lN: 0.45, lF: -0.38, x: 2 }, "io"],
    ];
    case "whip": return [
      [w(1), { ...STANCE }],
      [w(0.3), { aN: -1.35, aF: 0.7, lean: -0.25, lN: 0.38, lF: -0.45, x: -2, sy: 0.95 }, "out"],
      [0, { aN: 2.3, aF: 0.2, lean: 0.3, lN: 0.62, lF: -0.48, x: 3, sx: 1.06 }, "snap"],
      [0.1, { aN: 1.1, aF: 0.2, lean: 0.36, lN: 0.64, lF: -0.5, x: 4 }, "back"],
      [r(1), { ...STANCE }, "io"],
    ];
    case "dash": return [
      [w(1), { ...STANCE }],
      [w(0.4), { crouch: 4, lean: 0.45, aN: -0.8, aF: -1.0, lN: 0.7, lF: -0.7, sy: 0.88, sx: 1.06 }, "out"],
      [0, { lean: 0.62, aN: 1.75, aF: -1.15, lN: 0.85, lF: -0.95, x: 2, sx: 1.18, sy: 0.9, plant: false }, "snap"],
      [0.16, { lean: 0.4, aN: 0.4, aF: -0.6, lN: 0.65, lF: -0.6, x: 2, crouch: 3, sx: 1.04, sy: 0.92 }, "back"],
      [r(1), { ...STANCE }, "io"],
    ];
    case "ult": return [
      [w(1), { ...STANCE }],
      [w(0.7), { aN: 0.2, aF: 0.2, crouch: 5, lean: 0.35, lN: 0.5, lF: -0.5, head: 0.25, sy: 0.86, sx: 1.06 }, "out"],
      [w(0.35), { aN: 3.05, aF: 2.95, z: 10, plant: false, lean: -0.28, lN: 0.15, lF: -0.35, head: -0.35, sy: 1.12, sx: 0.92 }, "out"],
      [0, { aN: 1.55, aF: 1.42, z: 7, plant: false, lean: 0.34, lN: 0.35, lF: -0.5, x: 3, sx: 1.08, sy: 0.95 }, "snap"],
      [0.1, { aN: 1.45, aF: 1.3, z: 6, plant: false, lean: 0.3, lN: 0.35, lF: -0.5, x: 3 }, "back"],
      [r(1), { aN: 1.3, aF: 1.2, z: 3, plant: false, lean: 0.24, lN: 0.3, lF: -0.42, x: 2 }, "io"],
    ];
    default: return [[w(1), { ...STANCE }], [r(1), { ...STANCE }, "io"]];
  }
}

/** Sample attack keyframes at time t (relative to the release). */
export function sampleKeys(keys, t, lerp) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, p0] = keys[i], [t1, p1, mode = "io"] = keys[i + 1];
    if (t < t1) {
      if (mode === "snap") return p0;
      const u = (t - t0) / (t1 - t0 || 1);
      const o = lerp(p0, p1, (ease[mode] ?? ease.io)(u));
      if (p0.spin) o.spin = 1;
      o.plant = u < 0.5 ? p0.plant : p1.plant;
      return o;
    }
  }
  return keys[keys.length - 1][1];
}
