// POST /api/auth/license { key }: signs in with a Meya Icons Pro license key, the fallback when the email code
// does not arrive. Polar's public validate endpoint confirms the key is still granted.
import { body, json } from "../_lib/http.js";
import { configured, licenseHolder } from "../_lib/polar.js";
import { sameOrigin, start } from "../_lib/session.js";

// The key in the request → { who }, or { res }, the response that says why not. Shared with /api/plugin/license.
export async function keyHolder(request) {
  if (!configured()) return { res: json(503, { error: "not_configured" }) };
  const key = String((await body(request)).key || "").trim();
  if (key.length < 8 || key.length > 200) return { res: json(400, { error: "invalid" }) };
  let r;
  try { r = await licenseHolder(key); } catch (e) { return { res: json(e.outage ? 502 : 503, { error: "polar" }) }; }
  if (r.error) return { res: json(401, { error: r.error }) };
  return { who: r.who };
}

export async function POST(request) {
  if (!sameOrigin(request)) return json(403, { error: "origin" });
  const r = await keyHolder(request);
  if (r.res) return r.res;
  const headers = new Headers();
  const s = start(headers, r.who);
  return json(200, { signedIn: true, email: s.e }, headers);
}
