// Title screen: aurora sky, the logo dropping in letter by letter, spirits orbiting the core gem.
import { hex, mix, rand, noise2 } from "../px.js";
import { W, H } from "../core/screen.js";
import { World } from "../game/world.js";
import { Logo, drawGem } from "../game/logo.js";
import { drawSpirit } from "../game/spirit_art.js";
import { drawRig } from "../rig/rig.js";
import { idlePose } from "../game/poses.js";
import { el } from "../ui/dom.js";
import { sfx, setMuted, isMuted } from "../core/audio.js";
import { save, wipe } from "../core/save.js";

function paintSky() {
  const buf = new Uint32Array(W * H);
  const top = hex("#05040c"), mid = hex("#131030"), low = hex("#2b1a48"), hor = hex("#4a2a5a");
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = y / H;
    let c = v < 0.5 ? mix(top, mid, v / 0.5) : v < 0.8 ? mix(mid, low, (v - 0.5) / 0.3) : mix(low, hor, (v - 0.8) / 0.2);
    // dither the bands so the gradient stays pixel-y
    const b = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][((y & 3) << 2) | (x & 3)] / 16;
    if (rand(x >> 3, y >> 2, 3) * 0.06 > b * 0.06 + 0.03) c = mix(c, top, 0.2);
    buf[y * W + x] = c;
  }
  // far mountains and a castle on a cliff
  const m1 = hex("#1a1230"), m2 = hex("#110c22"), m3 = hex("#0a0716");
  for (let x = 0; x < W; x++) {
    const h1 = 190 + Math.round(noise2(x * 0.012, 1, 4) * 30), h2 = 215 + Math.round(noise2(x * 0.02, 2, 5) * 22);
    for (let y = h1; y < H; y++) buf[y * W + x] = m1;
    for (let y = h2; y < H; y++) buf[y * W + x] = m2;
    const cliff = x < 170 ? 228 - Math.round(Math.max(0, x - 120) * 0.2) : 250 + Math.round(noise2(x * 0.05, 3, 6) * 6);
    for (let y = cliff; y < H; y++) buf[y * W + x] = m3;
  }
  // castle silhouette on the right
  const tower = (x0, w, h) => { for (let x = x0; x < x0 + w; x++) for (let y = 246 - h; y < H; y++) buf[y * W + x] = m2; for (let x = x0; x < x0 + w; x += 2) buf[(245 - h) * W + x] = m2; };
  tower(380, 10, 56); tower(394, 16, 40); tower(414, 8, 64); tower(426, 18, 34);
  for (const [x, y] of [[384, 200], [418, 190], [402, 214]]) buf[y * W + x] = hex("#ffd27a");
  return buf;
}

export class TitleScene {
  constructor(game) {
    this.g = game; this.t = 0;
    this.sky = paintSky();
    this.world = new World({ x0: 0, x1: W, y0: 0, y1: H });
    this.world.fx("weather/aurora", { x: 130, y: 150, light: 0.55, bottom: true });
    this.world.fx("weather/aurora", { x: 360, y: 140, light: 0.5, bottom: true, opts: { seed: 9 } });
    this.world.fx("weather/shooting-stars", { x: 240, y: 180, light: 0.8, bottom: true });
    this.logo = new Logo(["AETHER", "HEART"], 5, 5);
    this.stars = Array.from({ length: 70 }, (_, i) => [Math.floor(rand(i, 1) * W), Math.floor(rand(i, 2) * 150), rand(i, 3) * 6]);
    this.landed = new Set();
  }

  enter() {
    const S = this.g.save;
    const ui = document.getElementById("ui");
    this.box = el("div", { class: "title-ui" }, `
      <div class="subtitle"><span>에</span><span>테</span><span>르</span><span class="sp"></span><span>하</span><span>트</span></div>
      <div class="tagline">정령을 품고, 더 깊은 곳으로</div>
      <div class="press">${matchMedia("(pointer: coarse)").matches ? "화면을 눌러 시작" : "클릭하거나 Enter를 눌러 시작"}</div>
      <div class="title-btns" hidden>
        <button class="btn primary start">${S.started ? "이어하기" : "새로 시작"}</button>
        <button class="btn opt">설정</button>
      </div>
      <div class="ver dim">v0.1 · 픽셀 이펙트: pixelfx (MIT)</div>`);
    ui.append(this.box);
    const reveal = () => {
      if (this.revealed) return;
      this.revealed = true; sfx("ok");
      this.box.querySelector(".press").hidden = true;
      this.box.querySelector(".title-btns").hidden = false;
    };
    this.reveal = reveal;
    this.box.addEventListener("pointerdown", (e) => { if (!e.target.closest("button")) reveal(); });
    this.box.querySelector(".start").onclick = () => this.start();
    this.box.querySelector(".opt").onclick = () => this.options();
  }

