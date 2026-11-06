// The spirit garden (hub): the essence tree, the summoning well, the portal, and spirits wandering about.
import { hex, mix, rand, noise2, fbm } from "../px.js";
import { W, H } from "../core/screen.js";
import { World } from "../game/world.js";
import { drawSpirit } from "../game/spirit_art.js";
import { drawRig } from "../rig/rig.js";
import { idlePose } from "../game/poses.js";
import { SPIRIT, SPIRITS, GRADES, PASSIVES, MAX_LV, EVOLVE_LV, lvCost, heroStats } from "../data/spirits.js";
import { TRAITS } from "../data/traits.js";
import { ELEMENTS, STAGES } from "../data/elements.js";
import { moveset } from "../data/skills.js";
import { save, spiritByUid } from "../core/save.js";
import { auth } from "../core/auth.js";
import { careMethods, nameOf } from "./garden_care.js";
import { bondLv, BOND_TITLES, careBonus, ensure, TREATS, favTreat } from "../data/care.js";
import { el, toast, icon } from "../ui/dom.js";
import { iconImg } from "../ui/icons.js";
import { sfx } from "../core/audio.js";

const TREE = { x: 108, y: 196 }, WELL = { x: 378, y: 206 }, PORTAL = { x: 240, y: 150 };
const EVO_COST = { 2: { evo: 2 }, 3: { awake: 1, evo: 3 } };

export const treeRate = (S) => Math.round(50 * Math.pow(S.garden.tree, 1.35) * (1 + 0.12 * S.spirits.length)); // per hour
export const treeCap = (S) => treeRate(S) * 8;
export const maxLv = (sp) => (sp.stage === 1 ? EVOLVE_LV[2] : sp.stage === 2 ? EVOLVE_LV[3] : MAX_LV + 5 * Math.min(3, sp.dupes));
const upCost = (lv) => Math.round(150 * Math.pow(lv, 1.7));

function paintGarden() {
  const buf = new Uint32Array(W * H);
  const sky = [hex("#1a1030"), hex("#3a2050"), hex("#6a3a5a"), hex("#c06a50")];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c;
    if (y < 120) {
      const v = y / 120, i = Math.min(2, Math.floor(v * 3)), f = v * 3 - i;
      c = mix(sky[i], sky[i + 1], f);
      const b = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][((y & 3) << 2) | (x & 3)] / 16;
      if (f > b) c = mix(c, sky[i + 1], 0.25);
    } else c = 0;
    buf[y * W + x] = c;
  }
  // hills
  for (let x = 0; x < W; x++) {
    const h1 = 92 + Math.round(noise2(x * 0.015, 1, 2) * 16), h2 = 108 + Math.round(noise2(x * 0.03, 3, 2) * 10);
    for (let y = h1; y < 130; y++) buf[y * W + x] = hex("#2a1f40");
    for (let y = h2; y < 130; y++) buf[y * W + x] = hex("#1f3a34");
  }
  // lawn
  const g = [hex("#14281e"), hex("#1b3627"), hex("#234531"), hex("#2e5a3c"), hex("#3e7448")];
  for (let y = 120; y < H; y++) for (let x = 0; x < W; x++) {
    const n = fbm(x * 0.05, y * 0.09, 7), t = (y - 120) / 150;
    let k = 1 + Math.round(n * 2.4 + t * 0.6);
    if (rand(x, y, 9) > 0.93) k++;
    let c = g[Math.max(0, Math.min(4, k))];
    // a stone path from the bottom up to the portal
    const px = 240 + Math.sin(y * 0.03) * 12, pw = 10 + (y - 120) * 0.12;
    if (Math.abs(x - px) < pw && y > 160) {
      const tx = Math.floor((x - px + 40) / 9), ty = Math.floor(y / 6);
      c = (x - px + 40) % 9 === 0 || y % 6 === 0 ? hex("#3a3448") : rand(tx, ty, 1) > 0.5 ? hex("#6a6280") : hex("#5a5270");
    }
    buf[y * W + x] = c;
  }
  // flowers
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rand(i, 1, 4) * W), y = 130 + Math.floor(rand(i, 2, 4) * 135);
    if (Math.abs(x - 240) < 24) continue;
    const c = [hex("#ff8aa0"), hex("#ffd84a"), hex("#c684ff"), hex("#9bdcff")][i % 4];
    buf[y * W + x] = c; if (y > 0) buf[(y - 1) * W + x] = hex("#4f9a3a");
  }
  return buf;
}

