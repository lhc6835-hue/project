// Signature traits: one-of-a-kind effects that a spirit brings into battle on top of its passives.
// Hooks: start(hero, w), tick(hero, w, dt), hit(hero, w, tgt, dmg, crit), kill(hero, w, tgt),
//        dash(hero, w), cast(hero, w, slot), hurt(hero, w, dmg, src), death(hero, w) → true to cancel.
import { DEPTH_K } from "../game/world.js";

const near = (w, x, y, r, skip) => w.enemies.filter((e) => e !== skip && Math.hypot(e.x - x, (e.y - y) * DEPTH_K) <= r + e.r);
const T = (o) => ({ ...o, trait: true });

export const TRAITS = {
  burnSpread: { name: "불꽃 전이", text: "화상 입은 적을 쓰러뜨리면 주변 적에게 화상이 번진다",
    kill(h, w, e) { if (!(e.st?.burn > 0)) return; w.fx("fire/fire-ring", { x: e.x, y: e.y, ramp: h.rampFor("main"), light: 0.7, opts: { reach: 50 }, dur: 0.8 }); for (const o of near(w, e.x, e.y, 54, e)) o.applyStatus({ burn: 3 }, h); } },
  killBurst: { name: "용암 폭발", text: "적을 쓰러뜨리면 그 자리가 폭발한다 (공격력 150%)",
    kill(h, w, e) { w.fx("explosions/small-explosion", { x: e.x, y: e.y + 1, ramp: h.rampFor("main"), light: 0.8, opts: { size: 0.6 }, dur: 0.8 }); for (const o of near(w, e.x, e.y, 34, e)) w.hit(h, o, T({ dmg: h.stats.atk * 1.5, el: h.el, kb: 80, from: [e.x, e.y], spark: false })); } },
  rebirth: { name: "불사조의 심장", text: "한 판에 한 번, 쓰러지면 불길 속에서 체력 60%로 되살아난다",
    death(h, w) { if (h.reborn) return false; h.reborn = true; w.after(0.6, () => { h.dead = false; h.hp = h.maxHp * 0.6; h.invuln = 2.5; w.fx("fire/flame-pillar", { x: h.x, y: h.y, ramp: h.rampFor("main"), light: 1, dur: 1.5 }); w.emit({ banner: "불사조의 심장!", color: "#ff8a2a", flash: 0.6 }); }); return true; } },
  slowAura: { name: "냉기 오라", text: "가까이 있는 적은 계속 느려진다",
    tick(h, w, dt) { h._aura = (h._aura ?? 0) - dt; if (h._aura > 0) return; h._aura = 0.4; for (const o of near(w, h.x, h.y, 60)) o.applyStatus({ slow: 0.6 }, h); } },
  frostShatter: { name: "빙결 파쇄", text: "얼어붙은 적을 때리면 얼음이 터져 주변에 큰 피해 (공격력 220%)",
    hit(h, w, e) { if (!(e.st?.freeze > 0) || e._shatterCd > w.time) return; e._shatterCd = w.time + 0.8; w.fx("ice/ice-shatter", { x: e.x, y: e.y + 0.5, ramp: h.rampFor("ice"), light: 0.9 }); for (const o of near(w, e.x, e.y, 40)) w.hit(h, o, T({ dmg: h.stats.atk * 2.2, el: h.el, kb: 60, from: [e.x, e.y], spark: false })); } },
  critChain: { name: "연쇄 뇌격", text: "치명타가 터지면 번개가 근처 적 셋에게 튄다 (공격력 60%)",
    hit(h, w, e, dmg, crit) { if (!crit) return; let from = [e.x, e.y, 16]; const seen = new Set([e]); for (let i = 0; i < 3; i++) { const n = w.nearestEnemy(from[0], from[1], 90, seen); if (!n) break; seen.add(n); const to = [n.x, n.y, 16], fr = from; w.after(i * 0.06, () => { w.bolts.push({ a: fr, b: to, t: 0.2, ramp: h.rampFor("storm") }); if (!n.dead) w.hit(h, n, T({ dmg: h.stats.atk * 0.6, el: h.el, spark: false, st: { stun: 0.15 } })); }); from = to; } } },
  dashNova: { name: "하늘의 파도", text: "회피할 때마다 주위에 충격파가 퍼진다 (공격력 200%)",
    dash(h, w) { w.fx("water/splash", { x: h.x, y: h.y, ramp: h.rampFor("main"), light: 0.8, dur: 0.8 }); for (const o of near(w, h.x, h.y, 48)) w.hit(h, o, T({ dmg: h.stats.atk * 2, el: h.el, kb: 160, from: [h.x, h.y] })); } },
  orbitStar: { name: "위성", text: "작은 별 둘이 주위를 돌며 닿는 적에게 피해 (공격력 40%)",
    start(h, w) { h._orb = [0, Math.PI]; },
    tick(h, w, dt) { if (!h._orb || h.dead) return; h._orbT = (h._orbT ?? 0) - dt; h._orb = h._orb.map((a) => a + dt * 3.6); if (h._orbT > 0) return; h._orbT = 0.2; for (const a of h._orb) { const x = h.x + Math.cos(a) * 30, y = h.y + Math.sin(a) * 13; for (const o of near(w, x, y, 10)) w.hit(h, o, T({ dmg: h.stats.atk * 0.4, el: h.el, spark: false, kb: 30, from: [x, y] })); } },
    draw(h, p) { if (!h._orb || h.dead) return; for (const a of h._orb) { const x = Math.round(h.x + Math.cos(a) * 30), y = Math.round(h.y - 14 + Math.sin(a) * 13); const c = h.accent[4]; p.put(x, y, c); p.put(x + 1, y, c); p.put(x - 1, y, c); p.put(x, y + 1, c); p.put(x, y - 1, c); for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) { const d = i * i + j * j; if (d < 16) p.add(x + i, y + j, h.glowC, 0.2 * (1 - d / 16)); } } } },
  thorns: { name: "가시 갑옷", text: "공격받으면 공격자에게 피해를 되돌려 준다 (공격력 300%)",
    hurt(h, w, dmg, src) { if (!src || src.team !== 1 || src.dead) return; w.fx("nature/thorns", { x: h.x - 20, y: h.y, ramp: h.rampFor("main"), light: 0.6, opts: { count: 3 }, dur: 0.6 }); w.hit(h, src, T({ dmg: h.stats.atk * 3, el: h.el, spark: false })); } },
  killShield: { name: "수정 방벽", text: "적을 쓰러뜨리면 잠깐 무적이 되고 체력 3%를 회복한다",
    kill(h) { h.invuln = Math.max(h.invuln, 0.6); h.heal(h.maxHp * 0.03); } },
  execute10: { name: "심판의 눈", text: "체력이 10% 아래로 떨어진 적은 즉시 쓰러진다 (보스 제외)",
    hit(h, w, e) { if (e.heavy || e.dead || e.hp > e.maxHp * 0.1) return; w.fx("spawn/disintegrate", { x: e.x, y: e.y + 0.5, ramp: h.rampFor("main"), light: 0.9 }); w.hit(h, e, T({ dmg: e.hp + 1, noCrit: true, spark: false })); } },
  soulWisp: { name: "혼불", text: "적을 쓰러뜨리면 혼이 빠져나와 다른 적을 덮친다 (공격력 120%)",
    kill(h, w, e) { const n = w.nearestEnemy(e.x, e.y, 160, new Set([e])); if (!n) return; w.after(0.25, () => { w.bolts.push({ a: [e.x, e.y, 14], b: [n.x, n.y, 14], t: 0.25, ramp: h.rampFor("main") }); if (!n.dead) w.hit(h, n, T({ dmg: h.stats.atk * 1.2, el: h.el })); }); } },
  vamp: { name: "피의 계약", text: "치명타로 준 피해의 20%만큼 체력을 회복한다",
    hit(h, w, e, dmg, crit) { if (crit) h.heal(dmg * 0.2); } },
  holyBurst: { name: "축복의 메아리", text: "스킬을 쓸 때마다 주위에 빛이 터진다 (공격력 180%)",
    cast(h, w, slot) { if (slot === "basic") return; w.fx("holy/sunburst", { x: h.x, y: h.y, z: 16, ramp: h.rampFor("main"), light: 0.8, dur: 0.6, top: true }); for (const o of near(w, h.x, h.y, 56)) w.hit(h, o, T({ dmg: h.stats.atk * 1.8, el: h.el, kb: 100, from: [h.x, h.y] })); } },
  bloom: { name: "생명의 꽃", text: "3초마다 발밑에 꽃이 피어 체력 4%를 회복한다",
    tick(h, w, dt) { h._bloom = (h._bloom ?? 3) - dt; if (h._bloom > 0 || h.dead) return; h._bloom = 3; h.heal(h.maxHp * 0.04); w.fx("nature/healing-bloom", { x: h.x, y: h.y, light: 0.7, dur: 1.2 }); } },
  sporeCloud: { name: "포자 구름", text: "맞힌 적에게 독 포자가 붙어 화상처럼 타들어 간다",
    hit(h, w, e) { if (Math.random() < 0.35) e.applyStatus({ burn: 2 }, h); } },
};

export const TRAIT_FX = ["fire/fire-ring", "explosions/small-explosion", "fire/flame-pillar", "ice/ice-shatter", "water/splash", "nature/thorns", "spawn/disintegrate", "holy/sunburst", "nature/healing-bloom"];
