# Juice changes

## 2026-11-06 · S-01 … S-07 (from juice-report.md)
Settings (title → 설정): 타격 정지 (`settings.hitStop`, on), 번쩍임 줄이기 (`settings.lessFlash`, off → flashes and the red edge at 30%), 화면 흔들림 slider (existing). Applied by `applyJuice()` in src/game/juice.js on every scene change.
Constants live at the top of src/game/juice.js.

| ID | What | Files | Constants | Revert |
|---|---|---|---|---|
| S-01 | crits hold 0.06 s and shake | src/game/world.js `hit` | CRIT_STOP 0.06, CRIT_SHAKE 1.6 | delete the `if (crit && tgt.team === 1)` line |
| S-02 | every kill holds a beat, elites shake | src/scenes/run.js `onKill` | KILL_STOP 0.035, ELITE_KILL_STOP 0.07, ELITE_KILL_SHAKE 2.5 | 타격 정지 off, or remove the `holdFrames` lines |
| S-03 | pickup streak climbs in pitch | src/scenes/run.js `updateOrbs`, src/core/audio.js `sfx(name, { rate })` | STREAK_WINDOW 0.35, STREAK_STEP 0.04, STREAK_MAX 0.4 | pass no `rate` |
| S-04 | hero hurt: shake + red edge | src/game/hero.js `onHurt`, run.js `handleEvents`, src/core/screen.js `edge` | HURT_SHAKE 2, HURT_EDGE_TIME 0.35, HURT_EDGE_K 0.55 | 번쩍임 줄이기, or remove the `hurtEdge` emit |
| S-05 | buttons press to 94% and spring back | style.css `.btn` | 50 ms down, 160 ms ease-out-back up | restore the old `.btn:active` rule |
| S-06 | slow red danger pulse at the edges under 30% HP | run.js `update` | LOW_HP 0.3, LOW_HP_EDGE_K 0.28, LOW_HP_PULSE_HZ 0.8 | 번쩍임 줄이기, or LOW_HP_EDGE_K 0 |
| S-07 | the kill that clears a floor slows time | run.js `onKill` | LAST_KILL_SLOW 0.45, LAST_KILL_SHAKE 3, LAST_KILL_FLASH 0.22 | LAST_KILL_SLOW 0 |

Try first: KILL_STOP (crowded waves), then LAST_KILL_SLOW.