export class GardenScene {
  constructor(game, args = {}) {
    this.g = game; this.S = game.save; this.args = args; this.t = 0;
    this.bg = paintGarden();
    this.world = new World({ x0: 10, x1: W - 10, y0: 136, y1: 262 });
    this.world.fx("arcane/portal", { x: PORTAL.x, y: PORTAL.y, light: 0.9, bottom: true });
    this.wellFx = null;
    this.walkers = [];
    this.anim = null;
    this.accrue();
  }

  accrue() {
    const S = this.S, now = Date.now(), hrs = Math.max(0, (now - (S.lastSeen ?? now)) / 3600000);
    S.treeStock = Math.min(treeCap(S), (S.treeStock ?? 0) + treeRate(S) * hrs);
    S.lastSeen = now;
    save(S);
  }

  enter() {
    const S = this.S;
    if (S.gacha.unlocked) this.wellFx = this.world.fx("water/fountain", { x: WELL.x, y: WELL.y - 6, light: 0.7 });
    this.initCare();
    this.syncWalkers();
    this.buildUi();
    if (this.args.welcome) this.welcome();
    if (this.args.unlocked === "gacha") setTimeout(() => this.showMsg("소환의 샘이 열렸어요!", "5층의 돌 거인을 쓰러뜨려 샘이 다시 흐르기 시작했어요. 첫 10연차는 무료예요."), 400);
  }

  exit() { this.exitCare(); }

  syncWalkers() {
    const S = this.S, keep = this.care?.uid;
    const shown = [...S.spirits].sort((a, b) => (b.uid === keep) - (a.uid === keep) || (b.uid === S.active) - (a.uid === S.active) || (b.uid === S.sub) - (a.uid === S.sub) || (!!b.gift - !!a.gift)).slice(0, 12);
    this.walkers = shown.map((sp, i) => {
      const old = this.walkers.find((w) => w.uid === sp.uid);
      return old ?? { uid: sp.uid, x: 140 + rand(i, 1) * 200, y: 180 + rand(i, 2) * 70, tx: 0, ty: 0, wait: rand(i, 3) * 2, flip: false, t: rand(i, 4) * 5 };
    });
  }

  welcome() {
    const S = this.S, sp = spiritByUid(S, S.active), d = SPIRIT[sp.id];
    this.showMsg(`${d.name}와 계약했어요!`, `여기는 정령의 정원이에요. <b>출격</b>하면 ${d.name}가 몸에 깃들어 함께 싸워요.<br>던전에서 모은 <b>정수</b>로 정령을 키우고, 레벨 ${EVOLVE_LV[2]}에 진화석을 모으면 <b>성체</b>로 진화해요.`);
  }

  showMsg(title, body) {
    const ov = el("div", { class: "overlay" }, `<div class="panel msg"><div class="ov-title">${title}</div><div class="small" style="line-height:1.7">${body}</div><div class="row" style="justify-content:center;margin-top:calc(var(--u)*6)"><button class="btn primary">좋아요</button></div></div>`);
    ov.querySelector("button").onclick = () => { sfx("ui"); ov.remove(); };
    document.getElementById("ui").append(ov);
  }

  // ------------------------------------------------------------------ UI
  buildUi() {
    const ui = document.getElementById("ui");
    ui.innerHTML = "";
    this.top = el("div", { class: "g-top" });
    ui.append(this.top);
    this.harvest = el("button", { class: "btn harvest" }, "수확");
    this.harvest.style.left = `calc(var(--u) * ${TREE.x - 22})`; this.harvest.style.top = `calc(var(--u) * ${TREE.y - 110})`;
    this.harvest.onclick = () => this.collect();
    ui.append(this.harvest);
    const bar = el("div", { class: "g-bar" }, `
      <button class="btn sp">${icon("ess")} 정령</button>
      <button class="btn cr">돌봄</button>
      <button class="btn dex">도감</button>
      <button class="btn fac">정원 시설</button>
      <button class="btn well">소환의 샘</button>
      <button class="btn primary go">출격 ▶</button>`);
    bar.querySelector(".sp").onclick = () => this.spiritPanel();
    bar.querySelector(".cr").onclick = () => { sfx("ui"); this.carePanel(); };
    this.bar = bar;
    bar.querySelector(".fac").onclick = () => this.facilityPanel();
    bar.querySelector(".dex").onclick = () => this.dexPanel();
    bar.querySelector(".well").onclick = () => {
      if (!this.S.gacha.unlocked) { sfx("ui"); toast("5층의 돌 거인을 쓰러뜨리면 샘이 열려요"); return; }
      import("../main.js").then(({ go }) => go("gacha"));
    };
    bar.querySelector(".go").onclick = () => this.sortiePanel();
    ui.append(bar);
    const back = el("button", { class: "btn g-title" }, "타이틀");
    back.onclick = () => import("../main.js").then(({ go }) => go("title"));
    ui.append(back);
    this.refresh();
  }

