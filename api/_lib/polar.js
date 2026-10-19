// Calls to Polar. Settings come from environment variables (on Cloudflare: wrangler.jsonc's vars and the Worker's
// secrets):
//   POLAR_ORG_ID          the organization's id (Polar > Settings > General), in wrangler.jsonc
//   POLAR_PRO_BENEFIT_ID  the id of the "Meya Icons Pro" License Keys benefit on the Pro product, in wrangler.jsonc
//   POLAR_ACCESS_TOKEN    an organization access token with the scopes benefits:read, license_keys:read and
//                         license_keys:write: it checks access at login and daily, and validates license keys
//   POLAR_API_URL         optional, https://sandbox-api.polar.sh to test against Polar's sandbox
import crypto from "node:crypto";

export const API = () => (process.env.POLAR_API_URL || "https://api.polar.sh").replace(/\/$/, "");
export const ORG = () => process.env.POLAR_ORG_ID || "";
export const BENEFIT = () => process.env.POLAR_PRO_BENEFIT_ID || "";
const ORG_TOKEN = () => process.env.POLAR_ACCESS_TOKEN || "";
// The login only shows once a signed-in customer can also get the Pro icons (PRO_GITHUB_TOKEN, see api/pro.js).
export const configured = () => !!(ORG() && BENEFIT() && (process.env.SESSION_SECRET || "").length >= 32 && process.env.PRO_GITHUB_TOKEN);

// A short fingerprint of a license key, so a session can tell whether its key was rotated without storing the key.
export const keyHash = (key) => crypto.createHash("sha256").update(String(key)).digest("base64url").slice(0, 16);

// Polar failed in a way that says nothing about the customer (network, 5xx): callers may fall back.
class Outage extends Error {
  constructor(what, status) { super(`${what} failed (${status})`); this.outage = !status || status >= 500; this.status = status; }
}

async function call(path, { token, method = "GET", body } = {}) {
  let r;
  try {
    r = await fetch(API() + path, {
      method,
      headers: { Accept: "application/json", "User-Agent": "meya-icons-site", ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new Outage(`Polar ${path}`, 0);
  }
  const json = await r.json().catch(() => null);
  return { status: r.status, json };
}

// Does this member (or, for customers without members, this customer) hold the Pro benefit right now?
// Uses the organization token, which sees grants of every benefit type and visibility.
export async function proGrantedTo({ member_id, customer_id }) {
  const q = member_id ? `member_id=${encodeURIComponent(member_id)}` : `customer_id=${encodeURIComponent(customer_id)}`;
  const r = await call(`/v1/benefits/${encodeURIComponent(BENEFIT())}/grants?is_granted=true&limit=1&${q}`, { token: ORG_TOKEN() });
  if (r.status !== 200 || !r.json) throw new Outage("Polar grants check", r.status);
  return (r.json.items || []).length > 0;
}

// A customer-portal token (from the email-code login) → the person, if they hold the Pro benefit.
export async function whoHoldsPro(token) {
  const user = await call("/v1/customer-portal/customer-session/user", { token });
  if (user.status === 401 || user.status === 403) return { error: "invalid" };
  if (user.status !== 200 || !user.json) throw new Outage("Polar user lookup", user.status);
  const who = { email: user.json.email, customer_id: user.json.customer_id, member_id: user.json.member_id || null };
  let held;
  if (ORG_TOKEN()) {
    held = await proGrantedTo(who);
  } else {
    // without an organization token, ask with the customer's own token: lists only that member's grants of
    // benefits with public visibility (License Keys benefits are public by default)
    const g = await call(`/v1/customer-portal/benefit-grants/?benefit_id=${encodeURIComponent(BENEFIT())}&limit=10`, { token });
    if (g.status !== 200 || !g.json) throw new Outage("Polar grants lookup", g.status);
    held = (g.json.items || []).some((x) => x.is_granted && x.benefit_id === BENEFIT() && (!who.member_id || !x.member_id || x.member_id === who.member_id));
  }
  return held ? { who } : { error: "no_pro", who };
}

// A license key → the person, if the key is active and its holder holds the Pro benefit.
export async function licenseHolder(key) {
  // With the organization token Polar counts these calls against the organization, not against the function's
  // shared IP, which Polar's public endpoint limits to 3 a second.
  const r = ORG_TOKEN()
    ? await call("/v1/license-keys/validate", { method: "POST", token: ORG_TOKEN(), body: { key, organization_id: ORG() } })
    : await call("/v1/customer-portal/license-keys/validate", { method: "POST", body: { key, organization_id: ORG(), benefit_id: BENEFIT() } });
  if (r.status === 404 || r.status === 422) return { error: "invalid" };
  if (r.status !== 200 || !r.json) throw new Outage("Polar license check", r.status);
  if (r.json.status !== "granted") return { error: "invalid" };
  // a seat holder's own email when the key belongs to a seat, else the buyer's
  const who = { email: r.json.member?.email || r.json.customer?.email || "", customer_id: r.json.customer_id, member_id: r.json.member_id || null, key_id: r.json.id, key_hash: keyHash(key) };
  const pro = ORG_TOKEN() ? await proGrantedTo(who) : r.json.benefit_id === BENEFIT();
  return pro ? { who } : { error: "invalid" };
}

// Daily re-check for a session started with a license key: is that key still active and unrotated?
export async function licenseKeyActive(id, hash) {
  const r = await call(`/v1/license-keys/${encodeURIComponent(id)}`, { token: ORG_TOKEN() });
  if (r.status === 404) return false;
  if (r.status !== 200 || !r.json) throw new Outage("Polar license key check", r.status);
  const k = r.json;
  return k.status === "granted" && (!k.expires_at || Date.parse(k.expires_at) > Date.now()) && (!hash || !k.key || keyHash(k.key) === hash);
}
