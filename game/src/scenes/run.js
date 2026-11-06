// A dungeon run: 10 floors of waves, a card after each floor, bosses on 5 and 10.
import { hex, clamp } from "../px.js";
import { W, H } from "../core/screen.js";
import { World } from "../game/world.js";
import { Hero } from "../game/hero.js";
import { Enemy, THEME_POOL } from "../game/enemies.js";
import { StoneGiant, VoidCaller } from "../game/bosses.js";
import { ARENA, paintRoom, roomDecor } from "../game/room.js";
import { ELEMENTS, BASE_ELEMENTS, STAGES } from "../data/elements.js";
import { SPIRIT, heroStats } from "../data/spirits.js";
import { drawCards, CARD_GRADE } from "../data/cards.js";
import { spiritByUid, save } from "../core/save.js";
import { sfx } from "../core/audio.js";
import { el, toast, icon } from "../ui/dom.js";

const FLOORS = 10;

export class RunScene {
  constructor(game, args = {}) {
    this.g = game; this.S = game.save;
    // test hook: ?scene=run&el=fire&stage=3
    if (args.el) {
      const id = { fire: "sala", water: "undi", wind: "sylphi", earth: "nomi" }[args.el] ?? args.el;
      this.spirit = { uid: -1, id, lv: +(args.lv ?? 20), stage: +(args.stage ?? 1) };
      this.sub = null;
    } else {
      this.spirit = spiritByUid(this.S, this.S.active);
      this.sub = this.S.sub ? spiritByUid(this.S, this.S.sub) : null;
    }
    this.depth = +(args.depth ?? this.S.depth ?? 1);
    this.floor = +(args.floor ?? 1);
    this.themes = this.makeThemes();
    this.loot = { essence: 0, gems: 0, evo: 0, awake: 0 };
    this.mods = { killHeal: 0, dashBuff: false, echo: 0, revive: false };
    this.taken = new Set();
    this.state = "fight";
    this.t = 0;
    this.orbs = [];
    this.paused = false;
    this.bannerQ = [];
  }

  makeThemes() {
    // floors cycle through elements, starting with the one our spirit beats (a gentle first floor)
    const order = [];
    let e = ELEMENTS[SPIRIT[this.spirit.id].el].beats;
    for (let i = 0; i < 4; i++) { order.push(e); e = ELEMENTS[e].beats; }
    return Array.from({ length: FLOORS }, (_, i) => (i === 4 ? "earth" : i === 9 ? "fire" : order[i % 4]));
  }

  enter() {
    const stats = heroStats(this.spirit, this.sub);
    const altar = this.S.garden?.altar ?? 0;
    stats.hp = Math.round(stats.hp * (1 + altar * 0.04)); stats.atk *= 1 + altar * 0.04;
    this.stats = stats;
    this.buildHud();
    this.startFloor(true);
    this.g.input.showTouch(true);
  }

  startFloor(first) {
    const theme = this.themes[this.floor - 1];
    this.theme = theme;
    this.bg = paintRoom(theme, this.floor * 7 + this.depth);
    const keepHero = this.world?.hero;
    this.world = new World({ ...ARENA });
    this.world.frameRef = this.g.screen.frame;
    for (const d of roomDecor(theme)) this.world.fx(d.id, { x: d.x, y: d.y, light: d.light, ramp: d.ramp, bottom: d.bottom, top: d.top });
    const hero = new Hero({ spirit: this.spirit, stats: first ? { ...this.stats } : keepHero.stats, x: 70, y: 200 });
    if (!first) { hero.hp = keepHero.hp; hero.maxHp = keepHero.maxHp; hero.speed = keepHero.speed; hero.cd = { ...keepHero.cd, dash: 0 }; }
    this.world.hero = hero;
    this.world.add(hero);
    this.hero = hero;
    hero.input = { x: 0, y: 0 };
    hero.onRelease = (a) => this.onRelease(a);
    this.wave = 0;
    this.boss = null;
    this.isBossFloor = this.floor === 5 || this.floor === 10;
    this.waves = this.isBossFloor ? 1 : this.floor <= 2 ? 2 : 3;
    this.waveDelay = 1.2;
    this.state = "fight";
    this.banner(this.isBossFloor ? `${this.floor}층 — 보스` : `${this.floor}층 · ${ELEMENTS[theme].floor.name}`, ELEMENTS[theme].css);
    this.updateHud(true);
  }

