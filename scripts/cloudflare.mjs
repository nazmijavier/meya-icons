// The Cloudflare side of icons.meyalab.com, run by the Deploy workflow (.github/workflows/deploy.yml).
// Needs CLOUDFLARE_API_TOKEN: Cloudflare's "Edit Cloudflare Workers" token template, plus Zone > DNS > Edit,
// Zone > Zone Settings > Edit and Zone > Zone > Read, on the meyalab.com zone.
//   node scripts/cloudflare.mjs prepare   finds the account, sets up its workers.dev name if it has none
//   node scripts/cloudflare.mjs secrets   gives the Worker SESSION_SECRET (made once, never shown) and whichever of
//                                         POLAR_ORG_ID, POLAR_PRO_BENEFIT_ID, POLAR_ACCESS_TOKEN, PRO_GITHUB_TOKEN are set
//   node scripts/cloudflare.mjs status    how icons.meyalab.com is served
//   node scripts/cloudflare.mjs cutover   sends icons.meyalab.com to the Worker: https only, a route, a proxied record
//   node scripts/cloudflare.mjs rollback  removes the route, so icons.meyalab.com goes back to the old host
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
const ACTIONS = !!process.env.GITHUB_ACTIONS;

function fail(why) {
  console.log(ACTIONS ? `::error::${why}` : `error: ${why}`);
  process.exit(1);
}
const mask = (v) => { if (ACTIONS && v) console.log(`::add-mask::${v}`); };
const setEnv = (k, v) => { if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, `${k}=${v}\n`); };

