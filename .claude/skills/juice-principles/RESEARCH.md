# Research: juice-principles

Findings that back [SKILL.md](SKILL.md). Changes they caused are logged in [CHANGELOG.md](CHANGELOG.md); procedural lessons live in [LEARNINGS.md](LEARNINGS.md); test runs and their evidence in [TESTS.md](TESTS.md); schedule and state in `evergreen.json`. Protocol: MAINTENANCE.md. Book sources and what each contributed: [references/sources.md](references/sources.md).

Topic: game feel and juice principles: game-feel research, GDC talks, accessibility guidance on motion and flashing, other-media adapters. Tier `slow`. Last refresh 2026-10-26; next due 2027-02-23.

## Current understanding

- **Settled.** Juice is feedback layered on top of unchanged rules: tweening, squash and stretch, particles, shake, flashes, sound (Jonasson & Purho 2012; Nijman 2013). Swink's model (real-time control + simulated space + polish) is still the standard framing, and his perception numbers (~100 ms for response to fuse with cause, ~240 ms correction cycle) come from human-processor research, not practice (high confidence).
- **Settled practice.** Trauma-based shake with squared magnitude and smooth noise (Eiserloh 2016). Hit-stop scaled by attack strength (Sakurai 2022-23). Forgiveness windows: coyote time and jump buffering (Thorson 2018). These are the techniques the parameter table in principles.md encodes. The numbers are practitioner convention (medium confidence) and are marked as starting points.
- **Settled standard.** Flashing at 3 per second or fewer (WCAG 2.2 SC 2.3.1). Motion triggered by interaction can be turned off (SC 2.3.3, `prefers-reduced-motion`). Game Accessibility Guidelines and XAG 117/118 ask for a way to turn camera shake off (XAG 117 shows sliders as examples) and set photosensitivity limits (high confidence; XAG pages fetched directly 2026-10-26, R-20261026-6).
- **Contested.** How much juice is too much has no number. The plugin's restraint principles (P-11, P-12, P-15) rest on Hodent's attention and signal-detection arguments and on Rogers' practical warnings, not on a measured threshold.
- **Moving.** Accessibility guidance (XAG revisions, platform reduced-motion settings) and new GDC talks. The plugin's other-media adapters are stubs until their own research is done.
- **Tooling around the subject.** At least seven public agent skills cover game feel or juice (see R-20261026-3), all prompt-only checklists as far as their descriptions show. None scans a codebase, which is this plugin's difference.

## Open questions

- No authoritative 2023-2026 GDC talk on combat feel was found in this pass (Doom 2016, Hades, Hi-Fi Rush). Search GDC Vault directly next refresh.
- Kyle Gabler's polish talks (World of Goo era) were not verified.
- XAG 117/118 were fetched directly on 2026-10-26 (R-20261026-6); closed.
- Is there any study measuring when added feedback starts to hurt performance or comprehension (an over-juice threshold)?

## Search plan

Four tracks; every refresh runs at least one query on each (scope each to the period since the last refresh; add the year). Protocol §4 explains the tracks.

Subject:

- `site:gdcvault.com "game feel" OR juice OR "hit stop" OR "screen shake" <year>`
- `"game feel" talk OR postmortem combat feel <year>`; Sakurai channel new videos; GMTK
- `site:w3.org WCAG flashing OR "reduced motion" <year>`; `gameaccessibilityguidelines.com` changes; `Xbox Accessibility Guidelines 117 118 update`
- `"game feel" study OR experiment juiciness players <year>` (academic work on juice, e.g., Hicks et al. on juiciness)

Tooling:

- `path:SKILL.md "game feel" OR "juice"` on GitHub code search, sorted by recently updated; `npx skills find "game feel"`
- `https://registry.modelcontextprotocol.io/v0/servers?search=game` (game-engine MCP servers that could feed the scan)
- `"game juice" OR "game feel" skill OR plugin OR "mcp server" <year> site:github.com`

Practice:

- `"claude code" OR codex OR cursor "game feel" OR juice polish <year>`
- `"AI" "game feel" polish workflow indie dev <year>`; hn.algolia.com `"game feel"` sorted by date

Testing:

- `measure input latency game frames camera "input lag" test <year>`
- `path:SKILL.md "game feel" eval OR evals` on GitHub

Best sources (primary first): GDC Vault, the speakers' own sites and channels (grapefrukt, Vlambeer, maddymakesgames.com, Sakurai), gamedeveloper.com originals, W3C WAI Understanding docs, gameaccessibilityguidelines.com, Microsoft Learn XAG pages. Noisy sources: "top 10 juice tips" listicles, and asset-store marketing copy for claims about technique.

## Findings log

Newest first. One entry per material finding. `Track` is subject, tooling, practice, or testing. All dates accessed: 2026-10-26.

### R-20261026-6 · 2026-10-26 · XAG 117 and 118, read directly
- Summary: XAG 117 (visual distractions and motion settings): avoid camera shake, camera bob, motion blur and similar effects, or provide an option to turn them off; avoid repetitive side-to-side or up-and-down movement not core to play (weapon sway, head bob); provide adjustable field of view; let players pause, hide or disable moving, blinking or auto-updating content behind text. Its examples show 0-100% sliders (radial blur, shake, speed lines), so a slider is good practice and an off option is the requirement. XAG 118 (photosensitivity): a flash is a 10% luminance change; failure is roughly more than 3 flashes per second over roughly 20% or more of the screen, with a stricter saturated-red rule and a spatial-pattern rule (high-contrast bands over about 20% of the screen); fixes are less contrast, lower frequency, smaller area. It lists the Harding FPA test as a tool. This confirms P-18, lens J12, and juice-apply's accessibility table; the earlier summary overstated XAG 117 as asking for sliders.
- Track: subject
- Sources: https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/117 ; https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/118 (both updated 2026-06-17)
- Magnitude: 0.15 (confirmed; one wording corrected)
- Applied: C-20261026-2

