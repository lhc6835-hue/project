// Dungeon maps: each paints its own back wall, floor and props once, adds live decorations, and may carry a
// hazard that changes how the floor plays (lava pools, poison, whirlpools, gusts, grasping hands, lasers).
import { hex, mix, scale, noise2, rand, fbm } from "../px.js";
import { W, H } from "../core/screen.js";
import { ELEMENTS } from "../data/elements.js";

export const ARENA = { x0: 18, x1: 462, y0: 140, y1: 258 };
const WB = 128; // where the wall meets the floor
const P = (list) => list.map(hex);

export const MAPS = {
  ember: { name: "붉은 동굴", el: "fire", wall: "bricks", floor: "tiles", pal: { wall: P(["#1a0d10", "#24121a", "#2f1820", "#3d1f24"]), floor: P(["#1a0d10", "#24121a", "#2f1820", "#3d1f24"]), accent: hex("#ff6a2a") },
    pool: ["slime", "skull", "bat", "imp", "knight", "wisp", "brute", "archer"], decor: [["fire/brazier", 70, WB + 4, 0.7], ["fire/brazier", 410, WB + 4, 0.7], ["fire/torch", 160, 96, 0.6], ["fire/torch", 320, 96, 0.6]] },
  forge: { name: "화산 대장간", el: "fire", wall: "rock", floor: "basalt", pal: { wall: P(["#120a0a", "#1e1010", "#2c1614", "#3c201a"]), floor: P(["#100a0c", "#1a1014", "#26161a", "#342020"]), accent: hex("#ff5a1a") }, props: "forge",
    pool: ["imp", "golemling", "skull", "mage", "shield", "wisp", "brute"], hazard: { kind: "lava", n: 3 }, decor: [["fire/campfire", 110, WB + 2, 0.6], ["fire/campfire", 370, WB + 2, 0.6]] },
  canal: { name: "빙결 수로", el: "water", wall: "bricks", floor: "tiles", pal: { wall: P(["#0a1220", "#0f1a2e", "#14223a", "#1a2c48"]), floor: P(["#0a1220", "#0f1a2e", "#14223a", "#1a2c48"]), accent: hex("#58b4ec") }, props: "canal",
    pool: ["slime", "ghost", "eye", "knight", "frog", "jelly", "shield", "archer"], decor: [["water/waterfall", 110, WB + 8, 0.5], ["water/waterfall", 370, WB + 8, 0.5], ["weather/snow", 240, 300, 0.4, "top"]] },
  abyss: { name: "심해 신전", el: "water", wall: "temple", floor: "sand", pal: { wall: P(["#061418", "#0a2026", "#0e2e34", "#143c44"]), floor: P(["#0c1c22", "#12282e", "#1a343a", "#244448"]), accent: hex("#4ce8d8") }, props: "abyss",
    pool: ["jelly", "frog", "snake", "eye", "mage", "ghost", "spider"], hazard: { kind: "whirl", n: 2 }, decor: [["water/bubbles", 90, WB + 6, 0.5], ["water/bubbles", 390, WB + 6, 0.5], ["weather/god-rays", 240, 128, 0.35]] },
  spire: { name: "폭풍 첨탑", el: "wind", wall: "bricks", floor: "tiles", pal: { wall: P(["#0c1418", "#111c20", "#16252a", "#1d3036"]), floor: P(["#0c1418", "#111c20", "#16252a", "#1d3036"]), accent: hex("#6fe3b4") },
    pool: ["bat", "wisp", "ghost", "knight", "eye", "assassin", "archer", "brute"], decor: [["lightning/tesla-coil", 90, WB + 4, 0.5, null, "storm"], ["lightning/tesla-coil", 390, WB + 4, 0.5, null, "storm"]] },
  sky: { name: "구름 정원", el: "wind", wall: "sky", floor: "marble", pal: { wall: P(["#3a5a8a", "#5a80b4", "#84a8d8", "#b8d4f0"]), floor: P(["#5a6478", "#727c92", "#8c96aa", "#a8b0c2"]), accent: hex("#c2ffe2") }, props: "sky",
    pool: ["bird", "butterfly", "wisp", "archer", "assassin", "bat", "turret"], hazard: { kind: "gust" }, decor: [["weather/clouds", 120, 90, 0.4, null, "cloud"], ["weather/clouds", 360, 70, 0.4, null, "cloud"], ["weather/falling-leaves", 240, 300, 0.35, "top", "leaf"]] },
  mine: { name: "수정 광산", el: "earth", wall: "bricks", floor: "tiles", pal: { wall: P(["#14100e", "#1c1612", "#251d17", "#30261d"]), floor: P(["#14100e", "#1c1612", "#251d17", "#30261d"]), accent: hex("#e8b05a") }, props: "crystals",
    pool: ["slime", "knight", "skull", "brute", "golemling", "spider", "shield", "mimic"], decor: [["fire/torch", 80, 96, 0.6], ["fire/torch", 240, 96, 0.6], ["fire/torch", 400, 96, 0.6]] },
  shroom: { name: "버섯 숲", el: "earth", wall: "forest", floor: "grass", pal: { wall: P(["#0a120c", "#101c12", "#16281a", "#1e3422"]), floor: P(["#101c12", "#162818", "#1e3620", "#2a462a"]), accent: hex("#b4e070") }, props: "shroom",
    pool: ["frog", "snake", "butterfly", "spider", "golemling", "wolf", "slime"], hazard: { kind: "poison", n: 3 }, decor: [["weather/fireflies", 240, 200, 0.5, "bottom"]] },
  cathedral: { name: "성광 회랑", el: "light", wall: "marble", floor: "checker", pal: { wall: P(["#4a4458", "#6a6478", "#8c86a0", "#b4aec8"]), floor: P(["#2c2838", "#4a4458", "#8c86a0", "#b4aec8"]), accent: hex("#ffe08a") }, props: "cathedral",
    pool: ["knight", "shield", "archer", "mage", "butterfly", "turret", "wisp"], decor: [["weather/god-rays", 140, 128, 0.5], ["weather/god-rays", 340, 128, 0.5], ["fire/candle", 70, WB + 2, 0.5], ["fire/candle", 410, WB + 2, 0.5]] },
  graveyard: { name: "망령 묘지", el: "dark", wall: "night", floor: "dirt", pal: { wall: P(["#06050c", "#0c0a18", "#141026", "#1e1838"]), floor: P(["#100e14", "#18141c", "#221c26", "#2c2430"]), accent: hex("#b884ff") }, props: "graves",
    pool: ["skeleton", "ghost", "bat", "wolf", "assassin", "skull", "mimic"], hazard: { kind: "hands" }, decor: [["critters/wisp", 120, 150, 0.5, null, "ghost"], ["critters/wisp", 360, 160, 0.5, null, "ghost"]] },
  library: { name: "고대 도서관", el: "light", wall: "shelves", floor: "planks", pal: { wall: P(["#160e0a", "#22160e", "#2e1e14", "#3e2a1c"]), floor: P(["#1e140c", "#2a1c12", "#382618", "#48321e"]), accent: hex("#c684ff") }, props: "library",
    pool: ["mage", "eye", "ghost", "mimic", "skull", "turret", "imp"], decor: [["fire/candle", 120, 90, 0.5], ["fire/candle", 360, 90, 0.5], ["arcane/rune-circle", 240, 200, 0.35, "bottom"]] },
  ruins: { name: "기계 유적", el: "code", wall: "metal", floor: "grate", pal: { wall: P(["#0a0e14", "#121820", "#1a222e", "#24303e"]), floor: P(["#0c1016", "#141a22", "#1e2630", "#2a3440"]), accent: hex("#4ce8d8") }, props: "ruins",
    pool: ["turret", "golemling", "spider", "assassin", "shield", "archer", "wisp"], hazard: { kind: "laser" }, decor: [["scifi/hologram", 110, WB + 2, 0.5], ["scifi/energy-core", 370, WB + 2, 0.5]] },
  sanctum: { name: "공허의 성소", el: "dark", wall: "void", floor: "stars", pal: { wall: P(["#05030a", "#0c0818", "#140e26", "#1e1438"]), floor: P(["#08060e", "#100c1a", "#181226", "#221a34"]), accent: hex("#b884ff") }, props: "void", boss: true,
    pool: ["wisp"], decor: [["arcane/portal", 90, WB + 6, 0.5], ["arcane/portal", 390, WB + 6, 0.5]] },
};

