// Shared body physics and statuses for the hero and enemies.
import { clamp } from "../px.js";
import { drawShadow } from "../rig/rig.js";

const STATUS_FX = { burn: "status/burning", freeze: "status/frozen", stun: "status/stunned", slow: "status/slowed", root: null };

export class Actor {
  constructor(o) {
    Object.assign(this, {
      x: 0, y: 0, z: 0, vz: 0, kx: 0, ky: 0, r: 8, height: 32, flip: false, team: 1, el: null,
      hp: 10, maxHp: 10, dead: false, removed: false, hitFlash: 0, invuln: 0, iframes: 0, heavy: false, flying: false,
      st: { burn: 0, slow: 0, freeze: 0, stun: 0, root: 0 }, stFx: {}, burnDps: 0, burnTick: 0, t: 0,
    }, o);
    this.maxHp = this.maxHp || this.hp;
  }
  get frozen() { return this.st.freeze; }
  get canMove() { return this.st.freeze <= 0 && this.st.stun <= 0 && this.st.root <= 0 && !this.dead; }
  get canAct() { return this.st.freeze <= 0 && this.st.stun <= 0 && !this.dead; }
  get speedK() { return this.st.slow > 0 ? 0.55 : 1; }

  applyStatus(st, src) {
    const ccK = src?.stats?.ccK ?? 1;
    for (const [k, v] of Object.entries(st)) {
      if (!(k in this.st)) continue;
      let dur = k === "burn" ? v : v * ccK;
      if (this.heavy && (k === "freeze" || k === "stun" || k === "root")) dur *= 0.35; // bosses shrug most of it off
      this.st[k] = Math.max(this.st[k], dur);
      if (k === "burn") this.burnDps = Math.max(this.burnDps, (src?.stats?.atk ?? 4) * 0.28 * (src?.stats?.burnK ?? 1)), (this.burnSrc = src);
      const id = STATUS_FX[k];
      if (id && !this.stFx[k] && this.world && !this.dead) {
        this.stFx[k] = this.world.fx(id, { follow: this, light: 0.6 });
      }
    }
  }

  heal(n) { if (!this.dead) this.hp = Math.min(this.maxHp, this.hp + n); }

  physics(dt) {
    this.t += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.iframes > 0) this.iframes -= dt;
    for (const k in this.st) if (this.st[k] > 0) {
      this.st[k] -= dt;
      if (this.st[k] <= 0) { this.st[k] = 0; if (this.stFx[k]) { this.stFx[k].inst.stop(); this.stFx[k] = null; } }
    }
    if (this.st.burn > 0 && !this.dead) {
      this.burnTick -= dt;
      if (this.burnTick <= 0) {
        this.burnTick = 0.5;
        this.world.hit(this.burnSrc, this, { dmg: this.burnDps * 0.5, noCrit: true, spark: false });
      }
    }
    // knockback slides and decays
    this.x += this.kx * dt; this.y += this.ky * dt;
    const decay = Math.pow(0.002, dt);
    this.kx *= decay; this.ky *= decay;
    if (Math.abs(this.kx) < 1) this.kx = 0;
    if (Math.abs(this.ky) < 1) this.ky = 0;
    // launched bodies fall back down
    if (!this.flying && (this.z > 0 || this.vz > 0)) {
      this.vz -= 520 * dt; this.z += this.vz * dt;
      if (this.z <= 0) { this.z = 0; this.vz = 0; }
    }
    this.world.clampToArena(this);
  }

  drawGround(p) {
    if (this.removed) return;
    drawShadow(p, this.x, this.y + 1, this.shadowW ?? this.r * 2, this.z + (this.hover ?? 0));
  }

  clearStatusFx() { for (const k in this.stFx) if (this.stFx[k]) { this.stFx[k].inst.stop(); this.stFx[k] = null; } }
}

export const approach = (v, target, k, dt) => v + (target - v) * clamp(k * dt);