  refresh() {
    const r = this.S.res;
    this.top.innerHTML = `<span>${icon("ess")} ${Math.floor(r.essence)}</span><span>${icon("evo")} ${r.evo}</span><span>${icon("awake")} ${r.awake}</span><span>${icon("gem")} ${r.gems}</span>${r.shards ? `<span>${icon("shard")} ${r.shards}</span>` : ""}<span>간식 ${Object.values(this.S.care?.treats ?? {}).reduce((a, b) => a + b, 0)}</span>`;
    const needy = this.S.spirits.filter((x) => x.gift || (x.full ?? 70) < 30 || (x.joy ?? 70) < 30).length;
    const cr = this.bar?.querySelector(".cr");
    if (cr && cr.dataset.n !== String(needy)) { cr.dataset.n = needy; cr.innerHTML = needy ? `돌봄 <span class="badge">${needy}</span>` : "돌봄"; }
    const st = Math.floor(this.S.treeStock);
    this.harvest.hidden = st < 1;
    this.harvest.innerHTML = `수확 ${icon("ess")} ${st}`;
  }

  collect() {
    const n = Math.floor(this.S.treeStock);
    if (n < 1) return;
    this.S.res.essence += n; this.S.treeStock -= n; save(this.S);
    sfx("pick");
    for (let i = 0; i < 6; i++) this.world.after(i * 0.05, () => this.world.fx("pickups/collect-burst", { x: TREE.x + (Math.random() - 0.5) * 40, y: TREE.y - 30 - Math.random() * 30, light: 0.8, top: true, opts: { palette: ["#08201a", "#0f3f2c", "#17663e", "#24924e", "#3ec466", "#7ee88a", "#c8ffc4", "#ffffff"] } }));
    toast(`정수 ${n} 수확!`);
    this.refresh();
  }

  closePanels() { document.querySelectorAll("#ui .overlay").forEach((n) => n.remove()); }

  spiritPanel(selUid) {
    this.closePanels();
    const S = this.S;
    const ov = el("div", { class: "overlay sp-panel" }, `<div class="panel sp-wrap"><div class="sp-list"></div><div class="sp-detail"></div><button class="btn x">닫기</button></div>`);
    ov.querySelector(".x").onclick = () => { ov.remove(); this.refresh(); };
    document.getElementById("ui").append(ov);
    const list = ov.querySelector(".sp-list");
    const sorted = [...S.spirits].sort((a, b) => (b.uid === S.active) - (a.uid === S.active) || SPIRIT[b.id].grade - SPIRIT[a.id].grade || b.lv - a.lv);
    let cur = selUid ?? S.active;
    const draw = () => {
      list.innerHTML = "";
      for (const sp of sorted) {
        const d = SPIRIT[sp.id], G = GRADES[d.grade];
        const b = el("button", { class: "sp-cell" + (sp.uid === cur ? " on" : ""), style: `--g:${G.css}` }, `${iconImg(sp.id, sp.stage, 32)}<span class="lv">Lv${sp.lv}</span>${sp.uid === S.active ? '<span class="tag">주</span>' : sp.uid === S.sub ? '<span class="tag sub">보조</span>' : ""}`);
        b.onclick = () => { cur = sp.uid; sfx("ui"); draw(); };
        list.append(b);
      }
      this.spiritDetail(ov.querySelector(".sp-detail"), spiritByUid(S, cur), () => draw());
    };
    draw();
  }

