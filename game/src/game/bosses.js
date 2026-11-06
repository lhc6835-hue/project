// Bosses, each a bespoke sculpted body (not the hero's rig):
//   TERRAGON, the Rift Colossus (floor 5) — a giant of floating boulders bound by golden rift-light, a crystal
//     fist, a hammer arm, a beating crystal heart. Breaks open into magma at half health.
//   NOCTILE, the Void Witch (floor 10) — a hovering cloak full of stars, a three-eyed porcelain mask, horns,
//     a halo of stolen elements and two disembodied hands. Opens a vast eye and grows tendril wings.
//   VOLTERA, the Storm Roc (floor 5, from the second visit on, in turn with Terragon) — see below.
import { hex, mix, noise2, rand, clamp, createFrame, clearFrame, painterFor } from "../px.js";
import { Actor } from "./actor.js";
import { ELEMENTS, BASE_ELEMENTS } from "../data/elements.js";
import { DEPTH_K } from "./world.js";
import { Enemy, EnemyShot } from "./enemies.js";
import { Scarf } from "./animator.js";
import { sculpt, sd, glow, energy, ramp } from "./sculpt.js";
import { sfx } from "../core/audio.js";
import { Skeleton, part, keys, Strand } from "./boss_rig.js";

const S = Math.sin, C = Math.cos;
const ease = { out: (u) => 1 - (1 - u) ** 3, in: (u) => u * u * u, io: (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2), back: (u) => 1 + 2.7 * (u - 1) ** 3 + 1.7 * (u - 1) ** 2 };
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;

// ------------------------------------------------------------------------------------------ shared
class Boss extends Actor {
  constructor(o) {
    super({ team: 1, heavy: true, ...o });
    this.state = "intro"; this.st0 = 0; this.cool = 2; this.marks = []; this.phase = 1; this.step = 0;
    this.invuln = 99; this.stats = { atk: o.atk, crit: 0, critDmg: 1.5 };
    this.introT = 0; this.atk = null;
    // body squash & stretch: a bouncy spring per axis around 1, kicked by squash()
    this.jx = 1; this.jy = 1; this.jvx = 0; this.jvy = 0;
    this._draw = this.draw; this.draw = (p) => this.jellyDraw(p);
    this.jf = null;
  }
  get hero() { return this.world.hero; }
  /** Kick the body: sx/sy are the scale it is thrown toward (e.g. 1.12, 0.86 for a heavy landing). */
  squash(sx, sy, k = 1) { this.jvx += (sx - 1) * 7 * k; this.jvy += (sy - 1) * 7 * k; }
  jelly(dt) {
    const K = 190, Z = 0.4, D = 2 * Math.sqrt(K) * Z, breath = this.state === "dying" ? 0 : Math.sin(this.t * 2.1) * 0.012;
    this.jvx += ((1 - breath * 0.5 - this.jx) * K - this.jvx * D) * dt; this.jx += this.jvx * dt;
    this.jvy += ((1 + breath - this.jy) * K - this.jvy * D) * dt; this.jy += this.jvy * dt;
    // never further than ±10%: a boss should wobble, not flatten
    if (this.jx < 0.9 || this.jx > 1.1) { this.jx = clamp(this.jx, 0.9, 1.1); this.jvx *= -0.3; }
    if (this.jy < 0.9 || this.jy > 1.1) { this.jy = clamp(this.jy, 0.9, 1.1); this.jvy *= -0.3; }
    // keep the volume roughly constant: a squash widens, a stretch narrows
  }
  /** Where the squash is anchored (feet for walkers; overridden by flyers). */
  jellyPivot() { return [this.x, this.y - this.z]; }
  jellyDraw(p) {
    const sx = this.jx, sy = this.jy;
    // the body is redrawn 24 times a second into a private frame (bosses are big) and stamped every frame,
    // scaled about the pivot for squash and stretch (nearest pixel, so it stays crisp)
    const [px, py] = this.jellyPivot(), FW = 380, FH = 300;
    if (!this.jf) this.jf = createFrame(FW, FH, 0, 0);
    const F = this.jf, now = this.world.time;
    if (this.jfAt === undefined || now - this.jfAt >= 1 / 24 || now < this.jfAt || this.hitFlash > 0 !== this.jfFlash) {
      F.ox = Math.round(px) - 190; F.oy = Math.round(py) - 240; clearFrame(F);
      this._draw(painterFor(F));
      this.jfAt = now; this.jfFlash = this.hitFlash > 0; this.jfP = [px, py];
    }
    const ox = F.ox + Math.round(px - this.jfP[0]), oy = F.oy + Math.round(py - this.jfP[1]);
    const x0 = Math.floor(px - (px - ox) * sx), x1 = Math.ceil(px + (ox + FW - px) * sx), y0 = Math.floor(py - (py - oy) * sy), y1 = Math.ceil(py + (oy + FH - py) * sy);
    const C = F.color, L = F.light;
    for (let Y = y0; Y < y1; Y++) {
      const sy0 = Math.round(py + (Y + 0.5 - py) / sy - 0.5) - oy; if (sy0 < 0 || sy0 >= FH) continue;
      const row = sy0 * FW;
      for (let X = x0; X < x1; X++) {
        const sx0 = Math.round(px + (X + 0.5 - px) / sx - 0.5) - ox; if (sx0 < 0 || sx0 >= FW) continue;
        const k = row + sx0, col = C[k], lt = L[k];
        if (col) { const al = col >>> 24; if (al >= 250) p.put(X, Y, col); else p.blendPx(X, Y, (col | 0xff000000) >>> 0, al / 255); }
        if (lt) p.add(X, Y, lt, 1);
      }
    }
  }
  /** A ground warning that fires after t seconds. kind: circle (r) or band (x0, x1, half depth). */
  mark(m) { this.marks.push({ ...m, T: m.t }); }
  drawGround(p) {
    super.drawGround(p);
    const red = hex("#ff3040"), hot = hex("#ffd0a0");
    for (const m of this.marks) {
      const k = 1 - m.t / m.T, blink = m.t < 0.25 && Math.floor(m.t * 30) % 2 === 0;
      if (m.band) {
        const [x0, x1, hd] = m.band;
        for (let y = -hd; y <= hd; y++) for (let x = x0; x <= x1; x++) {
          const edge = Math.abs(y) >= hd - 0.5 || x === x0 || x === x1;
          if (edge) p.blendPx(x, Math.round(m.y + y), blink ? hot : red, 0.85);
          else if (((x + y) & 3) === 0 || (x - x0) / (x1 - x0) < k) p.blendPx(x, Math.round(m.y + y), red, 0.12 + 0.2 * k);
        }
        continue;
      }
      const R = m.r;
      for (let a = 0; a < 120; a++) { const an = (a / 120) * Math.PI * 2; p.blendPx(Math.round(m.x + C(an) * R), Math.round(m.y + S(an) * R / DEPTH_K), blink ? hot : red, 0.9); }
      const r2 = R * ease.out(k);
      for (let y = -r2 / DEPTH_K; y <= r2 / DEPTH_K; y++) for (let x = -r2; x <= r2; x++)
        if ((x * x) / (r2 * r2) + (y * y * DEPTH_K * DEPTH_K) / (r2 * r2) <= 1 && ((Math.round(x) + Math.round(y)) & 1)) p.blendPx(Math.round(m.x + x), Math.round(m.y + y), red, 0.2);
    }
  }
  tickMarks(dt) {
    for (const m of this.marks) { m.t -= dt; if (m.t <= 0 && !m.fired) { m.fired = true; m.fire?.(); } }
    this.marks = this.marks.filter((m) => !m.fired);
  }
  hitHeroIn(x, y, r, dmg, kb = 140) {
    const h = this.hero;
    if (h && !h.dead && h.iframes <= 0 && Math.hypot(h.x - x, (h.y - y) * DEPTH_K) <= r + h.r) this.world.hit(this, h, { dmg, kb, from: [x, y], spark: false });
  }
  hitHeroBand(x0, x1, y, hd, dmg, kb = 160) {
    const h = this.hero;
    if (h && !h.dead && h.x >= x0 - h.r && h.x <= x1 + h.r && Math.abs(h.y - y) <= hd + 2) this.world.hit(this, h, { dmg, kb, from: [h.x - 20, y], spark: false });
  }
  /** Begin an attack: fn(t, dt, A) runs each frame until it returns true. */
  start(name, fn, extra = {}) { this.atk = { name, fn, t: 0, ...extra }; this.state = "attack"; this.squash(1.07, 0.93, 0.8); }
  onHurt(dmg) { if (this.state !== "dying") { this.flinch = 0.12; this.squash(1.035, 0.965, 0.6); } }
  die() {
    if (this.dead || this.state === "dying") return;
    this.hp = 1; this.state = "dying"; this.dieT = 0; this.marks = []; this.atk = null; this.invuln = 99;
    this.clearStatusFx();
    this.world.emit({ bossDying: this, slowmo: 1.6 });
    this.squash(0.9, 1.12, 1.2);
    sfx("boom");
  }
  finishDeath() {
    if (this.dead) return;
    this.dead = true; this.hp = 0; this.state = "dead";
    this.world.kills++;
    this.world.emit({ killed: this, bossDown: this, shake: 10, flash: 1 });
  }
  baseUpdate(dt) {
    this.physics(dt); this.tickMarks(dt); this.jelly(dt);
    if (this.flinch > 0) this.flinch -= dt;
    if (this.state === "intro") { this.introT += dt; if (this.introT >= this.introLen) { this.state = "idle"; this.invuln = 0; this.world.emit({ bossReady: this }); } return false; }
    if (this.state === "dying") { this.dieT += dt; this.dying(dt); return false; }
    if (this.dead) { this.deadT = (this.deadT ?? 0) + dt; if (this.deadT > 3) this.removed = true; return false; }
    if (this.hp < this.maxHp * 0.5 && this.phase === 1 && this.state !== "attack") { this.phase = 2; this.state = "phase"; this.phaseT = 0; this.invuln = 99; this.onPhase(); return false; }
    if (this.state === "phase") { this.phaseT += dt; if (this.phaseT > this.phaseLen) { this.state = "idle"; this.invuln = 0; this.cool = 0.6; } return false; }
    const h = this.hero; if (!h || h.dead) return false;
    if (this.state === "attack") {
      this.atk.t += dt;
      if (this.atk.fn(this.atk.t, dt, this.atk)) { this.atk = null; this.state = "idle"; this.cool = (this.phase === 2 ? 0.7 : 1.15) + Math.random() * 0.5; }
      return false;
    }
    return true; // free to move / choose
  }
}

