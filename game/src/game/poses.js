// Poses for the puppet: idle and move loops per growth stage (with element flavour), and attack archetypes.
// Angles in radians. aN/aF: near/far arm swing (0 hangs, +π/2 points forward, +π straight up).
// lN/lF: legs (+ forward). lean: torso (+ forward). z: float height. crouch: sink (px).

const S = Math.sin, C = Math.cos;

/** Element tempo/weight: fire bouncy, water smooth, wind quick, earth heavy. */
export const FLAVOR = {
  fire: { tempo: 1.05, bounce: 1.3, sway: 1 },
  water: { tempo: 0.85, bounce: 0.8, sway: 1.3 },
  wind: { tempo: 1.25, bounce: 0.9, sway: 0.8 },
  earth: { tempo: 0.82, bounce: 1.5, sway: 0.7 },
  light: { tempo: 1, bounce: 1, sway: 1 },
  dark: { tempo: 0.9, bounce: 0.8, sway: 1.2 },
  none: { tempo: 1, bounce: 1, sway: 1 },
};

export function idlePose(stage, el, t) {
  const F = FLAVOR[el] ?? FLAVOR.none, w = t * F.tempo;
  if (stage <= 1) {
    // sprout: relaxed, breathing, looks around now and then
    const look = S(w * 0.7) > 0.93 ? -0.18 : 0;
    return { y: S(w * 2.6) > 0.3 ? -1 : 0, aN: 0.12 + 0.07 * S(w * 2.6), aF: -0.08 - 0.05 * S(w * 2.6), head: look + 0.04 * S(w * 1.3), lN: 0.04, lF: -0.04 };
  }
  if (stage === 2) {
    // adult: fighting stance, weight shifting from foot to foot, lead arm up
    const sh = S(w * 3.2);
    return { crouch: 1 + (sh > 0.5 ? 1 : 0), lean: 0.1 + 0.03 * sh * F.sway, lN: 0.38, lF: -0.32, aN: 1.15 + 0.12 * sh, aF: 0.55 - 0.1 * sh, head: -0.05, x: Math.round(sh * 0.6) };
  }
  // awakened: floats, arms open, slow breathing in the air
  const b = S(w * 1.7);
  return { z: 5 + 2 * b * F.bounce, lean: -0.04, aN: 0.55 + 0.12 * S(w * 1.7 + 1), aF: 0.7 + 0.1 * S(w * 1.7 + 2), lN: 0.14 + 0.06 * b, lF: -0.12 + 0.05 * b, head: -0.06 };
}

export function movePose(stage, el, t) {
  const F = FLAVOR[el] ?? FLAVOR.none;
  if (stage <= 1) {
    // sprout: a quick little trot, big arm swing, small steps
    const w = t * 11 * F.tempo, s = S(w);
    return { y: -Math.round(Math.abs(C(w)) * 1.4 * F.bounce), lean: 0.08, lN: 0.5 * s, lF: -0.5 * s, aN: -0.7 * s + 0.1, aF: 0.7 * s + 0.1, head: 0.04 };
  }
  if (stage === 2) {
    // adult: a run, leaning in, arms pumping
    const w = t * 13 * F.tempo, s = S(w);
    return { y: -Math.round(Math.abs(C(w)) * 2 * F.bounce), lean: 0.24, lN: 0.85 * s, lF: -0.85 * s, aN: -1.0 * s + 0.35, aF: 1.0 * s + 0.35, head: -0.08 };
  }
  // awakened: glides low over the floor, legs trailing, arms swept back
  const w = t * 6 * F.tempo, s = S(w);
  return { z: 6 + 1.5 * s, lean: 0.36, lN: -0.35 + 0.08 * s, lF: -0.55 + 0.08 * s, aN: -0.65 + 0.1 * s, aF: -0.85 + 0.1 * s, head: -0.25 };
}

export const HURT = { lean: -0.35, aN: 0.9, aF: 0.6, head: -0.3, x: -2, lN: -0.2, lF: 0.25 };
export const DEAD = { lean: -1.35, aN: 2.6, aF: 2.4, head: -0.4, crouch: 6, lN: 0.9, lF: 0.6, x: -6 };

/**
 * Attack archetypes: keyframes [t, pose] around the release (t = 0). W = wind-up length, R = recovery.
 * Keys hold for "snap" frames (the release is a hard cut, the way a pixel artist would key it).
 */
