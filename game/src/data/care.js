// Raising spirits: bond (affection), fullness and mood, treats grown in the garden plots, gifts and nicknames.
// Fullness and mood drift down in real time; caring raises them and builds the bond, which makes the spirit
// stronger in battle.

/** Treats, each one a favourite of an element. grow: real seconds from seed to harvest. */
export const TREATS = {
  chili:  { name: "불씨 고추",   el: "fire",  grow: 240, seed: 30,  yield: [2, 3], c: ["#5a1408", "#c8321a", "#ff6a3a", "#ffc070"], leaf: "#3e8a2a" },
  berry:  { name: "이슬 베리",   el: "water", grow: 240, seed: 30,  yield: [2, 3], c: ["#0c2a5a", "#1c66c0", "#5ab8ff", "#c8f0ff"], leaf: "#2f7a4a" },
  cotton: { name: "구름 솜사탕", el: "wind",  grow: 360, seed: 45,  yield: [2, 3], c: ["#3a7a6a", "#7ed8bc", "#bff5e0", "#ffffff"], leaf: "#4f9a3a" },
  potato: { name: "바위 감자",   el: "earth", grow: 300, seed: 40,  yield: [2, 4], c: ["#3a2410", "#7a5028", "#c89058", "#f0d0a0"], leaf: "#5a8a2a" },
  honey:  { name: "별빛 꿀",     el: "light", grow: 600, seed: 80,  yield: [2, 3], c: ["#6a4a08", "#c89018", "#ffd84a", "#fff6c0"], leaf: "#6aa03a" },
  mush:   { name: "그림자 버섯", el: "dark",  grow: 480, seed: 70,  yield: [2, 3], c: ["#1a0c30", "#4a2a8a", "#a070e0", "#e0c8ff"], leaf: "#3a5a4a" },
  cookie: { name: "바이트 쿠키", el: "code",  grow: 720, seed: 120, yield: [2, 3], c: ["#0a2a10", "#1e7a30", "#7ee88a", "#e0ffe0"], leaf: "#2a6a3a" },
};
export const favTreat = (el) => Object.keys(TREATS).find((k) => TREATS[k].el === el) ?? "berry";

// bond points needed for each level (1..10)
const BOND_T = [0, 20, 50, 100, 170, 260, 370, 500, 660, 850];
export const BOND_MAX = BOND_T.length;
export function bondLv(sp) { const b = sp.bond ?? 0; let lv = 1; while (lv < BOND_MAX && b >= BOND_T[lv]) lv++; return lv; }
export function bondProgress(sp) {
  const lv = bondLv(sp); if (lv >= BOND_MAX) return 1;
  return ((sp.bond ?? 0) - BOND_T[lv - 1]) / (BOND_T[lv] - BOND_T[lv - 1]);
}
export const BOND_PERKS = [
  [2, "체력·공격 +2% (레벨마다)"], [3, "이름 지어주기, 선물을 가져와요"], [5, "치명타 확률 +3%"], [7, "선물이 더 좋아져요"], [10, "영혼의 유대: 치명 피해 +25%, 치명타 +3%"],
];
export const BOND_TITLES = ["낯가림", "경계", "호기심", "친근함", "다정함", "믿음", "단짝", "가족", "소울메이트", "영혼의 유대"];

/** Battle bonuses from bond and mood (applied in heroStats). */
export function careBonus(sp) {
  ensure(sp);
  const lv = bondLv(sp), o = { hp: 1 + 0.02 * (lv - 1), atk: 1 + 0.02 * (lv - 1), crit: 0, critDmg: 0, tags: [] };
  if (lv >= 5) o.crit += 0.03;
  if (lv >= 10) { o.crit += 0.03; o.critDmg += 0.25; }
  if (sp.full >= 60) { o.hp += 0.05; o.tags.push("배부름: 체력 +5%"); }
  if (sp.joy >= 60) { o.atk += 0.05; o.tags.push("신남: 공격 +5%"); }
  return o;
}

export function ensure(sp) {
  if (sp.bond == null) sp.bond = 0;
  if (sp.full == null) sp.full = 70;
  if (sp.joy == null) sp.joy = 70;
  return sp;
}

/** Bring every spirit's needs up to now. Call when the garden opens and now and then while it is open. */
export function tickCare(S, now = Date.now()) {
  if (!S.care) S.care = { at: now, treats: {}, farm: [], plots: 3, giftSeen: 0 };
  const C = S.care, hrs = Math.max(0, (now - (C.at ?? now)) / 3600000);
  C.at = now;
  for (const sp of S.spirits) {
    ensure(sp);
    sp.full = Math.max(0, sp.full - 6 * hrs);
    sp.joy = Math.max(0, sp.joy - 5 * hrs);
    // a spirit that likes you brings something back every few hours
    if (!sp.gift && bondLv(sp) >= 3 && sp.joy >= 35 && now - (sp.giftAt ?? 0) > 3 * 3600000) sp.gift = rollGift(sp);
  }
  return C;
}
const clamp = (v) => Math.max(0, Math.min(100, v));
const COOL = { pet: 10 * 60000, play: 15 * 60000 };
export const coolLeft = (sp, k, now = Date.now()) => Math.max(0, (sp[k + "At"] ?? 0) + COOL[k] - now);

