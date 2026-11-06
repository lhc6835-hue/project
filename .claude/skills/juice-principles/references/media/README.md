# Media adapters

Back to [SKILL.md](../../SKILL.md). Principles: [../principles.md](../principles.md).

The principles (P-xx) and lenses (J-xx) are written without assuming a game. An adapter translates them into one medium: what counts as a moment, what the channels are, where to look in the source, and the starting parameters. v1 ships [games.md](games.md) in full. The other files are stubs that later versions will fill in.

| Adapter | Status | Moments | Where to look |
|---|---|---|---|
| [games.md](games.md) | v1, full | input, movement, jump, attack, hit, death, pickup, score, UI, transition, camera, audio | engine code: juice-scan's per-engine references |
| [web-ui.md](web-ui.md) | stub | click, hover, submit, success, error, load, route change, toast | CSS transitions, framer-motion/GSAP calls, event handlers |
| [video.md](video.md) | stub | cut, beat, reveal, title, transition | the edit timeline (EDL/OTIO/project file), music beats |
| [presentations.md](presentations.md) | stub | slide change, build, reveal, data point | slide XML builds and transitions |

## Adapter shape

Every adapter has these sections, in this order:

1. **Moments**: the list of events a viewer or user experiences, each with an ID like `web.submit`.
2. **Channels**: which of visual, motion, camera/framing, audio, UI/text, haptic, and timing exist in this medium.
3. **Where it lives**: file types and calls to search for (the input to a scanner).
4. **Defaults**: a parameter table like the one in principles.md, with sources.
5. **Over-juice signs**: the medium's version of P-15 to P-18.
6. **Accessibility**: the medium's comfort and access rules (for example `prefers-reduced-motion` on the web, WCAG 2.3 flashing in video).

Add an adapter as a new file here, link it in this table, and log it in CHANGELOG.md. A medium that gets a scanner gets its own skill (for example `juice-scan-web`); the principles stay shared.
