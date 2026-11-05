// The spirit roster: starters, and the pool the summoning well draws from.
// tint: an optional ramp that replaces the element's effect colours (so a crimson fire spirit burns crimson).

export const GRADES = {
  1: { name: "일반", stars: "★", mult: 1.0, rate: 0.6, css: "#b8b4cc", pillar: ["#2e2a35", "#5c5664", "#a39cab", "#d0d0da", "#ffffff"] },
  2: { name: "희귀", stars: "★★", mult: 1.15, rate: 0.3, css: "#58b4ec", pillar: ["#0e2e5a", "#1c76bc", "#58b4ec", "#c4ecff", "#ffffff"] },
  3: { name: "영웅", stars: "★★★", mult: 1.35, rate: 0.085, css: "#c684ff", pillar: ["#2b1252", "#6b2cc0", "#9a48ec", "#ecc8ff", "#ffffff"] },
  4: { name: "전설", stars: "★★★★", mult: 1.6, rate: 0.015, css: "#ffd84a", pillar: ["#5a3e10", "#d8a428", "#ffd84a", "#fffbe6", "#ffffff"] },
};

/** Passive effects. Each is a function of the hero stats object, applied at sortie. */
export const PASSIVES = {
  atk10: { text: "공격력 +10%", apply: (s) => { s.atk *= 1.1; } },
  atk20: { text: "공격력 +20%", apply: (s) => { s.atk *= 1.2; } },
  hp15: { text: "최대 체력 +15%", apply: (s) => { s.hp *= 1.15; } },
  hp30: { text: "최대 체력 +30%", apply: (s) => { s.hp *= 1.3; } },
  crit10: { text: "치명타 확률 +10%", apply: (s) => { s.crit += 0.1; } },
  cd10: { text: "스킬 재사용 대기시간 -10%", apply: (s) => { s.cdr += 0.1; } },
  cd20: { text: "스킬 재사용 대기시간 -20%", apply: (s) => { s.cdr += 0.2; } },
  speed: { text: "이동 속도 +12%", apply: (s) => { s.speed *= 1.12; } },
  regen: { text: "초당 체력 0.6% 회복", apply: (s) => { s.regen += 0.006; } },
  leech: { text: "가한 피해의 3% 흡혈", apply: (s) => { s.leech += 0.03; } },
  burnPlus: { text: "화상 피해 +50%", apply: (s) => { s.burnK *= 1.5; } },
  freezePlus: { text: "빙결·둔화 지속 +40%", apply: (s) => { s.ccK *= 1.4; } },
  chainPlus: { text: "기절 지속 +40%, 치명타 피해 +30%", apply: (s) => { s.ccK *= 1.2; s.critDmg += 0.3; } },
  guard: { text: "받는 피해 -12%", apply: (s) => { s.armor += 0.12; } },
  essence: { text: "던전 정수 획득 +25%", apply: (s) => { s.loot += 0.25; } },
  ultCharge: { text: "궁극기 재사용 대기시간 -25%", apply: (s) => { s.ultCdr += 0.25; } },
  affinity: { text: "상성 우위 피해 +20%", apply: (s) => { s.affinity += 0.2; } },
};

