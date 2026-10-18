// GET /api/auth/me: who is signed in, plus what the browser needs to start Polar's email-code login.
import { json } from "../_lib/http.js";
import { API, ORG, configured } from "../_lib/polar.js";
import { current } from "../_lib/session.js";

export default async function handler(req, res) {
  if (!configured()) return json(res, 200, { configured: false, signedIn: false });
  const s = await current(req, res);
  json(res, 200, { configured: true, signedIn: !!s, email: s ? s.e : null, polar: { api: API(), org: ORG() } });
}
