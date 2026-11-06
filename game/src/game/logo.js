// The title logo: hand-made chunky glyphs, a 3D extrusion, four-element colour bands that flow through the
// letters, a bevel, a shine that sweeps across, twinkles on the edges and a beating core gem.
import { hex, mix } from "../px.js";

const G = {
  A: ["...#...", "..###..", ".##.##.", "##...##", "##...##", "#######", "##...##", "##...##", "##...##"],
  E: ["#######", "##.....", "##.....", "##.....", "######.", "##.....", "##.....", "##.....", "#######"],
  T: ["#######", "#######", "..###..", "..###..", "..###..", "..###..", "..###..", "..###..", "..###.."],
  H: ["##...##", "##...##", "##...##", "##...##", "#######", "##...##", "##...##", "##...##", "##...##"],
  R: ["######.", "##...##", "##...##", "##...##", "######.", "##.##..", "##..##.", "##...##", "##...##"],
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const BANDS = [
  ["#8c1d1c", "#cc3a1a", "#f2701f", "#ffae35", "#ffe27a"],
  ["#14508c", "#1c76bc", "#36a2e0", "#78ccf4", "#c4ecff"],
  ["#13584e", "#1f8a6c", "#36bf8e", "#6fe3b4", "#c2ffe2"],
  ["#69492a", "#8e6638", "#b88a52", "#e0b878", "#fff0c8"],
].map((r) => r.map(hex));

export class Logo {
  constructor(lines = ["AETHER", "HEART"], s = 4, gap = 4) {
    this.s = s;
    this.letters = [];
    let y = 0, maxW = 0;
    for (const line of lines) {
      const w = line.length * 7 * s + (line.length - 1) * gap;
      maxW = Math.max(maxW, w);
      this.letters.push(...[...line].map((ch, i) => ({ ch, line: this.letters.length, x: i * (7 * s + gap), y, lineW: w })));
      y += 9 * s + 6;
    }
    this.w = maxW; this.h = y - 6;
    for (const L of this.letters) L.x += (maxW - L.lineW) / 2;
    this.letters.forEach((L, i) => { L.i = i; L.delay = 0.25 + i * 0.09; });
  }

  /** Each letter's drop: returns y offset and landed flag at time t. */
  drop(L, t) {
    const u = (t - L.delay) / 0.45;
    if (u <= 0) return { dy: -200, a: 0 };
    if (u >= 1) return { dy: 0, a: 1, landed: true };
    // fall with a little bounce
    const e = u < 0.7 ? (u / 0.7) ** 2 : 1 - Math.sin(((u - 0.7) / 0.3) * Math.PI) * 0.12;
    return { dy: -(1 - e) * 120, a: 1 };
  }

  draw(p, ox, oy, t) {
    const s = this.s;
    const ink = hex("#0b0a10"), ext = [hex("#2a1450"), hex("#1c0e36"), hex("#140a26"), hex("#0d0718")];
    const sweep = (t % 3.2) / 3.2 * (this.w + 160) - 80;
    for (const L of this.letters) {
      const { dy, a } = this.drop(L, t);
      if (!a) continue;
      const g = G[L.ch];
      const lx = Math.round(ox + L.x), ly = Math.round(oy + L.y + dy);
      const filled = (gx, gy) => gy >= 0 && gy < 9 && gx >= 0 && gx < 7 && g[gy][gx] === "#";
      const cell = (px, py) => filled(Math.floor(px / s), Math.floor(py / s));
      const W = 7 * s, H = 9 * s;
      // the letter's shape never changes: work out its extrusion, outline and bevel once
      if (!L.shape) {
        const ex = [], ol = [], fill = [];
        for (let d = 5; d >= 1; d--) for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) if (cell(px, py)) ex.push(px + Math.ceil(d / 2), py + d, Math.min(3, d - 1));
        for (let py = -2; py < H + 2; py++) for (let px = -2; px < W + 2; px++) {
          if (cell(px, py)) continue;
          let near = false;
          for (let j = -2; j <= 2 && !near; j++) for (let i = -2; i <= 2; i++) if (Math.abs(i) + Math.abs(j) <= 2 && cell(px + i, py + j)) { near = true; break; }
          if (near) ol.push(px, py);
        }
        for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
          if (!cell(px, py)) continue;
          const top = !cell(px, py - 1) || !cell(px, py - 2), left = !cell(px - 1, py);
          const bottom = !cell(px, py + 1) || !cell(px, py + 2), right = !cell(px + 1, py);
          let k = 3 - Math.floor((py / H) * 2.6);
          if (top) k = 4; else if (left) k = Math.min(4, k + 1);
          if (bottom) k = 0; else if (right) k = Math.max(0, k - 1);
          fill.push(px, py, Math.max(0, Math.min(4, k)));
        }
        L.shape = { ex, ol, fill };
      }
      const SH = L.shape;
      for (let i = 0; i < SH.ex.length; i += 3) p.put(lx + SH.ex[i], ly + SH.ex[i + 1], ext[SH.ex[i + 2]]);
      for (let i = 0; i < SH.ol.length; i += 2) p.put(lx + SH.ol[i], ly + SH.ol[i + 1], ink);
      // fill: element bands flowing sideways, bevelled, with a shine
      for (let n = 0; n < SH.fill.length; n += 3) {
        const px = SH.fill[n], py = SH.fill[n + 1], k = SH.fill[n + 2];
        const X = lx + px, Y = ly + py;
        const ph = ((X - ox) * 0.012 - t * 0.22 + (Y - oy) * 0.004) % 1, phw = (ph + 1) % 1;
        const bi = Math.floor(phw * 4), bf = phw * 4 - bi;
        const A = BANDS[bi], B = BANDS[(bi + 1) % 4];
        const useB = bf > 0.75 && (bf - 0.75) * 4 > BAYER[((Y & 3) << 2) | (X & 3)];
        const R = useB ? B : A;
        let c = R[k];
        // shine sweep (a diagonal band)
        const sd = (X - ox) + (Y - oy) * 0.6 - sweep;
        if (sd > 0 && sd < 7) c = sd < 3 ? hex("#ffffff") : mix(c, hex("#ffffff"), 0.55);
        p.put(X, Y, c);
        if (k >= 4) p.add(X, Y, R[3], 0.18);
      }
      // twinkles: little four-point stars on corners
      const tw = Math.sin(t * 2.3 + L.i * 1.9);
      if (tw > 0.85 && a) {
        const sx = lx + (L.i % 2 ? W - 2 : 2), sy = ly + (L.i % 3 ? 2 : H - 3), k = (tw - 0.85) / 0.15;
        const wc = hex("#ffffff");
        p.put(sx, sy, wc); for (let r = 1; r <= Math.round(1 + k * 3); r++) { p.put(sx + r, sy, wc, 1 - r / 5); p.put(sx - r, sy, wc, 1 - r / 5); p.put(sx, sy + r, wc, 1 - r / 5); p.put(sx, sy - r, wc, 1 - r / 5); }
        for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) { const d = i * i + j * j; if (d < 25) p.add(sx + i, sy + j, wc, 0.25 * k * (1 - d / 25)); }
      }
    }
  }

  /** Centre of a letter (for attaching things like the core gem). */
  center(i, ox, oy, t) {
    const L = this.letters[i], { dy } = this.drop(L, t);
    return [ox + L.x + 3.5 * this.s, oy + L.y + dy + 4.5 * this.s];
  }
}

