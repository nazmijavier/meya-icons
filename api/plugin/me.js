// GET /api/plugin/me: /api/auth/me for the Figma plugin. Whether its token is still good, plus what the plugin needs
// to start Polar's email-code login.
import { json } from "../_lib/http.js";
import { cors, OPTIONS } from "../_lib/plugin.js";
import { API, ORG, configured } from "../_lib/polar.js";
import { current } from "../_lib/session.js";

export { OPTIONS };

export async function GET(request) {
  if (!configured()) return cors(json(200, { configured: false, signedIn: false }));
  const headers = new Headers();
  const s = await current(request, headers);
  return cors(json(200, { configured: true, signedIn: !!s, email: s ? s.e : null, polar: { api: API(), org: ORG() } }, headers));
}
