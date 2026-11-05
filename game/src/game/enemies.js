// Enemies: pixelfx critters given bodies and minds, block soldiers on the same rig as the hero, and bosses.
import { hex, mix, fit, toHex, clamp } from "../px.js";
import { Actor } from "./actor.js";
import { drawRig, makeSkin, lerpPose, anchor } from "../rig/rig.js";
import { idlePose, movePose, sampleKeys, archetype, HURT, DEAD } from "./poses.js";
import { ELEMENTS } from "../data/elements.js";
import { DEPTH_K } from "./world.js";
import { sfx } from "../core/audio.js";

export const ENEMY_DEFS = {
  slime: { name: "슬라임", fx: "critters/slime", opts: { hop: 9 }, hp: 30, atk: 7, speed: 30, r: 9, h: 14, ai: "hopper", gold: 2 },
  bat: { name: "박쥐", fx: "critters/bat", hp: 18, atk: 6, speed: 72, r: 7, h: 10, z: 18, flying: true, ai: "swooper", gold: 2 },
  skull: { name: "불꽃 해골", fx: "critters/flying-skull", opts: { hover: 14, floor: false }, hp: 34, atk: 9, speed: 34, r: 8, h: 18, ai: "shooter", gold: 3, flying: true },
  ghost: { name: "유령", fx: "critters/ghost", opts: { hover: 10 }, hp: 40, atk: 9, speed: 40, r: 8, h: 18, ai: "drifter", gold: 3, flying: true },
  eye: { name: "감시의 눈", fx: "critters/eyeball", opts: { hover: 16 }, hp: 36, atk: 11, speed: 28, r: 8, h: 16, ai: "shooter", gold: 4, flying: true, shotSpeed: 130 },
  wisp: { name: "폭발 도깨비불", fx: "critters/wisp", opts: { hover: 10 }, hp: 20, atk: 22, speed: 62, r: 7, h: 14, ai: "bomber", gold: 3, flying: true },
  knight: { name: "블록 병사", rig: true, hp: 70, atk: 12, speed: 40, r: 8, h: 34, ai: "brawler", gold: 5 },
  brute: { name: "블록 거한", rig: true, k: 1.35, hp: 160, atk: 18, speed: 30, r: 11, h: 46, ai: "brawler", gold: 9, heavyish: true },
};

/** Floor themes pick which critters show up and in what colour. */
export const THEME_POOL = {
  fire: ["slime", "skull", "bat", "knight", "wisp", "brute"],
  water: ["slime", "ghost", "eye", "knight", "bat", "brute"],
  wind: ["bat", "wisp", "ghost", "knight", "eye", "brute"],
  earth: ["slime", "knight", "skull", "brute", "eye", "bat"],
};

function rampFor(el) { return ELEMENTS[el]?.ramp; }
function enemySkin(el) {
  const b = ELEMENTS[el]?.body ?? ["#2a2836", "#4a4658", "#6d6a80", "#a9a6b8", "#d3d1dc"];
  const dark = ["#1a1822", "#2c2938", "#454257", "#6a667e", "#8f8ba4"].map(hex);
  return { ramp: dark.map((c, i) => mix(c, hex(b[i]), 0.42)), outline: hex("#08070c"), eye: hex(b[4]) };
}

export class Enemy extends Actor {
  constructor(kind, o) {
    const D = ENEMY_DEFS[kind];
    super({ team: 1, r: D.r, height: D.h, ...o });
    this.kind = kind; this.D = D;
    const lvK = o.scale ?? 1;
    this.hp = this.maxHp = Math.round(D.hp * lvK);
    this.stats = { atk: D.atk * (o.dmgScale ?? 1), crit: 0, critDmg: 1.5 };
    this.speed = D.speed * (o.speedK ?? 1);
    this.flying = !!D.flying; this.hover = D.z ?? D.opts?.hover ?? 0; this.lift = D.z ?? 0;
    this.state = "spawn"; this.stT = 0.45; this.cool = 1 + Math.random(); this.contactCd = 0;
    this.elite = !!o.elite;
    if (this.elite) { this.hp = this.maxHp = Math.round(this.maxHp * 2.4); this.stats.atk *= 1.4; this.r += 1; }
    this.invuln = 0.45;
    this.t = Math.random() * 3;
    if (D.rig) { this.skin = enemySkin(this.el); this.k = D.k ?? 1; this.heavy = !!D.heavyish; this.lastPose = {}; }
  }