export const NORMAL_MAPS = Object.keys(MAPS).filter((k) => !MAPS[k].boss);

// ------------------------------------------------------------------ painting
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x, y) => BAYER[((y & 3) << 2) | (x & 3)] / 16;

export function paintRoom(id, seed = 1) {
  const M = MAPS[id] ?? MAPS.ember, buf = new Uint32Array(W * H);
  const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = c; };
  const get = (x, y) => buf[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))];
  const Wp = M.pal.wall, Fp = M.pal.floor, A = M.accent ?? M.pal.accent, dk = scale(Wp[0], 0.6);
  WALLS[M.wall](put, Wp, seed, A);
  // the lip where wall meets floor
  for (let x = 0; x < W; x++) { put(x, WB, Wp[3]); put(x, WB + 1, mix(Wp[3], Wp[2], 0.5)); for (let y = WB + 2; y < WB + 6; y++) put(x, y, dk); }
  FLOORS[M.floor](put, Fp, seed, M.pal.accent);
  // vignette at the sides and a soft accent glow in the middle of the floor
  for (let y = WB + 6; y < H; y++) for (let x = 0; x < W; x++) {
    let c = get(x, y);
    const glow = Math.max(0, 1 - Math.hypot((x - W / 2) / 260, (y - 200) / 90));
    c = mix(c, M.pal.accent, 0.05 * glow);
    const edge = Math.min(x, W - 1 - x);
    if (edge < 24) c = mix(c, scale(Fp[0], 0.6), (1 - edge / 24) * 0.5);
    buf[y * W + x] = c;
  }
  if (M.props) PROPS[M.props](put, seed, M, get);
  return buf;
}

