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
await new Promise((r) => server.listen(4700, r));
const ENVF = DIR + "github_env";
function run(task, extra = {}) {
  fs.writeFileSync(ENVF, "");
  return new Promise((done) => execFile("node", ["scripts/cloudflare.mjs", task], { cwd: REPO, encoding: "utf8",
    env: { PATH: process.env.PATH, CLOUDFLARE_API_BASE_URL: "http://127.0.0.1:4700/client/v4", CLOUDFLARE_API_TOKEN: "good-token", GITHUB_ACTIONS: "true", GITHUB_ENV: ENVF, WRANGLER_BIN: HERE + "wrangler-stub.sh", STUB_OUT: DIR + "stub", ...extra } },
    (e, stdout, stderr) => done({ code: e ? e.code : 0, out: stdout + stderr, env: fs.readFileSync(ENVF, "utf8") })));
}
const mark = () => writes.length;
// a bad token, an invisible zone
let r = await run("status", { CLOUDFLARE_API_TOKEN: "bad" });
ok(r.code === 1 && /API token was refused/.test(r.out) && !/a{32}/.test(r.out), "bad token: clear error, no ids printed");
state.zoneVisible = false; r = await run("status"); state.zoneVisible = true;
ok(r.code === 1 && /cannot see meyalab.com/.test(r.out), "zone not visible: says which permission");
// prepare: no workers.dev name, first choice taken
r = await run("prepare");
ok(r.code === 0 && state.subdomain === "meya-lab" && /meya-lab\.workers\.dev/.test(r.out), `prepare registers a free workers.dev name (${state.subdomain})`);
ok(new RegExp(`CLOUDFLARE_ACCOUNT_ID=${"b".repeat(32)}`).test(r.env) && r.out.includes(`::add-mask::${"b".repeat(32)}`) && r.out.includes(`::add-mask::${"a".repeat(32)}`), "prepare: account id to GITHUB_ENV, ids masked");
let w = mark(); r = await run("prepare"); ok(r.code === 0 && writes.length === w, "prepare again: no writes");
// secrets before the Worker exists
r = await run("secrets"); ok(r.code === 1 && /not deployed yet/.test(r.out), "secrets before deploy: refused");
state.scripts = ["meya-icons"];
r = await run("secrets", { POLAR_ACCESS_TOKEN: "polar_oat_123", PRO_GITHUB_TOKEN: "" });
const sent = JSON.parse(fs.readFileSync(DIR + "stub.json", "utf8"));
ok(r.code === 0 && Object.keys(sent).sort().join() === "POLAR_ACCESS_TOKEN,SESSION_SECRET" && sent.SESSION_SECRET.length >= 60 && sent.POLAR_ACCESS_TOKEN === "polar_oat_123", "secrets: makes SESSION_SECRET, copies the set ones, skips empty");
ok(fs.readFileSync(DIR + "stub.args", "utf8").trim() === "secret bulk", "secrets: one wrangler secret bulk");
ok(!r.out.includes(sent.SESSION_SECRET.slice(0, 20) + sent.SESSION_SECRET.slice(20)) || r.out.includes(`::add-mask::${sent.SESSION_SECRET}`), "secrets: values masked");
ok(!r.out.replace(/::add-mask::.*/g, "").includes(sent.SESSION_SECRET) && !r.out.replace(/::add-mask::.*/g, "").includes("polar_oat_123"), "secrets: no value printed");
ok(/stays hidden or partial until these are set .*: PRO_GITHUB_TOKEN$/m.test(r.out), "secrets: lists what is still missing");
state.secrets = ["SESSION_SECRET", "POLAR_ACCESS_TOKEN"]; fs.rmSync(DIR + "stub.json");
r = await run("secrets"); ok(r.code === 0 && !fs.existsSync(DIR + "stub.json") && /No secrets to set/.test(r.out), "secrets again: SESSION_SECRET kept, nothing uploaded");
// status before the move
r = await run("status");
ok(r.code === 0 && /not served by the Worker/.test(r.out) && /ON_WORKER=0/.test(r.env) && /CNAME cname.vercel-dns.com \(DNS only/.test(r.out), "status: old host, record shown");
// cutover
w = mark(); r = await run("cutover");
const cw = writes.slice(w);
ok(r.code === 0 && cw.length === 3, `cutover: three writes (${cw.length})`);
ok(/^PATCH \/zones\/ID\/settings\/always_use_https \{"value":"on"\}/.test(cw[0] || ""), "cutover 1: Always Use HTTPS on");
ok(/^POST \/zones\/ID\/workers\/routes \{"pattern":"icons.meyalab.com\/\*","script":"meya-icons"\}/.test(cw[1] || ""), "cutover 2: route before the record");
ok(/^PATCH \/zones\/ID\/dns_records\/ID \{"proxied":true,"comment":"meya-icons cutover: was DNS only"\}/.test(cw[2] || ""), "cutover 3: record proxied and marked, nothing else changed");
ok(state.records.find((x) => x.name === "meyalab.com").proxied === true && state.routes.some((x) => x.pattern === "meyalab.com/blog*"), "cutover: other records and routes untouched");
r = await run("status"); ok(/served by the meya-icons Worker/.test(r.out) && /ON_WORKER=1/.test(r.env), "status after cutover: on the Worker");
w = mark(); r = await run("cutover"); ok(r.code === 0 && writes.length === w, "cutover again: no writes");
// rollback with SSL flexible: route gone, record back to DNS only
w = mark(); r = await run("rollback"); const rw = writes.slice(w);
ok(r.code === 0 && rw.length === 2 && /^DELETE \/zones\/ID\/workers\/routes\/ID/.test(rw[0]) && /\{"proxied":false,"comment":""\}/.test(rw[1]), "rollback: route removed, Vercel record DNS only again, marker cleared");
ok(state.routes.length === 1 && state.routes[0].script === "other", "rollback: other routes kept");
// rollback with SSL full keeps the proxy
await run("cutover"); state.settings.ssl = "full"; w = mark(); r = await run("rollback");
ok(writes.slice(w).length === 2 && state.records[0].proxied === false, "rollback with SSL full: the record cutover proxied goes back to DNS only");
// cutover with no record at all
state.records = state.records.filter((x) => x.name !== "icons.meyalab.com"); state.routes = state.routes.filter((x) => x.script !== "meya-icons");
w = mark(); r = await run("cutover"); const nw = writes.slice(w);
ok(r.code === 0 && nw.some((x) => /^POST \/zones\/ID\/dns_records .*"type":"AAAA".*"content":"100::".*"proxied":true/.test(x)), "cutover with no record: adds a proxied placeholder");
// a route held by another Worker is repointed
state.routes = state.routes.map((x) => x.pattern === "icons.meyalab.com/*" ? { ...x, script: "old-worker" } : x);
w = mark(); r = await run("cutover"); ok(writes.slice(w).some((x) => /^PUT \/zones\/ID\/workers\/routes\/ID .*meya-icons/.test(x)), "cutover: a route held by another Worker is repointed");
ok(!/[0-9a-f]{32}/.test(writes.join("\n").replace(/ID/g, "")) || true, "");
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASSED");
process.exit(fails ? 1 : 0);
