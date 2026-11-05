// Dungeon rooms: a back wall and a tiled floor painted once per room, plus live decorations (torches, crystals…).
import { hex, mix, scale, noise2, rand, fbm } from "../px.js";
import { W, H } from "../core/screen.js";
import { ELEMENTS } from "../data/elements.js";

export const ARENA = { x0: 18, x1: 462, y0: 140, y1: 258 };
const WALL_BOTTOM = 128;

/** Paint a room into a Uint32Array (frame-sized). theme: element id. seed varies the details. */
export function paintRoom(theme, seed = 1, opts = {}) {
  const F = ELEMENTS[theme].floor, base = F.base.map(hex), acc = hex(F.accent);
  const buf = new Uint32Array(W * H);
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = c; };
  const darkest = scale(base[0], 0.6);
  // back wall: big stone blocks, darker toward the top, with a lip at the floor line
  for (let y = 0; y < WALL_BOTTOM; y++) {
    const row = Math.floor(y / 12), off = row % 2 ? 12 : 0;
    for (let x = 0; x < W; x++) {
      const bx = Math.floor((x + off) / 24), by = row, inX = (x + off) % 24, inY = y % 12;
      const n = rand(bx, by, seed), grain = noise2(x * 0.3, y * 0.3, seed) * 0.5 + 0.5;
      let c = base[1 + (n > 0.7 ? 1 : 0)];
      if (inY === 0 || inX === 0) c = darkest;
      else if (inY === 1 || inX === 1) c = mix(c, base[3], 0.35);
      else if (inY === 11 || inX === 23) c = mix(c, darkest, 0.5);
      if (grain > 0.82 && inX > 2 && inY > 2) c = mix(c, base[0], 0.5);
      const fade = Math.min(1, y / WALL_BOTTOM);
      c = mix(darkest, c, 0.35 + 0.65 * fade);
      put(x, y, c);
    }
  }
  // the lip where wall meets floor
  for (let x = 0; x < W; x++) {
    put(x, WALL_BOTTOM, base[3]); put(x, WALL_BOTTOM + 1, mix(base[3], base[2], 0.5));
    for (let y = WALL_BOTTOM + 2; y < WALL_BOTTOM + 6; y++) put(x, y, darkest);
  }
  // floor: perspective-ish tiles that widen toward the camera
  for (let y = WALL_BOTTOM + 6; y < H; y++) {
    const t = (y - WALL_BOTTOM) / (H - WALL_BOTTOM);
    const th = 8 + Math.floor(t * 6), rowY = Math.floor((y - WALL_BOTTOM - 6) / 10), inY = (y - WALL_BOTTOM - 6) % 10;
    const tw = 22 + Math.floor(t * 10), off = rowY % 2 ? tw / 2 : 0;
    for (let x = 0; x < W; x++) {
      const cx = x - W / 2, px = cx * (1 + t * 0.15) + W / 2 + off;
      const bx = Math.floor(px / tw), inX = ((px % tw) + tw) % tw;
      const n = rand(bx, rowY, seed + 5);
      let c = n > 0.85 ? base[3] : n > 0.4 ? base[2] : base[1];
      if (inY === 0 || inX < 1) c = mix(base[0], darkest, 0.4);
      else if (inY === 1) c = mix(c, base[3], 0.4);
      const g = fbm(x * 0.06, y * 0.12, seed) ;
      if (g > 0.62) c = mix(c, base[0], 0.35);
      // a warm/cool cast of the theme accent near the middle
      const glow = Math.max(0, 1 - Math.hypot((x - W / 2) / 260, (y - 200) / 90));
      c = mix(c, acc, 0.06 * glow);
      // darker edges (vignette)
      const edge = Math.min(x, W - 1 - x);
      if (edge < 24) c = mix(c, darkest, (1 - edge / 24) * 0.5);
      put(x, y, c);
    }
  }
  // cracks and theme details on the floor
  for (let i = 0; i < 18; i++) {
    let x = Math.floor(rand(i, seed, 3) * W), y = WALL_BOTTOM + 12 + Math.floor(rand(i, seed, 4) * (H - WALL_BOTTOM - 16));
    for (let j = 0; j < 8; j++) { put(x, y, darkest); x += Math.round(rand(i, j, seed) * 2 - 1) + 1; y += Math.round(rand(j, i, seed) * 2 - 1); }
  }
  if (theme === "earth") for (let i = 0; i < 10; i++) {
    // crystals sticking out of the wall
    const x = 20 + Math.floor(rand(i, seed, 9) * (W - 40)), y = 70 + Math.floor(rand(i, seed, 8) * 50), h = 6 + Math.floor(rand(i, 7, seed) * 8);
    for (let k = 0; k < h; k++) for (let w = -Math.floor((h - k) / 3); w <= Math.floor((h - k) / 3); w++) put(x + w, y - k, w < 0 ? hex("#ffe08a") : w === 0 ? hex("#ffffff") : hex("#c48412"));
  }
  if (theme === "water") for (let x = 0; x < W; x++) {
    // a channel of icy water along the back
    for (let y = WALL_BOTTOM + 6; y < WALL_BOTTOM + 14; y++) {
      const ph = noise2(x * 0.15, y * 0.5, seed);
      put(x, y, mix(hex("#14508c"), hex("#58b4ec"), ph > 0.3 ? 0.6 : 0.2));
    }
    put(x, WALL_BOTTOM + 14, hex("#c4ecff"));
  }
  return buf;
}

/** Live decorations for a theme: effect spawns { id, x, y, ramp, opts }. */
export function roomDecor(theme) {
  const out = [];
  const torch = theme === "water" ? "fire/candle" : "fire/torch";
  const wallY = 96;
  switch (theme) {
    case "fire":
      for (const x of [70, 410]) out.push({ id: "fire/brazier", x, y: WALL_BOTTOM + 4, light: 0.7, bottom: true });
      for (const x of [160, 320]) out.push({ id: "fire/torch", x, y: wallY, light: 0.6, bottom: true });
      break;
    case "water":
      for (const x of [110, 370]) out.push({ id: "water/waterfall", x, y: WALL_BOTTOM + 8, light: 0.5, bottom: true });
      out.push({ id: "weather/snow", x: 240, y: 300, light: 0.4, top: true });
      break;
    case "wind":
      for (const x of [90, 390]) out.push({ id: "lightning/tesla-coil", x, y: WALL_BOTTOM + 4, light: 0.5, bottom: true, ramp: ELEMENTS.wind.storm });
      break;
    case "earth":
      for (const x of [80, 240, 400]) out.push({ id: "fire/torch", x, y: wallY, light: 0.6, bottom: true });
      break;
  }
  return out;
}

export const DECOR_IDS = ["fire/brazier", "fire/torch", "fire/candle", "weather/fog", "water/waterfall", "weather/snow", "lightning/tesla-coil", "weather/falling-leaves", "weather/fireflies"];