// ------------------------------------------------------------------------------------------ Terragon
const ROCK = ramp(["#191830", "#272a48", "#383f62", "#4e5880", "#6a78a0", "#909fc0", "#c0cbe2"]);
const ROCK_HOT = ramp(["#1a0a10", "#2c1018", "#43181e", "#5c2422", "#7a3426", "#9c4a2c", "#c86a38"]);
const MOSS = ramp(["#132a1a", "#1d4026", "#2a5a30", "#3e7a3c", "#5c9a48"]);
const CRYS = ramp(["#3a2208", "#7a4a10", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"]);
const MAGMA = ramp(["#3a0a06", "#7a1a0a", "#c43a10", "#f26a1a", "#ffae35", "#ffe27a", "#ffffff"]);

export class StoneGiant extends Boss {
  constructor(o) {
    super({ r: 30, height: 120, shadowW: 96, ...o });
    this.name = "균열의 거신 테라곤"; this.title = "제5층의 수호자"; this.el = "earth"; this.speed = 24; this.ramp = ELEMENTS.earth.ramp;
    this.introLen = 2.8; this.phaseLen = 1.8;
    const K = 1.3, PI = Math.PI;
    // a hunched, knuckle-walking colossus: short legs, a great chest leaning forward, huge forearms
    const SP = PI - 0.4;
    this.sk = new Skeleton([
      { name: "hips", len: 0 },
      { name: "spine", parent: "hips", at: [0, 0], len: 34 * K, a0: SP, stiff: 0.8 },
      { name: "head", parent: "spine", at: [-9 * K, -1 * K], fromEnd: true, len: 14 * K, a0: -1.2, stiff: 0.6 },
      { name: "shF", parent: "spine", at: [4 * K, -7 * K], fromEnd: true, len: 24 * K, a0: -0.05 - SP },
      { name: "foreF", parent: "shF", fromEnd: true, len: 25 * K, a0: 0.2, stiff: 0.8 },
      { name: "fistF", parent: "foreF", fromEnd: true, len: 7 * K, a0: 0, stiff: 0.6 },
      { name: "thighF", parent: "hips", at: [-6 * K, 0], len: 14 * K, a0: 0.5 },
      { name: "shinF", parent: "thighF", fromEnd: true, len: 15 * K, a0: -0.75 },
      { name: "thighN", parent: "hips", at: [6 * K, 0], len: 14 * K, a0: 0.5 },
      { name: "shinN", parent: "thighN", fromEnd: true, len: 15 * K, a0: -0.75 },
      { name: "shN", parent: "spine", at: [5 * K, -9 * K], fromEnd: true, len: 24 * K, a0: 0.15 - SP },
      { name: "foreN", parent: "shN", fromEnd: true, len: 25 * K, a0: 0.25, stiff: 0.8 },
      { name: "fistN", parent: "foreN", fromEnd: true, len: 7 * K, a0: 0, stiff: 0.6 },
    ]);
    this.K = K; this.hipY = -26 * K;
    this.sk.root.y = this.hipY + 40;
    this.debris = Array.from({ length: 6 }, (_, i) => ({ a: (i / 6) * Math.PI * 2, r: 52 + (i % 3) * 8, y: -70 + (i % 2) * 18, s: 2.5 + (i % 3) }));
    this.fly = []; this.flip = true; this.walkT = 0; this.stepSide = 0;
    this.moss = Array.from({ length: 4 }, () => new Strand(6, 3, 200, 0.9));
  }
  onPhase() {
    const w = this.world;
    this.squash(0.9, 1.14, 1.4);
    w.emit({ banner: "테라곤의 껍질이 깨진다!", color: "#ff8a2a", shake: 8, flash: 0.6 });
    sfx("boom");
    // chunks of crust fly off
    for (let i = 0; i < 14; i++) this.fly.push({ x: this.x + (Math.random() - 0.5) * 60, y: this.y - 50 - Math.random() * 40, vx: (Math.random() - 0.5) * 220, vy: -120 - Math.random() * 120, r: 3 + Math.random() * 5, t: 0, ground: this.y + (Math.random() - 0.5) * 30 });
    w.fx("explosions/big-explosion", { x: this.x, y: this.y + 2, light: 1, ramp: MAGMA.map((c) => "#" + [c & 255, (c >> 8) & 255, (c >> 16) & 255].map((v) => v.toString(16).padStart(2, "0")).join("")) });
  }
  update(dt) {
    // flying crust bits
    for (const f of this.fly) { f.t += dt; f.vy += 520 * dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.y > f.ground) { f.y = f.ground; f.vy *= -0.3; f.vx *= 0.6; } }
    this.fly = this.fly.filter((f) => f.t < 3);
    const free = this.baseUpdate(dt);
    this.animate(dt);
    if (!free) return;
    const h = this.hero, dx = h.x - this.x, dy = h.y - this.y;
    this.flip = dx < 0;
    const sp = this.phase === 2 ? 1.4 : 1;
    this.moving = false;
    if (Math.abs(dx) > 70 || Math.abs(dy) > 12) { this.x += Math.sign(dx) * this.speed * sp * dt * (Math.abs(dx) > 70 ? 1 : 0.2); this.y += Math.sign(dy) * this.speed * 0.8 * sp * dt; this.moving = true; }
    this.cool -= dt;
    if (this.cool > 0 || !this.canAct) return;
    const order = this.phase === 2 ? ["slam", "rain", "sweep", "slam2", "spikes"] : ["slam", "sweep", "rain", "spikes"];
    const pick = Math.abs(dx) < 90 && this.step % 2 === 0 ? "slam" : order[this.step % order.length];
    this.step++;
    this[pick === "slam2" ? "atkSlam" : "atk" + pick[0].toUpperCase() + pick.slice(1)](pick === "slam2");
  }

  // ---- attacks
  atkSlam(double) {
    const w = this.world, h = this.hero, sp = this.phase === 2 ? 1.25 : 1;
    const f = this.flip ? -1 : 1;
    const tx = clamp(h.x, this.x + f * 30 - 90, this.x + f * 30 + 90), ty = h.y;
    const T = 1.0 / sp;
    this.mark({ x: tx, y: ty, r: 46, t: T });
    sfx("door");
    let hits = 0;
    this.start("slam", (t) => {
      this.aim = [tx, ty];
      if (!this.wound && t >= T * 0.6) { this.wound = true; this.squash(0.93, 1.1, 1); }
      if (t >= T && hits === 0) {
        hits = 1; this.wound = false; this.squash(1.16, 0.82, 1.4);
        w.fx("impacts/ground-slam", { x: tx, y: ty, light: 1, ramp: this.phase === 2 ? undefined : ELEMENTS.earth.ramp, opts: { reach: 90 }, dur: 0.8 });
        w.fx("explosions/dirt-explosion", { x: tx, y: ty + 1, light: 0.7, dur: 0.9 });
        this.hitHeroIn(tx, ty, 48, this.stats.atk * 1.5, 220);
        w.emit({ shake: 9 }); sfx("boom");
        // a shockwave ring rolls out
        this.ring(tx, ty, 120);
        if (double) this.world.after(0.15, () => this.atkSlam(false));
      }
      return t > T + 0.7 / sp;
    }, { T });
  }
  ring(x, y, R) {
    const w = this.world, t0 = w.time, hitDone = { v: false };
    w.addRunner(() => {
      const r = (w.time - t0) * 220;
      this.rings = this.rings ?? [];
      const h = this.hero;
      if (h && !hitDone.v && h.z < 4 && Math.abs(Math.hypot(h.x - x, (h.y - y) * DEPTH_K) - r) < 8 && r > 50) { hitDone.v = true; w.hit(this, h, { dmg: this.stats.atk * 0.6, kb: 120, from: [x, y], spark: false }); }
    }, R / 220);
    (this.rings ??= []).push({ x, y, t0, R });
  }
  atkSweep() {
    const w = this.world, h = this.hero, sp = this.phase === 2 ? 1.25 : 1, f = this.flip ? -1 : 1;
    const y = h.y, x0 = Math.min(this.x, this.x + f * 190), x1 = Math.max(this.x, this.x + f * 190);
    const T = 0.95 / sp;
    this.mark({ band: [Math.round(x0), Math.round(x1), 9], y, t: T });
    sfx("door");
    let hit = false;
    this.start("sweep", (t) => {
      if (t >= T && !hit) {
        hit = true;
        this.hitHeroBand(x0, x1, y, 10, this.stats.atk * 1.3, 240); this.squash(1.12, 0.9, 1.1);
        w.emit({ shake: 6 }); sfx("swing");
        for (let i = 0; i < 6; i++) w.after(i * 0.03, () => w.fx("impacts/blunt-hit", { x: this.x + f * (30 + i * 28), y: y + 1, light: 0.6, dur: 0.4 }));
      }
      return t > T + 0.65 / sp;
    }, { T, y });
  }
  atkRain() {
    const w = this.world, h = this.hero, n = this.phase === 2 ? 10 : 7;
    w.emit({ shake: 4 }); sfx("door");
    this.start("rain", (t, dt, A) => {
      A.k = A.k ?? 0;
      while (A.k < n && t > 0.55 + A.k * 0.16) {
        const x = clamp(h.x + (Math.random() - 0.5) * 120, w.arena.x0 + 10, w.arena.x1 - 10), y = clamp(h.y + (Math.random() - 0.5) * 60, w.arena.y0, w.arena.y1);
        const fall = 0.75;
        this.mark({ x, y, r: 16, t: fall });
        w.projs.push(new FallingRock({ x, y, fall, boss: this, r: 4 + Math.random() * 4, hot: this.phase === 2 }));
        A.k++;
      }
      return t > 0.55 + n * 0.16 + 0.9;
    });
  }
  atkSpikes() {
    const w = this.world, h = this.hero, f = Math.sign(h.x - this.x) || 1;
    const n = this.phase === 2 ? 6 : 5, ang = Math.atan2(h.y - this.y, h.x - this.x);
    sfx("door");
    this.start("spikes", (t, dt, A) => {
      A.k = A.k ?? 0;
      while (A.k < n && t > 0.5 + A.k * 0.14) {
        const d = 40 + A.k * 34, x = this.x + C(ang) * d, y = this.y + S(ang) * d * 0.6;
        if (A.k === 0) this.squash(1.12, 0.88, 1.2);
        this.mark({ x, y, r: 18, t: 0.42, fire: () => { this.hitHeroIn(x, y, 20, this.stats.atk * 1.1, 60); w.emit({ shake: 2 }); } });
        w.fx("nature/earth-spike", { x, y, light: 0.9, ramp: this.phase === 2 ? undefined : ELEMENTS.earth.ramp, opts: { height: 48 }, dur: 1.4 });
        A.k++;
      }
      return t > 0.5 + n * 0.14 + 0.8;
    });
  }

  // ---- motion
  /** Target pose for this instant, as bone offsets from rest plus root x / y / lean. */
  targetPose() {
    const t = this.t, st = this.state, A = this.atk, K = this.K, f = this.flip ? -1 : 1;
    const br = Math.sin(t * 1.7), look = this.hero ? clamp((this.hero.y - this.y) / 80, -1, 1) * 0.15 : 0;
    // idle: breathing chest, shoulders rolling, fists planted, head following the hero
    let P = { spine: 0.04 * br, head: look - 0.04 * br, shN: -0.05 * br, shF: 0.04 * br, foreN: 0.05 * br, foreF: -0.04 * br, x: 0, y: this.hipY + 1.5 * br, lean: 0 };
    if (this.moving) {
      // a knuckle-walk: the fists swing forward and plant, the legs follow, the whole body rolls with each step
      const w = this.walkT * 4.2, s1 = Math.sin(w), c1 = Math.cos(w);
      P = { ...P, spine: 0.05 + 0.04 * c1, shN: -0.45 * s1, foreN: 0.25 * Math.max(0, s1), shF: 0.45 * s1, foreF: 0.25 * Math.max(0, -s1), thighN: 0.4 * s1, shinN: -0.35 * Math.max(0, -s1), thighF: -0.4 * s1, shinF: -0.35 * Math.max(0, s1), y: this.hipY - Math.abs(c1) * 3 * K, lean: 0.03 * c1, head: look + 0.05 * c1 };
    }
    if (st === "attack" && A) {
      const u = A.t;
      if (A.name === "slam") {
        // rear up, both fists high over the head, then come down with everything
        const T = A.T, reach = this.aim ? clamp(f * (this.aim[0] - this.x) - 62 * K, -10, 40) : 0;
        P = keys([
          [0, P],
          [T * 0.72, { spine: -0.75, head: -0.45, shN: 3.0, foreN: 0.5, shF: 2.9, foreF: 0.55, thighN: -0.2, thighF: 0.15, shinN: 0.1, y: this.hipY - 6 * K, lean: -0.05, x: -4 }, "out"],
          [T * 0.88, { spine: -0.82, head: -0.5, shN: 3.15, foreN: 0.6, shF: 3.05, foreF: 0.65, thighN: -0.22, thighF: 0.15, y: this.hipY - 7 * K, x: -5 }, "io"],
          [T, { spine: 0.42, head: 0.35, shN: 0.15, foreN: -0.1, shF: 0.05, foreF: -0.1, thighN: 0.55, shinN: -0.75, thighF: 0.25, shinF: -0.6, y: this.hipY + 9 * K, lean: 0.06, x: reach }, "in"],
          [T + 0.18, { spine: 0.5, head: 0.45, shN: 0.1, foreN: -0.15, shF: 0, foreF: -0.15, thighN: 0.6, shinN: -0.8, thighF: 0.3, shinF: -0.65, y: this.hipY + 10 * K, x: reach }, "back"],
          [T + 0.75, { ...P, x: reach * 0.3 }, "io"],
        ], u);
      } else if (A.name === "sweep") {
        // wind the hammer arm far back, twist, and swing it low across the floor
        const T = A.T;
        P = keys([
          [0, P],
          [T * 0.8, { spine: -0.25, head: -0.2, shF: -1.6, foreF: 0.6, shN: 0.35, lean: -0.1, y: this.hipY - 2 }, "out"],
          [T, { spine: 0.35, head: 0.2, shF: 2.1, foreF: -0.1, shN: -0.3, lean: 0.12, thighN: 0.35, shinN: -0.5, y: this.hipY + 6 * K }, "in"],
          [T + 0.2, { spine: 0.4, head: 0.25, shF: 2.45, foreF: -0.2, shN: -0.35, lean: 0.14, thighN: 0.35, shinN: -0.5, y: this.hipY + 6 * K }, "back"],
          [T + 0.7, P, "io"],
        ], u);
      } else if (A.name === "rain") {
        // stand tall and beat the chest, roaring at the ceiling until it falls
        const beat = Math.sin(u * 16);
        const tall = { spine: -0.85, head: -0.55, shN: 1.4 + 0.5 * beat, foreN: 1.6 - 0.4 * beat, shF: 1.4 - 0.5 * beat, foreF: 1.6 + 0.4 * beat, y: this.hipY - 7 * K };
        P = keys([[0, P], [0.4, tall, "out"], [1.6, tall], [2.3, P, "io"]], u);
        if (u > 0.4 && u < 1.6) { P.shN = tall.shN; P.foreN = tall.foreN; P.shF = tall.shF; P.foreF = tall.foreF; }
      } else if (A.name === "spikes") {
        // lift one fist and punch it into the ground; the spikes run out from there
        P = keys([
          [0, P],
          [0.4, { spine: -0.3, head: -0.2, shN: 2.6, foreN: 0.7, y: this.hipY - 3 }, "out"],
          [0.5, { spine: 0.45, head: 0.3, shN: 0.2, foreN: -0.1, thighN: 0.5, shinN: -0.7, y: this.hipY + 8 * K }, "in"],
          [0.65, { spine: 0.5, head: 0.35, shN: 0.15, foreN: -0.15, thighN: 0.5, shinN: -0.7, y: this.hipY + 9 * K }, "back"],
          [1.4, P, "io"],
        ], u);
      }
    }
    if (st === "intro") {
      // rises out of the ground, stands up, roars
      const u = this.introT;
      P = keys([
        [0, { spine: 0.6, head: 0.6, shN: 0.4, shF: 0.4, y: this.hipY + 70, lean: 0.1 }],
        [1.6, { spine: 0.2, head: 0.3, y: this.hipY + 4 }, "out"],
        [2.0, { spine: -0.8, head: -0.6, shN: 1.9, foreN: 1.0, shF: 1.9, foreF: 1.0, y: this.hipY - 8 * K }, "io"],
        [2.5, { spine: -0.85, head: -0.65, shN: 2.1, foreN: 1.1, shF: 2.1, foreF: 1.1, y: this.hipY - 8 * K }],
        [2.8, P, "io"],
      ], u);
    }
    if (st === "phase") {
      const u = this.phaseT, roar = { spine: -0.9, head: -0.7, shN: 2.4, foreN: 0.2, shF: 2.4, foreF: 0.2, y: this.hipY - 8 * K };
      P = keys([[0, P], [0.35, roar, "out"], [1.4, { ...roar, spine: -0.95 }], [1.8, P, "io"]], u);
    }
    if (st === "dying") {
      const u = this.dieT;
      P = keys([[0, P], [0.4, { spine: -0.6, head: -0.6, shN: 1.8, shF: 1.6, y: this.hipY - 4 }, "out"], [1.6, { spine: 0.9, head: 0.8, shN: 0.6, foreN: 0.8, shF: 0.4, foreF: 0.8, thighN: 1.2, shinN: -1.6, thighF: 1.0, shinF: -1.5, y: this.hipY + 22 * K, lean: 0.1 }, "in"]], u);
    }
    if (this.flinch > 0) { P.spine = (P.spine ?? 0) - 0.12; P.head = (P.head ?? 0) - 0.2; }
    return P;
  }

  animate(dt) {
    if (this.moving) this.walkT += dt;
    const P = this.targetPose(), fast = this.state === "attack" || this.state === "dying";
    // looser springs than before: limbs overshoot a little and settle, so every pose lands with weight
    this.sk.drive(P, dt, fast ? 170 : 60, fast ? 13 : 7.5, { x: P.x ?? 0, y: P.y ?? this.hipY, lean: P.lean ?? 0 });
    // heavy footfalls shake the room
    if (this.moving) { const s = Math.sign(Math.sin(this.walkT * 4.2)); if (s !== this.stepSide) { this.stepSide = s; this.world.emit({ shake: 2 }); sfx("door"); this.squash(1.05, 0.95, 0.7); } }
    // chest beats while it calls the rocks down
    if (this.state === "attack" && this.atk?.name === "rain") { const b = Math.floor(this.atk.t * 5.1); if (b !== this.beat) { this.beat = b; if (this.atk.t > 0.4 && this.atk.t < 1.6) this.squash(1.04, 0.97, 0.6); } }
  }

  dying(dt) {
    const w = this.world, u = this.dieT;
    if (Math.floor(u * 7) !== Math.floor((u - dt) * 7) && u < 1.6) {
      w.fx(Math.random() < 0.5 ? "explosions/small-explosion" : "impacts/crit-hit", { x: this.x + (Math.random() - 0.5) * 70, y: this.y + 1, z: 20 + Math.random() * 80, light: 1, dur: 0.8, top: true, opts: { size: 0.7 } });
      w.emit({ shake: 4 }); sfx("boom");
    }
    if (u >= 1.7 && !this.broke) {
      this.broke = true;
      for (let i = 0; i < 28; i++) this.fly.push({ x: this.x + (Math.random() - 0.5) * 90, y: this.y - Math.random() * 90, vx: (Math.random() - 0.5) * 260, vy: -80 - Math.random() * 220, r: 4 + Math.random() * 8, t: 0, ground: this.y + (Math.random() - 0.5) * 40 });
      w.fx("explosions/big-explosion", { x: this.x, y: this.y + 2, light: 1.2 });
      this.finishDeath();
    }
  }

  // ---- drawing
  // Terragon is a living mountain: lumpy boulders for limbs, amber rift-light running through organic cracks,
  // crystal spires and a little forest on its back, moss hanging from its shoulders, a horned skull with
  // burning eyes. At half health the crust splits and the light turns to magma.
  draw(p) {
    if (this.dead && this.broke) return this.drawDebris(p, 1);
    const K = this.K, f = this.flip ? -1 : 1, hot = this.phase === 2, t = this.t;
    const W = this.sk.solve(this.x, this.y - this.z, f);
    const flash = this.hitFlash > 0 ? hex("#ffffff") : null;
    const R = hot ? ROCK_HOT : ROCK, glowC = hot ? hex("#ff6a2a") : hex("#ffc24a"), core = hot ? MAGMA : CRYS;
    const pulse = (S(t * (hot ? 8 : 3.2)) + 1) / 2;
    const vein = hot ? MAGMA[4 + Math.round(pulse)] : CRYS[3 + Math.round(pulse)], veinDk = hot ? MAGMA[2] : CRYS[1];
    // rift-light in a few long, deliberate seams (low-frequency noise ridges), not a web of hairline cracks
    const cracks = (seed, wide = 1) => (u, v, d, sh) => {
      if (d > -2) return 0;
      const n = Math.abs(noise2(u * 0.045 + seed, v * 0.05 - seed, seed)), w = (hot ? 0.06 : 0.04) * wide;
      return n < w * 0.5 ? vein : n < w ? veinDk : 0;
    };
    // moss sits in soft caps on the sunlit tops of the boulders
    const mossy = (seed) => (u, v, d, sh) => (!hot && sh > 0.74 && noise2(u * 0.07 + seed, v * 0.07, seed) > 0.05 ? (sh > 0.88 ? MOSS[4] : MOSS[3]) : 0);
    const both = (...fs) => (u, v, d, sh) => { for (const fn of fs) { const c = fn(u, v, d, sh); if (c) return c; } return 0; };
    // a lumpy boulder stretched along a bone
    const rockLimb = (len, w0, w1, seed) => (u, v) => { const k = clamp(v / len); return sd.rock(u, v - len / 2, w0 + (w1 - w0) * k, len / 2 + 3, seed, 0.16, 9); };
    const O = (extra) => ({ ramp: R, tint: flash, soft: 5, rim: R[R.length - 1], ...extra });
    const at = (B, along, across) => [B.x + f * (along * Math.sin(B.a) + across * Math.cos(B.a)), B.y + along * Math.cos(B.a) - across * Math.sin(B.a)];
    const crystal = (x, y, h, wdt, rot, k = 1) => sculpt(p, x, y, (u, v) => sd.poly(u, v, [[-wdt * K, 0], [-wdt * 0.4 * K, -h * 0.72 * K], [0, -h * K], [wdt * 0.5 * K, -h * 0.6 * K], [wdt * K, 0], [0, 3 * K]]), { ramp: core, r: (h + 6) * K, rot, tint: flash, soft: 2, glow: [glowC, 0.4 * k], paint: (u, v) => (Math.abs(u + v * 0.08) < 0.6 ? core[core.length - 1] : 0) });
    // the ground glows under it
    glow(p, this.x, this.y - 2, 70 * K, glowC, 0.07 + pulse * 0.04);
    // far leg and far arm (dimmer, behind)
    const OF = (extra) => O({ ramp: R.map((c) => mix(c, hex("#07060c"), 0.28)), rim: R[R.length - 2], ...extra });
    part(p, W.thighF, f, rockLimb(W.thighF.len, 9 * K, 8 * K, 2), OF({ r: 30 * K }));
    part(p, W.shinF, f, rockLimb(W.shinF.len, 8 * K, 10 * K, 3), OF({ r: 30 * K }));
    part(p, W.shF, f, rockLimb(W.shF.len, 9 * K, 7.5 * K, 4), OF({ r: 34 * K }));
    part(p, W.foreF, f, rockLimb(W.foreF.len, 7 * K, 9.5 * K, 5), OF({ r: 36 * K }));
    part(p, W.fistF, f, (u, v) => sd.rock(u, v - 6 * K, 12 * K, 10 * K, 6, 0.2, 7), OF({ r: 24 * K, paint: cracks(6, 1.4) }));
    // hips and the great chest: a cliff of stacked boulders
    part(p, W.spine, f, (u, v) => sd.rock(u, v - 3 * K, 19 * K, 11 * K, 7, 0.18, 8), O({ r: 26 * K }));
    part(p, W.spine, f, (u, v) => Math.min(sd.rock(u, v - 21 * K, 26 * K, 22 * K, 8, 0.13, 11), sd.rock(u - 7 * K, v - 31 * K, 20 * K, 15 * K, 9, 0.2, 8), sd.rock(u + 12 * K, v - 12 * K, 13 * K, 11 * K, 10, 0.2, 7)), O({ r: 48 * K, paint: both(cracks(8, 1.2), mossy(3)) }));
    // a ridge of crystal spires and little pines along the back (the spine's +u side)
    for (const [along, h, tilt, w2] of [[13, 20, 0.35, 4], [22, 30, 0.08, 5], [31, 18, -0.25, 3.8]]) {
      const [cx, cy] = at(W.spine, along * K, 21 * K), mid = [W.spine.x + (W.spine.ex - W.spine.x) * 0.5, W.spine.y + (W.spine.ey - W.spine.y) * 0.5];
      const dir = Math.atan2(cy - mid[1], cx - mid[0]);
      crystal(cx, cy, h * (hot ? 1.1 : 1), w2, -(dir + Math.PI / 2) + tilt * f, 1);
    }
    if (false) for (const [along, h] of [[6, 9], [36, 7], [20, 6]]) {
      const [tx, ty] = at(W.spine, along * K, 25 * K);
      const pine = hex("#1d4026"), pine2 = hex("#3e7a3c");
      for (let j = 0; j < h * K; j++) { const wd = Math.round((j / (h * K)) * 3 * K * 0.6) + 1; for (let i = -wd; i <= wd; i++) p.put(Math.round(tx + i), Math.round(ty - h * K + j), i < 0 ? pine2 : pine); }
      p.put(Math.round(tx), Math.round(ty + 1), hex("#3a2412"));
    }
    // the heart: a crystal set in the chest, beating
    const [hx, hy] = at(W.spine, 21 * K, -13 * K);
    glow(p, hx, hy, (30 + pulse * 12) * K, glowC, 0.2 + pulse * 0.14);
    sculpt(p, hx, hy, (u, v) => sd.poly(u, v, [[0, -10 * K], [7 * K, -2 * K], [5 * K, 7 * K], [0, 10 * K], [-5 * K, 7 * K], [-7 * K, -2 * K]]), { ramp: core, r: 15 * K, tint: flash, glow: [glowC, 0.6], soft: 3, paint: (u, v) => (Math.abs(u) < 0.7 && v < 4 * K ? core[core.length - 1] : 0) });
    for (let i = 0; i < 5; i++) { const an = i / 5 * Math.PI * 2 + t * 0.8; energy(p, hx, hy, hx + C(an) * (12 + pulse * 6) * K, hy + S(an) * (10 + pulse * 5) * K, core[core.length - 2], glowC, 1, 0.12 + pulse * 0.1); }
    // near leg
    part(p, W.thighN, f, rockLimb(W.thighN.len, 10 * K, 9 * K, 12), O({ r: 30 * K, paint: mossy(12) }));
    part(p, W.shinN, f, rockLimb(W.shinN.len, 8.5 * K, 11 * K, 13), O({ r: 30 * K }));
    // near arm: a boulder pauldron crowned with crystals and trailing moss, a cracked forearm, a crystal fist
    part(p, W.shN, f, rockLimb(W.shN.len, 9.5 * K, 8 * K, 14), O({ r: 34 * K }));
    part(p, W.shN, f, (u, v) => sd.rock(u, v - 1 * K, 15 * K, 12 * K, 15, 0.2, 8), O({ r: 28 * K, paint: mossy(5) }));
    const [px0, py0] = at(W.shN, 0, 0);
    for (const [ox, h, a2] of [[-3, 16, -0.2], [5, 11, 0.35]]) crystal(px0 + ox * K * f, py0 - 9 * K, h, 2.8, a2 * f, 0.8);
    if (false) this.moss.forEach((m, i) => {
      const [mx, my] = at(W.shN, (4 + i * 4) * K, (-10 + i * 5) * K);
      m.update([mx, my], 1 / 60, [S(t * 1.3 + i) * 30, 0]);
      for (let k = 1; k < m.p.length; k++) energy(p, m.p[k - 1].x, m.p[k - 1].y, m.p[k].x, m.p[k].y, MOSS[3], MOSS[1], 1, 0);
    });
    part(p, W.foreN, f, rockLimb(W.foreN.len, 8 * K, 10.5 * K, 16), O({ r: 36 * K, paint: cracks(16, 1.2) }));
    part(p, W.fistN, f, (u, v) => sd.rock(u, v - 5 * K, 12 * K, 10 * K, 17, 0.2, 7), O({ r: 24 * K, paint: cracks(17, 1.5) }));
    for (const [ox, oy, h] of [[5, 3, 12], [-5, 3, 10]]) { const [cx, cy] = at(W.fistN, (oy + 9) * K, ox * K); crystal(cx, cy, h, 2.4, W.fistN.wa + Math.PI, 0.7); }
    // head: a horned skull with a heavy brow and a hanging jaw
    part(p, W.head, f, (u, v) => Math.min(sd.rock(u, v - 8 * K, 13 * K, 11.5 * K, 18, 0.12, 8), sd.rock(u + 2 * K, v - 16 * K, 9 * K, 4.5 * K, 19, 0.2, 6)), O({ r: 22 * K, paint: mossy(9) }));
    part(p, W.head, f, (u, v) => sd.rock(u - 6 * K, v - 8 * K, 4 * K, 9 * K, 20, 0.2, 6), O({ r: 16 * K }));
    // two great crystal horns sweeping back over the shoulders
    for (const [along, across, len, curl] of [[5, 8, 20, 0.9], [3, 5, 15, 0.7]]) {
      const [cx, cy] = at(W.head, along * K, across * K);
      const pts = []; for (let i = 0; i <= 8; i++) { const k = i / 8, an = -Math.PI / 2 - k * curl; pts.push([C(an) * k * len * K * 0.6 - k * k * 6 * K, S(an) * k * len * K]); }
      sculpt(p, cx, cy, (u, v) => { let d = 1e9; for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], ex = bx - ax, ey = by - ay, q = clamp(((u - ax) * ex + (v - ay) * ey) / (ex * ex + ey * ey)); d = Math.min(d, Math.hypot(u - ax - ex * q, v - ay - ey * q) - (3.4 - (i / 8) * 3) * K); } return d; }, { ramp: core, r: (len + 6) * K, flip: f < 0, tint: flash, soft: 2, glow: [glowC, 0.35] });
    }
    // burning eyes under the brow, each trailing a wisp of light
    for (const dd of [-2.8, 2.8]) {
      const [ex, ey] = at(W.head, (11 + dd * 0.4) * K, -3 * K);
      const ec = hot ? hex("#ff5030") : hex("#fff6c4");
      for (let i = -1; i <= 1; i++) p.put(Math.round(ex) + i, Math.round(ey), i === 0 ? hex("#ffffff") : ec);
      glow(p, ex, ey, 7 * K, hot ? hex("#ff5030") : hex("#ffe27a"), 0.55);
      for (let k = 1; k < 7; k++) p.put(Math.round(ex - f * k * 1.5), Math.round(ey - k * 0.6 + S(t * 6 + k) * 0.6), ec, 1 - k / 7);
    }
    // dust and rift sparks rising off it (embers when angry)
    for (let i = 0; i < (hot ? 16 : 9); i++) { const ph = (t * (hot ? 0.7 : 0.35) + i / 12) % 1; const x = Math.round(this.x + S(i * 2.7 + t * 0.6) * 48 * K), y = Math.round(this.y - 10 * K - ph * 100 * K); p.put(x, y, hot ? MAGMA[ph < 0.5 ? 5 : 3] : CRYS[ph < 0.5 ? 5 : 3], 1 - ph); p.add(x, y, glowC, 0.45 * (1 - ph)); }
    // orbiting debris, bound by threads of light
    for (const d of this.debris) {
      d.a += (hot ? 2.2 : 1) * 0.016;
      if (S(d.a) <= 0) continue;
      const x = this.x + C(d.a) * d.r * K, y = this.y + d.y * K + S(d.a) * 12;
      sculpt(p, x, y, (u, v) => sd.rock(u, v, d.s * K, d.s * 0.8 * K, d.r, 0.25, 5), { ramp: R, r: d.s * K + 3, tint: flash });
      glow(p, x, y, d.s * K * 2, glowC, 0.12);
    }
    this.drawDebris(p, 0);
    if (this.rings) {
      this.rings = this.rings.filter((r) => this.world.time - r.t0 < r.R / 220);
      for (const r of this.rings) {
        const rr = (this.world.time - r.t0) * 220, k = 1 - rr / r.R;
        for (let a2 = 0; a2 < 180; a2++) { const an = (a2 / 180) * Math.PI * 2, x = Math.round(r.x + C(an) * rr), y = Math.round(r.y + S(an) * rr / DEPTH_K); p.put(x, y, core[4], k); p.put(x, y - 1, core[2], k * 0.8); p.add(x, y - 2, glowC, 0.35 * k); }
      }
    }
  }
  drawDebris(p, all) {
    for (const f of this.fly) sculpt(p, f.x, f.y, (u, v) => sd.rock(u, v, f.r, f.r * 0.8, f.r * 3, 0.25, 5), { ramp: this.phase === 2 ? ROCK_HOT : ROCK, r: f.r + 3, rot: f.t * 4, alpha: f.t > 2.4 ? 1 - (f.t - 2.4) / 0.6 : 1 });
  }
}

