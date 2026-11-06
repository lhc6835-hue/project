// What each spirit looks like: which beast it is (kind) and how it is built (q), plus optional colours.
// R: main body ramp (dark → bright), A: horns, shells, crystals, beaks; F: flames, glows and eye rims.
// Spirits with no R take their roster tint or their element's colours.

const GOLD = ["#3a2408", "#6a4410", "#a46e18", "#d8a428", "#ffd84a", "#ffec8a", "#fff8d0", "#ffffff"];
const BONE = ["#1c1814", "#3a3228", "#5c5244", "#86796a", "#b0a492", "#d4cab8", "#efe8da", "#ffffff"];
const STONE = ["#121014", "#24202a", "#3a3542", "#56505e", "#7a7484", "#a29cac", "#cdc8d6", "#ffffff"];
const ICE = ["#0a1830", "#14345c", "#205a8c", "#3a8cc0", "#6ac0e8", "#a8e4ff", "#e0f8ff", "#ffffff"];
const BOLT = ["#1a1406", "#3e300c", "#7a5c10", "#c49218", "#f0c83a", "#fff08a", "#fffbe0", "#ffffff"];
const EMBER = ["#1a0604", "#4a0e08", "#8a1e0c", "#d43c12", "#ff7a1e", "#ffb83a", "#fff07a", "#ffffff"];
const CORAL = ["#2a0a18", "#5a1430", "#9a2a4a", "#d8506a", "#ff8a8a", "#ffbcb0", "#ffe6dc", "#ffffff"];
const LEAF = ["#0a1a0c", "#163a18", "#26602a", "#3e8a34", "#66b444", "#a0d860", "#d8f4a0", "#ffffff"];
const ROSE = ["#2a0a20", "#5a1440", "#9a2a68", "#d850a0", "#ff8ac8", "#ffbce0", "#ffe6f4", "#ffffff"];
const MUSH = ["#2a0806", "#5a120c", "#9a2216", "#d83a24", "#ff6a4a", "#ffa088", "#ffdccc", "#ffffff"];
const AMETHYST = ["#1a0c30", "#341a5a", "#563090", "#7c4cc4", "#a878ec", "#ccaaff", "#ecdcff", "#ffffff"];
const MOON = ["#0e0c1c", "#1e1c36", "#34325a", "#504e84", "#7a78b0", "#aaa8d8", "#dcdcf8", "#ffffff"];
const VIOLET = ["#0c0618", "#1c0e34", "#341a5c", "#56308c", "#8048b8", "#b07ae0", "#e0c4ff", "#ffffff"];
const SHADOWFLAME = ["#0a0414", "#22083a", "#4a1070", "#7a1eaa", "#b03ee0", "#d884ff", "#f4d0ff", "#ffffff"];
const SKY = ["#0a1430", "#16305c", "#28528c", "#4280c0", "#6ab0e8", "#a4d8ff", "#e0f4ff", "#ffffff"];

