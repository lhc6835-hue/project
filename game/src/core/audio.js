// Tiny synthesized sound effects (no files). Muted until the first user gesture unlocks audio.
let ctx = null, master = null, muted = false;
const last = {};

export function unlockAudio() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.32; master.connect(ctx.destination);
  } catch { ctx = null; }
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.32; }
export const isMuted = () => muted;

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
  env(g, t0, 0.005, vol, dur); o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
}
function burst(dur, f, q = 1, vol = 0.5, type = "lowpass", delay = 0) {
  const t0 = ctx.currentTime + delay, s = noise(dur), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  fl.type = type; fl.frequency.value = f; fl.Q.value = q; env(g, t0, 0.004, vol, dur);
  s.connect(fl).connect(g).connect(master); s.start(t0);
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
  try { SOUNDS[name]?.(); } catch { /* audio is best effort */ }
}
