#!/usr/bin/env python3
"""juice_scan.py - map a game's feel moments and the feedback each one already has.

Usage:
  python juice_scan.py <project-root> [--md] [--out FILE] [--max-files N] [--include-vendor]

Prints one JSON object (or a Markdown moment map with --md). Pure standard
library, read-only, fails soft: on any error it still prints a JSON object
with an "error" field and exits 0. The output is the raw material for the
juice-scan skill's report; it guesses from names and calls, so every finding
is a lead to read, not a verdict.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime

VERSION = "1.1.0"

SKIP_DIRS = {
    ".git", ".hg", ".svn", "node_modules", "Library", "Temp", "Logs", "obj", "bin",
    "Build", "Builds", "build", "dist", "out", ".godot", ".import", "__pycache__",
    "venv", ".venv", "env", "Packages", "UserSettings", "Intermediate", "Binaries",
    "DerivedDataCache", "Saved", ".idea", ".vs", ".vscode", "coverage", "Pods",
    # Test suites and Unity editor-only code never reach the player.
    "Tests", "tests", "test", "Test", "__tests__", "spec", "Editor",
}
TEST_FILE = re.compile(r"(Tests?\.cs|_test\.(py|gd|lua)|\.(test|spec)\.(js|ts|jsx|tsx)|\.spec\.luau?)$|^test_\w+\.py$")
# Queries and helpers that only name a moment (HasPendingDamageReveal, GetImpactPosition, HitTest)
# are not the moment itself.
PREDICATE_NAME = re.compile(r"^(Has|Is|Can|Get|Should|Meets|Find|Compute|Calc|Count)[A-Z]|^(has|is|can|get|should|find)_|[Hh]it_?[Tt]est|^Hits$")
VENDOR_DIRS = {"Plugins", "addons", "ThirdParty", "vendor", "Vendor", "lib", "libs", "Packages"}

LANG_BY_EXT = {
    ".cs": "csharp", ".gd": "gdscript", ".lua": "lua", ".luau": "lua",
    ".js": "js", ".mjs": "js", ".ts": "js", ".jsx": "js", ".tsx": "js",
    ".py": "python", ".cpp": "cpp", ".h": "cpp", ".hpp": "cpp",
}

# --- engine detection ------------------------------------------------------

def detect_engine(root: str, files: list[str]) -> dict:
    def exists(*p):
        return os.path.exists(os.path.join(root, *p))

    evidence = []
    engine = "unknown"
    lang = None
    if exists("ProjectSettings", "ProjectVersion.txt") or (exists("Assets") and any(f.endswith(".cs") for f in files)):
        engine, lang = "unity", "csharp"
        evidence.append("ProjectSettings/ProjectVersion.txt" if exists("ProjectSettings", "ProjectVersion.txt") else "Assets/ with .cs")
    elif exists("project.godot"):
        engine, lang = "godot", "gdscript"
        evidence.append("project.godot")
    elif any(n.endswith(".uproject") for n in os.listdir(root)):
        engine, lang = "unreal", "cpp"
        evidence.append("*.uproject")
    elif exists("default.project.json") or exists("rokit.toml") or exists("wally.toml") or any(f.endswith(".luau") for f in files):
        engine, lang = "roblox", "lua"
        evidence.append(next((m for m in ("default.project.json", "rokit.toml", "wally.toml") if exists(m)), ".luau files"))
    elif exists("main.lua") and _contains(os.path.join(root, "main.lua"), r"\blove\."):
        engine, lang = "love2d", "lua"
        evidence.append("main.lua uses love.*")
    elif exists("game.project"):
        engine, lang = "defold", "lua"
        evidence.append("game.project")
    elif exists("package.json"):
        pkg = _read(os.path.join(root, "package.json"))
        for name, eng in (("phaser", "phaser"), ("pixi.js", "pixijs"), ("kaboom", "kaboom"),
                          ("kaplay", "kaplay"), ("excalibur", "excalibur"), ("three", "threejs")):
            if f'"{name}"' in pkg:
                engine, lang = eng, "js"
                evidence.append(f"package.json depends on {name}")
                break
        if engine == "unknown":
            engine, lang = "web", "js"
            evidence.append("package.json")
    if engine == "unknown":
        for f in files:
            if f.endswith(".py") and _contains(f, r"^\s*import pygame|^\s*from pygame"):
                engine, lang = "pygame", "python"
                evidence.append(os.path.relpath(f, root) + " imports pygame")
                break
    if engine == "unknown":
        for f in files:
            if f.endswith((".js", ".ts")) and _contains(f, r"new Phaser\.Game|from ['\"]phaser['\"]"):
                engine, lang = "phaser", "js"
                evidence.append(os.path.relpath(f, root))
                break
            if f.endswith((".js", ".ts")) and _contains(f, r"PIXI\.|from ['\"]pixi\.js['\"]"):
                engine, lang = "pixijs", "js"
                evidence.append(os.path.relpath(f, root))
                break
    return {"engine": engine, "language": lang, "evidence": evidence}


LIBRARY_PATTERNS = [
    ("DOTween", r"using DG\.Tweening|\bDOTween\b"),
    ("Feel (MMFeedbacks)", r"MoreMountains\.Feedbacks|MMF_Player|MMFeedbacks"),
    ("PrimeTween", r"using PrimeTween|\bTween\.(Position|Scale|ShakeCamera|PunchScale)"),
    ("LitMotion", r"using LitMotion|LMotion\."),
    ("LeanTween", r"\bLeanTween\."),
    ("Cinemachine Impulse", r"CinemachineImpulseSource|GenerateImpulse"),
    ("Godot Tween", r"create_tween\(|\bTween\.TRANS_|set_trans\("),
    ("Roblox TweenService", r"TweenService"),
    ("GSAP", r"\bgsap\.|from ['\"]gsap['\"]"),
    ("Phaser tweens", r"this\.tweens\.add|tweens\.chain"),
    ("Phaser camera FX", r"cameras\.main\.(shake|flash|fade)"),
    ("PixiJS particle-emitter", r"particle-emitter|new Emitter\("),
    ("tween.js", r"TWEEN\.Tween|@tweenjs"),
    ("pytweening", r"import pytweening"),
    ("flux/tween.lua (LOVE)", r"require\s*\(?['\"](flux|tween)['\"]"),
]

# --- function splitting ----------------------------------------------------

CS_FUNC = re.compile(
    r"^\s*(?:\[[^\]]*\]\s*)*(?:(?:public|private|protected|internal|static|override|virtual|async|sealed|abstract|new|unsafe|extern)\s+)*"
    r"(?:[\w<>\[\],.?]+\s+)(\w+)\s*\([^;{]*\)?\s*(?:where\s+[^{]*)?\{?\s*$")
GD_FUNC = re.compile(r"^\s*(?:static\s+)?func\s+(\w+)")
LUA_FUNC = [
    re.compile(r"^\s*(?:local\s+)?function\s+([\w.:]+)\s*\("),
    re.compile(r"^\s*(?:local\s+)?([\w.]+)\s*=\s*function\s*\("),
    re.compile(r"([\w.]+)\s*:\s*Connect\(\s*function"),
]
JS_FUNC = [
    re.compile(r"^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*(\w+)\s*\("),
    re.compile(r"^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|\w+\s*=>)"),
    re.compile(r"^\s*(?:public\s+|private\s+|protected\s+|static\s+|async\s+|override\s+)*(\w+)\s*\([^)]*\)\s*(?::\s*[\w<>\[\]| ]+)?\s*\{\s*$"),
    re.compile(r"^\s*(\w+)\s*:\s*(?:async\s*)?function\s*\("),
]
PY_FUNC = re.compile(r"^\s*(?:async\s+)?def\s+(\w+)")
CPP_FUNC = re.compile(r"^\s*[\w:<>*&\s]+?\b(\w+)::(\w+)\s*\([^;]*\)\s*(?:const)?\s*(?:override)?\s*\{?\s*$")
NOT_FUNC = {"if", "for", "foreach", "while", "switch", "return", "catch", "using", "lock", "else", "new",
            "function", "elseif", "with", "typeof", "sizeof", "nameof", "base", "this", "get", "set"}


def split_functions(lines: list[str], lang: str) -> list[tuple[str, int, int]]:
    """Return (name, start_line_1based, end_line_exclusive_1based)."""
    starts: list[tuple[str, int]] = []
    for i, line in enumerate(lines):
        name = None
        if lang == "csharp":
            m = CS_FUNC.match(line)
            if m and m.group(1) not in NOT_FUNC and "=" not in line.split("(")[0]:
                name = m.group(1)
        elif lang == "gdscript":
            m = GD_FUNC.match(line)
            name = m.group(1) if m else None
        elif lang == "lua":
            for rx in LUA_FUNC:
                m = rx.search(line)
                if m:
                    name = m.group(1) + (" handler" if "Connect" in rx.pattern else "")
                    break
        elif lang == "js":
            for rx in JS_FUNC:
                m = rx.match(line)
                if m and m.group(1) not in NOT_FUNC:
                    name = m.group(1)
                    break
        elif lang == "python":
            m = PY_FUNC.match(line)
            name = m.group(1) if m else None
        elif lang == "cpp":
            m = CPP_FUNC.match(line)
            if m and m.group(2) not in NOT_FUNC:
                name = f"{m.group(1)}::{m.group(2)}"
        if name:
            starts.append((name, i + 1))
    out = []
    for idx, (name, start) in enumerate(starts):
        end = starts[idx + 1][1] if idx + 1 < len(starts) else len(lines) + 1
        out.append((name, start, end))
    return out

# --- moments and feedback --------------------------------------------------

# (moment, name regex, body regex). Name matches weigh 3, body matches 1.
MOMENTS = [
    ("jump", r"jump|leap|hop", r"\bjump|is_on_floor|isGrounded|IsGrounded|JumpPower|Humanoid\.Jump|velocity\.y\s*=\s*-|\.Jump\b"),
    ("attack", r"attack|shoot|fire|swing|slash|strike|cast|punch|melee|bullet", r"Instantiate\(.*(bullet|projectile)|spawn_?bullet|projectile|\bfire\b"),
    ("hit", r"hit|damage|hurt|takedamage|take_damage|on_?hit|impact|collide|collision", r"health\s*-=|hp\s*-=|lives\s*-=|TakeDamage|take_damage|take_hit|\bdamage\b|Health\s*=\s*.*-|colliderect|OnCollisionEnter|OnTriggerEnter"),
    ("death", r"die\b|^die|death|dead|kill|gameover|game_over|explode|destroy", r"Destroy\(gameObject|queue_free\(\)|:Destroy\(\)|health\s*<=\s*0|hp\s*<=\s*0|game_?over"),
    ("pickup", r"pickup|pick_up|collect|coin|gem|item|powerup|power_up|loot", r"coins?\s*\+=|collect|pickup|:Destroy\(\).*coin"),
    ("score", r"score|points|combo|addscore|add_score", r"score\s*\+=|Score\s*\+=|score\s*=\s*score\s*\+|leaderstats"),
    ("ui_button", r"onclick|on_click|button|pressed|menu|onpointer|mousebutton1click|hover", r"onClick|\.pressed\.connect|MouseButton1Click|addEventListener\(['\"](click|pointerdown)|setInteractive|on\(['\"]pointerdown"),
    ("transition", r"loadscene|load_scene|change_scene|transition|fade|nextlevel|next_level|restart|teleport", r"SceneManager\.LoadScene|change_scene_to|scene\.start|TeleportAsync|location\.href"),
    ("camera", r"camera|cam\b|follow", r"Camera\.main|camera\.|Camera2D|CurrentCamera|cameras\.main"),
    ("card_play", r"playcard|play_card|cardplayed|card_played|tryplay|castcard|cast_card", r"OnCardPlayed|card_played|PlayCard\(|play_card\(|discardPile|discard_pile"),
    ("card_draw", r"drawcard|draw_card|carddraw|dealcard|deal_card|drawsequence|singledraw|drawhand|draw_hand", r"DrawCard\(|draw_card\(|hand\.Add\(|hand\.append\(|hand\.push\(|deck\.Draw"),
    ("turn", r"endturn|end_turn|turnended|turn_ended|nextturn|next_turn|startturn|turnstarted|newround|new_round", r"OnTurnEnded|turn_ended|EndTurn\(|end_turn\(|turnNumber\s*\+\+|turn\s*\+=\s*1"),
    ("movement", r"^move|movement|walk|run\b|dash", r"velocity|move_and_slide|MoveTo|AddForce|\.Move\(|transform\.position\s*\+=|rect\.(x|y)\s*[+-]="),
    ("input", r"input|keydown|keypressed|keypress|onmove|onjump|_unhandled_input", r"Input\.Get|InputAction|UserInputService|ContextActionService|is_action_just_pressed|KEYDOWN|keyboard\.|love\.keypressed|addEventListener\(['\"]key"),
]
MOMENT_NAME_RX = [(m, re.compile(n, re.I), re.compile(b)) for m, n, b in MOMENTS]

FEEDBACK = {
    "visual": r"Particle|particle|emitter|Emitter|\bflash|Flash|tint|modulate\b|\.color\s*=|Color\s*=|vfx|VFX|\bfx\b|explosion|Explosion|spawn_?effect|trail|Trail|dust|sparks?",
    "motion": r"DOTween|\.DO[A-Z]\w*\(|\btween|Tween|[Ll]erp\(|ease|Ease|SmoothDamp|AnimationCurve|squash|stretch|PunchScale|DOPunch|scale\s*=|localScale\s*=",
    "camera": r"[Ss]hake|Impulse|trauma|cameras\.main\.(shake|flash|zoom)|FieldOfView|\bfov\b|zoom|camera.*offset|Camera.*Offset",
    "audio": r"AudioSource|PlayOneShot|AudioStreamPlayer|\bSound\b|:Play\(\)|sound|Sound|sfx|SFX|audio|Audio|mixer\.|love\.audio|playSound|\.play\(\s*['\"]",
    "ui": r"setText\(|popup|Popup|DamageNumber|damage_number|floating_?text|FloatingText|\bText\b|\.text\s*=|Label|label\.|HUD|hud|TextLabel",
    "haptic": r"SetMotorSpeeds|[Vv]ibrat|Haptic|rumble|Rumble|start_joy_vibration|navigator\.vibrate|SetMotor",
    "timing": r"hit_?stop|HitStop|hitStop|freeze_?frame|\.freeze\(|[Ff]reeze[A-Z_]\w*\(|timeScale|time_scale|Engine\.time_scale|coyote|Coyote|jump_?buffer|JumpBuffer|inputBuffer|input_buffer|grace|slow_?mo|SlowMo",
    "animation": r"Animator|SetTrigger|AnimationPlayer|\.play\(\"|LoadAnimation|anims\.play|:Play\(\)|animation\.play|AnimatedSprite",
}
FEEDBACK_RX = {k: re.compile(v) for k, v in FEEDBACK.items()}

# What a well-fed moment usually has. A gap is a lead, not a rule (see juice-principles).
EXPECTED = {
    "jump": ["motion", "audio", "visual", "timing"],
    "attack": ["audio", "visual", "camera", "animation"],
    "hit": ["timing", "visual", "camera", "audio", "ui", "haptic"],
    "death": ["visual", "audio", "camera", "timing"],
    "pickup": ["audio", "visual", "motion", "ui"],
    "score": ["ui", "motion", "audio"],
    "ui_button": ["motion", "audio"],
    "transition": ["motion", "audio"],
    "camera": ["motion"],
    "movement": ["visual", "motion", "audio"],
    "input": ["timing"],
    "card_play": ["motion", "audio", "visual"],
    "card_draw": ["motion", "audio"],
    "turn": ["motion", "audio", "ui"],
}

PROJECT_CHECKS = {
    "pitch_variation": r"pitch\s*=\s*.*[Rr]andom|Random\.Range\([^)]*\).*pitch|pitch_scale\s*=\s*rand|randf_range|PlaybackSpeed\s*=\s*.*random|setRate|detune|rate\s*:\s*Phaser\.Math|pitch.*random\.uniform",
    "reduce_motion_toggle": r"reduce_?motion|reduceMotion|ReduceMotion|prefers-reduced-motion|screen_?shake_?(enabled|intensity|strength|scale)|ScreenShake(Enabled|Intensity|Scale)|shakeEnabled|shake_enabled|camera_?shake_?(enabled|scale)",
    "flash_limit": r"flash_?limit|max_?flash|photosensitiv|epilep|flashes_per_second|FlashLimit",
    "coyote_time": r"coyote|Coyote",
    "jump_buffer": r"jump_?buffer|JumpBuffer|jumpBuffer|input_?buffer|InputBuffer",
    "hit_stop": r"hit_?stop|HitStop|hitStop|freeze_?frame|\.freeze\(|FreezeFrame|hit_?pause|HitPause",
    "screen_shake": r"[Ss]hake|Impulse|trauma",
}
PROJECT_RX = {k: re.compile(v) for k, v in PROJECT_CHECKS.items()}

# Over-juice / risk heuristics, checked line by line.
RISKS = [
    ("timescale_zero", r"(timeScale|time_scale)\s*=\s*0(\.0)?\b", "Time is frozen here; confirm it is restored on every path (including scene change and pause) or the game can lock."),
    ("spawn_in_update", None, "Effects are instantiated inside a per-frame function; pool them or rate-limit to avoid GC spikes and visual noise."),
    ("shake_per_frame", None, "Camera shake is triggered from a per-frame function; continuous shake reads as noise and causes motion sickness."),
    ("full_screen_flash", r"cameras\.main\.flash|FullScreenFlash|screen_?flash|ScreenFlash|flash_?screen", "Full-screen flash: keep it under 3 flashes per second and offer a way to turn it off (WCAG 2.3.1, photosensitivity)."),
]
PER_FRAME = re.compile(r"^(Update|LateUpdate|FixedUpdate|_process|_physics_process|update|love\.update|Heartbeat handler|RenderStepped handler|Stepped handler|tick|Tick)$")
SPAWN_RX = re.compile(r"Instantiate\(|\.instantiate\(\)|Instance\.new\(\s*['\"](ParticleEmitter|Part)|createEmitter|add\.particles|new Emitter\(")
SHAKE_CALL = re.compile(r"[Ss]hake\(|GenerateImpulse\(|cameras\.main\.shake\(|add_trauma\(|AddTrauma\(")
AUDIO_CALL = re.compile(FEEDBACK["audio"])
JITTER_RX = re.compile(r"(position|offset|Position|Offset|CFrame)\s*[+*]?=\s*.*(Random\.(insideUnit\w+|Range)|randf|rand_range|math\.random|Math\.random|random\.uniform)")

# --- helpers ---------------------------------------------------------------

def _read(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            return fh.read()
    except OSError:
        return ""


def _contains(path: str, rx: str) -> bool:
    return re.search(rx, _read(path), re.M) is not None


def walk(root: str, include_vendor: bool, max_files: int) -> tuple[list[str], list[str]]:
    files, vendor = [], []
    for dirpath, dirnames, filenames in os.walk(root):
        keep = []
        for d in dirnames:
            if d in SKIP_DIRS or d.startswith("."):
                continue
            if not include_vendor and d in VENDOR_DIRS:
                vendor.append(os.path.relpath(os.path.join(dirpath, d), root))
                continue
            keep.append(d)
        dirnames[:] = keep
        for f in filenames:
            if TEST_FILE.search(f):
                continue
            if os.path.splitext(f)[1].lower() in LANG_BY_EXT:
                files.append(os.path.join(dirpath, f))
                if len(files) >= max_files:
                    return files, vendor
    return files, vendor


def classify(name: str, body: str, rel: str = "", nlines: int = 0) -> list[tuple[str, int]]:
    scores = []
    short = name.split(".")[-1].split(":")[-1]
    per_frame = bool(PER_FRAME.match(short) or PER_FRAME.match(name))
    # Long game-loop functions often hold several moments inline; accept weaker evidence there.
    threshold = 1 if nlines >= 25 else 2
    camera_file = "camera" in os.path.basename(rel).lower()
    if PREDICATE_NAME.search(short):
        return []
    for moment, name_rx, body_rx in MOMENT_NAME_RX:
        s = 0
        if name_rx.search(name.replace(" handler", "")):
            s += 3
        hits = len(body_rx.findall(body))
        s += min(hits, 3)
        if per_frame and moment == "movement" and hits:
            s += 1
        if camera_file and moment == "camera":
            s += 3
        if s >= threshold:
            scores.append((moment, s))
    scores.sort(key=lambda t: -t[1])
    return scores


def scan(root: str, include_vendor: bool = False, max_files: int = 4000) -> dict:
    root = os.path.abspath(root)
    files, vendor = walk(root, include_vendor, max_files)
    eng = detect_engine(root, files)
    libs: set[str] = set()
    project_flags = {k: [] for k in PROJECT_CHECKS}
    moments = []
    risks = []
    func_count = 0

    for path in files:
        rel = os.path.relpath(path, root).replace("\\", "/")
        lang = LANG_BY_EXT[os.path.splitext(path)[1].lower()]
        text = _read(path)
        if not text:
            continue
        for lib, rx in LIBRARY_PATTERNS:
            if re.search(rx, text):
                libs.add(lib)
        for k, rx in PROJECT_RX.items():
            m = rx.search(text)
            if m and len(project_flags[k]) < 5:
                line = text.count("\n", 0, m.start()) + 1
                project_flags[k].append(f"{rel}:{line}")
        lines = text.splitlines()
        for name, start, end in split_functions(lines, lang):
            func_count += 1
            body = "\n".join(lines[start - 1:end - 1])
            short = name.split(".")[-1].split(":")[-1]
            # risks
            for rid, rx, why in RISKS:
                if rx and re.search(rx, body):
                    risks.append({"id": rid, "file": rel, "function": name, "line": start, "why": why})
            if PER_FRAME.match(short) or PER_FRAME.match(name):
                if SPAWN_RX.search(body):
                    risks.append({"id": "spawn_in_update", "file": rel, "function": name, "line": start, "why": RISKS[1][2]})
                if (SHAKE_CALL.search(body) or JITTER_RX.search(body)) and not re.search(r"\bif\b", body):
                    risks.append({"id": "shake_per_frame", "file": rel, "function": name, "line": start, "why": RISKS[2][2]})
            cls = classify(name, body, rel, end - start)
            if not cls:
                continue
            feedback = {}
            for cat, rx in FEEDBACK_RX.items():
                found = sorted(set(m.group(0) for m in rx.finditer(body)))[:4]
                if found:
                    feedback[cat] = found
            primary = cls[0][0]
            expected = EXPECTED.get(primary, [])
            gaps = [c for c in expected if c not in feedback]
            moments.append({
                "moment": primary,
                "also": [m for m, _ in cls[1:3]],
                "file": rel,
                "function": name,
                "line": start,
                "lines": end - start,
                "language": lang,
                "feedback": feedback,
                "gaps": gaps,
                "confidence": "high" if cls[0][1] >= 4 else "medium" if cls[0][1] >= 3 else "low",
            })

    # project-level findings
    findings = []
    if project_flags["screen_shake"] and not project_flags["reduce_motion_toggle"]:
        findings.append({"id": "no_shake_toggle", "severity": "high",
                         "why": "Screen shake exists but no reduce-motion or shake-intensity setting was found (accessibility: motion sickness, vestibular disorders).",
                         "where": project_flags["screen_shake"]})
    has_audio = any("audio" in m["feedback"] for m in moments)
    if has_audio and not project_flags["pitch_variation"]:
        findings.append({"id": "no_pitch_variation", "severity": "medium",
                         "why": "Sounds play but no pitch randomization was found; repeated identical samples fatigue the ear (machine-gun effect)."})
    if any(m["moment"] == "jump" for m in moments):
        if not project_flags["coyote_time"]:
            findings.append({"id": "no_coyote_time", "severity": "medium", "why": "Jumping exists but no coyote-time grace window was found."})
        if not project_flags["jump_buffer"]:
            findings.append({"id": "no_jump_buffer", "severity": "medium", "why": "Jumping exists but no jump/input buffer was found."})
    if any(m["moment"] == "hit" for m in moments) and not project_flags["hit_stop"]:
        findings.append({"id": "no_hit_stop", "severity": "medium", "why": "Hits exist but no hit-stop / freeze-frame was found."})

    by_moment: dict[str, int] = {}
    for m in moments:
        by_moment[m["moment"]] = by_moment.get(m["moment"], 0) + 1
    order = {"high": 0, "medium": 1, "low": 2}
    moments.sort(key=lambda m: (order[m["confidence"]], -len(m["gaps"]), m["file"], m["line"]))

    return {
        "tool": "juice_scan.py", "version": VERSION,
        "scanned_at": datetime.now().isoformat(timespec="seconds"),
        "root": root,
        "engine": eng,
        "libraries": sorted(libs),
        "files_scanned": len(files),
        "functions_seen": func_count,
        "vendor_dirs_skipped": vendor[:20],
        "moment_counts": by_moment,
        "moments": moments,
        "project_flags": project_flags,
        "findings": findings,
        "risks": risks,
        "note": "Heuristic map from names and calls. Read each function before suggesting; confidence=low entries are often false positives.",
    }


def to_markdown(r: dict) -> str:
    out = [f"# Juice scan: {os.path.basename(r['root'])}", "",
           f"Engine: **{r['engine']['engine']}** ({', '.join(r['engine']['evidence']) or 'no marker'}). "
           f"Files: {r['files_scanned']}, functions: {r['functions_seen']}. "
           f"Libraries: {', '.join(r['libraries']) or 'none found'}.", "",
           "| Moment | File | Function | Line | Has | Gaps | Conf. |", "|---|---|---|---|---|---|---|"]
    for m in r["moments"]:
        out.append(f"| {m['moment']} | {m['file']} | `{m['function']}` | {m['line']} | "
                   f"{', '.join(m['feedback']) or '-'} | {', '.join(m['gaps']) or '-'} | {m['confidence']} |")
    if r["findings"]:
        out += ["", "## Project findings", ""] + [f"- **{f['id']}** ({f['severity']}): {f['why']}" for f in r["findings"]]
    if r["risks"]:
        out += ["", "## Risks (possible over-juicing or bugs)", ""] + [
            f"- **{x['id']}** `{x['function']}` in {x['file']}:{x['line']}: {x['why']}" for x in r["risks"]]
    return "\n".join(out) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("root")
    ap.add_argument("--md", action="store_true", help="print a Markdown moment map instead of JSON")
    ap.add_argument("--out", help="also write the output to this file")
    ap.add_argument("--max-files", type=int, default=4000)
    ap.add_argument("--include-vendor", action="store_true", help="scan Plugins/, addons/, vendor/ too")
    a = ap.parse_args(argv)
    try:
        if not os.path.isdir(a.root):
            raise FileNotFoundError(f"not a directory: {a.root}")
        result = scan(a.root, a.include_vendor, a.max_files)
        text = to_markdown(result) if a.md else json.dumps(result, indent=2)
    except Exception as exc:  # fail soft
        text = json.dumps({"tool": "juice_scan.py", "version": VERSION, "error": f"{type(exc).__name__}: {exc}"})
    if a.out:
        try:
            with open(a.out, "w", encoding="utf-8") as fh:
                fh.write(text)
        except OSError as exc:
            sys.stderr.write(f"could not write {a.out}: {exc}\n")
    sys.stdout.write(text if text.endswith("\n") else text + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
