const { chromium, devices } = require("playwright");
(async () => {
  const [q, out] = process.argv.slice(2);
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices["iPhone 13 landscape"] });
  const pg = await ctx.newPage();
  pg.on("pageerror", (e) => console.log("ERR:", e.message));
  await pg.goto("http://localhost:8123/index.html?" + q); await pg.waitForTimeout(3500);
  // drag the stick right for a second
  const s = await pg.$("#stick"); const bb = s && await s.boundingBox();
  if (bb) { await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
  await pg.screenshot({ path: out }); await b.close();
})();