  onAdd() {
    const w = this.world;
    if (this.D.fx) this.body = w.fx(this.D.fx, { follow: this, ramp: rampFor(this.el), light: 0.7, opts: this.D.opts });
    w.fx("spawn/poof", { x: this.x, y: this.y + 0.5, ramp: rampFor(this.el), light: 0.6 });
    if (this.elite) this.aura = w.fx("status/rage", { follow: this, light: 0.6 });
  }

  get hero() { return this.world.hero; }

  update(dt) {
    this.physics(dt);
    if (this.dead) {
      this.deadT += dt;
      if (this.deadT > 0.7) this.removed = true;
      return;
    }
    if (this.body) this.body.dy = -this.lift;
    this.contactCd -= dt;
    const h = this.hero;
    if (!h || h.dead || !this.canAct) return;
    this.stT -= dt;
    this.cool -= dt;
    const dx = h.x - this.x, dy = h.y - this.y, d = Math.hypot(dx, dy * DEPTH_K);
    if (this.state !== "dash" && this.state !== "swing" && this.state !== "tele") this.flip = dx < 0;
    const sp = this.canMove ? this.speed * this.speedK : 0;
    const go = (tx, ty, k = 1) => {
      const ddx = tx - this.x, ddy = ty - this.y, L = Math.hypot(ddx, ddy);
      if (L > 1) { this.x += (ddx / L) * sp * k * dt; this.y += (ddy / L) * sp * k * dt * 0.75; this.moving = true; }
    };
    this.moving = false;
    if (this.state === "spawn") { if (this.stT <= 0) this.state = "idle"; return; }
    switch (this.D.ai) {
      case "hopper": go(h.x, h.y, 0.6 + 0.6 * Math.max(0, Math.sin(this.t * 3.5))); break;
      case "drifter": {
        go(h.x + Math.sin(this.t * 1.3) * 30, h.y + Math.cos(this.t * 1.1) * 14);
        this.untargetable = Math.sin(this.t * 0.9) > 0.92;
        if (this.body) this.body.inst.options.light = this.untargetable ? 0.2 : 0.7;
        break;
      }
      case "swooper": {
        if (this.state === "dash") {
          this.x += this.vx * dt; this.y += this.vy * dt;
          if (this.stT <= 0) { this.state = "idle"; this.cool = 1.2 + Math.random(); }
        } else if (this.cool <= 0 && d < 140) {
          this.state = "dash"; this.stT = 0.55; const L = Math.max(1, Math.hypot(dx, dy));
          this.vx = (dx / L) * 190; this.vy = (dy / L) * 150; this.flip = dx < 0;
        } else go(h.x - Math.sign(dx) * 70 + Math.sin(this.t * 2) * 20, h.y + Math.sin(this.t * 1.7) * 30, 0.9);
        break;
      }
      case "shooter": {
        const want = 120;
        if (this.state === "aim") {
          if (this.stT <= 0) { this.shoot(); this.state = "idle"; this.cool = 2.2 + Math.random() * 1.2; }
        } else {
          if (d > want + 20) go(h.x, h.y); else if (d < want - 30) go(this.x - dx, this.y - dy, 0.8); else go(this.x, h.y, 0.5);
          if (this.cool <= 0 && d < 220) { this.state = "aim"; this.stT = 0.55; }
        }
        break;
      }
      case "bomber": {
        if (this.state === "fuse") {
          if (this.stT <= 0) this.explode();
        } else {
          go(h.x, h.y, 1.1);
          if (d < 26) { this.state = "fuse"; this.stT = 0.6; sfx("ui"); }
        }
        break;
      }
      case "brawler": {
        if (this.state === "tele") {
          if (this.stT <= 0) { this.state = "swing"; this.stT = 0.35; this.swing(); }
        } else if (this.state === "swing") {
          if (this.stT <= 0) { this.state = "idle"; this.cool = 1.0 + Math.random() * 0.8; }
        } else {
          if (Math.abs(dx) > 26 * this.k || Math.abs(dy) > 8) go(h.x - Math.sign(dx) * 22 * this.k, h.y);
          if (this.cool <= 0 && Math.abs(dx) < 40 * this.k && Math.abs(dy) < 14) { this.state = "tele"; this.stT = 0.5; this.flip = dx < 0; }
        }
        break;
      }
    }
    // touching the hero hurts (critters only; soldiers hit with their arms)
    if (!this.D.rig && this.D.ai !== "bomber" && this.contactCd <= 0 && d < this.r + h.r + 3 && Math.abs((this.z + this.hover) - h.z) < 26) {
      this.contactCd = 0.9;
      this.world.hit(this, h, { dmg: this.stats.atk, kb: 110, from: [this.x, this.y], spark: false });
    }
  }

