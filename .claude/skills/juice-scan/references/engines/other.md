# Engine reference: other engines (LÖVE, Unreal, Defold, GameMaker)

Back to [SKILL.md](../../SKILL.md). These are short pointers, not full references; v1 covers Unity, Godot, Roblox, web, and Pygame in depth. Verify the API names against current docs before writing a sketch, and note in the report that this engine has light coverage.

## LÖVE (Lua)

- Markers: `main.lua` calling `love.*`, `conf.lua`. Moments sit in `love.update`, `love.keypressed`, and the game's own collision functions.
- Shake: `love.graphics.push(); love.graphics.translate(ox, oy)` around world drawing, then `pop()` before the HUD. `love.math.noise` gives smooth noise.
- Hit-stop: skip the update while `freeze > 0`, but keep drawing.
- Tweening: the `flux` or `tween.lua` libraries are common; check `require`.
- Sound: `source:clone():setPitch(0.92 + love.math.random() * 0.16)` and then `:play()`.
- Haptics: `joystick:setVibration(0.3, 0.6, 0.1)`.

## Unreal (C++ and Blueprints)

- Markers: `*.uproject`, `Source/**/*.cpp|h`. Much of the feel lives in Blueprints (`.uasset`, binary), which the scanner can't read. Say so in "Not checked" and ask the user to describe or export the relevant graphs.
- Shake: a `UCameraShakeBase` subclass, triggered with `PlayerController->ClientStartCameraShake(ShakeClass, Scale)`. Scale it by a user setting.
- Hit-stop: per-actor `CustomTimeDilation` (attacker and victim only) is gentler than `UGameplayStatics::SetGlobalTimeDilation`. Restore it with a timer that doesn't use dilated time.
- Haptics: `UForceFeedbackEffect` through `ClientPlayForceFeedback`.
- Audio: MetaSounds or Sound Cues with random pitch modulation. Particles: Niagara `UNiagaraFunctionLibrary::SpawnSystemAtLocation` (pool where possible).

## Defold (Lua)

- Markers: `game.project`, `*.script`, `*.gui_script`. Moments are in `on_message` (collision messages such as `trigger_response`) and `on_input`.
- Tween: `go.animate(url, "scale", go.PLAYBACK_ONCE_PINGPONG, vmath.vector3(1.25, 0.8, 1), go.EASING_OUTQUAD, 0.12)`.
- Sound: `sound.play(url, { speed = 0.92 + math.random() * 0.16 })`.

## GameMaker (GML)

- Markers: `*.yyp`, `objects/*/Create_0.gml`, `Step_0.gml`, `Collision_*.gml`. Collision events are the hit and pickup moments.
- Shake: offset `camera_set_view_pos`. Hit-stop: a global freeze counter checked at the top of Step events. Sound: `audio_play_sound(snd, 1, false, 1, 0, random_range(0.92, 1.08))` (the last argument is pitch).