  // ------------------------------------------------------------ spawning
  scale() {
    const f = this.floor - 1, d = this.depth - 1;
    return { hp: (1 + f * 0.24) * (1 + d * 0.9), dmg: (1 + f * 0.1) * (1 + d * 0.45) };
  }

  spawnWave() {
    const w = this.world, A = w.arena, sc = this.scale();
    this.wave++;
    if (this.isBossFloor) {
      const B = this.floor === 5 ? StoneGiant : VoidCaller;
      const hpBase = this.floor === 5 ? 900 : 1700, atk = this.floor === 5 ? 16 : 18;
      const b = new B({ x: A.x1 - 110, y: 214, hp: Math.round(hpBase * sc.hp), atk: atk * sc.dmg });
      b.maxHp = b.hp; b.minionScale = sc.hp; b.minionDmg = sc.dmg;
      w.add(b); this.boss = b;
      this.cinematic(b);
      return;
    }
    const pool = THEME_POOL[this.theme];
    const tier = Math.min(pool.length, 2 + Math.floor(this.floor / 2));
    const n = Math.round(3 + this.floor * 0.55 + this.wave * 0.8 + (this.depth - 1));
    for (let i = 0; i < n; i++) {
      const kind = pool[Math.floor(Math.random() * tier)];
      const side = Math.random() < 0.65 ? 1 : -1;
      const x = side > 0 ? A.x1 - 20 - Math.random() * 120 : A.x0 + 20 + Math.random() * 60;
      const y = A.y0 + 6 + Math.random() * (A.y1 - A.y0 - 12);
      const elite = this.floor >= 3 && Math.random() < 0.06 + this.floor * 0.015;
      this.world.after(i * 0.18, () => this.world.add(new Enemy(kind, { x, y, el: this.theme, scale: sc.hp, dmgScale: sc.dmg, elite })));
    }
  }

  // ------------------------------------------------------------ events
  onRelease(a) {
    // the "echo" card: basic attacks sometimes burst
    if (this.mods.echo && a.def === this.hero.moves.basic && Math.random() < this.mods.echo) {
      const h = this.hero, f = h.flip ? -1 : 1, x = h.x + f * 40, y = h.y;
      this.world.after(0.12, () => {
        this.world.fx("explosions/small-explosion", { x, y, ramp: h.rampFor("main"), light: 0.8, opts: { size: 0.6 } });
        for (const e of this.world.enemies) if (Math.hypot(e.x - x, (e.y - y) * 1.7) < 30 + e.r) this.world.hit(h, e, { dmg: h.stats.atk * 1.2, el: h.el, kb: 80, from: [x, y], spark: false });
      });
    }
  }

  handleEvents() {
    const w = this.world, scr = this.g.screen;
    for (const ev of w.events) {
      if (ev.shake) scr.shake(ev.shake, 0.12 + ev.shake * 0.03);
      if (ev.flash) { scr.flash = Math.max(scr.flash, ev.flash); scr.flashColor = [255, 255, 255]; }
      if (ev.dim) { this.dimT = ev.dim; }
      if (ev.cutin) this.cutin(ev.cutin);
      if (ev.banner) this.banner(ev.banner, ev.color, ev.small);
      if (ev.killed) this.onKill(ev.killed);
      if (ev.heroDied) this.onHeroDied();
      if (ev.bossDown) this.onBossDown(ev.bossDown);
      if (ev.bossReady) this.endCinematic();
      if (ev.bossDying) { this.slowT = ev.slowmo; this.letterbox(true); }
    }
    w.events.length = 0;
  }

  onKill(e) {
    if (e.team !== 1) return;
    const h = this.hero;
    if (this.mods.killHeal) h.heal(h.maxHp * this.mods.killHeal);
    const base = (e.D?.gold ?? 20) * (e.elite ? 3 : 1);
    const ess = Math.round(base * (1 + this.floor * 0.18) * (1 + (this.depth - 1) * 0.6) * (1 + (h.stats.loot ?? 0)));
    const count = Math.min(6, 1 + Math.floor(ess / 5));
    for (let i = 0; i < count; i++) this.orbs.push({ x: e.x, y: e.y, z: 10, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 60, vz: 80 + Math.random() * 80, t: 0, val: ess / count, kind: "ess" });
    if (e.elite && Math.random() < 0.3) { this.loot.evo++; toast("진화석 획득!"); }
    if (Math.random() < 0.04) this.orbs.push({ x: e.x, y: e.y, z: 10, vx: 0, vy: 0, vz: 120, t: 0, val: 10, kind: "gem" });
  }

