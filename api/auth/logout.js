// POST /api/auth/logout: ends the session.
import { json } from "../_lib/http.js";
import { end, sameOrigin } from "../_lib/session.js";

export function POST(request) {
  if (!sameOrigin(request)) return json(403, { error: "origin" });
  const headers = new Headers();
  end(headers);
  return json(200, { signedIn: false }, headers);
}
