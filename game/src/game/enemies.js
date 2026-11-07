// Enemies: pixelfx critters given bodies and minds, block soldiers on the same rig as the hero, and bosses.
import { hex, mix, fit, toHex, clamp } from "../px.js";
import { Actor } from "./actor.js";
import { drawRig, makeSkin, lerpPose, anchor } from "../rig/rig.js";
import { idlePose, movePose, sampleKeys, stepTime, archetype, HURT, DEAD } from "./poses.js";
// attacks drawn on held 12 fps steps, like the hero's
const stepped = (K, t) => sampleKeys(K, stepTime(K, t), lerpPose);
import { ELEMENTS } from "../data/elements.js";
import { DEPTH_K } from "./world.js";
import { sfx } from "../core/audio.js";
import { sculpt, sd, glow, ramp as rampC } from "./sculpt.js";

export const ENEMY_DEFS = {
  slime: { name: "슬라임", fx: "critters/slime", opts: { hop: 9 }, hp: 30, atk: 7, speed: 30, r: 9, h: 14, ai: "hopper", gold: 2 },
  bat: { name: "박쥐", fx: "critters/bat", hp: 18, atk: 6, speed: 72, r: 7, h: 10, z: 18, flying: true, ai: "swooper", gold: 2 },
  skull: { name: "불꽃 해골", fx: "critters/flying-skull", opts: { hover: 14, floor: false }, hp: 34, atk: 9, speed: 34, r: 8, h: 18, ai: "shooter", gold: 3, flying: true },
  ghost: { name: "유령", fx: "critters/ghost", opts: { hover: 10 }, hp: 40, atk: 9, speed: 40, r: 8, h: 18, ai: "drifter", gold: 3, flying: true },
  eye: { name: "감시의 눈", fx: "critters/eyeball", opts: { hover: 16 }, hp: 36, atk: 11, speed: 28, r: 8, h: 16, ai: "shooter", gold: 4, flying: true, shotSpeed: 130 },
  wisp: { name: "폭발 도깨비불", fx: "critters/wisp", opts: { hover: 10 }, hp: 20, atk: 22, speed: 62, r: 7, h: 14, ai: "bomber", gold: 3, flying: true },
  knight: { name: "블록 병사", rig: true, hp: 70, atk: 12, speed: 40, r: 8, h: 34, ai: "brawler", gold: 5 },
  brute: { name: "블록 거한", rig: true, k: 1.35, hp: 160, atk: 18, speed: 30, r: 11, h: 46, ai: "brawler", gold: 9, heavyish: true },
  // critters with new minds
  frog: { name: "독두꺼비", fx: "critters/frog", hp: 40, atk: 12, speed: 30, r: 8, h: 12, ai: "leaper", gold: 3 },
  snake: { name: "그림자 뱀", fx: "critters/snake", hp: 34, atk: 13, speed: 40, r: 9, h: 8, ai: "lunger", gold: 3 },
  jelly: { name: "전기 해파리", fx: "critters/jellyfish", hp: 44, atk: 10, speed: 22, r: 9, h: 18, z: 24, flying: true, ai: "shocker", gold: 4 },
  butterfly: { name: "치유 나비", fx: "critters/butterfly", hp: 26, atk: 0, speed: 46, r: 8, h: 10, z: 22, flying: true, ai: "healer", gold: 4 },
  bird: { name: "칼날 새", fx: "critters/bird", hp: 22, atk: 9, speed: 80, r: 7, h: 10, z: 20, flying: true, ai: "swooper", gold: 2 },
  // block soldiers with kit
  archer: { name: "블록 궁수", rig: true, gear: "bow", hp: 50, atk: 13, speed: 38, r: 8, h: 34, ai: "archer", gold: 5 },
  mage: { name: "블록 마법사", rig: true, gear: "hat", hp: 48, atk: 15, speed: 32, r: 8, h: 40, ai: "caster", gold: 6 },
  shield: { name: "방패병", rig: true, gear: "shield", hp: 110, atk: 12, speed: 30, r: 9, h: 34, ai: "brawler", gold: 6, guard: true },
  assassin: { name: "그림자 암살자", rig: true, gear: "dagger", k: 0.9, hp: 46, atk: 17, speed: 60, r: 7, h: 30, ai: "stalker", gold: 6, skin: "shade" },
  skeleton: { name: "해골 기사", rig: true, gear: "sword", hp: 64, atk: 13, speed: 36, r: 8, h: 34, ai: "brawler", gold: 5, skin: "bone", revive: true },
  imp: { name: "화염 임프", rig: true, gear: "horns", k: 0.78, hp: 36, atk: 12, speed: 52, r: 7, h: 26, ai: "imp", gold: 4, skin: "imp" },
  // sculpted beasts
  wolf: { name: "그림자 늑대", beast: "wolf", hp: 50, atk: 12, speed: 70, r: 10, h: 16, ai: "pack", gold: 4 },
  spider: { name: "수정 거미", beast: "spider", hp: 38, atk: 10, speed: 64, r: 9, h: 12, ai: "skitter", gold: 4 },
  golemling: { name: "꼬마 골렘", beast: "golemling", hp: 140, atk: 17, speed: 22, r: 12, h: 30, ai: "pounder", gold: 8, heavyish: true },
  turret: { name: "수호 토템", beast: "turret", hp: 120, atk: 11, speed: 0, r: 10, h: 34, ai: "turret", gold: 7, heavyish: true },
  mimic: { name: "미믹", beast: "mimic", hp: 90, atk: 18, speed: 46, r: 10, h: 16, ai: "mimic", gold: 25, gems: 30 },
};

