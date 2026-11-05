// The player: a blocky puppet with a spirit absorbed into its chest. Stage decides moves, poses and looks.
import { hex, mix, fit, toHex, clamp } from "../px.js";
import { Actor } from "./actor.js";
import { drawRig, makeSkin, lerpPose, anchor, SKIN } from "../rig/rig.js";
import { idlePose, movePose, sampleKeys, HURT, DEAD } from "./poses.js";
import { Action } from "./actions.js";
import { ELEMENTS } from "../data/elements.js";
import { moveset } from "../data/skills.js";
import { SPIRIT } from "../data/spirits.js";
import { sfx } from "../core/audio.js";

const BASIC_GAP = 0.06;

export class Hero extends Actor {
  constructor(o) {
    super({ team: 0, r: 7, height: 34, shadowW: 16, ...o });
    const def = SPIRIT[o.spirit.id];
    this.spirit = o.spirit; this.def = def;
    this.el = def.el; this.stage = o.spirit.stage;
    this.stats = o.stats;
    this.hp = this.maxHp = this.stats.hp;
    this.moves = moveset(this.el, this.stage);
    this.cd = { s1: 0, s2: 0, ult: 4, dash: 0 };
    this.act = null; this.lastPose = {}; this.walkT = 0; this.moving = false;
    this.ghosts = []; this.basicQueued = false; this.dashT = 0; this.dashDir = [1, 0];
    this.speed = this.stats.speed;
    this.contactCd = 0;
    this.buildLook();
  }

  /** Colours: effect ramps from the spirit (tint wins), and a body skin that takes on the element by stage. */
  buildLook() {
    const E = ELEMENTS[this.el], tint = this.def.tint;
    this.ramps = {
      main: tint ?? E.ramp,
      ice: tint ?? E.ice ?? E.ramp,
      storm: tint ?? E.storm ?? E.ramp,
      stone: E.stone ?? tint ?? E.ramp,
    };
    const body = (tint ? fit(tint.slice(1, 7), 5).map(toHex) : E.body).map(hex);
    const base = SKIN.ramp;
    this.accent = body;
    this.glowC = hex((tint ? tint[tint.length - 3] : E.glow[1]));
    if (this.stage >= 3) {
      // awakened: the whole body takes on the spirit's colour, rims burning bright
      const ramp = base.map((c, i) => mix(c, body[i], i >= 3 ? 0.55 : 0.4));
      this.skin = { ramp, outline: hex("#0b0a10"), eye: this.glowC };
    } else this.skin = makeSkin();
  }
  rampFor(key) { return this.ramps[key] ?? this.ramps.main; }

  /** Paint the absorbed spirit on the body, more of it with each stage. */
  decor = (name, u, v, s, far) => {
    const A = this.accent, glow = this.glowC, st = this.stage, pulse = (Math.sin(this.t * 6) + 1) / 2;
    if (name === "torso") {
      // the core: a gem in the chest that beats
      const cu = u, cv = v - 5.2;
      const r = st >= 3 ? 2.6 : st >= 2 ? 2.1 : 1.6;
      if (Math.abs(cu) + Math.abs(cv) < r) return Math.abs(cu) + Math.abs(cv) < r - 1 ? (pulse > 0.5 ? hex("#ffffff") : glow) : A[3];
      if (st >= 2 && v > 9.2 && v < 10.6) return A[2];             // belt
      if (st >= 3 && Math.abs(u) > 4.4 && v < 9) return A[3];       // side stripes
      return 0;
    }
    if (name === "armN" || name === "armF") {
      if (st >= 2 && v > 7.6 && v < 9.2) return far ? A[1] : A[2];   // cuffs
      if (st >= 3 && v > 9.8) return far ? A[2] : glow;            // glowing hands
      if (st === 1 && v > 10.4 && !far) return A[3];                // a spark in the hand
      return 0;
    }
    if (name === "legN" || name === "legF") {
      if (st >= 2 && v > 6 && v < 7.4) return far ? A[1] : A[2];
      if (st >= 3 && v > 10) return far ? A[1] : A[3];
      return 0;
    }
    if (name === "head") {
      if (st >= 2 && v < 2.2 && Math.abs(u) < 5) return A[st >= 3 ? 3 : 2]; // a band / crown line
      return 0;
    }
    return 0;
  };

