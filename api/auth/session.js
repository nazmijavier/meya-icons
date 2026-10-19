// POST /api/auth/session { token }: finishes the email-code login. The browser asked Polar for a code and traded
// it for a customer-portal token; this checks that the person holds Meya Icons Pro, then starts the site's own
// session. The Polar token is used once and not kept.
import { body, json } from "../_lib/http.js";
import { configured, whoHoldsPro } from "../_lib/polar.js";
import { sameOrigin, start } from "../_lib/session.js";

export async function POST(request) {
  if (!sameOrigin(request)) return json(403, { error: "origin" });
  if (!configured()) return json(503, { error: "not_configured" });
  const { token } = await body(request);
  if (typeof token !== "string" || !/^polar_[a-z]+_[A-Za-z0-9_-]{10,200}$/.test(token)) return json(400, { error: "invalid" });
  let r;
  try { r = await whoHoldsPro(token); } catch (e) { return json(e.outage ? 502 : 503, { error: "polar" }); }
  if (r.error) return json(r.error === "no_pro" ? 403 : 401, { error: r.error, email: r.who ? r.who.email : null });
  const headers = new Headers();
  const s = start(headers, r.who);
  return json(200, { signedIn: true, email: s.e }, headers);
}
