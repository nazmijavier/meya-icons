// POST /api/auth/license { key }: signs in with a Meya Icons Pro license key, the fallback when the email code
// does not arrive. Polar's public validate endpoint confirms the key is still granted.
import { body, json } from "../_lib/http.js";
import { configured, licenseHolder } from "../_lib/polar.js";
import { sameOrigin, start } from "../_lib/session.js";

export async function POST(request) {
  if (!sameOrigin(request)) return json(403, { error: "origin" });
  if (!configured()) return json(503, { error: "not_configured" });
  const key = String((await body(request)).key || "").trim();
  if (key.length < 8 || key.length > 200) return json(400, { error: "invalid" });
  let r;
  try { r = await licenseHolder(key); } catch (e) { return json(e.outage ? 502 : 503, { error: "polar" }); }
  if (r.error) return json(401, { error: r.error });
  const headers = new Headers();
  const s = start(headers, r.who);
  return json(200, { signedIn: true, email: s.e }, headers);
}