  spiritDetail(box, sp, redraw) {
    const S = this.S, d = SPIRIT[sp.id], E = ELEMENTS[d.el], G = GRADES[d.grade];
    ensure(sp);
    const st = heroStats(sp, null), mv = moveset(d.el, sp.stage);
    const cap = maxLv(sp), cost = lvCost(sp.lv);
    const canLv = sp.lv < cap && S.res.essence >= cost;
    const next = sp.stage < 3 ? sp.stage + 1 : null;
    const evoNeed = next ? EVO_COST[next] : null;
    const canEvo = next && sp.lv >= EVOLVE_LV[next] && (S.res.evo >= (evoNeed.evo ?? 0)) && (S.res.awake >= (evoNeed.awake ?? 0));
    const moves = [mv.basic, mv.s1, mv.s2, mv.ult].filter(Boolean);
    const shardsNeed = 10 * (sp.dupes + 1);
    box.innerHTML = `
      <div class="row" style="align-items:flex-start">
        ${iconImg(sp.id, sp.stage, 56, "sp-big")}
        <div style="flex:1">
          <div><b style="color:${E.css};font-size:calc(var(--u)*10)">${nameOf(sp)}</b> <span class="stars" style="color:${G.css}">${G.stars}</span></div>
          <div class="small dim">${E.name} 속성 · ${STAGES[sp.stage - 1].name} · Lv.${sp.lv}/${cap}${sp.dupes ? ` · 돌파 ${sp.dupes}` : ""}</div>
          <div class="small">체력 ${st.hp} · 공격 ${Math.round(st.atk)} · 치명 ${Math.round(st.crit * 100)}%</div>
          <div class="small gold-t">${d.passives.map((p) => PASSIVES[p].text).join(" · ")}</div>
          ${(d.traits ?? []).map((k) => `<div class="small trait"><b>✦ ${TRAITS[k].name}</b> ${TRAITS[k].text}</div>`).join("")}
        </div>
      </div>
      <div class="small care-line"><span class="hrt-t">♥ 유대 Lv.${bondLv(sp)} ${BOND_TITLES[bondLv(sp) - 1]}</span> · 포만감 ${Math.round(sp.full)} · 기분 ${Math.round(sp.joy)}${sp.nick ? ` · 애칭 <b>${sp.nick}</b>` : ""}${careBonus(sp).tags.length ? ` · <span class="gold-t">${careBonus(sp).tags.join(", ")}</span>` : ""}</div>
      <div class="moves">${moves.map((m, i) => `<div class="mv"><b>${["평타", "스킬1", "스킬2", "궁극기"][i === 3 || m === mv.ult ? 3 : i]}</b> ${m.name}<span class="dim"> — ${m.desc}</span></div>`).join("")}</div>
      ${next ? `<div class="small dim">다음 단계 <b style="color:var(--hi)">${STAGES[next - 1].name}</b>: Lv.${EVOLVE_LV[next]} + ${evoNeed.evo ? `${icon("evo")}${evoNeed.evo} ` : ""}${evoNeed.awake ? `${icon("awake")}${evoNeed.awake}` : ""} — 새 평타와 스킬${next === 3 ? ", 궁극기" : ""}를 얻어요</div>` : ""}
      <div class="row acts">
        <button class="btn lvup" ${canLv ? "" : "disabled"}>레벨업 ${icon("ess")}${cost}</button>
        <button class="btn lv5" ${canLv ? "" : "disabled"}>+5</button>
        ${next ? `<button class="btn gold evo" ${canEvo ? "" : "disabled"}>진화</button>` : ""}
        <button class="btn care">돌보기</button>
        ${sp.uid !== S.active ? `<button class="btn primary main">주 정령으로</button>` : ""}
        ${sp.uid !== S.active && sp.uid !== S.sub && S.spirits.some((x) => x.stage >= 2) ? `<button class="btn subb">보조로</button>` : ""}
        ${sp.stage === 3 && S.res.shards >= shardsNeed && sp.dupes < 3 ? `<button class="btn brk">돌파 ${icon("shard")}${shardsNeed}</button>` : ""}
      </div>
      ${auth.account?.isDev ? `<div class="row acts dev-acts"><b class="devtag">DEV</b>
        ${[1, 2, 3].map((n) => `<button class="btn sm dstage${sp.stage === n ? " primary" : ""}" data-n="${n}">${STAGES[n - 1].name}</button>`).join("")}
        <button class="btn sm gold dtest">이 정령으로 출격</button></div>` : ""}`;
    const q = (s) => box.querySelector(s);
    const lvUp = (n) => {
      let done = 0;
      while (done < n && sp.lv < maxLv(sp) && S.res.essence >= lvCost(sp.lv)) { S.res.essence -= lvCost(sp.lv); sp.lv++; done++; }
      if (done) { sfx("level"); save(S); this.world.fx("ui/level-up", { x: 240, y: 200, top: true, opts: { text: "LEVEL UP!" } }); }
      redraw(); this.refresh();
    };
    q(".lvup").onclick = () => lvUp(1);
    q(".lv5").onclick = () => lvUp(5);
    q(".evo") && (q(".evo").onclick = () => {
      S.res.evo -= evoNeed.evo ?? 0; S.res.awake -= evoNeed.awake ?? 0;
      sp.stage = next; save(S);
      this.closePanels(); this.refresh();
      this.evolve(sp, next);
    });
    q(".care").onclick = () => this.startCare(sp.uid);
    q(".main") && (q(".main").onclick = () => { if (S.sub === sp.uid) S.sub = null; S.active = sp.uid; save(S); sfx("ok"); redraw(); });
    q(".subb") && (q(".subb").onclick = () => { S.sub = sp.uid; save(S); sfx("ok"); redraw(); });
    box.querySelectorAll(".dstage").forEach((b) => (b.onclick = () => {
      const n = +b.dataset.n; if (n === sp.stage) return;
      sp.stage = n; sp.lv = n === 3 ? 45 : n === 2 ? EVOLVE_LV[3] : EVOLVE_LV[2];
      save(S); sfx("level"); redraw(); this.refresh();
    }));
    q(".dtest") && (q(".dtest").onclick = () => { if (S.sub === sp.uid) S.sub = null; S.active = sp.uid; save(S); sfx("ok"); this.closePanels(); this.refresh(); this.sortiePanel(); });
    q(".brk") && (q(".brk").onclick = () => { S.res.shards -= shardsNeed; sp.dupes++; save(S); sfx("level"); redraw(); this.refresh(); });
  }