async function cf(method, path, body) {
  let r;
  try {
    r = await fetch(API + path, {
      method,
      headers: { Authorization: `Bearer ${TOKEN}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    throw new Error(`${method} ${path.split("?")[0].replace(/[0-9a-f]{32}/g, "…")}: ${e.message}`);
  }
  const j = await r.json().catch(() => null);
  if (!j || !j.success) {
    const errors = (j && j.errors) || [];
    const e = new Error(`${method} ${path.split("?")[0].replace(/[0-9a-f]{32}/g, "…")}: HTTP ${r.status} ${errors.map((x) => `${x.code} ${x.message}`).join("; ")}`);
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
  return { zone: zone.id, account: zone.account.id };
}

const records = async (c) => (await cf("GET", `/zones/${c.zone}/dns_records?name=${HOST}`)).filter((r) => r.name === HOST);
const routes = async (c) => (await cf("GET", `/zones/${c.zone}/workers/routes`)).filter((r) => r.pattern === PATTERN);
const deployed = async (c) => (await cf("GET", `/accounts/${c.account}/workers/scripts`)).some((s) => s.id === WORKER);
const setting = async (c, id) => (await cf("GET", `/zones/${c.zone}/settings/${id}`)).value;
const oldHost = (r) => /vercel/i.test(r.content) || /^76\.76\.21\./.test(r.content);

async function prepare() {
  const c = await context();
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
  console.log(`Cloudflare account found; ${ZONE} zone visible; workers.dev name ${sub}.workers.dev`);
}

async function secrets() {
  const c = await context();
  if (!(await deployed(c))) fail(`the ${WORKER} Worker is not deployed yet`);
  const have = new Set((await cf("GET", `/accounts/${c.account}/workers/scripts/${WORKER}/secrets`)).map((s) => s.name));
  const put = {};
  // made once: a new value would sign every customer out
  if (!have.has("SESSION_SECRET")) put.SESSION_SECRET = crypto.randomBytes(48).toString("base64url");
  for (const k of PRO_SECRETS) if (process.env[k]) put[k] = process.env[k];
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

async function status() {
  const c = await context();
  const [isDeployed, recs, rts, https, ssl] = await Promise.all([deployed(c), records(c), routes(c), setting(c, "always_use_https"), setting(c, "ssl")]);
  const live = rts.some((r) => r.script === WORKER) && recs.some((r) => r.proxied);
  console.log(`Worker ${WORKER}: ${isDeployed ? "deployed" : "not deployed"}`);
  console.log(`DNS ${HOST}: ${recs.map((r) => `${r.type} ${r.content} (${r.proxied ? "proxied" : "DNS only"}, ttl ${r.ttl === 1 ? "auto" : r.ttl})`).join("; ") || "no record"}`);
  console.log(`Route ${PATTERN}: ${rts.map((r) => r.script || "no Worker").join(", ") || "none"}`);
  console.log(`Always Use HTTPS: ${https}; SSL mode: ${ssl}`);
  console.log(live ? `${HOST} is served by the ${WORKER} Worker` : `${HOST} is still served by the old host`);
  setEnv("ON_WORKER", live ? "1" : "0");
}

async function cutover() {
  const c = await context();
  if (!(await deployed(c))) fail(`deploy the ${WORKER} Worker before moving ${HOST} to it`);
  // 1. plain http goes to https before the Worker takes over: logins must never travel in clear text
  if ((await setting(c, "always_use_https")) !== "on") {
    await cf("PATCH", `/zones/${c.zone}/settings/always_use_https`, { value: "on" });
    console.log(`Turned on Always Use HTTPS for ${ZONE}`);
  }
  // 2. the route first: once the record is proxied, every request must already go to the Worker
  const mine = await routes(c);
  if (!mine.length) {
    await cf("POST", `/zones/${c.zone}/workers/routes`, { pattern: PATTERN, script: WORKER });
    console.log(`Added the route ${PATTERN} → ${WORKER}`);
  } else if (mine[0].script !== WORKER) {
    await cf("PUT", `/zones/${c.zone}/workers/routes/${mine[0].id}`, { pattern: PATTERN, script: WORKER });
    console.log(`Pointed the route ${PATTERN} at ${WORKER}`);
  }
  // 3. a proxied record, so requests reach Cloudflare: the name keeps answering throughout, no gap
  const recs = await records(c);
  const web = recs.filter((r) => ["A", "AAAA", "CNAME"].includes(r.type));
  if (!web.length) {
    await cf("POST", `/zones/${c.zone}/dns_records`, { type: "AAAA", name: HOST, content: "100::", proxied: true, ttl: 1, comment: `served by the ${WORKER} Worker` });
    console.log(`Added a proxied record for ${HOST}`);
  }
  for (const r of web.filter((r) => !r.proxied)) {
    await cf("PATCH", `/zones/${c.zone}/dns_records/${r.id}`, { proxied: true });
    console.log(`Proxied the ${r.type} record ${HOST} → ${r.content} (it was DNS only, ttl ${r.ttl === 1 ? "auto" : r.ttl})`);
  }
  console.log(`${HOST} now goes to the ${WORKER} Worker`);
}

async function rollback() {
  const c = await context();
  for (const r of (await routes(c)).filter((r) => r.script === WORKER)) {
    await cf("DELETE", `/zones/${c.zone}/workers/routes/${r.id}`);
    console.log(`Removed the route ${PATTERN} → ${WORKER}`);
  }
  // Vercel expects browsers to reach it directly; proxied, it only works when Cloudflare talks to it over https
  if (!["full", "strict"].includes(await setting(c, "ssl"))) {
    for (const r of (await records(c)).filter((r) => r.proxied && oldHost(r))) {
      await cf("PATCH", `/zones/${c.zone}/dns_records/${r.id}`, { proxied: false });
      console.log(`Set the ${r.type} record ${HOST} → ${r.content} back to DNS only`);
    }
  }
  console.log(`${HOST} goes back to the old host`);
}

const tasks = { prepare, secrets, status, cutover, rollback };
const task = tasks[process.argv[2]];
if (!task) fail(`usage: node scripts/cloudflare.mjs ${Object.keys(tasks).join("|")}`);
await task().catch((e) => fail(e.message));
