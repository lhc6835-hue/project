// Title screen: aurora sky, the logo dropping in letter by letter, spirits orbiting the core gem.
import { applyJuice } from "../game/juice.js";
import { hex, mix, rand, noise2 } from "../px.js";
import { W, H } from "../core/screen.js";
import { World } from "../game/world.js";
import { Logo, drawGem } from "../game/logo.js";
import { drawSpirit } from "../game/spirit_art.js";
import { drawRig } from "../rig/rig.js";
import { idlePose } from "../game/poses.js";
import { el } from "../ui/dom.js";
import { sfx, setMuted, isMuted, setMusicOff, setVolumes } from "../core/audio.js";
import { save, wipe, load, useSlot } from "../core/save.js";
import { auth } from "../core/auth.js";
import { openSave } from "../core/session.js";
import { SPIRIT } from "../data/spirits.js";
import { toast } from "../ui/dom.js";
import { setAutoFullscreen, enterFullscreen } from "../core/fullscreen.js";

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
      <div class="ver dim">v0.1 · 픽셀 이펙트: pixelfx (MIT)</div>
      <div class="acct"></div>`);
    ui.append(this.box);
    this.renderAccount();
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

  renderAccount() {
    const box = this.box.querySelector(".acct"), A = auth.account;
    box.innerHTML = A ? `<span class="who">${A.isDev ? '<b class="devtag">DEV</b> ' : ""}${A.id}</span><button class="btn sm out">로그아웃</button>` : `<button class="btn sm in">로그인 / 회원가입</button>`;
    box.querySelector(".out")?.addEventListener("click", async () => {
      await auth.logout();
      const { save: s } = await openSave(null);
      this.g.save = s; this.guest = false; this.renderAccount(); this.refreshStart(); toast("로그아웃했어요");
    });
    box.querySelector(".in")?.addEventListener("click", () => this.authPanel());
  }
  refreshStart() { const b = this.box.querySelector(".start"); if (b) b.textContent = this.g.save.started ? "이어하기" : "새로 시작"; }

  start() {
    sfx("ok");
    if (!auth.loggedIn && !this.guest) return this.authPanel(true);
    import("../main.js").then(({ go }) => go(this.g.save.started ? "garden" : "select"));
  }

  /** Log in, sign up, or carry on as a guest. */
  authPanel(fromStart = false) {
    let mode = "login";
    const ov = el("div", { class: "overlay auth" });
    const render = (msg = "") => {
      ov.innerHTML = `<div class="panel auth-box">
        <div class="tabs"><button class="tab ${mode === "login" ? "on" : ""}" data-m="login">로그인</button><button class="tab ${mode === "signup" ? "on" : ""}" data-m="signup">회원가입</button></div>
        <form class="col">
          <input name="id" autocomplete="username" placeholder="아이디 (영문 소문자·숫자 3~16자)" maxlength="16" autocapitalize="off" spellcheck="false">
          <input name="pw" type="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" placeholder="비밀번호 (6자 이상)" maxlength="64">
          ${mode === "signup" ? '<input name="pw2" type="password" autocomplete="new-password" placeholder="비밀번호 확인" maxlength="64">' : ""}
          <div class="err">${msg}</div>
          <button class="btn primary go" type="submit">${mode === "login" ? "로그인" : "가입하고 시작"}</button>
        </form>
        <div class="small dim note">로그인하면 진행 상황이 서버에 저장돼서 다른 기기에서도 이어 할 수 있어요.${mode === "signup" && this.g.save.started && !auth.loggedIn ? "<br>지금 기기의 게스트 진행 상황이 새 계정으로 옮겨져요." : ""}</div>
        <div class="row" style="justify-content:space-between">
          ${fromStart ? '<button class="btn sm guest">게스트로 하기</button>' : "<span></span>"}
          <button class="btn sm close">닫기</button>
        </div></div>`;
      ov.querySelectorAll(".tab").forEach((b) => (b.onclick = () => { mode = b.dataset.m; sfx("ui"); render(); }));
      ov.querySelector(".close").onclick = () => ov.remove();
      ov.querySelector(".guest")?.addEventListener("click", () => { this.guest = true; ov.remove(); this.start(); });
      ov.querySelector("form").onsubmit = async (e) => {
        e.preventDefault();
        const f = new FormData(e.target), id = String(f.get("id") || "").trim().toLowerCase(), pw = String(f.get("pw") || "");
        if (mode === "signup" && pw !== f.get("pw2")) return render("비밀번호 확인이 달라요.");
        const btn = ov.querySelector(".go"); btn.disabled = true; btn.textContent = "잠시만요…";
        try {
          const guestSave = this.g.save;
          const acc = mode === "login" ? await auth.login(id, pw) : await auth.signup(id, pw);
          const { save: s, granted } = await openSave(acc, mode === "signup" ? guestSave : null);
          this.g.save = s;
          ov.remove(); sfx("level");
          this.renderAccount(); this.refreshStart();
          toast(`${acc.id}님, 환영해요!`);
          if (granted) this.devGift(granted);
          else if (fromStart) this.start();
        } catch (err) { render(err.message); }
      };
      setTimeout(() => ov.querySelector("input[name=id]")?.focus(), 50);
    };
    render();
    document.getElementById("ui").append(ov);
  }

  devGift(sp) {
    const d = SPIRIT[sp.id];
    const ov = el("div", { class: "overlay" }, `<div class="panel msg devgift"><div class="ov-title"><span class="dim">root 권한 확인</span>${d.name} 지급!</div>
      <pre class="term">$ sudo grant --spirit ${sp.id}\n[sudo] dev 계정 인증 완료\n> ${d.name} Lv.${sp.lv} 각성 상태로 지급됨_</pre>
      <div class="small">${d.desc}</div>
      <div class="row" style="justify-content:center;margin-top:calc(var(--u)*6)"><button class="btn primary">시작하기</button></div></div>`);
    ov.querySelector("button").onclick = () => { ov.remove(); this.guest = false; import("../main.js").then(({ go }) => go("garden")); };
    document.getElementById("ui").append(ov);
    sfx("legend");
  }

  options() {
    const S = this.g.save;
    const ck = (cls, on, label) => `<label class="set-row"><span>${label}</span><input type="checkbox" class="${cls}" ${on ? "checked" : ""}></label>`;
    const ov = el("div", { class: "overlay" }, `<div class="panel settings">
      <div class="ov-title">설정</div>
      <div class="set-group"><b>화면</b>
        ${ck("fs", S.settings.fullscreen !== false, "자동 전체화면")}
        <label class="set-row"><span>화면 흔들림</span><input type="range" class="shake" min="0" max="1" step="0.25" value="${S.settings.shake}"></label>
        ${ck("lessflash", S.settings.lessFlash, "번쩍임 줄이기")}
      </div>
      <div class="set-group"><b>소리</b>
        ${ck("mute", S.settings.mute, "소리 끄기")}
        ${ck("mus", S.settings.musicOff, "배경음악 끄기")}
        <label class="set-row"><span>효과음 크기</span><input type="range" class="vsfx" min="0" max="1" step="0.1" value="${S.settings.sfxVol ?? 1}"></label>
        <label class="set-row"><span>음악 크기</span><input type="range" class="vmus" min="0" max="1" step="0.1" value="${S.settings.musicVol ?? 1}"></label>
      </div>
      <div class="set-group"><b>전투</b>
        ${ck("auto", S.settings.autoAttack, "평타 자동 사용")}
        ${ck("hstop", S.settings.hitStop !== false, "타격 정지 (히트스톱)")}
      </div>
      <div class="row set-foot">
        ${auth.loggedIn ? '<button class="btn sm pwc">비밀번호 변경</button>' : ""}
        <button class="btn sm danger wipe">데이터 초기화</button>
        <span style="flex:1"></span>
        <button class="btn primary close">닫기</button>
      </div></div>`);
    ov.querySelector(".fs").onchange = (e) => { S.settings.fullscreen = e.target.checked; setAutoFullscreen(e.target.checked); if (e.target.checked) enterFullscreen(); save(S); };
    ov.querySelector(".mute").onchange = (e) => { S.settings.mute = e.target.checked; setMuted(S.settings.mute); save(S); };
    ov.querySelector(".mus").onchange = (e) => { S.settings.musicOff = e.target.checked; setMusicOff(S.settings.musicOff); save(S); };
    const vol = () => { S.settings.sfxVol = +ov.querySelector(".vsfx").value; S.settings.musicVol = +ov.querySelector(".vmus").value; setVolumes(S.settings.sfxVol, S.settings.musicVol); save(S); };
    ov.querySelector(".vsfx").oninput = vol; ov.querySelector(".vsfx").onchange = () => sfx("hit");
    ov.querySelector(".vmus").oninput = vol;
    ov.querySelector(".hstop").onchange = (e) => { S.settings.hitStop = e.target.checked; applyJuice(S.settings); save(S); };
    ov.querySelector(".lessflash").onchange = (e) => { S.settings.lessFlash = e.target.checked; applyJuice(S.settings); save(S); };
    ov.querySelector(".auto").onchange = (e) => { S.settings.autoAttack = e.target.checked; save(S); };
    ov.querySelector(".shake").oninput = (e) => { S.settings.shake = +e.target.value; window.SHAKE = S.settings.shake; save(S); };
    ov.querySelector(".wipe").onclick = async () => { if (confirm(auth.loggedIn ? "이 계정의 모든 진행 상황을 지울까요? 서버 저장도 지워져요." : "정말 모든 진행 상황을 지울까요?")) { const f = wipe(); if (auth.loggedIn) { save(f); await auth.flush(); } location.reload(); } };
    ov.querySelector(".close").onclick = () => ov.remove();
    ov.querySelector(".pwc")?.addEventListener("click", async () => {
      const old = prompt("지금 비밀번호"); if (!old) return;
      const pw = prompt("새 비밀번호 (6자 이상)"); if (!pw) return;
      try { await auth.changePassword(old, pw); toast("비밀번호를 바꿨어요"); } catch (e) { toast(e.message); }
    });
    document.getElementById("ui").append(ov);
  }

  update(dt) {
    this.t += dt;
    this.world.update(dt);
    const inp = this.g.input;
    if (!document.querySelector("#ui .overlay") && (inp.take("confirm") || inp.take("attack"))) { if (!this.revealed) this.reveal(); else this.start(); }
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
    if (show) for (const s of behind) drawSpirit(p, s.x, s.y, { id: s.id, stage: 1, t: this.t + s.x * 0.01, alpha: 0.7, glow: 0.6, key: "t" + s.id });
    this.logo.draw(p, ox, oy, this.t);
    if (this.t > this.logo.letters[8].delay + 0.45) drawGem(p, gx, gy + 3, this.t, 5);
    if (show) for (const s of front) drawSpirit(p, s.x, s.y, { id: s.id, stage: 2, t: this.t + s.x * 0.01, key: "t" + s.id });
  }
}

export default { title: TitleScene };
