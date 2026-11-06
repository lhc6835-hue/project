# AGENTS.md snippet for a game repo

Back to [SKILL.md](../SKILL.md). Why it exists: a short, direct request for one named technique ("add coyote time and a jump buffer to my player") reads to most models as a routine edit, so they skip the skill and edit directly (LEARNINGS L-001). A standing rule in the repo's own instructions closes that gap.

Paste the block into the game repo's `AGENTS.md`. Claude Code reads only `CLAUDE.md` when both exist, so give `CLAUDE.md` the line `@AGENTS.md` to import it; point `.github/copilot-instructions.md` at `AGENTS.md` too. Delete the lines for skills you haven't installed.

```markdown
## Game feel and juice changes

- Any change made for how the game feels goes through the `juice-apply` skill, even a one-line change: screen shake, hit-stop, camera kick, squash and stretch, tweens, particles, hit flashes, pitch-varied sound, UI pops, coyote time, jump buffering, death and transition beats. Invoke it before reading or editing the code. It puts the effect behind the juice settings toggle, names its constants, restores time scale on every path, and logs a revert note in `juice-changes.md`.
- Ideas or an audit ("what would make this feel better", "why does combat feel flat") go to `juice-scan`.
- Questions about feel go to `juice-principles` before you answer from memory: why a technique works, starting numbers (squash and stretch, hit-stop length, shake strength), and whether an effect is too much or unsafe (screen flashes, photosensitivity, motion sickness).
- Feel changes never change the rules: damage, scores and collisions behave the same with every juice toggle off.
```
