// POST /api/auth/logout: ends the session.
import { json } from "../_lib/http.js";
import { end, sameOrigin } from "../_lib/session.js";

export default function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  if (!sameOrigin(req)) return json(res, 403, { error: "origin" });
  end(res);
  json(res, 200, { signedIn: false });
}
