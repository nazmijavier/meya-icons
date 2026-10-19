// Second round: the cases from the review (wildcard, marked records, deep names, inactive zone, a vanishing route).
import fs from "node:fs";
import { execFile } from "node:child_process";
import { state, writes, server } from "./fake-api.mjs";
import os from "node:os";
import path from "node:path";
// the stub wrangler lives next to this file; what it records goes to a temporary folder
const HERE = new URL(".", import.meta.url).pathname, REPO = new URL("../..", import.meta.url).pathname;
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "meya-cloudflare-test-")) + "/";
let fails = 0;
const ok = (c, what) => { console.log(`${c ? "PASS" : "FAIL"}  ${what}`); if (!c) fails++; };
await new Promise((r) => server.listen(4701, r));
const ENVF = DIR + "github_env2";
const run = (task, extra = {}) => { fs.writeFileSync(ENVF, ""); return new Promise((done) => execFile("node", ["scripts/cloudflare.mjs", task], { cwd: REPO, encoding: "utf8",
  env: { PATH: process.env.PATH, CLOUDFLARE_API_BASE_URL: "http://127.0.0.1:4701/client/v4", CLOUDFLARE_API_TOKEN: "good-token", GITHUB_ACTIONS: "true", GITHUB_ENV: ENVF, WRANGLER_BIN: HERE + "wrangler-stub.sh", STUB_OUT: DIR + "stub2", ...extra } },
  (e, so, se) => done({ code: e ? e.code : 0, out: so + se, env: fs.readFileSync(ENVF, "utf8") }))); };
const W = "c".repeat(32);
const reset = (over = {}) => Object.assign(state, {
  zoneStatus: "active", dropRouteAfterPost: false, subdomain: "nazmijavier7", scripts: ["meya-icons"], secrets: ["SESSION_SECRET"],
  records: [{ id: W, type: "CNAME", name: "*.meyalab.com", content: "cname.vercel-dns.com", proxied: false, ttl: 1 },
            { id: "d".repeat(32), type: "A", name: "meyalab.com", content: "1.2.3.4", proxied: true, ttl: 1 },
            { id: "7".repeat(32), type: "CNAME", name: "www.meyalab.com", content: "meyalab.com", proxied: true, ttl: 1 }],
  routes: [], settings: { always_use_https: "off", ssl: "full" } }, over);

