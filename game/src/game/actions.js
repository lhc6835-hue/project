// Runs a move's timeline (see data/skills.js) for its owner: effects, hit areas, projectiles, dashes, specials.
import { STAGE_FX } from "../data/elements.js";
import { Projectile, DEPTH_K } from "./world.js";
import { archetype } from "./poses.js";
import { sfx } from "../core/audio.js";
import { WEAPON_BY_MOVE } from "./weapons.js";

const SWING_SFX = { fire: "swing", water: "water", wind: "dash", earth: "swing" };

export class Action {
  constructor(owner, def, world) {
    this.o = owner; this.def = def; this.w = world; this.swung = !!(owner?.isHero !== false && WEAPON_BY_MOVE[def.name]?.swing);
    this.t = -(def.windup ?? 0);
    this.end = Math.max(def.recover ?? 0.2, 0);
    this.done = false;
    this.keys = archetype(def.pose, def.windup ?? 0.15, def.recover ?? 0.3);
    this.fired = new Set();
    this.tickNext = (def.ticks ?? []).map((k) => k.t0);
    this.onceHit = (def.ticks ?? []).map(() => new Set());
    for (const f of def.fx ?? []) this.end = Math.max(this.end, f.t);
    for (const h of def.hits ?? []) this.end = Math.max(this.end, h.t);
    for (const k of def.ticks ?? []) this.end = Math.max(this.end, k.t1);
    for (const p of def.proj ?? []) this.end = Math.max(this.end, p.t);
    for (const c of def.cam ?? []) this.end = Math.max(this.end, c.t);
    if (def.dash) this.end = Math.max(this.end, def.dash.t1);
    // aim: lock on to what we're facing (or the nearest thing) at the start
    const tgt = world.nearestEnemy(owner.x, owner.y, 190, null, owner.flip);
    if (tgt && owner.autoFace !== false) owner.flip = tgt.x < owner.x;
    const f = owner.flip ? -1 : 1;
    this.target = tgt;
    const firstAim = (def.fx ?? []).find((x) => x.at === "aim") ?? (def.hits ?? []).find((x) => x.at === "aim");
    const dx = firstAim?.dx ?? firstAim?.circ?.[1] ?? 60;
    if (tgt && Math.abs(tgt.x - owner.x) < 210) this.aim = [tgt.x, tgt.y];
    else this.aim = [owner.x + f * dx, owner.y];
    const A = world.arena;
    this.aim[0] = Math.max(A.x0 + 10, Math.min(A.x1 - 10, this.aim[0]));
    this.released = false;
  }

  get busy() { return this.t < (this.def.recover ?? 0.2); }
  get stage() { return this.o.stage ?? 1; }
  rampOf(key) { return this.o.rampFor ? this.o.rampFor(key) : null; }
  light(k = 1) { return (STAGE_FX[this.stage]?.light ?? 0.8) * k; }

