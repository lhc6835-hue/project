import { createFrame, clearFrame, createFx, composite } from "../src/vendor/pixelfx/core/index.js";
import * as fx from "../src/vendor/pixelfx/fx/fire/fireball.js";
const f = createFrame(64, 64); const out = new Uint8ClampedArray(64*64*4);
const e = createFx(fx, { x: 32, y: 32 }); e.update(0.3); clearFrame(f); e.draw(f, "front"); composite(f, out, null);
let n = 0; for (let i = 3; i < out.length; i += 4) if (out[i]) n++; console.log("lit pixels", n);
