// The battlefield: entities, live effects, projectiles, timed areas, statuses, damage and hit-stop.
// Ground plane: x across, y depth (down the screen). Heights (z) lift things off the floor.

import { holdFrames, CRIT_STOP, CRIT_SHAKE } from "./juice.js";
import { FX, createFx, fit, toHex, hex, mix, Rng, clamp } from "../px.js";
import { ELEMENTS, affinity, STAGE_FX } from "../data/elements.js";
import { sfx } from "../core/audio.js";

export const DEPTH_K = 1.7; // depth distances count this much more (the floor is foreshortened)

let seedN = 1;

/** Turn a main ramp into the colour options an effect understands. */
export function fxOptions(mod, ramp, extra = {}) {
  const o = { seed: (seedN = (seedN * 1103515245 + 12345) & 0x7fffffff) % 997, ...extra };
  if (!ramp) return o;
  const opt = mod.meta?.options ?? {};
  const n = ramp.length;
  if (opt.palette && Array.isArray(opt.palette) && !extra.palette) o.palette = ramp;
  if (opt.sparks && !extra.sparks) o.sparks = [ramp[n - 2], ramp[n - 3], ramp[n - 4], ramp[n - 5]];
  if (opt.leaves && !extra.leaves) o.leaves = ramp;
  if (opt.glow && Array.isArray(opt.glow) && !extra.glow) o.glow = fit(ramp.slice(Math.floor(n / 2)), opt.glow.length).map(toHex);
  return o;
}

export class World {
  constructor(arena) {
    this.arena = arena;            // { x0, x1, y0, y1 } walkable floor
    this.ents = [];
    this.fxs = [];
    this.projs = [];
    this.timers = [];              // { at, fn } delayed callbacks in world time
    this.time = 0;
    this.stop = 0;                 // hit-stop seconds left
    this.hero = null;
    this.events = [];              // screen events for the scene: shake/flash/dim
    this.rng = new Rng(7);
    this.kills = 0;
    this.bolts = [];               // short-lived lightning lines { a:[x,y,z], b, t, ramp }
    this.runners = [];             // { fn(dt), until } per-frame behaviours with a lifetime
    this.actions = [];             // running move timelines
  }

  addRunner(fn, life) { this.runners.push({ fn, until: this.time + life }); }
  run(action) { this.actions.push(action); return action; }

  get enemies() { return this.ents.filter((e) => e.team === 1 && !e.dead); }

  add(e) { this.ents.push(e); e.world = this; e.onAdd?.(); return e; }

  after(dt, fn) { this.timers.push({ at: this.time + dt, fn }); }

  /** Spawn an effect. o: { x, y, flip, angle, follow (entity), dx, dy, z, dur, ramp, light, opts, layer } */
  fx(id, o = {}) {
    const mod = FX[id];
    if (!mod) { console.warn("missing fx", id); return null; }
    const inst = createFx(mod, fxOptions(mod, o.ramp, { light: o.light ?? 1, ...(o.opts ?? {}) }));
    const f = { inst, id, x: o.x ?? 0, y: o.y ?? 0, z: o.z ?? 0, flip: !!o.flip, angle: o.angle ?? 0, follow: o.follow ?? null,
      dx: o.dx ?? 0, dy: o.dy ?? 0, end: o.dur != null ? this.time + o.dur : Infinity, sortY: o.sortY, top: !!o.top, bottom: !!o.bottom, dead: false };
    this.fxs.push(f);
    return f;
  }

