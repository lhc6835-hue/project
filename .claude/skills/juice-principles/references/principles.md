# Core principles of juice (medium-independent)

Back to [SKILL.md](../SKILL.md). Lenses that apply these: [lenses.md](lenses.md). Sources and dates: [RESEARCH.md](../RESEARCH.md); book key: [sources.md](sources.md).

Each principle has an ID (`P-xx`) so reports can cite it in a few characters. They are written so they hold for a game, a video edit, a web UI, or a slide deck; the game reading follows each one. Citations: Swink = *Game Feel* (2009, printed pages); Schell = *The Art of Game Design* 2e (2015, printed pages); Hodent = *The Gamer's Brain* (2017, chapter and section); Rogers 2e = *Level Up!* 2nd ed. (2014, PDF pages), Rogers 3e = 3rd ed. (chapter and section).

## A. Timing: the event and its envelope

**P-01 Response fuses with cause under ~100 ms.** When the result of an action arrives within roughly one perceptual cycle (about 100 ms), people perceive it as caused by them and instant. Later than that and it feels like lag, whatever the frame rate. In games: measure from the input frame to the first visible or audible response, not to the end of the animation. *Swink ch. 2 p. 35, ch. 4 p. 70.*

**P-02 Protect the correction loop (~240 ms).** Real-time control is a cycle of perceive, decide, act, perceive again, about 240 ms for most people (roughly 100 perception + 70 cognition + 70 motor, with wide ranges). Effects and lockouts that stop the user from correcting inside that cycle reduce control. In games: flag long uncancellable animations, input locks during effects, and hit-stop that also eats input. *Swink ch. 2 pp. 35-38.*

**P-03 Anticipation, impact, follow-through (the envelope).** Every action has an attack, a peak, and a release (Swink calls it attack, decay, sustain, release). A short wind-up makes the action legible, the peak lands the moment, and the follow-through (settle, overshoot, recoil, dust) tells you the weight. In games: tween curves (ease-out-back, elastic), squash on land, recoil after a shot, a small settle after UI slides in. *Swink ch. 7 pp. 140-154; ch. 9 pp. 155-157.*

**P-04 Stop time to mark impact (hit-stop).** Freezing or slowing the moment of contact for a few frames gives the brain time to register it and sells force. Scale the pause with the strength of the hit, and keep input buffered through it. In games: 2-6 frames (about 30-100 ms) for normal hits, longer for finishers; never on every bullet of a fast weapon. *Rogers 2e ch. 14 p. 364; Nijman 2013 and Sakurai, see RESEARCH.md.*

**P-05 Forgive intent at the edges.** Keep player intent alive briefly when the rules would otherwise discard it: accept a jump a few frames after leaving a ledge (coyote time) or a few frames before landing (input buffer). This removes friction that has nothing to do with the intended challenge. In games: coyote 80-150 ms, jump buffer 100-150 ms. *Swink ch. 6 pp. 121-137, ch. 13; Hodent ch. 11 "Minimum Workload"; Thorson 2018.*

## B. Layering: one event, many channels

**P-06 Layer channels for one event.** People perceive animation, particles, sound, camera, and haptics that arrive together as a single event. Two or three agreeing channels beat one strong one, and they make the event survive when one channel is unavailable (muted audio, colour blindness, no rumble). *Swink ch. 9 pp. 151-152, 167-169; Schell Lens #66 pp. 271-272; Hodent ch. 11 "Flexibility and Accessibility".*

**P-07 Effects must agree on what happened.** The channels have to say the same thing about mass, material, and force. A deep boom on a weightless sprite reads as wrong, so audit the combined impression rather than each effect alone. *Swink ch. 9 pp. 152, 167-169; Schell Lens #71 pp. 289-290.*

**P-08 Second-order motion makes small input feel rich.** Motion that follows from the user's action without being directly controlled (a cape swinging, a counter that overshoots and settles, a button that squishes) makes a small action feel big. *Schell Lens #64 "Juiciness" pp. 265-266.*

**P-09 Sound maps to touch, so vary it.** Sound is the cheapest way to make an interface feel tactile. The ear notices a repeated identical sample, so vary pitch (±5-10%) and volume slightly, and keep a few variants per sound. *Schell ch. 15 "Sound Maps to Touch" p. 275; Rogers 2e ch. 14 pp. 364-370.*

