# Engine reference: Roblox (Luau)

Back to [SKILL.md](../../SKILL.md). Versions and sources: [RESEARCH.md](../../RESEARCH.md).

## Detect and locate

- Markers: `default.project.json` (Rojo), `rokit.toml`, `wally.toml`, `*.luau`; `*.server.luau` runs on the server, `*.client.luau` on the client, and plain `*.luau` is a ModuleScript.
- Moments: `.Touched:Connect(...)` (pickups, hazards), `Humanoid:TakeDamage`, `Humanoid.Died`, `Humanoid.StateChanged` (jump, land, freefall), `UserInputService.JumpRequest`/`InputBegan`, `ContextActionService:BindAction`, `GuiButton.Activated` / `MouseButton1Click`, `leaderstats` changes (score), `TeleportService`.
- Without Rojo (a place file only), ask the user to sync scripts to disk first (roblox-agent-project).

## The client and server split (read first)

Most juice is client-side. The server decides the hit or the pickup; the client shows the camera shake, UI pop, local sound, and haptics. A moment that lives only in a `.server.luau` file (like `collectCoin`) needs a `RemoteEvent` fired to the player (`FireClient`) and a client handler that plays the feedback. Sounds and `ParticleEmitter:Emit` on a replicated Part are visible to everyone, which suits world effects. Put the camera and UI on the client only.

```luau
-- ReplicatedStorage/Remotes: a RemoteEvent named "Juice"
-- server: Remotes.Juice:FireClient(player, "pickup", coin.Position)
-- client:
Remotes.Juice.OnClientEvent:Connect(function(kind, pos)
	if kind == "pickup" then Juice.pickup(pos) end
end)
```

## Settings hook

A client ModuleScript `JuiceSettings`. Respect the player's Roblox setting: `GuiService.ReducedMotionEnabled` is a read-only, client-side boolean (verified 2026-10-26, see RESEARCH.md); the `pcall` keeps older clients safe:
```luau
local GuiService = game:GetService("GuiService")
local JuiceSettings = { shakeScale = 1, hitStop = true, flashes = true }
function JuiceSettings.shake()
	local ok, reduced = pcall(function() return GuiService.ReducedMotionEnabled end)
	return (ok and reduced) and 0 or JuiceSettings.shakeScale
end
return JuiceSettings
```

## Sketches

**Trauma camera shake** (client, after the camera updates):
```luau
local RunService = game:GetService("RunService")
local camera = workspace.CurrentCamera
local trauma, t = 0, 0
local MAX_ANGLE, DECAY = math.rad(2.5), 1.3

local Shake = {}
function Shake.add(amount) trauma = math.min(trauma + amount, 1) end

RunService:BindToRenderStep("JuiceShake", Enum.RenderPriority.Camera.Value + 1, function(dt)
	if trauma <= 0 then return end
	t += dt * 20
	local s = trauma * trauma * JuiceSettings.shake()
	camera.CFrame *= CFrame.Angles(MAX_ANGLE * s * math.noise(t, 0), MAX_ANGLE * s * math.noise(0, t), MAX_ANGLE * s * math.noise(t, t))
	trauma = math.max(trauma - DECAY * dt, 0)
end)
return Shake
```

**Hit-stop** (P-04). Physics can't be paused on Roblox, so freeze the animation instead: on the client that sees the hit, pause the relevant `AnimationTrack`s for a moment.
```luau
local function hitStop(tracks, duration)
	if not JuiceSettings.hitStop then return end
	for _, tr in tracks do tr:AdjustSpeed(0) end
	task.delay(duration or 0.06, function() for _, tr in tracks do tr:AdjustSpeed(1) end end)
end
-- tracks = humanoid:FindFirstChildOfClass("Animator"):GetPlayingAnimationTracks()
```

**Pickup** (P-08, P-09): on the client, play a sound with `sound.PlaybackSpeed = 1 + streak * 0.05` (capped at 1.5) so streaks climb in pitch, `emitter:Emit(12)` at the coin, and pop the coin counter:
```luau
local TweenService = game:GetService("TweenService")
local POP_SCALE, POP_SECONDS = 1.25, 0.2
local function pop(gui)
	local scale = gui:FindFirstChildOfClass("UIScale")
	if not scale then
		scale = Instance.new("UIScale")
		scale.Parent = gui
	end
	scale.Scale = POP_SCALE
	TweenService:Create(scale, TweenInfo.new(POP_SECONDS, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = 1 }):Play()
end
```
Tweening a `UIScale` leaves the element's `Size` and layout alone, so it works inside a `UIListLayout` and with any base size.

**Pitch variation** (P-09): `sound.PlaybackSpeed = 0.92 + math.random() * 0.16; sound:Play()` (or `SoundService:PlayLocalSound` for UI).

**Damage feedback** (P-10): on the victim's client, fire a short red `Highlight` or a `ColorCorrectionEffect` tint for 0.1 s, plus `Shake.add(0.3)`. Keep flashes at 3 per second or fewer (P-18).

**Coyote time** (P-05). Humanoid jumping is built in. For a grace window, remember when the character last left the ground and force the jump inside the window:
```luau
local lastGrounded = 0
humanoid.StateChanged:Connect(function(_, new)
	if new == Enum.HumanoidStateType.Running or new == Enum.HumanoidStateType.Landed then lastGrounded = os.clock() end
end)
UserInputService.JumpRequest:Connect(function()
	if humanoid.FloorMaterial == Enum.Material.Air and os.clock() - lastGrounded <= 0.12 then
		humanoid:ChangeState(Enum.HumanoidStateType.Jumping)
	end
end)
```

**Button press** (P-03): tween a `UIScale` to 0.93 on `MouseButton1Down` and back to 1 (`Back`, `Out`, 0.15 s) on `MouseButton1Up`, plus a local click sound.

**Haptics**: the Roblox docs mark `HapticService` as superseded by the `HapticEffect` instance (see RESEARCH.md). On the client, create the effect once, then play it from the moment, gated on a haptics setting:
```luau
local hitHaptic = Instance.new("HapticEffect")
hitHaptic.Type = Enum.HapticEffectType.GameplayCollision  -- also UIClick, UIHover, UINotification, GameplayExplosion, Custom
hitHaptic.Parent = workspace
-- in the hit handler: if JuiceSettings.haptics ~= false then hitHaptic:Play() end
```
Older code using `HapticService:SetMotor(Enum.UserInputType.Gamepad1, Enum.VibrationMotor.Large, 0.5)` (reset after 0.1 s) still runs; suggest the move, don't force it.

## Roblox traps

- Camera and UI effects in a server script do nothing for players. Move them to the client.
- `Touched` fires many times per contact: debounce before adding feedback, or the pickup sound plays five times (P-15).
- Verify Luau changes with roblox-agent-checks (selene, luau-lsp) when it's installed.