  evolve(sp, stage) {
    sfx("summon");
    this.anim = { sp, stage, t: 0 };
    const w = this.world;
    w.fx("holy/holy-pillar", { x: 240, y: 214, light: 1, opts: { palette: ELEMENTS[SPIRIT[sp.id].el].ramp } });
    w.after(1.2, () => { w.fx("spawn/egg-hatch", { x: 240, y: 206, light: 1 }); });
    w.after(1.9, () => { w.fx("holy/sunburst", { x: 240, y: 180, light: 1, dur: 1.6, top: true, opts: { palette: ELEMENTS[SPIRIT[sp.id].el].ramp } }); this.g.screen.flash = 0.8; this.g.screen.shake(4, 0.3); sfx("legend"); });
    w.after(2.2, () => w.fx("ui/achievement", { x: 240, y: 70, top: true, opts: { title: "EVOLUTION", text: STAGES[stage - 1].en + "!" } }));
    setTimeout(() => {
      this.anim = null;
      const d = SPIRIT[sp.id], mv = moveset(d.el, stage);
      this.showMsg(`${d.name} — ${STAGES[stage - 1].name}!`, `새 평타 <b>${mv.basic.name}</b>, 새 스킬 <b>${mv.s1.name}</b>${mv.s2 ? `, <b>${mv.s2.name}</b>` : ""}${mv.ult ? `, 궁극기 <b class="gold-t">${mv.ult.name}</b>` : ""}을 익혔어요.<br>움직임과 자세도 달라졌어요.`);
    }, 3300);
  }

