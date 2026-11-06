// Bosses, each a bespoke sculpted body (not the hero's rig):
//   TERRAGON, the Rift Colossus (floor 5) — a giant of floating boulders bound by golden rift-light, a crystal
//     fist, a hammer arm, a beating crystal heart. Breaks open into magma at half health.
//   NOCTILE, the Void Witch (floor 10) — a hovering cloak full of stars, a three-eyed porcelain mask, horns,
//     a halo of stolen elements and two disembodied hands. Opens a vast eye and grows tendril wings.
import { hex, mix, noise2, rand, clamp } from "../px.js";
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
  }
  get hero() { return this.world.hero; }
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
  start(name, fn, extra = {}) { this.atk = { name, fn, t: 0, ...extra }; this.state = "attack"; }
  onHurt(dmg) { if (this.state !== "dying") this.flinch = 0.12; }
  die() {
    if (this.dead || this.state === "dying") return;
    this.hp = 1; this.state = "dying"; this.dieT = 0; this.marks = []; this.atk = null; this.invuln = 99;
    this.clearStatusFx();
    this.world.emit({ bossDying: this, slowmo: 1.6 });
    sfx("boom");
  }
  finishDeath() {
    if (this.dead) return;
    this.dead = true; this.hp = 0; this.state = "dead";
    this.world.kills++;
    this.world.emit({ killed: this, bossDown: this, shake: 10, flash: 1 });
  }
  baseUpdate(dt) {
    this.physics(dt); this.tickMarks(dt);
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
const ROCK = ramp(["#15131b", "#24212d", "#363241", "#4b4658", "#635d72", "#827b92", "#a59eb3"]);
const ROCK_HOT = ramp(["#0e0808", "#1a0e0e", "#261414", "#341c1a", "#462620", "#5c3428", "#7a4632"]);
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
    this.moss = Array.from({ length: 4 }, () => new Strand(4, 3, 200, 0.9));
  }
  onPhase() {
    const w = this.world;
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
      if (t >= T && hits === 0) {
        hits = 1;
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
        this.hitHeroBand(x0, x1, y, 10, this.stats.atk * 1.3, 240);
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
    this.sk.drive(P, dt, fast ? 150 : 70, fast ? 15 : 11, { x: P.x ?? 0, y: P.y ?? this.hipY, lean: P.lean ?? 0 });
    // heavy footfalls shake the room
    if (this.moving) { const s = Math.sign(Math.sin(this.walkT * 4.2)); if (s !== this.stepSide) { this.stepSide = s; this.world.emit({ shake: 2 }); sfx("door"); } }
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
  draw(p) {
    if (this.dead && this.broke) return this.drawDebris(p, 1);
    const K = this.K, f = this.flip ? -1 : 1, hot = this.phase === 2, t = this.t;
    const W = this.sk.solve(this.x, this.y - this.z, f);
    const flash = this.hitFlash > 0 ? hex("#ffffff") : null;
    const R = hot ? ROCK_HOT : ROCK, glowC = hot ? hex("#ff6a2a") : hex("#ffc24a"), core = hot ? MAGMA : CRYS;
    const pulse = (S(t * (hot ? 8 : 4)) + 1) / 2;
    const vein = hot ? MAGMA[3 + Math.round(pulse * 2)] : CRYS[2 + Math.round(pulse * 2)], veinDk = hot ? MAGMA[1] : CRYS[1];
    // cracks: straight chiselled seams in part space that glow
    const seams = (list) => (u, v) => { for (const [a, b, c, d] of list) { const ex = c - a, ey = d - b, q = clamp(((u - a) * ex + (v - b) * ey) / (ex * ex + ey * ey)), dd = Math.hypot(u - a - ex * q, v - b - ey * q); if (dd < 0.75) return vein; if (dd < 1.5) return veinDk; } return 0; };
    const mossy = (seed) => (u, v, d, sh) => (!hot && sh > 0.82 && noise2(u * 0.25 + seed, v * 0.25, seed) > 0.45 ? MOSS[Math.min(4, 2 + Math.round(noise2(u, v, seed) * 2))] : 0);
    const both = (...fs) => (u, v, d, sh) => { for (const fn of fs) { const c = fn(u, v, d, sh); if (c) return c; } return 0; };
    const slab = (hw, hh, r = 3) => (u, v) => sd.box(u, v, hw, hh, r);
    const limb = (len, w0, w1) => (u, v) => { const k = clamp(v / len); return Math.max(Math.abs(u) - (w0 + (w1 - w0) * k), Math.abs(v - len / 2) - len / 2 - 2); };
    const O = (extra) => ({ ramp: R, tint: flash, soft: 4, rim: R[R.length - 1], ...extra });
    const rise = this.state === "intro" ? 0 : 0;
    // far leg
    part(p, W.thighF, f, limb(W.thighF.len, 9 * K, 7.5 * K), O({ r: 30 * K }));
    part(p, W.shinF, f, limb(W.shinF.len, 7 * K, 8.5 * K), O({ r: 30 * K }));
    part(p, W.shinF, f, slab(10 * K, 4 * K, 2), O({ r: 16 * K, at: 1, off: [5 * K, -2] }));
    // far arm: the stone hammer
    part(p, W.shF, f, limb(W.shF.len, 8 * K, 7 * K), O({ r: 34 * K }));
    part(p, W.foreF, f, limb(W.foreF.len, 6.5 * K, 8 * K), O({ r: 36 * K }));
    part(p, W.fistF, f, (u, v) => sd.box(u, v - 6 * K, 11 * K, 9 * K, 3), O({ r: 22 * K, paint: (u, v) => (Math.abs(v - 4 * K) < 1.6 ? core[3] : Math.abs(v - 9 * K) < 0.8 ? R[1] : 0) }));
    // hips
    part(p, W.spine, f, (u, v) => sd.box(u, v - 3 * K, 18 * K, 10 * K, 6), O({ r: 24 * K }));
    // the great chest slab, cracked from the crystal heart outward
    const chestCr = [[2, -6, 12, -18], [2, -6, -6, -20], [2, -6, 14, 2], [12, -18, 18, -24], [-6, -20, -14, -24], [14, 2, 20, 6]].map((q) => q.map((v) => v * K));
    part(p, W.spine, f, (u, v) => Math.min(sd.box(u, v - 21 * K, 25 * K, 21 * K, 11), sd.box(u - 6 * K, v - 28 * K, 20 * K, 14 * K, 8)), O({ r: 46 * K, at: 0, paint: both((u, v) => seams(chestCr)(u, v - 26 * K), mossy(3)) }));
    // a point on a bone: along it, and across it (+across = the bone's u side)
    const at = (B, along, across) => [B.x + f * (along * Math.sin(B.a) + across * Math.cos(B.a)), B.y + along * Math.cos(B.a) - across * Math.sin(B.a)];
    // crystals growing out of the back (the spine's +u side)
    for (const [along, h, tilt] of [[14, 18, 0.35], [21, 26, 0.1], [28, 16, -0.15]]) {
      const [cx, cy] = at(W.spine, along * K, 22 * K), dir = Math.atan2(cy - (W.spine.y + (W.spine.ey - W.spine.y) * 0.5), cx - (W.spine.x + (W.spine.ex - W.spine.x) * 0.5));
      sculpt(p, cx, cy, (u, v) => sd.poly(u, v, [[-3.4 * K, 0], [0, -h * K], [3.4 * K, 0], [0, 4 * K]]), { ramp: core, r: (h + 6) * K, rot: -(dir + Math.PI / 2) + tilt * f, tint: flash, soft: 2, glow: [glowC, 0.35] });
    }
    // the heart, set in the front of the chest
    const [hx, hy] = at(W.spine, 21 * K, -12 * K);
    glow(p, hx, hy, (26 + pulse * 10) * K, glowC, 0.18 + pulse * 0.12);
    sculpt(p, hx, hy, (u, v) => sd.poly(u, v, [[0, -9 * K], [6.5 * K, 0], [0, 9 * K], [-6.5 * K, 0]]), { ramp: core, r: 14 * K, tint: flash, glow: [glowC, 0.55], soft: 3 });
    // near leg
    part(p, W.thighN, f, limb(W.thighN.len, 9.5 * K, 8 * K), O({ r: 30 * K }));
    part(p, W.shinN, f, limb(W.shinN.len, 7.5 * K, 9 * K), O({ r: 30 * K, paint: hot ? seams([[0, 4 * K, 2 * K, 14 * K]]) : 0 }));
    part(p, W.shinN, f, slab(11 * K, 4.5 * K, 2), O({ r: 16 * K, at: 1, off: [5 * K, -2] }));
    // near arm: pauldron boulder, forearm, the crystal fist
    part(p, W.shN, f, limb(W.shN.len, 8 * K, 7 * K), O({ r: 34 * K }));
    part(p, W.shN, f, (u, v) => sd.box(u, v - 1 * K, 13 * K, 11 * K, 6), O({ r: 26 * K, paint: both(mossy(5), seams([[-8 * K, -6 * K, 2 * K, 4 * K]])) }));
    for (const [ox, h, a] of [[1, 13, 0.1], [7, 9, 0.5]]) part(p, W.shN, f, (u, v) => sd.poly(u, v, [[-3.2 * K, 0], [0, -h * K], [3.2 * K, 0], [0, 3 * K]]), { ramp: core, r: (h + 4) * K, off: [ox * K, -9 * K], tint: flash, soft: 2, glow: [glowC, 0.3] });
    part(p, W.foreN, f, limb(W.foreN.len, 7 * K, 9 * K), O({ r: 36 * K, paint: seams([[0, 6 * K, -3 * K, 18 * K]]) }));
    part(p, W.fistN, f, (u, v) => sd.box(u, v - 5 * K, 10 * K, 8.5 * K, 4), O({ r: 22 * K }));
    for (const [ox, oy, h] of [[6, 2, 11], [0, 4, 13], [-6, 2, 10]]) part(p, W.fistN, f, (u, v) => sd.poly(u, v, [[-2.4 * K, 0], [0, h * K], [2.4 * K, 0]]), { ramp: core, r: (h + 3) * K, off: [ox * K, oy * K], tint: flash, soft: 2, glow: [glowC, 0.3] });
    // head: skull block, a heavy brow ridge on top, a jaw below, two burning eyes under the brow
    part(p, W.head, f, (u, v) => sd.box(u, v - 8 * K, 9.5 * K, 9 * K, 4), O({ r: 20 * K, paint: (u, v) => (v > 13 * K && u < 1 * K && u > -5 * K && (Math.round(v / K) % 3 === 0) ? R[1] : 0) }));
    part(p, W.head, f, (u, v) => sd.box(u + 5 * K, v - 8 * K, 3.5 * K, 6.5 * K, 2), O({ r: 14 * K }));
    part(p, W.head, f, (u, v) => sd.box(u - 5.5 * K, v - 9 * K, 2.8 * K, 9 * K, 1.5), O({ r: 14 * K, paint: mossy(9) }));
    for (const dd of [-2.6, 2.6]) {
      const [ex, ey] = at(W.head, (11.5 + dd * 0.4) * K, -2.2 * K);
      const ec = hot ? hex("#ff5030") : hex("#fff6c4");
      p.put(Math.round(ex), Math.round(ey), ec); p.put(Math.round(ex) + 1, Math.round(ey), ec); p.put(Math.round(ex) - 1, Math.round(ey), hot ? MAGMA[3] : CRYS[3]);
      glow(p, ex, ey, 6 * K, hot ? hex("#ff5030") : hex("#ffe27a"), 0.5);
    }
    // embers rising off it when angry
    if (hot) for (let i = 0; i < 12; i++) { const ph = (t * 0.7 + i / 12) % 1; const x = Math.round(this.x + S(i * 2.7 + t) * 46 * K), y = Math.round(this.y - 20 * K - ph * 100 * K); p.put(x, y, MAGMA[ph < 0.5 ? 5 : 3], 1 - ph); p.add(x, y, glowC, 0.5 * (1 - ph)); }
    // orbiting debris
    for (const d of this.debris) {
      d.a += (hot ? 2.2 : 1) * 0.016;
      if (S(d.a) <= 0) continue;
      const x = this.x + C(d.a) * d.r * K, y = this.y + d.y * K + S(d.a) * 12;
      sculpt(p, x, y, (u, v) => sd.rock(u, v, d.s * K, d.s * 0.8 * K, d.r, 0.25, 5), { ramp: R, r: d.s * K + 3, tint: flash });
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
        w.emit({ shake: 6 }); sfx("boom");
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
        this.mark({ x: tx, y: ty, r: 24, t: delay + 0.1, fire: () => { this.hitHeroIn(tx, ty, 26, this.stats.atk * 1.3, 100); w.emit({ shake: 3 }); } });
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
        if (!Aa.shook) { Aa.shook = true; w.emit({ shake: 5, flash: 0.3 }); sfx("zap"); }
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
      w.emit({ shake: 3 }); sfx("zap");
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
