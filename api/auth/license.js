// POST /api/auth/license { key }: signs in with a Meya Icons Pro license key, the fallback when the email code
// does not arrive. Polar's public validate endpoint confirms the key is still granted.
import { body, json } from "../_lib/http.js";
import { configured, licenseHolder } from "../_lib/polar.js";
import { sameOrigin, start } from "../_lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  if (!sameOrigin(req)) return json(res, 403, { error: "origin" });
  if (!configured()) return json(res, 503, { error: "not_configured" });
  const key = String((await body(req)).key || "").trim();
  if (key.length < 8 || key.length > 200) return json(res, 400, { error: "invalid" });
  let r;
  try { r = await licenseHolder(key); } catch { return json(res, 502, { error: "polar" }); }
  if (r.error) return json(res, 401, { error: r.error });
  const s = start(res, r.who);
  json(res, 200, { signedIn: true, email: s.e });
}
