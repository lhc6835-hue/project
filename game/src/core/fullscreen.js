// Fullscreen: browsers only allow it from a user gesture, so we ask on the first tap/key and again
// whenever the player taps after leaving it. Phones/tablets also get locked to landscape.
let enabled = true, asking = false;

const el = () => document.documentElement;
export const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const installed = () => matchMedia("(display-mode: fullscreen)").matches || matchMedia("(display-mode: standalone)").matches || navigator.standalone;

export function setAutoFullscreen(on) { enabled = on; if (!on && isFullscreen()) exitFullscreen(); }

export async function enterFullscreen() {
  if (isFullscreen() || asking) return;
  const e = el(), req = e.requestFullscreen ?? e.webkitRequestFullscreen;
  if (!req) return;
  asking = true;
  try {
    await req.call(e, { navigationUI: "hide" });
    try { await screen.orientation?.lock?.("landscape"); } catch { /* not supported here */ }
  } catch { /* denied or not allowed now */ }
  asking = false;
}

export function exitFullscreen() {
  const x = document.exitFullscreen ?? document.webkitExitFullscreen;
  if (isFullscreen() && x) x.call(document).catch?.(() => {});
}

export function bindAutoFullscreen(on = true) {
  enabled = on;
  const go = (ev) => {
    if (!enabled || installed()) return;
    if (ev.target?.closest?.("input, textarea")) return; // don't fight the on-screen keyboard
    enterFullscreen();
  };
  addEventListener("pointerup", go, { passive: true });
  addEventListener("keydown", go);
}
