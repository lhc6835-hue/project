// node tools/play.cjs "<query>" <outprefix> "<script>"  script: comma list of  wait:ms | down:Key | up:Key | press:Key | shot:name | eval:js
const { chromium } = require("playwright");
(async () => {
  const [q, out, script, w = 960, h = 540] = process.argv.slice(2);
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: +w, height: +h } });
  const errs = [];
  pg.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("console:", m.text()); });
  pg.on("pageerror", (e) => { console.log("ERR:", e.message, e.stack?.split("\n")[1]); errs.push(e); });
  await pg.goto("http://localhost:8123/index.html?" + q); await pg.waitForTimeout(1500);
  for (const step of script.split(",")) {
    const i = step.indexOf(":"), k = step.slice(0, i), v = step.slice(i + 1);
    if (k === "wait") await pg.waitForTimeout(+v);
    else if (k === "down") await pg.keyboard.down(v);
    else if (k === "up") await pg.keyboard.up(v);
    else if (k === "press") await pg.keyboard.press(v);
    else if (k === "shot") await pg.screenshot({ path: `${out}-${v}.png` });
    else if (k === "eval") console.log("eval:", await pg.evaluate(v));
    else if (k === "click") await pg.click(v);
    else if (k === "seed") { const data = require("fs").readFileSync(v.split("@")[0], "utf8"); await pg.evaluate((d) => localStorage.setItem("aether-heart-save-v1", d), data); await pg.goto("http://localhost:8123/index.html?" + (v.split("@")[1] || "")); await pg.waitForTimeout(1800); }
  }
  await b.close();
})();
