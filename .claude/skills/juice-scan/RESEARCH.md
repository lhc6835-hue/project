# Research: juice-scan

Findings that back [SKILL.md](SKILL.md). Changes they caused are logged in [CHANGELOG.md](CHANGELOG.md); procedural lessons live in [LEARNINGS.md](LEARNINGS.md); test runs and their evidence in [TESTS.md](TESTS.md); schedule and state in `evergreen.json`. Protocol: MAINTENANCE.md.

Topic: auditing game codebases for juice: engine detection, feel-moment mapping, engine tween/particle/feedback APIs (Unity, Godot, Roblox, Phaser/PixiJS/GSAP, Pygame). Tier `moderate`. Last refresh 2026-10-26; next due 2026-11-25.

## Current understanding

- The scanner is heuristic by design: it matches function names and calls per engine and reports leads with a confidence level. The SKILL.md makes the agent read each lead before suggesting anything (high confidence that this is the right split: deterministic map, judged report).
- Engine detection uses project markers (`ProjectSettings/`, `project.godot`, `default.project.json`/`rokit.toml`, `package.json` dependencies, `import pygame`, `main.lua` with `love.`, `*.uproject`, `game.project`). These are stable.
- Feedback APIs per engine (R-20261026-2) move with engine releases: moderate tier.
- Blind spots: feedback wired in scenes, the Inspector, or Blueprints (`.tscn`, `.unity`, `.uasset`), animation events, and audio mixers. The report must list them under "Not checked".
## Open questions

- The API names flagged unverified at build time were checked on 2026-10-26 (R-20261026-4 to -8). Still open: the PixiJS particle-emitter status, pygame tween libraries, and whether the Phaser 3 sketches in web.md hold on Phaser 4.
- Should the scanner read scene files (.tscn connections, Unity .prefab/.unity YAML) to see Inspector-wired feedback? Candidate for v1.1.

## Search plan

Four tracks; every refresh runs at least one query on each, scoped to the period since the last refresh.

Subject:

- DOTween changelog (dotween.demigiant.com/download.php); PrimeTween `changelog.md`; LitMotion releases; Feel release notes (feel-docs.moremountains.com)
- Godot `class_tween` and particle docs for the current stable; Godot release notes for Tween/time_scale changes
- Roblox creator docs: TweenService, ParticleEmitter, HapticService/HapticEffect, GuiService reduced motion; Roblox DevForum release notes
- Phaser release notes (phaser.io), GSAP licence and release notes (gsap.com), PixiJS particle-emitter repo status; pygame-ce release notes

Tooling:

- `path:SKILL.md "game feel" OR juice` on GitHub, sorted by recently updated; `npx skills find "game juice"`
- game engine MCP servers (Unity, Godot, Roblox Studio) that could give the scan scene and asset data: `https://registry.modelcontextprotocol.io/v0/servers?search=godot` (and unity, roblox)

Practice:

- `"claude code" OR codex game polish juice unity OR godot <year>`

Testing:

- `godot --headless --check-only` usage; `luau-lsp analyze` and selene in CI; Unity batchmode compile checks
- `game feel automated test input latency <year>`

Best sources: vendor changelogs and official engine docs first; DevForum and Phaser forum threads for usage. Noisy: asset-store review pages, tutorial blogs copying old APIs.
## Findings log

