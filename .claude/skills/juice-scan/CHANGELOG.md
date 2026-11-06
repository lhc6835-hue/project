# Changelog: juice-scan

Every change to [SKILL.md](SKILL.md) and its companions, newest first, each with the reason. Reasons cite findings in [RESEARCH.md](RESEARCH.md) (`R-`), lessons in [LEARNINGS.md](LEARNINGS.md) (`L-`), and test runs in [TESTS.md](TESTS.md) (`T-`). State in `evergreen.json`. Protocol: MAINTENANCE.md.

Entry shape: `### C-YYYYMMDD-n · date · one-line summary`, then `because:` (IDs or "user request"), `files:` (file and section), and a sentence on what changed. Cite section headings, not line numbers.

### C-20261101-1 · 2026-11-01 · Input path checks: dead zone, update-order lag, aim and collision
- because: user request (Game Engine Architecture 2e learnings approved); P-16
- files: SKILL.md (Step 4 control before polish)
- Control checks now cover missing or over-wide dead zones and smoothing, a frame of lag from update order, and shots or hit boxes that disagree with what the player sees. Triggers unchanged, so evals were not re-run.

### C-20261031-1 · 2026-10-31 · Over-juice check for low-health overlays in combat
- because: user request (The Gamer's Brain 2e learnings approved); P-18
- files: SKILL.md (Step 4 over-juice)
- The over-juice list flags a full-screen low-health overlay or blur that stays on during combat. Triggers unchanged, so evals were not re-run.

### C-20261030-1 · 2026-10-30 · Feel-type classifier and inferred properties in the report
- because: user request (ludowright's feel-handoff list, Swink items left after game-juice 1.2.0); P-23 to P-25
- files: SKILL.md (Step 2), references/report-template.md (header)
- Step 2 classifies the feel (control, space, polish) before judging and lists the movement and rule properties the code implies; the report header carries both. Triggers unchanged, so evals were not re-run.

### C-20261028-1 · 2026-10-28 · Scanner 1.1.0: card-game moments, tests and editor code skipped, predicates dropped
- because: L-002, L-003, T-20261028-1
- files: scripts/juice_scan.py (SKIP_DIRS, TEST_FILE, PREDICATE_NAME, MOMENTS, EXPECTED), tests/check_scan.py (unity-deckbuilder fixture, EXPECT_ABSENT)
- New moments `card_play`, `card_draw` and `turn` with their expected channels. Test folders, test files and Unity `Editor/` folders are no longer scanned. Query helpers (`Has*`, `Is*`, `Get*`, `Meets*`, hit tests) no longer count as moments.

### C-20261026-4 · 2026-10-26 · Published as part of the public game-juice repository
- because: user request
- files: RESEARCH.md (R-20261026-1 wording), TESTS.md (T-20261026-1)
- Generalized one phrase for the public repository (sources written "from general engine knowledge") and removed a duplicated `led to:` line. No change to what the skill does.

### C-20261026-3 · 2026-10-26 · Engine references checked against primary docs; Roblox pop uses UIScale
- because: R-20261026-4, R-20261026-5, R-20261026-6, R-20261026-7, R-20261026-8; user request (pop sketch)
- files: references/engines/roblox.md (settings hook, pickup pop, haptics), references/engines/godot.md (hit-stop, Godot traps), references/engines/web.md (PixiJS and GSAP sketches), RESEARCH.md (open questions, findings log)
- Roblox: `GuiService.ReducedMotionEnabled` confirmed; `pop(gui)` now tweens a `UIScale` child instead of resizing `Size`; haptics lead with the `HapticEffect` instance, which the docs say supersedes `HapticService`. Godot: `create_timer` argument order confirmed; `Tween.set_ignore_time_scale` corrected from 4.3+ to 4.4+, with the fallback for older versions. Web: GSAP licence confirmed on gsap.com and its one restriction noted; the Arcade `timeScale` direction was already right.

### C-20261026-2 · 2026-10-26 · Description claims feel complaints first, even for tiny projects; scanner sees indirect hit-stop calls
- because: T-20261026-1, L-001; T-20261026-2 (juice-apply re-scan)
- files: SKILL.md (frontmatter description), scripts/juice_scan.py (FEEDBACK timing and PROJECT_CHECKS hit_stop patterns)
- The description now says to use the skill first, before reading any game code, even for a tiny project. It leads with complaint words (flat, floaty, weak, stiff, unsatisfying), and the engine list is shorter to stay under 1,024 characters. The scanner also counts `.freeze(` and `Freeze*(` calls as timing feedback, so a hit-stop moved into a settings helper is still recognized.

### C-20261026-1 · 2026-10-26 · Created as an evergreen unit
- because: user request
- files: SKILL.md, RESEARCH.md, LEARNINGS.md, evergreen.json (skills: also TESTS.md and evals/evals.json)
- Initial version. Tier `moderate`, interval 30d. See R-20261026-1 for the research basis; the first test run, for a skill, is logged in TESTS.md.