  onBossDown(b) {
    const first = this.floor === 5 ? !this.S.bossKills.golem : !this.S.bossKills.void;
    if (this.floor === 5) { this.loot.evo += 2 + (this.depth - 1); this.loot.gems += first ? 300 : 60; }
    else { this.loot.awake += 1 + Math.floor((this.depth - 1) / 2); this.loot.evo += 2; this.loot.gems += first ? 500 : 120; }
    this.loot.essence += Math.round(400 * this.floor / 5 * (1 + (this.depth - 1) * 0.6));
    this.bossKilled = this.floor === 5 ? "golem" : "void";
    this.bossBar(false);
    this.banner(`${b.name} 격파!`, "#ffd84a");
    this.world.fx("ui/confetti", { x: 240, y: 60, top: true });
  }

  onHeroDied() {
    if (this.mods.revive) {
      this.mods.revive = false;
      const h = this.hero;
      this.world.after(0.8, () => { h.dead = false; h.hp = h.maxHp * 0.4; h.invuln = 2; this.world.fx("holy/holy-pillar", { x: h.x, y: h.y, light: 1 }); this.banner("불사의 정령!", "#ffd84a"); });
      return;
    }
    this.state = "dead"; this.endT = 1.8;
    this.g.screen.flash = 0.6; this.g.screen.flashColor = [180, 20, 30];
  }

  // ------------------------------------------------------------ loop
  update(dt) {
    const inp = this.g.input;
    if (inp.take("pause")) this.togglePause();
    if (this.paused) return;
    this.t += dt;
    const h = this.hero, w = this.world;
    // input → hero
    if ((this.state === "fight" || this.state === "clear") && !this.inCinema) {
      h.input = inp.move;
      if (inp.take("dash")) { h.tryDash([h.input.x, h.input.y]); if (this.mods.dashBuff) this.dashBuff(); }
      for (const s of ["s1", "s2", "ult"]) if (inp.take(s)) h.tryAct(s);
      const wantBasic = inp.take("attack") || inp.held.has("attack");
      const auto = this.S.settings.autoAttack && !wantBasic && w.nearestEnemy(h.x, h.y, 64, null) && !h.busy;
      if (wantBasic || auto) h.tryAct("basic");
    } else h.input = { x: 0, y: 0 };
    // ultimate dims the world for a moment
    if (this.dimT > 0) { this.dimT -= dt; this.g.screen.dim = Math.min(1, this.dimT * 3); } else this.g.screen.dim = Math.max(0, this.g.screen.dim - dt * 4);
    let wdt = dt;
    if (this.slowT > 0) { this.slowT -= dt; wdt = dt * 0.35; if (this.slowT <= 0) this.letterbox(false); }
    w.update(wdt);
    this.handleEvents();
    this.updateOrbs(dt);
    // waves
    if (this.state === "fight") {
      const alive = w.enemies.length + w.timers.length;
      if (alive === 0) {
        this.waveDelay -= dt;
        if (this.waveDelay <= 0) {
          if (this.wave < this.waves) { this.spawnWave(); this.waveDelay = 1.0; }
          else this.floorCleared();
        }
      }
    }
    if (this.state === "dead") { this.endT -= dt; if (this.endT <= 0) this.finish(true); }
    this.updateHud();
  }

  dashBuff() {
    const h = this.hero; if (h.buffed) return;
    h.buffed = true; h.stats.atk *= 1.4;
    this.world.after(1.5, () => { h.stats.atk /= 1.4; h.buffed = false; });
  }

