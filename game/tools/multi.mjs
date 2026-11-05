// node tools/multi.mjs <out.png> <times> id1 id2 ... (each row one fx, cells cropped to 200x140 around origin)
import { writeFileSync } from "node:fs";
import { createFrame, clearFrame, createFx, composite, hex } from "../src/vendor/pixelfx/core/index.js";
import { png } from "./png.mjs";
const [out, times, ...ids] = process.argv.slice(2); const ts = times.split(",").map(Number);
const CW = 220, CH = 150, W = CW * ts.length, H = CH * ids.length, img = new Uint8ClampedArray(W * H * 4);
for (let r = 0; r < ids.length; r++) {
  const [id, o] = ids[r].split("@"); const mod = await import(`../src/vendor/pixelfx/fx/${id}.js`);
  const fx = createFx(mod, { x: 70, y: 130, ...(o ? JSON.parse(o) : {}) }); let t = 0; const f = createFrame(CW, CH), buf = new Uint8ClampedArray(CW * CH * 4);
  ts.forEach((tt, k) => {
    while (t < tt - 1e-6) { const d = Math.min(1 / 60, tt - t); fx.update(d); t += d; }
    clearFrame(f); fx.draw(f, "back"); fx.draw(f, "front"); composite(f, buf, hex(r % 2 ? "#24202e" : "#1c1926"));
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const si = (y * CW + x) * 4, di = ((r * CH + y) * W + k * CW + x) * 4; img[di] = buf[si]; img[di+1] = buf[si+1]; img[di+2] = buf[si+2]; img[di+3] = 255; }
    const di = ((r * CH + 130) * W + k * CW + 70) * 4; img[di] = 255; img[di + 1] = 0; img[di + 2] = 255;
  });
}
writeFileSync(out, png(W, H, img));
