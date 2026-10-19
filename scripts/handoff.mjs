// Hands secrets to the Worker without them ever being readable in this public repository or its workflow logs.
// The Deploy workflow's "handoff" task runs `receive`: it makes a key pair that exists only in its memory, publishes
// the public half as a commit status, and waits for .github/handoff/<run id>.sealed on its branch. The sender seals
// the secrets for that key with `seal`, commits the file and pushes. Only that run can open it, and its key is gone
// once the run ends, so the sealed file stays unreadable.
//   node scripts/handoff.mjs seal <public key> < secrets.json > .github/handoff/<run id>.sealed
//   node scripts/handoff.mjs receive   (in the workflow)
// Only POLAR_ACCESS_TOKEN and PRO_GITHUB_TOKEN are accepted, and each is checked with Polar or GitHub first: one
// they refuse is not set; one they could not be asked about (no answer) is set, with a warning.
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const INFO = "meya-icons handoff v1";
const ACCEPTED = {
  POLAR_ACCESS_TOKEN: /^polar_oat_[A-Za-z0-9_-]{20,200}$/,
  PRO_GITHUB_TOKEN: /^(github_pat_|ghp_)[A-Za-z0-9_]{20,300}$/,
};
const SPKI_X25519 = Buffer.from("302a300506032b656e032100", "hex"); // the DER header of an X25519 public key

const rawKey = (publicKey) => publicKey.export({ type: "spki", format: "der" }).subarray(-32);
const publicKeyOf = (raw) => crypto.createPublicKey({ key: Buffer.concat([SPKI_X25519, raw]), format: "der", type: "spki" });
// both ends: X25519, then HKDF-SHA256 over both public keys, for one AES-256-GCM key
const derive = (privateKey, otherRaw, salt) =>
  Buffer.from(crypto.hkdfSync("sha256", crypto.diffieHellman({ privateKey, publicKey: publicKeyOf(otherRaw) }), salt, INFO, 32));

export function seal(recipientB64, plaintext) {
  const recipient = Buffer.from(recipientB64, "base64");
  if (recipient.length !== 32) throw new Error("not an X25519 public key");
  const eph = crypto.generateKeyPairSync("x25519"), epk = rawKey(eph.publicKey);
  const key = derive(eph.privateKey, recipient, Buffer.concat([epk, recipient]));
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return JSON.stringify({ v: 1, epk: epk.toString("base64"), iv: iv.toString("base64"), ct: ct.toString("base64"), tag: c.getAuthTag().toString("base64") }) + "\n";
}

export function open(privateKey, ownRaw, sealed) {
  const s = JSON.parse(sealed), epk = Buffer.from(s.epk, "base64");
  const d = crypto.createDecipheriv("aes-256-gcm", derive(privateKey, epk, Buffer.concat([epk, ownRaw])), Buffer.from(s.iv, "base64"));
  d.setAuthTag(Buffer.from(s.tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(s.ct, "base64")), d.final()]).toString("utf8");
}

function fail(why) {
  console.log(process.env.GITHUB_ACTIONS ? `::error::${why}` : `error: ${why}`);
  process.exit(1);
}

