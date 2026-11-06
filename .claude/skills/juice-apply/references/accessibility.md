# Accessibility defaults for juice

Back to [SKILL.md](../SKILL.md). Sources and dates: [RESEARCH.md](../RESEARCH.md). Principle: P-18 in [juice-principles](../../juice-principles/references/principles.md).

| Setting | Default | What it does | Source |
|---|---|---|---|
| Screen shake intensity | 100% (slider 0-100) | scales all shake and camera kick; 0 must mean off | Game Accessibility Guidelines (camera movement item); XAG 117 (an off option is required, sliders are its examples) |
| Reduce motion | off, or on when the OS/browser asks (`prefers-reduced-motion`, Roblox `GuiService.ReducedMotionEnabled`) | shake 0, kick 0, head bob 0, tween durations halved, no parallax | WCAG 2.2 SC 2.3.3; XAG 117 |
| Flashes | on, capped | flashes covering about 20% of the screen or more stay at 3 per second or fewer, no saturated red flash; off turns full-screen flashes into a vignette or nothing | WCAG 2.2 SC 2.3.1; XAG 118 |
| Hit-stop | on | some players find freezes disorienting; off keeps every other channel | practitioner convention |
| Haptics | on, intensity slider where the platform allows | | XAG; GAG |
| Important sounds | | give every gameplay-critical sound a visual cue (P-06) | GAG hearing items |

Rules for the code:
- Effects never carry information alone. If the only sign of low health is a red pulse, add an icon or a sound.
- Hold reduce-motion in one place (the settings hook) and read it everywhere. Never scatter `if (reduceMotion)` checks against a different variable.
- Put the settings in the game's options menu if it has one. If not, a constants block at the top of the settings file is enough for v1; tell the user where it is.
- Photosensitivity: for a game with intense flashing, suggest checking captured footage with a flash analyser such as the Harding FPA test (listed in XAG 118) before release.
