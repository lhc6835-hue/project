// node tools/sheet.mjs <fx id> <out.png> [times comma] [optsJSON] [scale]
import { writeFileSync } from "node:fs";
import { createFrame, clearFrame, createFx, composite, hex } from "../src/vendor/pixelfx/core/index.js";
import { png } from "./png.mjs";
const [id, out, times = "0,0.1,0.2,0.3,0.5,0.8,1.2,2", opts = "{}", sc = "2"] = process.argv.slice(2);
const mod = await import(`../src/vendor/pixelfx/fx/${id}.js`); const m = mod.meta; const [w, h] = m.size; const ts = times.split(",").map(Number);
const S = +sc, cols = Math.min(ts.length, 4), rows = Math.ceil(ts.length / cols), W = w * cols * S, H = (h + 8) * rows * S;
const out8 = new Uint8ClampedArray(W * H * 4);
const fx = createFx(mod, { x: m.origin[0], y: m.origin[1], ...JSON.parse(opts) }); let t = 0;
const f = createFrame(w, h), buf = new Uint8ClampedArray(w * h * 4);
ts.forEach((tt, k) => {
  while (t < tt - 1e-6) { const d = Math.min(1 / 60, tt - t); fx.update(d); t += d; }
  clearFrame(f); fx.draw(f, "back"); fx.draw(f, "front"); composite(f, buf, hex("#24202e"));
  // feet marker
  const oi = (m.origin[1] * w + m.origin[0]) * 4; buf[oi] = 255; buf[oi + 1] = 0; buf[oi + 2] = 255;
  const cx = (k % cols) * w * S, cy = Math.floor(k / cols) * (h + 8) * S;
  for (let y = 0; y < h * S; y++) for (let x = 0; x < w * S; x++) { const si = (((y / S) | 0) * w + ((x / S) | 0)) * 4, di = ((cy + y) * W + cx + x) * 4; out8[di] = buf[si]; out8[di + 1] = buf[si + 1]; out8[di + 2] = buf[si + 2]; out8[di + 3] = 255; }
});
writeFileSync(out, png(W, H, out8)); console.log(id, m.size, "dur", m.duration, "times", ts.join(" "));
