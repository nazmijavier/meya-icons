// GET /api/auth/me: who is signed in, plus what the browser needs to start Polar's email-code login.
import { json } from "../_lib/http.js";
import { API, ORG, configured } from "../_lib/polar.js";
import { current } from "../_lib/session.js";

export async function GET(request) {
  if (!configured()) return json(200, { configured: false, signedIn: false });
  const headers = new Headers();
  const s = await current(request, headers);
  return json(200, { configured: true, signedIn: !!s, email: s ? s.e : null, polar: { api: API(), org: ORG() } }, headers);
}