  update(dt) {
    if (this.stop > 0) {
      this.stop -= dt;
      // the freeze still lets very short flashes finish
      return;
    }
    this.time += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) if (this.time >= this.timers[i].at) { const t = this.timers[i]; this.timers.splice(i, 1); t.fn(); }
    for (const a of this.actions) a.update(dt);
    this.actions = this.actions.filter((a) => !a.done);
    for (const r of this.runners) r.fn(dt);
    this.runners = this.runners.filter((r) => this.time < r.until);
    for (const b of this.bolts) b.t -= dt;
    this.bolts = this.bolts.filter((b) => b.t > 0);
    this.hazard?.update(dt);
    for (const e of this.ents) if (!e.removed) e.update(dt);
    for (const p of this.projs) p.update(dt, this);
    this.projs = this.projs.filter((p) => !p.dead);
    for (const f of this.fxs) {
      if (f.follow) {
        const e = f.follow;
        f.x = e.x + (e.flip ? -f.dx : f.dx); f.y = e.y; f.z = e.z - f.dy; f.flip = e.flip;
        if (e.dead && f.end === Infinity) f.inst.stop();
      }
      if (this.time >= f.end) { f.inst.stop(); f.end = Infinity; f.stopping = true; }
      f.inst.update(dt);
      if (f.inst.done()) f.dead = true;
    }
    this.fxs = this.fxs.filter((f) => !f.dead);
    this.ents = this.ents.filter((e) => !e.removed);
  }

  /** Draw everything sorted by depth. p: world painter. */
  draw(p) {
    const items = [];
    for (const e of this.ents) if (!e.removed) items.push({ y: e.y, k: 1, e });
    for (const f of this.fxs) items.push({ y: f.bottom ? -1e9 : f.top ? 1e9 : (f.sortY ?? f.y) + 0.5, k: 2, f });
    for (const pr of this.projs) items.push({ y: pr.y + 0.4, k: 3, pr });
    items.sort((a, b) => a.y - b.y);
    // shadows and ground marks first
    p.reset();
    if (this.hazard) { this.hazard.drawGround(p); p.reset(); }
    for (const e of this.ents) if (!e.removed) e.drawGround?.(p);
    for (const f of this.fxs) if (f.bottom) this.drawFx(p, f);
    for (const it of items) {
      if (it.k === 1) { p.reset(); it.e.draw(p); }
      else if (it.k === 2) { if (!it.f.bottom) this.drawFx(p, it.f); }
      else it.pr.draw(p, this);
    }
    for (const b of this.bolts) this.drawBolt(p, b);
  }

  drawBolt(p, b) {
    p.reset();
    const R = b.ramp ? b.ramp.map(hex) : [hex("#3f8cff"), hex("#c8f0ff"), hex("#ffffff")];
    const n = R.length, core = R[n - 1], mid = R[n - 3] ?? R[0], glow = R[Math.floor(n / 2)];
    const [ax, ay, az] = b.a, [bx, by, bz] = b.b, x0 = ax, y0 = ay - az, x1 = bx, y1 = by - bz;
    const segs = 7, pts = [[x0, y0]];
    for (let i = 1; i < segs; i++) {
      const u = i / segs, j = (Math.random() * 2 - 1) * 7;
      pts.push([x0 + (x1 - x0) * u - (y1 - y0) / (Math.hypot(x1 - x0, y1 - y0) || 1) * j, y0 + (y1 - y0) * u + (x1 - x0) / (Math.hypot(x1 - x0, y1 - y0) || 1) * j]);
    }
    pts.push([x1, y1]);
    for (let i = 0; i < pts.length - 1; i++) {
      const [sx, sy] = pts[i], [ex, ey] = pts[i + 1], L = Math.max(1, Math.ceil(Math.hypot(ex - sx, ey - sy)));
      for (let k = 0; k <= L; k++) {
        const x = Math.round(sx + (ex - sx) * (k / L)), y = Math.round(sy + (ey - sy) * (k / L));
        p.put(x, y, core); p.put(x + 1, y, mid); p.put(x, y + 1, mid);
        for (let gy = -3; gy <= 3; gy++) for (let gx = -3; gx <= 3; gx++) { const d = gx * gx + gy * gy; if (d < 10) p.add(x + gx, y + gy, glow, 0.06 * (1 - d / 10)); }
      }
    }
  }

  drawFx(p, f) {
    const o = f.inst.options;
    o.x = Math.round(f.x); o.y = Math.round(f.y - f.z); o.flip = f.flip; o.angle = f.angle;
    f.inst.draw(p.frame, "back");
    f.inst.draw(p.frame, "front");
  }

  // ------------------------------------------------------------------ queries
  inArea(e, ox, oy, flip, a) {
    const f = flip ? -1 : 1;
    if (a.box) {
      const [x0, x1, d] = a.box, rel = (e.x - ox) * f;
      return rel >= x0 - e.r && rel <= x1 + e.r && Math.abs(e.y - oy) <= d + e.r * 0.4;
    }
    if (a.circ) {
      const [r, dx] = a.circ, cx = a.center ? a.center[0] : ox + f * dx, cy = a.center ? a.center[1] : oy;
      return Math.hypot(e.x - cx, (e.y - cy) * DEPTH_K) <= r + e.r;
    }
    return false;
  }

  nearestEnemy(x, y, maxD = 1e9, exclude = null, preferFlip = null) {
    let best = null, bd = maxD;
    for (const e of this.enemies) {
      if (exclude?.has(e) || e.untargetable) continue;
      let d = Math.hypot(e.x - x, (e.y - y) * DEPTH_K);
      if (preferFlip !== null && ((e.x - x) < 0) !== preferFlip) d *= 1.6; // prefer what we face
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  clampToArena(e) {
    const A = this.arena;
    e.x = clamp(e.x, A.x0 + e.r, A.x1 - e.r);
    e.y = clamp(e.y, A.y0, A.y1);
  }

  // ------------------------------------------------------------------ damage
  /**
   * src: attacker entity (stats), tgt: target. h: { dmg (absolute), el, kb, up, stop, st, from: [x,y], noCrit, fxRamp, stage }
   */
  hit(src, tgt, h) {
    if (tgt.dead || tgt.invuln > 0 || tgt.iframes > 0) return 0;
    let dmg = h.dmg;
    let crit = false;
    const S = src?.stats;
    if (S && !h.noCrit && this.rng.next() < S.crit) { crit = true; dmg *= S.critDmg; }
    const aff = affinity(h.el, tgt.el);
    if (aff > 1 && S) dmg *= aff + (S.affinity ?? 0);
    else dmg *= aff;
    if (tgt.stats?.armor) dmg *= 1 - tgt.stats.armor;
    if (tgt.frozen > 0) dmg *= 1.15;
    if (tgt.modDamage) dmg = tgt.modDamage(dmg, src, h);
    dmg = Math.max(1, Math.round(dmg * (0.92 + this.rng.next() * 0.16)));
    tgt.hp -= dmg;
    tgt.hitFlash = 0.09;
    tgt.lastHitBy = src;
    if (S?.leech) src.heal?.(dmg * S.leech);
    // knockback away from the source
    const fx = h.from ? h.from[0] : src?.x ?? tgt.x, fy = h.from ? h.from[1] : src?.y ?? tgt.y;
    if (h.kb && !tgt.heavy) {
      const ang = Math.atan2((tgt.y - fy) * 0.6, tgt.x - fx || (src?.flip ? -1 : 1));
      tgt.kx += Math.cos(ang) * h.kb; tgt.ky += Math.sin(ang) * h.kb * 0.5;
    } else if (h.kb && tgt.heavy) {
      const ang = Math.atan2(0, tgt.x - fx || 1);
      tgt.kx += Math.cos(ang) * h.kb * 0.15;
    }
    if (h.up && !tgt.heavy && !tgt.flying) tgt.vz = Math.max(tgt.vz, h.up * 1.6);
    if (h.st) tgt.applyStatus?.(h.st, src);
    tgt.onHurt?.(dmg, src, h);
    if (h.stop) holdFrames(this, h.stop);
    if (crit && tgt.team === 1) { holdFrames(this, CRIT_STOP); this.emit({ shake: CRIT_SHAKE }); }
    // numbers and sparks
    const nz = (tgt.height ?? 30) + 4;
    if (crit) this.fx("ui/crit-number", { x: tgt.x, y: tgt.y, z: nz, opts: { text: dmg + "!", label: "CRIT" }, top: true });
    else this.fx("ui/damage-number", { x: tgt.x + this.rng.range(-6, 6), y: tgt.y, z: nz - 6, opts: tgt.team === 0 ? { text: String(dmg), palette: ["#2a0808", "#5c0f12", "#a51d1d", "#e2401f", "#ff6a5a", "#ff9a8a", "#ffd0c8", "#ffffff"] } : { text: String(dmg) }, top: true });
    if (h.spark !== false && src && tgt.team === 1) {
      const stage = h.stage ?? 1;
      this.fx(stage >= 3 ? "lightning/zap-hit" : "impacts/hit-spark", { x: tgt.x, y: tgt.y + 0.6, z: (tgt.height ?? 30) * 0.45, flip: (tgt.x - fx) < 0, ramp: h.fxRamp, light: STAGE_FX[stage]?.light ?? 0.6 });
    }
    sfx(crit ? "crit" : tgt.team === 0 ? "hurt" : "hit");
    if (!h.trait) src?.onDealt?.(tgt, dmg, crit, h);
    if (tgt.hp <= 0) {
      tgt.die?.(src);
      if (tgt.dead && !tgt._killCounted) { tgt._killCounted = true; src?.onKilled?.(tgt); }
    }
    return dmg;
  }

  emit(ev) { this.events.push(ev); }
}

/** A simple projectile carrying a looping effect. */
export class Projectile {
  constructor(o) {
    Object.assign(this, { r: 8, z: 16, pierce: false, life: 3, tick: 0, hitSet: new Set(), dead: false, t: 0, travelled: 0 }, o);
    this.vx = Math.cos(this.ang) * this.speed; this.vy = Math.sin(this.ang) * this.speed * 0.55;
    this.tickT = 0;
  }
  update(dt, w) {
    this.t += dt;
    const step = Math.hypot(this.vx, this.vy) * dt;
    this.x += this.vx * dt; this.y += this.vy * dt; this.travelled += step;
    if (this.fxRef) { this.fxRef.x = this.x; this.fxRef.y = this.y; this.fxRef.z = this.z; }
    const A = w.arena;
    const out = this.x < A.x0 - 20 || this.x > A.x1 + 20 || this.y < A.y0 - 14 || this.y > A.y1 + 14;
    if (this.travelled >= this.range || this.t >= this.life || out) return this.end(w, false);
    const targets = this.team === 0 ? w.enemies : [w.hero].filter((h) => h && !h.dead);
    if (this.pull) for (const e of targets) {
      const dx = this.x - e.x, dy = this.y - e.y, d = Math.hypot(dx, dy * DEPTH_K);
      if (d < this.r * 2.6 && d > 2 && !e.heavy) { e.x += (dx / d) * this.pull * dt; e.y += (dy / d) * this.pull * dt * 0.6; }
    }
    if (this.tick) {
      this.tickT -= dt;
      if (this.tickT <= 0) {
        this.tickT = this.tick;
        for (const e of targets) if (Math.hypot(e.x - this.x, (e.y - this.y) * DEPTH_K) <= this.r + e.r)
          w.hit(this.src, e, { dmg: this.tickDmg * this.src.stats.atk, el: this.el, st: this.st, stage: this.stage, fxRamp: this.ramp, spark: this.t % 0.5 < this.tick, from: [this.x, this.y] });
      }
      return;
    }
    for (const e of targets) {
      if (this.hitSet.has(e)) continue;
      if (Math.hypot(e.x - this.x, (e.y - this.y) * DEPTH_K) <= this.r + e.r && Math.abs((e.height ?? 30) * 0.5 - this.z) < 30) {
        this.hitSet.add(e);
        w.hit(this.src, e, { dmg: this.dmg * (this.src.stats?.atk ?? 1), el: this.el, kb: this.kb ?? 60, st: this.st, stage: this.stage, fxRamp: this.ramp, from: [this.x - this.vx * 0.1, this.y] });
        if (!this.pierce) return this.end(w, true);
        // a piercing shot bursts on everything it passes through
        if (this.hitFx) w.fx(this.hitFx, { x: e.x, y: e.y + 1, ramp: this.ramp, light: this.light, flip: this.vx < 0 });
        if (this.hitR) for (const o of targets) if (o !== e && !this.hitSet.has(o) && Math.hypot(o.x - e.x, (o.y - e.y) * DEPTH_K) <= this.hitR + o.r) w.hit(this.src, o, { dmg: this.hitDmg * (this.src.stats?.atk ?? 1), el: this.el, kb: 60, st: this.st, stage: this.stage, fxRamp: this.ramp, from: [e.x, e.y] });
      }
    }
  }
  end(w, hitSomething) {
    this.dead = true;
    if (this.fxRef) this.fxRef.inst.stop();
    if (this.hitFx && (hitSomething || this.burst)) {
      w.fx(this.hitFx, { x: this.x, y: this.y + 1, z: this.burstZ ?? 0, ramp: this.ramp, light: this.light, flip: this.vx < 0 });
      if (this.hitR) {
        const center = [this.x, this.y];
        for (const e of (this.team === 0 ? w.enemies : [w.hero]))
          if (e && !this.hitSet.has(e) && Math.hypot(e.x - center[0], (e.y - center[1]) * DEPTH_K) <= this.hitR + e.r)
            w.hit(this.src, e, { dmg: this.hitDmg * (this.src.stats?.atk ?? 1), el: this.el, kb: 90, st: this.st, stage: this.stage, fxRamp: this.ramp, from: center });
        w.emit({ shake: 2 });
      }
    }
  }
  draw(p) {
    if (this.style !== "waterArrow") return;
    // an arrow of running water: a bright shaft and head along its flight, streamers and droplets behind
    p.reset();
    const R = (this.ramp ?? ["#0c2a5a", "#1c66c0", "#5ab8ff", "#c8f0ff", "#ffffff"]).map((c) => (typeof c === "number" ? c : hex(c))), n = R.length;
    const x = this.x, y = this.y - this.z, vl = Math.hypot(this.vx, this.vy * 0.8) || 1, dx = this.vx / vl, dy = this.vy * 0.8 / vl, px = -dy, py = dx;
    const L = this.big ? 14 : 10;
    this.tr = this.tr ?? [];
    this.tr.unshift([x, y]); if (this.tr.length > (this.big ? 10 : 7)) this.tr.pop();
    for (let i = 1; i < this.tr.length; i++) {
      const [ax, ay] = this.tr[i - 1], [bx, by] = this.tr[i], k = i / this.tr.length;
      for (let s = 0; s <= 3; s++) { const u = s / 3, cx = ax + (bx - ax) * u, cy = ay + (by - ay) * u;
        for (const side of [-1, 1]) { const w = Math.sin(this.t * 30 + i + side) * 1.5 * k; p.blendPx(Math.round(cx - dx * L * 0.5 + px * side * (1 + w)), Math.round(cy - dy * L * 0.5 + py * side * (1 + w)), R[n - 2], 0.55 * (1 - k)); }
      }
    }
    for (let s = 0; s <= L; s++) { const X = Math.round(x - dx * s), Y = Math.round(y - dy * s), c = s < 3 ? R[n - 1] : R[n - 2]; p.put(X, Y, c); if (this.big) p.put(X + Math.round(px), Y + Math.round(py), R[n - 3]); p.add(X, Y, R[n - 2], 0.25); }
    for (const side of [-1, 1]) for (let s = 1; s <= 3; s++) p.put(Math.round(x - dx * s + px * side * s * 0.8), Math.round(y - dy * s + py * side * s * 0.8), R[n - 1]);
    // the great arrow is wound with a spiral of water
    if (this.tier === 3) for (let s = 0; s <= L + 6; s++) { const q = Math.sin(s * 0.9 - this.t * 30) * 2.6; p.put(Math.round(x - dx * s + px * q), Math.round(y - dy * s + py * q), R[n - 1], 0.9 - s / (L + 8)); }
    for (let s = 0; s < 3; s++) { const q = Math.sin(this.t * 40 + s * 2); p.put(Math.round(x - dx * (L + 2 + s * 3) + px * q * 2), Math.round(y - dy * (L + 2 + s * 3) + py * q * 2), R[n - 3], 0.8); }
    for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) { const d = i * i + j * j; if (d < 25) p.add(Math.round(x + i), Math.round(y + j), R[n - 2], 0.15 * (1 - d / 25)); }
  }

}
