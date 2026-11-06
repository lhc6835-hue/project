# Report template

Back to [SKILL.md](../SKILL.md).

```markdown
# Juice report: <game name>

Scanned <date> with juice_scan.py <version>. Engine: <engine> (<evidence>). Libraries: <list or none>.
Moments found: <n> (<counts by moment>). Read in full: <n>. Intended feel: <one line, from the user or inferred>.
Feel type (P-23): <control + space + polish | polish only, with one line of evidence>.
Inferred properties (P-24, P-25): <speed, jump height, gravity, lives or HP, caps; each `value (file:line)` or `not found`>.

## Moment map

| Moment | Where | Has | Missing |
|---|---|---|---|
| hit | `Enemy.TakeDamage` (Assets/Scripts/Enemy.cs:9) | audio | hit-stop, flash, shake, knockback |

## Quick wins

### S-01 · Hit-stop on enemy damage · impact 3 / effort 1
- **Moment**: hit · `Enemy.TakeDamage` in Assets/Scripts/Enemy.cs:9
- **Technique**: freeze time for a few frames on contact, scaled by damage.
- **Why**: the contact frame needs time to register (P-04); the hit currently has only a sound (J5).
- **Parameters**: 0.05 s for normal hits, 0.12 s on kill; input stays buffered.
- **Sketch** (Unity C#):
  ```csharp
  // ...engine sketch using the real class and method names...
  ```
- **Toggle / access**: `JuiceSettings.HitStop` (on by default; off for players who find it disorienting).

## Medium changes
...

## Signature moments
...

## Over-juice and accessibility
- <risk id> in `<function>` (<file:line>): <why>, <fix>.
- No reduce-motion / shake setting found: add `JuiceSettings` (see S-0x).

## Not checked
- Animation clips, particle assets, the audio mixer, and scene files were not opened.
```

Keep it skimmable: one screen per group. If there are more than 12 suggestions, list the rest in a single table (ID, moment, where, technique) under "Also worth doing".
