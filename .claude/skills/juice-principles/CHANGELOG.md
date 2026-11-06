# Changelog: juice-principles

Every change to [SKILL.md](SKILL.md) and its companions, newest first, each with the reason. Reasons cite findings in [RESEARCH.md](RESEARCH.md) (`R-`), lessons in [LEARNINGS.md](LEARNINGS.md) (`L-`), and test runs in [TESTS.md](TESTS.md) (`T-`). State in `evergreen.json`. Protocol: MAINTENANCE.md.

Entry shape: `### C-YYYYMMDD-n · date · one-line summary`, then `because:` (IDs or "user request"), `files:` (file and section), and a sentence on what changed. Cite section headings, not line numbers.

### C-20261101-1 · 2026-11-01 · Game Engine Architecture 2e: P-28 bark and voice-line pools
- because: user request (everscout game-design beat, Game Engine Architecture 2e learnings approved)
- files: references/principles.md (P-28), references/sources.md (Gregory row)
- P-28 covers line pools without repeats and priority-based interruption. Triggers unchanged, so evals were not re-run.

### C-20261031-1 · 2026-10-31 · The Gamer's Brain 2e: low-health effects, camera takeover, loss-beat reappraisal
- because: user request (everscout game-design beat, The Gamer's Brain 2e learnings approved)
- files: references/principles.md (P-18, P-19)
- P-18 now covers low-health overlays hiding the threat and signalled camera takeovers (none in VR); P-19 adds the loss beat that shows what went well. Triggers unchanged, so evals were not re-run.

### C-20261030-1 · 2026-10-30 · Swink's case studies: P-23 to P-27, lenses J13-J14, feel-cases.md
- because: user request (ludowright's feel-handoff list of what Swink adds); Swink ch. 1, 5, 11, 12-16 read
- files: references/principles.md (P-23 to P-27), references/lenses.md (J13, J14), references/feel-cases.md (new), references/sources.md (Swink row), SKILL.md (description count, Step 1 row)
- Added the feel-type classifier, context fit, rules as feel, direct versus simulated mappings and bottom-up tuning as principles, two lenses, and a method-only walk of the six areas drawn from the five case studies (no per-game numbers). Triggers unchanged apart from the count, so evals were not re-run.

### C-20261026-4 · 2026-10-26 · Published as part of the public game-juice repository
- because: user request
- files: TESTS.md (T-20261026-2)
- Removed a duplicated `led to:` line. No change to what the skill does.

### C-20261026-3 · 2026-10-26 · Description asks to be used before answering from memory, and names starting numbers and flash safety
- because: T-20261026-3, L-001
- files: SKILL.md (frontmatter description)
- Added "use it first, before answering from memory", the missed asks (starting numbers for squash and stretch, hit-stop and shake; whether a flash or motion effect is safe), and shortened the rest to stay under 1,024 characters. action-1 went 0/3 to 1/3, outcome-1 stayed 0/3; both pass 3/3 with the AGENTS snippet.

### C-20261026-2 · 2026-10-26 · XAG 117 and 118 read directly; accessibility summary corrected
- because: R-20261026-6
- files: RESEARCH.md (current understanding, open questions, findings log)
- XAG 117 requires a way to turn shake, bob and blur off; sliders are its examples, not its rule. XAG 118's limits (about 3 flashes per second over about 20% of the screen) match P-18. principles.md and lenses.md needed no change.

### C-20261026-1 · 2026-10-26 · Created as an evergreen unit
- because: user request
- files: SKILL.md, RESEARCH.md, LEARNINGS.md, evergreen.json (skills: also TESTS.md and evals/evals.json)
- Initial version. Tier `slow`, interval 120d. See R-20261026-1 for the research basis; the first test run, for a skill, is logged in TESTS.md.
