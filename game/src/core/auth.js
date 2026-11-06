// Accounts: sign up / log in against the game server, keep the session token, sync the save to the cloud.
const TOKEN_KEY = "aether-heart-token";
let token = null, account = null, pushTimer = null, pending = null;

try { token = localStorage.getItem(TOKEN_KEY); } catch { /* storage blocked */ }

async function call(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method ?? "GET",
    headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) { const e = new Error(data.error ?? "서버에 연결하지 못했어요."); e.status = res.status; throw e; }
  return data;
}

function setToken(t) { token = t; try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} }

export const auth = {
  get account() { return account; },
  get loggedIn() { return !!account; },
  /** Restore the session from a stored token (if any). */
  async restore() {
    if (!token) return null;
    try { account = await call("/api/me"); return account; }
    catch (e) { if (e.status === 401) setToken(null); account = null; return null; }
  },
  async login(id, pw) { const r = await call("/api/login", { method: "POST", body: { id, pw } }); setToken(r.token); account = { id: r.id, isDev: r.isDev }; return account; },
  async signup(id, pw) { const r = await call("/api/signup", { method: "POST", body: { id, pw } }); setToken(r.token); account = { id: r.id, isDev: r.isDev }; return account; },
  async logout() { await this.flush(); try { await call("/api/logout", { method: "POST" }); } catch {} setToken(null); account = null; },
  async changePassword(old, pw) { return call("/api/password", { method: "POST", body: { old, pw } }); },
  async pull() { return call("/api/save"); },
  /** Queue the save for upload (debounced). */
  push(save) {
    if (!account) return;
    pending = save;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => this.flush(), 2500);
  },
  async flush() {
    if (!account || !pending) return;
    const s = pending; pending = null; clearTimeout(pushTimer);
    try { await call("/api/save", { method: "PUT", body: { save: s } }); } catch { pending = pending ?? s; }
  },
};

addEventListener("pagehide", () => {
  if (!account || !pending || !token) return;
  // last-chance upload when the tab closes
  fetch("/api/save", { method: "PUT", keepalive: true, headers: { "content-type": "application/json", authorization: "Bearer " + token }, body: JSON.stringify({ save: pending }) });
});
