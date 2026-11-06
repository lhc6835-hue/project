# Learnings: juice-principles

Procedural lessons for [SKILL.md](SKILL.md). Research findings live in [RESEARCH.md](RESEARCH.md); every change is logged in [CHANGELOG.md](CHANGELOG.md); test runs in [TESTS.md](TESTS.md); state in `evergreen.json`. Format and write-time gate: MAINTENANCE.md (LEARNINGS-FORMAT). Retired entries go to LEARNINGS-ARCHIVE.md with a reason.

Write an entry the moment a real signal happens: a user correction, the same error twice, a discovered workaround, an environment fact, a stated preference, a failed test or a failure in use. Check existing entries first (add / update / retire / none). Trigger and Hypothesis are required. Promote after three confirmations; retire when harmful > helpful.

## Active

### L-001 · 2026-10-26 · Feel questions the model thinks it can answer go unrouted
- Trigger: action-1 ("starting numbers for squash and stretch on a jump landing") and outcome-1 ("is it OK to flash the whole screen white ...") ran 0/3 each with no tool call at all, then 1/3 and 0/3 after the description said "use it first, before answering from memory". "What is hit-stop" and "how much screen shake is too much" did trigger (T-20261026-2).
- Hypothesis: a question that sounds like general knowledge, with no juice vocabulary in it, is answered from the model's own memory; the description only wins when the prompt names a juice term. A standing rule in the repo's instructions overrides that (3/3 on both cases).
- Rule: keep the "use it first" description with the missed asks named, and point game repos at the AGENTS.md snippet in juice-apply's `references/AGENTS-snippet.md`, which routes feel questions here. Leave action-1 and outcome-1 in `tests.failing` until they pass without the snippet.
- Evidence: T-20261026-3, C-20261026-3
- Scope: skill
- Status: active · helpful 1 · harmful 0 · last_confirmed 2026-10-26

<!-- Example (delete once you have a real entry):
### L-001 · 2026-10-26 · One-line lesson in plain words
- Trigger: what happened, with dates or counts
- Hypothesis: why
- Rule: the shortest instruction that prevents the trigger
- Evidence: C-20261026-1, T-20261026-1, confirmed 2026-10-26
- Scope: skill | repo:<slug> | env:<name> | global
- Status: active · helpful 1 · harmful 0 · last_confirmed 2026-10-26
-->
