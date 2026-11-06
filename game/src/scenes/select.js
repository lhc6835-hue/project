// First run: choose one of the four base spirits. Each floats on a pedestal; picking one shows off its move.
import { hex, mix, rand } from "../px.js";
import { W, H } from "../core/screen.js";
import { World } from "../game/world.js";
import { drawSpirit } from "../game/spirit_art.js";
import { STARTERS, SPIRIT, PASSIVES } from "../data/spirits.js";
import { ELEMENTS } from "../data/elements.js";
import { moveset } from "../data/skills.js";
import { addSpirit, save } from "../core/save.js";
import { el } from "../ui/dom.js";
import { sfx } from "../core/audio.js";

const DEMO = { fire: "fire/fire-ring", water: "water/splash", wind: "melee/spin-slash", earth: "nature/earth-spike" };

function paintHall() {
  const buf = new Uint32Array(W * H), a = hex("#0c0a18"), b = hex("#17122c"), c = hex("#221a3e");
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = y / H, d = Math.hypot((x - 240) / 300, (y - 150) / 160);
    let col = mix(b, a, Math.min(1, d));
    if (y > 168) col = mix(c, a, Math.min(1, (y - 168) / 100 + d * 0.4));
    if (y > 168 && (y - 168) % 14 === 0) col = mix(col, a, 0.5);
    buf[y * W + x] = col;
  }
  return buf;
}

export class SelectScene {
  constructor(game) {
    this.g = game; this.t = 0; this.bg = paintHall(); this.sel = null;
    this.world = new World({ x0: 0, x1: W, y0: 0, y1: H });
    this.world.fx("weather/fireflies", { x: 240, y: 200, light: 0.4, bottom: true, opts: { grass: ["#0c0a18", "#0c0a18", "#0c0a18", "#0c0a18", "#0c0a18", "#0c0a18"] } });
    this.slots = STARTERS.map((s, i) => ({ id: s.id, x: 84 + i * 104, y: 112 }));
  }

  enter() {
    const ui = document.getElementById("ui");
    this.box = el("div", { class: "select-ui" }, `
      <div class="sel-title">함께할 정령을 고르세요</div>
      <div class="sel-row">${this.slots.map((s, i) => { const d = SPIRIT[s.id], E = ELEMENTS[d.el]; return `<button class="sel-slot" data-i="${i}" style="--c:${E.css}"><b>${d.name}</b><span>${E.name} 속성</span></button>`; }).join("")}</div>
      <div class="sel-info panel" hidden></div>`);
    ui.append(this.box);
    this.box.querySelectorAll(".sel-slot").forEach((b) => (b.onclick = () => this.pick(+b.dataset.i)));
  }

  pick(i) {
    const s = this.slots[i], d = SPIRIT[s.id], E = ELEMENTS[d.el];
    this.sel = i; sfx("ok");
    this.box.querySelectorAll(".sel-slot").forEach((b, j) => b.classList.toggle("on", j === i));
    const m1 = moveset(d.el, 1), m2 = moveset(d.el, 2), m3 = moveset(d.el, 3);
    const info = this.box.querySelector(".sel-info");
    info.hidden = false;
    info.innerHTML = `
      <div class="row" style="align-items:flex-start">
        <div style="flex:1">
          <div><b style="color:${E.css};font-size:calc(var(--u)*10)">${d.name}</b> <span class="stars">${"★".repeat(d.grade)}</span> <span class="dim small">${E.name} · ${ELEMENTS[E.beats].name}에 강함</span></div>
          <div class="small" style="margin:calc(var(--u)*2) 0">${d.desc}</div>
          <div class="small dim">패시브: ${d.passives.map((p) => PASSIVES[p].text).join(", ")}</div>
        </div>
        <div class="small grow-list">
          <div><b>새싹</b> ${m1.basic.name} · ${m1.s1.name}</div>
          <div><b>성체</b> ${m2.basic.name} · ${m2.s1.name} · ${m2.s2.name}</div>
          <div><b>각성</b> ${m3.basic.name} · ${m3.s1.name} · ${m3.s2.name} · <span class="gold-t">${m3.ult.name}</span></div>
        </div>
      </div>
      <div class="row" style="justify-content:flex-end;margin-top:calc(var(--u)*4)"><button class="btn primary confirm">${d.name}와 함께하기</button></div>`;
    info.querySelector(".confirm").onclick = () => this.confirm();
    // show off: a stage-2 move at the pedestal
    this.world.fx(DEMO[d.el], { x: s.x, y: s.y + 30, ramp: d.el === "wind" ? E.ramp : E.ramp, light: 0.9 });
  }

  confirm() {
    const S = this.g.save, s = this.slots[this.sel];
    const sp = addSpirit(S, s.id);
    S.active = sp.uid; S.started = true;
    S.res.essence += 120;
    save(S);
    sfx("level");
    import("../main.js").then(({ go }) => go("garden", { welcome: 1 }));
  }

  update(dt) {
    this.t += dt; this.world.update(dt);
    const inp = this.g.input;
    if (inp.take("left")) this.pick(((this.sel ?? 0) + 3) % 4);
    if (inp.take("right")) this.pick(((this.sel ?? -1) + 1) % 4);
    if (inp.take("confirm") && this.sel !== null) this.confirm();
  }

  draw(scr) {
    const p = scr.begin(1 / 60);
    scr.frame.color.set(this.bg);
    this.world.draw(p);
    p.reset();
    this.slots.forEach((s, i) => {
      const d = SPIRIT[s.id], E = ELEMENTS[d.el], on = this.sel === i;
      // pedestal
      const top = hex("#3b3366"), side = hex("#221d3d"), rim = hex(E.css);
      for (let y = 0; y < 12; y++) for (let x = -18; x <= 18; x++) {
        const yy = s.y + 30 + y;
        if (y < 3) { if (Math.abs(x) < 18 - (y === 0 ? 2 : 0)) p.put(s.x + x, yy, y === 0 ? (on ? rim : hex("#5a508a")) : top); }
        else if (Math.abs(x) < 16) p.put(s.x + x, yy, Math.abs(x) > 13 ? hex("#16122a") : side);
      }
      if (on) for (let y = -60; y < 30; y++) for (let x = -14; x <= 14; x++) { const k = (1 - Math.abs(x) / 14) * (1 - (30 - y) / 90); if (k > 0) p.add(s.x + x, s.y + y, rim, 0.09 * k); }
      drawSpirit(p, s.x, s.y + 9 + (on ? -4 + Math.sin(this.t * 4) * 2 : 0), { id: s.id, stage: on ? 2 : 1, key: "sel" + i, scale: 1.45, t: this.t + i, alpha: this.sel === null || on ? 1 : 0.6, glow: on ? 1.2 : 0.6 });
    });
  }
}

export default { select: SelectScene };