  get busy() { return this.act && this.act.busy; }

  tryAct(slot) {
    if (this.dead || !this.canAct || this.dashT > 0) return false;
    const m = this.moves[slot];
    if (!m) return false;
    if (slot === "basic") { if (this.busy) { this.basicQueued = true; return false; } }
    else {
      if (this.cd[slot] > 0) return false;
      if (this.busy && this.act.def !== this.moves.basic) return false;
      if (this.busy && this.act.t < 0) return false; // don't cancel a wind-up
    }
    const a = new Action(this, m, this.world);
    this.act = this.world.run(a);
    this.actFrom = { ...this.lastPose };
    if (slot !== "basic") {
      const cdr = slot === "ult" ? this.stats.ultCdr : this.stats.cdr;
      this.cd[slot] = m.cd * (1 - Math.min(0.6, cdr));
    }
    if (slot === "ult") this.world.emit({ cutin: this });
    return true;
  }

  tryDash(dir) {
    if (this.dead || !this.canMove || this.cd.dash > 0 || (this.busy && this.act.t < 0)) return;
    this.cd.dash = 0.9; this.dashT = 0.2; this.iframes = 0.28;
    const L = Math.hypot(dir[0], dir[1]);
    this.dashDir = L > 0.1 ? [dir[0] / L, dir[1] / L] : [this.flip ? -1 : 1, 0];
    if (this.act?.busy) this.act = null;
    sfx("dash");
  }

  ghost() { this.ghosts.push({ x: this.x, y: this.y, z: this.z, pose: { ...this.lastPose }, flip: this.flip, t: 0.22 }); }

