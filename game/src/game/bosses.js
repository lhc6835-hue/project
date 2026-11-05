// Bosses: the Stone Giant (floor 5) and the Void Caller (floor 10). Both are big puppets on the hero's rig.
import { hex, mix } from "../px.js";
import { Actor } from "./actor.js";
import { drawRig, lerpPose } from "../rig/rig.js";
import { idlePose, movePose, sampleKeys, archetype, DEAD } from "./poses.js";
import { ELEMENTS, BASE_ELEMENTS } from "../data/elements.js";
import { DEPTH_K } from "./world.js";
import { Enemy, EnemyShot } from "./enemies.js";
import { sfx } from "../core/audio.js";

const STONE = { ramp: ["#1c1c24", "#2c2c38", "#42424f", "#5c5c6b", "#7d7d8c"].map(hex), outline: hex("#08070c"), eye: hex("#ffb84a") };
const VOID = { ramp: ["#0f0a18", "#1c1230", "#2c1a4a", "#432468", "#5e3290"].map(hex), outline: hex("#050308"), eye: hex("#f0dcff") };

class Boss extends Actor {
  constructor(o) {
    super({ team: 1, heavy: true, ...o });
    this.state = "intro"; this.stT = 1.2; this.cool = 1.5; this.marks = []; this.lastPose = {}; this.phase = 1; this.step = 0;
    this.invuln = 1.2; this.stats = { atk: o.atk, crit: 0, critDmg: 1.5 };
  }
  get hero() { return this.world.hero; }
  /** Ground warnings: { x, y, r (circle) or box, t (left), T (total) } */
  mark(m) { this.marks.push({ ...m, T: m.t }); }
  drawGround(p) {
    super.drawGround(p);
    for (const m of this.marks) {
      const k = 1 - m.t / m.T, c = hex("#ff3040");
      const R = m.r;
      for (let a = 0; a < 96; a++) { const an = (a / 96) * Math.PI * 2; p.blendPx(Math.round(m.x + Math.cos(an) * R), Math.round(m.y + Math.sin(an) * R / DEPTH_K), c, 0.85); }
      const r2 = R * k;
      for (let y = -r2 / DEPTH_K; y <= r2 / DEPTH_K; y++) for (let x = -r2; x <= r2; x++)
        if ((x * x) / (r2 * r2) + (y * y * DEPTH_K * DEPTH_K) / (r2 * r2) <= 1 && ((Math.round(x) + Math.round(y)) & 1)) p.blendPx(Math.round(m.x + x), Math.round(m.y + y), c, 0.22);
    }
  }
  tickMarks(dt) {
    for (const m of this.marks) { m.t -= dt; if (m.t <= 0 && !m.fired) { m.fired = true; m.fire?.(); } }
    this.marks = this.marks.filter((m) => !m.fired);
  }
  hitHeroIn(x, y, r, dmg, kb = 140) {
    const h = this.hero;
    if (h && !h.dead && Math.hypot(h.x - x, (h.y - y) * DEPTH_K) <= r + h.r) this.world.hit(this, h, { dmg, kb, from: [x, y], spark: false });
  }
  die() {
    if (this.dead) return;
    this.dead = true; this.hp = 0; this.deadT = 0; this.marks = [];
    this.clearStatusFx();
    const w = this.world;
    w.fx("explosions/big-explosion", { x: this.x, y: this.y + 1, ramp: this.ramp, light: 1 });
    w.emit({ shake: 9, flash: 1, bossDown: this });
    sfx("boom");
    w.kills++;
    w.emit({ killed: this });
  }
}

