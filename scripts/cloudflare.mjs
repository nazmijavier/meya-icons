// The Cloudflare side of icons.meyalab.com, run by the Deploy workflow (.github/workflows/deploy.yml).
// Needs CLOUDFLARE_API_TOKEN: Cloudflare's "Edit Cloudflare Workers" token template, plus Zone > DNS > Edit,
// Zone > Zone Settings > Edit and Zone > Zone > Read, on the meyalab.com zone.
//   node scripts/cloudflare.mjs prepare   finds the account, sets up its workers.dev name if it has none
//   node scripts/cloudflare.mjs secrets   gives the Worker SESSION_SECRET (made once, never shown) and whichever of
//                                         POLAR_ORG_ID, POLAR_PRO_BENEFIT_ID, POLAR_ACCESS_TOKEN, PRO_GITHUB_TOKEN are set
//                                         and missing on it; with --update, also replaces the ones it has
//   node scripts/cloudflare.mjs version   remembers the live version, so a deploy that fails its checks can go back
//   node scripts/cloudflare.mjs status    how icons.meyalab.com is served
//   node scripts/cloudflare.mjs cutover   sends icons.meyalab.com to the Worker: https only, a route, a proxied record
//   node scripts/cloudflare.mjs rollback  undoes exactly what cutover changed, so icons.meyalab.com goes back
// Cutover marks each DNS record it changes in the record's comment; rollback reverses only marked records.
// The repository is public and so are its workflow logs: ids are masked, secret values are never printed.
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const API = (process.env.CLOUDFLARE_API_BASE_URL || "https://api.cloudflare.com/client/v4").replace(/\/$/, "");
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const ZONE = "meyalab.com", HOST = "icons.meyalab.com", PATTERN = `${HOST}/*`;
const WORKER = fs.readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8").match(/"name":\s*"([^"]+)"/)[1];
// the same wrangler as the deploy step in deploy.yml
const WRANGLER = process.env.WRANGLER_BIN ? [process.env.WRANGLER_BIN] : ["npx", "--yes", "wrangler@4.151.1"];
const PRO_SECRETS = ["POLAR_ORG_ID", "POLAR_PRO_BENEFIT_ID", "POLAR_ACCESS_TOKEN", "PRO_GITHUB_TOKEN"];
// what cutover writes in the comment of a record it changed (Cloudflare keeps up to 100 characters)
const WAS_DNS_ONLY = "meya-icons cutover: was DNS only", PLACEHOLDER = "meya-icons cutover: placeholder";
const ACTIONS = !!process.env.GITHUB_ACTIONS;

function fail(why) {
  console.log(ACTIONS ? `::error::${why}` : `error: ${why}`);
  process.exit(1);
}
const warn = (why) => console.log(ACTIONS ? `::warning::${why}` : `warning: ${why}`);
const mask = (v) => { if (ACTIONS && v) console.log(`::add-mask::${v}`); };
const setEnv = (k, v) => { if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, `${k}=${v}\n`); };