export const LOOKS = {
  // ---------------------------------------------------------------- base and starters
  ember:  { kind: "quad", q: { head: "drake", ears: "fin", tail: "flame", mane: "flame", horns: "spikes", back: "flamespine", mark: "spiral", snout: 1.1, leg: 0.85 }, A: BONE },
  drop:   { kind: "dragon", q: { horns: null, mane: "fin", whiskers: false, fins: true }, eye: "#e0f8ff" },
  breeze: { kind: "bird", q: { wings: "feather", plumes: [0, 2, 2, 3], plumeMat: "feather", crest: true } },
  pebble: { kind: "turtle", size: 1.1, q: {}, A: STONE },
  sala:   { kind: "quad", q: { head: "drake", ears: "fin", tail: "flame", mane: "flame", horns: "spikes", back: "flamespine", wings: "flame", mark: "spiral", len: 1.1, leg: 0.9, snout: 1.15 }, A: BONE, eye: "#fff6c0" },
  undi:   { kind: "dragon", q: { horns: "antler", mane: "fin", whiskers: true, fins: true }, A: ICE, eye: "#e8fbff" },
  sylphi: { kind: "quad", q: { head: "fox", ears: "fox", tail: "ribbon", tails: [0, 2, 3, 4], mane: "ruff", mark: "spiral", horns: "antler", hornStage: 3, paws: "flame", snout: 1.1 }, eye: "#f0fff8" },
  nomi:   { kind: "turtle", size: 1.1, q: { crystal: true, moss: true, tree: true, horns: "spikes" }, A: ["#1a2a10", "#2a4a18", "#3e6a24", "#5a9030", "#86b840", "#b8dc68", "#e8f8b0", "#ffffff"] },
  crimson: { kind: "quad", q: { head: "fox", ears: "fox", tail: "fox", tails: [0, 1, 2, 3], mane: "ruff", mark: "lotus", snout: 1.2, paws: "flame", horns: "crystal", hornStage: 3 }, A: ROSE, eye: "#ffe0e8" },
  glacier: { kind: "quad", q: { head: "fox", ears: "wolf", tail: "fox", tails: [0, 1, 1, 1], fluff: 1.2, mane: "frost", back: "crystal", mark: "rune", snout: 1.3, paws: "flame" }, A: ICE, eye: "#e0f8ff" },
  thunder: { kind: "quad", q: { head: "lion", ears: "cat", tail: "thin", mane: "flame", mark: "bolt", paws: "flame", snout: 0.9, back: "spikes", horns: "spikes" }, A: BONE, F: BOLT, eye: "#fffbe0" },
  bastion: { kind: "quad", q: { head: "lion", ears: "lion", tail: "lion", mane: "rock", horns: "single", mark: "rune", paws: "flame", leg: 1.05, len: 1.1 }, A: STONE, F: ["#0e0a1c", "#1e1640", "#2e2470", "#4a3aa8", "#6a5ad8", "#9a8cff", "#d0c8ff", "#ffffff"], eye: "#d0c8ff" },
  agni:   { kind: "quad", q: { head: "lion", ears: "lion", tail: "flame", mane: "flame", horns: "single", mark: "spiral", back: "flamespine", paws: "flame", leg: 1.05 }, A: GOLD, eye: "#fff6c0" },
  levia:  { kind: "dragon", q: { horns: "curl", mane: "fin", whiskers: true, fins: true }, A: ["#04101e", "#082a3e", "#0c4e60", "#107e88", "#18b4b0", "#4ce8d8", "#b4fff0", "#ffffff"], eye: "#b4fff0" },
  tempest: { kind: "dragon", q: { horns: "antler", mane: "flame", whiskers: true }, A: ICE, eye: "#e0f4ff" },
  gaia:   { kind: "quad", q: { head: "fox", ears: "deer", tail: "lion", mane: "ruff", horns: "branch", hornStage: 1, back: "flowers", paws: "hoof", leg: 1.15, neck: 1.3, mark: "spiral", snout: 1.2 }, A: LEAF, eye: "#fff6c0" },

  // ---------------------------------------------------------------- fire
  chirp:  { kind: "bird", q: { wings: "flame", plumes: [0, 1, 2, 3], plumeMat: "flame", crest: true }, A: GOLD },
  hongmi: { kind: "quad", q: { head: "fox", ears: "fox", tail: "fox", tails: [0, 1, 2, 3], mane: "none", mark: "spiral", snout: 1.2, paws: "flame" }, A: EMBER, eye: "#fff6c0" },
  bandi:  { kind: "moth", size: 1.6, q: { firefly: true }, A: BONE, F: ["#3a1a04", "#6a3408", "#a45a10", "#e08a1a", "#ffb83a", "#ffe07a", "#fff8c8", "#ffffff"] },
  magma:  { kind: "quad", q: { head: "drake", ears: "fin", tail: "flame", mane: "rock", back: "spikes", mark: "crack", leg: 0.8, len: 1.2, snout: 1.2, paws: "flame" }, R: ["#0c0404", "#2a0a06", "#4a120a", "#7a1e0c", "#c43a12", "#ff7a1e", "#ffc04a", "#fff6c0"], A: ["#0a0808", "#1c1614", "#2e2622", "#463a32", "#62524a", "#86766c", "#b0a092", "#e0d4c8"], mark: "#ffd84a" },
  arden:  { kind: "bird", q: { wings: "flame", plumes: [0, 2, 3, 5], plumeMat: "feather", crest: true }, A: GOLD, eye: "#fff6c0" },

  // ---------------------------------------------------------------- water
  ppogeul: { kind: "whale", size: 1.45, q: { puffer: true }, A: BONE },
  mongsil: { kind: "quad", q: { head: "lion", ears: "deer", tail: "stub", mane: "cloud", wool: true, horns: "curl", hornStage: 2, paws: "flame", mark: null, snout: 0.8, leg: 0.7 }, R: SKY, A: ["#2a2a3a", "#44445c", "#666684", "#9090b0", "#b8b8d8", "#dcdcf4", "#f4f4ff", "#ffffff"] },
  rumi:   { kind: "jelly", size: 1.2, R: ["#100a2a", "#201650", "#36248a", "#5440c0", "#7c6ae8", "#aaa0ff", "#dcd8ff", "#ffffff"], F: ["#0a1a3a", "#103060", "#1a5a9a", "#2a8ad0", "#5ac0f0", "#9ae4ff", "#d8f8ff", "#ffffff"] },
  coral:  { kind: "dragon", q: { horns: "antler", mane: "fin", whiskers: true, fins: true }, A: CORAL, mark: "#ffe6dc", eye: "#ffe6dc" },
  celsia: { kind: "bird", q: { neck: 1, wings: "ice", plumes: [0, 2, 3, 4], plumeMat: "feather", crest: true, halo: true }, R: ICE, A: ICE, eye: "#e0f8ff" },

  // ---------------------------------------------------------------- wind
  porong: { kind: "bird", q: { wings: "feather", plumes: [0, 1, 2, 3], plumeMat: "feather", crest: true } },
  hoo:    { kind: "puff", size: 1.15, A: BONE },
  jjirit: { kind: "quad", q: { head: "lion", ears: "cat", tail: "thin", mane: "none", mark: "bolt", snout: 0.75, hs: 1.08, leg: 0.85, paws: "flame" }, F: BOLT, eye: "#fffbe0" },
  orbit:  { kind: "owl", size: 1.25, F: BOLT, eye: "#fffbe0" },
  nova:   { kind: "whale", R: SKY, eye: "#e0f4ff" },

  // ---------------------------------------------------------------- earth
  songi:  { kind: "quad", mark: "#fff6e8", q: { head: "boar", ears: "cat", tail: "stub", mane: "none", back: "caps", leg: 0.7, snout: 1.2, mark: "dots", paws: "hoof" }, A: MUSH },
  pareut: { kind: "quad", q: { head: "fox", ears: "deer", tail: "stub", mane: "none", back: "flowers", horns: "branch", hornStage: 2, paws: "hoof", leg: 1.1, neck: 1.2, mark: "dots", snout: 1.1 }, R: LEAF, A: ROSE },
  jangsu: { kind: "beetle", size: 1.15, R: ["#0a0e14", "#141e2c", "#1e3048", "#2a4a6c", "#3a6a94", "#5a96c0", "#9ac8e8", "#e8f8ff"], A: GOLD, mark: "#ffd84a" },
  amethy: { kind: "quad", q: { head: "lion", ears: "none", tail: "stub", mane: "frost", back: "crystal", mark: "rune", len: 1.1, leg: 1.05, snout: 0.9, paws: "flame", horns: "crystal" }, R: STONE, A: AMETHYST, F: AMETHYST, eye: "#ecdcff" },
  yggd:   { kind: "quad", q: { head: "fox", ears: "deer", tail: "stub", mane: "ruff", horns: "branch", hornStage: 1, back: "flowers", paws: "hoof", leg: 1.2, neck: 1.35, mark: "spiral", snout: 1.15 }, R: LEAF, A: ["#1c1408", "#3a2a10", "#5c441c", "#86662c", "#b08c44", "#d8b86a", "#f4e0a0", "#ffffff"], F: GOLD, eye: "#fff6c0" },

  // ---------------------------------------------------------------- light
  lulu:   { kind: "star", size: 1.4, R: GOLD },
  ella:   { kind: "moth", size: 1.3, q: { tails: false }, A: GOLD },
  egil:   { kind: "wraith", size: 1.4, q: { knight: true, lantern: false }, R: ["#0c1024", "#1a2244", "#2c3a6c", "#46609a", "#6c90c8", "#a4c4ec", "#dcecff", "#ffffff"], A: GOLD, F: GOLD, eye: "#fff6c0" },
  sera:   { kind: "bird", q: { wings: "feather", wings2: true, plumes: [0, 2, 3, 4], plumeMat: "feather", crest: true, halo: true }, A: GOLD },
  solaris: { kind: "quad", q: { head: "lion", ears: "lion", tail: "lion", mane: "rays", horns: "single", wings: "flame", mark: "spiral", paws: "flame" }, R: GOLD, A: GOLD, F: EMBER, eye: "#ffffff" },
  lumiel: { kind: "moth", size: 1.3, q: { tails: true }, R: ["#1a1030", "#3a2460", "#6a48a0", "#a07ad0", "#d0a8f0", "#f0d4ff", "#fff0ff", "#ffffff"], A: GOLD, F: GOLD },

  // ---------------------------------------------------------------- dark
  bati:   { kind: "bat", size: 1.45, eye: "#ff6a8a", eyeRim: "#ff3a6a" },
  noir:   { kind: "quad", q: { head: "lion", ears: "cat", tail: "fox", tails: [0, 1, 2, 2], fluff: 0.7, mane: "none", mark: "spiral", snout: 0.8, paws: "flame" }, R: VIOLET, F: SHADOWFLAME, eye: "#fff08a", eyeRim: "#ffd84a" },
  obsi:   { kind: "watcher", size: 1.3, F: ["#2a0606", "#5a0a10", "#9a1420", "#d8283a", "#ff5a5a", "#ff9a8a", "#ffd8cc", "#ffffff"] },
  soul:   { kind: "wraith", size: 1.35, q: { knight: false, lantern: true }, F: ["#04201a", "#0a3a30", "#126050", "#1e9078", "#36c4a0", "#7ef0cc", "#ccfff0", "#ffffff"], eye: "#ccfff0", eyeRim: "#36c4a0" },
  nox:    { kind: "bat", q: { wyvern: true }, F: SHADOWFLAME, eye: "#ff6a8a", eyeRim: "#ff3a6a" },
  luna:   { kind: "quad", q: { head: "fox", ears: "fox", tail: "fox", tails: [0, 3, 5, 9], mane: "ruff", mark: "spiral", paws: "flame", snout: 1.2, horns: "crystal", hornStage: 3 }, R: MOON, F: ["#1a1438", "#2e2468", "#4a3aa0", "#7060d0", "#a090f0", "#d0c4ff", "#fff6d8", "#ffffff"], eye: "#fff6c0", eyeRim: "#ffd84a" },

  // ---------------------------------------------------------------- developer
  sudo:   { kind: "dragon", q: { horns: "antler", mane: "crystal", whiskers: true, wire: true } },
};
