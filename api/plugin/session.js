// POST /api/plugin/session { token }: finishes the Figma plugin's email-code login. The plugin traded Polar's code
// for a customer-portal token, as the site does; this checks it holds Meya Icons Pro and returns the plugin's own token.
import { json } from "../_lib/http.js";
import { cors, OPTIONS } from "../_lib/plugin.js";
import { startToken } from "../_lib/session.js";
import { tokenHolder } from "../auth/session.js";

export { OPTIONS };

export async function POST(request) {
  const r = await tokenHolder(request);
  if (r.res) return cors(r.res);
  const { s, token } = startToken(r.who);
  return cors(json(200, { signedIn: true, email: s.e, token }));
}
