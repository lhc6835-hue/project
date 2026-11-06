# Juice lenses

Back to [SKILL.md](../SKILL.md). Principles they apply: [principles.md](principles.md).

These lenses follow Jesse Schell's format: a numbered name, one framing line, and a few questions to ask yourself (*The Art of Game Design* 2e, Introduction pp. 1-2). A lens is a way of looking at the design, not a rule. Use several and keep only what each one shows you. Lenses J1-J12 are this plugin's own. Where one adapts a Schell lens, the original is named; the wording here is new.

Every audit runs J1, J2, J6, and J11 at minimum. For a single moment, pick the two or three lenses that fit it.

### J1 · The Lens of the Moment (after Schell #2 Essential Experience)
What should the user feel at this instant: power, precision, relief, danger, delight?
- What one word describes this moment's intended feeling?
- Which current effect works against that word?
- If you could keep only one channel here, which would carry the feeling?

### J2 · The Lens of Response (Swink, P-01, P-02)
Does the world answer within about 100 ms, and can the user keep correcting?
- How many frames from input to the first visible or audible change?
- Does any animation, effect, or pause lock input? Is that lock deliberate?
- Is intent lost at the edges (just left the ledge, pressed slightly early)?

### J3 · The Lens of the Envelope (P-03)
Does the action have a wind-up, a peak, and a settle?
- Where is the anticipation? Is it short enough not to cost responsiveness?
- What happens in the 100-300 ms after the peak?
- Is the motion linear where an ease would sell the weight?

### J4 · The Lens of Impact (P-04, P-07)
When two things meet, does the user feel the force?
- Does the contact frame get extra time (hit-stop) in proportion to its strength?
- Do the victim, the attacker, and the camera all react?
- Do sound, particles, and motion agree on how heavy this was?

### J5 · The Lens of Channels (after Schell #66 Channels and Dimensions)
Which senses carry this event, and is any one of them doing all the work?
- List the event's visual, motion, camera, audio, UI, haptic, and timing feedback.
- Does the event survive with sound off? In greyscale? With no rumble?
- Are two channels saying contradictory things?

### J6 · The Lens of Information (after Schell #63 Feedback)
After the effect, does the user know what happened and what to do next?
- Can they tell hit from miss from block from critical?
- Does a failed action ("not ready", "no ammo") get its own response?
- Is the same code used for the same meaning everywhere?

### J7 · The Lens of Second-Order Motion (after Schell #64 Juiciness)
Does a small input produce rich, continuing motion?
- What moves because of the action without being controlled directly?
- Do counters, bars, and numbers animate to their new value or snap?
- Does anything overshoot and settle?

### J8 · The Lens of Proportion (P-11, P-12)
Is the response scaled to the moment's importance?
- Rank this moment against the game's other moments. Is its feedback ranked the same way?
- Is the signature effect saved for the rarest event?
- Where are the quiet stretches that make the loud ones loud?

### J9 · The Lens of the Ear (P-09)
Would the event feel tactile with your eyes closed?
- Is there a sharp transient at the moment of contact?
- Does the sound vary (pitch, sample) on repeats?
- Does the mix give gameplay cues priority over music?

### J10 · The Lens of the Toy (after Schell #17 Toy)
Is it fun to poke with no goal?
- In an empty room, is moving or clicking pleasant?
- What does the world do when you brush past it?
- What would you add if this were a toy, not a game?

### J11 · The Lens of Restraint (P-15 to P-17, Hodent)
What is this effect costing the user?
- What does it cover up at its peak: the avatar, the threat, the text?
- How often does it fire per second in the worst case? Do repeats stack?
- What happens to frame time when ten fire at once?

### J12 · The Lens of Comfort (after Schell #54 Accessibility, P-18)
Who is shut out or made ill by this?
- Can shake, flashes, and camera motion be reduced or turned off without losing information?
- Do flashes stay at or under 3 per second and avoid saturated red?
- Is any meaning carried only by colour, sound, or vibration?

### J13 · The Lens of Context Fit (P-22, P-24)
Does the space fit the way the avatar moves?
- Are gaps, ledges and targets sized from written movement metrics, or by eye?
- Which challenges ask for the control's weakest move, and how often?
- Does the camera ever lose the avatar in this space?

### J14 · The Lens of the Six Areas (Swink, P-23, P-25, P-26)
Which part of the feel is this complaint about?
- Input, response, context, polish, metaphor or rules: which one, and is it measured?
- For each input: direct or simulated, and what does it modulate?
- Which rule (lives, damage, reward, caps) is shaping this motion?

## Writing a new lens

Number it `J15` and up. Give it one framing line and three questions or fewer, tie it to at least one `P-` principle, and phrase it so another medium could use it. Log it in [CHANGELOG.md](../CHANGELOG.md).