const WALLS = {
  bricks(put, p, seed) {
    const dk = scale(p[0], 0.6);
    for (let y = 0; y < WB; y++) { const row = Math.floor(y / 12), off = row % 2 ? 12 : 0; for (let x = 0; x < W; x++) {
      const bx = Math.floor((x + off) / 24), inX = (x + off) % 24, inY = y % 12, n = rand(bx, row, seed), grain = noise2(x * 0.3, y * 0.3, seed) * 0.5 + 0.5;
      let c = p[1 + (n > 0.7 ? 1 : 0)];
      if (inY === 0 || inX === 0) c = dk; else if (inY === 1 || inX === 1) c = mix(c, p[3], 0.35); else if (inY === 11 || inX === 23) c = mix(c, dk, 0.5);
      if (grain > 0.82 && inX > 2 && inY > 2) c = mix(c, p[0], 0.5);
      put(x, y, mix(dk, c, 0.35 + 0.65 * Math.min(1, y / WB)));
    } }
  },
  rock(put, p, seed, acc) {
    const dk = scale(p[0], 0.6);
    for (let y = 0; y < WB; y++) for (let x = 0; x < W; x++) {
      const n = fbm(x * 0.04, y * 0.06, seed), k = Math.floor(n * 4 + dith(x, y) * 0.8);
      let c = p[Math.max(0, Math.min(3, k))];
      // glowing magma veins
      const v = Math.abs(noise2(x * 0.03, y * 0.08, seed + 9) - 0.5);
      if (v < 0.018) c = mix(c, acc, 0.85); else if (v < 0.035) c = mix(c, acc, 0.3);
      put(x, y, mix(dk, c, 0.3 + 0.7 * Math.min(1, y / WB)));
    }
  },
  temple(put, p, seed, acc) {
    const dk = scale(p[0], 0.5);
    for (let y = 0; y < WB; y++) for (let x = 0; x < W; x++) {
      const col = Math.floor(x / 60), inC = x % 60, n = noise2(x * 0.1, y * 0.1, seed);
      let c = inC < 14 ? p[2 + (inC < 3 ? 1 : 0)] : p[1];               // pillars and the wall between
      if (inC >= 14 && y > 20 && y < 100 && Math.hypot((inC - 37) / 18, (y - 70) / 45) < 1) c = p[0];   // arched alcoves
      if (inC < 14 && (y % 16 === 0)) c = dk;
      if (n > 0.62 && y > 70) c = mix(c, hex("#1a6a4a"), 0.5);            // algae creeping up
      put(x, y, mix(dk, c, 0.3 + 0.7 * Math.min(1, y / WB)));
    }
  },
  sky(put, p, seed) {
    for (let y = 0; y < WB; y++) for (let x = 0; x < W; x++) {
      const v = y / WB, i = Math.min(2, Math.floor(v * 3)), f = v * 3 - i;
      let c = mix(p[i], p[i + 1], f > dith(x, y) ? 0.6 : 0.2);
      const cl = fbm(x * 0.012 + 3, y * 0.05, seed);
      if (cl > 0.6) c = mix(c, hex("#ffffff"), Math.min(0.9, (cl - 0.6) * 5));
      put(x, y, c);
    }
  },
  marble(put, p, seed, acc) {
    for (let y = 0; y < WB; y++) for (let x = 0; x < W; x++) {
      const pan = Math.floor(x / 80), inP = x % 80, vein = Math.abs(noise2(x * 0.05, y * 0.12, seed + pan) - 0.5) < 0.02;
      let c = inP < 10 ? p[3] : p[2];
      if (inP < 10 && inP > 7) c = p[1];
      if (vein) c = p[1];
      if (y > 112 && y < 118) c = mix(acc, p[2], 0.4);                       // gold trim
      put(x, y, mix(p[0], c, 0.45 + 0.55 * Math.min(1, y / WB)));
    }
  },
  shelves(put, p, seed) {
    const books = P(["#6a1a1a", "#1a3a6a", "#2a5a2a", "#6a5a1a", "#4a2a6a", "#7a4a2a", "#2a4a5a"]);
    for (let y = 0; y < WB; y++) for (let x = 0; x < W; x++) {
      const shelf = Math.floor(y / 24), inS = y % 24;
      let c = p[1];
      if (inS < 3) c = p[3]; else if (inS < 4) c = p[0];
      else { const bx = Math.floor((x + shelf * 7) / 4), r = rand(bx, shelf, seed); const h = 14 + Math.floor(r * 6); if (24 - inS < h && r > 0.12) { c = books[Math.floor(r * 7) % 7]; if ((x + shelf * 7) % 4 === 0) c = scale(c, 0.6); if (inS === 24 - h + 2) c = mix(c, hex("#ffd84a"), 0.5); } }
      put(x, y, mix(p[0], c, 0.4 + 0.6 * Math.min(1, y / WB)));
    }
  },
  metal(put, p, seed, acc) {
    for (let y = 0; y < WB; y++) for (let x = 0; x < W; x++) {
      const px = x % 40, py = y % 32;
      let c = p[2];
      if (px === 0 || py === 0) c = p[0]; else if (px === 1 || py === 1) c = p[3];
      if ((px === 4 || px === 35) && (py === 4 || py === 27)) c = p[3];      // rivets
      const tr = Math.abs(noise2(Math.floor(x / 3) * 0.2, Math.floor(y / 3) * 0.2, seed) - 0.5);
      if (tr < 0.03 && px > 3 && py > 3) c = mix(acc, p[2], 0.2);              // glowing circuit traces
      put(x, y, mix(p[0], c, 0.35 + 0.65 * Math.min(1, y / WB)));
    }
  },
  forest(put, p, seed) {
    for (let y = 0; y < WB; y++) for (let x = 0; x < W; x++) {
      let c = mix(p[0], p[1], y / WB);
      for (let i = 0; i < 7; i++) { const tx = 20 + i * 70 + rand(i, seed) * 30, tw = 10 + rand(i, 2, seed) * 10; if (Math.abs(x - tx) < tw) c = Math.abs(x - tx) < tw - 2 ? p[2 + ((x + y) % 5 === 0 ? 1 : 0)] : p[1]; }
      if (fbm(x * 0.03, y * 0.05, seed) > 0.62 && y < 60) c = p[3];         // canopy leaves
      put(x, y, c);
    }
  },
  night(put, p, seed) {
    for (let y = 0; y < WB; y++) for (let x = 0; x < W; x++) {
      let c = mix(p[0], p[2], y / WB);
      if (rand(x, y, seed) > 0.996) c = hex("#c8c0ff");
      if (Math.hypot(x - 380, y - 34) < 14) c = Math.hypot(x - 375, y - 30) < 12 ? p[1] : hex("#e8e0ff");   // the moon (crescent)
      // dead trees and an iron fence
      const ground = 100 + noise2(x * 0.02, 1, seed) * 10;
      if (y > ground) c = p[0];
      if (y > 92 && y < WB && x % 12 < 2) c = hex("#0a0810");
      if (y > 96 && y < 99) c = hex("#0a0810");
      put(x, y, c);
    }
    for (const [tx, h] of [[60, 60], [200, 48], [430, 70]]) for (let k = 0; k < h; k++) { put(tx, 100 - k, hex("#0a0810")); put(tx + 1, 100 - k, hex("#0a0810")); if (k > h * 0.5 && k % 9 === 0) for (let b = 0; b < 10; b++) put(tx + b * (k % 2 ? 1 : -1), 100 - k - b * 0.6, hex("#0a0810")); }
  },
  void(put, p, seed) {
    for (let y = 0; y < WB; y++) for (let x = 0; x < W; x++) {
      let c = mix(p[0], p[1], y / WB);
      const neb = fbm(x * 0.02, y * 0.04, seed);
      if (neb > 0.55) c = mix(c, hex("#3a1f62"), (neb - 0.55) * 2);
      if (rand(x, y, seed) > 0.994) c = hex("#f0dcff");
      put(x, y, c);
    }
  },
};

