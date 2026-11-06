# Engine reference: Godot 4 (GDScript)

Back to [SKILL.md](../../SKILL.md). Versions and sources: [RESEARCH.md](../../RESEARCH.md).

## Detect and locate

- Markers: `project.godot`, `*.gd`, `*.tscn`. Skip `.godot/` and `addons/` (vendor).
- Moments: `func jump()`, `take_damage`, `die`, `_on_*_body_entered` (signal callbacks), `_unhandled_input` / `Input.is_action_just_pressed`, `_on_*_pressed` (buttons), `get_tree().change_scene_to_file`.
- Signals are wired in `.tscn` files (`[connection signal="body_entered" from="..." to="..." method="..."]`). Grep the `.tscn` files to see who reacts to a `collected` or `died` signal before calling a moment silent.
- Feedback nodes are usually children in the scene: `AnimationPlayer`, `GPUParticles2D`/`CPUParticles2D`, `AudioStreamPlayer2D`, `Camera2D`. Check the `.tscn` for them.

## Settings hook

An autoload singleton `JuiceSettings.gd` (Project Settings > Autoload):
```gdscript
extends Node
var shake_scale := 1.0
var reduce_motion := false
var hit_stop := true
var flashes := true
func shake() -> float: return 0.0 if reduce_motion else shake_scale
```

## Sketches

**Hit-stop** (P-04). The timer must ignore the time scale or it never fires: `create_timer(time_sec, process_always, process_in_physics, ignore_time_scale)`, so the fourth argument is `ignore_time_scale` (verified 2026-10-26).
```gdscript
func hit_stop(duration := 0.05) -> void:
	if not JuiceSettings.hit_stop: return
	Engine.time_scale = 0.0
	await get_tree().create_timer(duration, true, false, true).timeout
	Engine.time_scale = 1.0
```

**Trauma shake on Camera2D** (Eiserloh 2016):
```gdscript
extends Camera2D
@export var max_offset := Vector2(8, 6)
@export var max_roll := 0.05  # radians
@export var decay := 1.3
var trauma := 0.0
var noise := FastNoiseLite.new()
var t := 0.0

func add_trauma(amount: float) -> void:
	trauma = minf(trauma + amount, 1.0)

func _process(delta: float) -> void:
	t += delta * 60.0
	var s := trauma * trauma * JuiceSettings.shake()
	offset = Vector2(max_offset.x * s * noise.get_noise_2d(t, 0), max_offset.y * s * noise.get_noise_2d(0, t))
	rotation = max_roll * s * noise.get_noise_2d(t, t)
	trauma = maxf(trauma - decay * delta, 0.0)
```
Set `ignore_rotation = false` on the Camera2D for the roll to show.

**Squash and stretch** (P-03), on the sprite rather than the body:
```gdscript
func squash(sx := 1.25, sy := 0.8) -> void:
	var tw := create_tween()
	tw.tween_property(sprite, "scale", Vector2(sx, sy), 0.06).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_property(sprite, "scale", Vector2.ONE, 0.12).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
```
Use stretch (0.8, 1.25) on jump takeoff and squash on landing (detect `is_on_floor()` turning true).

**Pitch variation** (P-09): `$Sfx.pitch_scale = randf_range(0.92, 1.08); $Sfx.play()`

**Hit flash** (P-10): `sprite.modulate = Color(3, 3, 3)`, then `create_tween().tween_property(sprite, "modulate", Color.WHITE, 0.08)`. Or set a `flash` shader uniform.

**Coyote time and jump buffer** (P-05):
```gdscript
const COYOTE := 0.1
const BUFFER := 0.12
var coyote_left := 0.0
var buffer_left := 0.0

func _physics_process(delta: float) -> void:
	coyote_left = COYOTE if is_on_floor() else maxf(coyote_left - delta, 0.0)
	buffer_left = BUFFER if Input.is_action_just_pressed("jump") else maxf(buffer_left - delta, 0.0)
	if buffer_left > 0.0 and coyote_left > 0.0:
		velocity.y = JUMP_VELOCITY
		buffer_left = 0.0
		coyote_left = 0.0
```
When the jump is in `_unhandled_input`, move it into the buffer instead of jumping directly.

**Pickup pop** (P-08): `var tw := create_tween(); tw.tween_property(self, "scale", Vector2(1.4, 1.4), 0.08); tw.tween_property(self, "scale", Vector2.ZERO, 0.12); tw.tween_callback(queue_free)`. Disable the collision shape first (`set_deferred("monitoring", false)`) so it can't be collected twice.

**Score count-up and punch** (P-08): tween a `displayed_score` float with `tween_method(func(v): label.text = "Score: %d" % v, old, new, 0.3)` and punch `label.scale`. Set `pivot_offset` to the label's centre.

**Button press** (P-03): connect `button_down`/`button_up` to scale tweens (0.93 then 1.0, `TRANS_BACK`), and play a click sound.

**Haptics**: `Input.start_joy_vibration(0, 0.3, 0.6, 0.1)`.

**Particles** (P-15): keep a `GPUParticles2D` with `one_shot = true` in the scene, move it to the hit point, and set `restart()` / `emitting = true`. Don't instance a new scene per hit.

## Godot traps

- `Engine.time_scale = 0` stops `create_tween()` too unless you call `tween.set_ignore_time_scale(true)` (Godot 4.4+; on 4.3 and older, wait on a `create_timer(..., true)` instead), and physics stops with it.
- `reload_current_scene()` in `die()` cuts every effect off. Add a short death beat (0.3-0.6 s of tween, particles, and sound) before the reload: a signature-moment candidate.