/** Each care action returns { ok, msg, react } and changes the save in place. */
export function pet(sp, now = Date.now()) {
  ensure(sp);
  if (coolLeft(sp, "pet", now) > 0) { sp.joy = clamp(sp.joy + 2); return { ok: true, msg: "기분 좋게 눈을 감아요", react: "pet", bond: 0 }; }
  sp.petAt = now; sp.bond += 3; sp.joy = clamp(sp.joy + 14);
  return { ok: true, msg: "쓰담쓰담! 유대 +3", react: "pet", bond: 3 };
}
export function feed(S, sp, key, el) {
  ensure(sp);
  const C = S.care;
  if (!(C.treats[key] > 0)) return { ok: false, msg: "그 간식이 없어요. 텃밭에서 키워 보세요" };
  if (sp.full >= 95) return { ok: false, msg: "배불러서 더는 못 먹겠대요", react: "no" };
  C.treats[key]--;
  const fav = TREATS[key].el === el, b = fav ? 12 : 5;
  sp.full = clamp(sp.full + 35); sp.joy = clamp(sp.joy + (fav ? 18 : 5)); sp.bond += b;
  return { ok: true, msg: fav ? `제일 좋아하는 ${TREATS[key].name}! 유대 +${b}` : `냠냠. 유대 +${b}`, react: fav ? "love" : "eat", bond: b, fav, key };
}
export function play(sp, now = Date.now()) {
  ensure(sp);
  if (sp.full < 15) return { ok: false, msg: "배가 고파서 놀 힘이 없대요", react: "no" };
  const cd = coolLeft(sp, "play", now);
  if (cd > 0) return { ok: false, msg: `조금 지쳤대요 (${Math.ceil(cd / 60000)}분 뒤)`, react: "no" };
  sp.playAt = now; sp.full = clamp(sp.full - 10); sp.joy = clamp(sp.joy + 28); sp.bond += 6;
  return { ok: true, msg: "신나게 놀았어요! 유대 +6", react: "play", bond: 6 };
}
/** After a run together: the bond grows, the spirit comes home hungry but excited. */
export function afterRun(S, cleared) {
  tickCare(S);
  const a = S.spirits.find((x) => x.uid === S.active), b = S.sub ? S.spirits.find((x) => x.uid === S.sub) : null;
  if (a) { a.bond += cleared ? 10 : 5; a.full = clamp(a.full - 20); a.joy = clamp(a.joy + 8); }
  if (b) { b.bond += 3; b.full = clamp(b.full - 10); }
}

function rollGift(sp) {
  const lv = bondLv(sp), r = Math.random(), rich = lv >= 7 ? 2 : 1;
  if (r < 0.12 * rich) return { kind: "gems", n: (5 + Math.floor(Math.random() * 10)) * rich };
  if (r < 0.5) { const keys = Object.keys(TREATS).filter((k) => k !== "cookie"); return { kind: "treat", key: keys[Math.floor(Math.random() * keys.length)], n: 1 + rich }; }
  return { kind: "essence", n: Math.round((80 + Math.random() * 120) * lv * rich) };
}
export function takeGift(S, sp) {
  const g = sp.gift; if (!g) return null;
  sp.gift = null; sp.giftAt = Date.now();
  if (g.kind === "gems") S.res.gems += g.n;
  else if (g.kind === "essence") S.res.essence += g.n;
  else S.care.treats[g.key] = (S.care.treats[g.key] ?? 0) + g.n;
  return g.kind === "gems" ? `보석 ${g.n}개` : g.kind === "essence" ? `정수 ${g.n}` : `${TREATS[g.key].name} ${g.n}개`;
}

// ---- farm plots ----------------------------------------------------------------------------------------
export const MAX_PLOTS = 6;
export const plotCost = (n) => 400 * Math.pow(2, n - 3);
export function plant(S, i, key) {
  const C = S.care, T = TREATS[key];
  if (S.res.essence < T.seed) return { ok: false, msg: "정수가 부족해요" };
  S.res.essence -= T.seed; C.farm[i] = { key, at: Date.now() };
  return { ok: true, msg: `${T.name} 씨앗을 심었어요` };
}
export function growth(plot, now = Date.now()) { return plot ? Math.min(1, (now - plot.at) / 1000 / TREATS[plot.key].grow) : 0; }
export function harvestPlot(S, i) {
  const C = S.care, P = C.farm[i]; if (!P || growth(P) < 1) return null;
  const T = TREATS[P.key], n = T.yield[0] + Math.floor(Math.random() * (T.yield[1] - T.yield[0] + 1));
  C.treats[P.key] = (C.treats[P.key] ?? 0) + n; C.farm[i] = null;
  return { key: P.key, n };
}

/** What a spirit wants right now, for the little bubble over its head. */
export function need(sp) {
  if (sp.gift) return "gift";
  if (sp.full < 30) return "hungry";
  if (sp.joy < 30) return "sad";
  if (sp.full >= 80 && sp.joy >= 80) return "happy";
  return null;
}
