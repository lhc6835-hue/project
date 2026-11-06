// Switching between guest and accounts: pick the right save, merge with the cloud, apply dev grants.
import { auth } from "./auth.js";
import { load, save, fresh, useSlot, applyAccount } from "./save.js";

/** Load the save for whoever is signed in (or the guest). Returns { save, granted }. */
export async function openSave(account, carry = null) {
  useSlot(account?.id ?? null);
  let s = load();
  if (account) {
    let cloud = null;
    try { cloud = (await auth.pull()).save; } catch { /* offline: use the local copy */ }
    if (cloud && (!s.started || (cloud.lastSeen ?? 0) >= (s.lastSeen ?? 0))) s = { ...fresh(), ...cloud };
    // a brand-new account inherits the progress made as a guest on this device
    if (!cloud && !s.started && carry?.started) s = { ...fresh(), ...carry };
  }
  const granted = applyAccount(s, account);
  save(s);
  if (account) await auth.flush();
  return { save: s, granted };
}