/** A boulder that drops out of the ceiling onto a marked spot. */
class FallingRock {
  constructor(o) { Object.assign(this, { t: 0, dead: false }, o); this.z = 260; this.rot = Math.random() * 6; }
  update(dt, w) {
    this.t += dt;
    this.z = 260 * (1 - ease.in(clamp(this.t / this.fall)));
    this.rot += dt * 5;
    if (this.t >= this.fall) {
      this.dead = true;
      w.fx("impacts/blunt-hit", { x: this.x, y: this.y + 1, light: 0.7, dur: 0.5 });
      if (this.hot) w.fx("fire/fire-ring", { x: this.x, y: this.y, light: 0.8, opts: { reach: 26 }, dur: 0.8 });
      this.boss.hitHeroIn(this.x, this.y, 18, this.boss.stats.atk * 0.9, 90);
      w.emit({ shake: 3 }); sfx("boom");
      this.boss.fly.push({ x: this.x, y: this.y - 4, vx: (Math.random() - 0.5) * 80, vy: -60, r: this.r * 0.6, t: 1.6, ground: this.y });
    }
  }
  draw(p) {
    sculpt(p, this.x, this.y - this.z - this.r, (u, v) => sd.rock(u, v, this.r * 1.4, this.r * 1.2, this.r * 7, 0.25, 6), { ramp: this.hot ? ROCK_HOT : ROCK, r: this.r * 2 + 3, rot: this.rot });
    if (this.hot) glow(p, this.x, this.y - this.z - this.r, this.r * 3, hex("#ff6a2a"), 0.3);
  }
}

