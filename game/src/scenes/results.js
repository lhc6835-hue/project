// After a run: count up the haul, bank it, and unlock what the run earned.
import { hex, mix } from "../px.js";
import { W, H } from "../core/screen.js";
import { World } from "../game/world.js";
import { save } from "../core/save.js";
import { el, icon } from "../ui/dom.js";
import { sfx } from "../core/audio.js";

export class ResultsScene {
  constructor(game, args) {
    this.g = game; this.a = args; this.t = 0;
    this.world = new World({ x0: 0, x1: W, y0: 0, y1: H });
    this.bg = new Uint32Array(W * H);
    const top = args.died ? hex("#1a0810") : hex("#0e1424"), bot = hex("#05040a");
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) this.bg[y * W + x] = mix(top, bot, y / H);
    if (!args.died) this.world.fx("ui/confetti", { x: 240, y: 150, light: 0.8 });
    if (args.cleared) this.world.fx("weather/shooting-stars", { x: 240, y: 180, light: 0.8, bottom: true });
  }

  enter() {
    const S = this.g.save, a = this.a, L = a.loot;
    let unlock = null;
    if (!a.test) {
      S.res.essence += L.essence; S.res.gems += L.gems; S.res.evo += L.evo; S.res.awake += L.awake;
      S.best = Math.max(S.best, a.floor - (a.died ? 1 : 0)); S.runs++;
      if (a.boss === "golem") S.bossKills.golem++;
      if (a.boss === "void") S.bossKills.void++;
      if ((S.bossKills.golem > 0) && !S.gacha.unlocked) { S.gacha.unlocked = true; S.gacha.freeTen = true; unlock = "gacha"; }
      if (a.boss === "void" && a.depth >= S.depthMax) { S.depthMax = a.depth + 1; unlock = unlock ?? "depth"; }
      save(S);
    }
    this.unlock = unlock;
    const head = a.cleared ? "던전 정복!" : a.died ? "쓰러졌다…" : "무사히 귀환!";
    const sub = a.cleared ? `심도 ${a.depth}의 10층을 모두 돌파했어요` : a.died ? `${a.floor}층에서 쓰러졌어요 · 재화의 70%를 건졌어요` : `${a.floor}층까지 탐험했어요`;
    const rows = [["ess", "정수", L.essence], ["gem", "정령석", L.gems], ["evo", "진화석", L.evo], ["awake", "각성석", L.awake]].filter((r) => r[2] > 0);
    const box = el("div", { class: "overlay res" }, `
      <div class="ov-title" style="color:${a.died ? "#ff8a8a" : "#ffd84a"}">${head}<span class="dim">${sub}</span></div>
      <div class="panel res-list">${rows.length ? rows.map(([k, n, v]) => `<div class="rrow">${icon(k)} <span>${n}</span><b data-v="${v}">0</b></div>`).join("") : '<div class="dim">얻은 것이 없어요</div>'}</div>
      ${unlock === "depth" ? `<div class="gold-t">새 심도 ${S.depthMax}이(가) 열렸어요!</div>` : ""}
      <button class="btn primary ok">정원으로</button>`);
    box.querySelector(".ok").onclick = () => { sfx("ok"); import("../main.js").then(({ go }) => go("garden", unlock === "gacha" ? { unlocked: "gacha" } : {})); };
    document.getElementById("ui").append(box);
    this.nums = [...box.querySelectorAll("b[data-v]")];
    sfx(a.died ? "die" : "level");
  }

  update(dt) {
    this.t += dt; this.world.update(dt);
    const k = Math.min(1, Math.max(0, (this.t - 0.4) / 1.2));
    for (const n of this.nums) n.textContent = Math.round(+n.dataset.v * (1 - (1 - k) ** 3));
    if (k > 0 && k < 1 && Math.floor(this.t * 20) !== Math.floor((this.t - dt) * 20)) sfx("ui");
    if (this.g.input.take("confirm")) document.querySelector(".res .ok")?.click();
  }

  draw(scr) {
    const p = scr.begin(1 / 60);
    scr.frame.color.set(this.bg);
    this.world.draw(p);
  }
}

export default { results: ResultsScene };