const FLOORS = {
  tiles(put, p, seed) {
    const dk = scale(p[0], 0.6);
    for (let y = WB + 6; y < H; y++) { const t = (y - WB) / (H - WB), rowY = Math.floor((y - WB - 6) / 10), inY = (y - WB - 6) % 10, tw = 22 + Math.floor(t * 10), off = rowY % 2 ? tw / 2 : 0;
      for (let x = 0; x < W; x++) { const px = (x - W / 2) * (1 + t * 0.15) + W / 2 + off, bx = Math.floor(px / tw), inX = ((px % tw) + tw) % tw, n = rand(bx, rowY, seed + 5);
        let c = n > 0.85 ? p[3] : n > 0.4 ? p[2] : p[1];
        if (inY === 0 || inX < 1) c = mix(p[0], dk, 0.4); else if (inY === 1) c = mix(c, p[3], 0.4);
        if (fbm(x * 0.06, y * 0.12, seed) > 0.62) c = mix(c, p[0], 0.35);
        put(x, y, c); } }
  },
  basalt(put, p, seed, acc) {
    for (let y = WB + 6; y < H; y++) for (let x = 0; x < W; x++) {
      // cells of hard basalt with glowing seams
      const cx = Math.floor(x / 18 + (Math.floor(y / 12) % 2) * 0.5), cy = Math.floor(y / 12);
      const n = rand(cx, cy, seed), inX = (x + (cy % 2) * 9) % 18, inY = y % 12;
      let c = p[1 + Math.floor(n * 2.9)];
      if (inX === 0 || inY === 0) c = rand(cx, cy, 3) > 0.7 ? mix(acc, p[0], 0.4) : p[0];
      put(x, y, c);
    }
  },
  sand(put, p, seed) {
    for (let y = WB + 6; y < H; y++) for (let x = 0; x < W; x++) {
      const rip = S(x * 0.08 + noise2(x * 0.02, y * 0.05, seed) * 6 + y * 0.3);
      let c = p[1 + (rip > 0.6 ? 2 : rip > -0.2 ? 1 : 0)];
      if (rand(x, y, seed) > 0.992) c = hex("#e8e0c8");
      put(x, y, c);
    }
  },
  marble(put, p, seed) {
    for (let y = WB + 6; y < H; y++) for (let x = 0; x < W; x++) {
      const bx = Math.floor(x / 30), by = Math.floor((y - WB) / 14), inX = x % 30, inY = (y - WB) % 14;
      let c = p[2 + (rand(bx, by, seed) > 0.6 ? 1 : 0)];
      if (inX === 0 || inY === 0) c = p[1];
      if (Math.abs(noise2(x * 0.06, y * 0.1, seed) - 0.5) < 0.015) c = p[1];
      if (fbm(x * 0.05, y * 0.1, seed) > 0.66) c = mix(c, hex("#4f9a3a"), 0.6);   // grass in the cracks
      put(x, y, c);
    }
  },
  checker(put, p, seed) {
    for (let y = WB + 6; y < H; y++) { const t = (y - WB) / (H - WB), s = 14 + t * 8; for (let x = 0; x < W; x++) {
      const px = (x - W / 2) * (1 + t * 0.2) + W / 2, odd = (Math.floor(px / s) + Math.floor((y - WB) / (s * 0.6))) & 1;
      let c = odd ? p[3] : p[1];
      if (Math.abs(noise2(x * 0.05, y * 0.1, seed) - 0.5) < 0.012) c = odd ? p[2] : p[0];
      put(x, y, c); } }
  },
  grass(put, p, seed) {
    for (let y = WB + 6; y < H; y++) for (let x = 0; x < W; x++) {
      const n = fbm(x * 0.05, y * 0.09, seed); let k = 1 + Math.round(n * 2.4);
      if (rand(x, y, 9) > 0.93) k++;
      let c = p[Math.max(0, Math.min(3, k))];
      if (rand(x, y, seed) > 0.996) c = [hex("#ff8aa0"), hex("#ffd84a"), hex("#c684ff")][(x + y) % 3];
      put(x, y, c);
    }
  },
  planks(put, p, seed) {
    for (let y = WB + 6; y < H; y++) for (let x = 0; x < W; x++) {
      const row = Math.floor((y - WB) / 9), inY = (y - WB) % 9, len = 60 + rand(row, seed) * 40, off = rand(row, 3, seed) * len, inX = (x + off) % len;
      let c = p[1 + (rand(Math.floor((x + off) / len), row, seed) > 0.5 ? 1 : 0)];
      if (inY === 0) c = p[0]; else if (inY === 1) c = p[3];
      if (inX < 1) c = p[0];
      if (Math.abs(noise2(x * 0.1, y * 0.6, seed) - 0.5) < 0.02) c = mix(c, p[0], 0.5);
      put(x, y, c);
    }
  },
  grate(put, p, seed, acc) {
    for (let y = WB + 6; y < H; y++) for (let x = 0; x < W; x++) {
      const gx = x % 8, gy = (y - WB) % 8;
      let c = gx < 2 || gy < 2 ? p[2] : p[0];
      if (gx === 0 || gy === 0) c = p[3];
      if ((gx > 1 && gy > 1) && rand(Math.floor(x / 8), Math.floor(y / 8), seed) > 0.93) c = mix(acc, p[0], 0.6);   // lights glowing up through the grate
      if (Math.floor(x / 96) % 2 === 0 && Math.abs(y - 200) < 2) c = mix(acc, p[2], 0.5);
      put(x, y, c);
    }
  },
  dirt(put, p, seed) {
    for (let y = WB + 6; y < H; y++) for (let x = 0; x < W; x++) {
      const n = fbm(x * 0.07, y * 0.1, seed);
      let c = p[Math.max(0, Math.min(3, Math.floor(n * 4 + dith(x, y) * 0.6)))];
      if (rand(x, y, seed) > 0.985) c = p[3];
      if (fbm(x * 0.04, y * 0.08, seed + 4) > 0.68) c = mix(c, hex("#2a3a22"), 0.6);
      put(x, y, c);
    }
  },
  stars(put, p, seed) {
    for (let y = WB + 6; y < H; y++) for (let x = 0; x < W; x++) {
      const gx = x % 32, gy = (y - WB) % 18;
      let c = p[1];
      if (gx === 0 || gy === 0) c = p[2];
      const neb = fbm(x * 0.03, y * 0.05, seed);
      if (neb > 0.58) c = mix(c, hex("#3a1f62"), 0.6);
      if (rand(x, y, seed) > 0.993) c = hex("#f0dcff");
      put(x, y, c);
    }
  },
};
const S = Math.sin;

