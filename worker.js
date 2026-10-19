// The site on Cloudflare Workers (settings in wrangler.jsonc). Pages and images are static files from docs/,
// served by Workers static assets; requests to /api/* come here and run the functions in api/.
import { json } from "./api/_lib/http.js";
import * as geo from "./api/geo.js";
import * as pro from "./api/pro.js";
import * as license from "./api/auth/license.js";
import * as logout from "./api/auth/logout.js";
import * as me from "./api/auth/me.js";
import * as session from "./api/auth/session.js";

const ROUTES = {
  "/api/geo": geo,
  "/api/pro": pro,
  "/api/auth/license": license,
  "/api/auth/logout": logout,
  "/api/auth/me": me,
  "/api/auth/session": session,
};

export default {
  async fetch(request) {
    const route = ROUTES[new URL(request.url).pathname];
    // no function and no file for this path
    if (!route) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    const handler = route[request.method];
    if (!handler) return json(405, { error: "method" });
    try {
      return await handler(request);
    } catch (e) {
      console.error(e);
      return json(500, { error: "server" });
    }
  },
};
