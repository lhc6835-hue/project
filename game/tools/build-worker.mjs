// Pack the game into one Worker module that serves every file from memory.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, extname } from "node:path";
const root = process.argv[2], out = process.argv[3];
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".woff2": "font/woff2", ".md": "text/plain; charset=utf-8" };
const files = {};
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (TYPES[extname(n)]) files["/" + relative(root, p)] = [TYPES[extname(n)], readFileSync(p).toString("base64")]; } };
walk(root);
const src = `const FILES = ${JSON.stringify(files)};
const cache = new Map();
export default { async fetch(req) {
  let path = new URL(req.url).pathname; if (path === "/") path = "/index.html";
  const f = FILES[path]; if (!f) return new Response("not found", { status: 404 });
  let body = cache.get(path); if (!body) { body = Uint8Array.from(atob(f[1]), (c) => c.charCodeAt(0)); cache.set(path, body); }
  return new Response(body, { headers: { "content-type": f[0], "cache-control": path.endsWith(".woff2") ? "public, max-age=604800" : "public, max-age=300" } });
} };`;
writeFileSync(out, src); console.log(Object.keys(files).length, "files", (src.length / 1e6).toFixed(2), "MB");
