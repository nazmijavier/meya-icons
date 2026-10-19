// Shared by the Figma plugin's functions in api/plugin/. The plugin's window has no origin of its own (it sends
// Origin: null), so it cannot use the site's cookie: it signs in through these functions and sends its session as
// a bearer token. They answer any origin, which is safe because none of them reads a cookie.
import { TOKEN_HEADER } from "./session.js";

export function cors(response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Expose-Headers", TOKEN_HEADER);
  return response;
}

// The preflight the Authorization header causes.
export function OPTIONS() {
  return cors(new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "86400" },
  }));
}