export const SPIRITS = [
  // ★1
  { id: "ember", el: "fire", grade: 1, name: "불똥이", passives: ["atk10"] },
  { id: "drop", el: "water", grade: 1, name: "물방울이", passives: ["hp15"] },
  { id: "breeze", el: "wind", grade: 1, name: "산들이", passives: ["speed"] },
  { id: "pebble", el: "earth", grade: 1, name: "조약돌이", passives: ["guard"] },
  // ★2 — the starters live here
  { id: "sala", el: "fire", grade: 2, name: "살라", passives: ["burnPlus"], starter: true, desc: "장난기 많은 불도마뱀 정령. 성질이 급하다." },
  { id: "undi", el: "water", grade: 2, name: "운디", passives: ["regen"], starter: true, desc: "차분한 물의 정령. 상처를 천천히 씻어 준다." },
  { id: "sylphi", el: "wind", grade: 2, name: "실피", passives: ["cd10"], starter: true, desc: "한시도 가만히 있지 않는 바람의 정령." },
  { id: "nomi", el: "earth", grade: 2, name: "노미", passives: ["hp15"], starter: true, desc: "묵묵하고 듬직한 땅의 정령. 잘 먹는다." },
  // ★3
  { id: "crimson", el: "fire", grade: 3, name: "홍련", passives: ["atk20", "crit10"], tint: ["#16060e", "#3a0a1e", "#6e1230", "#b0203e", "#e8405a", "#ff7a8a", "#ffc4c8", "#ffffff"] },
  { id: "glacier", el: "water", grade: 3, name: "빙하", passives: ["freezePlus", "hp15"], tint: ["#0c1430", "#162c5c", "#1f4f94", "#2f7fcc", "#58b4ec", "#9bdcff", "#d8f4ff", "#ffffff"] },
  { id: "thunder", el: "wind", grade: 3, name: "뇌명", passives: ["chainPlus", "cd10"], tint: ["#16120a", "#3e300c", "#7a5c10", "#c49218", "#f0c83a", "#fff08a", "#fffbe0", "#ffffff"] },
  { id: "bastion", el: "earth", grade: 3, name: "암벽", passives: ["guard", "hp30"], tint: ["#0e0e12", "#1c1c24", "#2c2c38", "#42424f", "#6e6e86", "#9a9ab4", "#c8c8e0", "#ffffff"] },
  // ★4
  { id: "agni", el: "fire", grade: 4, name: "염제 아그니", passives: ["atk20", "ultCharge"], tint: ["#140616", "#3a0c3a", "#7a1450", "#c42a4a", "#ff6a2a", "#ffb43a", "#fff07a", "#ffffff"], crown: true },
  { id: "levia", el: "water", grade: 4, name: "심해의 레비아", passives: ["regen", "freezePlus"], tint: ["#04101e", "#082a3e", "#0c4e60", "#107e88", "#18b4b0", "#4ce8d8", "#b4fff0", "#ffffff"], crown: true },
  { id: "tempest", el: "wind", grade: 4, name: "폭풍왕 템페스트", passives: ["cd20", "chainPlus"], tint: ["#0e0a26", "#241452", "#3e2490", "#5c48d0", "#7c8cff", "#a4d0ff", "#e0f4ff", "#ffffff"], crown: true },
  { id: "gaia", el: "earth", grade: 4, name: "대지모 가이아", passives: ["hp30", "affinity"], tint: ["#0c1a0e", "#163418", "#2a5a24", "#4a8a30", "#8ab840", "#d8d060", "#fff0a0", "#ffffff"], crown: true },
];

export const SPIRIT = Object.fromEntries(SPIRITS.map((s) => [s.id, s]));
export const STARTERS = SPIRITS.filter((s) => s.starter);

export const MAX_LV = 30;
export const EVOLVE_LV = { 2: 10, 3: 25 };

/** Essence to go from lv to lv + 1. */
export const lvCost = (lv) => Math.round(20 + lv * 14 + lv * lv * 2.2);

/** Hero stats with this spirit absorbed. */
export function heroStats(sp, sub) {
  const def = SPIRIT[sp.id], g = GRADES[def.grade];
  const stageK = [1, 1, 1.3, 1.75][sp.stage];
  const lvK = 1 + (sp.lv - 1) * 0.08;
  const s = {
    hp: 120 * lvK * g.mult * (0.85 + 0.15 * stageK), atk: 10 * lvK * g.mult * stageK, crit: 0.06, critDmg: 1.6,
    cdr: 0, ultCdr: 0, speed: 78, regen: 0, leech: 0, burnK: 1, ccK: 1, armor: 0, loot: 0, affinity: 0,
  };
  for (const p of def.passives) PASSIVES[p]?.apply(s);
  if (sub) for (const p of SPIRIT[sub.id].passives) PASSIVES[p]?.apply(s);
  s.hp = Math.round(s.hp);
  return s;
}
