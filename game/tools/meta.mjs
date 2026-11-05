const ids = process.argv.slice(2);
for (const id of ids) {
  const m = await import(`../src/vendor/pixelfx/fx/${id}.js`);
  const meta = m.meta || {};
  const o = Object.fromEntries(Object.entries(meta.options||{}).map(([k,v])=>[k, Array.isArray(v)? `[${v.length}]` : v]));
  console.log(id, '|', meta.loop?'loop':'once', meta.duration, '|', meta.size||meta.w+'x'+meta.h, '| origin', JSON.stringify(meta.origin), '| actor', !!meta.actor, '|', JSON.stringify(o), m.act ? '| ACT':'' );
}
