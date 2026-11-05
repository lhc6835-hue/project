for (const id of process.argv.slice(2)) {
  const m = await import(`../src/vendor/pixelfx/fx/${id}.js`);
  const a = m.act; if (!a) { console.log(id, "no act"); continue; }
  console.log(id, "target", JSON.stringify(a.target), "windup", a.poses?.[0]?.[0], "end", a.poses?.at(-1)?.[0], "hits", JSON.stringify(a.hits?.map(h=>({t:h.t,stop:h.stop,x:h.x,y:h.y}))));
}