export class StoneGiant extends Boss {
  constructor(o) {
    super({ r: 18, height: 76, shadowW: 40, ...o });
    this.name = "돌 거인"; this.el = "earth"; this.k = 2.2; this.speed = 26; this.ramp = ELEMENTS.earth.ramp;
  }
  update(dt) {
    this.physics(dt); this.tickMarks(dt);
    if (this.dead) { this.deadT += dt; if (this.deadT > 2) this.removed = true; return; }
    const h = this.hero; if (!h || h.dead) return;
    this.stT -= dt; this.cool -= dt;
    if (this.hp < this.maxHp * 0.5 && this.phase === 1) { this.phase = 2; this.world.emit({ banner: "돌 거인이 분노한다!", shake: 4 }); }
    const sp = this.phase === 2 ? 1.35 : 1;
    const dx = h.x - this.x, dy = h.y - this.y;
    this.moving = false;
    if (this.state === "intro") { if (this.stT <= 0) this.state = "idle"; return; }
    if (this.state !== "idle") { if (this.stT <= 0) { this.state = "idle"; this.cool = (1.4 + Math.random() * 0.8) / sp; } return; }
    this.flip = dx < 0;
    if (Math.abs(dx) > 50 || Math.abs(dy) > 10) {
      this.x += Math.sign(dx) * this.speed * sp * dt * (Math.abs(dx) > 50 ? 1 : 0); this.y += Math.sign(dy) * this.speed * 0.7 * sp * dt; this.moving = true;
    }
    if (this.cool > 0 || !this.canAct) return;
    const pick = this.step++ % (this.phase === 2 ? 4 : 3);
    const f = this.flip ? -1 : 1;
    if (pick === 0 || (Math.abs(dx) < 60 && Math.random() < 0.5)) {
      // overhead slam in front
      this.state = "slam"; this.stT = 1.6 / sp;
      const cx = this.x + f * 38, cy = this.y;
      this.mark({ x: cx, y: cy, r: 52, t: 0.9 / sp, fire: () => {
        this.world.fx("impacts/ground-slam", { x: cx, y: cy, ramp: ELEMENTS.earth.ramp, light: 0.9, opts: { reach: 80 } });
        this.hitHeroIn(cx, cy, 52, this.stats.atk * 1.4, 200); this.world.emit({ shake: 7 }); sfx("boom");
      } });
    } else if (pick === 1) {
      // throws a boulder that lands where the hero stands
      this.state = "throw"; this.stT = 1.3 / sp;
      const lx = h.x, ly = h.y;
      this.flip = lx < this.x;
      this.mark({ x: lx, y: ly, r: 30, t: 1.0 / sp, fire: () => { this.hitHeroIn(lx, ly, 30, this.stats.atk * 1.1); this.world.emit({ shake: 4 }); sfx("boom"); } });
      this.world.after(0.4 / sp, () => {
        // the boulder effect flies ~150 px forward from where it starts: start it that far back from the target
        const fl = lx < this.x, sx = lx + (fl ? 150 : -150);
        this.world.fx("nature/boulder", { x: sx, y: ly - 0.5, flip: fl, light: 0.7, ramp: ELEMENTS.earth.ramp });
      });
    } else {
      // stone spikes erupt under the hero (twice when angry)
      this.state = "stomp"; this.stT = 1.4 / sp;
      const n = this.phase === 2 ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const tx = h.x + (i - (n - 1) / 2) * 40, ty = h.y;
        this.world.after(i * 0.25, () => this.mark({ x: tx, y: ty, r: 26, t: 0.75 / sp, fire: () => {
          this.world.fx("nature/earth-spike", { x: tx, y: ty, ramp: ELEMENTS.earth.ramp, light: 0.8 });
          this.world.after(0.4, () => { this.hitHeroIn(tx, ty, 28, this.stats.atk * 1.2, 80); this.world.emit({ shake: 3 }); });
        } }));
      }
    }
    sfx("door");
  }
  draw(p) {
    let pose;
    const sp = this.phase === 2 ? 1.35 : 1;
    if (this.dead) pose = lerpPose({}, DEAD, Math.min(1, this.deadT * 2));
    else if (this.state === "slam") pose = sampleKeys(archetype("slam", 0.9 / sp, 0.6), this.stT > 0.7 / sp ? -(this.stT - 0.7 / sp) : (0.7 / sp - this.stT), lerpPose);
    else if (this.state === "throw") pose = sampleKeys(archetype("throw", 0.4 / sp, 0.8), (1.3 / sp - this.stT) - 0.4 / sp, lerpPose);
    else if (this.state === "stomp") pose = sampleKeys(archetype("stomp", 0.5, 0.8), (1.4 / sp - this.stT) - 0.5, lerpPose);
    else if (this.moving) pose = movePose(1, "earth", this.t * 0.6);
    else pose = idlePose(1, "earth", this.t * 0.7);
    this.lastPose = pose;
    const eye = this.phase === 2 ? hex("#ff5030") : STONE.eye;
    drawRig(p, { x: this.x, y: this.y - this.z, pose, flip: this.flip, skin: { ...STONE, eye }, k: this.k, tint: this.hitFlash > 0 ? hex("#ffffff") : null, tintK: 0.6,
      alpha: this.dead ? Math.max(0, 1 - this.deadT) : 1,
      decor: (n, u, v) => {
        if (n === "torso" && ((u > -4.5 && u < 3 && Math.abs(v - (4.5 + 1.6 * Math.sin(u * 1.4))) < 0.45) || (v > 5 && v < 10.5 && Math.abs(u - (0.5 + (v - 5) * 0.55 * (v > 8 ? -1 : 1))) < 0.45))) return this.phase === 2 ? hex("#ff6a2a") : hex("#e8b05a"); // glowing cracks
        if (n === "head" && v > 4 && v < 5.4 && u > 0.5 && u < 4.4) return eye;
        if ((n === "armN" || n === "armF") && v > 9) return hex("#5c5c6b");
        return 0;
      } });
    if (this.phase === 2 && !this.dead) { p.reset(); for (let i = 0; i < 4; i++) { const ph = (this.t * 0.8 + i / 4) % 1; p.add(Math.round(this.x + Math.sin(i * 3 + this.t) * 18), Math.round(this.y - 20 - ph * 60), hex("#ff6a2a"), 0.8 * (1 - ph)); } }
  }
}