  shoot() {
    const w = this.world, h = this.hero;
    const sp = this.D.shotSpeed ?? 110;
    const ang = Math.atan2((h.y - this.y) / 0.55, h.x - this.x);
    w.projs.push(new EnemyShot({ x: this.x, y: this.y + 0.5, z: this.hover + 6, ang, speed: sp, src: this, team: 1, el: this.el, color: ELEMENTS[this.el]?.glow ?? ["#ff6a5a", "#ffd0c8"] }));
    sfx("ui");
  }

  explode() {
    const w = this.world, h = this.hero;
    w.fx("explosions/small-explosion", { x: this.x, y: this.y + 1, ramp: rampFor(this.el), light: 0.9, opts: { size: 0.7 } });
    if (h && Math.hypot(h.x - this.x, (h.y - this.y) * DEPTH_K) < 34) w.hit(this, h, { dmg: this.stats.atk, kb: 160, from: [this.x, this.y], spark: false });
    for (const e of w.enemies) if (e !== this && Math.hypot(e.x - this.x, (e.y - this.y) * DEPTH_K) < 30) w.hit(null, e, { dmg: 10, spark: false });
    w.emit({ shake: 3 }); sfx("boom");
    this.die(null, true);
  }

  swing() {
    const w = this.world, h = this.hero, f = this.flip ? -1 : 1;
    w.fx("melee/sword-slash", { x: this.x, y: this.y, flip: this.flip, ramp: rampFor(this.el) ?? null, light: 0.5, opts: { radius: 30 * this.k } });
    sfx("swing");
    if (h && !h.dead) {
      const rel = (h.x - this.x) * f;
      if (rel > -6 && rel < 44 * this.k && Math.abs(h.y - this.y) < 16 * this.k) w.hit(this, h, { dmg: this.stats.atk, kb: 140, from: [this.x, this.y], spark: false });
    }
  }

  drawGround(p) {
    super.drawGround(p);
    // telegraphs: where the hit will land
    if (this.dead) return;
    const f = this.flip ? -1 : 1;
    if (this.state === "tele") {
      const k = 1 - this.stT / 0.5;
      for (let x = 0; x < 44 * this.k; x++) for (let y = -14 * this.k; y <= 14 * this.k; y += 1) {
        if ((x + y) % 2) continue;
        p.blendPx(Math.round(this.x + f * x), Math.round(this.y + y * 0.6), hex("#ff3040"), 0.18 + 0.3 * k);
      }
    }
    if (this.state === "fuse") {
      const R = 34;
      for (let a = 0; a < 64; a++) { const an = (a / 64) * Math.PI * 2; p.blendPx(Math.round(this.x + Math.cos(an) * R), Math.round(this.y + Math.sin(an) * R / DEPTH_K), hex("#ff3040"), 0.8); }
    }
    if (this.state === "aim") {
      const h = this.hero; if (!h) return;
      p.add(Math.round(this.x), Math.round(this.y - this.hover - 6), hex("#ff5040"), 1);
    }
  }

