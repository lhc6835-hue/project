import { careBonus } from "./care.js";
// The spirit roster: starters, and the pool the summoning well draws from.
// tint: an optional ramp that replaces the element's effect colours (so a crimson fire spirit burns crimson).

export const GRADES = {
  1: { name: "일반", stars: "★", mult: 1.0, rate: 0.6, css: "#b8b4cc", pillar: ["#2e2a35", "#5c5664", "#a39cab", "#d0d0da", "#ffffff"] },
  2: { name: "희귀", stars: "★★", mult: 1.15, rate: 0.3, css: "#58b4ec", pillar: ["#0e2e5a", "#1c76bc", "#58b4ec", "#c4ecff", "#ffffff"] },
  3: { name: "영웅", stars: "★★★", mult: 1.35, rate: 0.085, css: "#c684ff", pillar: ["#2b1252", "#6b2cc0", "#9a48ec", "#ecc8ff", "#ffffff"] },
  4: { name: "전설", stars: "★★★★", mult: 1.6, rate: 0.015, css: "#ffd84a", pillar: ["#5a3e10", "#d8a428", "#ffd84a", "#fffbe6", "#ffffff"] },
  5: { name: "개발자", stars: "</>", mult: 3.0, rate: 0, css: "#3cd650", pillar: ["#05200c", "#106624", "#3cd650", "#a4ffa8", "#ffffff"] },
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
  root: { text: "루트 권한: 공격 +200% · 체력 +200% · 재사용 대기 -50% · 치명 +50% · 받는 피해 -60% · 초당 3% 회복 · 이동 +30%",
    apply: (s) => { s.atk *= 3; s.hp *= 3; s.cdr += 0.5; s.ultCdr += 0.5; s.crit += 0.5; s.critDmg += 1; s.armor += 0.6; s.regen += 0.03; s.speed *= 1.3; s.loot += 1; } },
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

  // ===================== the wider roster =====================
  // fire
  { id: "chirp", el: "fire", grade: 1, form: "bird", name: "짹불", passives: ["atk10"], desc: "화롯가에서 태어난 아기 새. 날갯짓마다 불티가 떨어진다.",
    tint: ["#1f0b10", "#4a1118", "#8c1d1c", "#cc3a1a", "#f2701f", "#ffae35", "#ffe27a", "#fff8d6"], accent: ["#3d1012", "#701a14", "#a8301a", "#e0561e", "#ff8a2a", "#ffc46a", "#fff0b0", "#ffffff"] },
  { id: "hongmi", el: "fire", grade: 2, form: "fox", name: "홍미", passives: ["burnPlus"], traits: ["burnSpread"], desc: "꼬리 끝에 여우불을 매단 장난꾸러기. 불장난을 좋아한다.",
    tint: ["#1a0a0e", "#3d1012", "#701a14", "#b4301a", "#e8601e", "#ff9a3a", "#ffd27a", "#fff4d8"], accent: ["#3a1a10", "#8a3a14", "#d86a1e", "#ffae4a", "#ffe0a0", "#fff4d8", "#ffffff", "#ffffff"] },
  { id: "bandi", el: "fire", grade: 2, form: "lantern", name: "반디", passives: ["regen"], desc: "길 잃은 이를 비춰 주는 작은 등불 정령. 수줍음이 많다.",
    tint: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"], accent: ["#160c06", "#2e1a0c", "#4a2c14", "#6a421e", "#8e5c2c", "#b47c40", "#d8a464", "#f0c890"] },
  { id: "magma", el: "fire", grade: 3, form: "serpent", name: "용암 도롱뇽 마그", passives: ["atk20", "burnPlus"], traits: ["killBurst"], desc: "화산 깊은 곳을 헤엄치는 도롱뇽. 쓰러진 적은 용암이 되어 터진다.",
    tint: ["#14060a", "#380a10", "#6e1210", "#ac2410", "#e8501a", "#ff8c2a", "#ffd25a", "#fff4c0"], accent: ["#0e0c10", "#1d1a22", "#2e2a35", "#433e4b", "#5c5664", "#ff6a2a", "#ffae35", "#ffe27a"] },
  { id: "arden", el: "fire", grade: 4, form: "bird", name: "불사조 아르덴", passives: ["atk20", "hp30"], traits: ["rebirth"], crown: true, desc: "천 년마다 재 속에서 다시 태어나는 불새. 꺾이지 않는 의지의 정령.",
    tint: ["#2a0808", "#6a1010", "#b42a14", "#f2601a", "#ffa02a", "#ffd84a", "#fff6a0", "#ffffff"], accent: ["#5a1a08", "#a83a0a", "#f27a1a", "#ffb43a", "#ffe066", "#fff6c4", "#ffffff", "#ffffff"] },
  // water
  { id: "ppogeul", el: "water", grade: 1, form: "fish", name: "뽀글", passives: ["hp15"], desc: "놀라면 몸이 동그랗게 부푸는 복어 정령. 대체로 놀라 있다.",
    tint: ["#081830", "#0e2e5a", "#14508c", "#1c76bc", "#36a2e0", "#78ccf4", "#c4ecff", "#ffffff"], accent: ["#2a1c08", "#5a3e10", "#9a6c18", "#d8a428", "#ffd84a", "#fff09a", "#fffbe6", "#ffffff"] },
  { id: "mongsil", el: "water", grade: 1, form: "cloud", name: "몽실", passives: ["regen"], desc: "기분이 좋으면 비를, 슬프면 더 많은 비를 내리는 구름.",
    tint: ["#1a2030", "#2e3a52", "#4a5a78", "#7488a8", "#a4b8d4", "#d0dcf0", "#eef4ff", "#ffffff"], accent: ["#0e2e5a", "#14508c", "#1c76bc", "#36a2e0", "#78ccf4", "#c4ecff", "#ffffff", "#ffffff"] },
  { id: "rumi", el: "water", grade: 2, form: "jelly", name: "루미", passives: ["freezePlus"], traits: ["slowAura"], desc: "심해에서 은은하게 빛나는 해파리. 곁에 있으면 시간이 느리게 흐른다.",
    tint: ["#140a26", "#2b1252", "#3c3aa0", "#5a6ad8", "#7ca8f0", "#a8d8ff", "#e0f4ff", "#ffffff"], accent: ["#2b1252", "#6b2cc0", "#9a48ec", "#c684ff", "#ecc8ff", "#ffffff", "#ffffff", "#ffffff"] },
  { id: "coral", el: "water", grade: 3, form: "serpent", name: "산호룡 코랄", passives: ["regen", "hp15"], traits: ["dashNova"], desc: "산호초에 사는 어린 해룡. 몸을 틀 때마다 파도가 인다.",
    tint: ["#1a0814", "#3a1028", "#6a1a40", "#a82a5a", "#e8507a", "#ff8aa0", "#ffc8d0", "#ffffff"], accent: ["#082a2a", "#0c4e4e", "#108080", "#18b4b0", "#4ce8d8", "#b4fff0", "#ffffff", "#ffffff"] },
  { id: "celsia", el: "water", grade: 4, form: "crystal", name: "빙결의 여왕 셀시아", passives: ["freezePlus", "atk20"], traits: ["frostShatter"], crown: true, desc: "영원히 녹지 않는 얼음 결정의 여왕. 그녀가 얼린 것은 부서질 뿐이다.",
    tint: ["#0c1430", "#162c5c", "#1f4f94", "#2f7fcc", "#58b4ec", "#9bdcff", "#d8f4ff", "#ffffff"], accent: ["#162c5c", "#2f7fcc", "#9bdcff", "#d8f4ff", "#ffffff", "#ffffff", "#ffffff", "#ffffff"] },
  // wind
  { id: "porong", el: "wind", grade: 1, form: "bird", name: "포롱", passives: ["speed"], desc: "바람만 불면 어디론가 날아가 버리는 깃털새.",
    tint: ["#06181a", "#0c3434", "#13584e", "#1f8a6c", "#36bf8e", "#6fe3b4", "#c2ffe2", "#ffffff"], accent: ["#2a1e14", "#47321e", "#8e6638", "#dcb47c", "#fff0c8", "#ffffff", "#ffffff", "#ffffff"] },
  { id: "hoo", el: "wind", grade: 1, form: "sprout", name: "후", passives: ["cd10"], desc: "민들레 홀씨 정령. 후 불면 사방으로 흩어졌다가 다시 모인다.",
    tint: ["#2a2a1e", "#4a4a34", "#74745a", "#a8a888", "#d0d0b8", "#ececdc", "#fafaf0", "#ffffff"], accent: ["#163418", "#225224", "#357530", "#4f9a3a", "#7cc048", "#b4e070", "#e4ffb0", "#ffffff"] },
  { id: "jjirit", el: "wind", grade: 2, form: "cat", name: "찌릿", passives: ["crit10"], traits: ["critChain"], desc: "털을 쓰다듬으면 정전기가 튀는 번개 고양이. 쓰다듬어 달라고 조른다.",
    tint: ["#16120a", "#3e300c", "#7a5c10", "#c49218", "#f0c83a", "#fff08a", "#fffbe0", "#ffffff"], accent: ["#0a1a2e", "#123a66", "#1a68a0", "#28a0c8", "#4cd8e0", "#a4fff4", "#ffffff", "#ffffff"] },
  { id: "orbit", el: "wind", grade: 3, form: "owl", name: "폭풍 부엉이 오르빗", passives: ["cd10", "crit10"], traits: ["orbitStar"], desc: "폭풍의 눈에서 사는 부엉이. 별 두 개가 그 주위를 맴돈다.",
    tint: ["#0a1020", "#162040", "#243a6a", "#365a94", "#5484c0", "#8ab4e0", "#cce4ff", "#ffffff"], accent: ["#0a1a2e", "#123a66", "#28a0c8", "#4cd8e0", "#a4fff4", "#ffffff", "#ffffff", "#ffffff"] },
  { id: "nova", el: "wind", grade: 4, form: "fish", name: "하늘고래 노바", passives: ["speed", "hp30"], traits: ["dashNova"], crown: true, desc: "구름 바다를 헤엄치는 거대한 고래. 노래하면 하늘에 파도가 친다.",
    tint: ["#0e0a26", "#241452", "#3e2490", "#5c48d0", "#7c8cff", "#a4d0ff", "#e0f4ff", "#ffffff"], accent: ["#3a2a10", "#7a5a20", "#c4a040", "#ffe08a", "#fff6c4", "#ffffff", "#ffffff", "#ffffff"] },
  // earth
  { id: "songi", el: "earth", grade: 1, form: "mushroom", name: "송이", passives: ["hp15"], traits: ["sporeCloud"], desc: "비 온 뒤 숲에서 툭 튀어나온 버섯 정령. 포자가 좀 맵다.",
    tint: ["#2a1e14", "#47321e", "#69492a", "#b88a52", "#dcb47c", "#f0d8a8", "#fff4dc", "#ffffff"], accent: ["#3a0a14", "#6a101c", "#a01824", "#d42a30", "#ff5a50", "#ff9a8a", "#ffd0c8", "#ffffff"] },
  { id: "pareut", el: "earth", grade: 1, form: "sprout", name: "파릇", passives: ["regen"], traits: ["bloom"], desc: "흙 속에서 막 고개를 내민 새싹. 햇볕을 쬐면 키가 조금 자란다.",
    tint: ["#1c1610", "#33281c", "#4f3f2c", "#6e5a40", "#927a58", "#b89f78", "#dcc8a2", "#fff0d8"], accent: ["#0c1a0e", "#163418", "#225224", "#357530", "#4f9a3a", "#7cc048", "#b4e070", "#e4ffb0"] },
  { id: "jangsu", el: "earth", grade: 2, form: "beetle", name: "장수", passives: ["guard"], traits: ["thorns"], desc: "자기 몸보다 백 배 무거운 바위도 드는 장수풍뎅이. 건드리면 아프다.",
    tint: ["#0e0a08", "#1e1410", "#34241a", "#4e3626", "#6e4e36", "#94704e", "#bc9a70", "#e0c49a"], accent: ["#2a1608", "#5a3010", "#8a4a14", "#b46a1e", "#e09a3a", "#ffc86a", "#fff0b0", "#ffffff"] },
  { id: "amethy", el: "earth", grade: 3, form: "crystal", name: "수정골렘 아메티", passives: ["guard", "hp30"], traits: ["killShield"], desc: "동굴 깊은 곳 자수정이 뭉쳐 태어났다. 단단하고, 의외로 다정하다.",
    tint: ["#140a26", "#2b1252", "#481c88", "#6b2cc0", "#9a48ec", "#c684ff", "#ecc8ff", "#ffffff"], accent: ["#2b1252", "#6b2cc0", "#c684ff", "#ecc8ff", "#ffffff", "#ffffff", "#ffffff", "#ffffff"] },
  { id: "yggd", el: "earth", grade: 4, form: "sprout", name: "세계수 이그드", passives: ["hp30", "regen"], traits: ["bloom", "thorns"], crown: true, desc: "모든 숲의 뿌리가 이어진 세계수의 어린 정령. 그 곁에서는 상처가 꽃이 된다.",
    tint: ["#160c06", "#2e1a0c", "#4a2c14", "#6a421e", "#8e5c2c", "#b47c40", "#d8a464", "#f4d4a0"], accent: ["#0c1a0e", "#225224", "#4f9a3a", "#7cc048", "#b4e070", "#e4ffb0", "#ffffff", "#ffffff"] },
  // light
  { id: "lulu", el: "light", grade: 2, form: "star", name: "반짝별 루루", passives: ["crit10"], desc: "밤하늘에서 떨어진 별똥별. 소원을 들어주는 법은 아직 배우는 중.",
    tint: ["#2a1c08", "#5a3e10", "#9a6c18", "#d8a428", "#ffd84a", "#fff09a", "#fffbe6", "#ffffff"] },
  { id: "ella", el: "light", grade: 2, form: "butterfly", name: "빛나비 엘라", passives: ["regen"], desc: "새벽빛을 날개에 담은 나비. 날갯짓에서 따뜻한 가루가 흩날린다.",
    tint: ["#2a1c08", "#5a3e10", "#9a6c18", "#d8a428", "#ffd84a", "#fff09a", "#fffbe6", "#ffffff"], accent: ["#3a1028", "#7a2050", "#c44a80", "#ff8ab0", "#ffc8dc", "#fff0f6", "#ffffff", "#ffffff"] },
  { id: "egil", el: "light", grade: 3, form: "lantern", name: "성배기사 에길", passives: ["guard", "atk10"], traits: ["holyBurst"], desc: "성스러운 등불을 지키던 기사의 혼. 싸울 때마다 축복이 울려 퍼진다.",
    tint: ["#1e1406", "#4a3410", "#86641c", "#c49a2a", "#f0c840", "#ffe88a", "#fff8d0", "#ffffff"], accent: ["#2c2c38", "#42424f", "#5c5c6b", "#7d7d8c", "#a4a4b2", "#d0d0da", "#ffffff", "#ffffff"] },
  { id: "sera", el: "light", grade: 3, form: "bird", name: "천사새 세라", passives: ["regen", "hp15"], traits: ["killShield"], desc: "하늘 정원의 문지기 새. 날개 아래에 있는 자를 끝까지 지킨다.",
    tint: ["#3a3448", "#6a6480", "#a8a2bc", "#d8d2e8", "#f4f0ff", "#ffffff", "#ffffff", "#ffffff"], accent: ["#5a3e10", "#9a6c18", "#d8a428", "#ffd84a", "#fff09a", "#fffbe6", "#ffffff", "#ffffff"] },
  { id: "solaris", el: "light", grade: 4, form: "star", name: "태양신 솔라리스", passives: ["atk20", "crit10"], traits: ["critChain", "holyBurst"], crown: true, desc: "한낮의 태양 그 자체. 그 빛 앞에서는 어떤 그림자도 숨을 곳이 없다.",
    tint: ["#3a0e04", "#7a2a08", "#c45a10", "#f29a1a", "#ffd23a", "#fff08a", "#fffbe0", "#ffffff"] },
  { id: "lumiel", el: "light", grade: 4, form: "butterfly", name: "빛의 루미엘", passives: ["regen", "cd20"], traits: ["holyBurst"], crown: true, desc: "첫 새벽에 태어난 빛의 정령. 날개를 펴면 밤이 물러난다.",
    tint: ["#2a2418", "#5a5030", "#9a8a50", "#d8c47c", "#fff0b0", "#fffbe6", "#ffffff", "#ffffff"], accent: ["#2a1c08", "#9a6c18", "#ffd84a", "#fff09a", "#ffffff", "#ffffff", "#ffffff", "#ffffff"] },
  // dark
  { id: "bati", el: "dark", grade: 2, form: "bat", name: "바티", passives: ["speed"], traits: ["vamp"], desc: "거꾸로 매달려 자는 꼬마 박쥐. 피 대신 체리 주스를 좋아한다(고 주장한다).",
    tint: ["#050308", "#140c22", "#261540", "#3a1f62", "#58308c", "#8048b8", "#b884ff", "#f0dcff"], accent: ["#14040a", "#3a0a14", "#6a101c", "#a01824", "#d42a30", "#ff5a50", "#ff9a8a", "#ffd0c8"] },
  { id: "noir", el: "dark", grade: 2, form: "cat", name: "누아", passives: ["crit10"], desc: "그림자에서 그림자로 건너다니는 검은 고양이. 눈빛만 보인다.",
    tint: ["#020204", "#08080e", "#121220", "#1e1e32", "#2c2c48", "#40405e", "#5a5a7e", "#8080a8"], accent: ["#050308", "#140c22", "#261540", "#3a1f62", "#58308c", "#8048b8", "#b884ff", "#f0dcff"] },
  { id: "obsi", el: "dark", grade: 3, form: "eye", name: "외눈 감시자 옵시", passives: ["crit10", "atk10"], traits: ["execute10"], desc: "심연에서 모든 것을 지켜보는 눈. 그 시선을 받은 약한 것은 사라진다.",
    tint: ["#050308", "#140c22", "#261540", "#3a1f62", "#58308c", "#8048b8", "#b884ff", "#f0dcff"], accent: ["#140c22", "#3a1f62", "#8048b8", "#b884ff", "#f0dcff", "#ffffff", "#ffffff", "#ffffff"] },
  { id: "soul", el: "dark", grade: 3, form: "lantern", name: "혼불 등지기 소울", passives: ["atk10", "cd10"], traits: ["soulWisp"], desc: "길 잃은 혼을 등불에 담아 다니는 정령. 혼들은 그를 위해 싸운다.",
    tint: ["#020a06", "#06200e", "#0a3c1c", "#106630", "#1a9a4c", "#3cd67a", "#a4ffc8", "#e8fff0"], accent: ["#0e0c10", "#1d1a22", "#2e2a35", "#433e4b", "#5c5664", "#7b7484", "#a39cab", "#d0c8d8"] },
  { id: "nox", el: "dark", grade: 4, form: "bat", name: "어둠의 녹스", passives: ["atk20", "crit10"], traits: ["vamp", "execute10"], crown: true, desc: "밤의 군주가 남긴 그림자. 피와 어둠으로 맺은 계약은 결코 깨지지 않는다.",
    tint: ["#050106", "#140414", "#2c0a28", "#4a1240", "#741e5c", "#a83280", "#e060b0", "#ffc0e8"], accent: ["#050308", "#140c22", "#261540", "#3a1f62", "#58308c", "#8048b8", "#b884ff", "#f0dcff"] },
  { id: "luna", el: "dark", grade: 4, form: "fox", name: "달의 여우 루나", passives: ["cd20", "crit10"], traits: ["soulWisp", "critChain"], crown: true, desc: "보름달이 뜨는 밤에만 모습을 드러내는 은빛 여우. 꼬리 수만큼 혼을 거느린다.",
    tint: ["#0e0c1c", "#1e1c36", "#34325a", "#504e84", "#7a78b0", "#aaa8d8", "#dcdcf8", "#ffffff"], accent: ["#261540", "#58308c", "#8048b8", "#b884ff", "#e0d0ff", "#ffffff", "#ffffff", "#ffffff"] },
  // ★ developer — granted only to the "dev" account, never summoned
  { id: "sudo", el: "code", grade: 5, name: "관리자 정령 SUDO", passives: ["root"], dev: true, crown: true, desc: "루트 권한을 가진 코드의 정령. 세상의 소스 코드를 읽고, 마음대로 고쳐 쓴다." },
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
  const cb = careBonus(sp);
  s.hp *= cb.hp; s.atk *= cb.atk; s.crit += cb.crit; s.critDmg += cb.critDmg;
  s.hp = Math.round(s.hp);
  return s;
}
