# Engine reference: web (Phaser, PixiJS, GSAP, canvas)

Back to [SKILL.md](../../SKILL.md). Versions and sources: [RESEARCH.md](../../RESEARCH.md).

## Detect and locate

- Markers: `package.json` dependencies (`phaser`, `pixi.js`, `gsap`, `kaplay`/`kaboom`, `excalibur`, `three`), or `new Phaser.Game` / `PIXI.Application` in a script. Skip `node_modules/` and `dist/`.
- Phaser moments: `Scene` methods (`create`, `update`, and custom ones like `shoot` and `hitEnemy`), `this.physics.add.overlap/collider(a, b, callback)` (the callback is the hit or pickup), `this.input.keyboard`, `setInteractive().on('pointerdown')`, `this.scene.start/restart`.
- PixiJS moments: `app.ticker.add` (the loop), `sprite.on('pointerdown')`, and whatever hand-rolled collision function the game has.

## Settings hook

```js
export const Juice = {
  shakeScale: 1,
  reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  hitStop: true,
  flashes: true,
  shake() { return this.reduceMotion ? 0 : this.shakeScale; },
};
```
Honouring `prefers-reduced-motion` by default is WCAG 2.3.3's recommended technique (P-18).

## Phaser 3 sketches

**Camera shake** (built in): `this.cameras.main.shake(120, 0.008 * Juice.shake());`. Intensity is a fraction of the viewport: 0.005-0.01 is light, 0.02 is heavy. For trauma-style stacking, keep a `trauma` value and call `shake` with `trauma * trauma` scaling.

**Hit-stop** (P-04):
```js
hitStop(ms = 50) {
  if (!Juice.hitStop) return;
  this.physics.world.pause();
  this.tweens.pauseAll();
  setTimeout(() => { this.physics.world.resume(); this.tweens.resumeAll(); }, ms);
}
```
Use `setTimeout` rather than `this.time.delayedCall`, which follows the scene clock and may be affected by `time.timeScale` changes.

**Hit flash and knockback** (P-10): `enemy.setTintFill(0xffffff); this.time.delayedCall(60, () => enemy.clearTint());`. For knockback: `enemy.body.velocity.y -= 120`.

**Squash and stretch / punch** (P-03):
```js
this.tweens.add({ targets: sprite, scaleX: 1.25, scaleY: 0.8, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
```

**Death burst** (P-11): Phaser 3.60+ `const fx = this.add.particles(x, y, 'spark', { speed: { min: 80, max: 220 }, lifespan: 300, quantity: 14, emitting: false }); fx.explode(14);`. Reuse one emitter and move it rather than creating one per death.

**Sound with variation** (P-09): `this.sound.play('shoot', { detune: Phaser.Math.Between(-120, 120), volume: 0.8 });` (detune is in cents).

**Score punch and count-up** (P-08):
```js
this.tweens.addCounter({ from: this.shown, to: this.score, duration: 250, onUpdate: t => this.scoreText.setText('Score: ' + Math.round(t.getValue())) });
this.tweens.add({ targets: this.scoreText, scale: 1.3, duration: 70, yoyo: true, ease: 'Back.easeOut' });
```

**Muzzle flash and camera kick** (Nijman): on `shoot`, show a flash sprite for 1-2 frames and nudge the camera with `this.cameras.main.setScroll(scrollX, scrollY + 3 * Juice.shake())`, recovering over 100 ms. Give bullets a little random spread and size.

**Restart beat** (signature): replace an immediate `this.scene.restart()` with slow-mo (`this.physics.world.timeScale = 3`, where higher is slower in Arcade physics), a flash, and a 400-600 ms fade: `this.cameras.main.fadeOut(400); this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart());`.

## PixiJS and GSAP sketches

- GSAP is free, commercial use included, with its former Club plugins (Standard License since 30 Apr 2025, verified on gsap.com; see RESEARCH.md). The licence bars only use in visual no-code animation builders that compete with Webflow, which a game is not.
- Squash: `gsap.to(sprite.scale, { x: 1.25, y: 0.8, duration: 0.06, yoyo: true, repeat: 1, ease: 'power2.out' });`
- Shake: offset `app.stage.position` by `max * trauma**2 * noise(t)` in the ticker, decaying the trauma.
- Hit-stop: `gsap.globalTimeline.pause()` plus skipping the ticker's update for N ms (keep rendering).
- Respect `gsap.matchMedia()` with `(prefers-reduced-motion: reduce)` to shorten or remove motion.

## Haptics

`navigator.vibrate?.(30)` on mobile, or a gamepad: `navigator.getGamepads()[0]?.vibrationActuator?.playEffect('dual-rumble', { duration: 80, strongMagnitude: 0.6, weakMagnitude: 0.3 })`. Feature-detect both.

## Web traps

- Many short tweens on a busy scene: use `this.tweens.killTweensOf(target)` before adding a new punch, or punches stack into a wobble.
- `cameras.main.flash` is full-screen. Cap it at 3 per second and route it through `Juice.flashes`.