export class VoidCaller extends Boss {
  constructor(o) {
    super({ r: 14, height: 60, shadowW: 30, flying: true, ...o });
    this.name = "공허의 정령사"; this.el = "dark"; this.k = 1.6; this.speed = 40; this.ramp = ELEMENTS.dark.ramp; this.z = 10; this.hover = 10;
  }
  onAdd() { this.aura = this.world.fx("shadow/shadow-flames", { follow: this, light: 0.6, ramp: ELEMENTS.dark.ramp }); }
  update(dt) {
    this.physics(dt); this.tickMarks(dt);
    this.z = 10 + Math.sin(this.t * 1.6) * 3;
    if (this.dead) { this.deadT += dt; if (this.aura) this.aura.inst.stop(); if (this.deadT > 2) this.removed = true; return; }
    const h = this.hero; if (!h || h.dead) return;
    this.stT -= dt; this.cool -= dt;
    if (this.hp < this.maxHp * 0.5 && this.phase === 1) { this.phase = 2; this.world.emit({ banner: "공허가 깨어난다!", shake: 5, flash: 0.5 }); }
    const sp = this.phase === 2 ? 1.3 : 1;
    const dx = h.x - this.x, dy = h.y - this.y;
    this.flip = dx < 0;
    if (this.state === "intro") { if (this.stT <= 0) this.state = "idle"; return; }
    // drift to keep a middle distance
    const want = 110, d = Math.hypot(dx, dy);
    const mv = d > want + 20 ? 1 : d < want - 30 ? -1 : 0;
    this.x += (dx / (d || 1)) * this.speed * mv * dt; this.y += (dy / (d || 1)) * this.speed * 0.6 * mv * dt + Math.sin(this.t) * 6 * dt;
    if (this.state !== "idle") { if (this.stT <= 0) { this.state = "idle"; this.cool = (1.3 + Math.random() * 0.7) / sp; } return; }
    if (this.cool > 0 || !this.canAct) return;
    const pick = this.step++ % 4;
    const w = this.world;
    if (pick === 0) {
      // a fan of void orbs
      this.state = "cast"; this.stT = 1.0;
      const n = this.phase === 2 ? 7 : 5;
      const base = Math.atan2((h.y - this.y) / 0.55, h.x - this.x);
      w.after(0.4, () => { for (let i = 0; i < n; i++) w.projs.push(new EnemyShot({ x: this.x, y: this.y + 0.5, z: 30, ang: base + (i - (n - 1) / 2) * 0.22, speed: 115, src: this, team: 1, color: ["#8048b8", "#f0dcff"], r: 6 })); sfx("zap"); });
    } else if (pick === 1) {
      // borrowed elements: strikes under the hero in a random element
      this.state = "raise"; this.stT = 1.6;
      const el = BASE_ELEMENTS[Math.floor(Math.random() * 4)];
      const id = { fire: "fire/flame-pillar", water: "water/geyser", wind: "lightning/lightning-strike", earth: "nature/earth-spike" }[el];
      const delay = { fire: 0.7, water: 1.2, wind: 0.8, earth: 0.42 }[el];
      const ramp = el === "wind" ? ELEMENTS.wind.storm : ELEMENTS[el].ramp;
      const n = this.phase === 2 ? 3 : 2;
      w.emit({ banner: `${ELEMENTS[el].name}의 힘`, color: ELEMENTS[el].css, small: true });
      for (let i = 0; i < n; i++) w.after(i * 0.35, () => {
        const tx = h.x + (Math.random() - 0.5) * 20, ty = h.y;
        this.mark({ x: tx, y: ty, r: 24, t: delay + 0.1, fire: () => { this.hitHeroIn(tx, ty, 26, this.stats.atk * 1.3, 100); w.emit({ shake: 3 }); } });
        w.fx(id, { x: tx, y: ty, ramp, light: 0.9 });
      });
    } else if (pick === 2) {
      // a black hole that drags the hero in
      this.state = "raise"; this.stT = 1.2;
      const A = w.arena, cx = (A.x0 + A.x1) / 2 + (Math.random() - 0.5) * 120, cy = (A.y0 + A.y1) / 2;
      w.fx("shadow/black-hole", { x: cx, y: cy + 12, light: 0.9, dur: 3.2, ramp: ELEMENTS.dark.ramp });
      w.addRunner((dt) => {
        const hh = this.hero; if (!hh || hh.dead) return;
        const ddx = cx - hh.x, ddy = cy - hh.y, dd = Math.hypot(ddx, ddy);
        if (dd > 4) { hh.x += (ddx / dd) * 46 * dt; hh.y += (ddy / dd) * 28 * dt; }
        if (dd < 22) { hh.blackT = (hh.blackT ?? 0) - dt; if (hh.blackT <= 0) { hh.blackT = 0.5; w.hit(this, hh, { dmg: this.stats.atk * 0.5, spark: false }); } }
      }, 3.2);
    } else {
      // calls wisps (and in phase 2 tendrils under the hero)
      this.state = "raise"; this.stT = 1.2;
      const A = w.arena;
      for (let i = 0; i < (this.phase === 2 ? 3 : 2); i++) {
        const e = new Enemy("wisp", { x: A.x0 + 40 + Math.random() * (A.x1 - A.x0 - 80), y: A.y0 + Math.random() * (A.y1 - A.y0), el: "dark", scale: this.minionScale ?? 1, dmgScale: this.minionDmg ?? 1 });
        w.add(e);
      }
      if (this.phase === 2) { const tx = h.x, ty = h.y; this.mark({ x: tx, y: ty, r: 30, t: 0.9, fire: () => { w.fx("shadow/grasping-hands", { x: tx, y: ty, light: 0.8, ramp: ELEMENTS.dark.ramp }); this.hitHeroIn(tx, ty, 30, this.stats.atk, 40); const hh = this.hero; if (hh && Math.hypot(hh.x - tx, hh.y - ty) < 30) hh.applyStatus({ root: 1.2 }); } }); }
    }
  }
  draw(p) {
    let pose;
    if (this.dead) pose = lerpPose({}, DEAD, Math.min(1, this.deadT * 2));
    else if (this.state === "cast") pose = sampleKeys(archetype("cast", 0.4, 0.6), (1.0 - this.stT) - 0.4, lerpPose);
    else if (this.state === "raise") pose = sampleKeys(archetype("raise", 0.3, 1.2), (1.6 - this.stT) - 0.3, lerpPose);
    else pose = idlePose(3, "dark", this.t);
    pose = { ...pose, z: 0 };
    const eye = hex("#f0dcff");
    drawRig(p, { x: this.x, y: this.y - this.z, pose, flip: this.flip, skin: VOID, k: this.k, tint: this.hitFlash > 0 ? hex("#ffffff") : null, tintK: 0.6, alpha: this.dead ? Math.max(0, 1 - this.deadT) : 1,
      decor: (n, u, v) => {
        if (n === "torso" && Math.abs(u) + Math.abs(v - 5.5) < 2.4) return Math.sin(this.t * 5) > 0 ? hex("#f0dcff") : hex("#b884ff");
        if (n === "head" && v > 4 && v < 5.4 && u > 0.5 && u < 4.4) return eye;
        if (n === "head" && v < 2) return hex("#8048b8");
        return 0;
      } });
    // four element motes orbit the caller
    if (!this.dead) {
      p.reset();
      BASE_ELEMENTS.forEach((el, i) => {
        const an = this.t * 1.5 + (i / 4) * Math.PI * 2, x = Math.round(this.x + Math.cos(an) * 26), y = Math.round(this.y - this.z - 34 + Math.sin(an) * 8);
        const c = hex(ELEMENTS[el].css);
        for (let d = -1; d <= 1; d++) { p.put(x + d, y, c); p.put(x, y + d, c); }
        p.put(x, y, hex("#ffffff"));
        for (let gy = -4; gy <= 4; gy++) for (let gx = -4; gx <= 4; gx++) { const dd = gx * gx + gy * gy; if (dd < 16) p.add(x + gx, y + gy, c, 0.12 * (1 - dd / 16)); }
      });
    }
  }
}