export function archetype(name, W = 0.2, R = 0.3) {
  switch (name) {
    case "claw": return [
      [-W, { aN: 2.5, aF: 0.3, lean: -0.15, lN: 0.25, lF: -0.2, head: -0.1 }],
      [0, { aN: 0.8, aF: 1.4, lean: 0.25, lN: 0.45, lF: -0.3, x: 2 }, "snap"],
      [0.05, { aN: 1.5, aF: 0.6, lean: 0.3, lN: 0.45, lF: -0.3, x: 3 }, "snap"],
      [0.1, { aN: 0.5, aF: 1.8, lean: 0.35, lN: 0.5, lF: -0.35, x: 4, crouch: 1 }, "snap"],
      [R, { aN: 0.5, aF: 0.4, lean: 0.12, lN: 0.3, lF: -0.2 }],
    ];
    case "slash": return [
      [-W, { aN: 2.9, aF: -0.3, lean: -0.2, lN: 0.2, lF: -0.3, head: -0.12 }],
      [0, { aN: 1.3, aF: 0.2, lean: 0.3, lN: 0.55, lF: -0.4, x: 3 }, "snap"],
      [0.07, { aN: 0.3, aF: 0.4, lean: 0.35, lN: 0.55, lF: -0.4, x: 4, crouch: 1 }, "snap"],
      [R, { aN: 0.4, aF: 0.3, lean: 0.1, lN: 0.3, lF: -0.2 }],
    ];
    case "flurry": return [
      [-W, { aN: 0.2, aF: 0.1, lean: -0.1, crouch: 2, lN: 0.3, lF: -0.3 }],
      [0, { aN: 1.7, aF: 0.4, lean: 0.25, x: 3, lN: 0.5, lF: -0.4 }, "snap"],
      [0.07, { aN: 0.6, aF: 1.6, lean: 0.25, x: 4, lN: 0.5, lF: -0.4 }, "snap"],
      [0.14, { aN: 1.9, aF: 0.3, lean: 0.3, x: 5, lN: 0.5, lF: -0.4 }, "snap"],
      [0.21, { aN: 0.4, aF: 1.8, lean: 0.3, x: 6, lN: 0.5, lF: -0.4 }, "snap"],
      [0.3, { aN: 2.2, aF: 0.6, lean: 0.35, x: 7, lN: 0.6, lF: -0.5, crouch: 1 }, "snap"],
      [R, { aN: 0.5, aF: 0.4, lean: 0.12, lN: 0.3, lF: -0.2 }],
    ];
    case "spin": return [
      [-W, { aN: 0.5, aF: 2.2, lean: -0.1, crouch: 2, lN: 0.4, lF: -0.4 }],
      [0, { aN: 1.6, aF: 1.6, lean: 0.05, crouch: 1, lN: 0.3, lF: -0.3, spin: 1 }, "snap"],
      [0.25, { aN: 1.6, aF: 1.6, lean: 0.05, crouch: 1, lN: 0.3, lF: -0.3, spin: 1 }],
      [0.3, { aN: 1.0, aF: 0.9, lean: 0.15, crouch: 2, lN: 0.4, lF: -0.4 }, "snap"],
      [R, { aN: 0.5, aF: 0.4, lean: 0.1, lN: 0.3, lF: -0.2 }],
    ];
    case "cleave": return [
      [-W, { aN: 3.1, aF: 3.0, lean: -0.3, z: 3, lN: 0.3, lF: -0.2, head: -0.2 }],
      [-W * 0.3, { aN: 3.3, aF: 3.2, lean: -0.35, z: 4, lN: 0.35, lF: -0.25, head: -0.25 }],
      [0, { aN: 1.1, aF: 1.0, lean: 0.45, crouch: 3, lN: 0.6, lF: -0.5, x: 4 }, "snap"],
      [0.1, { aN: 0.6, aF: 0.5, lean: 0.5, crouch: 4, lN: 0.6, lF: -0.5, x: 4 }],
      [R, { aN: 0.4, aF: 0.3, lean: 0.12, lN: 0.3, lF: -0.2 }],
    ];
    case "uppercut": return [
      [-W, { aN: -0.6, aF: 0.6, crouch: 4, lean: 0.2, lN: 0.5, lF: -0.4 }],
      [0, { aN: 3.0, aF: 0.2, crouch: 0, lean: -0.15, z: 3, lN: 0.3, lF: -0.5, x: 3, head: -0.2 }, "snap"],
      [0.1, { aN: 3.1, aF: 0.1, lean: -0.2, z: 4, lN: 0.25, lF: -0.5, x: 3, head: -0.25 }],
      [R, { aN: 0.5, aF: 0.3, lean: 0.1, lN: 0.3, lF: -0.2 }],
    ];
    case "throw": return [
      [-W, { aN: -1.3, aF: 1.0, lean: -0.25, lN: 0.4, lF: -0.4, head: -0.05 }],
      [0, { aN: 1.9, aF: -0.3, lean: 0.3, lN: 0.5, lF: -0.45, x: 3 }, "snap"],
      [0.08, { aN: 1.5, aF: -0.4, lean: 0.32, lN: 0.5, lF: -0.45, x: 3 }],
      [R, { aN: 0.5, aF: 0.3, lean: 0.1, lN: 0.3, lF: -0.2 }],
    ];
    case "cast": return [
      [-W, { aN: -0.5, aF: -0.4, lean: -0.15, lN: 0.35, lF: -0.35, head: -0.1 }],
      [0, { aN: 1.6, aF: 1.4, lean: 0.2, lN: 0.45, lF: -0.4, x: 2 }, "snap"],
      [R, { aN: 1.55, aF: 1.35, lean: 0.18, lN: 0.45, lF: -0.4, x: 2 }],
    ];
    case "channel": return [
      [-W, { aN: -0.4, aF: -0.3, lean: -0.1, lN: 0.35, lF: -0.35 }],
      [0, { aN: 1.62, aF: 1.5, lean: 0.25, lN: 0.5, lF: -0.45, x: 2, crouch: 1 }, "snap"],
      [R, { aN: 1.62, aF: 1.5, lean: 0.25, lN: 0.5, lF: -0.45, x: 2, crouch: 1 }],
    ];
    case "slam": return [
      [-W, { aN: 3.0, aF: 3.0, z: 6, lean: -0.15, lN: 0.5, lF: 0.4, head: -0.2 }],
      [0, { aN: 0.6, aF: 0.6, crouch: 4, lean: 0.4, lN: 0.6, lF: -0.6 }, "snap"],
      [0.12, { aN: 0.4, aF: 0.4, crouch: 3, lean: 0.35, lN: 0.6, lF: -0.6 }],
      [R, { aN: 0.4, aF: 0.3, lean: 0.1, lN: 0.3, lF: -0.2 }],
    ];
    case "stomp": return [
      [-W, { lN: 1.5, lF: -0.1, aN: 1.2, aF: 1.4, lean: -0.15, z: 2 }],
      [0, { lN: 0.25, lF: -0.3, aN: 0.5, aF: 0.6, lean: 0.25, crouch: 3 }, "snap"],
      [R, { aN: 0.4, aF: 0.3, lean: 0.1, lN: 0.3, lF: -0.2 }],
    ];
    case "raise": return [
      [-W, { aN: 0.3, aF: 0.3, crouch: 2, lean: 0.1, lN: 0.3, lF: -0.3 }],
      [0, { aN: 2.9, aF: 2.8, lean: -0.15, z: 2, lN: 0.25, lF: -0.25, head: -0.25 }, "snap"],
      [R, { aN: 2.8, aF: 2.7, lean: -0.12, z: 2, lN: 0.25, lF: -0.25, head: -0.2 }],
    ];
    case "point": return [
      [-W, { aN: 2.8, aF: 0.4, lean: -0.1, lN: 0.3, lF: -0.3, head: -0.2 }],
      [0, { aN: 1.35, aF: 0.2, lean: 0.15, lN: 0.4, lF: -0.35, x: 2 }, "snap"],
      [R, { aN: 1.3, aF: 0.2, lean: 0.15, lN: 0.4, lF: -0.35, x: 2 }],
    ];
    case "whip": return [
      [-W, { aN: -1.1, aF: 0.6, lean: -0.2, lN: 0.35, lF: -0.35 }],
      [0, { aN: 2.2, aF: 0.2, lean: 0.25, lN: 0.5, lF: -0.4, x: 3 }, "snap"],
      [0.1, { aN: 1.3, aF: 0.2, lean: 0.3, lN: 0.5, lF: -0.4, x: 3 }],
      [R, { aN: 0.5, aF: 0.3, lean: 0.1, lN: 0.3, lF: -0.2 }],
    ];
    case "dash": return [
      [-W, { crouch: 3, lean: 0.4, aN: -0.6, aF: -0.8, lN: 0.6, lF: -0.6 }],
      [0, { lean: 0.6, aN: 1.7, aF: -1.0, lN: 0.8, lF: -0.9, x: 2 }, "snap"],
      [R, { lean: 0.15, aN: 0.5, aF: 0.3, lN: 0.3, lF: -0.2 }],
    ];
    case "ult": return [
      [-W, { aN: 0.2, aF: 0.2, crouch: 4, lean: 0.3, lN: 0.4, lF: -0.4, head: 0.2 }],
      [-W * 0.4, { aN: 3.0, aF: 2.9, z: 8, lean: -0.25, lN: 0.2, lF: -0.3, head: -0.3 }],
      [0, { aN: 1.5, aF: 1.4, z: 6, lean: 0.3, lN: 0.3, lF: -0.4, x: 2 }, "snap"],
      [R, { aN: 1.4, aF: 1.3, z: 4, lean: 0.25, lN: 0.3, lF: -0.4, x: 2 }],
    ];
    default: return [[-W, {}], [R, {}]];
  }
}

/** Sample keyframes at time t (relative to release). Eased between keys; "snap" keys cut in. */
export function sampleKeys(keys, t, lerp) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, p0] = keys[i], [t1, p1, mode] = keys[i + 1];
    if (t < t1) {
      if (mode === "snap") return p0;
      const u = (t - t0) / (t1 - t0), e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
      const o = lerp(p0, p1, e);
      if (p0.spin) o.spin = 1;
      return o;
    }
  }
  return keys[keys.length - 1][1];
}
