# Tests: juice-scan

Test runs for [SKILL.md](SKILL.md). Cases live in `evals/evals.json`. A failure that taught something is a lesson in [LEARNINGS.md](LEARNINGS.md); a fix it caused is logged in [CHANGELOG.md](CHANGELOG.md) with `because: T-...`; research it triggered is in [RESEARCH.md](RESEARCH.md); counts and the failing list are in `evergreen.json` under `tests`. Rules: MAINTENANCE.md (testing section) and the plugin's `protocol/TESTING.md`.

A test passes on evidence (a tool call in the trace, a file, a marker, a log line), never on the transcript's claim that something was done.

Entry shape: `### T-YYYYMMDD-n · date · harness · env · passed/total`, then one line per failing case (`id · kind · class · what the evidence showed`), then `led to:` (L-, C-, R- ids or none). Newest first. Budget 150 lines; archive older runs to `TESTS-ARCHIVE.md`.

## Runs

### T-20261028-1 · 2026-10-28 · field use, Claude Code in VS Code · Windows 11 · 1/1 (field test, not the suite)
- Real Unity deckbuilder (199 C# files). The 1.0.0 scanner returned 168 moments: no card play, draw or turn moments, and test, editor and predicate rows mixed in with the rest. After the 1.1.0 fixes it returned 140 moments with OnCardPlayed, TryPlayCard, OnCardDrawn, AnimateSingleDraw and OnTurnEnded rated high or medium. `tests/check_scan.py` passes with the new unity-deckbuilder fixture (7/7), and so does `tests/check_skills.py`. The report had 9 suggestions, and every file and function in it was checked against code that was opened.
- led to: C-20261028-1, L-002, L-003

### T-20261026-3 · 2026-10-26 · claude -p 2.1.281 · dev-machine Windows 11 · 3/3 (partial: spot checks while publishing)
- Not a full suite run; extra evidence gathered while running the sibling skills' cases. "Make my game feel better" in a scratch copy of godot-platformer: Skill(game-juice:juice-scan) first, then the scanner, and a 147-line `juice-report.md` (8 moments, 9 suggestions, S-01 coyote time and jump buffer). juice-principles' decoy-1 ("Scan my Godot project and tell me where to add juice"): 2/2, Skill(game-juice:juice-scan) first.
- The engine reference edits in C-20261026-3 change sketches, not triggers or the scan flow, so the full suite was not re-run.
- led to: none

### T-20261026-2 · 2026-10-26 · claude -p 2.1.281 · dev-machine Windows 11, no engines installed · 9/9
- Harness: `claude -p` 2.1.281 with `--plugin-dir <repo> --output-format stream-json --permission-mode bypassPermissions`, each run in a fresh scratch copy of a fixture; evidence is the Skill and tool calls in the stream-json trace plus files on disk. Trigger cases used the act suffix ("start the job, stop after two or three tool calls") and were also run without it.
- trigger-1 (make my game feel better), trigger-2 (add juice to this): pass, Skill(game-juice:juice-scan) called.
- trigger-3 (why does combat feel flat): pass 4/4 after C-20261026-2 (2 with the suffix, 2 without); Skill was the first tool call.
- decoy-1 (falls through the floor), decoy-2 (orange juice recipe): pass, no juice skill. decoy-3 (what is hit-stop): pass, juice-principles invoked instead.
- action-godot: pass. juice_scan.py in the trace (5 calls). juice-report.md written (11 KB) naming scripts/player.gd `jump`/`take_damage` and scripts/coin.gd `collect`, with coyote and buffer as S-01 (control before polish). 0.47 USD.
- action-roblox: pass. Scanner called. Report names `collectCoin` and `onJumpRequest` and routes pickup feedback through a `RemoteEvent` to the client. 0.42 USD.
- outcome-unity-overjuice: pass. Report flags `CameraShake.Update` as constant per-frame shake (shake_per_frame), the missing reduce-motion and shake settings, and hit-stop for `Enemy.TakeDamage` (0.06 s). 0.40 USD.
- Baseline (without the skill): in the first trigger-3 runs (T-20261026-1) the model read the three scripts directly and answered from general knowledge. Its answer was reasonable but had no principle IDs or parameters table, and it didn't check for coyote time, jump buffering or a shake toggle.
- led to: none

### T-20261026-1 · 2026-10-26 · claude -p 2.1.281 · dev-machine Windows 11 · 2/3 triggers, decoys 3/3
- trigger-3 · trigger · undertrigger · 0/1 then 0/3: Bash `find`/`cat` on the three scripts first, no Skill call. The model judged a three-file project too small to need the skill.
- led to: L-001, C-20261026-2
