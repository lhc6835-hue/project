// The summoning well: draw spirits by grade. Pillars of light show the best grade before the reveal.
import { hex, mix, rand } from "../px.js";
import { W, H } from "../core/screen.js";
import { World } from "../game/world.js";
import { drawSpirit } from "../game/spirit_art.js";
import { SPIRITS, SPIRIT, GRADES } from "../data/spirits.js";
import { ELEMENTS } from "../data/elements.js";
import { addSpirit, save } from "../core/save.js";
import { el, toast, icon } from "../ui/dom.js";
import { iconImg } from "../ui/icons.js";
import { sfx } from "../core/audio.js";

const PITY = 60, ONE = 100, TEN = 900;

/** Roll n spirits with pity (a legend within 60) and a 2★+ guarantee on tens. */
export function roll(S, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    S.gacha.pity++; S.gacha.total++;
    let r = Math.random(), grade = r < GRADES[4].rate ? 4 : r < GRADES[4].rate + GRADES[3].rate ? 3 : r < 0.4 ? 2 : 1;
    if (S.gacha.pity >= PITY) grade = 4;
    if (grade === 4) S.gacha.pity = 0;
    out.push(grade);
  }
  if (n >= 10 && !out.some((g) => g >= 2)) out[out.length - 1] = 2;
  return out.map((g) => { const pool = SPIRITS.filter((s) => s.grade === g); return pool[Math.floor(Math.random() * pool.length)].id; });
}