  draw(p) {
    if (this.D.rig) return this.drawRigBody(p);
    // critters draw through their effect; add an elite crown and a hit flash ring
    if (this.hitFlash > 0 && !this.dead) {
      const cy = this.y - this.hover - this.height * 0.5;
      for (let a = 0; a < 24; a++) { const an = a / 24 * Math.PI * 2; p.put(Math.round(this.x + Math.cos(an) * (this.r + 2)), Math.round(cy + Math.sin(an) * (this.r + 2)), hex("#ffffff"), 0.8); }
    }
    if (this.state === "fuse" && Math.floor(this.t * 16) % 2 === 0) p.add(Math.round(this.x), Math.round(this.y - this.hover - 6), hex("#ffffff"), 1);
  }

  drawRigBody(p) {
    let pose;
    const W = 0.5;
    if (this.dead) pose = DEAD;
    else if (this.state === "tele") pose = sampleKeys(archetype("slash", W, 0.35), -this.stT, lerpPose);
    else if (this.state === "swing") pose = sampleKeys(archetype("slash", W, 0.35), 0.35 - this.stT, lerpPose);
    else if (this.hitFlash > 0) pose = lerpPose(this.lastPose, HURT, 0.6);
    else if (this.moving) pose = movePose(1, "earth", this.t * 0.8);
    else pose = idlePose(1, "earth", this.t);
    this.lastPose = pose;
    drawRig(p, { x: this.x, y: this.y - this.z, pose, flip: this.flip, skin: this.skin, k: this.k, tint: this.hitFlash > 0 ? hex("#ffffff") : null, alpha: this.dead ? Math.max(0, 1 - this.deadT * 1.5) : 1,
      decor: (n, u, v) => (n === "head" && v > 4.2 && v < 5.6 && u > 0 && u < 4.5 ? this.skin.eye : this.elite && n === "torso" && Math.abs(u) < 1.2 && Math.abs(v - 5) < 1.2 ? hex("#ff3040") : 0) });
  }

  die(src, silent) {
    if (this.dead) return;
    this.dead = true; this.deadT = 0; this.hp = 0;
    this.clearStatusFx();
    if (this.body) this.body.inst.stop();
    if (this.aura) this.aura.inst.stop();
    const w = this.world;
    if (!silent) w.fx(this.D.rig ? "spawn/shatter-death" : "spawn/poof", { x: this.x, y: this.y + 0.5, z: this.hover, ramp: rampFor(this.el), light: 0.7 });
    if (!this.D.rig) this.removedSoon = true;
    w.kills++;
    w.emit({ killed: this });
  }
}

/** An enemy bullet: a glowing orb with a short trail. */
export class EnemyShot {
  constructor(o) {
    Object.assign(this, { r: 5, life: 3, dead: false, t: 0, trail: [] }, o);
    this.vx = Math.cos(this.ang) * this.speed; this.vy = Math.sin(this.ang) * this.speed * 0.55;
    this.c = this.color.map(hex);
  }
  update(dt, w) {
    this.t += dt;
    this.trail.push([this.x, this.y - this.z]); if (this.trail.length > 6) this.trail.shift();
    this.x += this.vx * dt; this.y += this.vy * dt;
    const A = w.arena;
    if (this.t > this.life || this.x < A.x0 - 10 || this.x > A.x1 + 10) { this.dead = true; return; }
    const h = w.hero;
    if (h && !h.dead && Math.hypot(h.x - this.x, (h.y - this.y) * DEPTH_K) < this.r + h.r) {
      w.hit(this.src, h, { dmg: this.src.stats.atk, kb: 80, from: [this.x, this.y], spark: false });
      this.dead = true;
    }
  }
  draw(p) {
    p.reset();
    this.trail.forEach(([x, y], i) => p.put(Math.round(x), Math.round(y), this.c[0], (i + 1) / this.trail.length * 0.7));
    const x = Math.round(this.x), y = Math.round(this.y - this.z);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 4) p.put(x + dx, y + dy, dx * dx + dy * dy <= 1 ? hex("#ffffff") : this.c[1]);
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const d = dx * dx + dy * dy; if (d < 36) p.add(x + dx, y + dy, this.c[0], 0.18 * (1 - d / 36)); }
  }
}