**P-10 Feedback is information first.** Feedback should tell the user what happened, whether it worked, how much, which way, and what they can do now. Decoration that answers none of those is noise. Distinguish hit, miss, block, and critical. *Schell Lens #63 pp. 260-263; Hodent ch. 11 "Signs and Feedback"; Rogers 2e ch. 5 pp. 127-130.*

## C. Contrast and proportion

**P-11 Scale feedback with importance.** A small hit, a critical, and a boss kill should not look and sound the same. Keep tiers (small, medium, signature) and save the biggest response for the rarest moment, so the big one still has room to land. *Rogers 2e ch. 14-15; Hodent ch. 5 "Attention".*

**P-12 Contrast needs a baseline.** An effect reads against the stillness around it. A screen that is always shaking makes a real explosion invisible, so quiet stretches are part of the design. *Hodent ch. 11 "Clarity" (signal detection); Schell interest curves, ch. 16.*

**P-13 Form follows function.** An effect's look should match its meaning. Something that looks dangerous should be dangerous, and the same feedback code should mean the same thing everywhere (damage colour, heal sound, "not ready" buzz). *Hodent ch. 11 "Form Follows Function", "Consistency".*

**P-14 Perceived properties beat simulated ones.** People judge weight, speed, and size from motion, sound, and animation, not from physics values. Non-linear tweaks (extra gravity on the way down, faster stops than starts) often feel more "physical" than accurate physics. *Swink ch. 8 pp. 152-154, ch. 12 pp. 187-190.*

## D. Restraint: when juice becomes noise

**P-15 Attention is a budget.** Attention is limited and selective, and people miss changes when their attention is elsewhere (inattentional and change blindness). Every effect spends some of that budget, so stacked effects compete with the threat or information the user actually needs. *Hodent ch. 4-5.*

**P-16 Polish cannot fix broken control.** Fix latency, lockouts, and unclear rules before adding effects. Polish can hide a bad mechanic for a while, and it makes later tuning harder. *Swink ch. 9; ch. 5 pp. 81-84.*

**P-17 Do not hide what the user needs.** Flashes, blur, particles, and shake must not hide the avatar, the threat, the cursor, or the text. Give every heavy effect a time limit and a way to reduce it. *Rogers 2e ch. 6 pp. 152-158; Schell Lens #62 pp. 259-260.*

**P-18 Comfort and access are part of feel.** Motion, flashing, and camera movement can cause sickness or seizures. Keep flashes to 3 per second or fewer and avoid saturated red flashes. Offer reduce-motion and shake-intensity settings, and never put information only in shake, colour, or sound. Low-health effects (blood, blur, vignette) must not hide the threat from a player who is already losing, and a camera takeover is signalled before it starts; in VR never take the camera at all. *Hodent ch. 3, ch. 11, 2e (2026) ch. 18; Rogers 3e ch. 4 "Platform, Technology and Scope", ch. 6; WCAG 2.3.1 and 2.3.3, Game Accessibility Guidelines, see RESEARCH.md.*

**P-19 Reward meaning, not every action.** Celebrating everything wears the celebration out. Big rewards should tie to real progress and mastery; rewards that pressure the player or play out as a cascade on every action undermine intrinsic motivation. A loss beat can show what went well (best combo, distance reached) so the player reappraises the run instead of quitting. *Hodent ch. 6 "Motivation", ch. 12 "Engageability".*

**P-20 Test with people, measure with tools.** The author's sense of feel is unreliable. Instrument latency and frame timing, then watch someone else play. *Swink ch. 5 pp. 81-84; Rogers 2e ch. 7; Hodent ch. 3.*

## E. The toy test

**P-21 It should be fun to poke with no goal.** Moving, jumping, or clicking should be pleasant in an empty room with no objective. If it isn't, work on the toy first. *Schell Lens #17 "Toy" p. 107; Swink ch. 1 pp. 4-5 (simulated space gives motion meaning).*

**P-22 Space gives motion meaning.** Speed and weight only read against references: ground texture, parallax, nearby objects, collisions. In games: dust on the ground, speed lines, objects that react when the player brushes past. *Swink ch. 1 pp. 4-5.*