  dexPanel() {
    this.closePanels();
    const S = this.S, owned = new Set(S.spirits.map((x) => x.id));
    const els = ["fire", "water", "wind", "earth", "light", "dark", "code"];
    const list = SPIRITS.filter((d) => !d.dev || owned.has(d.id));
    const ov = el("div", { class: "overlay" }, `<div class="panel dex-wrap">
      <div class="row" style="justify-content:space-between"><b class="big">정령 도감</b><span class="dim">${list.filter((d) => owned.has(d.id)).length} / ${list.length}</span><button class="btn sm x">닫기</button></div>
      <div class="dex-body"><div class="dex-grid"></div><div class="dex-info dim small">정령을 눌러 보세요</div></div></div>`);
    const grid = ov.querySelector(".dex-grid"), info = ov.querySelector(".dex-info");
    for (const e of els) {
      const group = list.filter((d) => d.el === e).sort((a, b) => a.grade - b.grade);
      if (!group.length) continue;
      grid.insertAdjacentHTML("beforeend", `<div class="dex-head" style="color:${ELEMENTS[e].css}">${ELEMENTS[e].name}</div>`);
      for (const d of group) {
        const has = owned.has(d.id), G = GRADES[d.grade];
        const b = el("button", { class: "dex-cell" + (has ? "" : " un"), style: `--g:${G.css}` }, `${iconImg(d.id, d.grade >= 3 ? 2 : 1, 32)}<span>${G.stars}</span>`);
        b.onclick = () => {
          sfx("ui");
          grid.querySelectorAll(".dex-cell").forEach((n) => n.classList.remove("on")); b.classList.add("on");
          info.classList.remove("dim");
          info.innerHTML = `<div class="row" style="align-items:flex-start">${iconImg(d.id, 3, 56, "sp-big" + (has ? "" : " un"))}<div>
            <div><b style="color:${ELEMENTS[d.el].css};font-size:calc(var(--u)*9)">${has ? d.name : "???"}</b> <span style="color:${G.css}">${G.stars} ${G.name}</span></div>
            <div class="small dim">${ELEMENTS[d.el].name} 속성${has ? "" : " · 아직 만나지 못했어요"}</div></div></div>
            ${has ? `<div class="small" style="margin:calc(var(--u)*3) 0">${d.desc ?? ""}</div>` : ""}
            <div class="small gold-t">${d.passives.map((p) => PASSIVES[p].text).join(" · ")}</div>
            ${(d.traits ?? []).map((k) => `<div class="small trait"><b>✦ ${TRAITS[k].name}</b> ${has ? TRAITS[k].text : "???"}</div>`).join("")}`;
        };
        grid.append(b);
      }
    }
    ov.querySelector(".x").onclick = () => ov.remove();
    document.getElementById("ui").append(ov);
  }

  facilityPanel() {
    this.closePanels();
    const S = this.S, G = S.garden;
    const ov = el("div", { class: "overlay" });
    const render = () => {
      const tc = upCost(G.tree), ac = upCost(G.altar + 1) * 2;
      ov.innerHTML = `<div class="panel fac-wrap"><div class="ov-title">정원 시설</div>
        <div class="fac"><b>정수의 나무</b> Lv.${G.tree}<div class="small dim">시간당 정수 ${treeRate(S)} (정령이 많을수록 늘어요, 최대 8시간 저장)</div><button class="btn t" ${S.res.essence >= tc ? "" : "disabled"}>강화 ${icon("ess")}${tc}</button></div>
        <div class="fac"><b>유물 제단</b> Lv.${G.altar}<div class="small dim">출격할 때 체력·공격 +${G.altar * 4}%</div><button class="btn a" ${S.res.essence >= ac ? "" : "disabled"}>강화 ${icon("ess")}${ac}</button></div>
        ${this.plotFacility()}
        <div class="fac"><b>심도</b> ${S.depthMax}<div class="small dim">10층의 공허의 정령사를 쓰러뜨리면 더 깊은 심도가 열려요. 적이 강해지는 대신 보상이 커져요.</div></div>
        <div class="row" style="justify-content:center"><button class="btn primary x">닫기</button></div></div>`;
      ov.querySelector(".t").onclick = () => { S.res.essence -= tc; G.tree++; save(S); sfx("level"); render(); this.refresh(); };
      ov.querySelector(".a").onclick = () => { S.res.essence -= ac; G.altar++; save(S); sfx("level"); render(); this.refresh(); };
      ov.querySelector(".pf") && (ov.querySelector(".pf").onclick = () => { this.buyPlot(); render(); this.refresh(); });
      ov.querySelector(".x").onclick = () => ov.remove();
    };
    render();
    document.getElementById("ui").append(ov);
  }

