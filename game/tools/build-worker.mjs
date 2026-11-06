// Pack the game's static files into the server worker (server/worker.template.js) as one module.
// node tools/build-worker.mjs <static root> <out.js>
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = process.argv[2], out = process.argv[3];
const here = dirname(fileURLToPath(import.meta.url));
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".woff2": "font/woff2", ".md": "text/plain; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const files = {};
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (TYPES[extname(n)]) files["/" + relative(root, p)] = [TYPES[extname(n)], readFileSync(p).toString("base64")]; } };
walk(root);
const tpl = readFileSync(join(here, "../server/worker.template.js"), "utf8");
const src = tpl.replace("__FILES__", () => JSON.stringify(files));
writeFileSync(out, src);
console.log(Object.keys(files).length, "files", (src.length / 1e6).toFixed(2), "MB");