const PROPS = {
  canal(put, seed) {
    for (let x = 0; x < W; x++) { for (let y = WB + 6; y < WB + 14; y++) put(x, y, mix(hex("#14508c"), hex("#58b4ec"), noise2(x * 0.15, y * 0.5, seed) > 0.3 ? 0.6 : 0.2)); put(x, WB + 14, hex("#c4ecff")); }
  },
  crystals(put, seed) {
    for (let i = 0; i < 10; i++) { const x = 20 + Math.floor(rand(i, seed, 9) * (W - 40)), y = 70 + Math.floor(rand(i, seed, 8) * 50), h = 6 + Math.floor(rand(i, 7, seed) * 8);
      for (let k = 0; k < h; k++) for (let w = -Math.floor((h - k) / 3); w <= Math.floor((h - k) / 3); w++) put(x + w, y - k, w < 0 ? hex("#ffe08a") : w === 0 ? hex("#ffffff") : hex("#c48412")); }
  },
  forge(put, seed) {
    // a river of lava along the back of the floor
    for (let x = 0; x < W; x++) for (let y = WB + 6; y < WB + 16; y++) { const n = noise2(x * 0.08, y * 0.4, seed); put(x, y, n > 0.6 ? hex("#ffd25a") : n > 0.35 ? hex("#ff8c2a") : hex("#c43a10")); }
    for (let x = 0; x < W; x++) put(x, WB + 16, hex("#3a1410"));
    // anvils on the wall ledge
    for (const ax of [150, 330]) { for (let y = 0; y < 10; y++) for (let x = -10; x <= 10; x++) { const w = y < 4 ? 10 : y < 7 ? 4 : 7; if (Math.abs(x) <= w) put(ax + x, WB - 10 + y, y === 0 ? hex("#7d7d8c") : hex("#2c2c38")); } }
  },
  abyss(put, seed) {
    for (let i = 0; i < 14; i++) { const x = 10 + Math.floor(rand(i, seed) * (W - 20)), h = 14 + Math.floor(rand(i, 2) * 20); for (let k = 0; k < h; k++) { const sx = Math.round(S(k * 0.4 + i) * 2); put(x + sx, WB - k, k % 3 ? hex("#1a6a4a") : hex("#2a9a5a")); put(x + sx + 1, WB - k, hex("#0e4a34")); } }
    for (let i = 0; i < 12; i++) { const x = Math.floor(rand(i, seed, 5) * W), y = WB + 20 + Math.floor(rand(i, seed, 6) * 110); put(x, y, hex("#ff9aa0")); put(x + 1, y, hex("#ffc8d0")); put(x, y - 1, hex("#ffc8d0")); }
  },
  sky(put, seed) {
    // broken marble pillars standing on the cloud edge
    for (const [px, h] of [[40, 70], [150, 40], [330, 55], [440, 80]]) for (let y = WB - h; y < WB; y++) for (let x = -7; x <= 7; x++) { const top = y < WB - h + 4; if (top && rand(x, y, seed) > 0.6) continue; put(px + x, y, Math.abs(x) > 5 ? hex("#8c96aa") : x % 3 === 0 ? hex("#a8b0c2") : hex("#d8dce8")); }
  },
  shroom(put, seed) {
    for (const [mx, h, r, col] of [[60, 60, 28, "#c42a3a"], [180, 40, 18, "#d8a428"], [300, 70, 32, "#9a48ec"], [430, 50, 24, "#c42a3a"]]) {
      for (let y = WB - h; y < WB; y++) for (let x = -4; x <= 4; x++) put(mx + x, y, Math.abs(x) > 2 ? hex("#b8ad96") : hex("#e4dcc8"));
      for (let y = -r * 0.6; y <= 0; y++) for (let x = -r; x <= r; x++) { if ((x * x) / (r * r) + (y * y) / (r * r * 0.36) > 1) continue; const c = hex(col); put(mx + x, WB - h + y, ((x * 7 + y * 13) & 15) === 0 ? hex("#fff6e8") : y > -2 ? scale(c, 0.6) : x < -r * 0.3 ? mix(c, hex("#ffffff"), 0.25) : c); }
    }
  },
  cathedral(put, seed) {
    const glass = P(["#c42a3a", "#1c76bc", "#ffd84a", "#3ec466", "#9a48ec"]);
    for (const wx of [60, 140, 220, 300, 380]) for (let y = 16; y < 96; y++) for (let x = -14; x <= 14; x++) {
      const arch = y < 32 ? Math.hypot(x, y - 32) <= 14 : true; if (!arch) continue;
      const lead = x % 7 === 0 || y % 10 === 0 || Math.abs(x) === 14;
      put(wx + 30 + x, y, lead ? hex("#2c2838") : glass[(Math.floor((x + 14) / 7) + Math.floor(y / 10) + wx) % 5]);
    }
  },
  graves(put, seed) {
    for (let i = 0; i < 7; i++) { const gx = 30 + i * 66 + Math.floor(rand(i, seed) * 20), gy = WB - 2, h = 14 + Math.floor(rand(i, 3) * 8);
      for (let y = 0; y < h; y++) for (let x = -6; x <= 6; x++) { if (y < 4 && Math.hypot(x, y - 4) > 6) continue; put(gx + x, gy - h + y, x < -4 ? hex("#5a5664") : x > 4 ? hex("#2e2a35") : hex("#433e4b")); }
      for (let y = 4; y < 10; y++) put(gx, gy - h + y, hex("#1d1a22")); for (let x = -2; x <= 2; x++) put(gx + x, gy - h + 6, hex("#1d1a22")); }
  },
  library(put, seed) {
    // a reading table glow and scattered paper on the floor
    for (let i = 0; i < 30; i++) { const x = Math.floor(rand(i, seed) * W), y = WB + 20 + Math.floor(rand(i, seed, 2) * 110); put(x, y, hex("#e8dcc0")); put(x + 1, y, hex("#d8c8a0")); put(x, y + 1, hex("#c8b890")); }
  },
  ruins(put, seed) {
    for (const px of [40, 200, 360]) for (let y = 20; y < WB; y++) for (let x = 0; x < 10; x++) put(px + x, y, x < 2 || x > 7 ? hex("#2a3440") : x === 3 ? hex("#4a5a6a") : hex("#1a222e"));
    for (const sx of [110, 280]) for (let y = 40; y < 80; y++) for (let x = 0; x < 50; x++) put(sx + x, y, x === 0 || y === 40 || x === 49 || y === 79 ? hex("#4a5a6a") : (y % 3 === 0 ? hex("#0c3a3a") : (rand(Math.floor(x / 4), y, seed) > 0.8 ? hex("#4ce8d8") : hex("#062020"))));
  },
  void(put, seed) {
    for (const [ix, iy, r] of [[80, 60, 18], [240, 40, 26], [400, 70, 16]]) for (let y = -r; y <= r * 0.5; y++) for (let x = -r * 1.4; x <= r * 1.4; x++) {
      const top = y < 0 ? (x * x) / (r * r * 2) + (y * y) / (r * r * 0.1) <= 1 : (x * x) / (r * r * 2 * (1 - y / (r * 0.5))) <= 1;
      if (top) put(ix + x, iy + y, y < -1 ? hex("#3a1f62") : hex("#140e26"));
    }
  },
};

/** Live decorations for a map: effect spawns. */
export function roomDecor(id) {
  const M = MAPS[id] ?? MAPS.ember;
  const RAMPS = {
    storm: ELEMENTS.wind.storm,
    cloud: ["#8ca0c8", "#a8b8d8", "#c4d0e8", "#dce4f4", "#eef2fa", "#ffffff", "#ffffff", "#ffffff"],
    leaf: ["#163418", "#225224", "#357530", "#4f9a3a", "#7cc048", "#b4e070", "#e4ffb0", "#ffffff"],
    ghost: ["#140c22", "#261540", "#3a1f62", "#58308c", "#8048b8", "#b884ff", "#f0dcff"],
  };
  return (M.decor ?? []).map(([fx, x, y, light, layer, ramp]) => ({ id: fx, x, y, light, bottom: layer !== "top", top: layer === "top", ramp: RAMPS[ramp] }));
}

export const DECOR_IDS = [...new Set(Object.values(MAPS).flatMap((m) => (m.decor ?? []).map((d) => d[0])))];