// ------------------------------------------------------------------------------------------ Noctile
const CLOAK = ramp(["#07040e", "#100a1e", "#1b1030", "#2a1848", "#3d2366", "#56318a"]);
const MASK = ramp(["#3a3448", "#6a6480", "#a8a2bc", "#d8d2e8", "#f4f0ff", "#ffffff"]);
const HAND = ramp(["#2b1252", "#481c88", "#6b2cc0", "#9a48ec", "#c684ff", "#ecc8ff", "#ffffff"]);
const VOIDC = ramp(["#050308", "#140c22", "#261540", "#3a1f62", "#58308c", "#8048b8", "#b884ff", "#f0dcff"]);

export class VoidCaller extends Boss {
  constructor(o) {
    super({ r: 22, height: 130, shadowW: 60, flying: true, ...o });
    this.name = "공허의 마녀 녹틸레"; this.title = "심연의 지배자"; this.el = "dark"; this.speed = 34; this.ramp = ELEMENTS.dark.ramp;
    this.introLen = 3.0; this.phaseLen = 2.2;
    this.hover = 16; this.z = 16;
    this.hands = [{ x: 0, y: 0, tx: 0, ty: 0, open: 0, side: 1 }, { x: 0, y: 0, tx: 0, ty: 0, open: 0, side: -1 }];
    this.ribbons = [new Scarf(11, 6), new Scarf(9, 6), new Scarf(12, 6)];
    this.eyeOpen = 0; this.wing = 0; this.maskCrack = 0; this.beam = null; this.orbFlare = {};
    this.flip = true;
  }
  onAdd() {}
  jellyPivot() { return [this.x, this.y - 60]; }
  onPhase() {
    const w = this.world;
    w.emit({ banner: "공허의 눈이 열린다!", color: "#c684ff", shake: 7, flash: 0.7 });
    sfx("legend");
    w.fx("shadow/dark-explosion", { x: this.x, y: this.y + 2, light: 1, ramp: VOIDC.map(toHexC) });
  }
  update(dt) {
    const free = this.baseUpdate(dt);
    this.animate(dt);
    if (!free) return;
    const h = this.hero, dx = h.x - this.x, dy = h.y - this.y;
    this.flip = dx < 0;
    const want = 120, d = Math.hypot(dx, dy), mv = d > want + 20 ? 1 : d < want - 30 ? -1 : 0;
    this.x += (dx / (d || 1)) * this.speed * mv * dt; this.y += (dy / (d || 1)) * this.speed * 0.6 * mv * dt + S(this.t * 0.8) * 8 * dt;
    this.cool -= dt;
    if (this.cool > 0 || !this.canAct) return;
    const order = this.phase === 2 ? ["crush", "beam", "strike", "orbs", "hole", "crush", "summon", "rain"] : ["orbs", "crush", "strike", "beam", "hole", "summon"];
    const pick = order[this.step++ % order.length];
    this["atk" + pick[0].toUpperCase() + pick.slice(1)]();
  }

