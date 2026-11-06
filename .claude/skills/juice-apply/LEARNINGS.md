# Learnings: juice-apply

Procedural lessons for [SKILL.md](SKILL.md). Research findings live in [RESEARCH.md](RESEARCH.md); every change is logged in [CHANGELOG.md](CHANGELOG.md); test runs in [TESTS.md](TESTS.md); state in `evergreen.json`. Format and write-time gate: MAINTENANCE.md (LEARNINGS-FORMAT). Retired entries go to LEARNINGS-ARCHIVE.md with a reason.

Write an entry the moment a real signal happens: a user correction, the same error twice, a discovered workaround, an environment fact, a stated preference, a failed test or a failure in use. Check existing entries first (add / update / retire / none). Trigger and Hypothesis are required. Promote after three confirmations; retire when harmful > helpful.

## Active

### L-001 · 2026-10-26 · A direct request to add one named technique is treated as a routine edit and skips the skill
- Trigger: trigger-2 ("add coyote time and a jump buffer to my player") ran 0/4 before and 0/4 after the description said "even for a one-line change". The action case with a longer request ("add hit-stop and screen shake to take_damage, with a way to turn shake off") did invoke the skill. A later run the same day (T-20261026-3), with no SKILL.md change, went 3/3 without help and 3/3 with the AGENTS snippet.
- Hypothesis: a short, specific edit request sits on the line between the model's built-in editing behaviour and the skill, so routing varies from run to run. Mentioning settings, toggles or accessibility pulls toward the skill; a standing rule in the repo's own instructions removes the variance.
- Rule: keep the "use it first, even for a one-line change" description, and offer the game repo the AGENTS.md snippet (`references/AGENTS-snippet.md`, linked from the README) so feel edits are routed by a standing rule, not by the description alone. Re-run trigger-2 at every refresh; a regression without the snippet is expected noise only if the snippet run still passes.
- Evidence: T-20261026-2, T-20261026-3, C-20261026-2, C-20261026-3
- Scope: skill
- Status: active · helpful 1 · harmful 0 · last_confirmed 2026-10-26