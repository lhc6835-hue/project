# Engine reference: Unity (C#)

Back to [SKILL.md](../../SKILL.md). Versions and sources: [RESEARCH.md](../../RESEARCH.md).

## Detect and locate

- Markers: `ProjectSettings/ProjectVersion.txt`, `Assets/**/*.cs`. Skip `Library/`, `Packages/`, `Assets/Plugins/` (vendor).
- Moments: `MonoBehaviour` methods named `Jump`, `Attack`, `TakeDamage`, `Die`, `OnTriggerEnter(2D)`, `OnCollisionEnter(2D)`; input via `Input.GetButtonDown` or the Input System (`InputAction.performed`, `PlayerInput` `On<Action>` messages); UI via `Button.onClick`, `IPointerClickHandler`; scenes via `SceneManager.LoadScene`.
- Feedback is often wired in the Inspector: a `UnityEvent`, an Animator event, or a Feel `MMF_Player` field. Grep for `[SerializeField]` fields of type `ParticleSystem`, `AudioSource`, `MMF_Player`, `CinemachineImpulseSource`, and say "assigned in Inspector, not verified" when you can't see the scene.
- Libraries: DOTween (`DG.Tweening`), Feel (`MoreMountains.Feedbacks`), PrimeTween, LitMotion, Cinemachine Impulse. When one is installed, sketch with it instead of hand-rolled code.

## Settings hook (every suggestion uses it)

```csharp
public static class JuiceSettings
{
    public static float ShakeScale = 1f;      // 0..1, exposed in the options menu
    public static bool ReduceMotion = false;  // turns off shake, kick, bob and shortens tweens
    public static bool HitStop = true;
    public static bool Flashes = true;
    public static float Shake => ReduceMotion ? 0f : ShakeScale;
}
```

## Sketches

**Hit-stop** (P-04). Use real time so the wait doesn't freeze itself, and always restore the time scale.
```csharp
public class HitStop : MonoBehaviour
{
    static HitStop _i; void Awake() => _i = this;
    public static void Do(float seconds) { if (JuiceSettings.HitStop && _i) _i.StartCoroutine(_i.Run(seconds)); }
    System.Collections.IEnumerator Run(float s)
    {
        float prev = Time.timeScale; Time.timeScale = 0f;
        yield return new WaitForSecondsRealtime(s);
        Time.timeScale = prev == 0f ? 1f : prev;
    }
}
// in TakeDamage: HitStop.Do(health <= 0 ? 0.12f : 0.05f);
```

**Trauma shake** (Eiserloh 2016; P-12). Put it on a parent of the camera, or use Cinemachine Impulse when Cinemachine drives the camera.
```csharp
public class TraumaShake : MonoBehaviour
{
    public float maxOffset = 0.3f, maxAngle = 3f, decay = 1.3f, frequency = 25f;
    float trauma; public static TraumaShake I; void Awake() => I = this;
    public void Add(float t) => trauma = Mathf.Clamp01(trauma + t);
    void LateUpdate()
    {
        float s = trauma * trauma * JuiceSettings.Shake, t = Time.unscaledTime * frequency;
        transform.localPosition = new Vector3(maxOffset * s * (Mathf.PerlinNoise(t, 0f) * 2 - 1),
                                              maxOffset * s * (Mathf.PerlinNoise(0f, t) * 2 - 1), 0);
        transform.localRotation = Quaternion.Euler(0, 0, maxAngle * s * (Mathf.PerlinNoise(t, t) * 2 - 1));
        trauma = Mathf.Max(0, trauma - decay * Time.unscaledDeltaTime);
    }
}
```
Cinemachine: `impulseSource.GenerateImpulse(force * JuiceSettings.Shake);` with a `CinemachineImpulseListener` on the camera.

**Pitch variation** (P-09): `audioSource.pitch = Random.Range(0.92f, 1.08f); audioSource.PlayOneShot(clip);`

**Hit flash** (P-10): swap `SpriteRenderer.material` to a white flash material for 0.06 s, or use `MaterialPropertyBlock` to set a `_FlashAmount` value. Skip it when `!JuiceSettings.Flashes`.

**Squash and stretch / punch** (P-03): DOTween `transform.DOPunchScale(new Vector3(0.25f, -0.25f, 0), 0.15f, 8, 0.8f);`. Without a library, lerp `localScale` to `(1.25, 0.8)` and back over 0.12 s in a coroutine. Scale the visual child, not the collider.

**Coyote time and jump buffer** (P-05):
```csharp
[SerializeField] float coyoteTime = 0.1f, jumpBuffer = 0.12f;
float lastGrounded = -1f, lastJumpPress = -1f;
void Update()
{
    if (IsGrounded()) lastGrounded = Time.time;
    if (Input.GetButtonDown("Jump")) lastJumpPress = Time.time;
    if (Time.time - lastJumpPress <= jumpBuffer && Time.time - lastGrounded <= coyoteTime)
    { DoJump(); lastJumpPress = lastGrounded = -1f; }
}
```

**UI press** (P-03, P-13): an `IPointerDownHandler` / `IPointerUpHandler` that tweens `localScale` to 0.93 over 0.05 s and back to 1 with `Ease.OutBack` over 0.15 s, plus a click sound.

**Haptics** (Input System): `Gamepad.current?.SetMotorSpeeds(0.2f, 0.6f);` then reset after 0.1 s; respect a haptics toggle.

**Particles** (P-15): pool them. Keep one `ParticleSystem` per effect and call `Emit(12)` at the hit point instead of `Instantiate` per hit.

## Unity traps

- `Time.timeScale = 0` also stops `WaitForSeconds`, `Time.deltaTime` tweens, and physics. DOTween needs `.SetUpdate(true)` to keep tweening during hit-stop.
- Shake applied to a camera that a follow script also writes gets overwritten: shake a parent or child, or add an offset after the follow in `LateUpdate`.
- A risk flagged by the scanner as `shake_per_frame` (random position every `Update`) is constant jitter. Replace it with the trauma pattern.