// Does the token do what the site needs? "ok", "unknown: ..." (no answer) or why it was refused. Names and HTTP
// statuses only are printed, never a value.
class NoAnswer extends Error {}
async function works(name, value) {
  try { return await check(name, value); } catch (e) {
    if (e instanceof NoAnswer) return `unknown: ${e.message}`;
    throw e;
  }
}
async function check(name, value) {
  // two tries of 30 seconds each (HANDOFF_CHECK_MS in tests); a refusal is an answer, no answer is not
  const wait = Number(process.env.HANDOFF_CHECK_MS || 30000);
  const get = async (url, auth) => {
    for (let i = 0; ; i++) {
      try {
        return await fetch(url, { headers: { Authorization: `Bearer ${auth}`, Accept: "application/json", "User-Agent": "meya-icons-handoff" }, signal: AbortSignal.timeout(wait) });
      } catch (e) {
        if (i === 1) throw new NoAnswer(`no answer from ${new URL(url).host} (${e.name === "TimeoutError" ? "timed out" : e.message})`);
      }
    }
  };
  if (name === "PRO_GITHUB_TOKEN") {
    const repo = process.env.PRO_REPO || "nazmijavier/meya-icons-pro";
    const r = await get(`${process.env.GITHUB_API_URL || "https://api.github.com"}/repos/${repo}`, value);
    const d = r.ok ? await r.json() : null;
    return r.ok && d.private ? "ok" : `GitHub answered ${r.status} for ${repo}`;
  }
  if (name === "POLAR_ACCESS_TOKEN") {
    const api = (process.env.POLAR_API_URL || "https://api.polar.sh").replace(/\/$/, "");
    const benefit = fs.readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8").match(/"POLAR_PRO_BENEFIT_ID":\s*"([^"]+)"/)[1];
    const g = await get(`${api}/v1/benefits/${benefit}/grants?limit=1`, value);
    if (!g.ok) return `Polar answered ${g.status} for the Pro benefit's grants (benefits:read)`;
    const k = await get(`${api}/v1/license-keys?limit=1`, value);
    return k.ok ? "ok" : `Polar answered ${k.status} for license keys (license_keys:read)`;
  }
  return "not accepted";
}

async function receive() {
  const { GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_SHA, GITHUB_REF_NAME } = process.env;
  const api = process.env.GITHUB_API_URL || "https://api.github.com";
  const gh = (path, init = {}) => fetch(`${api}/repos/${GITHUB_REPOSITORY}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "meya-icons-handoff", ...(init.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  const status = (state, description) => gh(`/statuses/${GITHUB_SHA}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, context: "meya-icons/handoff", description }) });

  const pair = crypto.generateKeyPairSync("x25519"), own = rawKey(pair.publicKey), key = own.toString("base64");
  if (!(await status("pending", `run ${GITHUB_RUN_ID} key ${key}`)).ok) fail("could not publish the public key as a commit status");
  const file = `.github/handoff/${GITHUB_RUN_ID}.sealed`;
  console.log(`Waiting up to 15 minutes for ${file}, sealed for the key ${key}`);
  let sealed = null;
  for (let t = 0; !sealed; t += 10) {
    const r = await gh(`/contents/${file}?ref=${encodeURIComponent(GITHUB_REF_NAME)}`, { headers: { Accept: "application/vnd.github.raw+json" } }).catch(() => null);
    if (r && r.ok) sealed = await r.text();
    else if (t >= 900) { await status("failure", `run ${GITHUB_RUN_ID}: nothing arrived`); fail(`${file} did not arrive`); }
    else await new Promise((ok) => setTimeout(ok, 10000));
  }

  let values;
  try { values = JSON.parse(open(pair.privateKey, own, sealed)); } catch { await status("failure", `run ${GITHUB_RUN_ID}: could not open`); fail(`${file} is not sealed for this run's key`); }
  // masked before anything else is printed
  for (const v of Object.values(values)) if (typeof v === "string" && v) console.log(`::add-mask::${v}`);
  const put = {};
  for (const [name, value] of Object.entries(values)) {
    if (!ACCEPTED[name]) { console.log(`Skipped ${name}: not a secret this hand-off sets`); continue; }
    if (!ACCEPTED[name].test(value)) { console.log(`Skipped ${name}: not shaped like one`); continue; }
    const verdict = await works(name, value);
    if (verdict.startsWith("unknown: ")) console.log(`::warning::${name} could not be checked, ${verdict.slice(9)}: set anyway`);
    else if (verdict !== "ok") { console.log(`Skipped ${name}: ${verdict}`); continue; }
    else console.log(`${name} works`);
    put[name] = value;
  }
  if (!Object.keys(put).length) { await status("failure", `run ${GITHUB_RUN_ID}: nothing usable`); fail("no usable secret arrived"); }
  const wrangler = process.env.WRANGLER_BIN ? [process.env.WRANGLER_BIN] : ["npx", "--yes", "wrangler@4.151.1"];
  execFileSync(wrangler[0], [...wrangler.slice(1), "secret", "bulk"], { input: JSON.stringify(put), stdio: ["pipe", "inherit", "inherit"] });
  await status("success", `run ${GITHUB_RUN_ID}: set ${Object.keys(put).join(", ")}`);
  console.log(`The Worker now has ${Object.keys(put).join(" and ")}`);
}

const [command, arg] = process.argv.slice(2);
if (command === "seal") process.stdout.write(seal(arg, fs.readFileSync(0, "utf8")));
else if (command === "receive") {
  await receive().catch(async (e) => {
    // leave the published status saying it failed, not pending
    const { GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_SHA } = process.env;
    await fetch(`${process.env.GITHUB_API_URL || "https://api.github.com"}/repos/${GITHUB_REPOSITORY}/statuses/${GITHUB_SHA}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "meya-icons-handoff" },
      body: JSON.stringify({ state: "failure", context: "meya-icons/handoff", description: `run ${GITHUB_RUN_ID}: failed` }),
      signal: AbortSignal.timeout(20000),
    }).catch(() => {});
    fail(e.message);
  });
}
else if (import.meta.url === `file://${process.argv[1]}`) fail("usage: node scripts/handoff.mjs seal <public key> < secrets.json | receive");
