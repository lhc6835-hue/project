// Persistent progress in localStorage (with an in-memory fallback when storage is blocked).
// Each account keeps its own local copy; logged-in saves are also pushed to the server.
import { auth } from "./auth.js";
import { SPIRIT } from "../data/spirits.js";
const BASE_KEY = "aether-heart-save-v1";
let KEY = BASE_KEY;
let mem = null;

/** Switch which local slot we read/write: the guest slot, or one per account. */
export function useSlot(accountId) { KEY = accountId ? BASE_KEY + ":" + accountId : BASE_KEY; mem = null; }

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
    settings: { autoAttack: true, shake: 1, mute: false, fullscreen: true },
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
  auth.push(s);
}

/** Developer spirits belong to the dev account only: grant it there, strip it everywhere else. */
export function applyAccount(s, account) {
  const isDev = !!account?.isDev;
  const devIds = Object.values(SPIRIT).filter((d) => d.dev).map((d) => d.id);
  let granted = null;
  if (isDev) {
    for (const id of devIds) if (!s.spirits.some((x) => x.id === id)) {
      const sp = { uid: s.uidN++, id, lv: 45, stage: 3, dupes: 3 };
      s.spirits.push(sp); granted = sp;
      if (!s.started) { s.started = true; s.active = sp.uid; }
    }
    // every other spirit too, fully grown, so each one can be tried out (stages can be switched in the garden)
    for (const d of Object.values(SPIRIT)) if (!d.dev && !s.spirits.some((x) => x.id === d.id))
      s.spirits.push({ uid: s.uidN++, id: d.id, lv: 45, stage: 3, dupes: 0 });
  } else {
    const gone = s.spirits.filter((x) => devIds.includes(x.id)).map((x) => x.uid);
    if (gone.length) {
      s.spirits = s.spirits.filter((x) => !gone.includes(x.uid));
      if (gone.includes(s.active)) s.active = s.spirits[0]?.uid ?? null;
      if (gone.includes(s.sub)) s.sub = null;
      if (!s.spirits.length) s.started = false;
    }
  }
  return granted;
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
