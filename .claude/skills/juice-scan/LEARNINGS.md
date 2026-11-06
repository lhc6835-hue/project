# Learnings: juice-scan

Procedural lessons for [SKILL.md](SKILL.md). Research findings live in [RESEARCH.md](RESEARCH.md); every change is logged in [CHANGELOG.md](CHANGELOG.md); test runs in [TESTS.md](TESTS.md); state in `evergreen.json`. Format and write-time gate: MAINTENANCE.md (LEARNINGS-FORMAT). Retired entries go to LEARNINGS-ARCHIVE.md with a reason.

Write an entry the moment a real signal happens: a user correction, the same error twice, a discovered workaround, an environment fact, a stated preference, a failed test or a failure in use. Check existing entries first (add / update / retire / none). Trigger and Hypothesis are required. Promote after three confirmations; retire when harmful > helpful.

## Active

### L-002 · 2026-10-28 · A deckbuilder's core verbs were invisible to the scanner
- Trigger: field test on a Unity colony deckbuilder. Of 168 moments, none was card play, draw or end turn, though `OnCardPlayed`, `OnCardDrawn` and `OnEndTurnClicked` all existed. The moment list only knew action-game verbs.
- Hypothesis: the moment table came from platformer and brawler examples. Genres with other core verbs (cards, turns, placement) get audited on their side effects only.
- Rule: when a scan returns no moment for the game's core verb, add that verb's moment to the table with a fixture before writing the report. Ask the genre in step 2 (J1).
- Evidence: T-20261028-1; scanner 1.1.0 finds OnCardPlayed, TryPlayCard, OnTurnEnded, AnimateSingleDraw
- Scope: skill
- Status: active · helpful 1 · harmful 0 · last_confirmed 2026-10-28

### L-003 · 2026-10-28 · Test suites, editor tools and query helpers flooded the moment map
- Trigger: same field test. About a third of the high and medium moments were NUnit tests (`TakeDamage_ReducesCurrentHp`), Unity `Assets/Editor` menu items, or predicates (`HasPendingDamageReveal`, `GalaxyChartLayout.Hits`, `CardData.MeetsRequirements`).
- Hypothesis: name matching cannot tell a moment from code that only mentions it.
- Rule: skip test and editor-only paths. Treat query-shaped names (Has/Is/Get/Can/Meets, hit tests) as non-moments.
- Evidence: T-20261028-1; 199 files down to 152, and no Tests/ or Editor/ rows
- Scope: skill
- Status: active · helpful 1 · harmful 0 · last_confirmed 2026-10-28

### L-001 · 2026-10-26 · On a small repo the model reads the code itself unless the description says "first, even for tiny projects"
- Trigger: trigger-3 ("why does combat feel flat... take a look at the code") ran 0/4 against a three-file Godot fixture. The first tool was Bash `find`/`cat`.
- Hypothesis: when the whole codebase fits in two reads, the model rates the skill as overhead. Prompts that name the code ("take a look at the code") pull it toward reading directly.
- Rule: keep "use it first, before reading any game code yourself, even for a tiny project" and the reason (principles, parameters, engine traps) in the description. Test triggers on the small fixtures, the hardest case.
- Evidence: T-20261026-1 (0/4), C-20261026-2, T-20261026-2 (4/4)
- Scope: skill
- Status: active · helpful 1 · harmful 0 · last_confirmed 2026-10-26