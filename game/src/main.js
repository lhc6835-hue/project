// Boot: load effects and fonts, then run scenes on a fixed-ish timestep.
import { loadFx } from "./px.js";
import { Screen } from "./core/screen.js";
import { Input } from "./core/input.js";
import { unlockAudio } from "./core/audio.js";
import { skillFxIds } from "./data/skills.js";
import { DECOR_IDS } from "./game/room.js";
import { auth } from "./core/auth.js";
import { openSave } from "./core/session.js";
import { bindAutoFullscreen } from "./core/fullscreen.js";

const COMMON_FX = [
  "critters/slime", "critters/bat", "critters/flying-skull", "critters/ghost", "critters/eyeball", "critters/wisp",
  "spawn/poof", "spawn/shatter-death", "spawn/egg-hatch", "spawn/summon-rise", "status/rage", "status/burning", "status/frozen", "status/stunned", "status/slowed",
  "ui/damage-number", "ui/crit-number", "ui/quest-complete", "ui/level-up", "ui/confetti", "ui/achievement", "impacts/impact-frame", "impacts/hit-spark", "impacts/crit-hit",
  "weather/aurora", "weather/fireflies", "weather/shooting-stars", "holy/sunburst", "holy/holy-pillar", "holy/halo", "arcane/portal", "arcane/magic-circle-cast", "arcane/rune-circle",
  "water/fountain", "pickups/collect-burst", "pickups/xp-orb", "pickups/gem-spin", "transitions/iris", "fire/spirit-flame", "lightning/zap-hit",
  "shadow/void-orb", "shadow/shadow-flames", "shadow/dark-explosion", "shadow/grasping-hands", "shadow/hex-sigil", "shadow/black-hole", "explosions/big-explosion", "nature/boulder", "nature/earth-spike", "explosions/implosion", "arcane/star-fall",
];

export const game = { screen: null, input: null, scene: null, save: null, scenes: {} };

export function go(name, args) {
  const S = game.scenes[name];
  game.scene?.exit?.();
  document.getElementById("ui").innerHTML = "";
  game.input.showTouch(false);
  game.scene = new S(game, args);
  game.scene.enter?.();
}

async function boot() {
  const canvas = document.getElementById("view");
  game.screen = new Screen(canvas);
  game.input = new Input();
  await auth.restore();
  game.save = (await openSave(auth.account)).save;
  bindAutoFullscreen(game.save.settings.fullscreen !== false);
  const ui = document.getElementById("ui");
  ui.innerHTML = `<div class="pass" style="position:absolute;inset:0;display:grid;place-items:center;color:#a59fc4">불러오는 중…</div>`;
  await Promise.all([loadFx([...skillFxIds(), ...COMMON_FX, ...DECOR_IDS]), document.fonts.load("8px Galmuri11"), document.fonts.load("bold 8px Galmuri11")]);
  const mods = await Promise.all(["title", "select", "garden", "absorb", "run", "gacha", "results"].map((n) => import(`./scenes/${n}.js`)));
  for (const m of mods) Object.assign(game.scenes, m.default);
  addEventListener("pointerdown", unlockAudio, { once: false });
  addEventListener("keydown", unlockAudio, { once: false });
  const q = new URLSearchParams(location.search);
  if (q.get("scene")) go(q.get("scene"), Object.fromEntries(q));
  else go("title");
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
    const s = game.scene;
    if (s) {
      s.update(dt);
      s.draw(game.screen, dt);
      game.screen.present(dt);
    }
    game.input.endFrame();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.game = game;
}

boot().catch((e) => {
  console.error(e);
  document.getElementById("ui").innerHTML = `<div style="padding:20px;color:#ff8a8a">오류: ${e.message}</div>`;
});