  // ---- attacks
  atkOrbs() {
    const w = this.world, h = this.hero, n = this.phase === 2 ? 9 : 6;
    this.start("orbs", (t, dt, A) => {
      if (t > 0.5 && !A.done) {
        A.done = true;
        const base = Math.atan2((h.y - this.y) / 0.55, h.x - this.x);
        for (let i = 0; i < n; i++) w.projs.push(new EnemyShot({ x: this.x, y: this.y + 0.5, z: 62, ang: base + (i - (n - 1) / 2) * 0.2, speed: 120, src: this, team: 1, color: ["#8048b8", "#f0dcff"], r: 6 }));
        if (this.phase === 2) w.after(0.35, () => { for (let i = 0; i < n; i++) w.projs.push(new EnemyShot({ x: this.x, y: this.y + 0.5, z: 62, ang: base + (i - (n - 2) / 2) * 0.2, speed: 100, src: this, team: 1, color: ["#8048b8", "#f0dcff"], r: 6 })); });
        sfx("zap");
      }
      return t > 1.0;
    });
  }
  atkCrush() {
    const w = this.world, h = this.hero, hand = this.hands[this.step % 2], T = this.phase === 2 ? 0.9 : 1.1;
    const tx = h.x, ty = h.y;
    this.mark({ x: tx, y: ty, r: 26, t: T });
    this.start("crush", (t, dt, A) => {
      A.hand = hand;
      // the hand rises over the target, hangs, then slams flat
      const up = ease.out(seg(t, 0, T * 0.7)), dn = ease.in(seg(t, T * 0.85, T));
      hand.tx = lerp(hand.x, tx, up); hand.ty = lerp(ty - 70, ty - 6, dn); hand.open = 1 - dn * 0.6; hand.override = true;
      if (t >= T && !A.hit) {
        A.hit = true;
        w.fx("shadow/grasping-hands", { x: tx, y: ty, light: 0.9, ramp: VOIDC.map(toHexC), dur: 1.2 });
        w.fx("shadow/dark-explosion", { x: tx, y: ty + 1, light: 0.8, ramp: VOIDC.map(toHexC), dur: 0.7 });
        this.hitHeroIn(tx, ty, 28, this.stats.atk * 1.4, 70);
        const hh = this.hero; if (hh && Math.hypot(hh.x - tx, (hh.y - ty) * DEPTH_K) < 30) hh.applyStatus({ root: 1.0 });
        this.squash(1.09, 0.92, 0.9); w.emit({ shake: 6 }); sfx("boom");
      }
      if (t > T + 0.5) { hand.override = false; return true; }
      return false;
    });
  }
  atkStrike() {
    const w = this.world, h = this.hero;
    const el = BASE_ELEMENTS[Math.floor(Math.random() * 4)];
    const id = { fire: "fire/flame-pillar", water: "water/geyser", wind: "lightning/lightning-strike", earth: "nature/earth-spike" }[el];
    const delay = { fire: 0.7, water: 1.2, wind: 0.8, earth: 0.42 }[el];
    const rp = el === "wind" ? ELEMENTS.wind.storm : ELEMENTS[el].ramp;
    const n = this.phase === 2 ? 4 : 3;
    this.orbFlare = { el, t: 1.6 };
    w.emit({ banner: `빼앗긴 ${ELEMENTS[el].name}의 힘`, color: ELEMENTS[el].css, small: true });
    this.start("strike", (t, dt, A) => {
      A.k = A.k ?? 0;
      while (A.k < n && t > 0.3 + A.k * 0.32) {
        const tx = h.x + (Math.random() - 0.5) * 24, ty = h.y;
        this.mark({ x: tx, y: ty, r: 24, t: delay + 0.1, fire: () => { this.hitHeroIn(tx, ty, 26, this.stats.atk * 1.3, 100); this.squash(1.09, 0.92, 0.9); w.emit({ shake: 3 }); } });
        w.fx(id, { x: tx, y: ty, ramp: rp, light: 0.95, dur: 2.2 });
        A.k++;
      }
      return t > 0.3 + n * 0.32 + 1.2;
    });
  }
  atkBeam() {
    const w = this.world, h = this.hero, A = w.arena, T = this.phase === 2 ? 0.95 : 1.15, y = h.y;
    const dir = h.x > this.x ? 1 : -1, x0 = dir > 0 ? this.x : A.x0, x1 = dir > 0 ? A.x1 : this.x;
    this.mark({ band: [Math.round(x0), Math.round(x1), 8], y, t: T });
    sfx("summon");
    this.start("beam", (t, dt, Aa) => {
      for (const hd of this.hands) { hd.override = true; hd.tx = this.x + dir * 22; hd.ty = this.y - 52 + hd.side * 6; hd.open = 1; }
      if (t >= T && t < T + 0.7) {
        this.beam = { y, x0, x1, t: t - T, dir };
        Aa.tick = (Aa.tick ?? 0) - dt;
        if (Aa.tick <= 0) { Aa.tick = 0.14; this.hitHeroBand(x0, x1, y, 9, this.stats.atk * 0.45, 60); }
        if (!Aa.shook) { Aa.shook = true; this.squash(1.09, 0.92, 0.9); w.emit({ shake: 5, flash: 0.3 }); sfx("zap"); }
      } else this.beam = null;
      if (t > T + 0.95) { for (const hd of this.hands) hd.override = false; this.beam = null; return true; }
      return false;
    });
  }
  atkHole() {
    const w = this.world, A = w.arena, cx = (A.x0 + A.x1) / 2 + (Math.random() - 0.5) * 120, cy = (A.y0 + A.y1) / 2;
    this.start("hole", (t, dt, Aa) => {
      if (!Aa.go && t > 0.5) {
        Aa.go = true;
        w.fx("shadow/black-hole", { x: cx, y: cy + 12, light: 1, dur: 3.4, ramp: VOIDC.map(toHexC) });
        w.addRunner((dt) => {
          const hh = this.hero; if (!hh || hh.dead) return;
          const ddx = cx - hh.x, ddy = cy - hh.y, dd = Math.hypot(ddx, ddy);
          if (dd > 4) { hh.x += (ddx / dd) * 50 * dt; hh.y += (ddy / dd) * 30 * dt; }
          if (dd < 22) { hh.blackT = (hh.blackT ?? 0) - dt; if (hh.blackT <= 0) { hh.blackT = 0.5; w.hit(this, hh, { dmg: this.stats.atk * 0.5, spark: false }); } }
        }, 3.4);
      }
      return t > 1.3;
    });
  }
  atkSummon() {
    const w = this.world, A = w.arena;
    this.start("summon", (t, dt, Aa) => {
      if (!Aa.go && t > 0.6) {
        Aa.go = true;
        for (let i = 0; i < (this.phase === 2 ? 3 : 2); i++) {
          const e = new Enemy("wisp", { x: A.x0 + 40 + Math.random() * (A.x1 - A.x0 - 80), y: A.y0 + Math.random() * (A.y1 - A.y0), el: "dark", scale: this.minionScale ?? 1, dmgScale: this.minionDmg ?? 1 });
          w.add(e);
        }
        sfx("summon");
      }
      return t > 1.2;
    });
  }
  atkRain() {
    const w = this.world, A = w.arena;
    this.start("rain", (t, dt, Aa) => {
      Aa.k = Aa.k ?? 0;
      while (Aa.k < 12 && t > 0.4 + Aa.k * 0.12) {
        const x = A.x0 + 20 + Math.random() * (A.x1 - A.x0 - 40), y = A.y0 + 6 + Math.random() * (A.y1 - A.y0 - 12);
        this.mark({ x, y, r: 16, t: 0.7, fire: () => { w.fx("shadow/dark-explosion", { x, y: y + 1, light: 0.8, ramp: VOIDC.map(toHexC), dur: 0.6 }); this.hitHeroIn(x, y, 18, this.stats.atk * 0.9, 80); } });
        Aa.k++;
      }
      return t > 0.4 + 12 * 0.12 + 0.8;
    });
  }

  // ---- motion
  animate(dt) {
    const t = this.t, f = this.flip ? -1 : 1;
    this.z = this.hover + S(t * 1.4) * 3;
    if (this.orbFlare.t > 0) this.orbFlare.t -= dt;
    const ph2 = this.phase === 2 || this.state === "phase";
    this.eyeOpen += ((ph2 ? 1 : 0) - this.eyeOpen) * (1 - Math.exp(-2 * dt));
    this.wing += ((ph2 ? 1 : 0) - this.wing) * (1 - Math.exp(-2.5 * dt));
    if (this.state === "dying") this.maskCrack = Math.min(1, this.dieT / 1.4);
    // hands float beside the body unless an attack is steering one
    this.hands.forEach((hd, i) => {
      if (!hd.override) {
        hd.tx = this.x + f * hd.side * 46 + f * 8; hd.ty = this.y - this.z - 44 + S(t * 1.8 + i * 1.7) * 6;
        hd.open = 0.5 + 0.2 * S(t * 2 + i);
        if (this.state === "attack" && ["orbs", "strike", "summon", "hole", "rain"].includes(this.atk?.name)) { hd.ty -= 24 * ease.out(seg(this.atk.t, 0, 0.4)); hd.open = 1; }
      }
      if (!hd.x) { hd.x = hd.tx; hd.y = hd.ty; }
      const k = 1 - Math.exp(-(hd.override ? 14 : 6) * dt);
      hd.x += (hd.tx - hd.x) * k; hd.y += (hd.ty - hd.y) * k;
    });
    const by = this.y - this.z;
    const vx = (this.x - (this.px ?? this.x)) / (dt || 1); this.px = this.x;
    this.ribbons.forEach((r, i) => r.update([this.x - f * (5 + i * 4), by - 84 + i * 4], dt, [vx - f * 40, 0], t + i));
  }

  dying(dt) {
    const w = this.world, u = this.dieT;
    if (Math.floor(u * 6) !== Math.floor((u - dt) * 6) && u < 1.8) {
      w.fx("lightning/zap-hit", { x: this.x + (Math.random() - 0.5) * 40, y: this.y + 1, z: this.z + 20 + Math.random() * 50, light: 1, ramp: VOIDC.map(toHexC), top: true });
      this.squash(1.09, 0.92, 0.9); w.emit({ shake: 3 }); sfx("zap");
    }
    if (u > 1.4 && !this.imploded) { this.imploded = true; w.fx("explosions/implosion", { x: this.x, y: this.y, z: this.z + 40, light: 1.2, top: true, ramp: VOIDC.map(toHexC) }); }
    if (u >= 2.1) {
      w.fx("shadow/dark-explosion", { x: this.x, y: this.y + 2, light: 1.3, ramp: VOIDC.map(toHexC) });
      w.fx("explosions/big-explosion", { x: this.x, y: this.y + 2, light: 1, ramp: VOIDC.map(toHexC) });
      this.finishDeath();
    }
  }