Newest first. `Track` is subject, tooling, practice, or testing. All dates accessed: 2026-10-26. The core juice research (talks, accessibility) lives in [juice-principles' RESEARCH.md](../juice-principles/RESEARCH.md) (its 2026-10-26 entries); this file holds what is specific to this skill.

### R-20261026-8 · 2026-10-26 · Phaser Arcade `physics.world.timeScale`: higher is slower (verified)
- Summary: The Arcade `World#timeScale` doc comment reads 1.0 normal, 2.0 half speed, 0.5 double speed (since 3.10.0), unchanged in v3.90.0 and in the current master (Phaser 4.2.1). So `this.physics.world.timeScale = 3` in web.md's restart beat is a slow-motion, as written. Phaser 4 is now the current major; the web.md sketches use the Phaser 3 API, which this pass did not re-check against Phaser 4 beyond this property.
- Track: subject
- Sources: https://github.com/phaserjs/phaser/blob/master/src/physics/arcade/World.js ; https://github.com/phaserjs/phaser/blob/v3.90.0/src/physics/arcade/World.js ; https://github.com/phaserjs/phaser/blob/master/package.json
- Magnitude: 0.1 (claim confirmed; Phaser 4 noted)
- Applied: none (web.md already correct)

### R-20261026-7 · 2026-10-26 · GSAP licence, on gsap.com (verified)
- Summary: gsap.com/licensing redirects to the GSAP Standard License (effective 30 Apr 2025, modified 30 May 2025, held by Webflow). Commercial use is free, including the formerly members-only plugins (SplitText, MorphSVG named in its FAQ). The one restriction: no use in visual no-code animation builders that compete with Webflow. web.md's "free for commercial use, including its former Club plugins" stands; the restriction is now noted there.
- Track: subject
- Sources: https://gsap.com/community/standard-license/
- Magnitude: 0.15 (confirmed; restriction added)
- Applied: C-20261026-3

### R-20261026-6 · 2026-10-26 · Godot 4 time-scale escapes: `create_timer` argument order and `Tween.set_ignore_time_scale` (verified, version corrected)
- Summary: `SceneTree.create_timer(time_sec, process_always = true, process_in_physics = false, ignore_time_scale = false)`; the fourth argument is `ignore_time_scale`, present since 4.0. `Tween.set_ignore_time_scale(ignore = true)` is absent from the 4.3 class reference and present from 4.4, so the earlier "4.3+" was wrong: it is 4.4+. On 4.3 and older, drive the tween from a timer that ignores time scale or restore `Engine.time_scale` first.
- Track: subject
- Sources: https://github.com/godotengine/godot/blob/4.4/doc/classes/Tween.xml ; https://github.com/godotengine/godot/blob/4.3/doc/classes/Tween.xml ; https://github.com/godotengine/godot/blob/master/doc/classes/SceneTree.xml ; https://github.com/godotengine/godot/blob/4.0/doc/classes/SceneTree.xml ; https://docs.godotengine.org/en/stable/classes/class_scenetree.html
- Magnitude: 0.3 (a version claim was wrong)
- Applied: C-20261026-3

### R-20261026-5 · 2026-10-26 · Roblox haptics: `HapticService` superseded by `HapticEffect` (verified)
- Summary: The creator-docs source for HapticService carries a class-level deprecation message: superseded by the `HapticEffect` instance, use it for new work. The engine API dump does not tag HapticService or its members `Deprecated`, so `SetMotor` still runs. `HapticEffect` has `Type` (`Enum.HapticEffectType`), `Looped`, `Position`, `Radius`, `SetWaveformKeys`, `Play`, `Stop`. roblox.md now leads with `HapticEffect` and keeps `SetMotor` as the older route.
- Track: subject
- Sources: https://create.roblox.com/docs/reference/engine/classes/HapticService ; https://create.roblox.com/docs/reference/engine/classes/HapticEffect ; https://github.com/Roblox/creator-docs/blob/main/content/en-us/reference/engine/classes/HapticService.yaml ; https://github.com/MaximumADHD/Roblox-Client-Tracker/blob/roblox/Mini-API-Dump.json
- Magnitude: 0.3 (preferred API changed)
- Applied: C-20261026-3

### R-20261026-4 · 2026-10-26 · Roblox `GuiService.ReducedMotionEnabled` exists (verified)
- Summary: The property exists with that exact name: boolean, tagged Hidden, ReadOnly and NotReplicated, readable by scripts (security None) with the UI capability. It reflects the player's own setting, so read it on the client. The `pcall` guard in roblox.md stays as cheap insurance for older clients but is no longer needed to find out whether the name is right.
- Track: subject
- Sources: https://create.roblox.com/docs/reference/engine/classes/GuiService ; https://github.com/MaximumADHD/Roblox-Client-Tracker/blob/roblox/Mini-API-Dump.json
- Magnitude: 0.1 (claim confirmed)
- Applied: C-20261026-3

### R-20261026-3 · 2026-10-26 · Tooling and testing: no existing scanner; fixture-based regression
- Summary: The seven public game-feel skills found (juice-principles research, tooling entry) are prompt-only, so the deterministic scanner (`scripts/juice_scan.py`) has no existing equivalent to build on. Testing approach: five small under-juiced sample games (Unity, Godot, Roblox, Phaser, Pygame) under `tests/fixtures/`, with `tests/check_scan.py` asserting the engine, real moment/file/function triples, the findings, and the fail-soft contract. Same evidence rule as the evergreen protocol: names that exist on disk, not the reply's claim.
- Track: tooling, testing
- Sources: GitHub code search 2026-10-26; this repository's tests
- Magnitude: n/a (initial)
- Applied: C-20261026-1

### R-20261026-2 · 2026-10-26 · Engine feedback APIs (versions on 2026-10-26)
- Summary: DOTween 1.3.045 (12 Oct 2026; minimum Unity 2022.3 from the Asset Store). PrimeTween 1.5.1 (21 Oct 2026, with a Pro variant). LitMotion 2.0.2 (search summary). Feel by More Mountains 6.3 (Oct 2026, search summary; release-notes page returned 404). Cinemachine 3 Impulse: `CinemachineImpulseSource.GenerateImpulse()` plus a listener on the camera. Godot 4: `create_tween()` with `tween_property().set_trans().set_ease()`; particles are tweenable. Roblox: `TweenService:Create(inst, TweenInfo, goals)`, `ParticleEmitter:Emit(n)`; `HapticService` is flagged deprecated in favour of the `HapticEffect` instance. Phaser 3: `cameras.main.shake(durationMs, intensity)` with 0.005-0.02 typical. GSAP: fully free, including the former Club plugins, since 30 Apr 2025 after the Webflow acquisition (secondary source; verify on gsap.com). Not verified this pass: the PixiJS particle-emitter status, pygame tween libraries, and the Roblox `GuiService.ReducedMotionEnabled` property name (the reference guards it with `pcall`).
- Track: subject
- Sources: https://dotween.demigiant.com/download.php ; https://github.com/KyryloKuzyk/PrimeTween/blob/main/changelog.md ; https://github.com/AnnulusGames/LitMotion/releases ; https://assetstore.unity.com/packages/tools/particles-effects/feel-183370 ; https://docs.unity3d.com/Packages/com.unity.cinemachine@3.0/manual/CinemachineImpulse.html ; https://docs.godotengine.org/en/stable/classes/class_tween.html ; https://create.roblox.com/docs/reference/engine/classes/TweenService ; https://create.roblox.com/docs/reference/engine/classes/HapticService ; https://phaser.discourse.group/t/correct-use-of-camera-shake/4195 ; https://www.alijavadi.net/articles/gsap-is-now-free-for-everyone-webflow-s-game-changing-gift-to-web-animator
- Magnitude: n/a (initial)
- Applied: C-20261026-1

### R-20261026-1 · 2026-10-26 · Practice: how the techniques map to code
- Summary: Engine sketches follow Eiserloh's trauma shake, Thorson's coyote/buffer windows, and Sakurai's damage-scaled hit-stop (juice-principles research, practice entry), translated to each engine's time-scale and camera model. Engine traps (time scale 0 stops tweens and timers; client/server split on Roblox; pygame Rect integer snapping) are from engine docs and common knowledge, written from general engine knowledge without a dedicated web check. First refresh should verify Godot `Tween.set_ignore_time_scale` (4.3+) and the `create_timer` ignore_time_scale argument order.
- Track: practice
- Sources: engine docs listed in R-20261026-2
- Magnitude: n/a (initial)
- Applied: C-20261026-1
