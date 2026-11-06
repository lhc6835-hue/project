# Research: juice-apply

Findings that back [SKILL.md](SKILL.md). Changes they caused are logged in [CHANGELOG.md](CHANGELOG.md); procedural lessons live in [LEARNINGS.md](LEARNINGS.md); test runs and their evidence in [TESTS.md](TESTS.md); schedule and state in `evergreen.json`. Protocol: MAINTENANCE.md.

Topic: implementing juice in game code: tween/feedback libraries (DOTween, Feel, PrimeTween, Godot Tween, TweenService, GSAP), accessibility settings for motion and flashing. Tier `moderate`. Last refresh 2026-10-26; next due 2026-11-25.

## Current understanding

- Implementation patterns (settings hook, gated effects, named constants, time restored on every path) are engine-independent and stable.
- Library and API names are moderate-tier facts (R-20261026-2): DOTween, PrimeTween, Feel, and LitMotion release monthly; Roblox docs mark `HapticService` superseded by `HapticEffect`; GSAP's licence changed in 2025 (free, including commercial use).
- Accessibility defaults follow WCAG 2.2 SC 2.3.1/2.3.3, Game Accessibility Guidelines, and XAG 117/118 (juice-principles research, accessibility entries).
- Verified 2026-10-26 (R-20261026-4): Roblox `GuiService.ReducedMotionEnabled` exists; Godot `Tween.set_ignore_time_scale` is 4.4+, not 4.3+; the `create_timer` fourth argument is `ignore_time_scale`.
## Open questions

- PixiJS particle-emitter status, pygame tween libraries, and the Phaser 4 check of the web sketches (see juice-scan's open questions).
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

### R-20261026-4 · 2026-10-26 · The build-time unverified API claims, checked against primary docs
- Summary: Roblox `GuiService.ReducedMotionEnabled` exists (boolean, Hidden, ReadOnly, client-side). The Roblox docs mark `HapticService` superseded by the `HapticEffect` instance (the API dump has no Deprecated tag, so `SetMotor` still runs). Godot `create_timer(time_sec, process_always, process_in_physics, ignore_time_scale)` is right; `Tween.set_ignore_time_scale` arrived in 4.4, not 4.3. GSAP's Standard License on gsap.com confirms free commercial use, plugins included, with a no-competing-visual-builder restriction. Phaser Arcade `physics.world.timeScale`: higher is slower. Details and sources: juice-scan RESEARCH R-20261026-4 to -8; XAG 117/118 fetched directly in juice-principles R-20261026-6. The juice-apply accessibility table now cites XAG 117 for an off option (sliders are its examples).
- Track: subject
- Sources: https://create.roblox.com/docs/reference/engine/classes/GuiService ; https://create.roblox.com/docs/reference/engine/classes/HapticEffect ; https://github.com/godotengine/godot/blob/4.4/doc/classes/Tween.xml ; https://gsap.com/community/standard-license/ ; https://github.com/phaserjs/phaser/blob/master/src/physics/arcade/World.js ; https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/117
- Magnitude: 0.3 (one version claim wrong, one preferred API changed)
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