  updateOrbs(dt) {
    const h = this.hero;
    for (const o of this.orbs) {
      o.t += dt;
      if (o.t < 0.45) { o.x += o.vx * dt; o.y += o.vy * dt * 0.5; o.vz -= 400 * dt; o.z = Math.max(0, o.z + o.vz * dt); if (o.z === 0) o.vz *= -0.4; }
      else {
        const dx = h.x - o.x, dy = (h.y - 16) - (o.y - o.z), d = Math.hypot(dx, dy), sp = 160 + o.t * 400;
        o.x += (dx / d) * sp * dt; o.y += (dy / d) * sp * dt; o.z = 0;
        if (d < 8) {
          o.done = true;
          if (o.kind === "gem") { this.loot.gems += o.val; sfx("pick"); this.world.fx("pickups/collect-burst", { x: h.x, y: h.y, z: 16, light: 0.6 }); }
          else { this.loot.essence += o.val; sfx("pick"); }
        }
      }
    }
    this.orbs = this.orbs.filter((o) => !o.done);
  }

  floorCleared() {
    this.state = "clear";
    sfx("level");
    this.world.fx("ui/quest-complete", { x: 240, y: 90, top: true, opts: { text: this.isBossFloor ? "BOSS DOWN" : "FLOOR CLEAR" } });
    this.loot.essence += Math.round(30 * this.floor * (1 + (this.depth - 1) * 0.6));
    this.best = Math.max(this.best ?? 0, this.floor);
    // collect remaining orbs immediately
    for (const o of this.orbs) o.t = Math.max(o.t, 0.45);
    setTimeout(() => this.showCards(), 900);
  }

  // ------------------------------------------------------------ UI
  buildHud() {
    const ui = document.getElementById("ui");
    const def = SPIRIT[this.spirit.id], E = ELEMENTS[def.el];
    this.hud = el("div", { class: "hud pass" }, `
      <div class="hud-top">
        <div class="hud-hp"><div class="hud-name"><b style="color:${E.css}">${def.name}</b> <span class="dim">Lv.${this.spirit.lv} · ${STAGES[this.spirit.stage - 1].name}</span></div>
          <div class="bar hpbar"><i></i><span></span></div></div>
        <div class="hud-floor"><b class="fl"></b><span class="dim wv"></span></div>
        <div class="hud-loot"><span class="ess"></span><span class="gem"></span></div>
      </div>
      <div class="bossbar" hidden><div class="bname"></div><div class="bframe"><div class="bar"><b class="lag"></b><i></i><em class="notch"></em></div></div></div>
      <div class="skills"></div>
      <div class="banner"></div>`);
    ui.append(this.hud);
    const pause = el("button", { class: "btn pausebtn" }, "Ⅱ");
    pause.onclick = () => this.togglePause();
    ui.append(pause);
    const m = this.hero ? this.hero.moves : null;
    this.skillEls = {};
  }

  updateHud(rebuild) {
    const h = this.hero; if (!h || !this.hud) return;
    const q = (s) => this.hud.querySelector(s);
    q(".hpbar i").style.width = (clamp(h.hp / h.maxHp) * 100).toFixed(1) + "%";
    q(".hpbar i").style.background = h.hp / h.maxHp < 0.3 ? "#e8405a" : "#3ec466";
    q(".hpbar span").textContent = `${Math.ceil(h.hp)} / ${Math.round(h.maxHp)}`;
    q(".fl").textContent = `${this.floor}F`;
    q(".wv").textContent = this.isBossFloor ? " 보스" : ` 웨이브 ${Math.max(1, this.wave)}/${this.waves}`;
    q(".ess").innerHTML = `${icon("ess")} ${Math.floor(this.loot.essence)}`;
    q(".gem").innerHTML = this.loot.gems ? `${icon("gem")} ${this.loot.gems}` : "";
    if (rebuild) {
      const box = q(".skills"); box.innerHTML = "";
      const keys = { basic: "J", s1: "Q", s2: "E", ult: "R" };
      for (const slot of ["basic", "s1", "s2", "ult"]) {
        const m = h.moves[slot];
        const t = document.getElementById("b-" + (slot === "basic" ? "atk" : slot));
        if (t) t.classList.toggle("locked", !m);
        if (t && m && slot !== "basic") t.querySelector("b").textContent = slot === "ult" ? "궁극" : slot === "s1" ? "스킬1" : "스킬2";
        if (!m) continue;
        const d = el("div", { class: "sk" + (slot === "ult" ? " ult" : "") }, `<i class="cdv"></i><b>${keys[slot]}</b><span>${m.name}</span>`);
        box.append(d); this.skillEls[slot] = d;
      }
    }
    for (const slot of ["s1", "s2", "ult"]) {
      const m = h.moves[slot]; if (!m) continue;
      const k = h.cd[slot] / (m.cd * (1 - Math.min(0.6, slot === "ult" ? h.stats.ultCdr : h.stats.cdr)) || 1);
      const d = this.skillEls[slot]; if (d) { d.style.setProperty("--cd", clamp(k)); d.classList.toggle("ready", k <= 0); }
      const t = document.getElementById("b-" + slot); if (t) { t.querySelector(".cd").style.setProperty("--cd", clamp(k) + "turn"); if (slot === "ult") t.classList.toggle("ready-ult", k <= 0); }
    }
    const db = document.getElementById("b-dash"); if (db) db.querySelector(".cd").style.setProperty("--cd", clamp(h.cd.dash / 0.9) + "turn");
    if (this.boss) {
      const k = clamp(this.boss.hp / this.boss.maxHp);
      this.bossLag = Math.max(k, (this.bossLag ?? 1) - 0.004);
      q(".bossbar i").style.width = (k * 100).toFixed(1) + "%";
      q(".bossbar .lag").style.width = (this.bossLag * 100).toFixed(1) + "%";
      q(".bossbar").classList.toggle("p2", this.boss.phase === 2);
    }
  }