  update(dt) {
    this.physics(dt);
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    for (const g of this.ghosts) g.t -= dt;
    this.ghosts = this.ghosts.filter((g) => g.t > 0);
    if (this.stats.regen && !this.dead) this.heal(this.maxHp * this.stats.regen * dt);
    if (this.dead) return;
    const inp = this.input ?? { x: 0, y: 0 };
    // dash
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.x += this.dashDir[0] * 330 * dt; this.y += this.dashDir[1] * 190 * dt;
      if (Math.random() < 0.7) this.ghost();
      return;
    }
    if (this.act && !this.act.busy) {
      this.act = null;
      if (this.basicQueued) { this.basicQueued = false; this.tryAct("basic"); }
    }
    const root = this.act?.def.root && this.act.t < this.act.def.root;
    let sp = this.speed * this.speedK * (this.busy ? 0.3 : 1);
    if (!this.canMove || root) sp = 0;
    const L = Math.hypot(inp.x, inp.y);
    this.moving = L > 0.15 && sp > 0;
    if (this.moving) {
      const k = Math.min(1, L);
      this.x += (inp.x / L) * sp * k * dt;
      this.y += (inp.y / L) * sp * k * dt * 0.7;
      if (!this.busy && Math.abs(inp.x) > 0.2) this.flip = inp.x < 0;
      this.walkT += dt * Math.min(1, L);
    }
  }

  pose() {
    if (this.dead) return DEAD;
    if (this.st.freeze > 0) return this.lastPose;
    let p;
    if (this.dashT > 0) p = { lean: 0.6, aN: -0.9, aF: -1.1, lN: 0.7, lF: -0.8, crouch: 1, z: this.stage >= 3 ? 6 : 1 };
    else if (this.act && this.act.busy) {
      const raw = sampleKeys(this.act.keys, this.act.t, lerpPose);
      const blend = clamp((this.act.t + (this.act.def.windup ?? 0)) / 0.06);
      p = blend < 1 ? lerpPose(this.actFrom ?? {}, raw, blend) : raw;
      if (raw.spin) this.spinFlip = Math.floor(this.act.t * 22) % 2 === 1;
      else this.spinFlip = false;
      if (this.stage >= 3) p = { ...p, z: Math.max(p.z ?? 0, 3) };
    } else if (this.hitFlash > 0.02) p = lerpPose(this.lastPose, HURT, 0.7);
    else if (this.moving) p = movePose(this.stage, this.el, this.walkT);
    else p = idlePose(this.stage, this.el, this.t);
    if (!(this.act && this.act.busy)) this.spinFlip = false;
    this.lastPose = p;
    return p;
  }

  draw(p) {
    const pose = this.pose();
    for (const g of this.ghosts)
      drawRig(p, { x: g.x, y: g.y, pose: g.pose, flip: g.flip, skin: this.skin, tint: this.glowC, tintK: 1, alpha: g.t / 0.22 * 0.7, eyes: false });
    const flicker = this.iframes > 0 && this.dashT <= 0 && Math.floor(this.t * 30) % 2 === 0;
    const flip = this.spinFlip ? !this.flip : this.flip;
    // awakened aura: a soft light around the body and rising motes
    if (this.stage >= 2 && !this.dead) {
      const k = this.stage >= 3 ? 1 : 0.45;
      const cx = this.x, cy = this.y - this.z - 18;
      p.reset(); p.lightK = 1;
      for (let i = 0; i < (this.stage >= 3 ? 7 : 3); i++) {
        const ph = (this.t * 0.6 + i / 7) % 1, ax = cx + Math.sin(i * 2.4 + this.t * 2) * 9, ay = cy + 14 - ph * 34;
        p.put(Math.round(ax), Math.round(ay), ph < 0.5 ? this.accent[4] : this.accent[3], 1 - ph);
        p.add(Math.round(ax), Math.round(ay), this.glowC, 0.5 * (1 - ph));
      }
      for (let dy = -16; dy <= 16; dy++) for (let dx = -14; dx <= 14; dx++) {
        const d = (dx * dx) / 196 + (dy * dy) / 256;
        if (d < 1) p.add(Math.round(cx + dx), Math.round(cy + dy), this.glowC, 0.05 * k * (1 - d));
      }
    }
    drawRig(p, { x: this.x, y: this.y - this.z, pose, flip, skin: this.skin, decor: this.decor, tint: this.hitFlash > 0 ? hex("#ffffff") : null, alpha: flicker ? 0.45 : 1 });
    if (this.stage >= 3 && !this.dead) this.drawCrown(p, pose, flip);
  }

  /** Awakened spirits sit on the head as a crown of their element. */
  drawCrown(p, pose, flip) {
    const [hx, hy] = anchor(pose, "headTop");
    const x = Math.round(this.x + (flip ? -hx : hx)), y = Math.round(this.y - this.z + hy + (pose.y ?? 0) - (pose.z ?? 0));
    const A = this.accent, g = this.glowC, t = this.t;
    p.reset();
    const flick = (i) => Math.round(Math.sin(t * 9 + i * 1.7) * 1);
    switch (this.el) {
      case "fire": for (let i = -3; i <= 3; i++) { const h = 4 - Math.abs(i) + flick(i) + (i === 0 ? 2 : 0); for (let j = 0; j < h; j++) p.put(x + i, y - 1 - j, j > h - 2 ? A[4] : j > h - 3 ? A[3] : A[2]); p.add(x + i, y - 2, g, 0.5); } break;
      case "water": for (const [i, h] of [[-3, 2], [-1, 3], [1, 3], [3, 2], [0, 5]]) { for (let j = 0; j < h; j++) p.put(x + i, y - 1 - j, j === h - 1 ? A[4] : A[3]); p.add(x + i, y - h, g, 0.6); } break;
      case "wind": for (let a = 0; a < 14; a++) { const an = a / 14 * Math.PI * 2 + t * 4; p.put(Math.round(x + Math.cos(an) * 7), Math.round(y - 3 + Math.sin(an) * 2), a % 3 ? A[3] : A[4]); } p.add(x, y - 3, g, 0.4); break;
      case "earth": for (const s of [-1, 1]) { for (let j = 0; j < 5; j++) { p.put(x + s * (3 + (j >> 1)), y - 1 - j, j > 3 ? A[4] : A[3]); p.put(x + s * (4 + (j >> 1)), y - 1 - j, A[2]); } } break;
      default: for (let i = -2; i <= 2; i++) p.put(x + i, y - 2, A[4]);
    }
    if (this.def.crown) for (let i = -1; i <= 1; i++) { p.put(x + i * 3, y - 8, hex("#ffd84a")); p.add(x + i * 3, y - 8, hex("#ffd84a"), 0.8); }
  }

  onHurt() { this.iframes = Math.max(this.iframes, 0.35); }
  die() {
    if (this.dead) return;
    this.dead = true; this.hp = 0; this.act = null; this.clearStatusFx();
    sfx("die");
    this.world.emit({ heroDied: true, shake: 5 });
  }
}
