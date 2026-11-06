# Feel case method

How to take apart the feel of a game, from the five case studies in Swink's *Game Feel* (ch. 12-16: Asteroids, Super Mario Bros., Bionic Commando, Super Mario 64, Raptor Safari). Method only: the book's per-game numbers are not copied here, and a claim about a named game should be checked in the game or the book before it is quoted.

## The walk (use it on any game, including the user's)

Take the six areas in this order; each case study in the book does.

1. **Input.** The device and each input on it: button (on or off), axis (range), how many hands and fingers it asks for. Note when a low-sensitivity input still drives a rich feel; that richness then comes from the simulation. (ch. 12, 14)
2. **Response.** For each input, what it modulates (position, velocity, facing, a state switch) and whether directly or through a simulation (P-26). Count the states between stopped and full speed: one step reads stiff, many read fluid. (ch. 13)
3. **Simulation.** What the game tracks (position only, or velocity and acceleration too), and the special-case rules on top of the physics. Hacks that read better than accurate physics stay. (ch. 13, 15)
4. **Context.** Spacing and size of objects against the movement metrics, screen wrap or bounds, camera relationship, and which challenges the level design avoids because the control is weak there (P-24, J13). (ch. 12, 15)
5. **Polish.** The effects that sell an inferred physical property (weight, friction, grounding), and whether they agree with each other (P-07, P-14). (ch. 15, 16)
6. **Metaphor.** What the representation leads players to expect. Iconic art sets low expectations that simple physics can exceed; a realistic car sets expectations players judge hard. (ch. 12, 16)
7. **Rules.** High (time limits, can you fail), medium (rewards, combos that steer the player), low (health, what one hit does) (P-25). (ch. 12, 14, 16)

Close with the relationships, not the list: the feel usually lives in two or three couplings (camera and stick, thrust and rotation, spacing and jump).

## Patterns the cases show

- **Split mappings.** One axis simulated, one direct, gives control that feels close to losing grip without losing it. (ch. 12)
- **Contrast between modes.** A clumsy mode next to an expressive one makes the expressive one feel better; worth keeping on purpose, not fixing by accident. (ch. 14)
- **Camera-relative control** is the key relationship in a 3D avatar game, and it has edge cases (the avatar directly under the camera). Check them. (ch. 15)
- **Rules that steer movement.** A rare, dangerous, valuable target, or linked combos that reward reaching the next thing fast, change how players drive and so how the control feels. (ch. 12, 16)
- **Can't fail plus a short timer** makes every action feel rewarding and pushes comparison onto score. (ch. 16)
- **Many small decisions.** Even a simple platformer's feel is dozens of small tuning choices; expect to revisit any of them. (ch. 13)

## In a juice-scan report

When a report says a moment feels flat or floaty and the cause is not missing polish, name the area from the walk (J14) and the coupling. Do not prescribe numbers from the cases; starting numbers live in the parameter table in [principles.md](principles.md).