  cinematic(b) {
    this.inCinema = true;
    this.letterbox(true);
    sfx("door");
    const E = b.el === "dark" ? "#c684ff" : "#e8b05a";
    const card = el("div", { class: "titlecard pass" }, `<span class="tc-sub">${b.title}</span><b class="tc-name" style="--c:${E}">${b.name}</b><i class="tc-line" style="--c:${E}"></i>`);
    setTimeout(() => this.hud?.querySelector(".banner")?.after(card), 900);
    setTimeout(() => card.remove(), 3400);
    this.world.after(0.2, () => this.world.emit({ shake: 4 }));
    this.world.after(1.9, () => { this.world.emit({ shake: 8 }); sfx("boom"); });
  }

  endCinematic() {
    this.inCinema = false;
    this.letterbox(false);
    this.bossBar(true);
  }

  letterbox(on) {
    let lb = document.querySelector("#ui .letterbox");
    if (!lb) { lb = el("div", { class: "letterbox pass" }, "<i></i><i></i>"); document.getElementById("ui").append(lb); }
    requestAnimationFrame(() => lb.classList.toggle("on", on));
  }

  bossBar(on) {
    const b = this.hud.querySelector(".bossbar");
    b.hidden = !on;
    if (on) b.querySelector(".bname").innerHTML = `<small>${this.boss.title}</small>${this.boss.name}`;
  }

  banner(text, color = "#f1ecff", small = false) {
    const b = this.hud?.querySelector(".banner"); if (!b) return;
    const n = el("div", { class: "bn" + (small ? " small" : "") }, text);
    n.style.color = color;
    b.append(n);
    setTimeout(() => n.remove(), 2200);
  }

  cutin(hero) {
    const m = hero.moves.ult, E = ELEMENTS[hero.el];
    const c = el("div", { class: "cutin pass" }, `<div class="ci-band" style="--c:${E.css}"><b>${m.name}</b><span>${SPIRIT[hero.spirit.id].name}</span></div>`);
    document.getElementById("ui").append(c);
    setTimeout(() => c.remove(), 1100);
  }

  showCards() {
    const h = this.hero;
    const elite = this.isBossFloor;
    const cards = drawCards(3, h, this.taken, Math.random, elite);
    const ui = document.getElementById("ui");
    const wrap = el("div", { class: "overlay" }, `<div class="ov-title">${this.floor}층 돌파! <span class="dim">강화를 하나 고르세요</span></div><div class="cards"></div>`);
    const box = wrap.querySelector(".cards");
    for (const c of cards) {
      const G = CARD_GRADE[c.grade];
      const b = el("button", { class: "card", style: `--g:${G.css}` }, `<div class="cg">${G.name}</div><div class="cn">${c.name}</div><div class="ct">${c.text}</div>`);
      b.onclick = () => {
        sfx("ok");
        c.apply(h, this); if (!c.once) this.taken.add(c.id);
        wrap.remove();
        this.nextChoice();
      };
      box.append(b);
    }
    ui.append(wrap);
    this.g.input.showTouch(false);
  }

