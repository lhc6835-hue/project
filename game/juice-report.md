# Juice report: 에테르 하트 (Aether Heart)

Scanned 2026-11-06 with juice_scan.py. Engine: plain ES-module Canvas 2D (480×270), effects from vendored pixelfx. Libraries: none.
Moments found: 55 leads; the real feel moments were read in full: `World.hit` (src/game/world.js:178), `RunScene.onKill`, `updateOrbs`, `floorCleared`, `transition`, `update` (src/scenes/run.js), `Hero.onHurt` / `die` (src/game/hero.js:335), `Enemy.die` (src/game/enemies.js:455), `Screen.end` flash (src/core/screen.js:58), `.btn` styles (style.css:39).
Intended feel: punchy elemental action roguelite with a cosy raising hub.
Feel type (P-23): real-time control + simulated space + polish.
Inferred properties: hero speed 78 px/s (src/data/spirits.js heroStats), hit-stop per hit `h.stop` 0.012–0.1 s (src/data/skills.js), iframes 0.35 s on hurt (hero.js:335), shake intensity setting `settings.shake` 0–1 (title.js options). No jump in the game.

Scanner false positives removed: *no_hit_stop* (World.hit sets `this.stop`), *no_shake_toggle* (the 화면 흔들림 slider scales `window.SHAKE`), *no_pitch_variation* (audio.js samples carry ±jitter), *no_coyote_time / no_jump_buffer* (there is no jump).

## Moment map

| Moment | Where | Has | Missing |
|---|---|---|---|
| hit (enemy) | `World.hit` (world.js:178) | flash, numbers, spark, knockback, hit-stop, sfx | extra weight on crits |
| kill | `RunScene.onKill` (run.js:160), `Enemy.die` | poof / shatter, orbs | kill hit-stop, impact on elites |
| last kill of a floor | `RunScene.update` wave check (run.js:220) | banner after a delay | the "that was the last one" beat |
| hurt (hero) | `Hero.onHurt` (hero.js:335) | recoil pose, iframes, sfx | camera response, danger read at low HP |
| pickup | `RunScene.updateOrbs` (run.js:240) | sfx | pitch climbing on a streak, pop at the hero |
| UI press | `.btn:active` (style.css:44) | 1 px nudge | scale press and release |
| flashes | `Screen` flash (screen.js:58) | full-screen white | an accessibility limit |

## Quick wins
- **S-01 · Crits land heavier** · `World.hit` · hit-stop ≥ 0.06 s and a 1.6 px shake on crits (P-04). Impact 3 / effort 1. Toggle: shake slider.
- **S-02 · Kill confirm** · `RunScene.onKill` · 0.035 s hit-stop per kill, 0.07 s and shake 2.5 for elites (P-04, P-07). Impact 3 / effort 1.
- **S-03 · Pickup streak** · `updateOrbs` + `sfx` · pitch climbs 4% per orb within 0.35 s, capped at +40%; a small sparkle at the hero (P-09, P-11). Impact 2 / effort 1.
- **S-04 · Hero hurt kick** · `Hero.onHurt` · shake 2 and a brief red edge on the screen (P-05). Impact 2 / effort 1. Toggle: flash setting.
- **S-05 · Button press** · style.css `.btn` · scale 0.94 on press, ease-out-back release 160 ms (P-12). Impact 2 / effort 1.

## Medium changes
- **S-06 · Low-health danger** · `RunScene.updateHud` · below 30 % HP a slow (0.8 Hz) red vignette at the screen edge, never over the middle of the arena (P-18: no full-screen overlay in combat). Impact 2 / effort 2.

## Signature moments
- **S-07 · Last-kill slow-mo** · `RunScene.update` · the kill that empties the final wave drops time to 35 % for 0.45 s with a soft flash and shake (P-06, P-13). Impact 3 / effort 2.

## Over-juice and accessibility
- Full-screen white flashes (screen.js:58) have no limit setting: add 「번쩍임 줄이기」 that scales every flash to 30 % (P-18).
- Kill hit-stop must not stack into long freezes in crowded waves: cap kill stop at the max, never add (P-15).

## Not checked
Sound mix levels on phones, pixelfx effect timings inside the vendored effects, boss attack telegraphs (bosses.js) beyond reading.
