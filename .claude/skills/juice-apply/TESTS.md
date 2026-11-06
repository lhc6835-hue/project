# Tests: juice-apply

Test runs for [SKILL.md](SKILL.md). Cases live in `evals/evals.json`. A failure that taught something is a lesson in [LEARNINGS.md](LEARNINGS.md); a fix it caused is logged in [CHANGELOG.md](CHANGELOG.md) with `because: T-...`; research it triggered is in [RESEARCH.md](RESEARCH.md); counts and the failing list are in `evergreen.json` under `tests`. Rules: MAINTENANCE.md (testing section) and the plugin's `protocol/TESTING.md`.

A test passes on evidence (a tool call in the trace, a file, a marker, a log line), never on the transcript's claim that something was done.

Entry shape: `### T-YYYYMMDD-n · date · harness · env · passed/total`, then one line per failing case (`id · kind · class · what the evidence showed`), then `led to:` (L-, C-, R- ids or none). Newest first. Budget 150 lines; archive older runs to `TESTS-ARCHIVE.md`.

## Runs

### T-20261026-3 · 2026-10-26 · claude -p 2.1.281 · dev-machine Windows 11 · 6/6
- Harness as in T-20261026-2 (`--plugin-dir`, stream-json, `--permission-mode bypassPermissions`, fresh scratch copy of a fixture per run, `--max-turns 6-8` for trigger cases); evidence is the Skill call in the trace and the files and diff in the scratch copy.
- trigger-1 (godot-platformer with a `juice-report.md` from a juice-scan run): 3/3. Skill(game-juice:juice-apply) was the first tool every time; S-01 (coyote time and jump buffer) landed in `scripts/player.gd` with `juice-changes.md`.
- trigger-2 without the AGENTS snippet: 3/3, first tool Skill(game-juice:juice-apply). No change to SKILL.md since C-20261026-2, so the earlier 0/4 was not stable. With the snippet from `references/AGENTS-snippet.md` in the scratch repo's AGENTS.md (CLAUDE.md importing it): 3/3. Each run added `scripts/juice_settings.gd`, edited `player.gd` and `project.godot` (autoload), and wrote `juice-changes.md`.
- outcome-rules-unchanged (unity-brawler, diff read by hand; no Unity Editor on the test machine): 3/3. `health -= damage` and `Die()` unchanged in every diff; `HitStop` sets `Time.timeScale = 0`, waits on `Time.unscaledTime`, and restores the previous scale on finish, `OnDisable` and scene load; pitch `Random.Range(0.92f, 1.08f)` or `(0.9f, 1.1f)` behind a setting. 0.44-0.47 USD per run.
- led to: L-001 (updated), C-20261026-3

### T-20261026-2 · 2026-10-26 · claude -p 2.1.281 · dev-machine Windows 11 · 3/4 (trigger-1, outcome not run)
- Harness: `claude -p` 2.1.281 with `--plugin-dir <repo> --output-format stream-json --permission-mode bypassPermissions`, each run in a fresh scratch copy of a fixture; evidence is the Skill and tool calls in the stream-json trace plus files on disk.
- trigger-2 · trigger · undertrigger · 0/4 after two tune iterations (C-20261026-2): "add coyote time and a jump buffer to my player". The first tool was Glob, Grep or Bash and the model edited directly. A direct, named-technique request reads as a routine edit to the model. Still failing; see L-001.
- decoy-1 (ideas only): pass, juice-scan invoked instead. decoy-2 (homing-missile enemy): pass, no juice skill.
- action-godot-hitstop: pass. Skill(game-juice:juice-apply) called. The scratch copy gained `scripts/juice_settings.gd` (autoload: shake_scale, reduce_motion, hit_stop, flashes; `freeze()` restores `Engine.time_scale` and resets on `_exit_tree`), `scripts/shake_camera.gd` (trauma shake), named constants in `player.gd` `take_damage` (HIT_STOP_SECONDS 0.06, HIT_TRAUMA 0.45), and `juice-changes.md` with revert steps. Rule lines (`health -= amount`, `die()`) are unchanged. Re-scan: `take_damage` now has camera and timing, and no_hit_stop cleared (after the scanner fix in juice-scan C-20261026-2). 0.47 USD.
- Not run: trigger-1 (needs an existing report in the fixture), outcome-rules-unchanged (Unity; no Unity Editor on the test machine to compile).
- led to: L-001