  update(dt) {
    const d = this.def, o = this.o, w = this.w, prev = this.t;
    this.t += dt;
    const t = this.t, f = o.flip ? -1 : 1;
    const due = (key, at) => at <= t && !this.fired.has(key) && (this.fired.add(key), true);
    // a bow's release sounds like a bow (each arrow plays its own shot below), not a splash
    const bowShot = d.proj?.some((q) => q.style === "waterArrow");
    if (!this.started && bowShot) { this.started = true; sfx("draw"); }
    if (!this.released && t >= 0) { this.released = true; if (!bowShot) sfx(SWING_SFX[o.el] ?? "swing"); o.onRelease?.(this); }

    (d.fx ?? []).forEach((e, i) => {
      if (!due("fx" + i, e.t)) return;
      if (this.swung && e.id.startsWith("melee/")) return; // the blade's own swept arc replaces the stock slash
      const base = { ramp: this.rampOf(e.ramp ?? "main"), light: this.light(e.light), opts: e.opts, dur: e.dur };
      if (e.follow) w.fx(e.id, { ...base, follow: o, dx: e.dx ?? 0, dy: e.dy ?? 0 });
      else if (e.at === "weapon" && o.weaponTip) w.fx(e.id, { ...base, x: o.weaponTip[0] + f * (e.dx ?? 0), y: o.weaponTip[1], flip: o.flip }); // where the weapon met the ground
      else if (e.at === "aim") w.fx(e.id, { ...base, x: this.aim[0], y: this.aim[1], flip: o.flip });
      else if (e.at === "nearest") { const tg = this.target; if (tg && !tg.dead) w.fx(e.id, { ...base, x: tg.x, y: tg.y, flip: o.flip }); }
      else w.fx(e.id, { ...base, x: o.x + f * (e.dx ?? 0), y: o.y, z: (e.dy ?? 0) < 0 ? o.z - e.dy : 0, flip: o.flip });
    });

    (d.hits ?? []).forEach((h, i) => { if (due("h" + i, h.t)) this.area(h, null); });

    (d.ticks ?? []).forEach((k, i) => {
      while (this.tickNext[i] <= Math.min(t, k.t1) && this.tickNext[i] >= k.t0) {
        this.area(k, k.once ? this.onceHit[i] : null);
        if (k.pull) this.pull(k, dt);
        this.tickNext[i] += k.every;
      }
      if (k.pull && t >= k.t0 && t <= k.t1) this.pull(k, dt);
    });

    (d.proj ?? []).forEach((p, i) => {
      if (!due("p" + i, p.t)) return;
      const ang = (o.flip ? Math.PI : 0) + (p.spread ?? 0) * (o.flip ? -1 : 1);
      // aim at the locked target's depth when it's in front
      let a2 = ang;
      if (this.target && !p.spread && Math.sign(this.target.x - o.x) === f) a2 = Math.atan2((this.target.y - o.y) / 0.55, this.target.x - o.x);
      const ramp = this.rampOf(p.ramp ?? "main");
      const pr = new Projectile({ ...p, team: o.team, src: o, el: o.el, stage: this.stage, ramp, light: this.light(), ang: a2, x: o.x + f * 8, y: o.y + 0.5, z: (p.z ?? 16) + o.z, life: p.life ?? 3 });
      pr.fxRef = p.fx && w.fx(p.fx, { ramp, light: this.light(), opts: p.opts, x: pr.x, y: pr.y, z: pr.z, flip: o.flip, angle: Math.atan2(pr.vy, Math.abs(pr.vx)) * f * (o.flip ? -1 : 1) });
      if (pr.fxRef) pr.fxRef.sortY = undefined;
      w.projs.push(pr);
      if (p.style === "waterArrow") { sfx("bow", { power: p.big ? 1.4 : p.tier === 2 ? 1.1 : 1 }); if (p.big || !p.spread) sfx("water", { rate: 1.6, vol: 0.35 }); }
    });

    if (d.dash && t >= d.dash.t0 && prev < d.dash.t1) {
      const a = Math.max(prev, d.dash.t0), b = Math.min(t, d.dash.t1), k = (b - a) / (d.dash.t1 - d.dash.t0);
      o.x += f * d.dash.dist * k; o.iframes = Math.max(o.iframes, 0.12);
      if (d.ghost) o.ghost?.();
    }

    if (d.special && due("sp", d.special.t ?? 0)) this.special(d.special);

    (d.cam ?? []).forEach((c, i) => { if (due("c" + i, c.t)) w.emit(c); });

    if (t >= this.end) this.done = true;
  }

  /** Resolve a hit area now. */
  area(h, once) {
    const o = this.o, w = this.w;
    let ox = o.x, oy = o.y, center = null;
    if (h.at === "aim") center = [this.aim[0], this.aim[1]];
    if (h.at === "nearest") { const tg = this.target; if (!tg || tg.dead) return; center = [tg.x, tg.y]; }
    const area = h.circ && center ? { circ: h.circ, center } : h;
    const targets = o.team === 0 ? w.enemies : [w.hero].filter((x) => x && !x.dead);
    for (const e of targets) {
      if (once?.has(e)) continue;
      if (!w.inArea(e, ox, oy, o.flip, area)) continue;
      once?.add(e);
      w.hit(o, e, { dmg: h.dmg * (o.stats?.atk ?? 1), el: o.el, kb: h.kb, up: h.up, stop: h.stop, st: h.st, stage: this.stage, fxRamp: this.rampOf("main"), from: center ?? [ox, oy] });
    }
  }

