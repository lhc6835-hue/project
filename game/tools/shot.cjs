// usage: node tools/shot.cjs <url-path> <out.png> [w h] [waitMs] [evalJS]
const { chromium } = require("playwright");
(async () => {
  const [path, out, w = 960, h = 320, wait = 300, js] = process.argv.slice(2);
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: +w, height: +h } });
  pg.on("console", (m) => console.log("console:", m.text())); pg.on("pageerror", (e) => console.log("ERR:", e.message));
  await pg.goto("http://localhost:8123/" + path); await pg.waitForTimeout(+wait);
  if (js) { await pg.evaluate(js); await pg.waitForTimeout(+wait); }
  await pg.screenshot({ path: out }); await b.close();
})();
