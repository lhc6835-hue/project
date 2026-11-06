# Changelog: juice-apply

Every change to [SKILL.md](SKILL.md) and its companions, newest first, each with the reason. Reasons cite findings in [RESEARCH.md](RESEARCH.md) (`R-`), lessons in [LEARNINGS.md](LEARNINGS.md) (`L-`), and test runs in [TESTS.md](TESTS.md) (`T-`). State in `evergreen.json`. Protocol: MAINTENANCE.md.

Entry shape: `### C-YYYYMMDD-n · date · one-line summary`, then `because:` (IDs or "user request"), `files:` (file and section), and a sentence on what changed. Cite section headings, not line numbers.

### C-20261026-4 · 2026-10-26 · Published as part of the public game-juice repository
- because: user request
- files: RESEARCH.md (R-20261026-1 wording), TESTS.md (T-20261026-2 wording)
- Generalized two phrases for the public repository (sources written "from general engine knowledge"; "no Unity Editor on the test machine") and removed a duplicated `led to:` line. No change to what the skill does.

### C-20261026-3 · 2026-10-26 · AGENTS.md snippet for game repos; accessibility table and API notes verified
- because: L-001, T-20261026-3, R-20261026-4
- files: references/AGENTS-snippet.md (new), references/accessibility.md (table, rules), RESEARCH.md (current understanding, open questions)
- Added a paste-in AGENTS.md block that routes feel edits to juice-apply, ideas to juice-scan and feel questions to juice-principles. The accessibility table now names Roblox `GuiService.ReducedMotionEnabled`, says XAG 117 requires an off option (sliders are its examples), applies the 3-per-second flash limit to flashes over about 20% of the screen (XAG 118), and calls the analyser the Harding FPA test.

### C-20261026-2 · 2026-10-26 · Description asks to be used first, even for one-line feel edits
- because: T-20261026-2, L-001
- files: SKILL.md (frontmatter description)
- Added "use it first, before opening or editing game code and even for a one-line change", and shortened the technique list to stay under 1,024 characters. trigger-2 is still failing after this change (0/4); see TESTS.md.

### C-20261026-1 · 2026-10-26 · Created as an evergreen unit
- because: user request
- files: SKILL.md, RESEARCH.md, LEARNINGS.md, evergreen.json (skills: also TESTS.md and evals/evals.json)
- Initial version. Tier `moderate`, interval 30d. See R-20261026-1 for the research basis; the first test run, for a skill, is logged in TESTS.md.