  start() {
    sfx("ok");
    import("../main.js").then(({ go }) => go(this.g.save.started ? "garden" : "select"));
  }

  options() {
    const S = this.g.save;
    const ov = el("div", { class: "overlay" }, `<div class="ov-title">설정</div>
      <div class="col" style="align-items:center">
        <label class="row"><input type="checkbox" class="mute" ${S.settings.mute ? "checked" : ""}> 소리 끄기</label>
        <label class="row"><input type="checkbox" class="auto" ${S.settings.autoAttack ? "checked" : ""}> 평타 자동 사용</label>
        <label class="row">화면 흔들림 <input type="range" class="shake" min="0" max="1" step="0.25" value="${S.settings.shake}"></label>
        <button class="btn wipe">데이터 초기화</button>
        <button class="btn primary close">닫기</button>
      </div>`);
    ov.querySelector(".mute").onchange = (e) => { S.settings.mute = e.target.checked; setMuted(S.settings.mute); save(S); };
    ov.querySelector(".auto").onchange = (e) => { S.settings.autoAttack = e.target.checked; save(S); };
    ov.querySelector(".shake").oninput = (e) => { S.settings.shake = +e.target.value; window.SHAKE = S.settings.shake; save(S); };
    ov.querySelector(".wipe").onclick = () => { if (confirm("정말 모든 진행 상황을 지울까요?")) { this.g.save = wipe(); location.reload(); } };
    ov.querySelector(".close").onclick = () => ov.remove();
    document.getElementById("ui").append(ov);
  }

  update(dt) {
    this.t += dt;
    this.world.update(dt);
    const inp = this.g.input;
    if (inp.take("confirm") || inp.take("attack")) { if (!this.revealed) this.reveal(); else this.start(); }
    for (const L of this.logo.letters) {
      if (!this.landed.has(L.i) && this.logo.drop(L, this.t).landed) {
        this.landed.add(L.i);
        this.g.screen.shake(L.i === this.logo.letters.length - 1 ? 3 : 1, 0.12);
        const cx = 240 - this.logo.w / 2 + L.x + 17, cy = 20 + L.y + 46;
        this.world.fx("spawn/poof", { x: cx, y: cy + 4, light: 0.5, top: true, opts: { palette: ["#1c1230", "#3b2a66", "#6a5aa0", "#a59fc4", "#d8d0f0", "#ffffff"] } });
      }
    }
  }

  draw(scr) {
    const p = scr.begin(1 / 60);
    scr.frame.color.set(this.sky);
    // twinkling stars
    for (const [x, y, ph] of this.stars) {
      const k = (Math.sin(this.t * 1.7 + ph) + 1) / 2;
      if (k > 0.3) p.put(x, y, k > 0.85 ? hex("#ffffff") : hex("#8f84d8"));
      if (k > 0.9) p.add(x, y, hex("#c8c0ff"), 0.6);
    }
    this.world.draw(p);
    p.reset();
    const ox = Math.round(240 - this.logo.w / 2), oy = 20;
    // a hero standing on the cliff, looking at the castle
    drawRig(p, { x: 120, y: 230, pose: idlePose(1, "none", this.t), flip: false });
    // spirits orbit the core gem in HEART's A
    const [gx, gy] = this.logo.center(8, ox, oy, this.t);
    const ids = ["sala", "undi", "sylphi", "nomi"];
    const behind = [], front = [];
    ids.forEach((id, i) => {
      const an = this.t * 0.8 + (i / 4) * Math.PI * 2, x = gx + Math.cos(an) * 138, y = gy + 6 + Math.sin(an) * 24;
      (Math.sin(an) < 0 ? behind : front).push({ id, x, y, s: Math.sin(an) });
    });
    const show = this.t > 1.6;
    if (show) for (const s of behind) drawSpirit(p, s.x, s.y, { id: s.id, stage: 1, t: this.t + s.x * 0.01, alpha: 0.7, glow: 0.6 });
    this.logo.draw(p, ox, oy, this.t);
    if (this.t > this.logo.letters[8].delay + 0.45) drawGem(p, gx, gy + 3, this.t, 5);
    if (show) for (const s of front) drawSpirit(p, s.x, s.y, { id: s.id, stage: 2, t: this.t + s.x * 0.01 });
  }
}

export default { title: TitleScene };
