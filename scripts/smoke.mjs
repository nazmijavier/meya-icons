// Checks a deployed copy of the site: the pages, clean URLs, the functions, and that nothing outside docs/ is served.
// Usage: node scripts/smoke.mjs https://meya-icons.<account>.workers.dev   (the deploy workflow runs it)
const base = (process.argv[2] || "").replace(/\/$/, "");
if (!/^https?:\/\/[^/]+$/.test(base)) {
  console.error("usage: node scripts/smoke.mjs https://<host>");
  process.exit(2);
}
let fails = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) fails++; };
const get = (p, opts) => fetch(base + p, { redirect: "manual", signal: AbortSignal.timeout(15000), ...opts });

// a new workers.dev name can take a minute or two to resolve
for (let i = 0; ; i++) {
  try { if ((await get("/")).status === 200) break; } catch {}
  if (i === 18) { console.error(`${base} did not answer within 3 minutes`); process.exit(1); }
  await new Promise((r) => setTimeout(r, 10000));
}

let r = await get("/");
check(r.status === 200 && /<title>Meya Icons/.test(await r.text()), "/ is the icon site");
r = await get("/pricing");
check(r.status === 200 && /<title>Pricing/.test(await r.text()), "/pricing is the pricing page");
r = await get("/pricing.html");
check([301, 307, 308].includes(r.status) && /\/pricing$/.test(r.headers.get("location") || ""), `/pricing.html redirects to /pricing (${r.status})`);
r = await get("/pro/glass/general/home.webp");
check(r.status === 200 && /image\/webp/.test(r.headers.get("content-type") || ""), "Pro previews are served");
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
for (const p of ["/wrangler.jsonc", "/worker.js", "/api/_lib/session.js", "/package.json", "/scripts/guard.mjs", "/README.md"]) {
  r = await get(p);
  check(r.status === 404, `${p} is not published (${r.status})`);
}
console.log(fails ? `${fails} check(s) failed on ${base}` : `all checks passed on ${base}`);
process.exit(fails ? 1 : 0);
