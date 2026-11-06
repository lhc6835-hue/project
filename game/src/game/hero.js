// The player: a blocky puppet with a spirit absorbed into its chest. Stage decides moves, poses and looks.
import { hex, mix, fit, toHex, clamp } from "../px.js";
import { Actor } from "./actor.js";
import { drawRig, makeSkin, lerpPose, anchor, SKIN } from "../rig/rig.js";
import { idlePose, movePose, sampleKeys, HURT, DEAD } from "./poses.js";
import { Animator, Scarf, Trail, Dust } from "./animator.js";
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
    this.anim = new Animator(); this.scarf = new Scarf([0, 6, 8, 10][this.stage], 3.4); this.trail = new Trail(); this.dust = new Dust();
    this.cur = {}; this.prevX = this.x; this.prevY = this.y; this.prevFlip = this.flip; this.vel = [0, 0]; this.stepU = 0; this.wasAir = false; this.lastHand = null;
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
    this.anim.snap({ turn: 0.85 }, ["turn"]); // face the target at once instead of swivelling through odd poses
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
    if (this.dead) return this.animate(dt);
    const inp = this.input ?? { x: 0, y: 0 };
    // dash
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.x += this.dashDir[0] * 330 * dt; this.y += this.dashDir[1] * 190 * dt;
      if (Math.random() < 0.7) this.ghost();
      return this.animate(dt);
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
    this.animate(dt);
  }

  /** Where this frame's motion comes from, and the spring that smooths it into the drawn pose. */
  target() {
    this.spinFlip = false;
    if (this.dead) return [DEAD, "hurt"];
    if (this.dashT > 0) return [{ turn: 0.95, lean: 0.62, aN: -1.1, aF: -1.3, lN: 0.75, lF: -0.85, crouch: 2, sx: 1.16, sy: 0.9, plant: false, z: this.stage >= 3 ? 6 : 1 }, "act"];
    if (this.act && this.act.busy) {
      const raw = sampleKeys(this.act.keys, this.act.t, lerpPose);
      let p = { ...raw };
      if (raw.spin) {
        // a full turn: profile → front → other profile → front → back to profile
        const s = clamp(this.act.t / 0.26);
        p.turn = 0.85 * Math.abs(Math.cos(s * Math.PI * 2));
        this.spinFlip = s > 0.25 && s < 0.75;
      }
      if (this.stage >= 3) { p.z = Math.max(p.z ?? 0, 3); p.plant = false; }
      return [p, "act"];
    }
    if (this.moving) return [movePose(this.stage, this.el, this.walkT, 1), "move"];
    return [idlePose(this.stage, this.el, this.t), "move"];
  }

  animate(dt) {
    if (this.st.freeze > 0) return;
    const [tg, mode] = this.target();
    const out = this.anim.update(tg, dt, mode);
    // feel: squash on landing and turning, dust on every footfall
    const air = (tg.z ?? 0) > 2 || tg.plant === false;
    if (this.wasAir && !air) { this.anim.push({ sy: -0.14, sx: 0.1 }); this.dust.puff(this.x, this.y, 5, 0); }
    this.wasAir = air;
    if (this.flip !== this.prevFlip && !this.spinFlip) { this.anim.push({ sx: -0.16, sy: 0.05, lean: -0.15 }); if (this.moving && this.stage < 3) this.dust.puff(this.x, this.y, 4, this.flip ? 1 : -1); }
    this.prevFlip = this.flip;
    if (this.moving && this.stage < 3) {
      const per = (this.stage === 1 ? 0.62 : 0.46) / ({ fire: 1.05, water: 0.9, wind: 1.18, earth: 0.86 }[this.el] ?? 1);
      const u = this.walkT / per * 2;
      if (Math.floor(u) !== Math.floor(this.stepU)) this.dust.puff(this.x - (this.flip ? -4 : 4), this.y, this.stage === 2 ? 3 : 2, this.flip ? 1 : -1);
      this.stepU = u;
    }
    if (dt > 0) { this.vel[0] += ((this.x - this.prevX) / dt - this.vel[0]) * 0.3; this.vel[1] = (this.y - this.prevY) / dt; }
    this.prevX = this.x; this.prevY = this.y;
    // where the body actually is this frame
    const f = this.flip ? -1 : 1;
    const rx = this.x + f * (out.x ?? 0), ry = this.y - this.z + (out.y ?? 0) - (out.z ?? 0);
    const neck = anchor(out, "neck"), flipNow = this.spinFlip ? !this.flip : this.flip, ff = flipNow ? -1 : 1;
    this.scarf.update([rx + ff * neck[0], ry + neck[1]], dt, [this.vel[0] + (this.dashT > 0 ? -ff * 400 : 0), 0], this.t);
    // smear behind a fast hand during a move
    if (this.act && this.act.busy && this.act.t > -0.06 && this.act.t < 0.24) {
      const h = anchor(out, "handN"), hx = rx + ff * h[0], hy = ry + h[1];
      if (this.lastHand && Math.hypot(hx - this.lastHand[0], hy - this.lastHand[1]) > 2.5) this.trail.add(hx, hy, this.stage >= 2 ? 0.14 : 0.1);
      this.lastHand = [hx, hy];
    } else this.lastHand = null;
    this.trail.update(dt); this.dust.update(dt);
    this.cur = out; this.lastPose = out;
  }

  pose() { return this.cur; }

  draw(p) {
    const pose = this.pose();
    for (const g of this.ghosts)
      drawRig(p, { x: g.x, y: g.y, pose: g.pose, flip: g.flip, skin: this.skin, tint: this.glowC, tintK: 1, alpha: g.t / 0.22 * 0.7, eyes: false });
    const flicker = this.iframes > 0 && this.dashT <= 0 && Math.floor(this.t * 30) % 2 === 0;
    const flip = this.spinFlip ? !this.flip : this.flip;
    // the developer's spirit: columns of code falling around the body
    if (this.el === "code" && !this.dead) {
      p.reset();
      for (let i = 0; i < 6; i++) {
        const col = Math.round(this.x + (i - 2.5) * 7), sp = 30 + (i * 13) % 20, ph = (this.t * sp + i * 17) % 50;
        for (let k = 0; k < 4; k++) {
          const yy = Math.round(this.y - this.z - 50 + ph - k * 6);
          if (yy > this.y) continue;
          p.text(((i * 7 + k + Math.floor(this.t * 8)) % 3) ? "1" : "0", col, yy, k === 0 ? this.accent[4] : this.accent[3 - Math.min(2, k)], { font: "mini", align: "center", a: 1 - k * 0.22 });
        }
      }
    }
    // awakened aura: a soft light around the body and rising motes
    if ((this.stage >= 2 || this.el === "code") && !this.dead) {
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
    p.reset();
    this.dust.draw(p);
    if (!this.dead) this.scarf.draw(p, this.accent, this.stage >= 3 ? this.glowC : null);
    drawRig(p, { x: this.x, y: this.y - this.z, pose, flip, skin: this.skin, decor: this.decor, tint: this.hitFlash > 0 ? hex("#ffffff") : null, alpha: flicker ? 0.45 : 1 });
    p.reset();
    this.trail.draw(p, this.ramps.main.map((c) => (typeof c === "number" ? c : hex(c))), this.glowC);
    if ((this.stage >= 3 || this.el === "code") && !this.dead) this.drawCrown(p, pose, flip);
  }

  /** Awakened spirits sit on the head as a crown of their element. */
  drawCrown(p, pose, flip) {
    const [hx, hy] = anchor(pose, "headTop");
    const x = Math.round(this.x + (flip ? -1 : 1) * ((pose.x ?? 0) + hx)), y = Math.round(this.y - this.z + hy + (pose.y ?? 0) - (pose.z ?? 0));
    const A = this.accent, g = this.glowC, t = this.t;
    p.reset();
    const flick = (i) => Math.round(Math.sin(t * 9 + i * 1.7) * 1);
    switch (this.el) {
      case "fire": for (let i = -3; i <= 3; i++) { const h = 4 - Math.abs(i) + flick(i) + (i === 0 ? 2 : 0); for (let j = 0; j < h; j++) p.put(x + i, y - 1 - j, j > h - 2 ? A[4] : j > h - 3 ? A[3] : A[2]); p.add(x + i, y - 2, g, 0.5); } break;
      case "water": for (const [i, h] of [[-3, 2], [-1, 3], [1, 3], [3, 2], [0, 5]]) { for (let j = 0; j < h; j++) p.put(x + i, y - 1 - j, j === h - 1 ? A[4] : A[3]); p.add(x + i, y - h, g, 0.6); } break;
      case "wind": for (let a = 0; a < 14; a++) { const an = a / 14 * Math.PI * 2 + t * 4; p.put(Math.round(x + Math.cos(an) * 7), Math.round(y - 3 + Math.sin(an) * 2), a % 3 ? A[3] : A[4]); } p.add(x, y - 3, g, 0.4); break;
      case "earth": for (const s of [-1, 1]) { for (let j = 0; j < 5; j++) { p.put(x + s * (3 + (j >> 1)), y - 1 - j, j > 3 ? A[4] : A[3]); p.put(x + s * (4 + (j >> 1)), y - 1 - j, A[2]); } } break;
      case "code": {
        // a floating terminal prompt: </> with a blinking cursor
        const c = Math.floor(t * 3) % 2 ? A[4] : A[3];
        p.text("</>", x, y - 9, A[4], { font: "mini", align: "center", outline: hex("#020a04") });
        if (Math.floor(t * 2) % 2) for (let i = 4; i <= 6; i++) p.put(x + i, y - 4, c);
        for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) { const d = i * i + j * j; if (d < 64) p.add(x + i, y - 7 + j, g, 0.06 * (1 - d / 64)); }
        break;
      }
      default: for (let i = -2; i <= 2; i++) p.put(x + i, y - 2, A[4]);
    }
    if (this.def.crown) for (let i = -1; i <= 1; i++) { p.put(x + i * 3, y - 8, hex("#ffd84a")); p.add(x + i * 3, y - 8, hex("#ffd84a"), 0.8); }
  }

  onHurt() { this.iframes = Math.max(this.iframes, 0.35); this.anim.push({ lean: -0.4, head: -0.35, x: -2.5, sx: -0.08, sy: 0.06, aF: 0.6, aN: 0.4 }); }
  die() {
    if (this.dead) return;
    this.dead = true; this.hp = 0; this.act = null; this.clearStatusFx();
    sfx("die");
    this.world.emit({ heroDied: true, shake: 5 });
  }
}
