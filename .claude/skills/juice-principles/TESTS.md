# Tests: juice-principles

Test runs for [SKILL.md](SKILL.md). Cases live in `evals/evals.json`. A failure that taught something is a lesson in [LEARNINGS.md](LEARNINGS.md); a fix it caused is logged in [CHANGELOG.md](CHANGELOG.md) with `because: T-...`; research it triggered is in [RESEARCH.md](RESEARCH.md); counts and the failing list are in `evergreen.json` under `tests`. Rules: MAINTENANCE.md (testing section) and the plugin's `protocol/TESTING.md`.

A test passes on evidence (a tool call in the trace, a file, a marker, a log line), never on the transcript's claim that something was done.

Entry shape: `### T-YYYYMMDD-n · date · harness · env · passed/total`, then one line per failing case (`id · kind · class · what the evidence showed`), then `led to:` (L-, C-, R- ids or none). Newest first. Budget 150 lines; archive older runs to `TESTS-ARCHIVE.md`.

## Runs

### T-20261026-3 · 2026-10-26 · claude -p 2.1.281 · dev-machine Windows 11 · 4/6 (action-1, outcome-1 failing without the AGENTS snippet)
- Harness as in T-20261026-2, in a scratch copy of godot-platformer (`--max-turns 6`). Evidence: the Skill call, a tool call whose input names `principles.md`, and the reply text.
- action-1 · action · undertrigger · first pass 0/3 in an empty folder and 0/3 in the fixture: no tool calls at all, an answer from memory (1.25 squash, ~0.12 s recovery) with no P- citation. After C-20261026-3: 1/3 (that run read principles.md and cited P-03 with a 1.2-1.4 range and a recovery time). With the snippet from juice-apply's `references/AGENTS-snippet.md` in the scratch repo: 3/3, each reading principles.md and citing P-03 with 1.2-1.4 and a recovery time.
- outcome-1 · outcome · undertrigger · 0/3 before and 0/3 after C-20261026-3 (answers from memory, no P- ids). With the snippet: 3/3. Each named the 3-per-second limit (WCAG 2.3.1), cited P-15 and P-18 (lens J12), proposed a local flash or an edge vignette instead, and asked for a reduce-flashing setting.
- decoy-1 (scan my Godot project) after C-20261026-3: 2/2, juice-scan invoked, not juice-principles.
- trigger-1, trigger-2, decoy-2: not re-run (pass in T-20261026-2).
- led to: L-001, C-20261026-3

### T-20261026-2 · 2026-10-26 · claude -p 2.1.281 · dev-machine Windows 11 · 4/4 (action-1, outcome-1 not run)
- Harness: `claude -p` 2.1.281 with `--plugin-dir <repo> --output-format stream-json --permission-mode bypassPermissions`, each run in a fresh scratch copy of a fixture; evidence is the Skill and tool calls in the stream-json trace plus files on disk.
- trigger-1 (what is hit-stop), trigger-2 (how much screen shake is too much): pass, Skill(game-juice:juice-principles) called.
- decoy-1 (scan my Godot project): pass, juice-scan was the entry point (it then loads the principles references). decoy-2 (TCP vs UDP): pass, no juice skill.
- Not run: action-1 and outcome-1. They come next; the knowledge files were also exercised indirectly through the juice-scan reports, which cite P-04, P-05, P-08, P-09, P-15 and P-16 correctly.
- led to: none