  // ---- drawing
  draw(p) {
    if (this.dead) return;
    const K = 1.4, t = this.t, f = this.flip ? -1 : 1, by = this.y - this.z, flash = this.hitFlash > 0 ? hex("#ffffff") : null;
    const intro = this.state === "intro" ? seg(this.introT, 0.3, 2.2) : 1;
    const fade = this.state === "dying" ? 1 - seg(this.dieT, 1.4, 2.1) : 1;
    const a = Math.min(1, intro * 1.3) * fade;
    if (a <= 0.02) return this.drawIntroSwirl(p, by);
    const X = (lx) => this.x + f * lx * K, Y = (ly) => by + ly * K;
    const purple = hex("#b884ff"), pale = hex("#f0dcff");
    // phase two: a vast eye opens behind her
    if (this.eyeOpen > 0.02) this.drawEye(p, this.x - f * 4, Y(-100), this.eyeOpen * a);
    // tendril wings
    if (this.wing > 0.02) for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
      const base = [this.x - f * 4, Y(-60)], ang = -Math.PI / 2 + s * (0.45 + i * 0.3) + S(t * 2 + i) * 0.08, L = (46 + i * 10) * K * this.wing;
      const pts = [];
      for (let k = 0; k <= 12; k++) { const u = k / 12, an = ang + S(t * 3 + i + u * 3) * 0.3 * u; pts.push([base[0] + C(an) * L * u, base[1] + S(an) * L * u]); }
      for (let k = 0; k < 12; k++) energy(p, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], k > 9 ? pale : VOIDC[3 + Math.min(3, k >> 2)], VOIDC[5], k < 5 ? 1 : 0, 0.45 * a);
    }
    // halo of runes behind the head
    const hx = X(1), hy = Y(-84), HR = 30 * K;
    for (let k = 0; k < 140; k++) {
      const an = (k / 140) * Math.PI * 2 + t * 0.25, x = Math.round(hx + C(an) * HR), y = Math.round(hy + S(an) * HR);
      p.put(x, y, k % 14 < 2 ? pale : VOIDC[4], a); p.add(x, y, purple, 0.12 * a);
      if (k % 14 === 0) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.put(x + dx, y + dy, pale, a);
    }
    for (let k = 0; k < 90; k++) { const an = (k / 90) * Math.PI * 2 - t * 0.4; if (k % 3) p.put(Math.round(hx + C(an) * (HR - 5)), Math.round(hy + S(an) * (HR - 5)), VOIDC[3], a); }
    // ribbons trailing from the shoulders
    this.ribbons.forEach((r) => r.draw(p, [VOIDC[1], VOIDC[2], VOIDC[4], VOIDC[6]], purple));
    // the cloak: a tall bell of night down to a tattered hem, a sky of stars inside
    sculpt(p, this.x, Y(-38), (u, v) => {
      const yy = v / K + 34, k = clamp(yy / 68), w = (lerp(8, 33, k * k * 0.85 + k * 0.15) + S(yy * 0.3 + t * 2) * 1.2) * K;
      const rag = yy > 54 ? (noise2(u * 0.3 + t * 0.8, 3, 7) - 0.3) * 12 * K : 0;
      return Math.max(Math.abs(u) - w, Math.max(-yy * K, (yy - 68) * K + rag));
    }, { ramp: CLOAK, r: 60 * K, tint: flash, alpha: a, rim: VOIDC[5], soft: 10,
      paint: (u, v, d, sh) => {
        if (d > -2) return 0;
        const sx = Math.floor(u + 80), sy = Math.floor(v + 90 - t * 3);
        if (rand(sx, sy, 7) > 0.984) return rand(sx, sy, 2) > 0.5 ? pale : purple;
        if (noise2(u * 0.06 + t * 0.05, v * 0.06, 4) > 0.66 && sh < 0.55) return VOIDC[3];
        if (Math.abs(u) < 1.2 && v > -10 * K) return VOIDC[2]; // the seam down the front
        return 0;
      } });
    // a high collar of black shards
    for (let i = -3; i <= 3; i++) {
      const ang = i * 0.32, h = (10 + (3 - Math.abs(i)) * 2.5) * K;
      sculpt(p, X(i * 3.2), Y(-70), (u, v) => sd.poly(u, v, [[-2.4 * K, 0], [0, -h], [2.4 * K, 0]]), { ramp: CLOAK, r: h + 3, rot: ang * f, tint: flash, alpha: a, rim: VOIDC[5], soft: 2 });
    }
    // hood with a long point curling back
    sculpt(p, X(0), Y(-84), (u, v) => Math.min(sd.ellipse(u, v + K, 11 * K, 12 * K), sd.poly(u, v, [[-4 * K, -10 * K], [-17 * K, (-19 + S(t * 2) * 2) * K], [-24 * K, (-12 + S(t * 2) * 3) * K], [-6 * K, -2 * K]])), { ramp: CLOAK, r: 30 * K, tint: flash, alpha: a, rim: VOIDC[5], flip: this.flip });
    // horns: crescents sweeping back and up
    for (const s of [0, 1]) sculpt(p, X(-1 - s * 6), Y(-100 + s * 2), (u, v) => {
      const cx = -9 * K, cy = 7 * K, r = Math.hypot(u - cx, v - cy), an = Math.atan2(v - cy, u - cx);
      return an < -2.7 || an > 0.15 ? 9 : Math.abs(r - 10 * K) - (2.1 - (an + 2.7) * 0.5) * K;
    }, { ramp: MASK, r: 20 * K, tint: flash, alpha: a * (s ? 0.75 : 1), flip: this.flip, rim: pale });
    // the face is a hole of darkness; the mask floats in it
    sculpt(p, X(2), Y(-82), (u, v) => sd.ellipse(u, v, 7.5 * K, 9 * K), { ramp: VOIDC.slice(0, 3), r: 14 * K, alpha: a, soft: 2 });
    const crack = this.maskCrack, blink = S(t * 0.7) > 0.97;
    // a narrow, pointed porcelain mask with a chin spike
    sculpt(p, X(3), Y(-82), (u, v) => Math.min(sd.ellipse(u, v + 1.2 * K, 5 * K, 6 * K), sd.poly(u, v, [[-3.2 * K, 2 * K], [0, 10 * K], [3.2 * K, 2 * K]])), { ramp: MASK, r: 14 * K, tint: flash, alpha: a, flip: this.flip,
      paint: (u, v) => {
        const eye = (cx, cy, w = 1.5) => Math.abs(u - cx * K) < w * K && Math.abs(v - cy * K) < 0.7 * K - Math.abs(u - cx * K) * 0.35;
        if (!blink && (eye(-2, -1.5) || eye(2.3, -1.5) || eye(0.2, -5, 1.1))) return pale;
        if (Math.abs(u - 0.2 * K) < 0.45 && v > 1.5 * K && v < 7 * K) return VOIDC[3]; // a painted tear
        if (crack > 0 && Math.abs(u + v * 0.6 - K) < 0.55 && v < (-7 + crack * 16) * K) return VOIDC[1];
        return 0;
      } });
    for (const [ex, ey] of [[-2, -1.5], [2.3, -1.5], [0.2, -5]]) glow(p, X(3 + ex), Y(-82 + ey), 5 * K, purple, 0.55 * a);
    // halo orbs: the four stolen elements
    BASE_ELEMENTS.forEach((el, i) => {
      const an = t * 1.2 + (i / 4) * Math.PI * 2, x = hx + C(an) * HR, y = hy + S(an) * HR, c = hex(ELEMENTS[el].css);
      const flare = this.orbFlare.el === el && this.orbFlare.t > 0;
      sculpt(p, x, y, (u, v) => sd.ellipse(u, v, (flare ? 5.5 : 3.6) * K, (flare ? 5.5 : 3.6) * K), { ramp: ramp(ELEMENTS[el].body), r: 9 * K, alpha: a, soft: 2 });
      glow(p, x, y, (flare ? 20 : 10) * K, c, (flare ? 0.6 : 0.3) * a);
    });
    for (const hd of this.hands) this.drawHand(p, hd, a, flash, K);
    // the beam
    if (this.beam) {
      const B = this.beam, k = B.t < 0.1 ? B.t / 0.1 : B.t > 0.55 ? 1 - (B.t - 0.55) / 0.15 : 1, th = Math.max(1, Math.round(7 * k));
      for (let x = Math.round(B.x0); x <= B.x1; x++) {
        const wob = Math.round(S(x * 0.25 + t * 40) * 1.2);
        for (let dy = -th; dy <= th; dy++) { const yy = Math.round(B.y - 20 + dy + wob), q = Math.abs(dy) / th; p.put(x, yy, q < 0.35 ? hex("#ffffff") : q < 0.7 ? pale : VOIDC[5]); }
        if (x % 2 === 0) for (let dy = -10; dy <= 10; dy += 2) p.add(x, Math.round(B.y - 20 + dy), purple, 0.12 * k * (1 - Math.abs(dy) / 10));
      }
      glow(p, this.x + B.dir * 30, Y(-46), 30, purple, 0.6 * k);
    }
  }
  drawHand(p, hd, a, flash, K = 1.4) {
    const t = this.t, toward = this.hero ? Math.atan2(this.hero.y - 20 - hd.y, this.hero.x - hd.x) : Math.PI / 2;
    // claws point at the hero when the hand is raised, down at the floor when it slams
    const aim = hd.override && this.atk?.name === "crush" ? Math.PI / 2 : toward;
    // a wisp of sleeve trailing back toward her
    energy(p, hd.x, hd.y, lerp(hd.x, this.x, 0.35), lerp(hd.y, this.y - this.z - 60, 0.35), HAND[4], HAND[2], 1, 0.4 * a);
    sculpt(p, hd.x, hd.y, (u, v) => sd.ellipse(u, v, 6 * K, 4.6 * K), { ramp: HAND, r: 12 * K, rot: aim, tint: flash, alpha: a, rim: HAND[5], soft: 4 });
    for (let i = 0; i < 4; i++) {
      const ang = aim + (i - 1.5) * (0.16 + hd.open * 0.2), L = (14 + (i === 1 || i === 2 ? 5 : 0)) * K, bend = 0.9;
      // a hooked talon: straight then curling at the tip
      const bx = hd.x + C(ang) * 6 * K, bY = hd.y + S(ang) * 6 * K;
      sculpt(p, bx, bY, (u, v) => {
        const curl = Math.max(0, u - L * 0.55);
        return sd.poly(u, v - curl * curl * 0.06 * bend, [[0, -2 * K], [L, 0], [0, 2 * K], [-K, 0]]);
      }, { ramp: HAND, r: L + 4, rot: ang, tint: flash, alpha: a, soft: 1.5 });
    }
    glow(p, hd.x, hd.y, 22 * K, hex("#9a48ec"), 0.26 * a);
    for (let i = 0; i < 4; i++) { const ph = (t * 0.8 + i / 4) % 1; p.put(Math.round(hd.x + S(i * 3 + t) * 6), Math.round(hd.y - 8 - ph * 18), HAND[5], (1 - ph) * a); }
  }
  drawEye(p, x, y, k) {
    const R = 42 * (0.6 + 0.4 * k), t = this.t, open = ease.out(clamp(k * 1.2));
    const look = this.hero ? clamp((this.hero.x - x) / 200, -1, 1) * R * 0.18 : 0;
    for (let j = -R; j <= R; j++) for (let i = -R * 1.6; i <= R * 1.6; i++) {
      const lid = R * 0.62 * open * (1 - (i / (R * 1.6)) ** 2);
      if (Math.abs(j) > lid) continue;
      const di = i - look, d = Math.hypot(di, j), X = Math.round(x + i), Y = Math.round(y + j);
      let c;
      if (Math.abs(di) < R * 0.07 && Math.abs(j) < R * 0.34) c = VOIDC[0];                       // slit pupil
      else if (d < R * 0.36) c = (Math.floor(Math.atan2(j, di) * 10 / Math.PI + t * 1.5) & 1) ? VOIDC[6] : VOIDC[5]; // iris
      else if (d < R * 0.4) c = VOIDC[7];
      else c = Math.abs(j) > lid - 2 ? VOIDC[6] : (noise2(i * 0.15, j * 0.15, 3) > 0.62 ? VOIDC[4] : VOIDC[3]); // sclera with veins
      p.put(X, Y, c, k * 0.95);
      if (d < R * 0.4) p.add(X, Y, VOIDC[6], 0.12 * k);
    }
    glow(p, x, y, R * 1.4, hex("#8048b8"), 0.3 * k);
  }
  drawIntroSwirl(p, by) {
    const t = this.introT;
    for (let i = 0; i < 40; i++) {
      const an = i * 0.7 + t * 4, r = 60 * (1 - t / 3) + (i % 5) * 4, x = Math.round(this.x + C(an) * r), y = Math.round(by - 50 + S(an) * r * 0.5);
      p.put(x, y, VOIDC[6]); p.add(x, y, hex("#8048b8"), 0.6);
    }
  }
  drawGround(p) {
    super.drawGround(p);
    // a pool of darkness under her
    for (let j = -6; j <= 6; j++) for (let i = -40; i <= 40; i++) { const e = (i * i) / 1600 + (j * j) / 36; if (e < 1 && ((i + j) & 1)) p.blendPx(Math.round(this.x + i), Math.round(this.y + j), VOIDC[2], 0.35 * (1 - e)); }
  }
}

