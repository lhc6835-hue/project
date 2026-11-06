// Render the app icon (the beating core gem on a night tile) to PNGs.
import { writeFileSync } from "node:fs";
import { createFrame, composite, painterFor, hex, mix } from "../src/vendor/pixelfx/core/index.js";
import { drawGem } from "../src/game/logo.js";
import { png } from "./png.mjs";
const N = 48, f = createFrame(N, N), p = painterFor(f);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot(x - N / 2, y - N / 2) / (N * 0.7); f.color[y * N + x] = mix(hex("#2b1a48"), hex("#07060d"), Math.min(1, d)); }
for (let i = 0; i < 14; i++) { const x = (i * 17) % N, y = (i * 29) % N; f.color[y * N + x] = hex(i % 3 ? "#8f84d8" : "#ffffff"); }
drawGem(p, N / 2, N / 2, 1.0, 13);
const img = new Uint8ClampedArray(N * N * 4); composite(f, img, null);
for (const S of [192, 512]) {
  const k = S / N, out = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const si = (((y / k) | 0) * N + ((x / k) | 0)) * 4, di = (y * S + x) * 4; out[di] = img[si]; out[di + 1] = img[si + 1]; out[di + 2] = img[si + 2]; out[di + 3] = 255; }
  writeFileSync(`assets/icons/icon-${S}.png`, png(S, S, out));
}
console.log("icons ok");