**P-23 Classify the feel before tuning it.** Feel in the full sense needs three parts: real-time control, a simulated space, and polish. Something with only polish (a menu, a turn-based board, a slide deck) gets presentation goals, not control goals: promise "satisfying", never "tight". In games: say which parts a game has before scanning; a card game's feel moments are its UI and reveal moments. *Swink ch. 1.*

**P-24 Space and motion are tuned as a pair.** Obstacle size, gap width and pickup spacing only feel right against the avatar's speed, jump height and turning radius, and a challenge that leans on the weakest part of the control (precise landings in 3D, say) stays unpleasant whatever the polish. In games: write down the movement metrics, build spaces from them, and keep targets several avatar widths wide where the control is loose. *Swink ch. 5; ch. 15 pp. 248-249.*

**P-25 Rules are part of the feel.** Lives, hit points, rewards and caps change how control feels: one-hit death makes the avatar feel fragile, a high-value risky target pulls the player into close, skilled moves, a cap on shots alive turns range into fire rate. In games: when motion feels wrong, check the reward and damage rules before the tween curves. *Swink ch. 11; ch. 12 p. 198; ch. 14 p. 245; ch. 16 p. 295.*

**P-26 Choose direct or simulated per axis.** Each input can set a value directly (position, facing) or add force to a simulation (velocity, acceleration). Mixing them, one axis crisp and one with inertia, is often where a distinctive feel comes from; perception-driven hacks (setting velocity mid-jump, extra rules on top of physics) are fine when they read better. In games: list each input with what it modulates and whether it is direct or simulated. *Swink ch. 7; ch. 12 pp. 188, 199; ch. 13 p. 228; ch. 15 p. 248.*

**P-27 Build feel bottom-up.** Tune the core simulation in an empty space first, then build the world around its metrics, then reward the interactions players already enjoy, then link those rewards. Polish and scoring layered on an untuned core hide the problem (P-16). *Swink ch. 16 pp. 295-296; P-21.*

**P-28 Spoken lines are a system, not a sound.** Barks and voice lines come from a pool per situation and skip any line heard recently, so an often-hit moment never repeats word for word. Each line carries a priority: an important one cuts off a minor one already playing, a minor one waits or is dropped and never cuts off the important one. In games: give each bark trigger several lines, a no-repeat memory and a priority, and let at most one voice talk per speaker. *Gregory, Game Engine Architecture 2e (2014), sec. 13.6.2; P-09.*

## Parameter starting points (tune by eye, then by playtest)

These are starting values that published talks and the books converge on, not rules. They are dated in RESEARCH.md.

| Technique | Start | Notes |
|---|---|---|
| Hit-stop | 2-6 frames (33-100 ms) light; 8-15 frames heavy | buffer input during it; scale with damage (P-04) |
| Screen shake (trauma model) | trauma += 0.2-0.5 per hit, decays 1.0-1.5 per s; offset = max × trauma² × noise | max offset 4-12 px (2D) or 0.1-0.3 units; rotation ≤ 3°; Perlin noise beats white noise (Eiserloh 2016) |
| Camera kick | 2-6 px away from shot direction, recover over 80-150 ms | directional, unlike shake |
| Squash/stretch | 1.2-1.4 × along motion, inverse on the other axis, 80-150 ms back | preserve volume |
| UI press | scale 0.9-0.95 down 50 ms, back with ease-out-back 120-200 ms | plus a click sound |
| Pickup | pop scale 1.3 then 0, 150-250 ms; pitch climbs on a streak | P-09, P-11 |
| Damage flash | white or tint for 1-3 frames (≤ 100 ms) | never full screen faster than 3 Hz (P-18) |
| Pitch variation | ±5-10% random per play | P-09 |
| Coyote time / jump buffer | 80-150 ms / 100-150 ms | P-05 |
| Particles on impact | 6-20 particles, 0.2-0.5 s life, pooled | P-15: fewer, bigger, shorter |
| Scene transition | 250-500 ms ease-in-out fade or wipe; audio fade with it | P-03 |

## Adding a principle

Give it the next free `P-` id, write it so it holds outside games, cite a source with a page or section, and log the change in [CHANGELOG.md](../CHANGELOG.md). Never renumber existing IDs; reports in the wild cite them.
