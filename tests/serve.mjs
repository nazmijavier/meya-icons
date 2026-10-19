// Local stand-in for the host + Polar + GitHub, to test the Pro login end to end.
//   site    http://localhost:4100  SITE=workerd: the real Worker under `wrangler dev` (Cloudflare's workerd runtime);
//                                  otherwise Node: docs/ as static files, /api/* through the same handlers
//   polar   http://localhost:4200  fake Polar API (customer-session request/authenticate, user, grants, license keys)
//   github  http://localhost:4300  fake GitHub contents API, answered from the local Pro folder
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// this repository, and the private Pro folder next to it (scripts/ read ../meya-icons-pro too)
export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PRO = process.env.MEYA_PRO || path.resolve(REPO, "../meya-icons-pro");
const ORG = "11111111-1111-4111-8111-111111111111", BENEFIT = "22222222-2222-4222-8222-222222222222";
Object.assign(process.env, {
  SESSION_SECRET: "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz",
  POLAR_ORG_ID: ORG, POLAR_PRO_BENEFIT_ID: BENEFIT, POLAR_ACCESS_TOKEN: "polar_oat_testorgtoken", POLAR_API_URL: "http://localhost:4200",
  PRO_GITHUB_TOKEN: "ghp_test", GITHUB_API_URL: "http://localhost:4300",
});
const VARS = ["SESSION_SECRET", "POLAR_ORG_ID", "POLAR_PRO_BENEFIT_ID", "POLAR_ACCESS_TOKEN", "POLAR_API_URL", "PRO_GITHUB_TOKEN", "GITHUB_API_URL"];
export const MODE = process.env.SITE === "workerd" ? "workerd" : "node";

// ---------- fake Polar ----------
// people: pro@x.com holds Pro; nopro@x.com is a member without a grant; two@x.com is in two customers (409)
const PEOPLE = {
  "pro@x.com": { customer_id: "c1", member_id: "m1", pro: true },
  "nopro@x.com": { customer_id: "c2", member_id: "m2", pro: false },
  "two@x.com": { customer_id: "c3", member_id: "m3", pro: true },
};
const codes = new Map(); // code -> email
const tokens = new Map(); // token -> email
export const log = [];
let revoked = false; // flips the daily re-check
let keyDisabled = false;
const polar = http.createServer(async (req, res) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  let raw = ""; for await (const c of req) raw += c;
  const body = raw ? JSON.parse(raw) : {};
  const url = new URL(req.url, "http://x"), p = url.pathname, auth = (req.headers.authorization || "").replace("Bearer ", "");
  log.push(`${req.method} ${p}${url.search}`);
  const send = (code, obj) => { res.writeHead(code, { ...cors, "Content-Type": "application/json" }); res.end(obj === undefined ? "" : JSON.stringify(obj)); };
  if (p === "/v1/customer-portal/customer-session/request") {
    if (body.organization_id !== ORG) return send(202);
    if (body.email === "two@x.com" && !body.customer_id) return send(409, { error: "customer_selection_required", customers: [{ id: "c3", name: "Studio A" }, { id: "c9", name: "Studio B" }] });
    if (PEOPLE[body.email]) codes.set(body.email === "two@x.com" ? "TWO123" : body.email === "nopro@x.com" ? "NOP123" : "ABC123", body.email);
    return send(202);
  }
  if (p === "/v1/customer-portal/customer-session/authenticate") {
    const email = codes.get(body.code); if (!email) return send(401, { error: "invalid" });
    const t = "polar_mst_" + Buffer.from(email).toString("hex").padEnd(20, "0"); tokens.set(t, email); return send(200, { token: t });
  }
  if (p === "/v1/customer-portal/customer-session/user") {
    const email = tokens.get(auth); if (!email) return send(401, { error: "unauthorized" });
    const who = PEOPLE[email]; return send(200, { type: "member", name: null, email, customer_id: who.customer_id, member_id: who.member_id, role: "owner" });
  }
  if (p === "/v1/customer-portal/benefit-grants/") {
    const email = tokens.get(auth); if (!email) return send(401, {});
    const who = PEOPLE[email];
    const items = who.pro && url.searchParams.get("benefit_id") === BENEFIT ? [{ id: "g1", benefit_id: BENEFIT, member_id: who.member_id, is_granted: true }] : [];
    return send(200, { items, pagination: { total_count: items.length, max_page: 1 } });
  }
  if (p === "/v1/customer-portal/license-keys/validate") {
    if (body.key === "MEYA-GOOD-KEY-1234" && body.organization_id === ORG && body.benefit_id === BENEFIT) return send(200, { status: "granted", customer_id: "c1", member_id: "m1", customer: { email: "pro@x.com" }, benefit_id: BENEFIT });
    return send(404, { error: "not found" });
  }
  // organization endpoints for license keys (org token)
  if (p === "/v1/license-keys/validate") {
    if (auth !== process.env.POLAR_ACCESS_TOKEN) return send(401, {});
    if (body.key === "MEYA-GOOD-KEY-1234" && body.organization_id === ORG) return send(200, { id: "lk1", status: keyDisabled ? "disabled" : "granted", customer_id: "c1", member_id: "m1", customer: { email: "boss@x.com" }, member: { email: "seat@x.com" }, benefit_id: BENEFIT, key: body.key });
    return send(404, { error: "not found" });
  }
  if (p === "/v1/license-keys/lk1") {
    if (auth !== process.env.POLAR_ACCESS_TOKEN) return send(401, {});
    return send(200, { id: "lk1", status: keyDisabled ? "disabled" : "granted", key: "MEYA-GOOD-KEY-1234", expires_at: null });
  }
  if (p === `/v1/benefits/${BENEFIT}/grants`) {
    if (auth !== process.env.POLAR_ACCESS_TOKEN) return send(401, {});
    const m = url.searchParams.get("member_id"), c = url.searchParams.get("customer_id");
    const person = Object.values(PEOPLE).find((x) => (m && x.member_id === m) || (!m && c && x.customer_id === c));
    return send(200, { items: revoked || !person || !person.pro ? [] : [{ id: "g1" }], pagination: {} });
  }
  send(404, { error: "no route" });
});

