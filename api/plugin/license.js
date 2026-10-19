// POST /api/plugin/license { key }: the Figma plugin signs in with a Meya Icons Pro license key and gets a token.
import { json } from "../_lib/http.js";
import { cors, OPTIONS } from "../_lib/plugin.js";
import { startToken } from "../_lib/session.js";
import { keyHolder } from "../auth/license.js";

export { OPTIONS };

export async function POST(request) {
  const r = await keyHolder(request);
  if (r.res) return cors(r.res);
  const { s, token } = startToken(r.who);
  return cors(json(200, { signedIn: true, email: s.e, token }));
}
