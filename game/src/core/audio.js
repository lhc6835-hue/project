// Sound: recorded effects and looping music (CC0 packs, see assets/audio/CREDITS.md), with small synthesized
// sounds as a fallback while samples load. Silent until the first user gesture unlocks audio.
let ctx = null, master = null, sfxBus = null, synthBus = null, musicBus = null, muted = false, musicOff = false;
const last = {};
const BASE = "assets/audio/";
const MASTER = 0.9, MUSIC = 0.42;

export function unlockAudio() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : MASTER; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    synthBus = ctx.createGain(); synthBus.gain.value = 0.36; synthBus.connect(sfxBus);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOff ? 0 : MUSIC; musicBus.connect(master);
  } catch { ctx = null; return; }
  preloadSamples();
  if (wantTrack) { const n = wantTrack; wantTrack = null; music(n); }
  // phones: stop the sound while the game is in the background
  document.addEventListener("visibilitychange", () => { if (!ctx) return; document.hidden ? ctx.suspend() : ctx.resume(); });
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : MASTER; }
export const isMuted = () => muted;
export function setMusicOff(m) { musicOff = m; if (musicBus) musicBus.gain.setTargetAtTime(m ? 0 : MUSIC, ctx.currentTime, 0.1); }

// ---- samples -------------------------------------------------------------------------------------------
// name → [files, volume, pitch jitter]; several files are picked at random so repeats don't sound canned
const SAMPLES = {
  hit: [["hit0", "hit1", "hit2", "hit3"], 0.55, 0.08], crit: [["crit0", "crit1", "crit2"], 0.75, 0.05],
  hurt: [["hurt0", "hurt1"], 0.7, 0.06], boom: [["boom0", "boom1", "boom2"], 0.65, 0.06],
  zap: [["zap0", "zap1"], 0.35, 0.08], water: [["water0", "water1"], 0.45, 0.1], swing: [["slice0", "slice1"], 0.32, 0.12],
  pick: [["pick0", "pick1"], 0.35, 0.04], ui: [["ui0", "ui1"], 0.4, 0.03], ok: [["ok0"], 0.45, 0],
  level: [["level0"], 0.45, 0], absorb: [["absorb0"], 0.5, 0], summon: [["summon0"], 0.45, 0],
  legend: [["j_treasure"], 0.55, 0], die: [["die0"], 0.5, 0], door: [["door0"], 0.5, 0.05], quake: [["quake0"], 0.6, 0.05],
  bossIntro: [["j_boss_appears"], 0.55, 0], victory: [["j_victory"], 0.55, 0], gameover: [["j_game_over"], 0.55, 0], start: [["j_level_start"], 0.45, 0],
};
// recorded sounds that still get a bit of synth on top for punch
const LAYER = { swing: true, dash: true, absorb: true };
const buffers = {};
function loadBuf(path) {
  if (buffers[path] !== undefined) return buffers[path];
  buffers[path] = null;
  return (buffers[path] = fetch(BASE + path).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((a) => new Promise((ok, no) => ctx.decodeAudioData(a, ok, no))).then((b) => (buffers[path] = b)).catch(() => (buffers[path] = false)));
}
function preloadSamples() { for (const [files] of Object.values(SAMPLES)) for (const f of files) loadBuf("sfx/" + f + ".mp3"); }
function playSample(name) {
  const S = SAMPLES[name]; if (!S) return false;
  const [files, vol, jit] = S, b = buffers["sfx/" + files[Math.floor(Math.random() * files.length)] + ".mp3"];
  if (!(b instanceof AudioBuffer)) return false;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = b; src.playbackRate.value = 1 + (Math.random() * 2 - 1) * jit; g.gain.value = vol;
  src.connect(g).connect(sfxBus); src.start();
  return true;
}