async function cf(method, path, body) {
  const where = `${method} ${path.split("?")[0].replace(/[0-9a-f]{32}/g, "…")}`;
  let r;
  try {
    r = await fetch(API + path, {
      method,
      headers: { Authorization: `Bearer ${TOKEN}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    throw new Error(`${where}: ${e.message}`);
  }
  const j = await r.json().catch(() => null);
  if (!j || !j.success) {
    const errors = (j && j.errors) || [];
    const e = new Error(`${where}: HTTP ${r.status} ${errors.map((x) => `${x.code} ${x.message}`).join("; ")}`);
    e.codes = errors.map((x) => x.code);
    throw e;
  }
  return j.result;
}

async function context() {
  if (!TOKEN) fail("CLOUDFLARE_API_TOKEN is not set");
  let zones;
  try { zones = await cf("GET", `/zones?name=${ZONE}`); } catch (e) { fail(`the API token was refused (${e.message})`); }
  const zone = zones.find((z) => z.name === ZONE);
  if (!zone) fail(`the API token cannot see ${ZONE}: give it Zone > Zone > Read on that zone`);
  mask(zone.id); mask(zone.account.id);
  return { zone: zone.id, account: zone.account.id, status: zone.status, type: zone.type, ns: zone.name_servers || [] };
}

const WEB = ["A", "AAAA", "CNAME"];
const named = async (c, name) => (await cf("GET", `/zones/${c.zone}/dns_records?name=${encodeURIComponent(name)}&per_page=100`)).filter((r) => r.name === name);
const records = (c) => named(c, HOST);
const routes = async (c) => (await cf("GET", `/zones/${c.zone}/workers/routes`)).filter((r) => r.pattern === PATTERN);
const deployed = async (c) => (await cf("GET", `/accounts/${c.account}/workers/scripts`)).some((s) => s.id === WORKER);
const setting = async (c, id) => (await cf("GET", `/zones/${c.zone}/settings/${id}`)).value;
const oldHost = (r) => /vercel/i.test(r.content) || /^76\.76\.21\./.test(r.content);
const show = (r) => `${r.type} ${r.content} (${r.proxied ? "proxied" : "DNS only"}, ttl ${r.ttl === 1 ? "auto" : r.ttl})`;
const marked = (r, mark) => (r.comment || "").startsWith(mark);
const unmark = (r) => (r.comment || "").slice(WAS_DNS_ONLY.length).replace(/^; /, "");

async function prepare() {
  const c = await context();
  // wrangler prints the login email and the token's accounts when Cloudflare refuses it: keep them out of the log
  try { mask((await cf("GET", "/user")).email); } catch {}
  try { for (const a of await cf("GET", "/accounts?per_page=50")) { mask(a.id); mask(a.name); } } catch {}
  setEnv("CLOUDFLARE_ACCOUNT_ID", c.account);
  let sub;
  try { sub = (await cf("GET", `/accounts/${c.account}/workers/subdomain`)).subdomain; } catch (e) { if (!e.codes || !e.codes.includes(10007)) throw e; }
  if (!sub) {
    // an account that never used Workers has no workers.dev name yet, and wrangler cannot pick one in CI
    for (const name of ["meyalab", "meya-lab", "meyalab-icons", "meya-lab-icons"]) {
      try { sub = (await cf("PUT", `/accounts/${c.account}/workers/subdomain`, { subdomain: name })).subdomain; break; } catch (e) { console.log(`workers.dev name "${name}" not taken: ${e.message}`); }
    }
    if (!sub) fail("could not set up a workers.dev name: open Workers & Pages once in the Cloudflare dashboard");
    console.log(`Set up the account's workers.dev name: ${sub}.workers.dev`);
  }
  setEnv("WORKERS_URL", `https://${WORKER}.${sub}.workers.dev`);
  console.log(`Cloudflare account found; ${ZONE} zone visible; workers.dev name ${sub}.workers.dev`);
}

async function secrets() {
  const c = await context();
  if (!(await deployed(c))) fail(`the ${WORKER} Worker is not deployed yet`);
  const have = new Set((await cf("GET", `/accounts/${c.account}/workers/scripts/${WORKER}/secrets`)).map((s) => s.name));
  const put = {}, update = process.argv.includes("--update");
  // made once: a new value would sign every customer out
  if (!have.has("SESSION_SECRET")) put.SESSION_SECRET = crypto.randomBytes(48).toString("base64url");
  // only what is missing, unless asked: every change makes a new version, and a deploy should not
  for (const k of PRO_SECRETS) if (process.env[k] && (update || !have.has(k))) put[k] = process.env[k];
  Object.values(put).forEach(mask);
  const names = Object.keys(put);
  if (names.length) {
    // one new version for all of them; wrangler reads the JSON from stdin and prints names only
    execFileSync(WRANGLER[0], [...WRANGLER.slice(1), "secret", "bulk"], { input: JSON.stringify(put), stdio: ["pipe", "inherit", "inherit"], env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: c.account } });
  }
  console.log(names.length ? `Secrets set: ${names.join(", ")}` : "No secrets to set");
  const all = new Set([...have, ...names]);
  const missing = ["SESSION_SECRET", ...PRO_SECRETS].filter((k) => !all.has(k));
  console.log(missing.length ? `The Pro login stays hidden or partial until these are set (as repository secrets): ${missing.join(", ")}` : "Every secret the Pro login uses is set");
}

async function version() {
  const c = await context();
  if (!(await deployed(c))) return console.log(`The ${WORKER} Worker is not deployed yet: nothing to go back to`);
  const [latest] = (await cf("GET", `/accounts/${c.account}/workers/scripts/${WORKER}/deployments`)).deployments || [];
  const live = latest && [...latest.versions].sort((a, b) => b.percentage - a.percentage)[0];
  if (!live) return console.log("No deployment found: nothing to go back to");
  setEnv("PREVIOUS_VERSION", live.version_id);
  console.log(`Live version before this deploy: ${live.version_id}`);
}

async function status() {
  const c = await context();
  const [isDeployed, recs, wild, rts, https, ssl] = await Promise.all([deployed(c), records(c), named(c, `*.${ZONE}`), routes(c), setting(c, "always_use_https"), setting(c, "ssl")]);
  const web = recs.filter((r) => WEB.includes(r.type)), wildWeb = wild.filter((r) => WEB.includes(r.type));
  // the record that answers for the name: its own, or else the wildcard
  const answering = web.length ? web : wildWeb;
  const live = rts.some((r) => r.script === WORKER) && answering.some((r) => r.proxied);
  console.log(`Zone ${ZONE}: ${c.status}, ${c.type} setup, Cloudflare name servers ${c.ns.join(", ") || "none"}`);
  console.log(`Worker ${WORKER}: ${isDeployed ? "deployed" : "not deployed"}`);
  console.log(`DNS ${HOST}: ${recs.map(show).join("; ") || "no record of its own"}`);
  console.log(`DNS *.${ZONE}: ${wild.map(show).join("; ") || "no wildcard"}`);
  console.log(`Route ${PATTERN}: ${rts.map((r) => r.script || "no Worker").join(", ") || "none"}`);
  console.log(`Always Use HTTPS: ${https}; SSL mode: ${ssl}`);
  console.log(live ? `${HOST} is served by the ${WORKER} Worker` : `${HOST} is not served by the Worker`);
  setEnv("ON_WORKER", live ? "1" : "0");
}

async function cutover() {
  const c = await context();
  if (c.status !== "active" || c.type !== "full") fail(`${ZONE} is ${c.status} with a ${c.type} setup on Cloudflare: its DNS must be active on Cloudflare for a route to work`);
  if (!(await deployed(c))) fail(`deploy the ${WORKER} Worker before moving ${HOST} to it`);
  let changed = false;
  // 1. plain http goes to https, so logins never travel in clear text. The setting covers the whole zone, so it is
  //    only turned on when every proxied name is covered by Cloudflare's certificate (the apex and one level down).
  if ((await setting(c, "always_use_https")) !== "on") {
    const proxied = (await cf("GET", `/zones/${c.zone}/dns_records?proxied=true&per_page=5000`)).filter((r) => WEB.includes(r.type));
    const deep = proxied.filter((r) => r.name.split(".").length > ZONE.split(".").length + 1);
    if (deep.length) warn(`Always Use HTTPS left off: ${deep.length} proxied name(s) sit deeper than one level and have no edge certificate; pages still send HSTS`);
    else {
      await cf("PATCH", `/zones/${c.zone}/settings/always_use_https`, { value: "on" });
      console.log(`Turned on Always Use HTTPS for ${ZONE} (${proxied.length} proxied name(s), all covered by its certificate)`);
    }
  }
  // 2. the route first: once the record is proxied, every request must already go to the Worker
  const mine = await routes(c);
  if (!mine.length) {
    await cf("POST", `/zones/${c.zone}/workers/routes`, { pattern: PATTERN, script: WORKER });
    console.log(`Added the route ${PATTERN} → ${WORKER}`);
    changed = true;
  } else if (mine[0].script !== WORKER) {
    await cf("PUT", `/zones/${c.zone}/workers/routes/${mine[0].id}`, { pattern: PATTERN, script: WORKER });
    console.log(`Pointed the route ${PATTERN} at ${WORKER}`);
    changed = true;
  }
  if (!(await routes(c)).some((r) => r.script === WORKER)) fail(`the route ${PATTERN} is gone (a rollback ran meanwhile?): DNS left as it was`);
  // 3. a proxied record, so requests reach Cloudflare: the name keeps answering throughout, no gap
  const web = (await records(c)).filter((r) => WEB.includes(r.type));
  if (!web.length) {
    // the name has no record of its own (a wildcard may answer for it): add one just for it
    await cf("POST", `/zones/${c.zone}/dns_records`, { type: "AAAA", name: HOST, content: "100::", proxied: true, ttl: 1, comment: PLACEHOLDER });
    console.log(`Added a proxied record for ${HOST}`);
    changed = true;
  }
  for (const r of web.filter((r) => !r.proxied)) {
    await cf("PATCH", `/zones/${c.zone}/dns_records/${r.id}`, { proxied: true, comment: [WAS_DNS_ONLY, r.comment].filter(Boolean).join("; ").slice(0, 100) });
    console.log(`Proxied the record ${HOST} → ${show(r)}`);
    changed = true;
  }
  if (changed) setEnv("CUTOVER_CHANGED", "1");
  console.log(changed ? `${HOST} now goes to the ${WORKER} Worker` : `${HOST} already went to the ${WORKER} Worker: nothing changed`);
}

async function rollback() {
  const c = await context();
  for (const r of (await routes(c)).filter((r) => r.script === WORKER)) {
    await cf("DELETE", `/zones/${c.zone}/workers/routes/${r.id}`);
    console.log(`Removed the route ${PATTERN} → ${WORKER}`);
  }
  const ssl = await setting(c, "ssl");
  for (const r of await records(c)) {
    if (marked(r, PLACEHOLDER)) {
      // the record cutover added: without it, the name answers as before (through the wildcard, if there is one)
      await cf("DELETE", `/zones/${c.zone}/dns_records/${r.id}`);
      console.log(`Removed the record cutover added for ${HOST}`);
    } else if (marked(r, WAS_DNS_ONLY)) {
      await cf("PATCH", `/zones/${c.zone}/dns_records/${r.id}`, { proxied: false, comment: unmark(r) });
      console.log(`Set the record ${HOST} → ${r.content} back to DNS only`);
    } else if (r.proxied && oldHost(r) && !["full", "strict"].includes(ssl)) {
      // proxied to Vercel over plain http, Vercel would answer with a redirect loop
      await cf("PATCH", `/zones/${c.zone}/dns_records/${r.id}`, { proxied: false });
      console.log(`Set the record ${HOST} → ${r.content} to DNS only`);
    }
  }
  console.log(`${HOST} goes back to the old host`);
}

const tasks = { prepare, secrets, version, status, cutover, rollback };
const task = tasks[process.argv[2]];
if (!task) fail(`usage: node scripts/cloudflare.mjs ${Object.keys(tasks).join("|")}`);
await task().catch((e) => fail(e.message));
