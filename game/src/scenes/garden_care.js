// The caring side of the garden: tap a spirit to pet, feed or play with it; grow treats in the plots;
// spirits show what they want in little bubbles and bring gifts once they like you.
import { hex } from "../px.js";
import { W, H } from "../core/screen.js";
import { SPIRIT, GRADES } from "../data/spirits.js";
import { ELEMENTS } from "../data/elements.js";
import { TREATS, favTreat, bondLv, bondProgress, BOND_MAX, BOND_TITLES, BOND_PERKS, careBonus, tickCare, pet, feed, play, takeGift, plant, growth, harvestPlot, need, MAX_PLOTS, plotCost, coolLeft, ensure } from "../data/care.js";
import { save, spiritByUid } from "../core/save.js";
import { el, toast, icon } from "../ui/dom.js";
import { iconImg } from "../ui/icons.js";
import { sfx } from "../core/audio.js";

export const CARE_POS = { x: 258, y: 190 };
const HAND = { x: 222, y: 176 };
export const plotPos = (i) => ({ x: 402 + (i % 3) * 29, y: 228 + Math.floor(i / 3) * 19 });
export const nameOf = (sp) => sp.nick || SPIRIT[sp.id].name;

const HEART = ["01010", "11111", "11111", "01110", "00100"];
const NOTE = ["0011", "0010", "0010", "1110", "1100"];
const DROP = ["010", "111", "111", "010"];

function sprite(p, x, y, rows, c, a = 1) {
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === "1") p.put(Math.round(x + i), Math.round(y + j), c, a); });
}
const fmtTime = (s) => (s >= 60 ? `${Math.ceil(s / 60)}분` : `${Math.ceil(s)}초`);

