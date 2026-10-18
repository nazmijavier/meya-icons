// The site's own login session: a signed, HttpOnly cookie that says which Polar member holds Meya Icons Pro.
// The Polar token used to log in is never stored; Pro access is re-checked with Polar once a day.
import crypto from "node:crypto";
import { proGrantedTo } from "./polar.js";

// __Host-: the browser only accepts it Secure, on Path=/, for this exact host (no other meyalab.com subdomain)
const COOKIE = "__Host-meya_pro";
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

function read(req) {
  const raw = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!raw) return null;
  const [data, mac] = raw.slice(COOKIE.length + 1).split(".");
  if (!data || !mac) return null;
  const want = sign(data);
  if (mac.length !== want.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  try {
    const s = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    return s.exp > now() ? s : null;
  } catch {
    return null;
  }
}

// who: { email, customer_id, member_id }
export function start(res, who) {
  const t = now();
  const s = { e: who.email || "", c: who.customer_id || null, m: who.member_id || null, chk: t, exp: t + LIFETIME() };
  const data = b64(JSON.stringify(s));
  res.setHeader("Set-Cookie", cookieHeader(`${data}.${sign(data)}`, LIFETIME()));
  return s;
}

export function end(res) {
  res.setHeader("Set-Cookie", cookieHeader("", 0));
}

// The signed-in Pro customer, or null. Re-checks with Polar when the last check is over a day old.
export async function current(req, res) {
  const s = read(req);
  if (!s) return null;
  if (now() - s.chk < RECHECK || !process.env.POLAR_ACCESS_TOKEN) return s;
  let ok;
  try {
    ok = await proGrantedTo({ member_id: s.m, customer_id: s.c });
  } catch {
    // Polar unreachable: keep the session for a few days rather than locking a paying customer out
    return now() - s.chk < GRACE ? s : null;
  }
  if (!ok) { end(res); return null; }
  const fresh = { ...s, chk: now() };
  const data = b64(JSON.stringify(fresh));
  res.setHeader("Set-Cookie", cookieHeader(`${data}.${sign(data)}`, fresh.exp - now()));
  return fresh;
}

// POSTs must come from this site (the cookie is SameSite=Lax, this blocks the rest).
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
