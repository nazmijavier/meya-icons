// POST /api/auth/session { token }: finishes the email-code login. The browser asked Polar for a code and traded
// it for a customer-portal token; this checks that the person holds Meya Icons Pro, then starts the site's own
// session. The Polar token is used once and not kept.
import { body, json } from "../_lib/http.js";
import { configured, whoHoldsPro } from "../_lib/polar.js";
import { sameOrigin, start } from "../_lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  if (!sameOrigin(req)) return json(res, 403, { error: "origin" });
  if (!configured()) return json(res, 503, { error: "not_configured" });
  const { token } = await body(req);
  if (typeof token !== "string" || !/^polar_[a-z]+_[A-Za-z0-9_-]{10,200}$/.test(token)) return json(res, 400, { error: "invalid" });
  let r;
  try { r = await whoHoldsPro(token); } catch { return json(res, 502, { error: "polar" }); }
  if (r.error) return json(res, r.error === "no_pro" ? 403 : 401, { error: r.error, email: r.who ? r.who.email : null });
  const s = start(res, r.who);
  json(res, 200, { signedIn: true, email: s.e });
}