function toHexC(c) { return "#" + [c & 255, (c >> 8) & 255, (c >> 16) & 255].map((v) => v.toString(16).padStart(2, "0")).join(""); }

// ------------------------------------------------------------------------------------------ Voltera
// VOLTERA, the Storm Roc (floor 5, alternating with Terragon) — a colossal thunderbird of storm feathers
// veined with lightning, a crest of living bolts, a beak of gold. Calls lightning on marked ground, beats
// gales across the floor, rains feather blades and dives the length of the room. At half health the storm
// breaks: the sky strikes on its own and its wings crackle white.
const STORM = ramp(["#06071a", "#0e1236", "#18205a", "#243284", "#3650b0", "#5a7ed8", "#9ab8f4", "#e0ecff"]);
const STORM_HOT = ramp(["#0a061a", "#1a0e3a", "#2c1866", "#44289a", "#6844c8", "#9a78ec", "#d0b8ff", "#ffffff"]);
const BOLT = ramp(["#3a2c08", "#7a5c10", "#c49218", "#f0c83a", "#fff08a", "#fffbe0", "#ffffff"]);
const BEAK = ramp(["#3a2408", "#6a4410", "#a46e18", "#d8a428", "#ffd84a", "#fff6c0"]);

export class StormRoc extends Boss {
  constructor(o) {
    super({ r: 34, height: 110, shadowW: 110, ...o });
    this.name = "뇌조 볼테라"; this.title = "제5층의 폭풍"; this.el = "wind"; this.speed = 46;
    this.introLen = 2.6; this.phaseLen = 1.6; this.hover = 160; this.flip = true; this.flapT = 0; this.boltT = 2.5;
    this.sparks = [];
  }
  onPhase() {
    const w = this.world;
    w.emit({ banner: "볼테라가 폭풍을 부른다!", color: "#9ab8f4", shake: 7, flash: 0.6 });
    sfx("zap");
    w.fx("lightning/thunderclap", { x: this.x, y: this.y, z: this.hover + 40, light: 1, ramp: ELEMENTS.wind.ramp, top: true });
  }
  jellyPivot() { return [this.x, this.y - this.hover - 46]; }
  /** Render one missing wing frame (used while the intro and phase change play, so fights never hitch). */
  warmWings(hot) {
    this.wingCache = this.wingCache ?? new Map();
    for (let qf = 0; qf <= 16; qf++) for (const sgn of [-1, 1]) {
      const key = sgn + "|" + (hot ? 1 : 0) + "|" + qf;
      if (this.wingCache.has(key)) continue;
      const F = createFrame(260, 170, sgn > 0 ? -6 : -254, -110); clearFrame(F);
      this.renderWing(painterFor(F), sgn, -(qf / 8 - 1) * 22, hot, hot ? STORM_HOT : STORM, hex("#fff08a"), hot ? hex("#d0b8ff") : hex("#9ab8f4"));
      this.wingCache.set(key, F); return;
    }
  }
  update(dt) {
    if (this.state === "intro") this.warmWings(false);
    if (this.state === "phase" || (this.state === "intro" && this.introT > 1.2)) this.warmWings(true);
    const free = this.baseUpdate(dt);
    // hover height eases toward where the current move wants it
    const want = this.state === "intro" ? (this.introT < 1.6 ? 160 - this.introT / 1.6 * 120 : 40) : (this.wantHover ?? 40);
    this.hover += (want - this.hover) * Math.min(1, dt * 4);
    this.flapT += dt * (this.state === "attack" && this.atk?.name === "gale" ? 2.6 : 1);
    // each downstroke pushes the body: a squash as the wings come down, a stretch as they rise
    const fl = Math.sin(this.flapT * 2.6), down = fl < this.lastFl;
    if (down !== this.wasDown) { this.wasDown = down; if (this.state !== "dying") this.squash(down ? 1.04 : 0.97, down ? 0.95 : 1.04, 0.6); }
    this.lastFl = fl;
    for (const s of this.sparks) s.t += dt;
    this.sparks = this.sparks.filter((s) => s.t < s.life);
    if (Math.random() < dt * (this.phase === 2 ? 14 : 6)) this.sparks.push({ t: 0, life: 0.12 + Math.random() * 0.1, a: Math.random() * Math.PI * 2, r: 20 + Math.random() * 40 });
    if (!free) return;
    const h = this.hero, dx = h.x - this.x, dy = h.y - this.y;
    this.flip = dx < 0;
    // the storm itself strikes now and then once it is angry
    if (this.phase === 2) {
      this.boltT -= dt;
      if (this.boltT <= 0) { this.boltT = 2.2 + Math.random(); const x = h.x + (Math.random() - 0.5) * 60, y = h.y + (Math.random() - 0.5) * 30; this.strike(x, y, 0.9); }
    }
    // keep a wary distance, drifting to the hero's depth
    const keep = 120, sp = this.phase === 2 ? 1.3 : 1;
    if (Math.abs(dx) < keep - 20) this.x -= Math.sign(dx) * this.speed * sp * dt;
    else if (Math.abs(dx) > keep + 40) this.x += Math.sign(dx) * this.speed * sp * dt;
    this.y += clamp(dy, -1, 1) * this.speed * 0.6 * dt;
    const A = this.world.arena; this.x = clamp(this.x, A.x0 + 40, A.x1 - 40);
    this.cool -= dt;
    if (this.cool > 0 || !this.canAct) return;
    const order = this.phase === 2 ? ["thunder", "dive", "feathers", "gale", "thunder", "feathers"] : ["thunder", "feathers", "gale", "dive"];
    const pick = order[this.step++ % order.length];
    this["atk" + pick[0].toUpperCase() + pick.slice(1)]();
  }

  // ---- attacks
  strike(x, y, t) {
    const w = this.world;
    this.mark({ x, y, r: 22, t, fire: () => {
      w.fx("lightning/lightning-strike", { x, y, light: 1, ramp: ELEMENTS.wind.ramp });
      this.hitHeroIn(x, y, 24, this.stats.atk * 1.25, 120);
      w.emit({ shake: 4, flash: 0.12 }); sfx("zap");
    } });
  }
  atkThunder() {
    const w = this.world, h = this.hero, n = this.phase === 2 ? 6 : 4;
    sfx("zap"); this.squash(0.9, 1.12, 1);
    this.start("thunder", (t, dt, A) => {
      A.k = A.k ?? 0;
      while (A.k < n && t > 0.35 + A.k * 0.22) {
        const x = clamp(h.x + (Math.random() - 0.5) * (A.k ? 110 : 10), w.arena.x0 + 12, w.arena.x1 - 12), y = clamp(h.y + (Math.random() - 0.5) * (A.k ? 50 : 6), w.arena.y0, w.arena.y1);
        this.strike(x, y, 0.85); A.k++;
      }
      return t > 0.35 + n * 0.22 + 1;
    });
  }
  atkGale() {
    const w = this.world, h = this.hero, f = Math.sign(h.x - this.x) || 1, y = h.y, T = 0.9;
    const x0 = f > 0 ? this.x : w.arena.x0, x1 = f > 0 ? w.arena.x1 : this.x;
    this.mark({ band: [Math.round(x0), Math.round(x1), 14], y, t: T });
    this.wantHover = 60;
    let fired = false;
    this.start("gale", (t) => {
      if (t >= T && !fired) {
        fired = true;
        this.hitHeroBand(x0, x1, y, 15, this.stats.atk * 0.7, 380); this.squash(1.12, 0.88, 1.3);
        w.fx("nature/tornado", { x: this.x + f * 40, y, light: 0.7, ramp: ELEMENTS.wind.ramp, dur: 0.9, opts: { height: 60 } });
        for (let i = 0; i < 5; i++) w.after(i * 0.05, () => w.fx("impacts/hit-spark", { x: this.x + f * (60 + i * 40), y: y + (Math.random() - 0.5) * 20, z: 10, light: 0.5 }));
        w.emit({ shake: 5 }); sfx("dash");
      }
      if (t > T + 0.6) { this.wantHover = 40; return true; }
    }, { T });
  }
  atkFeathers() {
    const w = this.world, volleys = this.phase === 2 ? 2 : 1;
    this.start("feathers", (t, dt, A) => {
      A.k = A.k ?? 0;
      if (A.k < volleys && t > 0.55 + A.k * 0.5) {
        const h = this.hero, base = Math.atan2(h.y - this.y, h.x - this.x), n = 7;
        for (let i = 0; i < n; i++) {
          const ang = base + (i - (n - 1) / 2) * 0.16 + (A.k ? 0.08 : 0);
          w.projs.push(new EnemyShot({ x: this.x + Math.cos(ang) * 30, y: this.y + Math.sin(ang) * 10, z: 24, ang, speed: 170, src: this, r: 5, life: 2.4, style: "arrow", color: ["#9ab8f4", "#e0ecff"] }));
        }
        sfx("swing"); A.k++;
      }
      return t > 0.55 + volleys * 0.5 + 0.4;
    });
  }
  atkDive() {
    const w = this.world, h = this.hero, y = h.y, A0 = w.arena, from = this.x, to = this.x < h.x ? A0.x1 - 50 : A0.x0 + 50;
    const T = 1.1, x0 = Math.min(from, to), x1 = Math.max(from, to);
    this.wantHover = 110; sfx("dash");
    this.mark({ band: [Math.round(x0), Math.round(x1), 12], y, t: T });
    let hit = false;
    this.start("dive", (t, dt) => {
      if (t < T) { this.y += (y - this.y) * Math.min(1, dt * 6); return false; }
      // swoop: low and fast along the band
      this.wantHover = 8;
      const u = clamp((t - T) / 0.45);
      if (!this.diving) { this.diving = true; this.squash(1.22, 0.82, 1.3); }
      this.x = from + (to - from) * u; this.flip = to < from;
      if (!hit && Math.abs(this.hero.x - this.x) < 34) { this.hitHeroBand(this.x - 34, this.x + 34, y, 13, this.stats.atk * 1.4, 260); hit = this.hero.iframes > 0 || hit; }
      if (u >= 1 && !this.landed) { this.landed = true; w.emit({ shake: 6 }); sfx("boom"); w.fx("impacts/ground-slam", { x: this.x, y, light: 0.8, ramp: ELEMENTS.wind.ramp, dur: 0.6 }); }
      if (u >= 1 && this.diving) { this.diving = false; this.squash(0.86, 1.14, 1.2); }
      if (t > T + 1.0) { this.landed = false; this.wantHover = 40; return true; }
      return false;
    }, { T });
  }

  dying(dt) {
    const w = this.world, u = this.dieT;
    this.wantHover = 40 - u * 25;
    if (Math.floor(u * 6) !== Math.floor((u - dt) * 6) && u < 1.6) { w.fx("lightning/zap-hit", { x: this.x + (Math.random() - 0.5) * 80, y: this.y, z: this.hover + 20 + Math.random() * 60, light: 1, top: true }); w.emit({ shake: 3 }); sfx("zap"); }
    if (u >= 1.7 && !this.broke) { this.broke = true; w.fx("lightning/thunderclap", { x: this.x, y: this.y, z: 30, light: 1.2, ramp: ELEMENTS.wind.ramp }); this.finishDeath(); }
  }