  pull(k, dt) {
    const o = this.o, w = this.w, f = o.flip ? -1 : 1;
    const c = k.at === "aim" ? this.aim : [o.x + f * (k.circ?.[1] ?? 0), o.y];
    for (const e of w.enemies) {
      if (e.heavy) continue;
      const dx = c[0] - e.x, dy = c[1] - e.y, dd = Math.hypot(dx, dy * DEPTH_K);
      if (dd < (k.circ?.[0] ?? 40) * 2 && dd > 3) { e.x += (dx / dd) * k.pull * dt; e.y += (dy / dd) * k.pull * dt * 0.6; }
    }
  }

  special(s) {
    const o = this.o, w = this.w, ramp = this.rampOf(s.ramp ?? "main"), light = this.light();
    const hitOpts = (extra) => ({ dmg: s.dmg * o.stats.atk, el: o.el, st: s.st, stage: this.stage, fxRamp: ramp, ...extra });
    if (s.kind === "chain") {
      // hop from the hero to the nearest enemy, then onward, drawing a bolt each hop
      const seen = new Set();
      let from = [o.x + (o.flip ? -10 : 10), o.y, 18 + o.z], range = s.range;
      for (let i = 0; i < s.n; i++) {
        const tg = w.nearestEnemy(from[0], from[1], range, seen, i === 0 ? o.flip : null);
        if (!tg) break;
        seen.add(tg);
        const to = [tg.x, tg.y, (tg.height ?? 28) * 0.5 + tg.z], fr = from;
        w.after(i * 0.07, () => {
          w.bolts.push({ a: fr, b: to, t: 0.22, ramp });
          w.fx("lightning/zap-hit", { x: to[0], y: to[1] + 0.5, z: to[2] - 8, ramp, light });
          if (!tg.dead) w.hit(o, tg, hitOpts({ kb: 40, from: [fr[0], fr[1]] }));
          sfx("zap");
        });
        from = to; range = s.hop;
      }
    } else if (s.kind === "strikes") {
      const seen = new Set();
      for (let i = 0; i < s.n; i++) {
        const tg = w.nearestEnemy(o.x, o.y, 260, seen);
        const at = tg ? [tg.x, tg.y] : [o.x + (o.flip ? -1 : 1) * (50 + i * 40), o.y + (i - 1) * 16];
        if (tg) seen.add(tg);
        w.after(i * s.gap, () => {
          const fx = w.fx(s.fx, { x: at[0], y: at[1], ramp, light });
          w.after(s.delay, () => {
            const c = tg && !tg.dead ? [tg.x, tg.y] : at;
            if (fx) { fx.x = c[0]; fx.y = c[1]; }
            for (const e of w.enemies) if (Math.hypot(e.x - c[0], (e.y - c[1]) * DEPTH_K) <= s.r + e.r) w.hit(o, e, hitOpts({ from: c, stop: 0.05 }));
            w.emit({ shake: 4, flash: 0.25 }); sfx("zap");
          });
        });
      }
    } else if (s.kind === "orbit") {
      for (let i = 0; i < s.n; i++) {
        const orb = { a: (i / s.n) * Math.PI * 2, x: o.x, y: o.y };
        const fx = w.fx(s.fx, { x: o.x, y: o.y, ramp, light, dur: s.life });
        let tick = 0;
        const step = (dt) => {
          orb.a += dt * 3.2;
          orb.x = o.x + Math.cos(orb.a) * s.radius; orb.y = o.y + Math.sin(orb.a) * s.radius * 0.45;
          if (fx) { fx.x = orb.x; fx.y = orb.y; fx.z = 6; }
          tick -= dt;
          if (tick <= 0) {
            tick = s.tick;
            for (const e of w.enemies) if (Math.hypot(e.x - orb.x, (e.y - orb.y) * DEPTH_K) <= s.r + e.r) w.hit(o, e, hitOpts({ kb: 50, from: [orb.x, orb.y], spark: false }));
          }
        };
        w.addRunner(step, s.life);
      }
    } else if (s.kind === "heal") {
      o.heal?.(o.maxHp * s.k);
      w.fx("holy/blessing", { follow: o, light: 0.8, dur: 1, ramp });
    } else if (s.kind === "guard") {
      o.invuln = Math.max(o.invuln, s.dur);
    } else if (s.kind === "execute") {
      // rm -rf: anything weakened in range is simply deleted
      for (const e of w.enemies) {
        if (Math.hypot(e.x - o.x, (e.y - o.y) * DEPTH_K) > s.r) continue;
        if (e.hp <= e.maxHp * (e.heavy ? 0.12 : s.below)) {
          w.fx("spawn/disintegrate", { x: e.x, y: e.y + 0.5, ramp, light: 1 });
          w.fx("scifi/glitch", { x: e.x, y: e.y + 0.5, ramp, light: 1, dur: 0.4 });
          w.hit(o, e, { dmg: e.hp + 9999, noCrit: true, el: o.el, stage: this.stage, fxRamp: ramp, spark: false });
        }
      }
      w.emit({ shake: 3 }); sfx("zap");
    } else if (s.kind === "undo") {
      // Ctrl+Z: roll the hero back to full
      o.hp = o.maxHp; o.invuln = Math.max(o.invuln, 3); o.cd.s1 = 0;
      for (const k in o.st) o.st[k] = 0;
      o.clearStatusFx?.();
      w.fx("ui/level-up", { x: o.x, y: o.y, light: 1, top: true, opts: { text: "UNDO!" } });
      w.emit({ flash: 0.35 }); sfx("level");
    } else if (s.kind === "sudo") {
      // sudo kill -9: freeze every process on screen, then terminate them all
      const targets = w.enemies.slice();
      for (const e of targets) { e.applyStatus?.({ freeze: s.freeze }, null); w.fx("scifi/scanner", { x: e.x, y: e.y + 0.5, ramp, light: 1, dur: s.freeze }); }
      w.emit({ flash: 0.5, shake: 3 }); sfx("summon");
      w.after(s.freeze, () => {
        for (const e of targets) {
          if (e.dead) continue;
          w.fx("scifi/emp-blast", { x: e.x, y: e.y + 0.5, ramp, light: 1.1 });
          w.hit(o, e, { dmg: s.dmg * o.stats.atk, el: o.el, stage: this.stage, fxRamp: ramp, kb: 200, stop: 0.08 });
        }
        w.emit({ flash: 1, shake: 9, kill9: true }); sfx("boom");
      });
    } else if (s.kind === "storm") {
      const A = w.arena, clouds = [];
      for (let i = 0; i < 3; i++) clouds.push(w.fx(s.cloud, { x: A.x0 + (A.x1 - A.x0) * (0.2 + i * 0.3), y: A.y0 - 4, ramp, light: light * 0.8, dur: s.life, bottom: true }));
      let next = 0;
      w.addRunner((dt, el) => {
        next -= dt;
        if (next > 0) return;
        next = s.every;
        const tg = w.enemies[Math.floor(Math.random() * Math.max(1, w.enemies.length))];
        const at = tg ? [tg.x, tg.y] : [A.x0 + Math.random() * (A.x1 - A.x0), A.y0 + Math.random() * (A.y1 - A.y0)];
        const fx = w.fx(s.fx, { x: at[0], y: at[1], ramp, light });
        w.after(0.78, () => {
          const c = tg && !tg.dead ? [tg.x, tg.y] : at;
          if (fx) { fx.x = c[0]; fx.y = c[1]; }
          for (const e of w.enemies) if (Math.hypot(e.x - c[0], (e.y - c[1]) * DEPTH_K) <= s.r + e.r) w.hit(o, e, hitOpts({ from: c }));
          w.emit({ shake: 3, flash: 0.15 }); sfx("zap");
        });
      }, s.life);
    }
  }
}