  sortiePanel() {
    this.closePanels();
    const S = this.S, sp = spiritByUid(S, S.active), sub = S.sub ? spiritByUid(S, S.sub) : null, d = SPIRIT[sp.id];
    let depth = Math.min(S.depth ?? 1, S.depthMax);
    const ov = el("div", { class: "overlay" });
    const render = () => {
      ov.innerHTML = `<div class="panel fac-wrap"><div class="ov-title">출격 준비</div>
        <div class="row" style="justify-content:center;gap:calc(var(--u)*14)">
          <div class="col" style="align-items:center">${iconImg(sp.id, sp.stage, 56, "sp-big")}<b style="color:${ELEMENTS[d.el].css}">${d.name}</b><span class="small dim">주 정령 · ${STAGES[sp.stage - 1].name} Lv.${sp.lv}</span></div>
          ${sub ? `<div class="col" style="align-items:center">${iconImg(sub.id, sub.stage, 40)}<b>${SPIRIT[sub.id].name}</b><span class="small dim">보조 (패시브)</span></div>` : ""}
        </div>
        <div class="row" style="justify-content:center;margin:calc(var(--u)*6) 0">심도
          <button class="btn dm" ${depth > 1 ? "" : "disabled"}>◀</button><b class="big">${depth}</b><button class="btn dp" ${depth < S.depthMax ? "" : "disabled"}>▶</button></div>
        <div class="small dim" style="text-align:center">10층 · 5층과 10층에 보스 · 최고 기록 ${S.best}층</div>
        <div class="row" style="justify-content:center;margin-top:calc(var(--u)*6)"><button class="btn x">취소</button><button class="btn primary ok">출격!</button></div></div>`;
      ov.querySelector(".dm").onclick = () => { depth--; render(); };
      ov.querySelector(".dp").onclick = () => { depth++; render(); };
      ov.querySelector(".x").onclick = () => ov.remove();
      ov.querySelector(".ok").onclick = () => { S.depth = depth; save(S); sfx("ok"); import("../main.js").then(({ go }) => go("absorb", { depth })); };
    };
    render();
    document.getElementById("ui").append(ov);
  }

