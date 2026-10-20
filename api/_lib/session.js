// The site's own login session: a signed, HttpOnly cookie that says which Polar member holds Meya Icons Pro.
// The Polar token used to log in is never stored; Pro access is re-checked with Polar once a day.
// The Figma plugin holds the same session as a bearer token instead (its window has no origin of its own, so no
// cookie reaches the site from it). A token is marked t: "plugin", so a cookie and a token never pass for each other.
import crypto from "node:crypto";
import { accessListed } from "./access.js";
import { licenseKeyActive, proGrantedTo } from "./polar.js";

// __Host-: the browser only accepts it Secure, on Path=/, for this exact host (no other meyalab.com subdomain)
const COOKIE = "__Host-meya_pro";
// a plugin token re-checked with Polar comes back renewed in this response header, for the plugin to keep
export const TOKEN_HEADER = "X-Meya-Token";
const DAY = 86400;
// With an organization token the server re-checks access daily, so a session can last 30 days; without one it
// cannot notice a cancelled seat, so sessions end after 7 days.
const LIFETIME = () => (process.env.POLAR_ACCESS_TOKEN ? 30 : 7) * DAY;
const RECHECK = DAY, GRACE = 3 * DAY;

const now = () => Math.floor(Date.now() / 1000);
const b64 = (s) => Buffer.from(s).toString("base64url");
function secret() {
  const s = process.env.SESSION_SECRET || "";
  if (s.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 random characters");
  return s;
}
const sign = (data) => crypto.createHmac("sha256", secret()).update(data).digest("base64url");

function cookieHeader(value, maxAge) {
  return `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

const seal = (s) => { const data = b64(JSON.stringify(s)); return `${data}.${sign(data)}`; };

// The cookie, or the plugin's "Authorization: Bearer <token>".
function credential(request) {
  const auth = request.headers.get("authorization") || "";
  if (/^Bearer\s/i.test(auth)) return { value: auth.replace(/^Bearer\s+/i, "").trim(), plugin: true };
  const raw = (request.headers.get("cookie") || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  return raw ? { value: raw.slice(COOKIE.length + 1), plugin: false } : null;
}

function read(request) {
  const cred = credential(request);
  if (!cred) return null;
  const [data, mac] = cred.value.split(".");
  if (!data || !mac) return null;
  const want = sign(data);
  const a = Buffer.from(mac), b = Buffer.from(want); // compare bytes: a non-ASCII cookie must not throw
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    return s.exp > now() && (s.t === "plugin") === cred.plugin ? s : null;
  } catch {
    return null;
  }
}

// who: { email, customer_id, member_id, key_id?, key_hash?, access?, access_hash? } (the key fields when signed
// in with a license key, the access fields with an access code)
function session(who) {
  const t = now();
  const s = { e: who.email || "", c: who.customer_id || null, m: who.member_id || null, chk: t, exp: t + LIFETIME() };
  if (who.key_id) { s.k = who.key_id; s.h = who.key_hash; }
  if (who.access) { s.a = who.access; s.ah = who.access_hash; }
  return s;
}

// The functions below write the cookie into `headers`, the response headers the caller returns.
export function start(headers, who) {
  const s = session(who);
  headers.set("Set-Cookie", cookieHeader(seal(s), LIFETIME()));
  return s;
}

// The Figma plugin's session: the same, as a token the plugin keeps and sends back as "Authorization: Bearer".
export function startToken(who) {
  const s = { ...session(who), t: "plugin" };
  return { s, token: seal(s) };
}

export function end(headers) {
  headers.set("Set-Cookie", cookieHeader("", 0));
}

// Re-check verdicts per warm instance, so a stale cookie replayed many times does not call Polar on every request.
const rechecks = new Map(); // member or customer (+ key) -> { ok, at }
const RECHECK_MEMO = 10 * 60 * 1000;

// The signed-in Pro customer, or null. Re-checks with Polar when the last check is over a day old.
export async function current(request, headers) {
  const s = read(request);
  if (!s) return null;
  // an access-code session has no Polar account to re-check: it lasts while its code is listed
  if (s.a) {
    if (accessListed(s.a, s.ah)) return s;
    if (!s.t) end(headers);
    return null;
  }
  if (now() - s.chk < RECHECK || !process.env.POLAR_ACCESS_TOKEN) return s;
  const who = `${s.m || s.c}|${s.k || ""}`, memo = rechecks.get(who);
  let ok;
  if (memo && Date.now() - memo.at < RECHECK_MEMO) ok = memo.ok;
  else {
    try {
      ok = await proGrantedTo({ member_id: s.m, customer_id: s.c });
      if (ok && s.k) ok = await licenseKeyActive(s.k, s.h); // a disabled or rotated key ends its sessions
    } catch (e) {
      // only an outage (network, 5xx) earns the grace period; a 4xx or 429 is no reason to keep a session open
      return e.outage && now() - s.chk < GRACE ? s : null;
    }
    if (rechecks.size > 5000) rechecks.clear();
    rechecks.set(who, { ok, at: Date.now() });
  }
  // a plugin token has no cookie to clear: the plugin drops it when it gets a 401
  if (!ok) { if (!s.t) end(headers); return null; }
  const fresh = { ...s, chk: now() };
  if (s.t) headers.set(TOKEN_HEADER, seal(fresh));
  else headers.set("Set-Cookie", cookieHeader(seal(fresh), fresh.exp - now()));
  return fresh;
}

// POSTs must come from this site (the cookie is SameSite=Lax, this blocks the rest).
export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}