export class GachaScene {
  constructor(game) {
    this.g = game; this.S = game.save; this.t = 0; this.phase = "idle";
    this.world = new World({ x0: 0, x1: W, y0: 0, y1: H });
    this.bg = new Uint32Array(W * H);
    const a = hex("#040814"), b = hex("#0c1e3a"), c = hex("#14304a");
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - 240) / 240, (y - 170) / 140);
      let col = mix(b, a, Math.min(1, d));
      if (y > 200) col = mix(c, a, Math.min(1, d * 0.8 + (y - 200) / 120));
      if (rand(x, y, 2) > 0.995) col = hex("#58b4ec");
      this.bg[y * W + x] = col;
    }
    this.fountain = this.world.fx("water/fountain", { x: 240, y: 214, light: 0.8 });
    this.world.fx("weather/fireflies", { x: 240, y: 250, light: 0.4, bottom: true, opts: { palette: ["#0e2e5a", "#1c76bc", "#58b4ec", "#9bdcff", "#d8f4ff", "#ffffff"], grass: Array(6).fill("#040814") } });
  }

  enter() {
    const ui = document.getElementById("ui");
    this.box = el("div", { class: "gacha-ui" });
    ui.append(this.box);
    this.renderIdle();
  }

  renderIdle() {
    const S = this.S;
    const free = S.gacha.freeTen;
    this.box.innerHTML = `
      <div class="g-top" style="left:50%;transform:translateX(-50%)">${icon("gem")} ${S.res.gems} <span class="dim small">· 전설까지 ${PITY - S.gacha.pity}회</span></div>
      <div class="ga-title">소환의 샘</div>
      <div class="ga-rates small dim">${[4, 3, 2, 1].map((g) => `<span style="color:${GRADES[g].css}">${GRADES[g].stars} ${(GRADES[g].rate * 100).toFixed(1)}%</span>`).join(" · ")}</div>
      <div class="ga-btns">
        <button class="btn one" ${S.res.gems >= ONE ? "" : "disabled"}>1회 소환 ${icon("gem")}${ONE}</button>
        <button class="btn gold ten" ${free || S.res.gems >= TEN ? "" : "disabled"}>10회 소환 ${free ? "<b>무료!</b>" : `${icon("gem")}${TEN}`}</button>
      </div>
      <button class="btn back">정원으로</button>`;
    this.box.querySelector(".one").onclick = () => this.summon(1);
    this.box.querySelector(".ten").onclick = () => this.summon(10);
    this.box.querySelector(".back").onclick = () => import("../main.js").then(({ go }) => go("garden"));
  }

  summon(n) {
    const S = this.S;
    if (n === 10 && S.gacha.freeTen) S.gacha.freeTen = false;
    else { const cost = n === 10 ? TEN : ONE; if (S.res.gems < cost) return; S.res.gems -= cost; }
    const ids = roll(S, n);
    // add to the collection; duplicates of owned spirits become shards
    this.results = ids.map((id) => {
      const owned = S.spirits.find((s) => s.id === id);
      if (owned) { const sh = [0, 2, 4, 10, 25][SPIRIT[id].grade]; S.res.shards += sh; return { id, dup: true, shards: sh }; }
      addSpirit(S, id); return { id, dup: false };
    });
    save(S);
    this.best = Math.max(...ids.map((id) => SPIRIT[id].grade));
    this.phase = "pillar"; this.pt = 0;
    this.box.innerHTML = `<button class="btn skip">건너뛰기 ▶▶</button>`;
    this.box.querySelector(".skip").onclick = () => this.reveal();
    const G = GRADES[this.best];
    sfx("summon");
    this.world.fx("holy/holy-pillar", { x: 240, y: 214, light: 1.1, opts: { palette: [...G.pillar, ...G.pillar.slice(-3)] } });
    this.world.after(1.4, () => {
      if (this.phase !== "pillar") return;
      this.g.screen.flash = 0.9; this.g.screen.flashColor = this.best >= 4 ? [255, 230, 150] : [255, 255, 255];
      this.g.screen.shake(this.best >= 3 ? 5 : 2, 0.3);
      if (this.best >= 4) { sfx("legend"); this.world.fx("holy/sunburst", { x: 240, y: 150, light: 1.2, dur: 2, top: true, opts: { palette: GRADES[4].pillar } }); }
      this.world.fx("pickups/collect-burst", { x: 240, y: 180, light: 1, top: true, opts: { palette: [...G.pillar, ...G.pillar.slice(-3)] } });
    });
    this.world.after(1.9, () => { if (this.phase === "pillar") this.reveal(); });
  }

  reveal() {
    this.phase = "reveal";
    const ui = this.box;
    ui.innerHTML = `<div class="ga-results">${this.results.map((r, i) => {
      const d = SPIRIT[r.id], G = GRADES[d.grade];
      return `<div class="ga-card g${d.grade}" style="--g:${G.css};animation-delay:${i * 0.09}s">${iconImg(r.id, d.grade >= 3 ? 2 : 1, 40)}<b>${d.name}</b><span class="stars" style="color:${G.css}">${G.stars}</span><span class="small ${r.dup ? "dim" : "new"}">${r.dup ? `${icon("shard")}+${r.shards}` : "NEW"}</span></div>`;
    }).join("")}</div>
      <div class="ga-btns"><button class="btn primary again">확인</button></div>`;
    ui.querySelector(".again").onclick = () => { this.phase = "idle"; sfx("ui"); this.renderIdle(); };
    if (this.best >= 3) this.world.fx("ui/confetti", { x: 240, y: 120, light: 0.8, top: true });
  }

  update(dt) { this.t += dt; this.world.update(dt); }

  draw(scr) {
    const p = scr.begin(1 / 60);
    scr.frame.color.set(this.bg);
    // the stone rim of the well
    p.reset();
    const st = [hex("#1c2230"), hex("#2e3648"), hex("#4a5468"), hex("#6e7a90"), hex("#9aa6ba")];
    for (let j = -16; j <= 10; j++) for (let i = -70; i <= 70; i++) {
      const e = (i * i) / 4900 + (j * j) / 256; if (e > 1) continue;
      const inner = (i * i) / 3600 + ((j + 3) * (j + 3)) / 110;
      p.put(240 + i, 222 + j, inner < 1 ? (j < -6 ? hex("#58b4ec") : hex("#1c76bc")) : st[Math.max(0, Math.min(4, Math.round(3 - j / 7 + (((i + 80) >> 4) % 2))))]);
    }
    this.world.draw(p);
    // floating idle spirits around the well
    if (this.phase === "idle") ["agni", "levia", "tempest", "gaia"].forEach((id, i) => {
      const an = this.t * 0.5 + i * 1.57;
      drawSpirit(p, 240 + Math.cos(an) * 150, 120 + Math.sin(an * 2) * 10 + Math.sin(an) * 14, { id, stage: 3, t: this.t + i, alpha: 0.5, glow: 0.5, key: "orbit" + i });
    });
  }
}

export default { gacha: GachaScene };