/** Floor themes pick which critters show up and in what colour. */
export const THEME_POOL = {
  fire: ["slime", "skull", "bat", "knight", "wisp", "brute"],
  water: ["slime", "ghost", "eye", "knight", "bat", "brute"],
  wind: ["bat", "wisp", "ghost", "knight", "eye", "brute"],
  earth: ["slime", "knight", "skull", "brute", "eye", "bat"],
};

function rampFor(el) { return ELEMENTS[el]?.ramp; }
const SKINS = {
  bone: { ramp: ["#3a352c", "#8a806c", "#b8ad96", "#e4dcc8", "#fffaf0"].map(hex), outline: hex("#1a1814"), eye: hex("#ff5a50") },
  shade: { ramp: ["#08070c", "#14121c", "#201c2c", "#2e2840", "#433a5a"].map(hex), outline: hex("#000000"), eye: hex("#ff3060") },
  imp: { ramp: ["#3a0a0a", "#6a1410", "#a8241a", "#e04a2a", "#ff8a5a"].map(hex), outline: hex("#140404"), eye: hex("#ffe066") },
};
function enemySkin(el, kind) {
  if (kind && SKINS[kind]) return SKINS[kind];
  const b = ELEMENTS[el]?.body ?? ["#2a2836", "#4a4658", "#6d6a80", "#a9a6b8", "#d3d1dc"];
  const dark = ["#24212e", "#3a3648", "#57536c", "#7e7a96", "#a8a4bc"].map(hex);
  return { ramp: dark.map((c, i) => mix(c, hex(b[i]), 0.45)), outline: hex("#08070c"), eye: hex(b[4]) };
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
    if (D.rig) { this.skin = enemySkin(this.el, D.skin); this.k = D.k ?? 1; this.lastPose = {}; }
    this.heavy = !!D.heavyish;
    if (D.ai === "mimic") { this.state = "disguised"; this.invuln = 0; }
    if (D.ai === "stalker") this.alpha = 1;
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
    if (this.D.ai === "stalker") this.alpha += ((this.state === "stalk" ? 0.12 : 1) - this.alpha) * Math.min(1, dt * 6);
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
    if (this.state === "bones") return;
    if (this.mk?.follow) { this.mk.x = this.x; this.mk.y = this.y; }
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
      case "leaper": { // frog: crouch, leap onto where you stand, splash on landing
        if (this.state === "tele") { if (this.stT <= 0) { this.state = "jump"; this.stT = 0.5; this.j0 = [this.x, this.y]; } }
        else if (this.state === "jump") {
          const u = 1 - this.stT / 0.5; this.x = this.j0[0] + (this.mk.x - this.j0[0]) * u; this.y = this.j0[1] + (this.mk.y - this.j0[1]) * u; this.z = Math.sin(u * Math.PI) * 34;
          if (this.stT <= 0) { this.z = 0; this.state = "idle"; this.cool = 1.4 + Math.random(); this.aoe(this.mk.x, this.mk.y, 24, 1.1, { slow: 1.5 }, "water/splash"); this.mk = null; }
        } else { go(h.x, h.y, 0.4); if (this.cool <= 0 && d < 150) { this.state = "tele"; this.stT = 0.45; this.mk = { x: h.x, y: h.y, r: 24 }; } }
        break;
      }
      case "lunger": { // snake: coil, then strike in a straight line
        if (this.state === "tele") { if (this.stT <= 0) { this.state = "dash"; this.stT = 0.28; const L = Math.max(1, Math.hypot(this.lx, this.ly)); this.vx = this.lx / L * 360; this.vy = this.ly / L * 240; this.contactCd = 0; } }
        else if (this.state === "dash") { this.x += this.vx * dt; this.y += this.vy * dt; if (this.stT <= 0) { this.state = "idle"; this.cool = 1.6; } }
        else { if (d > 70) go(h.x, h.y); else go(this.x, h.y, 0.4); if (this.cool <= 0 && d < 110) { this.state = "tele"; this.stT = 0.5; this.lx = dx; this.ly = dy; this.flip = dx < 0; } }
        break;
      }
      case "shocker": { // jelly: drifts close, charges a ring, discharges
        if (this.state === "tele") { if (this.stT <= 0) { this.state = "idle"; this.cool = 2.6; this.aoe(this.x, this.y, 36, 1.2, { stun: 0.35 }, "lightning/zap-hit"); this.world.bolts.push({ a: [this.x - 20, this.y, 20], b: [this.x + 20, this.y, 20], t: 0.2 }); this.mk = null; } }
        else { go(h.x + Math.sin(this.t) * 20, h.y, 0.8); if (this.cool <= 0 && d < 50) { this.state = "tele"; this.stT = 0.7; this.mk = { x: this.x, y: this.y, r: 36, follow: true }; } }
        break;
      }
      case "healer": { // butterfly: stays back and mends the others
        go(this.x - dx * 2, h.y + Math.sin(this.t * 1.5) * 50, d < 140 ? 1 : 0.2);
        if (this.cool <= 0) {
          this.cool = 2.8;
          const hurt = this.world.enemies.filter((e) => e !== this && e.hp < e.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
          if (hurt) { hurt.heal(hurt.maxHp * 0.25); this.world.fx("holy/heal", { x: hurt.x, y: hurt.y + 0.5, light: 0.8 }); this.world.bolts.push({ a: [this.x, this.y, 22], b: [hurt.x, hurt.y, 14], t: 0.25, ramp: ["#08201a", "#3ec466", "#c8ffc4"] }); }
        }
        break;
      }
      case "archer": { // keeps away, takes aim along a line you can see, looses a fast arrow
        if (this.state === "tele") { if (this.stT <= 0) { this.state = "idle"; this.cool = 2.2 + Math.random(); this.world.projs.push(new EnemyShot({ x: this.x + (this.flip ? -8 : 8), y: this.y + 0.5, z: 20, ang: this.aimA, speed: 300, src: this, team: 1, color: ["#8e5c2c", "#fff6c4"], r: 4, style: "arrow" })); sfx("swing"); this.aimLine = null; } }
        else { if (d < 120) go(this.x - dx, this.y - dy, 0.9); else if (d > 190) go(h.x, h.y); else go(this.x, h.y, 0.4); if (this.cool <= 0 && d < 260) { this.state = "tele"; this.stT = 0.75; this.aimA = Math.atan2((h.y - this.y) / 0.55, h.x - this.x); this.aimLine = true; this.flip = dx < 0; } }
        break;
      }
      case "caster": { // mage: marks the floor under you and calls its element down
        if (this.state === "tele") { if (this.stT <= 0) { this.state = "idle"; this.cool = 2.8; const m = this.mk; this.aoe(m.x, m.y, 24, 1.5, this.el === "water" ? { slow: 2 } : this.el === "fire" ? { burn: 2 } : { stun: 0.3 }); this.mk = null; } }
        else { if (d < 110) go(this.x - dx, this.y - dy, 0.8); else if (d > 180) go(h.x, h.y); if (this.cool <= 0 && d < 240) { this.state = "tele"; this.stT = 1.0; this.mk = { x: h.x, y: h.y, r: 24 }; this.world.fx(this.castFx(), { x: h.x, y: h.y, ramp: rampFor(this.el), light: 0.8, dur: 2 }); sfx("summon"); } }
        break;
      }
      case "stalker": { // assassin: fades out, slips behind you, strikes
        if (this.state === "tele") { if (this.stT <= 0) { this.state = "swing"; this.stT = 0.35; this.swing(); } }
        else if (this.state === "swing") { if (this.stT <= 0) { this.state = "idle"; this.cool = 2.4; } }
        else {
          this.state = d > 40 ? "stalk" : "idle";
          go(h.x - (h.flip ? -1 : 1) * 30, h.y, 1.1);
          if (this.cool <= 0 && d < 46) { this.state = "tele"; this.stT = 0.35; this.flip = dx < 0; this.world.fx("spawn/poof", { x: this.x, y: this.y + 0.5, light: 0.5, opts: { palette: ["#08070c", "#14121c", "#201c2c", "#2e2840", "#433a5a", "#5c5070"] } }); }
        }
        break;
      }
      case "imp": { // throws fire, blinks around
        if (this.state === "aim") { if (this.stT <= 0) { this.shoot(); this.state = "idle"; this.cool = 2 + Math.random(); } }
        else {
          if (d < 90) go(this.x - dx, this.y - dy); else go(h.x, h.y, 0.5);
          this.blink = (this.blink ?? 3) - dt;
          if (this.blink <= 0) { this.blink = 3.5; const A = this.world.arena; this.world.fx("spawn/poof", { x: this.x, y: this.y + 0.5, light: 0.6, ramp: rampFor("fire") }); this.x = Math.max(A.x0 + 20, Math.min(A.x1 - 20, h.x + (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 40))); this.y = A.y0 + Math.random() * (A.y1 - A.y0); sfx("dash"); }
          if (this.cool <= 0 && d < 220) { this.state = "aim"; this.stT = 0.45; }
        }
        break;
      }
      case "pack": { // wolf: circles, then darts in for a bite
        if (this.state === "tele") { if (this.stT <= 0) { this.state = "dash"; this.stT = 0.3; const L = Math.max(1, Math.hypot(dx, dy)); this.vx = dx / L * 300; this.vy = dy / L * 200; this.contactCd = 0; } }
        else if (this.state === "dash") { this.x += this.vx * dt; this.y += this.vy * dt; this.moving = true; if (this.stT <= 0) { this.state = "idle"; this.cool = 1.6 + Math.random(); } }
        else { const a = this.t * 1.4 + this.x * 0.01; go(h.x + Math.cos(a) * 80, h.y + Math.sin(a) * 30); if (this.cool <= 0 && d < 120) { this.state = "tele"; this.stT = 0.35; this.flip = dx < 0; } }
        break;
      }
      case "skitter": { // spider: darts about and spits sticky webs
        this.zig = (this.zig ?? 0) - dt;
        if (this.zig <= 0) { this.zig = 0.4 + Math.random() * 0.4; this.zt = [h.x + (Math.random() - 0.5) * 160, h.y + (Math.random() - 0.5) * 70]; }
        go(this.zt[0], this.zt[1], 1.1);
        if (this.cool <= 0 && d < 200) { this.cool = 2.2; this.world.projs.push(new EnemyShot({ x: this.x, y: this.y + 0.5, z: 6, ang: Math.atan2((h.y - this.y) / 0.55, h.x - this.x), speed: 150, src: this, team: 1, color: ["#c8c0d8", "#ffffff"], r: 5, st: { slow: 2 }, style: "web" })); }
        break;
      }
      case "pounder": { // golemling: plods in, raises its arms, quakes the ground around it
        if (this.state === "tele") { if (this.stT <= 0) { this.state = "idle"; this.cool = 2.2; this.aoe(this.x, this.y, 34, 1.4, { stun: 0.4 }, "impacts/ground-slam"); this.world.emit({ shake: 3 }); this.mk = null; } }
        else { go(h.x, h.y, 1); if (this.cool <= 0 && d < 40) { this.state = "tele"; this.stT = 0.75; this.mk = { x: this.x, y: this.y, r: 34, follow: true }; } }
        break;
      }
      case "turret": { // totem: never moves, fires crosses of orbs, alternating + and ×
        if (this.cool <= 0) {
          this.cool = 2.1; this.rot = ((this.rot ?? 0) + 1) % 2;
          for (let i = 0; i < 4; i++) this.world.projs.push(new EnemyShot({ x: this.x, y: this.y + 0.5, z: 26, ang: (i * Math.PI) / 2 + (this.rot ? Math.PI / 4 : 0), speed: 95, src: this, team: 1, color: ELEMENTS[this.el]?.glow ?? ["#4ce8d8", "#ffffff"], r: 5 }));
          sfx("ui");
        }
        break;
      }
      case "mimic": { // a treasure chest… until you come close
        if (this.state === "disguised") { if (d < 54) { this.state = "tele"; this.stT = 0.35; sfx("door"); this.world.emit({ shake: 2 }); } }
        else if (this.state === "tele") { if (this.stT <= 0) { this.state = "idle"; this.aoe(this.x + (this.flip ? -16 : 16), this.y, 26, 1.4, null, "impacts/blunt-hit"); } }
        else { go(h.x, h.y, 0.6 + 0.6 * Math.max(0, Math.sin(this.t * 6))); if (this.cool <= 0 && d < 34) { this.state = "tele"; this.stT = 0.4; this.cool = 1.4; } }
        break;
      }
    }
    // touching the hero hurts (critters only; soldiers hit with their arms)
    const noTouch = ["bomber", "healer", "turret", "shocker", "mimic", "caster", "archer"].includes(this.D.ai) || this.state === "disguised";
    if (!this.D.rig && !noTouch && this.contactCd <= 0 && d < this.r + h.r + 3 && Math.abs((this.z + this.hover) - h.z) < 26) {
      this.contactCd = 0.9;
      this.world.hit(this, h, { dmg: this.stats.atk, kb: 110, from: [this.x, this.y], spark: false });
    }
  }

  /** Hit the hero if inside a circle, with an optional effect. */
  aoe(x, y, r, k, st, fx) {
    const w = this.world, h = this.hero;
    if (fx) w.fx(fx, { x, y: y + 0.5, ramp: rampFor(this.el), light: 0.7, dur: 1, opts: fx === "impacts/ground-slam" ? { reach: r * 1.4 } : undefined });
    if (h && !h.dead && Math.hypot(h.x - x, (h.y - y) * DEPTH_K) < r + h.r) { w.hit(this, h, { dmg: this.stats.atk * k, kb: 120, from: [x, y], spark: false }); if (st) h.applyStatus(st, this); }
  }
  castFx() { return { fire: "fire/flame-pillar", water: "ice/ice-spikes", wind: "lightning/lightning-strike", earth: "nature/earth-spike", light: "holy/smite", dark: "shadow/grasping-hands" }[this.el] ?? "arcane/magic-circle-cast"; }
  /** Shield bearers shrug off blows from the front. */
  modDamage(dmg, src) {
    if (this.D.guard && src && this.state !== "swing") { const front = (src.x - this.x) * (this.flip ? -1 : 1) > 0; if (front) { this.world.fx("impacts/shield-block", { x: this.x + (this.flip ? -8 : 8), y: this.y + 0.5, z: 14, light: 0.6, flip: this.flip }); return Math.max(1, Math.round(dmg * 0.2)); } }
    return dmg;
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
    if (this.mk && this.state === "tele") {
      const m = this.mk, k = 1 - Math.max(0, this.stT) / 0.8, blink = this.stT < 0.2 && Math.floor(this.stT * 30) % 2;
      for (let a = 0; a < 64; a++) { const an = (a / 64) * Math.PI * 2; p.blendPx(Math.round(m.x + Math.cos(an) * m.r), Math.round(m.y + Math.sin(an) * m.r / DEPTH_K), blink ? hex("#ffd0a0") : hex("#ff3040"), 0.85); }
      for (let a = 0; a < 40; a++) { const an = (a / 40) * Math.PI * 2, rr = m.r * k; p.blendPx(Math.round(m.x + Math.cos(an) * rr), Math.round(m.y + Math.sin(an) * rr / DEPTH_K), hex("#ff3040"), 0.4); }
    }
    if (this.aimLine && this.state === "tele") {
      const c = Math.cos(this.aimA), s2 = Math.sin(this.aimA) * 0.55;
      for (let i = 10; i < 260; i += 3) p.blendPx(Math.round(this.x + c * i), Math.round(this.y + s2 * i), hex("#ff3040"), 0.5 * (1 - i / 260));
    }
    if (this.D.ai === "lunger" && this.state === "tele") {
      const L = Math.max(1, Math.hypot(this.lx, this.ly));
      for (let i = 8; i < 100; i += 2) p.blendPx(Math.round(this.x + this.lx / L * i), Math.round(this.y + this.ly / L * i * 0.66), hex("#ff3040"), 0.5);
    }
    if (this.state === "aim") {
      const h = this.hero; if (!h) return;
      p.add(Math.round(this.x), Math.round(this.y - this.hover - 6), hex("#ff5040"), 1);
    }
  }

  draw(p) {
    if (this.D.rig) return this.drawRigBody(p);
    if (this.D.beast) return this.drawBeast(p);
    // critters draw through their effect; add an elite crown and a hit flash ring
    if (this.hitFlash > 0 && !this.dead) {
      const cy = this.y - this.hover - this.height * 0.5;
      for (let a = 0; a < 24; a++) { const an = a / 24 * Math.PI * 2; p.put(Math.round(this.x + Math.cos(an) * (this.r + 2)), Math.round(cy + Math.sin(an) * (this.r + 2)), hex("#ffffff"), 0.8); }
    }
    if (this.state === "fuse" && Math.floor(this.t * 16) % 2 === 0) p.add(Math.round(this.x), Math.round(this.y - this.hover - 6), hex("#ffffff"), 1);
  }

  drawRigBody(p) {
    let pose;
    const W = 0.5, ai = this.D.ai;
    if (this.dead || this.state === "bones") pose = DEAD;
    else if (this.state === "tele" && ai === "archer") pose = stepped(archetype("point", 0.3, 0.4), Math.min(0.2, 0.75 - this.stT));
    else if (this.state === "tele" && ai === "caster") pose = stepped(archetype("raise", 0.3, 0.8), 1.0 - this.stT - 0.3);
    else if (this.state === "aim" && ai === "imp") pose = stepped(archetype("throw", 0.3, 0.3), 0.45 - this.stT - 0.3);
    else if (this.state === "tele") pose = stepped(archetype("slash", W, 0.35), -this.stT);
    else if (this.state === "swing") pose = stepped(archetype("slash", W, 0.35), 0.35 - this.stT);
    else if (this.hitFlash > 0) pose = lerpPose(this.lastPose, HURT, 0.6);
    else if (this.moving) pose = movePose(ai === "stalker" ? 2 : 1, ai === "stalker" ? "wind" : "earth", this.t * 0.8);
    else pose = idlePose(ai === "stalker" || ai === "brawler" ? 2 : 1, "earth", this.t);
    if (this.D.gear === "shield" && !this.dead && this.state !== "swing") pose = { ...pose, aN: 1.0, turn: 0.9 };
    this.lastPose = pose;
    const k = this.k, f = this.flip ? -1 : 1;
    const alpha = this.dead ? Math.max(0, 1 - this.deadT * 1.5) : this.state === "bones" ? 0.75 : (this.alpha ?? 1);
    drawRig(p, { x: this.x, y: this.y - this.z, pose, flip: this.flip, skin: this.skin, k, tint: this.hitFlash > 0 ? hex("#ffffff") : null, alpha,
      decor: (n, u, v) => (n === "head" && v > 4.2 && v < 5.6 && u > 0 && u < 4.5 ? this.skin.eye : this.elite && n === "torso" && Math.abs(u) < 1.2 && Math.abs(v - 5) < 1.2 ? hex("#ff3040") : 0) });
    if (this.dead || this.state === "bones") return;
    this.drawGear(p, pose, k, f, alpha);
  }

  drawGear(p, pose, k, f, a) {
    const rx = this.x + f * (pose.x ?? 0) * k, ry = this.y - this.z + ((pose.y ?? 0) - (pose.z ?? 0)) * k;
    const W = (pt) => [Math.round(rx + f * pt[0]), Math.round(ry + pt[1])];
    const [hx, hy] = W(anchor(pose, "handN", k)), [tx, ty] = W(anchor(pose, "headTop", k));
    const E = ELEMENTS[this.el], accent = hex(E?.css ?? "#a59fc4"), dark = hex("#1a1408"), wood = hex("#8e5c2c"), steel = hex("#d0d8e6");
    p.reset();
    switch (this.D.gear) {
      case "bow": {
        const pull = this.state === "tele" ? 3 : 0;
        for (let i = -9; i <= 9; i++) { const xx = hx + f * Math.round(4 - (i * i) / 22), yy = hy + i; p.put(xx, yy, wood, a); p.put(xx + f, yy, dark, a); }
        for (let i = -9; i <= 9; i++) p.put(hx + f * (Math.abs(i) < 2 ? -pull : 0) - f * Math.round(pull * (1 - Math.abs(i) / 9)), hy + i, hex("#e4dcc8"), a * 0.9);
        break;
      }
      case "hat": {
        for (let j = 0; j < 10; j++) { const w2 = Math.max(0, 4 - j * 0.45); for (let i = -w2; i <= w2; i++) p.put(Math.round(tx + i - f * j * 0.4), ty - j, j > 7 ? accent : hex("#2b1252"), a); }
        for (let i = -7; i <= 7; i++) { p.put(tx + i, ty + 1, hex("#1a0a30"), a); p.put(tx + i, ty, hex("#481c88"), a); }
        if (this.state === "tele") { p.put(hx, hy, hex("#ffffff"), a); glow(p, hx, hy, 8, accent, 0.5); }
        break;
      }
      case "shield": {
        const sx = rx + f * 9 * k, sy = ry - 20 * k;
        for (let j = -9; j <= 9; j++) for (let i = -6; i <= 6; i++) {
          const bottom = j > 5 && Math.abs(i) > 6 - (j - 5) * 1.5;
          if (bottom) continue;
          const edge = Math.abs(i) === 6 || j === -9 || (j > 5 && Math.abs(i) >= 5 - (j - 5) * 1.5);
          p.put(Math.round(sx + i), Math.round(sy + j), edge ? steel : (Math.abs(i) < 2 || Math.abs(j + 1) < 2) ? accent : hex("#3a3448"), a);
        }
        break;
      }
      case "dagger": for (let i = 0; i < 7; i++) p.put(hx + f * i, hy + Math.round(i * 0.2), i < 2 ? dark : steel, a); break;
      case "sword": for (let i = 0; i < 13; i++) p.put(hx + f * Math.round(i * 0.3), hy + i, i < 3 ? dark : steel, a); break;
      case "horns": for (const s of [-1, 1]) for (let j = 0; j < 4; j++) p.put(tx + s * (2 + j * 0.6), ty - j, j > 2 ? hex("#ffd84a") : hex("#2a0808"), a); break;
    }
  }

  /** The sculpted beasts. */
  drawBeast(p) {
    const t = this.t, f = this.flip ? -1 : 1, x = this.x, y = this.y - this.z, B = this.D.beast;
    const tint = this.hitFlash > 0 ? hex("#ffffff") : null, a = this.dead ? Math.max(0, 1 - this.deadT * 1.5) : 1;
    const body = rampC(ELEMENTS[this.el]?.body ?? ["#2a2836", "#4a4658", "#6d6a80", "#a9a6b8", "#d3d1dc"]);
    const fur = body.map((c) => mix(c, hex("#14121c"), 0.55)), eye = hex(ELEMENTS[this.el]?.css ?? "#ff5040");
    const run = this.moving || this.state === "dash", ph = t * (this.state === "dash" ? 22 : 12);
    if (B === "wolf") {
      const crouch = this.state === "tele" ? 3 : 0, bob = run ? Math.abs(Math.sin(ph)) * -2 : 0;
      for (const [lx, o] of [[-7, 0], [-4, 1.6], [6, 0.8], [9, 2.4]]) { const sw = run ? Math.sin(ph + o * 2) * 3 : 0; sculpt(p, x + f * (lx + sw), y - 4, (u, v) => sd.box(u, v, 1.4, 4, 0.6), { ramp: fur, r: 6, tint, alpha: a }); }
      sculpt(p, x - f * 12, y - 13 + crouch + bob, (u, v) => sd.ellipse(u, v, 6, 2.4), { ramp: fur, r: 8, rot: f * (-0.6 + Math.sin(t * 6) * 0.2), tint, alpha: a });
      sculpt(p, x, y - 11 + crouch + bob, (u, v) => sd.ellipse(u, v, 12, 5.5), { ramp: fur, r: 14, tint, alpha: a, rim: fur[3] });
      sculpt(p, x + f * 11, y - 15 + crouch * 1.5 + bob, (u, v) => Math.min(sd.ellipse(u, v, 5, 4), sd.ellipse(u - 5, v + 1.5, 3.5, 2), sd.poly(u, v, [[-3, -2], [-1, -8], [1, -2]]), sd.poly(u, v, [[0, -2], [3, -7], [3.5, -1]])), { ramp: fur, r: 12, flip: this.flip, tint, alpha: a,
        paint: (u, v) => (Math.hypot(u - 2, v + 0.5) < 1.1 ? eye : u > 8 && v > 0 ? hex("#e8e0f0") : 0) });
      glow(p, x + f * 13, y - 15 + crouch * 1.5 + bob, 5, eye, 0.5 * a);
    } else if (B === "spider") {
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
        const base = [x + s * (i - 1.5) * 3, y - 6], sw = run ? Math.sin(ph + i * 1.7 + (s > 0 ? 1 : 0)) * 2 : 0, knee = [base[0] + s * (6 + i), y - 11 + sw], foot = [base[0] + s * (10 + i * 1.5), y];
        for (const [p0, p1] of [[base, knee], [knee, foot]]) { const L = Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1])); for (let k2 = 0; k2 <= L; k2++) p.put(Math.round(p0[0] + (p1[0] - p0[0]) * k2 / L), Math.round(p0[1] + (p1[1] - p0[1]) * k2 / L), fur[1], a); }
      }
      sculpt(p, x - f * 4, y - 8, (u, v) => sd.ellipse(u, v, 7, 5.5), { ramp: fur, r: 9, tint, alpha: a, rim: fur[3] });
      sculpt(p, x - f * 5, y - 13, (u, v) => sd.poly(u, v, [[0, -6], [2.5, 0], [0, 2], [-2.5, 0]]), { ramp: body, r: 8, glow: [eye, 0.4], tint, alpha: a, soft: 2 });
      sculpt(p, x + f * 4, y - 7, (u, v) => sd.ellipse(u, v, 3.5, 3), { ramp: fur, r: 5, tint, alpha: a, paint: (u, v) => (Math.abs(v + 0.5) < 0.7 && Math.abs(Math.abs(u) - 1.2) < 0.6 ? eye : 0) });
    } else if (B === "golemling") {
      const lift = this.state === "tele" ? -6 * Math.min(1, (0.75 - this.stT) / 0.5) : 0, bob = run ? Math.abs(Math.sin(t * 6)) * -1.5 : 0;
      const R = rampC(["#15131b", "#2c2838", "#433e4b", "#5c5664", "#7b7484", "#a39cab"]);
      for (const s of [-1, 1]) sculpt(p, x + s * 6, y - 5, (u, v) => sd.rock(u, v, 5, 5, 3 + s, 0.2, 6), { ramp: R, r: 8, tint, alpha: a });
      sculpt(p, x, y - 17 + bob, (u, v) => sd.rock(u, v, 11, 10, 7, 0.16, 7), { ramp: R, r: 15, tint, alpha: a, paint: (u, v) => (Math.abs(u - f * 2) + Math.abs(v + 1) < 2.5 ? eye : 0) });
      glow(p, x + f * 2, y - 18 + bob, 10, eye, 0.35 * a);
      for (const s of [-1, 1]) sculpt(p, x + s * 13, y - 18 + lift + bob, (u, v) => sd.rock(u, v, 5, 6, 9 + s, 0.2, 6), { ramp: R, r: 9, tint, alpha: a });
    } else if (B === "turret") {
      const R = rampC(["#140e0a", "#2a1e14", "#47321e", "#69492a", "#8e6638", "#b88a52"]);
      for (let i = 0; i < 3; i++) sculpt(p, x, y - 6 - i * 10, (u, v) => sd.box(u, v, 7 - i * 0.5, 5, 1.5), { ramp: R, r: 10, tint, alpha: a,
        paint: (u, v) => (Math.abs(v) < 1 && Math.abs(Math.abs(u) - 2.6) < 1 ? (i === 2 ? eye : R[0]) : Math.abs(v - 3) < 0.6 && Math.abs(u) < 3 ? R[0] : 0) });
      const spin = t * 2;
      sculpt(p, x, y - 40 + Math.sin(t * 3) * 1.5, (u, v) => sd.poly(u, v, [[0, -7], [4 * Math.cos(spin), 0], [0, 7], [-4 * Math.cos(spin), 0]]), { ramp: body, r: 9, glow: [eye, 0.5], tint, alpha: a, soft: 2 });
      glow(p, x, y - 40, 12, eye, 0.35 * a);
    } else if (B === "mimic") {
      const open = this.state === "disguised" ? 0 : this.state === "tele" ? 1 : 0.35 + 0.35 * Math.max(0, Math.sin(t * 6));
      const W2 = rampC(["#160c06", "#2e1a0c", "#4a2c14", "#6a421e", "#8e5c2c", "#b47c40"]), gold = hex("#ffd84a");
      sculpt(p, x, y - 6, (u, v) => sd.box(u, v, 11, 6, 1), { ramp: W2, r: 13, tint, alpha: a, paint: (u, v) => (Math.abs(u) > 9.5 || Math.abs(v + 5) < 0.6 ? gold : 0) });
      if (open > 0.1) { for (let i = -9; i <= 9; i += 3) { p.put(x + i, y - 12, hex("#fffaf0"), a); p.put(x + i + 1, y - 13, hex("#fffaf0"), a); } for (let i = -8; i <= 8; i++) p.put(x + i, y - 13 - Math.round(open * 3), hex("#6a101c"), a); }
      sculpt(p, x - f * 2, y - 14 - open * 8, (u, v) => Math.max(sd.ellipse(u, v + 1, 11, 5), v - 2), { ramp: W2, r: 13, rot: -f * open * 0.5, tint, alpha: a, paint: (u, v) => (Math.abs(u) > 9.5 || Math.abs(v - 1) < 0.6 ? gold : Math.abs(u) < 1.4 && v > -1 ? gold : 0) });
      if (open > 0.1) for (const s of [-3, 3]) { p.put(x + s, y - 16 - Math.round(open * 6), eye, a); glow(p, x + s, y - 16 - open * 6, 4, eye, 0.5 * a); }
      if (this.state === "disguised" && Math.sin(t * 2) > 0.95) glow(p, x, y - 10, 10, gold, 0.5);
    }
  }

  die(src, silent) {
    if (this.dead) return;
    if (this.D.revive && !this.revived) {
      // bones fall apart… and pull themselves together again
      this.revived = true; this.hp = 1; this.state = "bones"; this.invuln = 2.4; this.stT = 2.4;
      this.world.fx("spawn/shatter-death", { x: this.x, y: this.y + 0.5, light: 0.5, opts: { palette: ["#1a1814", "#3a352c", "#5e5648", "#8a806c", "#b8ad96", "#e4dcc8", "#fffaf0", "#ffffff"] } });
      this.world.after(2.4, () => { if (this.removed) return; this.hp = Math.round(this.maxHp * 0.5); this.state = "idle"; this.world.fx("spawn/summon-rise", { x: this.x, y: this.y + 0.5, light: 0.7 }); });
      return;
    }
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
      if (this.st) h.applyStatus(this.st, this.src);
      this.dead = true;
    }
  }
  draw(p) {
    p.reset();
    if (this.style === "arrow") {
      // a shaft with a steel head and fletching, along its flight
      const a = Math.atan2(this.vy, this.vx), x = this.x, y = this.y - this.z, c = Math.cos(a), s = Math.sin(a);
      for (let i = -7; i <= 4; i++) p.put(Math.round(x + c * i), Math.round(y + s * i), i > 2 ? hex("#e4e8f0") : i < -5 ? hex("#ff6a5a") : hex("#8e5c2c"));
      for (let i = 0; i < 3; i++) p.add(Math.round(x - c * (8 + i * 3)), Math.round(y - s * (8 + i * 3)), hex("#b8c8e8"), 0.3);
      return;
    }
    if (this.style === "web") {
      const x = Math.round(this.x), y = Math.round(this.y - this.z);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + this.t * 3; for (let r = 1; r <= 4; r++) p.put(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), hex("#e8e4f0"), 0.9); }
      for (let r = 2; r <= 4; r += 2) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; p.put(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), hex("#c8c0d8"), 0.7); }
      return;
    }
    this.trail.forEach(([x, y], i) => p.put(Math.round(x), Math.round(y), this.c[0], (i + 1) / this.trail.length * 0.7));
    const x = Math.round(this.x), y = Math.round(this.y - this.z);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 4) p.put(x + dx, y + dy, dx * dx + dy * dy <= 1 ? hex("#ffffff") : this.c[1]);
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const d = dx * dx + dy * dy; if (d < 36) p.add(x + dx, y + dy, this.c[0], 0.18 * (1 - d / 36)); }
  }
}
