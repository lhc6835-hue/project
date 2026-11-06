// The four base elements (plus light/dark for legendary spirits): names, colors, effect ramps, affinity.
import { PAL } from "../px.js";

export const ELEMENTS = {
  fire: {
    id: "fire", name: "불", css: "#ff8a2a", beats: "wind",
    ramp: PAL.fire,                                   // main effect ramp, dark → bright
    glow: ["#ff8a2a", "#ffd166"],
    body: ["#4a1118", "#8c1d1c", "#cc3a1a", "#f2701f", "#ffd27a"],
    floor: { name: "붉은 동굴", base: ["#1a0d10", "#24121a", "#2f1820", "#3d1f24"], accent: "#ff6a2a" },
  },
  water: {
    id: "water", name: "물", css: "#58b4ec", beats: "fire",
    ramp: PAL.water,
    ice: PAL.ice,
    glow: ["#58b4ec", "#c4ecff"],
    body: ["#0e2e5a", "#14508c", "#1c76bc", "#58b4ec", "#c4ecff"],
    floor: { name: "빙결 수로", base: ["#0a1220", "#0f1a2e", "#14223a", "#1a2c48"], accent: "#58b4ec" },
  },
  wind: {
    id: "wind", name: "바람", css: "#6fe3b4", beats: "earth",
    ramp: ["#06181a", "#0c3434", "#13584e", "#1f8a6c", "#36bf8e", "#6fe3b4", "#c2ffe2", "#ffffff"],
    storm: ["#0a1a2e", "#123a66", "#1a68a0", "#28a0c8", "#4cd8e0", "#a4fff4", "#ffffff", "#ffffff"],
    glow: ["#6fe3b4", "#c2ffe2"],
    body: ["#0c3434", "#13584e", "#1f8a6c", "#6fe3b4", "#d8fff0"],
    floor: { name: "폭풍 첨탑", base: ["#0c1418", "#111c20", "#16252a", "#1d3036"], accent: "#6fe3b4" },
  },
  earth: {
    id: "earth", name: "땅", css: "#d39a52", beats: "water",
    ramp: ["#140e0a", "#2a1e14", "#47321e", "#69492a", "#8e6638", "#b88a52", "#e0b878", "#fff0c8"],
    stone: PAL.stone,
    glow: ["#ffb84a", "#ffe08a"],
    body: ["#2a1e14", "#47321e", "#69492a", "#b88a52", "#ffe08a"],
    floor: { name: "수정 광산", base: ["#14100e", "#1c1612", "#251d17", "#30261d"], accent: "#e8b05a" },
  },
  light: {
    id: "light", name: "빛", css: "#fff09a", beats: "dark",
    ramp: PAL.holy, glow: ["#ffd84a", "#fffbe6"],
    body: ["#5a3e10", "#9a6c18", "#d8a428", "#ffd84a", "#fffbe6"],
  },
  code: {
    id: "code", name: "코드", css: "#3cd650", beats: null,
    ramp: ["#020a04", "#05200c", "#0a3c16", "#106624", "#1a9a34", "#3cd650", "#a4ffa8", "#e8ffe8"],
    glow: ["#3cd650", "#a4ffa8"],
    body: ["#05200c", "#0a3c16", "#106624", "#3cd650", "#c8ffc8"],
  },
  dark: {
    id: "dark", name: "어둠", css: "#a970e0", beats: "light",
    ramp: ["#050308", "#140c22", "#261540", "#3a1f62", "#58308c", "#8048b8", "#b884ff", "#f0dcff"],
    glow: ["#8048b8", "#d0a8ff"],
    body: ["#140c22", "#261540", "#3a1f62", "#8048b8", "#e0c8ff"],
  },
};

export const BASE_ELEMENTS = ["fire", "water", "wind", "earth"];

/** Affinity multiplier for an attack of element a on a target of element b. */
export function affinity(a, b) {
  if (!a || !b) return 1;
  if (ELEMENTS[a]?.beats === b) return 1.3;
  if (ELEMENTS[b]?.beats === a) return 0.8;
  return 1;
}

export const STAGES = [
  { id: 1, name: "새싹", en: "SPROUT" },
  { id: 2, name: "성체", en: "ADULT" },
  { id: 3, name: "각성", en: "AWAKENED" },
];

/** Effect intensity per stage: glow strength and how much extra flourish to layer on. */
export const STAGE_FX = { 1: { light: 0.55, extra: 0 }, 2: { light: 0.8, extra: 1 }, 3: { light: 1.1, extra: 2 } };
