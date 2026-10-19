// receive() end to end: fake GitHub (statuses, contents, the private repo), fake Polar, a wrangler stub.
import http from "node:http";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { seal } from "../../scripts/handoff.mjs";
import os from "node:os";
import path from "node:path";
// the stub wrangler and what it records go to a temporary folder
const HERE = new URL(".", import.meta.url).pathname, REPO = new URL("../..", import.meta.url).pathname;
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "meya-cloudflare-test-")) + "/";
const GOOD_PAT = "github_pat_GOODgoodGOODgood1234567890", GOOD_POLAR = "polar_oat_GOODgoodGOODgood123456", BAD_POLAR = "polar_oat_BADbadBADbadBAD1234567";
let fails = 0; const ok = (c, w) => { console.log(`${c ? "PASS" : "FAIL"}  ${w}`); if (!c) fails++; };
let statuses = [], sealedFile = null, payload = null;
const gh = http.createServer(async (req, res) => {
  let raw = ""; for await (const c of req) raw += c;
  const u = new URL(req.url, "http://x");
  if (req.method === "POST" && u.pathname === "/repos/nazmijavier/meya-icons/statuses/abc123") {
    const b = JSON.parse(raw); statuses.push(b);
    const m = b.description.match(/key (\S+)$/);
    if (m && payload) setTimeout(() => { sealedFile = seal(m[1], JSON.stringify(payload)); }, 1500); // the sender commits
    res.writeHead(201); return res.end("{}");
  }
  if (u.pathname === "/repos/nazmijavier/meya-icons/contents/.github/handoff/777.sealed") {
    if (req.headers.authorization !== "Bearer gh-run-token") { res.writeHead(401); return res.end(); }
    if (!sealedFile) { res.writeHead(404); return res.end("{}"); }
    res.writeHead(200); return res.end(sealedFile);
  }
  if (u.pathname === "/repos/nazmijavier/meya-icons-pro") {
    if (req.headers.authorization !== `Bearer ${GOOD_PAT}`) { res.writeHead(404); return res.end("{}"); }
    res.writeHead(200); return res.end(JSON.stringify({ private: true }));
  }
  res.writeHead(404); res.end("{}");
});
let polarHangs = false;
const polar = http.createServer((req, res) => {
  if (polarHangs) return; // never answers, like Polar did for GitHub's runner
  const good = req.headers.authorization === `Bearer ${GOOD_POLAR}`;
  if (req.url.startsWith("/v1/benefits/2c450b0a-477e-49fb-91cb-dbd408756d06/grants") || req.url.startsWith("/v1/license-keys")) { res.writeHead(good ? 200 : 401); return res.end(JSON.stringify({ items: [] })); }
  res.writeHead(404); res.end("{}");
});
await new Promise((r) => gh.listen(4810, r)); await new Promise((r) => polar.listen(4811, r));
fs.writeFileSync(DIR + "stub.sh", `#!/bin/sh\necho "$@" > "${DIR}stub.args"; cat > "${DIR}stub.json"; echo "stub: secrets uploaded"\n`); fs.chmodSync(DIR + "stub.sh", 0o755);
const run = () => new Promise((done) => execFile("node", ["scripts/handoff.mjs", "receive"], { cwd: REPO, encoding: "utf8", timeout: 60000,
  env: { PATH: process.env.PATH, GITHUB_ACTIONS: "true", GITHUB_API_URL: "http://127.0.0.1:4810", POLAR_API_URL: "http://127.0.0.1:4811", GITHUB_TOKEN: "gh-run-token", GITHUB_REPOSITORY: "nazmijavier/meya-icons", GITHUB_RUN_ID: "777", GITHUB_SHA: "abc123", GITHUB_REF_NAME: "claude/x", WRANGLER_BIN: DIR + "stub.sh", HANDOFF_CHECK_MS: "1500" } },
  (e, so, se) => done({ code: e ? e.code : 0, out: so + se })));

// 1. both tokens good, plus a name that is not accepted
payload = { POLAR_ACCESS_TOKEN: GOOD_POLAR, PRO_GITHUB_TOKEN: GOOD_PAT, SESSION_SECRET: "should-not-be-set-by-handoff-xxxxxxxxxxxxxxx" };
let r = await run();
const sent = JSON.parse(fs.readFileSync(DIR + "stub.json", "utf8"));
ok(r.code === 0 && Object.keys(sent).sort().join() === "POLAR_ACCESS_TOKEN,PRO_GITHUB_TOKEN", "good tokens: both set, in one secret bulk");
ok(/Skipped SESSION_SECRET: not a secret this hand-off sets/.test(r.out), "a name it does not set is skipped");
ok(statuses[0].state === "pending" && /^run 777 key [A-Za-z0-9+/]{43}=$/.test(statuses[0].description) && statuses.at(-1).state === "success", "status: key published, then success");
const shown = r.out.replace(/::add-mask::.*/g, "");
ok(!shown.includes(GOOD_POLAR) && !shown.includes(GOOD_PAT) && !shown.includes("should-not-be-set"), "no value printed outside the mask commands");
ok(r.out.includes(`::add-mask::${GOOD_POLAR}`) && r.out.includes(`::add-mask::${GOOD_PAT}`) && r.out.indexOf("::add-mask::") < r.out.indexOf("works"), "values masked before any other line about them");
ok(!sealedFile.includes(GOOD_POLAR) && !sealedFile.includes(GOOD_PAT), "the sealed file holds no value in the clear");

// 2. a Polar token that Polar refuses is not set; the good GitHub token still is
statuses = []; sealedFile = null; fs.rmSync(DIR + "stub.json");
payload = { POLAR_ACCESS_TOKEN: BAD_POLAR, PRO_GITHUB_TOKEN: GOOD_PAT };
r = await run();
const sent2 = JSON.parse(fs.readFileSync(DIR + "stub.json", "utf8"));
ok(r.code === 0 && Object.keys(sent2).join() === "PRO_GITHUB_TOKEN" && /Skipped POLAR_ACCESS_TOKEN: Polar answered 401/.test(r.out), "refused Polar token: skipped with the reason, GitHub token set");

// 3. nothing usable: the run fails and sets nothing
statuses = []; sealedFile = null; fs.rmSync(DIR + "stub.json");
payload = { POLAR_ACCESS_TOKEN: "not-a-token" };
r = await run();
ok(r.code === 1 && !fs.existsSync(DIR + "stub.json") && statuses.at(-1).state === "failure", "nothing usable: fails, sets nothing");

// 4. Polar does not answer: the GitHub token is checked and set, the Polar one is set with a warning
statuses = []; sealedFile = null; try { fs.rmSync(DIR + "stub.json"); } catch {}
polarHangs = true;
payload = { POLAR_ACCESS_TOKEN: GOOD_POLAR, PRO_GITHUB_TOKEN: GOOD_PAT };
r = await run();
const sent4 = fs.existsSync(DIR + "stub.json") ? JSON.parse(fs.readFileSync(DIR + "stub.json", "utf8")) : {};
ok(r.code === 0 && Object.keys(sent4).sort().join() === "POLAR_ACCESS_TOKEN,PRO_GITHUB_TOKEN" && /::warning::POLAR_ACCESS_TOKEN could not be checked, no answer from 127\.0\.0\.1:4811 \(timed out\): set anyway/.test(r.out), "Polar silent: both set, the Polar one with a warning");
ok(statuses.at(-1).state === "success", "Polar silent: status success");
polarHangs = false;

gh.close(); polar.closeAllConnections(); polar.close();
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
