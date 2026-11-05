// In-run upgrade cards. apply(hero, run) changes this run only. weight: how often it shows up.
export const CARDS = [
  { id: "atk", grade: 1, name: "날 선 기운", text: "공격력 +15%", apply: (h) => { h.stats.atk *= 1.15; } },
  { id: "atk2", grade: 2, name: "끓는 힘", text: "공격력 +28%", apply: (h) => { h.stats.atk *= 1.28; } },
  { id: "hp", grade: 1, name: "단단한 몸", text: "최대 체력 +20%, 그만큼 회복", apply: (h) => { const add = Math.round(h.maxHp * 0.2); h.maxHp += add; h.hp += add; } },
  { id: "crit", grade: 1, name: "급소 찌르기", text: "치명타 확률 +10%", apply: (h) => { h.stats.crit += 0.1; } },
  { id: "critd", grade: 2, name: "처형자", text: "치명타 피해 +50%", apply: (h) => { h.stats.critDmg += 0.5; } },
  { id: "cdr", grade: 1, name: "빠른 호흡", text: "스킬 재사용 대기시간 -15%", apply: (h) => { h.stats.cdr += 0.15; } },
  { id: "cdr2", grade: 2, name: "정령의 박동", text: "스킬 재사용 대기시간 -25%", apply: (h) => { h.stats.cdr += 0.25; } },
  { id: "ult", grade: 2, name: "각성의 불씨", text: "궁극기 재사용 대기시간 -30%", stage: 3, apply: (h) => { h.stats.ultCdr += 0.3; } },
  { id: "spd", grade: 1, name: "가벼운 발", text: "이동 속도 +15%", apply: (h) => { h.speed *= 1.15; } },
  { id: "regen", grade: 1, name: "샘솟는 생명", text: "초당 최대 체력의 0.8% 회복", apply: (h) => { h.stats.regen += 0.008; } },
  { id: "leech", grade: 2, name: "피의 갈증", text: "가한 피해의 5% 흡혈", apply: (h) => { h.stats.leech += 0.05; } },
  { id: "armor", grade: 1, name: "돌가죽", text: "받는 피해 -12%", apply: (h) => { h.stats.armor = Math.min(0.6, h.stats.armor + 0.12); } },
  { id: "aff", grade: 2, name: "상성의 이치", text: "상성 우위 피해 +30%", apply: (h) => { h.stats.affinity += 0.3; } },
  { id: "killheal", grade: 1, name: "포식", text: "적을 쓰러뜨리면 체력 3% 회복", apply: (h, r) => { r.mods.killHeal += 0.03; } },
  { id: "dashbuff", grade: 2, name: "질풍의 여운", text: "회피 후 1.5초간 공격력 +40%", apply: (h, r) => { r.mods.dashBuff = true; } },
  { id: "echo", grade: 3, name: "메아리", text: "평타가 25% 확률로 속성 폭발을 일으킨다", apply: (h, r) => { r.mods.echo += 0.25; } },
  { id: "loot", grade: 1, name: "정수 수집가", text: "정수 획득 +30%", apply: (h) => { h.stats.loot += 0.3; } },
  { id: "fury", grade: 3, name: "광폭", text: "공격력 +45%, 받는 피해 +15%", apply: (h) => { h.stats.atk *= 1.45; h.stats.armor -= 0.15; } },
  { id: "second", grade: 3, name: "불사의 정령", text: "한 번 쓰러져도 체력 40%로 일어난다", apply: (h, r) => { r.mods.revive = true; } },
  { id: "heal", grade: 1, name: "회복의 샘", text: "체력을 45% 회복한다", once: true, apply: (h) => { h.heal(h.maxHp * 0.45); } },
];

export const CARD_GRADE = { 1: { name: "일반", css: "#a59fc4" }, 2: { name: "희귀", css: "#58b4ec" }, 3: { name: "영웅", css: "#c684ff" } };

/** Pick n distinct cards, weighted toward common, skipping ones that don't fit the hero. */
export function drawCards(n, hero, taken, rng = Math.random, elite = false) {
  const pool = CARDS.filter((c) => (!c.stage || hero.stage >= c.stage) && !(c.id === "second" && taken.has("second")));
  const out = [];
  while (out.length < n && pool.length) {
    const wts = pool.map((c) => (c.grade === 1 ? 6 : c.grade === 2 ? (elite ? 5 : 3) : elite ? 2.5 : 1) * (c.id === "heal" && hero.hp < hero.maxHp * 0.5 ? 4 : 1));
    let r = rng() * wts.reduce((a, b) => a + b, 0), i = 0;
    while (r > wts[i]) r -= wts[i++];
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}