// ---- music ---------------------------------------------------------------------------------------------
let wantTrack = null, curTrack = null, curNode = null;
/** Crossfade to a looping track (null = silence). Safe to call every frame with the same name. */
export function music(name) {
  if (!ctx) { wantTrack = name; return; }
  if (name === curTrack) return;
  curTrack = name;
  const old = curNode; curNode = null;
  if (old) { old.g.gain.setTargetAtTime(0, ctx.currentTime, 0.25); old.src.stop(ctx.currentTime + 1.5); }
  if (!name) return;
  const p = loadBuf("music/" + name + ".mp3");
  Promise.resolve(p).then(() => {
    const b = buffers["music/" + name + ".mp3"];
    if (curTrack !== name || !(b instanceof AudioBuffer)) return;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = b; src.loop = true; g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.8);
    src.connect(g).connect(musicBus); src.start();
    curNode = { src, g };
    // only the playing track stays decoded (a decoded song is ~20 MB)
    for (const k of Object.keys(buffers)) if (k.startsWith("music/") && k !== "music/" + name + ".mp3" && buffers[k] instanceof AudioBuffer) delete buffers[k];
  });
}
/** A one-shot jingle that ducks the music while it plays. */
export function jingle(name) {
  if (!ctx || muted) return;
  if (musicBus && !musicOff) { const t = ctx.currentTime; musicBus.gain.setTargetAtTime(MUSIC * 0.25, t, 0.05); musicBus.gain.setTargetAtTime(MUSIC, t + 2.6, 0.4); }
  sfx(name);
}

function noise(dur) {
  const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = b; return s;
}
function env(g, t0, a, peak, dur) {
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
}
function tone(type, f0, f1, dur, vol = 0.5, delay = 0) {
  const t0 = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  env(g, t0, 0.005, vol, dur); o.connect(g).connect(synthBus); o.start(t0); o.stop(t0 + dur + 0.02);
}
function burst(dur, f, q = 1, vol = 0.5, type = "lowpass", delay = 0) {
  const t0 = ctx.currentTime + delay, s = noise(dur), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  fl.type = type; fl.frequency.value = f; fl.Q.value = q; env(g, t0, 0.004, vol, dur);
  s.connect(fl).connect(g).connect(synthBus); s.start(t0);
}

const SOUNDS = {
  hit: () => { burst(0.08, 1800, 1, 0.35, "bandpass"); tone("square", 220, 90, 0.07, 0.12); },
  crit: () => { burst(0.12, 2600, 1, 0.45, "bandpass"); tone("square", 520, 160, 0.12, 0.18); },
  hurt: () => { tone("sawtooth", 180, 60, 0.18, 0.3); burst(0.1, 800, 1, 0.3); },
  swing: () => burst(0.09, 3200, 0.7, 0.18, "highpass"),
  boom: () => { burst(0.5, 400, 0.7, 0.7); tone("sine", 90, 30, 0.45, 0.5); },
  zap: () => { tone("square", 1400, 300, 0.12, 0.15); burst(0.15, 5000, 2, 0.2, "highpass"); },
  water: () => { burst(0.25, 900, 3, 0.3, "bandpass"); tone("sine", 500, 1200, 0.08, 0.12); },
  dash: () => burst(0.14, 2000, 0.5, 0.25, "highpass"),
  pick: () => { tone("square", 880, 1320, 0.06, 0.12); tone("square", 1320, 1760, 0.06, 0.1, 0.05); },
  ui: () => tone("square", 660, 660, 0.04, 0.08),
  ok: () => { tone("square", 523, 523, 0.06, 0.1); tone("square", 784, 784, 0.09, 0.1, 0.06); },
  level: () => [523, 659, 784, 1047].forEach((f, i) => tone("square", f, f, 0.1, 0.12, i * 0.07)),
  absorb: () => { tone("sine", 200, 1200, 0.6, 0.25); burst(0.6, 3000, 1, 0.15, "bandpass", 0.1); },
  summon: () => { tone("triangle", 220, 880, 1.0, 0.25); burst(0.9, 4000, 1, 0.12, "highpass"); },
  legend: () => [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone("triangle", f, f, 0.25, 0.16, i * 0.09)),
  die: () => { tone("sawtooth", 300, 40, 0.7, 0.3); burst(0.6, 600, 1, 0.3); },
  door: () => { tone("sine", 120, 60, 0.4, 0.3); burst(0.3, 300, 1, 0.3); },
};

export function sfx(name) {
  if (!ctx || muted) return;
  const now = performance.now();
  if (last[name] && now - last[name] < 45) return; // don't stack the same sound in one frame
  last[name] = now;
  try { const ok = playSample(name); if (!ok || LAYER[name]) SOUNDS[name]?.(); } catch { /* audio is best effort */ }
}
