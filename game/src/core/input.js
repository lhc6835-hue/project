// Keyboard + touch input. Movement is a vector; actions are edge-triggered presses (and held for basic attack).
const KEYMAP = {
  KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right",
  KeyJ: "attack", KeyZ: "attack", KeyQ: "s1", KeyX: "s1", KeyE: "s2", KeyC: "s2", KeyR: "ult", KeyV: "ult",
  Space: "dash", ShiftLeft: "dash", Escape: "pause", KeyP: "pause", Enter: "confirm",
};

export class Input {
  constructor() {
    this.held = new Set(); this.pressed = new Set();
    this.stick = { x: 0, y: 0, id: null, cx: 0, cy: 0 };
    this.touch = matchMedia("(pointer: coarse)").matches;
    this.mouseAttack = false;
    addEventListener("keydown", (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      if (!this.held.has(a)) this.pressed.add(a);
      this.held.add(a);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    });
    addEventListener("keyup", (e) => { const a = KEYMAP[e.code]; if (a) this.held.delete(a); });
    addEventListener("blur", () => this.held.clear());
    this.bindTouch();
  }

  bindTouch() {
    const stick = document.getElementById("stick"), knob = document.getElementById("knob");
    const R = () => stick.getBoundingClientRect();
    const move = (x, y) => {
      const r = R(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, max = r.width / 2;
      let dx = x - cx, dy = y - cy; const L = Math.hypot(dx, dy);
      if (L > max) { dx *= max / L; dy *= max / L; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.stick.x = dx / max; this.stick.y = dy / max;
    };
    stick.addEventListener("pointerdown", (e) => { this.stick.id = e.pointerId; stick.setPointerCapture(e.pointerId); move(e.clientX, e.clientY); this.touch = true; document.body.classList.add("touch"); });
    stick.addEventListener("pointermove", (e) => { if (e.pointerId === this.stick.id) move(e.clientX, e.clientY); });
    const end = (e) => { if (e.pointerId !== this.stick.id) return; this.stick.id = null; this.stick.x = this.stick.y = 0; knob.style.transform = ""; };
    stick.addEventListener("pointerup", end); stick.addEventListener("pointercancel", end);
    for (const b of document.querySelectorAll(".tbtn")) {
      const a = b.dataset.act;
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); this.pressed.add(a); this.held.add(a); this.touch = true; });
      const up = () => this.held.delete(a);
      b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up);
    }
  }

  showTouch(on) { document.body.classList.toggle("touch", this.touch); document.getElementById("touch").hidden = !(on && this.touch); }

  get move() {
    let x = 0, y = 0;
    if (this.held.has("left")) x -= 1; if (this.held.has("right")) x += 1;
    if (this.held.has("up")) y -= 1; if (this.held.has("down")) y += 1;
    if (this.stick.id !== null) { x = this.stick.x; y = this.stick.y; }
    return { x, y };
  }
  take(a) { const h = this.pressed.has(a); this.pressed.delete(a); return h; }
  endFrame() { this.pressed.clear(); }
}