/** The core gem: a faceted diamond that beats, cycling the element colours. */
export function drawGem(p, x, y, t, size = 7) {
  const beat = 1 + Math.max(0, Math.sin(t * 5)) ** 8 * 0.25, r = size * beat;
  const bi = Math.floor((t * 0.5) % 4), R = BANDS[bi], ink = hex("#0b0a10");
  for (let j = -Math.ceil(r) - 1; j <= Math.ceil(r) + 1; j++) for (let i = -Math.ceil(r) - 1; i <= Math.ceil(r) + 1; i++) {
    const d = Math.abs(i) + Math.abs(j) * 0.8;
    const X = Math.round(x + i), Y = Math.round(y + j);
    if (d > r + 1) continue;
    if (d > r) { p.put(X, Y, ink); continue; }
    let k = i < 0 && j < 0 ? 4 : i >= 0 && j < 0 ? 3 : i < 0 ? 2 : 1;
    if (Math.abs(i) < 1 || Math.abs(j) < 0.7) k = Math.min(4, k + 1);
    p.put(X, Y, R[k]);
  }
  p.put(Math.round(x - r * 0.35), Math.round(y - r * 0.35), hex("#ffffff"));
  const gr = r * 3.2;
  for (let j = -gr; j <= gr; j++) for (let i = -gr; i <= gr; i++) { const d = (i * i + j * j) / (gr * gr); if (d < 1) p.add(Math.round(x + i), Math.round(y + j), R[3], 0.16 * (1 - d) * beat); }
}