export const careMethods = {
  initCare() {
    const S = this.S, C = tickCare(S);
    if (!C.seeded) {
      // a starter basket: the active spirit's favourite and a couple of berries
      const sp = spiritByUid(S, S.active);
      if (sp) C.treats[favTreat(SPIRIT[sp.id].el)] = (C.treats[favTreat(SPIRIT[sp.id].el)] ?? 0) + 3;
      C.treats.berry = (C.treats.berry ?? 0) + 2;
      C.seeded = true;
    }
    for (let i = 0; i < C.plots; i++) if (C.farm[i] === undefined) C.farm[i] = null;
    save(S);
    this.parts = []; this.ball = null; this.care = null; this.careT = 0;
    const cv = document.getElementById("view");
    this.onTap = (e) => this.tap(e, cv);
    cv.addEventListener("pointerdown", this.onTap);
  },
  exitCare() { document.getElementById("view").removeEventListener("pointerdown", this.onTap); },

  tap(e, cv) {
    if (document.querySelector("#ui .overlay")) return;
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    const C = this.S.care;
    for (let i = 0; i < C.plots; i++) { const q = plotPos(i); if (Math.abs(x - q.x) < 14 && y > q.y - 14 && y < q.y + 8) { this.tapPlot(i); return; } }
    let best = null, bd = 16;
    for (const w of this.walkers) { const d = Math.hypot(x - w.x, y - (w.y - 3)); if (d < bd) { bd = d; best = w; } }
    if (best) this.startCare(best.uid);
  },

  // ------------------------------------------------------------------ care mode
  startCare(uid) {
    const S = this.S, sp = spiritByUid(S, uid); if (!sp) return;
    this.closePanels();
    if (!this.walkers.some((w) => w.uid === uid)) this.walkers.push({ uid, x: CARE_POS.x + 40, y: CARE_POS.y + 10, tx: 0, ty: 0, wait: 0, flip: true, t: 0 });
    for (const w of this.walkers) w.hold = w.uid === uid;
    this.care = { uid, mode: "main" };
    sfx("ui");
    this.renderCare();
  },
  endCare() {
    for (const w of this.walkers) { w.hold = false; w.wait = 0.5; }
    this.care = null; this.ball = null;
    this.careBox?.remove(); this.careBox = null;
    this.bar.hidden = false;
    this.syncWalkers();
  },
  renderCare() {
    const S = this.S, sp = spiritByUid(S, this.care.uid), d = SPIRIT[sp.id], E = ELEMENTS[d.el];
    ensure(sp);
    this.bar.hidden = true;
    if (!this.careBox) { this.careBox = el("div", { class: "care-box panel" }); document.getElementById("ui").append(this.careBox); }
    const lv = bondLv(sp), cb = careBonus(sp), fav = favTreat(d.el);
    const bar = (v, c) => `<span class="cbar"><i style="width:${Math.round(v)}%;background:${c}"></i></span>`;
    const hearts = Array.from({ length: BOND_MAX }, (_, i) => `<i class="hrt${i < lv ? " on" : ""}"></i>`).join("");
    const head = `<div class="row cb-head">${iconImg(sp.id, sp.stage, 26)}<div style="flex:1;min-width:0">
        <div><b style="color:${E.css}">${nameOf(sp)}</b>${sp.nick ? ` <span class="dim small">(${d.name})</span>` : ""}</div>
        <div class="hearts">${hearts} <span class="small gold-t">${BOND_TITLES[lv - 1]}</span></div>
        <div class="small dim">유대 ${bar(bondProgress(sp) * 100, "#ff7aa8")} 포만감 ${bar(sp.full, "#ffb04a")} 기분 ${bar(sp.joy, "#7ee88a")}</div>
      </div></div>`;
    const C = S.care;
    let body;
    if (this.care.mode === "food") {
      const keys = Object.keys(TREATS).filter((k) => (C.treats[k] ?? 0) > 0);
      body = `<div class="row acts">${keys.length ? keys.map((k) => `<button class="btn sm tr${k === fav ? " gold" : ""}" data-k="${k}">${TREATS[k].name} ×${C.treats[k]}${k === fav ? " ♥" : ""}</button>`).join("") : `<span class="small dim">간식이 없어요. 오른쪽 위 텃밭을 눌러 씨앗을 심어 보세요.</span>`}<button class="btn sm back">뒤로</button></div>`;
    } else {
      const petCd = coolLeft(sp, "pet"), playCd = coolLeft(sp, "play");
      body = `<div class="small dim">좋아하는 간식: <b style="color:${TREATS[fav].c[2]}">${TREATS[fav].name}</b>${cb.tags.length ? ` · <span class="gold-t">${cb.tags.join(" · ")}</span>` : ""}</div>
        <div class="row acts">
          <button class="btn sm pt">쓰다듬기${petCd ? ` <span class="dim">${fmtTime(petCd / 1000)}</span>` : ""}</button>
          <button class="btn sm fd">간식 주기</button>
          <button class="btn sm pl" ${playCd ? "disabled" : ""}>공놀이${playCd ? ` ${fmtTime(playCd / 1000)}` : ""}</button>
          ${sp.gift ? `<button class="btn sm gold gf">선물 받기!</button>` : ""}
          ${lv >= 3 ? `<button class="btn sm nm">이름 짓기</button>` : ""}
          <button class="btn sm primary x">닫기</button>
        </div>`;
    }
    this.careBox.innerHTML = head + body;
    const q = (s) => this.careBox.querySelector(s);
    const act = (res) => {
      if (res.msg) toast(res.msg);
      if (res.react) this.react(res.react, res);
      if (res.ok) { save(S); if (res.bond) this.bondCheck(sp, lv); }
      this.renderCare();
    };
    if (this.care.mode === "food") {
      this.careBox.querySelectorAll(".tr").forEach((b) => (b.onclick = () => { this.care.mode = "main"; act(feed(S, sp, b.dataset.k, d.el)); }));
      q(".back").onclick = () => { this.care.mode = "main"; sfx("ui"); this.renderCare(); };
      return;
    }
    q(".pt").onclick = () => act(pet(sp));
    q(".fd").onclick = () => { this.care.mode = "food"; sfx("ui"); this.renderCare(); };
    q(".pl").onclick = () => act(play(sp));
    q(".gf") && (q(".gf").onclick = () => { const t = takeGift(S, sp); save(S); sfx("legend"); toast(`${nameOf(sp)}가 ${t}을(를) 가져왔어요!`); this.burst(CARE_POS.x, CARE_POS.y - 16, "spark", 14); this.refresh(); this.renderCare(); });
    q(".nm") && (q(".nm").onclick = () => this.nameDialog(sp));
    q(".x").onclick = () => { sfx("ui"); this.endCare(); };
  },
  bondCheck(sp, before) {
    const now = bondLv(sp);
    if (now <= before) return;
    sfx("level");
    const perk = BOND_PERKS.find(([l]) => l === now);
    this.world.fx("ui/level-up", { x: 240, y: 120, top: true, opts: { text: "BOND UP!" } });
    toast(`유대 Lv.${now} — ${BOND_TITLES[now - 1]}${perk ? ` · ${perk[1]}` : ""}`);
    this.burst(CARE_POS.x, CARE_POS.y - 14, "heart", 18);
  },
  nameDialog(sp) {
    const ov = el("div", { class: "overlay" }, `<div class="panel msg"><div class="ov-title">이름 짓기</div>
      <div class="small dim" style="text-align:center">${SPIRIT[sp.id].name}에게 새 이름을 지어 주세요 (최대 8자, 비우면 원래 이름)</div>
      <input class="inp nm" maxlength="8" value="${sp.nick ?? ""}" style="margin:calc(var(--u)*5) auto;display:block">
      <div class="row" style="justify-content:center"><button class="btn x">취소</button><button class="btn primary ok">좋아요</button></div></div>`);
    document.getElementById("ui").append(ov);
    const inp = ov.querySelector(".nm"); inp.focus();
    ov.querySelector(".x").onclick = () => ov.remove();
    ov.querySelector(".ok").onclick = () => {
      const v = inp.value.replace(/[<>&"']/g, "").trim().slice(0, 8);
      sp.nick = v || null; save(this.S); ov.remove(); sfx("ok");
      if (v) { toast(`이제부터 ${v}!`); this.react("love"); }
      this.renderCare();
    };
  },

  /** Kick off a reaction animation on the cared-for spirit. */
  react(kind, res = {}) {
    const w = this.walkers.find((x) => x.uid === this.care?.uid); if (!w) return;
    w.react = { kind, t: 0, treat: res.key ?? null };
    if (kind === "pet") { sfx("pick"); this.burst(w.x, w.y - 14, "heart", 5); }
    if (kind === "eat" || kind === "love") sfx("pick");
    if (kind === "no") sfx("ui");
    if (kind === "play") {
      sfx("swing");
      const tx = 110 + Math.random() * 260, ty = 158 + Math.random() * 38;
      this.ball = { x: HAND.x, y: HAND.y, z: 0, sx: HAND.x, sy: HAND.y, tx, ty, t: 0, dur: 0.9, phase: "fly" };
      w.react = null;
    }
  },
  burst(x, y, kind, n) {
    for (let i = 0; i < n; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30, t: 0, life: 0.9 + Math.random() * 0.6, kind });
  },

  // ------------------------------------------------------------------ farm
  tapPlot(i) {
    const S = this.S, C = S.care, P = C.farm[i];
    if (!P) return this.seedPanel(i);
    const g = growth(P);
    if (g < 1) { sfx("ui"); toast(`${TREATS[P.key].name} — ${fmtTime((1 - g) * TREATS[P.key].grow)} 남았어요`); return; }
    const h = harvestPlot(S, i); save(S); sfx("pick");
    const q = plotPos(i);
    this.burst(q.x, q.y - 6, "spark", 8);
    toast(`${TREATS[h.key].name} ${h.n}개 수확!`);
    this.refresh();
    if (this.care) this.renderCare();
  },
  seedPanel(i) {
    this.closePanels();
    const S = this.S;
    const ov = el("div", { class: "overlay" }, `<div class="panel fac-wrap"><div class="ov-title">텃밭 — 씨앗 심기</div>
      <div class="seed-list">${Object.entries(TREATS).map(([k, T]) => `<button class="btn seed" data-k="${k}" ${S.res.essence >= T.seed ? "" : "disabled"}>
        <b style="color:${T.c[2]}">${T.name}</b><span class="small dim">${ELEMENTS[T.el].name} 정령이 좋아해요 · ${fmtTime(T.grow)} · ${T.yield[0]}~${T.yield[1]}개</span><span class="small">${icon("ess")}${T.seed} · 보유 ${S.care.treats[k] ?? 0}</span></button>`).join("")}</div>
      <div class="row" style="justify-content:center"><button class="btn primary x">닫기</button></div></div>`);
    ov.querySelector(".x").onclick = () => ov.remove();
    ov.querySelectorAll(".seed").forEach((b) => (b.onclick = () => {
      const r = plant(S, i, b.dataset.k); toast(r.msg);
      if (r.ok) { save(S); sfx("ok"); const q = plotPos(i); this.burst(q.x, q.y - 4, "drop", 6); this.refresh(); }
      ov.remove();
    }));
    document.getElementById("ui").append(ov);
  },

  /** The care overview: the treat basket and who needs what. */
  carePanel() {
    this.closePanels();
    const S = this.S, C = tickCare(S);
    const rank = (sp) => (sp.gift ? 0 : sp.full < 30 ? 1 : sp.joy < 30 ? 2 : 3) * 1000 - (sp.uid === S.active ? 1 : 0);
    const list = [...S.spirits].sort((a, b) => rank(a) - rank(b)).slice(0, 30);
    const tag = { gift: '<span class="gold-t">선물!</span>', hungry: '<span style="color:#ffb04a">배고파요</span>', sad: '<span style="color:#9bdcff">심심해요</span>', happy: '<span style="color:#7ee88a">행복해요</span>' };
    const ov = el("div", { class: "overlay" }, `<div class="panel fac-wrap care-wrap"><div class="ov-title">정령 돌보기</div>
      <div class="small"><b>간식 바구니</b> ${Object.entries(TREATS).map(([k, T]) => `<span class="chip" style="--c:${T.c[2]}">${T.name} ${C.treats[k] ?? 0}</span>`).join(" ")}</div>
      <div class="small dim">정령을 누르면 쓰다듬고, 간식을 주고, 공놀이를 할 수 있어요. 포만감과 기분이 높으면 전투에서 강해지고, 유대가 깊어지면 영구적으로 강해져요.</div>
      <div class="care-list">${list.map((sp) => `<button class="care-cell" data-u="${sp.uid}">${iconImg(sp.id, sp.stage, 24)}<span><b>${nameOf(sp)}</b><br><span class="small">♥${bondLv(sp)} · ${tag[need(sp)] ?? '<span class="dim">괜찮아요</span>'}</span></span></button>`).join("")}</div>
      <div class="row" style="justify-content:center"><button class="btn primary x">닫기</button></div></div>`);
    ov.querySelector(".x").onclick = () => ov.remove();
    ov.querySelectorAll(".care-cell").forEach((b) => (b.onclick = () => this.startCare(+b.dataset.u)));
    document.getElementById("ui").append(ov);
  },

  // ------------------------------------------------------------------ loop
  updateCare(dt) {
    const S = this.S;
    this.careT += dt;
    if (this.careT > 20) { this.careT = 0; tickCare(S); if (this.care && !document.querySelector("#ui .overlay")) this.renderCare(); }
    for (const q of this.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.kind === "drop" ? 120 : 10) * dt; q.vx *= 0.96; }
    this.parts = this.parts.filter((q) => q.t < q.life);
    const w = this.care && this.walkers.find((x) => x.uid === this.care.uid);
    if (w) {
      if (w.react) { w.react.t += dt; if (w.react.t > 1.4) { if (w.react.kind === "love" || w.react.kind === "eat") this.burst(w.x, w.y - 14, "heart", w.react.kind === "love" ? 8 : 3); w.react = null; } }
      const B = this.ball;
      if (B) {
        B.t += dt;
        if (B.phase === "fly") {
          const u = Math.min(1, B.t / B.dur);
          B.x = B.sx + (B.tx - B.sx) * u; B.y = B.sy + (B.ty - B.sy) * u; B.z = Math.sin(u * Math.PI) * 40 + (1 - u) * 10;
          if (u >= 1) { B.phase = "bounce"; B.t = 0; sfx("ui"); }
        } else if (B.phase === "bounce") B.z = Math.abs(Math.sin(B.t * 9)) * 8 * Math.max(0, 1 - B.t * 1.5);
        // the spirit runs after it, then carries it back
        const target = B.phase === "carry" ? CARE_POS : B;
        const dx = target.x - w.x, dy = target.y - w.y, d = Math.hypot(dx, dy);
        if (B.phase !== "fly" || B.t > 0.15) {
          if (d > 2) { const sp = 70; w.x += (dx / d) * Math.min(d, sp * dt); w.y += (dy / d) * Math.min(d, sp * 0.7 * dt); w.flip = dx < 0; w.running = true; }
          else if (B.phase === "bounce" && B.t > 0.2) { B.phase = "carry"; sfx("pick"); }
          else if (B.phase === "carry") { this.ball = null; w.running = false; w.react = { kind: "love", t: 0.6 }; this.burst(w.x, w.y - 14, "note", 6); sfx("level"); }
        }
        if (B.phase === "carry" && this.ball) { B.x = w.x + (w.flip ? -6 : 6); B.y = w.y + 2; B.z = 8; }
      } else {
        // walk to the care spot and wait there, facing the hero
        const dx = CARE_POS.x - w.x, dy = CARE_POS.y - w.y, d = Math.hypot(dx, dy);
        if (d > 1.5) { w.x += (dx / d) * 40 * dt; w.y += (dy / d) * 28 * dt; w.flip = dx < 0; w.running = true; }
        else { w.running = false; w.flip = true; }
      }
    }
  },

  /** Hop height and extra drawing for a walker this frame. */
  walkerHop(w) {
    const r = w.react;
    if (r) {
      if (r.kind === "pet") return Math.abs(Math.sin(r.t * 10)) * 2;
      if (r.kind === "eat") return Math.abs(Math.sin(r.t * 14)) * 1.5;
      if (r.kind === "love") return Math.abs(Math.sin(r.t * 7)) * 7;
      if (r.kind === "no") return 0;
    }
    if (w.running) return Math.abs(Math.sin(w.t * 12)) * 3;
    return null;
  },
  walkerNudge(w) { return w.react?.kind === "no" ? Math.sin(w.react.t * 30) * 2 * Math.max(0, 1 - w.react.t * 2) : 0; },

  drawPlots(p) {
    const C = this.S.care, now = Date.now();
    for (let i = 0; i < C.plots; i++) {
      const { x, y } = plotPos(i), P = C.farm[i], g = growth(P, now);
      // tilled soil with a wooden edge
      for (let j = -5; j <= 4; j++) for (let k = -12; k <= 12; k++) {
        const edge = j === -5 || j === 4 || Math.abs(k) === 12;
        p.put(x + k, y + j, edge ? hex(j === 4 ? "#3a2410" : "#6a421e") : hex(((k + j * 3) & 3) === 0 ? "#3a2412" : (j & 1) ? "#6a4422" : "#55361a"));
      }
      if (!P) { if (Math.floor(this.t * 1.5) % 3 === 0) for (const [a, b] of [[0, -1], [0, 0], [0, 1], [-1, 0], [1, 0]]) p.put(x + a, y + b, hex("#a59fc4"), 0.6); continue; }
      const T = TREATS[P.key], c = T.c.map(hex), leaf = hex(T.leaf), sway = Math.round(Math.sin(this.t * 2 + i) * (g >= 1 ? 1 : 0.5));
      for (const k of [-7, 0, 7]) {
        const h = Math.round(2 + g * 8);
        for (let j = 0; j < h; j++) p.put(x + k + (j > h / 2 ? sway : 0), y - j, leaf);
        if (g > 0.35) { p.put(x + k - 1, y - h + 2, leaf); p.put(x + k + 1, y - h + 3, leaf); p.put(x + k - 2, y - h + 2, leaf); p.put(x + k + 2, y - h + 3, leaf); }
        if (g >= 1) {
          const fx = x + k + sway, fy = y - h - 1;
          for (const [a, b, ci] of [[0, 0, 2], [1, 0, 2], [0, 1, 1], [1, 1, 1], [-1, 0, 1], [0, -1, 3], [2, 1, 0], [-1, 1, 0]]) p.put(fx + a, fy + b, c[ci]);
          const tw = (Math.sin(this.t * 4 + k) + 1) / 2;
          for (let gy = -4; gy <= 4; gy++) for (let gx = -4; gx <= 4; gx++) { const d = gx * gx + gy * gy; if (d < 16) p.add(fx + gx, fy + gy, c[3], 0.08 * tw * (1 - d / 16)); }
        }
      }
      // progress bar while growing
      if (g < 1) { for (let k = -10; k <= 10; k++) p.put(x + k, y + 6, k + 10 <= g * 20 ? hex("#7ee88a") : hex("#1a1a24")); }
    }
  },

  drawBubble(p, w, sp, hop) {
    const n = need(sp); if (!n || (n === "happy" && Math.floor(this.t / 3 + w.uid) % 3 !== 0)) return;
    const x = Math.round(w.x) + 5, y = Math.round(w.y - 26 - hop + Math.sin(this.t * 3 + w.uid) * 1);
    const bg = hex("#f1ecff"), ol = hex("#1a1626");
    for (let j = -1; j <= 7; j++) for (let i = -1; i <= 7; i++) {
      const corner = (i === -1 || i === 7) && (j === -1 || j === 7);
      if (corner) continue;
      p.put(x + i, y + j, i === -1 || i === 7 || j === -1 || j === 7 ? ol : bg);
    }
    p.put(x + 1, y + 8, ol); p.put(x + 2, y + 8, bg); p.put(x + 1, y + 9, ol);
    if (n === "gift") { const g = hex("#ffd84a"), r = hex("#ff5a6a"); for (let j = 2; j < 6; j++) for (let i = 1; i < 6; i++) p.put(x + i, y + j, i === 3 ? r : g); for (let i = 1; i < 6; i++) p.put(x + i, y + 1, r); p.put(x + 2, y, r); p.put(x + 4, y, r); }
    else if (n === "hungry") { const m = hex("#c8642a"), b = hex("#f0e0c8"); for (let j = 1; j < 5; j++) for (let i = 1; i < 5; i++) p.put(x + i, y + j, m); p.put(x + 5, y + 5, b); p.put(x + 6, y + 6, b); p.put(x + 4, y + 4, b); }
    else if (n === "sad") sprite(p, x + 2, y + 1, DROP, hex("#5ab8ff"));
    else sprite(p, x + 1, y + 1, HEART, hex("#ff5a8a"));
  },

  drawCareFx(p) {
    const B = this.ball;
    if (B) {
      const bx = Math.round(B.x), by = Math.round(B.y - B.z);
      for (let i = -2; i <= 2; i++) p.blendPx(Math.round(B.x) + i, Math.round(B.y) + 3, 0xff000000, 0.25);
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (i * i + j * j <= 5) p.put(bx + i, by + j, (i + j) < 0 ? hex("#ffd0e0") : (i * j > 0 ? hex("#ff5a8a") : hex("#ff8aa8")));
    }
    // a treat held up to the spirit's mouth, getting smaller with every bite
    const w = this.care && this.walkers.find((x) => x.uid === this.care.uid);
    if (w?.react?.treat && w.react.t < 1.1) {
      const T = TREATS[w.react.treat], c = T.c.map(hex), k = 1 - w.react.t / 1.1, r = Math.max(0.6, 2.6 * k);
      const tx = w.x + (w.flip ? -8 : 8), ty = w.y - 6;
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (i * i + j * j <= r * r) p.put(Math.round(tx + i), Math.round(ty + j), c[j < 0 ? 3 : j > 1 ? 1 : 2]);
      if (Math.random() < 0.3) this.parts.push({ x: tx, y: ty, vx: (Math.random() - 0.5) * 20, vy: -10, t: 0, life: 0.5, kind: "crumb", c: c[2] });
    }
    for (const q of this.parts) {
      const a = 1 - q.t / q.life;
      if (q.kind === "heart") sprite(p, q.x - 2, q.y - 2, HEART, hex("#ff5a8a"), a);
      else if (q.kind === "note") sprite(p, q.x - 2, q.y - 2, NOTE, hex("#ffd84a"), a);
      else if (q.kind === "drop") sprite(p, q.x - 1, q.y - 2, DROP, hex("#5ab8ff"), a);
      else if (q.kind === "crumb") p.put(Math.round(q.x), Math.round(q.y), q.c, a);
      else { const c = hex("#fff6c0"); p.put(Math.round(q.x), Math.round(q.y), c, a); p.add(Math.round(q.x), Math.round(q.y), hex("#ffd84a"), a * 0.6); }
    }
    // a ring under the cared-for spirit
    if (w) for (let i = 0; i < 24; i++) { const an = i / 24 * Math.PI * 2 + this.t; p.put(Math.round(w.x + Math.cos(an) * 10), Math.round(w.y + 12 + Math.sin(an) * 3), hex("#ffd84a"), 0.5); }
  },

  /** Facility entry for buying more plots. */
  plotFacility() {
    const C = this.S.care;
    if (C.plots >= MAX_PLOTS) return `<div class="fac"><b>텃밭</b> ${C.plots}칸<div class="small dim">간식을 키우는 밭이에요. 모두 열었어요!</div></div>`;
    const c = plotCost(C.plots + 1);
    return `<div class="fac"><b>텃밭</b> ${C.plots}칸<div class="small dim">간식을 키우는 밭. 칸을 늘리면 한 번에 더 많이 키울 수 있어요.</div><button class="btn pf" ${this.S.res.essence >= c ? "" : "disabled"}>밭 넓히기 ${icon("ess")}${c}</button></div>`;
  },
  buyPlot() {
    const C = this.S.care, c = plotCost(C.plots + 1);
    if (this.S.res.essence < c || C.plots >= MAX_PLOTS) return;
    this.S.res.essence -= c; C.plots++; C.farm[C.plots - 1] = null; save(this.S); sfx("level");
  },
};