  // ------------------------------------------------------------------ loop
  update(dt) {
    this.t += dt;
    this.world.update(dt);
    const S = this.S;
    S.treeStock = Math.min(treeCap(S), S.treeStock + (treeRate(S) / 3600) * dt);
    if (Math.floor(this.t * 2) !== Math.floor((this.t - dt) * 2)) this.refresh();
    this.updateCare(dt);
    for (const w of this.walkers) {
      w.t += dt;
      if (w.hold) continue;
      if (w.wait > 0) { w.wait -= dt; continue; }
      if (!w.tx) { w.tx = 40 + Math.random() * 400; w.ty = 165 + Math.random() * 90; }
      const dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy);
      if (d < 2) { w.tx = 0; w.wait = 1 + Math.random() * 3; continue; }
      w.x += (dx / d) * 16 * dt; w.y += (dy / d) * 10 * dt; w.flip = dx < 0;
    }
    if (this.anim) this.anim.t += dt;
    if (this.g.input.take("confirm") && !document.querySelector("#ui .overlay") && !this.care) this.sortiePanel();
  }

  drawTree(p) {
    const { x, y } = TREE, t = this.t, fill = this.S.treeStock / treeCap(this.S);
    const bark = [hex("#2e1a0c"), hex("#4a2c14"), hex("#6a421e"), hex("#8e5c2c")];
    for (let j = 0; j < 46; j++) for (let i = -6; i <= 6; i++) {
      const w = 4 + (j > 38 ? (j - 38) * 0.8 : 0) + Math.sin(j * 0.3) * 0.6;
      if (Math.abs(i + Math.sin(j * 0.15) * 1.5) <= w) p.put(x + i, y - j, bark[i < -w + 1.5 ? 3 : i > w - 1.5 ? 0 : (j + i) % 7 === 0 ? 1 : 2]);
    }
    const leaf = [hex("#0f3a2a"), hex("#17583a"), hex("#22784a"), hex("#36a060"), hex("#6ad08a")];
    const blobs = [[0, -66, 26], [-22, -54, 18], [22, -56, 19], [-12, -80, 16], [14, -82, 15], [0, -92, 12]];
    for (let j = -110; j < -34; j++) for (let i = -48; i <= 48; i++) {
      let best = 1e9, bk = 0;
      for (const [bx, by, br] of blobs) { const d = Math.hypot(i - bx, j - by) / br; if (d < best) { best = d; bk = (j - by) / br; } }
      if (best > 1) { if (best < 1.08) p.put(x + i, y + j, hex("#0a2418")); continue; }
      const n = noise2((x + i) * 0.25, (y + j) * 0.25, 3) * 0.6;
      let k = Math.round(3 - bk * 1.6 - best * 1.3 + n * 2);
      p.put(x + i, y + j, leaf[Math.max(0, Math.min(4, k))]);
    }
    // glowing fruit: more when the stock is fuller
    const n = Math.round(3 + fill * 12);
    for (let i = 0; i < n; i++) {
      const fx = x + Math.round(Math.sin(i * 2.7) * 30), fy = y - 58 + Math.round(Math.cos(i * 1.9) * 24);
      const k = (Math.sin(t * 2 + i) + 1) / 2;
      for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) p.put(fx + a, fy + b, a + b === 0 ? hex("#ffffff") : hex("#7ee88a"));
      for (let gy = -5; gy <= 5; gy++) for (let gx = -5; gx <= 5; gx++) { const d = gx * gx + gy * gy; if (d < 25) p.add(fx + gx, fy + gy, hex("#7ee88a"), (0.1 + 0.1 * k) * (1 - d / 25)); }
    }
  }

  drawWell(p) {
    const { x, y } = WELL, open = this.S.gacha.unlocked;
    const st = [hex("#2c2c38"), hex("#42424f"), hex("#5c5c6b"), hex("#7d7d8c"), hex("#a4a4b2")];
    for (let j = -14; j <= 6; j++) for (let i = -30; i <= 30; i++) {
      const e = (i * i) / 900 + (j * j) / 196;
      if (e > 1) continue;
      const inner = (i * i) / 576 + ((j + 2) * (j + 2)) / 100;
      if (inner < 1) p.put(x + i, y + j, open ? (j < -4 ? hex("#58b4ec") : hex("#1c76bc")) : hex("#14101e"));
      else p.put(x + i, y + j, st[Math.max(0, Math.min(4, Math.round(3 - j / 6 + (((i + 40) >> 3) % 2))))]);
    }
    if (!open) {
      // sealed with planks and a chain
      for (let i = -26; i <= 26; i++) { p.put(x + i, y - 3 + Math.round(i * 0.15), hex("#6a421e")); p.put(x + i, y - 2 + Math.round(i * 0.15), hex("#4a2c14")); }
      for (let i = -24; i <= 24; i += 3) p.put(x + i, y + 1 - Math.round(i * 0.12), hex("#a4a4b2"));
    }
  }

  draw(scr) {
    const p = scr.begin(1 / 60);
    scr.frame.color.set(this.bg);
    p.reset();
    this.drawWell(p);
    this.drawPlots(p);
    this.world.draw(p);
    p.reset();
    this.drawTree(p);
    const S = this.S;
    // the hero waits by the portal
    drawRig(p, { x: 214, y: 186, pose: idlePose(1, "none", this.t), flip: false });
    const items = this.walkers.map((w) => ({ w, sp: spiritByUid(S, w.uid) })).filter((o) => o.sp).sort((a, b) => a.w.y - b.w.y);
    for (const { w, sp } of items) {
      if (this.anim && this.anim.sp.uid === sp.uid) continue;
      const hop = this.walkerHop(w) ?? (w.wait > 0 || w.hold ? 0 : Math.abs(Math.sin(w.t * 6)) * 2);
      // shadow
      for (let i = -5; i <= 5; i++) p.blendPx(Math.round(w.x + i), Math.round(w.y + 12), 0xff000000, 0.3);
      drawSpirit(p, w.x + this.walkerNudge(w), w.y - hop, { id: sp.id, stage: sp.stage, t: w.t, flip: w.flip });
      if (!w.react) this.drawBubble(p, w, sp, hop);
      if (sp.uid === S.active) { const c = hex("#ffd84a"); p.put(Math.round(w.x), Math.round(w.y - 22 - hop), c); p.put(Math.round(w.x) - 1, Math.round(w.y - 23 - hop), c); p.put(Math.round(w.x) + 1, Math.round(w.y - 23 - hop), c); }
    }
    this.drawCareFx(p);
    if (this.anim) {
      const a = this.anim, k = Math.min(1, a.t / 1.9);
      drawSpirit(p, 240, 180 - k * 10, { id: a.sp.id, stage: a.t < 1.9 ? a.stage - 1 : a.stage, t: this.t, glow: 1 + k * 2, flip: false });
    }
  }
}

Object.assign(GardenScene.prototype, careMethods);

export default { garden: GardenScene };
