// Stand-in for the Cloudflare API endpoints scripts/cloudflare.mjs uses, with state and a log of writes.
import http from "node:http";
const Z = "a".repeat(32), A = "b".repeat(32);
export const state = {
  tokenOk: true, zoneVisible: true, zoneStatus: "active", dropRouteAfterPost: false, subdomain: null, taken: ["meyalab"], scripts: [], secrets: [],
  records: [{ id: "c".repeat(32), type: "CNAME", name: "icons.meyalab.com", content: "cname.vercel-dns.com", proxied: false, ttl: 1 },
            { id: "d".repeat(32), type: "A", name: "meyalab.com", content: "1.2.3.4", proxied: true, ttl: 1 }],
  routes: [{ id: "e".repeat(32), pattern: "meyalab.com/blog*", script: "other" }],
  settings: { always_use_https: "off", ssl: "flexible" },
};
export const writes = [];
const ok = (res, result) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ success: true, errors: [], result })); };
const err = (res, status, code, message) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify({ success: false, errors: [{ code, message }], result: null })); };
let n = 0;
export const server = http.createServer(async (req, res) => {
  let raw = ""; for await (const c of req) raw += c;
  const body = raw ? JSON.parse(raw) : null;
  const u = new URL(req.url, "http://x"), p = u.pathname.replace(/^\/client\/v4/, ""), m = req.method;
  if (req.headers.authorization !== "Bearer good-token" || !state.tokenOk) return err(res, 403, 9109, "Invalid access token");
  if (m !== "GET") writes.push(`${m} ${p.replace(/[0-9a-f]{32}/g, "ID")} ${raw}`);
  if (m === "GET" && p === "/zones") return ok(res, state.zoneVisible && u.searchParams.get("name") === "meyalab.com" ? [{ id: Z, name: "meyalab.com", status: state.zoneStatus, type: "full", name_servers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"], account: { id: A, name: "Meya" } }] : []);
  if (p === `/accounts/${A}/workers/subdomain`) {
    if (m === "GET") return state.subdomain ? ok(res, { subdomain: state.subdomain }) : err(res, 404, 10007, "workers.api.error.subdomain_not_found");
    if (state.taken.includes(body.subdomain)) return err(res, 409, 10031, "subdomain unavailable");
    state.subdomain = body.subdomain; return ok(res, { subdomain: body.subdomain });
  }
  if (m === "GET" && p === `/accounts/${A}/workers/scripts`) return ok(res, state.scripts.map((id) => ({ id })));
  if (m === "GET" && p === "/user") return ok(res, { email: "owner@example.com" });
  if (m === "GET" && p === "/accounts") return ok(res, [{ id: A, name: "Meya Lab" }, { id: "1".repeat(32), name: "Other Co" }]);
  if (m === "GET" && p === `/accounts/${A}/workers/scripts/meya-icons/deployments`) return ok(res, { deployments: state.scripts.includes("meya-icons") ? [{ id: "dep2", versions: [{ version_id: "v-new-canary", percentage: 10 }, { version_id: "v-live", percentage: 90 }] }, { id: "dep1", versions: [{ version_id: "v-old", percentage: 100 }] }] : [] });
  if (m === "GET" && p === `/accounts/${A}/workers/scripts/meya-icons/secrets`) return state.scripts.includes("meya-icons") ? ok(res, state.secrets.map((name) => ({ name, type: "secret_text" }))) : err(res, 404, 10007, "script not found");
  if (p === `/zones/${Z}/dns_records`) {
    if (m === "GET") return ok(res, state.records.filter((r) => (!u.searchParams.get("name") || r.name === u.searchParams.get("name")) && (u.searchParams.get("proxied") !== "true" || r.proxied)));
    const r = { id: String(++n).padStart(32, "f"), ...body }; state.records.push(r); return ok(res, r);
  }
  let mm;
  if ((mm = p.match(new RegExp(`^/zones/${Z}/dns_records/([0-9a-f]{32})$`))) && m === "PATCH") { const r = state.records.find((x) => x.id === mm[1]); Object.assign(r, body); return ok(res, r); }
  if ((mm = p.match(new RegExp(`^/zones/${Z}/dns_records/([0-9a-f]{32})$`))) && m === "DELETE") { state.records = state.records.filter((x) => x.id !== mm[1]); return ok(res, { id: mm[1] }); }
  if (p === `/zones/${Z}/workers/routes`) {
    if (m === "GET") return ok(res, state.routes);
    const r = { id: String(++n).padStart(32, "9"), ...body }; if (!state.dropRouteAfterPost) state.routes.push(r); return ok(res, r);
  }
  if ((mm = p.match(new RegExp(`^/zones/${Z}/workers/routes/([0-9a-f]{32})$`)))) {
    if (m === "DELETE") { state.routes = state.routes.filter((r) => r.id !== mm[1]); return ok(res, { id: mm[1] }); }
    if (m === "PUT") { Object.assign(state.routes.find((r) => r.id === mm[1]), body); return ok(res, {}); }
  }
  if ((mm = p.match(new RegExp(`^/zones/${Z}/settings/([a-z_]+)$`)))) {
    if (m === "PATCH") state.settings[mm[1]] = body.value;
    return ok(res, { id: mm[1], value: state.settings[mm[1]] });
  }
  err(res, 404, 7003, `no route ${m} ${p}`);
});
