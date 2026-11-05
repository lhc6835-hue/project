// Persistent progress in localStorage (with an in-memory fallback when storage is blocked).
const KEY = "aether-heart-save-v1";
let mem = null;

export function fresh() {
  return {
    v: 1, started: false, uidN: 1,
    spirits: [],                 // { uid, id, lv, stage, dupes }
    active: null, sub: null,     // uids
    res: { essence: 0, evo: 0, awake: 0, gems: 0, shards: 0 },
    garden: { tree: 1, dojo: 1, altar: 0 },
    treeStock: 0, lastSeen: Date.now(),
    gacha: { unlocked: false, pity: 0, total: 0, freeTen: false },
    best: 0, depth: 1, depthMax: 1, runs: 0, bossKills: { golem: 0, void: 0 },
    settings: { autoAttack: true, shake: 1, mute: false },
    seen: {},
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch { /* private mode etc. */ }
  return mem ?? fresh();
}

export function save(s) {
  s.lastSeen = Date.now();
  mem = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* keep going in memory */ }
}

export function wipe() { try { localStorage.removeItem(KEY); } catch {} mem = null; return fresh(); }

export function addSpirit(s, id) {
  const sp = { uid: s.uidN++, id, lv: 1, stage: 1, dupes: 0 };
  s.spirits.push(sp);
  return sp;
}
export const spiritByUid = (s, uid) => s.spirits.find((x) => x.uid === uid);

export function exportCode(s) { return btoa(unescape(encodeURIComponent(JSON.stringify(s)))); }
export function importCode(code) { return { ...fresh(), ...JSON.parse(decodeURIComponent(escape(atob(code.trim())))) }; }
