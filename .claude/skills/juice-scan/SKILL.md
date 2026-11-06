---
name: juice-scan
description: "Audit a game's code for juice and game feel; write a prioritized report. Detects the engine (Unity, Godot, Roblox, web, Pygame, LOVE, Unreal), maps the feel moments (input, jump, attack, hit, death, pickup, score, menus, transitions, camera, audio), checks each one's feedback (visual, motion, camera, audio, UI, haptic, hit-stop, coyote time, input buffering), flags gaps and over-juicing, and ranks fixes by impact/effort with file, function, principle, parameters and a code sketch. Use it first, before reading any game code yourself and even for a tiny project (it carries the principles, parameters and engine traps the answer needs), whenever the user asks why some part of a game feels flat, floaty, weak, stiff or unsatisfying, or asks to make a game feel better: 'make my game feel better', 'add juice', 'why does combat feel flat', 'my jump feels floaty', 'polish pass', or 'refresh juice-scan' / 'is juice-scan stale'. Theory without code is juice-principles; implementing a picked suggestion is juice-apply."
---

# Juice scan

Outcome: a report file `juice-report.md` at the game's root (or a path the user names). Every suggestion in it names a file and function that exist in the repo, and the report says how many moments it covered.

## Step 0: freshness (every use, one read)

Read `evergreen.json` next to this file. If `contradiction` is set or today is on or after `next_due`, say so in one line, do the scan, then run `evergreen-refresh` on this skill in the same session. If `tests.failing` is non-empty, say so and run `evergreen-tune` after the task.

## Step 1: map the moments (deterministic)

Run the scanner on the game root (the folder with `project.godot`, `ProjectSettings/`, `default.project.json`, `package.json`, `main.lua`, or the main `.py`):

```
python "<this skill>/scripts/juice_scan.py" <game-root> --out <scratch>/juice-scan.json
```

It prints one JSON object: `engine`, `libraries` (DOTween, Feel, Godot Tween, TweenService, GSAP...), `moments[]` (moment, file, function, line, existing `feedback` by channel, `gaps`, confidence), `findings` (no coyote time, no hit-stop, no shake toggle, no pitch variation...), and `risks` (shake every frame, spawning effects per frame, frozen timeScale, full-screen flash). Add `--md` for a readable table. It is read-only and fails soft: an `error` field means read the error, fix the path, and run it again. Never guess the map instead.

The scanner matches names and calls, so treat its output as leads. If it finds no moments, say so and ask where the gameplay code lives. A scanner miss is a LEARNINGS entry, not a reason to stop.

## Step 2: read the code behind the leads

Load the engine reference for the detected engine (just that one): [unity](references/engines/unity.md), [godot](references/engines/godot.md), [roblox](references/engines/roblox.md), [web: Phaser, PixiJS, GSAP](references/engines/web.md), [pygame](references/engines/pygame.md), [others: LOVE, Unreal, Defold](references/engines/other.md).

Open every `high` and `medium` moment's function, plus any `low` one that is the player's core verb. For each one, confirm:
- the moment is real (remove false positives from the report),
- what feedback actually exists, including what is called indirectly (an `AudioManager.Play`, an animator event, a signal another script connects to; grep for the callee),
- timing: input-to-response frames, lockouts, hit-stop, coyote and buffer windows.

Classify the feel before judging it (P-23): which of real-time control, simulated space and polish the game has. A game with polish only (cards, turns, menus) gets presentation goals: judge its UI, reveal and turn moments, not jump or aim timing. Then write down the properties the code implies (P-24, P-25): avatar speed, jump height, gravity, acceleration, lives or hit points, caps; give each with its file and line, or `not found`.

Ask what the game is and what it should feel like when that isn't obvious (J1). A cosy farming game and a twitch shooter want different amounts of juice.

## Step 3: assess with the lenses

Load [juice-principles/references/lenses.md](../juice-principles/references/lenses.md) and [principles.md](../juice-principles/references/principles.md) (parameter table). Run J1, J2, J6, and J11 across the game, then the lenses that fit each moment (J4 for hits, J3 for jumps, J7 for score and UI, J9 for audio). Record:
- **Gaps**: an expected channel missing (the scanner's `gaps`, after your reading).
- **Over-juice**: the scanner's `risks`, plus effects that hide the avatar or threat, repeat identically, stack without a cap, or fire every frame (P-15 to P-17), and a low-health full-screen overlay or blur that stays on while the player is in combat (P-18).
- **Access**: no reduce-motion or shake setting, flashes over 3 Hz, meaning carried by one channel only (P-18). Report these even when the user didn't ask.
- **Control before polish**: latency, lockouts, or missing input forgiveness come first (P-16). Check the input path too: raw stick values used with no dead zone (or one so wide the stick feels dull) and no smoothing; a camera or follower that reads its target before the target moves (Update against FixedUpdate, or script order), which adds a frame of lag; shots cast from the camera while the gun sits offset, or hit boxes that don't match the visible mesh (Gregory, Game Engine Architecture 2e (2014), sec. 8.5.2, 12.5.2-12.5.3, 15.6).

## Step 4: write the report

Score each suggestion for impact (1-3: how often the moment happens times how flat it is now) and effort (1-3: lines touched, new assets needed). Group them:
- **Quick wins**: impact ≥ 2, effort 1. Usually pitch variation, hit flash, UI press scale, coyote time, hit-stop.
- **Medium changes**: effort 2. A trauma shake system, squash and stretch, particles with pooling, count-up score.
- **Signature moments**: 1-3 per game, effort 3. The moment players remember: the last-kill slow-mo, the level-clear sequence.

Use the template in [report-template.md](references/report-template.md). Each suggestion has: ID (`S-01`...), moment, `file:line` and `function`, technique, why (principle ID and one line), parameters, an engine code sketch from the engine reference adapted to the real names in that function, and the accessibility setting it needs. End with an over-juice and accessibility section and a "not checked" list (what the scan could not see: assets, animation clips, mixer settings, scenes).

Write the file. Then confirm it exists and that every `file` and `function` it names appears in the scanner JSON or in a file you opened. Fix or delete any that don't. Report done with the path, the number of moments and suggestions, and the top three quick wins.

## Rules

- Read-only. This skill never edits game code; offer juice-apply for a picked suggestion.
- Cite principles by ID (P-04), never quote the books.
- Concrete numbers always, marked as starting points to tune in play.
- Every effect suggestion that moves the camera or flashes carries its toggle (J12).
- Large repos: scan, then read the top 15 moments by confidence and gap count. Say what was skipped.

## Maintenance

Evergreen unit, protocol from the installed evergreen plugin (pointer mode; see [MAINTENANCE.md](MAINTENANCE.md)). Companions: [RESEARCH.md](RESEARCH.md), [CHANGELOG.md](CHANGELOG.md), [LEARNINGS.md](LEARNINGS.md), [TESTS.md](TESTS.md), `evals/evals.json`, `evergreen.json`. Scanner regression test: `python tests/check_scan.py` from the plugin root.
