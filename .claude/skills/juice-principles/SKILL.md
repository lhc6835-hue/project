---
name: juice-principles
description: "The game-juice knowledge base: why feedback and polish make interaction feel good (screen shake, hit-stop, squash and stretch, easing, camera kick, layered and pitch-varied sound, responsive UI, haptics, coyote time, input buffering) and when it becomes noise. Holds 27 medium-independent principles with book citations (Swink, Schell, Hodent, Rogers), Schell-style lenses, a table of starting parameters, accessibility limits for flashing and motion, and adapters for web UI, video and slides. Use it first, before answering from memory (it carries the cited numbers and the limits), whenever the user asks what game feel or juice is, why a technique works, for starting numbers (how much squash and stretch, how long a hit-stop, how strong a shake), whether an effect is too much or safe (screen flashes, photosensitivity, motion sickness), for a design critique of feel without scanning code, or says 'refresh juice-principles' / 'is juice-principles stale'. Codebase audit: juice-scan; implementing: juice-apply."
---

# Juice principles

Outcome: an answer grounded in the principle IDs (`P-xx`) and lenses (`J-xx`) in `references/`, with parameters and a source for each claim, and with restraint and accessibility weighed alongside impact.

## Step 0: freshness (every use, one read)

Read `evergreen.json` next to this file. If `contradiction` is set or today is on or after `next_due`, say so in one line, answer with the current content, then run `evergreen-refresh` on this skill in the same session. If `tests.failing` is non-empty, say so and run `evergreen-tune` after the task.

## Step 1: load only what the question needs

| Question | Read |
|---|---|
| "Why does X feel good?" / "what is juice?" | [principles.md](references/principles.md), sections A-C |
| "How much shake / hit-stop / squash?" | principles.md, parameter table |
| "Is this too much?" / "it's noisy" / accessibility | principles.md section D, then lenses J11 and J12 |
| Critique of one moment (described, no code) | [lenses.md](references/lenses.md): J1, J2, J6, J11, plus the 2-3 that fit |
| "Why does this game feel floaty/stiff?" / take apart a game's feel | [feel-cases.md](references/feel-cases.md), then lenses J13 and J14 |
| "Where does this idea come from?" | [sources.md](references/sources.md), then [RESEARCH.md](RESEARCH.md) for talks and articles |
| A web page, video, or slide deck | [media/README.md](references/media/README.md) and the adapter for that medium (only games.md is complete; say so when using a stub) |

Do not load every file. The point of the split is that a question about hit-stop costs one table, not the whole library.

## Step 2: answer in the lens format

- Name the moment and the feeling it should have (J1).
- Give the principle(s) by ID with a one-line reason: "hit-stop (P-04) gives the contact frame time to register".
- Give concrete starting parameters from the table, marked as starting points to tune.
- Always add the counterweight: what over-juicing looks like for this technique (P-15 to P-18) and the accessibility setting it needs.
- When the user wants it applied to their code, hand over to juice-scan (audit) or juice-apply (implementation).

## Rules

- Principles first, techniques second. "Add shake" is not advice; "the hit lacks impact (J4): shake is one of three channels that could carry it" is.
- Say when a number is a heuristic. Swink's ~100 ms and ~240 ms are perception research; the shake amplitudes are practitioner convention.
- Polish cannot fix control (P-16). If the problem is latency or lockout, say that before suggesting effects.
- Never quote the books at length. Paraphrase and cite the chapter and page.

## Extending to other media

Principles and lenses are medium-independent by design. A new medium gets an adapter file under `references/media/` (shape in media/README.md) and, once it has a scanner, its own skill. Never fork the principles per medium.

## Maintenance

Evergreen unit, protocol from the installed evergreen plugin (pointer mode; see [MAINTENANCE.md](MAINTENANCE.md)). Companions: [RESEARCH.md](RESEARCH.md), [CHANGELOG.md](CHANGELOG.md), [LEARNINGS.md](LEARNINGS.md), [TESTS.md](TESTS.md), `evals/evals.json`, `evergreen.json`.
