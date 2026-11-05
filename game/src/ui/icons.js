// Render spirits (and the hero) to small images for the HTML UI.
import { createFrame, composite, painterFor } from "../px.js";
import { drawSpirit } from "../game/spirit_art.js";

const cache = new Map();

export function spiritIcon(id, stage = 1, size = 40, t = 0.6) {
  const key = id + stage + size;
  if (cache.has(key)) return cache.get(key);
  const f = createFrame(size, size), p = painterFor(f);
  drawSpirit(p, size / 2, size / 2 + (stage === 1 ? 2 : stage === 2 ? 3 : 4), { id, stage, t, blink: false });
  const c = document.createElement("canvas"); c.width = size; c.height = size;
  const ctx = c.getContext("2d"), img = ctx.createImageData(size, size);
  composite(f, img.data, null);
  ctx.putImageData(img, 0, 0);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

export const iconImg = (id, stage, size = 40, cls = "sp-ic") => `<img class="${cls}" src="${spiritIcon(id, stage, size)}" width="${size}" height="${size}" alt="">`;