  /** One wing, drawn around (0, 0) into its own frame; the shape for a given flap never changes. */
  renderWing(p, sgn, fy, hot, RP, boltC, glowC) {
    const t = 0, bx = 0, by = 0, flash = null;
    const cracks = (seed, k = 1) => (u, v, d) => (d < -1 && Math.abs(noise2(u * 0.12 + seed, v * 0.12, seed)) < (hot ? 0.055 : 0.035) * k ? BOLT[hot ? 5 : 4] : 0);
      const lead = [[12, -16], [40, -40 + fy * 0.6], [70, -48 + fy], [96, -36 + fy * 1.25], [114, -14 + fy * 1.45]];
      // primaries and secondaries: pointed feather tips with notches between, longest toward the wingtip
      const trail = [], NF = 11;
      for (let i = 0; i < NF; i++) {
        const k = i / (NF - 1), x = 110 - k * 94, base = lerp(-6 + fy * 1.35, 4, k) + Math.sin(k * Math.PI) * 18 + 4, len = lerp(14, 6, k);
        const sway = 0;
        trail.push([x + 3, base + len + sway], [x - 4, base + 2]);
      }
      trail.push([16, 6]);
      const poly = [...lead, ...trail].map(([x, y]) => [sgn * x, y]);
      const leadPts = lead.map(([x, y]) => [sgn * x, y]);
      const dLead = (u, v) => { let d = 1e9; for (let i = 1; i < leadPts.length; i++) { const [ax, ay] = leadPts[i - 1], [bx2, by2] = leadPts[i], ex = bx2 - ax, ey = by2 - ay, q = clamp(((u - ax) * ex + (v - ay) * ey) / (ex * ex + ey * ey)); d = Math.min(d, Math.hypot(u - ax - ex * q, v - ay - ey * q)); } return d; };
      // three clean feather bands: bright coverts along the arm (with a scalloped lower edge), the mid
      // secondaries, and dark primaries whose tips burn gold; thin separations only on the primaries
      const paint = (u, v, d, sh) => {
        const x = u * sgn;
        if (d > -1.1) return 0;
        const dl = dLead(u, v), sc = 2.2 * Math.abs(Math.sin(x * 0.42));
        if (dl < 9 + sc) return dl > 7.6 + sc ? RP[4] : sh > 0.55 ? RP[7] : RP[6];
        if (dl < 19 + sc * 0.8) return dl > 17.6 + sc * 0.8 ? RP[3] : sh > 0.5 ? RP[5] : RP[4];
        if (d > -4.5) return boltC;
        const ang = Math.atan2(v + 30, x - 20), stripe = Math.abs(((ang * 10) % 1 + 1) % 1 - 0.5);
        if (stripe < 0.06) return RP[1];
        return sh > 0.6 ? RP[3] : RP[2];
      };
    // the shape is centred on the wing, not the body, so the sculpt box stays small
    const cx = sgn * 62, cy = -6;
    sculpt(p, cx, cy, (u, v) => sd.poly(u + cx, v + cy, poly), { ramp: RP, r: 64, soft: 8, rim: RP[7], paint: (u, v, d, sh) => paint(u + cx, v + cy, d, sh) });
  }

  // ---- drawing
  // Seen from the front like a heraldic eagle: wings spread wide and beating, the head turned in profile
  // toward the hero, a fan of tail plumes below. Lightning runs in the feather cracks and arcs between the
  // wingtips.
  draw(p) {
    if (this.dead && this.broke) return;
    const f = this.flip ? -1 : 1, t = this.t, hot = this.phase === 2, flash = this.hitFlash > 0 ? hex("#ffffff") : null;
    const RP = hot ? STORM_HOT : STORM, glowC = hot ? hex("#d0b8ff") : hex("#9ab8f4"), boltC = hex("#fff08a");
    const atk = this.atk, a = this.state === "attack" ? atk?.name : this.state;
    const bob = S(t * 2) * 3, bx = this.x, by = this.y - this.hover - 46 + bob;
    // wing beat: a slow heavy stroke at rest; raised to the sky before a gale; swept back in a dive
    let flap = S(this.flapT * 2.6);
    if (a === "gale") { const u = atk.t / atk.T; flap = u < 1 ? 0.4 + 0.6 * ease.out(Math.min(1, u)) : 1 - 2 * ease.out(clamp((atk.t - atk.T) * 4)); }
    if (a === "dive" && atk.t > atk.T) flap = -0.8;
    if (a === "intro") flap = S(t * 5);
    if (a === "thunder" || a === "phase") flap = 0.8 + S(t * 9) * 0.15;
    const fy = -flap * 22;
    const cracks = (seed, k = 1) => (u, v, d) => (d < -1 && Math.abs(noise2(u * 0.12 + seed, v * 0.12, seed)) < (hot ? 0.055 : 0.035) * k ? BOLT[hot ? 5 : 4] : 0);
    glow(p, bx, by, 110, glowC, hot ? 0.13 : 0.09);
    // a dark storm cloud gathering behind
    for (let i = 0; i < 9; i++) {
      const an = i / 9 * Math.PI * 2 + t * 0.2, cx = bx + C(an) * 70, cy = by + 10 + S(an) * 22, r = 18 + (i % 3) * 5;
      for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) { const d = (j * j) / (r * r * 0.5) + (k * k) / (r * r); if (d < 1 && ((j + k + i) & 1)) p.blendPx(Math.round(cx + k), Math.round(cy + j * 0.6), RP[1], 0.35 * (1 - d)); }
    }
    // wings: a broad shape per side, leading edge up and out, scalloped primaries along the trailing edge.
    // They are costly, so each wing is rendered once per flap step (17 steps) and stamped after that.
    const qf = Math.round((clamp(flap, -1, 1) + 1) * 8), fyq = -(qf / 8 - 1) * 22;
    for (const sgn of [-1, 1]) {
      const key = sgn + "|" + (hot ? 1 : 0) + "|" + qf;
      if (!this.wingCache) this.wingCache = new Map();
      let F = this.wingCache.get(key);
      if (!F) { F = createFrame(260, 170, sgn > 0 ? -6 : -254, -110); clearFrame(F); this.renderWing(painterFor(F), sgn, fyq, hot, RP, boltC, glowC); this.wingCache.set(key, F); }
      stampFrame(p, F, Math.round(bx), Math.round(by), flash);
      const lead = [[12, -16], [40, -40 + fyq * 0.6], [70, -48 + fyq], [96, -36 + fyq * 1.25], [114, -14 + fyq * 1.45]];
      for (let i = 1; i < lead.length; i++) energy(p, bx + sgn * lead[i - 1][0], by + lead[i - 1][1] + 3, bx + sgn * lead[i][0], by + lead[i][1] + 3, RP[7], glowC, 1, 0.16);
    }
    // arcs leaping between the wingtips when it calls the storm
    if (a === "thunder" || a === "phase" || hot) {
      let [x, y] = [bx - 112, by - 14 + fy * 1.45]; const [x1, y1] = [bx + 112, by - 14 + fy * 1.45];
      if (Math.random() < (hot ? 0.6 : 0.35)) for (let s2 = 1; s2 <= 10; s2++) { const nx = x + (x1 - (bx - 112)) / 10, ny = y1 + S(s2 * 1.3 + t * 20) * 6 - Math.abs(s2 - 5) * -3 - 24; energy(p, x, y, nx, ny, boltC, glowC, 1, 0.45); x = nx; y = ny; }
    }
    // tail: a fan of long plumes below
    for (let i = 0; i < 5; i++) {
      const ang = Math.PI / 2 + (i - 2) * 0.28 + S(t * 1.4 + i) * 0.05, len = 34 + (2 - Math.abs(i - 2)) * 8, dx = C(ang), dy = S(ang);
      sculpt(p, bx, by + 14, (u, v) => { const q = (u * dx + v * dy) / len, px = Math.abs(-u * dy + v * dx); return q < 0 ? 9 : q > 1 ? 9 : px - (3 + 2.5 * Math.sin(q * Math.PI)); }, { ramp: RP, r: len + 6, tint: flash, soft: 3, paint: (u, v) => ((u * dx + v * dy) / len > 0.84 ? boltC : 0) });
    }
    // body: a deep chest of storm feathers, a pale scaled breast
    sculpt(p, bx, by, (u, v) => Math.min(sd.ellipse(u, v - 2, 17, 23), sd.ellipse(u, v - 16, 12, 10)), { ramp: RP, r: 30, tint: flash, soft: 7, rim: RP[7], paint: (u, v, d, sh) => { if (d > -1.5) return 0; if (Math.abs(u) < 11 && v > -8 && v < 20) { const ch = ((v - Math.abs(u) * 0.6) / 5) % 1; return ch > 0 && ch < 0.2 ? RP[5] : RP[7]; } return 0; } });
    // golden talons
    for (const o of [-6, 6]) { const tx = bx + o, ty = by + 22; energy(p, tx, ty, tx, ty + 7, BEAK[4], BEAK[2], 1, 0.1); for (const c of [-2, 0, 2]) p.put(Math.round(tx + c), Math.round(ty + 8), BEAK[5]); }
    // head in profile toward the hero, with a crest of living bolts
    const hx = bx + f * 4, hy = by - 30 - bob + S(t * 2 - 0.8) * 4 + (a === "thunder" ? -3 : 0);
    for (let i = 0; i < 6; i++) { const an = -Math.PI / 2 - f * (0.35 + i * 0.27), L = 16 + i * 3; let x = hx - f * 3, y = hy - 5; for (let s2 = 0; s2 < 4; s2++) { const nx = x + C(an) * L / 4 + (Math.random() - 0.5) * 3, ny = y + S(an) * L / 4 + (Math.random() - 0.5) * 2; energy(p, x, y, nx, ny, boltC, glowC, 1, 0.3); x = nx; y = ny; } }
    sculpt(p, hx, hy, (u, v) => Math.min(sd.ellipse(u, v, 12, 10.5), sd.ellipse(u + f * 3, v + 8, 9, 7)), { ramp: RP, r: 14, tint: flash, soft: 5, rim: RP[7] });
    const open = a === "thunder" || a === "phase" || a === "intro" ? 3 : 0.5;
    sculpt(p, hx + f * 10, hy + 1, (u, v) => Math.min(sd.poly(u, v, [[-3, -4], [9, -1], [12, 3], [7, 1], [-3, 0]]), sd.poly(u, v, [[-3, 1 + open], [8, 3 + open], [-2, 5 + open]])), { ramp: BEAK, r: 14, flip: f < 0, tint: flash, soft: 2 });
    const ex = hx + f * 3, ey = hy - 2;
    for (let i = -1; i <= 1; i++) p.put(Math.round(ex) + i, Math.round(ey), i === 0 ? hex("#ffffff") : hex("#fffbe0"));
    for (let k = 1; k < 9; k++) p.put(Math.round(ex - f * k * 1.6), Math.round(ey - k * 0.45), boltC, 1 - k / 9);
    glow(p, ex, ey, 10, boltC, 0.5);
    // sparks crackling around it
    for (const s2 of this.sparks) { const x0 = bx + C(s2.a) * s2.r * 1.6, y0 = by + S(s2.a) * s2.r * 0.6; energy(p, x0, y0, x0 + (Math.random() - 0.5) * 14, y0 + (Math.random() - 0.5) * 14, boltC, glowC, 1, 0.5 * (1 - s2.t / s2.life)); }
  }
}

/** Stamp a pre-rendered frame (with translucency and light) at (x, y); tint turns it into a hit flash. */
function stampFrame(p, F, x, y, tint) {
  const W = F.w, H = F.h, X0 = x + F.ox, Y0 = y + F.oy;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, col = F.color[k], lt = F.light[k];
    if (col) { const al = col >>> 24; if (al >= 250) p.put(X0 + i, Y0 + j, tint ?? col); else p.blendPx(X0 + i, Y0 + j, tint ?? (col | 0xff000000) >>> 0, al / 255); }
    if (lt) p.add(X0 + i, Y0 + j, lt, 1);
  }
}