// ---------- GitHub contents, from the local Pro folder ----------
const github = http.createServer((req, res) => {
  const m = req.url.match(/^\/repos\/[^/]+\/[^/]+\/contents\/(.+?)\?ref=/);
  log.push(`GITHUB ${m ? m[1] : req.url} auth=${req.headers.authorization === "Bearer ghp_test" ? "yes" : "no"} ua=${req.headers["user-agent"] || "none"}`);
  // like GitHub: no User-Agent, no answer
  if (!req.headers["user-agent"]) { res.writeHead(403); return res.end("User-Agent required"); }
  const f = m && path.join(PRO, decodeURIComponent(m[1]));
  if (f && fs.existsSync(f)) { res.writeHead(200, { "Content-Type": "application/vnd.github.raw" }); return res.end(fs.readFileSync(f, "utf8")); }
  res.writeHead(404); res.end("{}");
});

// ---------- the site: static docs/ and /api/* like Vercel ----------
const route = (p) => {
  const f = path.join(REPO, p.replace(/^\//, "") + ".js");
  return p.startsWith("/api/") && !p.includes("/_") && fs.existsSync(f) ? f : null;
};
const site = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:4100");
  const fn = route(url.pathname);
  if (fn) {
    // Node, like Vercel's Web signature: a Request in, a Response out, the function named after the method
    let raw = ""; for await (const c of req) raw += c;
    const headers = new Headers(Object.entries(req.headers).filter(([k]) => !k.startsWith(":")));
    if (!headers.has("x-vercel-ip-country")) headers.set("x-vercel-ip-country", "ID");
    const request = new Request(url, { method: req.method, headers, body: raw && req.method !== "GET" && req.method !== "HEAD" ? raw : undefined });
    let r;
    try {
      const handler = (await import(fn))[req.method];
      r = handler ? await handler(request) : new Response(JSON.stringify({ error: "method" }), { status: 405 });
    } catch (e) { r = new Response(String(e.stack), { status: 500 }); }
    const out = {}; r.headers.forEach((v, k) => { if (k !== "set-cookie") out[k] = v; });
    const cookies = r.headers.getSetCookie(); if (cookies.length) out["set-cookie"] = cookies;
    res.writeHead(r.status, out); res.end(Buffer.from(await r.arrayBuffer()));
    log.push(`SITE ${req.method} ${url.pathname}${url.search} -> ${r.status}`);
    return;
  }
  let f = path.join(REPO, "docs", url.pathname === "/" ? "index.html" : url.pathname);
  if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end("not found"); }
  const type = { ".html": "text/html", ".webp": "image/webp", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg" }[path.extname(f)] || "application/octet-stream";
  res.setHeader("Content-Type", type); res.end(fs.readFileSync(f));
});

// ---------- or the real Worker, under wrangler dev ----------
// the pinned wrangler: npm ci --prefix .github/deploy
const WRANGLER = process.env.WRANGLER_BIN || path.join(REPO, ".github/deploy/node_modules/.bin/wrangler");
const CFDIR = path.join(os.tmpdir(), "meya-icons-wrangler-state");
let dev;
function startWorkerd() {
  // request.cf as Cloudflare would fill it for a visitor in Indonesia
  fs.mkdirSync(CFDIR, { recursive: true });
  fs.writeFileSync(path.join(CFDIR, "cf.json"), JSON.stringify({ country: "ID", colo: "CGK", timezone: "Asia/Jakarta", asn: 7713, continent: "AS" }));
  const args = ["dev", "--port", "4100", "--ip", "127.0.0.1", "--persist-to", CFDIR, "--show-interactive-dev-session=false"];
  for (const k of VARS) args.push("--var", `${k}:${process.env[k]}`);
  dev = spawn(WRANGLER, args, { cwd: REPO, env: { ...process.env, MINIFLARE_CACHE_DIR: CFDIR, CLOUDFLARE_CF_FETCH_PATH: path.join(CFDIR, "cf.json"), WRANGLER_SEND_METRICS: "false" }, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  return new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error("wrangler dev did not start:\n" + out)), 90000);
    const on = (b) => { out += b; if (/Ready on/.test(out)) { clearTimeout(t); setTimeout(ok, 500); } };
    dev.stdout.on("data", on); dev.stderr.on("data", on);
    dev.on("exit", (c) => { clearTimeout(t); fail(new Error(`wrangler dev exited ${c}:\n` + out)); });
  });
}

export function start() {
  return Promise.all([
    new Promise((r) => polar.listen(4200, r)),
    new Promise((r) => github.listen(4300, r)),
    MODE === "workerd" ? startWorkerd() : new Promise((r) => site.listen(4100, r)),
  ]);
}
export function stop() { polar.close(); github.close(); if (dev) dev.kill(); else site.close(); }
export function revoke(v) { revoked = v; }
export function disableKey(v) { keyDisabled = v; }
