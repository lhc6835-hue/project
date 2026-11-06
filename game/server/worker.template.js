// AETHER HEART server: serves the game's static files and a small account API backed by Workers KV.
//   POST /api/signup   { id, pw }        → { token, id, isDev }
//   POST /api/login    { id, pw }        → { token, id, isDev }
//   GET  /api/me                          → { id, isDev }
//   POST /api/logout
//   POST /api/password { old, pw }
//   GET  /api/save                        → { save, at }
//   PUT  /api/save     { save }
// Passwords: PBKDF2-SHA256, 100k iterations, per-user salt. Sessions: random 32-byte tokens, 30 days.
const FILES = __FILES__;

const DEV_IDS = new Set(["dev"]);
const RESERVED = new Set(["dev", "admin", "root", "system", "gm", "operator"]);
const SESSION_TTL = 60 * 60 * 24 * 30;
const ID_RE = /^[a-z0-9_]{3,16}$/;
const enc = new TextEncoder();

const hexOf = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const bytesOf = (hex) => Uint8Array.from(hex.match(/../g).map((h) => parseInt(h, 16)));
async function hashPw(pw, saltHex) {
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: bytesOf(saltHex), iterations: 100000 }, key, 256);
  return hexOf(bits);
}
function sameHex(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const fail = (msg, status = 400) => json({ error: msg }, status);

async function newSession(env, id) {
  const token = hexOf(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.put("session:" + token, id, { expirationTtl: SESSION_TTL });
  return { token, id, isDev: DEV_IDS.has(id) };
}
async function whoami(req, env) {
  const m = (req.headers.get("authorization") || "").match(/^Bearer ([0-9a-f]{64})$/);
  if (!m) return null;
  const id = await env.DB.get("session:" + m[1]);
  return id ? { id, token: m[1] } : null;
}
async function body(req) { try { return await req.json(); } catch { return {}; } }

async function api(req, env, path) {
  const method = req.method;
  if (path === "/api/signup" && method === "POST") {
    const { id: rawId, pw } = await body(req);
    const id = String(rawId || "").trim().toLowerCase();
    if (!ID_RE.test(id)) return fail("아이디는 영문 소문자, 숫자, _ 로 3~16자예요.");
    if (RESERVED.has(id)) return fail("사용할 수 없는 아이디예요.");
    if (typeof pw !== "string" || pw.length < 6 || pw.length > 64) return fail("비밀번호는 6~64자예요.");
    if (await env.DB.get("user:" + id)) return fail("이미 있는 아이디예요.", 409);
    const salt = hexOf(crypto.getRandomValues(new Uint8Array(16)));
    await env.DB.put("user:" + id, JSON.stringify({ salt, hash: await hashPw(pw, salt), created: Date.now() }));
    return json(await newSession(env, id));
  }
  if (path === "/api/login" && method === "POST") {
    const { id: rawId, pw } = await body(req);
    const id = String(rawId || "").trim().toLowerCase();
    if (!ID_RE.test(id) || typeof pw !== "string") return fail("아이디 또는 비밀번호가 맞지 않아요.", 401);
    const failKey = "fails:" + id, fails = +(await env.DB.get(failKey)) || 0;
    if (fails >= 8) return fail("로그인 시도가 너무 많아요. 10분 뒤에 다시 해 주세요.", 429);
    const raw = await env.DB.get("user:" + id);
    const u = raw ? JSON.parse(raw) : null;
    if (!u || !sameHex(await hashPw(pw, u.salt), u.hash)) {
      await env.DB.put(failKey, String(fails + 1), { expirationTtl: 600 });
      return fail("아이디 또는 비밀번호가 맞지 않아요.", 401);
    }
    if (fails) await env.DB.delete(failKey);
    return json(await newSession(env, id));
  }
  const me = await whoami(req, env);
  if (!me) return fail("로그인이 필요해요.", 401);
  if (path === "/api/me" && method === "GET") return json({ id: me.id, isDev: DEV_IDS.has(me.id) });
  if (path === "/api/logout" && method === "POST") { await env.DB.delete("session:" + me.token); return json({ ok: true }); }
  if (path === "/api/password" && method === "POST") {
    const { old, pw } = await body(req);
    const u = JSON.parse(await env.DB.get("user:" + me.id));
    if (typeof old !== "string" || !sameHex(await hashPw(old, u.salt), u.hash)) return fail("지금 비밀번호가 맞지 않아요.", 401);
    if (typeof pw !== "string" || pw.length < 6 || pw.length > 64) return fail("새 비밀번호는 6~64자예요.");
    const salt = hexOf(crypto.getRandomValues(new Uint8Array(16)));
    await env.DB.put("user:" + me.id, JSON.stringify({ ...u, salt, hash: await hashPw(pw, salt) }));
    return json({ ok: true });
  }
  if (path === "/api/save" && method === "GET") {
    const raw = await env.DB.get("save:" + me.id);
    return json(raw ? JSON.parse(raw) : { save: null, at: 0 });
  }
  if (path === "/api/save" && method === "PUT") {
    const text = await req.text();
    if (text.length > 256 * 1024) return fail("저장 데이터가 너무 커요.", 413);
    let save;
    try { save = JSON.parse(text).save; } catch { return fail("잘못된 저장 데이터예요."); }
    if (!save || typeof save !== "object") return fail("잘못된 저장 데이터예요.");
    await env.DB.put("save:" + me.id, JSON.stringify({ save, at: Date.now() }));
    return json({ ok: true, at: Date.now() });
  }
  return fail("없는 요청이에요.", 404);
}

const cache = new Map();
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    let path = url.pathname;
    if (path.startsWith("/api/")) {
      try { return await api(req, env, path); } catch (e) { return fail("서버 오류가 났어요.", 500); }
    }
    if (path === "/") path = "/index.html";
    const f = FILES[path];
    if (!f) return new Response("not found", { status: 404 });
    let b = cache.get(path);
    if (!b) { b = Uint8Array.from(atob(f[1]), (c) => c.charCodeAt(0)); cache.set(path, b); }
    return new Response(b, { headers: { "content-type": f[0], "cache-control": /\.(woff2|png)$/.test(path) ? "public, max-age=604800" : "public, max-age=120" } });
  },
};