  nextChoice() {
    if (this.floor >= FLOORS) return this.finish(false, true);
    const ui = document.getElementById("ui");
    const keep = Math.floor(this.loot.essence);
    const wrap = el("div", { class: "overlay" }, `
      <div class="ov-title">다음은 ${this.floor + 1}층${this.floor + 1 === 5 || this.floor + 1 === 10 ? " <b class='gold-t'>(보스)</b>" : ""}</div>
      <div class="dim small" style="margin-bottom:calc(var(--u)*6)">지금 귀환하면 모은 재화를 모두 가져갑니다. 쓰러지면 70%만 남아요.</div>
      <div class="row" style="justify-content:center">
        <button class="btn primary go">더 깊이 내려가기</button>
        <button class="btn back">귀환하기 (${icon("ess")} ${keep})</button>
      </div>`);
    wrap.querySelector(".go").onclick = () => { sfx("door"); wrap.remove(); this.floor++; this.transition(() => this.startFloor(false)); };
    wrap.querySelector(".back").onclick = () => { wrap.remove(); this.finish(false); };
    ui.append(wrap);
  }

  transition(fn) {
    this.fade = 1; this.fadeFn = fn;
  }

  togglePause() {
    if (this.state !== "fight") return;
    this.paused = !this.paused;
    const ui = document.getElementById("ui");
    ui.querySelector(".pausemenu")?.remove();
    if (this.paused) {
      const m = el("div", { class: "overlay pausemenu" }, `<div class="ov-title">일시정지</div>
        <div class="col" style="align-items:center">
          <button class="btn primary resume">계속하기</button>
          <label class="row small"><input type="checkbox" class="auto" ${this.S.settings.autoAttack ? "checked" : ""}> 평타 자동 사용</label>
          <button class="btn quit">포기하고 나가기 (재화 70%)</button>
        </div>
        <div class="dim small keys">이동 WASD/방향키 · 평타 J · 스킬 Q E · 궁극기 R · 회피 Space</div>`);
      m.querySelector(".resume").onclick = () => this.togglePause();
      m.querySelector(".auto").onchange = (e) => { this.S.settings.autoAttack = e.target.checked; save(this.S); };
      m.querySelector(".quit").onclick = () => { this.paused = false; m.remove(); this.finish(true); };
      ui.append(m);
    }
  }

  finish(died, cleared = false) {
    if (this.finished) return;
    this.finished = true;
    const k = died ? 0.7 : 1;
    const loot = { essence: Math.floor(this.loot.essence * k), gems: Math.floor(this.loot.gems * k), evo: this.loot.evo, awake: this.loot.awake };
    import("../main.js").then(({ go }) => go("results", { loot, died, cleared, floor: this.floor, depth: this.depth, boss: this.bossKilled ?? null, test: this.spirit.uid === -1 }));
  }

  // ------------------------------------------------------------ drawing
  draw(scr, dt) {
    const p = scr.begin(this.paused ? 0 : dt);
    scr.frame.color.set(this.bg);
    this.world.draw(p);
    // essence orbs
    p.reset();
    for (const o of this.orbs) {
      const x = Math.round(o.x), y = Math.round(o.y - o.z);
      const c = o.kind === "gem" ? hex("#c684ff") : hex("#7ee88a");
      p.put(x, y, hex("#ffffff")); p.put(x + 1, y, c); p.put(x - 1, y, c); p.put(x, y + 1, c); p.put(x, y - 1, c);
      for (let gy = -4; gy <= 4; gy++) for (let gx = -4; gx <= 4; gx++) { const d = gx * gx + gy * gy; if (d < 16) p.add(x + gx, y + gy, c, 0.15 * (1 - d / 16)); }
    }
    // floor transition fade
    if (this.fade > 0) {
      const prev = this.fade;
      this.fade -= dt * 2.2;
      if (prev > 0.5 && this.fade <= 0.5 && this.fadeFn) { const f = this.fadeFn; this.fadeFn = null; f(); }
      const a = 1 - Math.abs(this.fade - 0.5) * 2;
      const C = scr.frame.color;
      if (a > 0) for (let i = 0; i < C.length; i++) { const x = i % W, y = (i / W) | 0; if (a > [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][((y & 3) << 2) | (x & 3)] / 16) { C[i] = 0xff0d0a07; scr.frame.light[i] = 0; } }
    }
  }

  exit() { this.g.screen.dim = 0; }
}

export default { run: RunScene };
