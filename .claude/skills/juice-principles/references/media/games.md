# Adapter: games (v1)

Back to [README.md](README.md). Principles: [../principles.md](../principles.md).

## Moments

| ID | Moment | Expected channels (a gap here is a lead) | Key principles |
|---|---|---|---|
| game.input | input read | timing (buffer, ≤100 ms response) | P-01, P-02, P-05 |
| game.movement | walk, run, dash | visual (dust, trails), motion (accel/decel curves, lean), audio (footsteps) | P-14, P-22 |
| game.jump | jump and land | motion (squash/stretch), audio, visual (dust), timing (coyote, buffer, variable height) | P-03, P-05 |
| game.attack | swing, shoot, cast | audio, visual (muzzle flash, trail), camera (kick), animation (anticipation, recoil) | P-03, P-08 |
| game.hit | contact and damage | timing (hit-stop), visual (flash, sparks), camera (shake), audio, UI (numbers), haptic, knockback | P-04, P-06, P-07, P-10 |
| game.death | enemy or player dies | visual (burst, ragdoll, corpse permanence), audio, camera, timing (slow-mo on the last kill) | P-11 |
| game.pickup | collect | audio (rising pitch on streaks), visual (sparkle), motion (pop, fly-to-HUD), UI | P-08, P-09 |
| game.score | score or resource change | UI (count-up, punch scale), motion, audio | P-08 |
| game.ui | button, menu | motion (press scale, hover), audio (click) | P-03, P-13 |
| game.transition | scene or level change | motion (fade, wipe), audio (crossfade) | P-03 |
| game.camera | follow and framing | motion (smooth follow, look-ahead), shake system, kick | P-17, P-18 |

## Channels

visual, motion, camera, audio, UI, haptic, timing. This is the scanner's feedback vocabulary.

## Where it lives

See juice-scan's per-engine references (`skills/juice-scan/references/engines/`).

## Over-juice signs

- Shake on every frame or every shot of an automatic weapon (P-12, P-15).
- Hit-stop that eats input or stacks into a stutter (P-02).
- Particles spawned per frame without pooling (P-15, performance).
- Full-screen flashes faster than 3 Hz, or saturated red flashes (P-18).
- Damage numbers covering the enemies (P-17).
- The same fanfare for a coin and for a boss kill (P-11).

## Accessibility

Settings for shake intensity (0-100%), reduce motion (turns off shake, kick, and bob and shortens tweens), flash reduction, and hit-stop on/off for players who find it disorienting. Captions or visual cues for important sounds, and haptics that can be turned off. Sources: Game Accessibility Guidelines, Xbox Accessibility Guidelines, WCAG 2.3.1 (see RESEARCH.md).
