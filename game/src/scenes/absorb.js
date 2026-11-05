// Sortie cutscene: the spirit circles the hero, dives into the chest, and the hero takes on its power.
import { hex, mix } from "../px.js";
import { W, H } from "../core/screen.js";
import { World } from "../game/world.js";
import { Hero } from "../game/hero.js";
import { drawSpirit } from "../game/spirit_art.js";
import { drawRig, lerpPose } from "../rig/rig.js";
import { idlePose, archetype, sampleKeys } from "../game/poses.js";
import { SPIRIT, heroStats } from "../data/spirits.js";
import { ELEMENTS, STAGES } from "../data/elements.js";
import { spiritByUid } from "../core/save.js";
import { el } from "../ui/dom.js";
import { sfx } from "../core/audio.js";

const CX = 240, CY = 196, DIVE = 2.1, END = 3.8;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export class AbsorbScene {
  constructor(game, args = {}) {
    this.g = game; this.args = args; this.t = 0;
    const S = game.save;
    this.sp = spiritByUid(S, S.active);
    this.d = SPIRIT[this.sp.id]; this.E = ELEMENTS[this.d.el];
    this.world = new World({ x0: 0, x1: W, y0: 0, y1: H });
    this.world.fx("arcane/magic-circle-cast", { x: CX, y: CY + 2, light: 0.8, bottom: true, opts: { palette: this.d.tint ?? this.E.ramp } });
    this.hero = new Hero({ spirit: this.sp, stats: heroStats(this.sp, null), x: CX, y: CY });
    this.hero.world = this.world;
    this.trail = [];
    this.bg = new Uint32Array(W * H);
    const a = hex("#05040a"), b = mix(hex("#1a1430"), hex(this.E.css), 0.12);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot((x - CX) / 260, (y - CY + 30) / 150); this.bg[y * W + x] = mix(b, a, Math.min(1, d)); }
  }

  enter() {
    const ui = document.getElementById("ui");
    this.cap = el("div", { class: "absorb-cap pass" }, `<b style="color:${this.E.css}">${this.d.name}</b><span>${STAGES[this.sp.stage - 1].name}의 힘이 깃든다</span>`);
    ui.append(this.cap);
    const skip = el("button", { class: "btn skip" }, "건너뛰기 ▶▶");
    skip.onclick = () => this.done();
    ui.append(skip);
    this.world.fx("spawn/poof", { x: CX + 46, y: CY - 10, light: 0.6, opts: { palette: this.E.ramp.slice(0, 6) } });
  }

  done() {
    if (this.gone) return;
    this.gone = true;
    import("../main.js").then(({ go }) => go("run", { depth: this.args.depth }));
  }

  update(dt) {
    const prev = this.t;
    this.t += dt;
    this.world.update(dt);
    this.hero.t += dt;
    if (this.g.input.take("confirm")) this.done();
    if (prev < DIVE && this.t >= DIVE) {
      sfx("absorb");
      const scr = this.g.screen;
      scr.flash = 1; scr.flashColor = [255, 255, 255]; scr.shake(5, 0.35);
      const ramp = this.d.tint ?? this.E.ramp;
      this.world.fx("holy/sunburst", { x: CX, y: CY - 18, light: 1, dur: 1.2, top: true, opts: { palette: ramp } });
      this.world.fx("pickups/collect-burst", { x: CX, y: CY - 18, light: 1, top: true, opts: { palette: ramp } });
      if (this.sp.stage >= 2) this.world.fx("explosions/implosion", { x: CX, y: CY - 10, light: 0.8, top: true, opts: { palette: ramp } });
      this.cap.classList.add("on");
    }
    if (prev < 0.5 && this.t >= 0.5) sfx("summon");
    if (this.t >= END) this.done();
  }

  draw(scr) {
    const p = scr.begin(1 / 60);
    scr.frame.color.set(this.bg);
    this.world.draw(p);
    p.reset();
    const t = this.t, absorbed = t >= DIVE;
    // spirit spirals in
    let sx = CX, sy = CY - 18, behind = false;
    if (!absorbed) {
      const u = Math.min(1, t / DIVE), R = 56 * (1 - u * u), an = t * (3 + u * 6);
      sx = CX + Math.cos(an) * R; sy = CY - 20 - Math.sin(t * 2) * 6 * (1 - u) + Math.sin(an) * R * 0.3;
      behind = Math.sin(an) < 0 && R > 6;
      this.trail.push([sx, sy]); if (this.trail.length > 14) this.trail.shift();
    }
    const R = (this.d.tint ?? this.E.ramp).map(hex);
    this.trail.forEach(([x, y], i) => { const k = i / this.trail.length; p.put(Math.round(x), Math.round(y), R[3 + Math.round(k * 3)], k); p.add(Math.round(x), Math.round(y), R[5], 0.5 * k); });
    if (absorbed) this.trail.length = Math.max(0, this.trail.length - 1);
    const drawSp = () => { if (!absorbed) drawSpirit(p, sx, sy, { id: this.sp.id, stage: this.sp.stage, t, glow: 1 + t }); };
    if (behind) drawSp();
    // the hero: plain before, transformed after (arms thrown up as the power lands)
    const h = this.hero;
    if (!absorbed) drawRig(p, { x: CX, y: CY, pose: lerpPose(idlePose(1, "none", t), { aN: 0.4, aF: 0.4, head: -0.2, lean: -0.05 }, Math.min(1, t / DIVE)), flip: false });
    else {
      const k = t - DIVE;
      const pose = k < 0.9 ? sampleKeys(archetype("raise", 0.2, 0.9), k - 0.2, lerpPose) : idlePose(h.stage, h.el, t);
      h.x = CX; h.y = CY; h.flip = false; h.lastPose = pose;
      h.pose = () => pose;
      h.draw(p);
    }
    if (!behind) drawSp();
    // fade out at the end
    const fo = Math.max(0, (t - (END - 0.45)) / 0.45);
    if (fo > 0) {
      const C = scr.frame.color, L = scr.frame.light;
      for (let i = 0; i < C.length; i++) { const x = i % W, y = (i / W) | 0; if (fo > BAYER[((y & 3) << 2) | (x & 3)] / 16) { C[i] = 0xff0d0a07; L[i] = 0; } }
    }
  }
}

export default { absorb: AbsorbScene };
