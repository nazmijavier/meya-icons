// Checks a deployed copy of the site: the pages, clean URLs, the functions, and that nothing outside docs/ is served.
// Usage: node scripts/smoke.mjs https://meya-icons.<account>.workers.dev   (the deploy workflow runs it)
const base = (process.argv[2] || "").replace(/\/$/, "");
if (!/^https?:\/\/[^/]+$/.test(base)) {
  console.error("usage: node scripts/smoke.mjs https://<host>");
  process.exit(2);
}
let fails = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) fails++; };
const note = (ok, what) => console.log(`${ok ? "ok  " : "warn"} ${what}`);
// Exit 4: Cloudflare's bot protection challenged this check (GitHub's runners can look like bots), so the site was
// not verified, which is no reason to undo anything.
function challenged(r) {
  if (!r.headers.has("cf-mitigated")) return r;
  console.error(`${base} answered with a Cloudflare challenge (${r.headers.get("cf-mitigated")}): it cannot be checked from here`);
  process.exit(4);
}
const get = (p, opts) => fetch(base + p, { redirect: "manual", signal: AbortSignal.timeout(15000), ...opts }).then(challenged);

// Wait until the new host answers: a new workers.dev name takes a minute or two to resolve, and after a DNS change
// some resolvers still send visitors to the old host (Vercel) for a while. The new host answering with an error is
// not worth waiting for: after a minute the checks run and fail. Exit 3: still the old host, nothing checked.
// SMOKE_EXPECT=old: only wait for the old host to answer again (after a rollback).
const WAIT = Number(process.env.SMOKE_WAIT || 180), EXPECT_OLD = process.env.SMOKE_EXPECT === "old";
let seen = "no answer", errorSince = null;
for (let t = 0; ; t += 10) {
  let a = null;
  try { a = await get("/"); } catch (e) { seen = `no answer (${e.cause ? e.cause.code || e.cause.message : e.message})`; }
  if (a) {
    const old = a.headers.has("x-vercel-id");
    seen = old ? `the old host (Vercel), HTTP ${a.status}` : `the new host, HTTP ${a.status}`;
    if (EXPECT_OLD && old && a.status === 200) { console.log(`ok   ${base} answers from the old host again`); process.exit(0); }
    if (!EXPECT_OLD && !old) {
      if (a.status === 200) break;
      errorSince ??= t;
      if (t - errorSince >= 60) break;
    }
  }
  if (t >= WAIT) {
    console.error(`${base} still gives ${seen} after ${WAIT}s`);
    process.exit(!EXPECT_OLD && seen.startsWith("the old host") ? 3 : 1);
  }
  await new Promise((r) => setTimeout(r, 10000));
}

let r = await get("/");
check(r.status === 200 && /<title>Meya Icons/.test(await r.text()), "/ is the icon site");
check(/max-age=\d{7,}/.test(r.headers.get("strict-transport-security") || ""), "pages send HSTS (docs/_headers)");
// the custom domain: plain http should go to https (the zone's "Always Use HTTPS"), so keys never travel in clear
// text. Only a warning: cutover leaves that zone-wide setting off when it would break another name.
const host = new URL(base).hostname;
if (base.startsWith("https://") && !host.endsWith(".workers.dev")) {
  r = await fetch(`http://${host}/pricing`, { redirect: "manual", signal: AbortSignal.timeout(15000) }).catch(() => null);
  note(r && [301, 302, 307, 308].includes(r.status) && (r.headers.get("location") || "").startsWith(`https://${host}/`), `http:// redirects to https:// (${r ? r.status : "no answer"})`);
}
r = await get("/pricing");
check(r.status === 200 && /<title>Pricing/.test(await r.text()), "/pricing is the pricing page");
r = await get("/pricing.html");
check([301, 307, 308].includes(r.status) && /\/pricing$/.test(r.headers.get("location") || ""), `/pricing.html redirects to /pricing (${r.status})`);
r = await get("/pro/glass/general/home.webp");
check(r.status === 200 && /image\/webp/.test(r.headers.get("content-type") || ""), "Pro previews are served");
r = await get("/pro/sharp.webp", { headers: { Origin: "null" } });
check(r.status === 200 && r.headers.get("access-control-allow-origin") === "*", "Pro preview sprites allow the Figma plugin (docs/_headers)");
r = await get("/api/geo");
const geo = await r.json().catch(() => null);
check(r.status === 200 && geo && "country" in geo && /no-store/.test(r.headers.get("cache-control") || ""), `/api/geo answers (country ${geo && geo.country})`);
r = await get("/api/auth/me");
const me = await r.json().catch(() => null);
check(r.status === 200 && me && me.signedIn === false, `/api/auth/me answers (login ${me && me.configured ? "configured" : "not configured yet"})`);
r = await get("/api/pro?style=sharp&icon=general/home");
check(r.status === 401, "/api/pro refuses a visitor who is not signed in");
r = await get("/api/auth/session", { method: "POST", headers: { Origin: "https://example.com", "Content-Type": "application/json" }, body: "{}" });
check(r.status === 403, "a login POST from another site is refused");
// the Figma plugin's window sends Origin: null and its session as a bearer token
const cors = (r) => r.headers.get("access-control-allow-origin") === "*";
r = await get("/api/plugin/me", { method: "OPTIONS", headers: { Origin: "null", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization" } });
check(r.status === 204 && cors(r) && /authorization/i.test(r.headers.get("access-control-allow-headers") || ""), `the plugin's preflight is allowed (${r.status})`);
r = await get("/api/plugin/me", { headers: { Origin: "null" } });
const pme = await r.json().catch(() => null);
check(r.status === 200 && cors(r) && pme && pme.signedIn === false, "/api/plugin/me answers the plugin");
r = await get("/api/plugin/pro?style=sharp&icon=general/home", { headers: { Origin: "null", Authorization: "Bearer not.a-token" } });
check(r.status === 401 && cors(r), "/api/plugin/pro refuses a plugin that is not signed in");
for (const p of ["/wrangler.jsonc", "/worker.js", "/api/_lib/session.js", "/package.json", "/scripts/guard.mjs", "/README.md"]) {
  r = await get(p);
  check(r.status === 404, `${p} is not published (${r.status})`);
}
console.log(fails ? `${fails} check(s) failed on ${base}` : `all checks passed on ${base}`);
process.exit(fails ? 1 : 0);
