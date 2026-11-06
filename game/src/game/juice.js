// Feel settings and tuning for combat feedback. Everything here is presentation: with every toggle off the
// game plays by exactly the same rules.
export const JUICE = {
  hitStop: true,   // freeze frames on contact (settings: 타격 정지)
  flashK: 1,       // scales every screen flash and the red edge (settings: 번쩍임 줄이기 → 0.3)
};

// --- tuning (starting points; tune in play) ---
export const CRIT_STOP = 0.06;          // s of hit-stop on a critical hit
export const CRIT_SHAKE = 1.6;          // px
export const KILL_STOP = 0.035;         // s on each kill
export const ELITE_KILL_STOP = 0.07;    // s on an elite kill
export const ELITE_KILL_SHAKE = 2.5;    // px
export const HURT_SHAKE = 2;            // px when the hero is hit
export const HURT_EDGE_TIME = 0.35;     // s the red screen edge lasts after a hit
export const HURT_EDGE_K = 0.55;        // strength of that edge
export const LOW_HP = 0.3;              // fraction of max HP that counts as danger
export const LOW_HP_EDGE_K = 0.28;      // strength of the slow danger pulse at the edge
export const LOW_HP_PULSE_HZ = 0.8;     // well under the 3 Hz flash limit
export const STREAK_WINDOW = 0.35;      // s between pickups that keeps a streak going
export const STREAK_STEP = 0.04;        // pitch rise per pickup in a streak
export const STREAK_MAX = 0.4;          // pitch cap
export const LAST_KILL_SLOW = 0.45;     // s of 35% time after the kill that clears a floor
export const LAST_KILL_SHAKE = 3;       // px
export const LAST_KILL_FLASH = 0.22;

/** Hold the world still for s seconds (never adds up; the longest hold wins). */
export function holdFrames(world, s) { if (JUICE.hitStop) world.stop = Math.max(world.stop, s); }

/** Apply the player's settings (called on every scene change and when an option changes). */
export function applyJuice(st) {
  JUICE.hitStop = st?.hitStop !== false;
  JUICE.flashK = st?.lessFlash ? 0.3 : 1;
  window.SHAKE = st?.shake ?? 1;
}