// 1. icons answers through a DNS-only wildcard to Vercel (what status found on the real zone: no record of its own)
reset();
let r = await run("prepare");
ok(/WORKERS_URL=https:\/\/meya-icons\.nazmijavier7\.workers\.dev/.test(r.env), "prepare writes the workers.dev address");
r = await run("status");
ok(/no record of its own/.test(r.out) && /\*\.meyalab\.com: CNAME cname\.vercel-dns\.com \(DNS only/.test(r.out) && /active, full setup/.test(r.out) && /ON_WORKER=0/.test(r.env), "status: shows the wildcard and the zone");
let w = writes.length; r = await run("cutover"); let cw = writes.slice(w);
ok(r.code === 0 && /CUTOVER_CHANGED=1/.test(r.env), "cutover: marks that it changed something");
ok(/always_use_https \{"value":"on"\}/.test(cw[0] || "") && /Turned on Always Use HTTPS .*2 proxied name/.test(r.out), "cutover: Always Use HTTPS on (only covered names proxied)");
ok(/^POST \/zones\/ID\/workers\/routes/.test(cw[1] || "") && /^POST \/zones\/ID\/dns_records .*"name":"icons.meyalab.com".*"content":"100::".*"proxied":true.*"comment":"meya-icons cutover: placeholder"/.test(cw[2] || ""), "cutover: route, then a marked placeholder for icons");
ok(state.records.find((x) => x.id === W).proxied === false, "cutover: the wildcard itself is untouched");
r = await run("status"); ok(/ON_WORKER=1/.test(r.env), "status: icons on the Worker");
w = writes.length; r = await run("cutover"); ok(r.code === 0 && writes.length === w && !/CUTOVER_CHANGED/.test(r.env) && /nothing changed/.test(r.out), "cutover again: no writes, not marked as changed");
w = writes.length; r = await run("rollback"); let rw = writes.slice(w);
ok(r.code === 0 && rw.length === 2 && /^DELETE \/zones\/ID\/workers\/routes/.test(rw[0]) && /^DELETE \/zones\/ID\/dns_records\/ID/.test(rw[1]), "rollback: route and placeholder removed");
ok(!state.records.some((x) => x.name === "icons.meyalab.com") && state.records.find((x) => x.id === W).proxied === false, "rollback: icons answers through the wildcard again");
r = await run("status"); ok(/ON_WORKER=0/.test(r.env), "status after rollback: not on the Worker");

// 2. icons has its own DNS-only record with a comment; SSL full
reset({ records: [{ id: "8".repeat(32), type: "CNAME", name: "icons.meyalab.com", content: "cname.vercel-dns.com", proxied: false, ttl: 3600, comment: "Vercel project meya-icons" }] });
r = await run("cutover");
const rec = state.records[0];
ok(rec.proxied === true && rec.comment === "meya-icons cutover: was DNS only; Vercel project meya-icons", "cutover: proxies and marks the record, keeping its comment");
r = await run("rollback");
ok(rec.proxied === false && rec.comment === "Vercel project meya-icons", "rollback with SSL full: marked record back to DNS only, comment restored");

// 3. a proxied name two levels down: Always Use HTTPS stays off
reset(); state.records.push({ id: "6".repeat(32), type: "A", name: "api.eu.meyalab.com", content: "5.6.7.8", proxied: true, ttl: 1 });
r = await run("cutover");
ok(r.code === 0 && state.settings.always_use_https === "off" && /Always Use HTTPS left off: 1 proxied name/.test(r.out) && !/api\.eu\.meyalab\.com/.test(r.out), "deep proxied name: Always Use HTTPS left off, the name not printed");

// 4. a zone that is not active on Cloudflare
reset({ zoneStatus: "pending" }); w = writes.length; r = await run("cutover");
ok(r.code === 1 && writes.length === w && /pending .* must be active on Cloudflare/.test(r.out), "inactive zone: cutover refuses, nothing written");

// 5. the route vanishes before the DNS change (a rollback running at the same time)
reset({ dropRouteAfterPost: true }); w = writes.length; r = await run("cutover"); cw = writes.slice(w);
ok(r.code === 1 && /route .* is gone/.test(r.out) && !cw.some((x) => /dns_records/.test(x)), "vanished route: DNS left as it was");

// 6. a legacy proxied Vercel record with flexible SSL and no marker
reset({ records: [{ id: "5".repeat(32), type: "CNAME", name: "icons.meyalab.com", content: "cname.vercel-dns.com", proxied: true, ttl: 1 }], settings: { always_use_https: "on", ssl: "flexible" } });
r = await run("rollback");
ok(state.records[0].proxied === false, "rollback, flexible SSL, unmarked Vercel record: DNS only (no redirect loop)");

// 6b. the real zone: icons answers through a PROXIED wildcard to Vercel (A 216.198.79.x), SSL full
reset({ records: [{ id: W, type: "A", name: "*.meyalab.com", content: "216.198.79.65", proxied: true, ttl: 1 }, { id: "4".repeat(32), type: "A", name: "*.meyalab.com", content: "216.198.79.1", proxied: true, ttl: 1 }, { id: "d".repeat(32), type: "A", name: "meyalab.com", content: "216.198.79.1", proxied: true, ttl: 1 }] });
w = writes.length; r = await run("cutover"); cw = writes.slice(w);
ok(r.code === 0 && cw.length === 2 && /always_use_https/.test(cw[0]) && /^POST \/zones\/ID\/workers\/routes/.test(cw[1]) && /no DNS change needed/.test(r.out) && /CUTOVER_CHANGED=1/.test(r.env), "proxied wildcard: Always Use HTTPS and the route, no DNS change");
r = await run("status"); ok(/ON_WORKER=1/.test(r.env), "proxied wildcard: status sees the Worker serving icons");
w = writes.length; r = await run("rollback"); rw = writes.slice(w);
ok(r.code === 0 && rw.length === 1 && /^DELETE \/zones\/ID\/workers\/routes/.test(rw[0]) && state.records.every((x) => x.proxied), "proxied wildcard: rollback only removes the route");

// 7. prepare masks the login email and every account the token sees
reset(); r = await run("prepare");
ok(r.out.includes("::add-mask::owner@example.com") && r.out.includes("::add-mask::Other Co") && r.out.includes(`::add-mask::${"1".repeat(32)}`), "prepare: email, account names and ids masked before any wrangler step");
// 8. secrets: only what is missing, unless --update
reset({ secrets: ["SESSION_SECRET", "POLAR_ACCESS_TOKEN"] }); try { fs.rmSync(DIR + "stub2.json"); } catch {}
r = await run("secrets", { POLAR_ACCESS_TOKEN: "polar_oat_1", PRO_GITHUB_TOKEN: "ghp_x" });
let sent = JSON.parse(fs.readFileSync(DIR + "stub2.json", "utf8"));
ok(Object.keys(sent).join() === "PRO_GITHUB_TOKEN", "secrets: a deploy fills in only missing ones (POLAR_ACCESS_TOKEN kept)");
fs.rmSync(DIR + "stub2.json");
r = await run("secrets", { POLAR_ACCESS_TOKEN: "polar_oat_2" }); ok(!fs.existsSync(DIR + "stub2.json") && /No secrets to set/.test(r.out), "secrets: nothing missing, nothing uploaded");
const upd = await new Promise((done) => execFile("node", ["scripts/cloudflare.mjs", "secrets", "--update"], { cwd: REPO, encoding: "utf8",
  env: { PATH: process.env.PATH, CLOUDFLARE_API_BASE_URL: "http://127.0.0.1:4701/client/v4", CLOUDFLARE_API_TOKEN: "good-token", GITHUB_ACTIONS: "true", GITHUB_ENV: ENVF, WRANGLER_BIN: HERE + "wrangler-stub.sh", STUB_OUT: DIR + "stub2", POLAR_ACCESS_TOKEN: "polar_oat_2" } }, (e, so, se) => done({ code: e ? e.code : 0, out: so + se })));
sent = JSON.parse(fs.readFileSync(DIR + "stub2.json", "utf8"));
ok(upd.code === 0 && Object.keys(sent).join() === "POLAR_ACCESS_TOKEN" && sent.POLAR_ACCESS_TOKEN === "polar_oat_2", "secrets --update: replaces the ones it has");
// 9. version: the version taking most traffic in the latest deployment
reset(); r = await run("version");
ok(r.code === 0 && /PREVIOUS_VERSION=v-live/.test(r.env), "version: remembers the live version");
reset({ scripts: [] }); r = await run("version");
ok(r.code === 0 && !/PREVIOUS_VERSION/.test(r.env) && /not deployed yet/.test(r.out), "version: first deploy, nothing to go back to");

server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASSED");
process.exit(fails ? 1 : 0);