### R-20261026-5 · 2026-10-26 · Testing: latency is measured by camera frame counting
- Summary: The common DIY method films the input and the screen at 240 fps or more, counts frames from press to the first visible change (each frame is about 4.17 ms at 240 fps), and reports the median of 5-10 trials. It measures the full input-to-photon chain. This backs P-20's "measure with tools" and the J2 question about input-to-response frames. Automated playtesting for feel was not sourced in this pass.
- Track: testing
- Sources: https://deadpixeltest.cc/input-lag-test (click-to-photon test page; method summarized from practitioner guides)
- Magnitude: n/a (initial)
- Applied: C-20261026-1

### R-20261026-4 · 2026-10-26 · Accessibility: flashing, reduced motion, shake toggles
- Summary: WCAG 2.2 SC 2.3.1 (Level A) forbids more than 3 flashes per second above the general-flash threshold, with a stricter rule for saturated red. SC 2.3.3 (AAA) asks that motion triggered by interaction can be disabled and names `prefers-reduced-motion`. The Game Accessibility Guidelines item on camera movement names shake, bob, motion blur, and chromatic aberration as motion-sickness triggers and asks for an off toggle. XAG 117 asks for sliders for shake, FOV, and blur; XAG 118 sets photosensitivity limits and recommends the Harding analyser. Basis for P-18, lens J12, and juice-apply's accessibility defaults.
- Track: subject
- Sources: https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html ; https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html ; https://gameaccessibilityguidelines.com/avoid-or-provide-option-to-disable-any-difference-between-controller-movement-and-camera-movement/ ; https://devdocs.xbox.com/build/game-principles/accessibility/xag-deep-dives/xag-117-visual-distractions-motion ; https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/118 (XAG read through search summaries, medium confidence)
- Magnitude: n/a (initial)
- Applied: C-20261026-1

### R-20261026-3 · 2026-10-26 · Tooling: existing agent skills on game feel
- Summary: GitHub code search found SKILL.md files for game feel or juice in nlelouche/Unity-SkillForge (`juice-game-feel`), leynos/agent-helper-scripts (`juice-it-or-lose-it`), rondorkerin/gamestack (`game-feel-and-juice`), gamedev-skills/awesome-gamedev-agent-skills (`game-feel`), kamwoh/yume (`yume-juice-designer`), gamekit-agent/gamekit-cli (`adding-juice`), and rshankras/claude-code-apple-skills (`game-feel`). From their snippets they are technique checklists. None ships a scanner, cited principles, or evals. Decision: build rather than depend; check them each refresh for ideas worth citing.
- Track: tooling
- Sources: GitHub code search `filename:SKILL.md "game feel"` and `"juice"`, 2026-10-26
- Magnitude: n/a (initial)
- Applied: C-20261026-1

### R-20261026-2 · 2026-10-26 · Practice: forgiveness, hit-stop, and trauma shake
- Summary: Eiserloh (GDC 2016, "Juicing Your Cameras With Math") has events add "trauma" in [0,1] that decays linearly, with shake = trauma² (or ³) driving per-axis Perlin noise, plus rotational shake, so small hits barely register and big ones dominate. Thorson ("Celeste & Forgiveness", 2018) lists ten forgiveness mechanics: coyote time, jump buffering, half gravity at the apex, corner correction, and wider wall-jump windows. Sakurai's videos ("Stop for Big Moments!", "Eight Hit Stop Techniques", 2022-23) scale hit-stop with attack power and catalogue variants such as attacker-only freeze. Mark Brown's GMTK video (2015) popularized these for a general audience. Basis for P-04, P-05, P-12 and the parameter table.
- Track: practice
- Sources: https://www.youtube.com/watch?v=tu-Qe66AvtY ; https://archive.org/details/GDC2016Eiserloh ; https://www.maddymakesgames.com/articles/celeste_and_forgiveness/index.html ; https://www.youtube.com/watch?v=OdVkEOzdCPw ; https://www.youtube.com/watch?v=tycbMSjDDLg ; https://www.youtube.com/watch?v=216_5nu4aVQ
- Magnitude: n/a (initial)
- Applied: C-20261026-1

### R-20261026-1 · 2026-10-26 · Subject: the primary sources on juice
- Summary: Jonasson & Purho, "Juice it or lose it" (GDC Europe, Cologne, August 2012), rebuild a bare Breakout with toggleable layers: easing, squash and stretch, particles, shake, colour flashes, and sound. The rules never change, yet the game feels far better (source public at github.com/grapefrukt/juicy-breakout). Nijman, "The Art of Screenshake" (INDIGO 2013), layers about 30 tweaks on a shooter: bigger bullets, muzzle flash, hit flash, knockback, permanence, camera lerp and kick, shake, and sleep (hit-stop). Swink's "Game Feel: The Secret Ingredient" (Gamasutra, 2007) defines feel as moment-to-moment control sensation and became the 2009 book. game-feel.com now only promotes the book. These define "juice" for the plugin, and the toggleable-layer demo is the model for juice-apply's toggles. The four books were read the same day (sources.md).
- Track: subject
- Sources: https://www.youtube.com/watch?v=Fy0aCDmgnxg ; https://www.gdcvault.com/play/1016487/Juice-It-or-Lose-It (Vault page down for maintenance on 2026-10-26) ; https://github.com/grapefrukt/juicy-breakout ; https://www.youtube.com/watch?v=AJdEqssNZ-U ; https://www.gamedeveloper.com/design/game-feel-the-secret-ingredient ; http://www.game-feel.com/
- Magnitude: n/a (initial)
- Applied: C-20261026-1
