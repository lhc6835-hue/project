---
name: juice-apply
description: "Implement a game-juice suggestion in the user's game code: hit-stop, trauma screen shake, camera kick, squash and stretch, UI press and score tweens, pickup pops, pitch-varied sound, hit flashes, pooled particles, coyote time, jump buffering, death and transition beats. Every change goes behind a settings toggle and tunable constants so it is easy to revert, and adds the accessibility options (reduce motion, disable screen shake, flash limits) if the game lacks them. Unity, Godot, Roblox, web (Phaser, GSAP) and Pygame. Use it first, before opening or editing game code and even for a one-line change (it carries the toggles, constants and time-scale traps), whenever the user asks to add or implement any of these feel techniques, even a small one: 'apply S-03', 'implement the hit-stop suggestion', 'add screen shake to my game', 'add coyote time and a jump buffer', 'do the quick wins', or 'refresh juice-apply' / 'is juice-apply stale'. Finding what to add is juice-scan; theory is juice-principles."
---

# Juice apply

Outcome: the chosen suggestion is implemented in the game's own files, behind a toggle and named constants. The diff is shown, the project's check (compile, lint, or run) passes or the reason it couldn't run is stated, and an entry is written to `juice-changes.md` at the game root.

## Step 0: freshness (every use, one read)

Read `evergreen.json` next to this file. If `contradiction` is set or today is on or after `next_due`, say so in one line, do the task, then run `evergreen-refresh` on this skill in the same session. If `tests.failing` is non-empty, say so and run `evergreen-tune` after the task.

## Step 1: pin down what to apply

- From a juice-scan report: read `juice-report.md` and take the suggestion's moment, file, function, parameters, and sketch.
- From a direct request ("add screen shake"): run juice-scan's scanner first (`../juice-scan/scripts/juice_scan.py <root>`) to find the engine and the real function to hook into. Don't invent a location.
- More than one suggestion ("do the quick wins"): list them and apply them one at a time, checking after each.
- Check version control. If the game is a git repo with uncommitted changes, say so and suggest committing first. If it isn't a repo, say that reverting relies on the toggle and on `juice-changes.md`.

State the plan in two or three lines (files touched, new files, toggle name) and get a yes unless the user already asked for exactly this.

## Step 2: settings first

If the project has no juice settings yet, add the settings hook from the engine reference ([unity](../juice-scan/references/engines/unity.md), [godot](../juice-scan/references/engines/godot.md), [roblox](../juice-scan/references/engines/roblox.md), [web](../juice-scan/references/engines/web.md), [pygame](../juice-scan/references/engines/pygame.md), [other](../juice-scan/references/engines/other.md)). It has at least `shakeScale` (0-1), `reduceMotion`, `hitStop`, and `flashes`. Reuse the game's existing settings or options system if it has one, and follow its naming. Read [accessibility.md](references/accessibility.md) for the defaults and limits.

## Step 3: implement

- Hook into the function the report named, matching the file's style (indentation, naming, language level).
- Put every number in a named constant or serialized field at the top of the class or script, with the starting value from the report (`HIT_STOP_SECONDS = 0.05`). No magic numbers in the effect code.
- Gate every effect on its setting. Shake and kick go through `shake()` (0 under reduce motion). Flashes check `flashes` and stay at 3 per second or fewer. Hit-stop checks `hitStop`.
- Keep feedback out of game rules. Damage, scores, and collisions must behave the same with every toggle off (that is what makes it juice). With the toggles off, the game must play exactly as before.
- Anything that touches time (hit-stop, slow-mo) restores it on every path, including scene change and death. Note the engine traps in the reference.
- Pool particles and cap stacking (P-15).
- Roblox: camera and UI effects go on the client, triggered by a RemoteEvent from the server when the moment is server-side.

## Step 4: verify, then record

1. Run the project's own check if it exists: Unity compile check (unity-agent-headless if installed), `godot --headless --check-only --script <file>` or an editor import, roblox-agent-checks (selene, luau-lsp), `npx tsc --noEmit` / `npm run build` / `npx eslint` for web, `python -m py_compile` for Pygame. If nothing can run here, say so and explain how to check it by hand.
2. Re-run the scanner on the game. The moment's `feedback` should now list the new channel, and `no_shake_toggle` / `no_hit_stop` should clear where relevant. Quote the before and after.
3. Append to `juice-changes.md` (create it if missing): date, suggestion ID, files changed, constants added with their values, the toggle, and how to revert (set the toggle off, or the exact lines to remove).
4. Tell the user what to try in play and which constant to tune first. Feel is confirmed by playing (P-20), not by the diff.

## Rules

- One suggestion per change set unless the user asked for a batch.
- Never remove existing feedback without asking. Replacing per-frame jitter with the trauma shake counts as a removal, so say so.
- Don't add packages (DOTween, Feel, GSAP) without asking. Use what's installed, else plain engine APIs.
- No AI attribution in code comments.

## Maintenance

Evergreen unit, protocol from the installed evergreen plugin (pointer mode; see [MAINTENANCE.md](MAINTENANCE.md)). Companions: [RESEARCH.md](RESEARCH.md), [CHANGELOG.md](CHANGELOG.md), [LEARNINGS.md](LEARNINGS.md), [TESTS.md](TESTS.md), `evals/evals.json`, `evergreen.json`.
