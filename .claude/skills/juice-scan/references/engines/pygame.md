# Engine reference: Pygame

Back to [SKILL.md](../../SKILL.md). Versions and sources: [RESEARCH.md](../../RESEARCH.md).

## Detect and locate

- Markers: `import pygame` in a `.py` file, often `main.py`. Pygame has no scene graph or camera, so the whole game tends to live in one loop: `while running:` with `pygame.event.get()`, update, and draw.
- Moments are often inline in the main loop rather than in named functions: a `colliderect` check (hit or pickup), `lives -= 1`, `score += ...`, `KEYDOWN` handling. The scanner reports these as moments in `main` with low confidence. Read the loop and name the moment by its line range ("hit: main.py:52-55 inside `main`"), and suggest extracting a function (`on_player_hit`) so the feedback has a home.

## Settings hook

```python
class Juice:
    shake_scale = 1.0
    reduce_motion = False
    hit_stop = True
    flashes = True

    @classmethod
    def shake(cls):
        return 0.0 if cls.reduce_motion else cls.shake_scale
```

## Sketches

**Screen shake** (no camera, so offset the drawing):
```python
import math
import random

class Shake:
    def __init__(self, max_px=8, decay=1.3):
        self.trauma, self.max_px, self.decay, self.t = 0.0, max_px, decay, random.random() * 100

    def add(self, amount):
        self.trauma = min(1.0, self.trauma + amount)

    def offset(self, dt):
        self.t += dt * 30
        s = self.trauma ** 2 * Juice.shake()
        self.trauma = max(0.0, self.trauma - self.decay * dt)
        # smooth pseudo-noise from summed sines (pygame has no Perlin built in)
        return (self.max_px * s * math.sin(self.t * 1.3) * math.sin(self.t * 0.7),
                self.max_px * s * math.sin(self.t * 1.1 + 2) * math.sin(self.t * 0.9))
```
Draw the world to a `world` surface, then `screen.blit(world, shake.offset(dt))`. Keep the HUD unshaken by drawing it after the blit.

**Hit-stop** (P-04): keep a `freeze` counter in seconds. While it's above zero, skip the update step but keep drawing and keep reading events, so input is buffered rather than lost.
```python
if freeze > 0:
    freeze -= dt
else:
    update(dt)
draw()
```

**Hit flash and invulnerability blink** (P-10): draw the player white for 0.06 s after a hit (`pygame.draw.rect(screen, (255, 255, 255), ...)`, or `sprite.fill((255, 255, 255), special_flags=pygame.BLEND_RGB_MAX)` on a copy), then blink at 8-10 Hz during invulnerability. That rate is fine for a small sprite but not for the full screen (P-18).

**Squash and stretch** (P-03): store `scale_x, scale_y` and ease them back to 1 each frame (`scale += (1 - scale) * min(1, dt * 15)`). Draw with `pygame.transform.smoothscale(image, (w * sx, h * sy))`, anchored at the feet.

**Sound** (P-09): Pygame can't change pitch at play time. Keep 3-4 slightly different variants per sound (pre-pitched in an editor) and `random.choice(variants).play()`, with `set_volume(random.uniform(0.85, 1.0))`. Add `pygame.mixer.set_num_channels(16)` so overlapping sounds don't cut each other off.

**Particles** (P-15): a list of `[x, y, vx, vy, life]` lists updated in the loop. Cap the list (`del particles[:-200]`) and draw small rects or circles.

**Coyote time and jump buffer** (P-05): track `time_since_grounded` and `time_since_jump_pressed` in seconds (from `clock.tick(60) / 1000`), and jump when both are inside 0.1 and 0.12. Record the `KEYDOWN` instead of calling `jump()` directly.

**Haptics**: `joystick.rumble(0.3, 0.6, 100)` on pygame 2.0.2 or later, if a joystick is connected.

## Pygame traps

- Frame-dependent movement (`rect.x += 5`) makes every timing parameter depend on frame rate. Suggest `dt` (from `clock.tick`) before tuning juice in seconds.
- `pygame.Rect` stores integers, so sub-pixel shake and slow tweens snap. Keep float positions and round only when drawing.
