import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { start, stop, log, revoke, disableKey, missing, ACCESS_CODE, MODE, REPO, PRO } from "./serve.mjs";

// Playwright from this folder's node_modules, or from PWDIR (a folder that has it); CHROMIUM_PATH for a browser of
// your own. Usage: node tests/login.test.mjs <screenshot folder>   (SITE=workerd: under wrangler dev, see serve.mjs)
const { chromium } = createRequire(process.env.PWDIR ? path.resolve(process.env.PWDIR, "x.js") : import.meta.url)("playwright");
const SHOTS = process.argv[2];
let fails = 0;
const ok = (cond, what) => { console.log(`${cond ? "PASS" : "FAIL"}  ${what}`); if (!cond) fails++; };

await start();
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "Asia/Jakarta" });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:4100" });
const page = await ctx.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));

// 0. without a session the API refuses Pro icons
let r = await page.request.get("http://localhost:4100/api/pro?style=sharp&icon=general/home");
ok(r.status() === 401, "GET /api/pro without a session → 401");

await page.goto("http://localhost:4100/");
await page.waitForSelector(".acct-open:not([hidden])", { timeout: 5000 });
ok(await page.isVisible(".acct-open"), "home: Log in button shows once the login is configured");
ok((await page.textContent(".acct-open")).trim() === "Log in", "home: button says Log in");

// 1. a member without Pro is refused
await page.click(".acct-open");
await page.fill('#acct input[name="email"]', "nopro@x.com");
await page.click('#acct [data-step="email"] .acct-go');
await page.waitForSelector('#acct [data-view="code"]:not([hidden])');
await page.fill('#acct input[name="code"]', "nop123");
await page.click('#acct [data-step="code"] .acct-go');
await page.waitForSelector("#acct .acct-err:not([hidden])");
const refusal = await page.textContent("#acct .acct-err");
ok(/doesn't have Meya Icons Pro/.test(refusal), `no-Pro member refused: "${refusal.slice(0, 60)}…"`);

// 2. a wrong code
await page.click('#acct [data-go="email"]');
await page.fill('#acct input[name="email"]', "pro@x.com");
await page.click('#acct [data-step="email"] .acct-go');
await page.waitForSelector('#acct [data-view="code"]:not([hidden])');
await page.fill('#acct input[name="code"]', "ZZZ999");
await page.click('#acct [data-step="code"] .acct-go');
await page.waitForSelector("#acct .acct-err:not([hidden])");
ok(/wrong or has expired/.test(await page.textContent("#acct .acct-err")), "wrong code is reported");

// 3. the right code, typed in lower case
await page.fill('#acct input[name="code"]', "abc123");
ok((await page.inputValue('#acct input[name="code"]')) === "ABC123", "code input upper-cases what is typed");
await page.click('#acct [data-step="code"] .acct-go');
await page.waitForSelector('#acct [data-view="account"]:not([hidden])');
ok((await page.textContent("#acct .acct-email")) === "pro@x.com", "signed in as pro@x.com");
await page.screenshot({ path: `${SHOTS}/login-done.png` });
const cookie = (await ctx.cookies()).find((c) => c.name === "__Host-meya_pro");
ok(cookie && cookie.httpOnly && cookie.secure && cookie.sameSite === "Lax", "session cookie is HttpOnly, Secure, SameSite=Lax");
ok(!JSON.stringify(await ctx.cookies()).includes("polar_mst_") && !(await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage))).includes("polar_"), "the Polar token is stored nowhere in the browser");
await page.click('#acct [data-act="close"]');
ok((await page.textContent(".acct-open")).trim() === "Account", "nav button now says Account");
ok(!(await page.isVisible('a.pill-ink[href="pricing"]')), "Upgrade to Pro is hidden for a Pro customer");

// 4. open a Pro icon in Sharp and copy it
await page.click('#styles [data-style="sharp"]');
const tile = await page.$('.tile[data-i]:has(.lk)');
await tile.click();
await page.waitForSelector("#p-stage svg.glyph", { timeout: 5000 });
ok(await page.isVisible("#copy-svg"), "Sharp sheet: Copy SVG is available");
ok(!(await page.isVisible("#p-lock")), "Sharp sheet: no lock panel");
const name = await page.textContent("#p-file");
await page.click("#copy-svg");
const clip = await page.evaluate(() => navigator.clipboard.readText());
const m = name.match(/sharp\/([a-z0-9-]+)\/([a-z0-9-]+)\.svg/);
const pro = m && fs.readFileSync(`${PRO}/sharp/${m[1]}/${m[2]}.svg`, "utf8");
const firstD = pro && (pro.match(/ d="([^"]{20,})"/) || [])[1];
ok(!!firstD && clip.includes(firstD), `copied SVG is the real Pro drawing (${m && m.slice(1).join("/")})`);
ok(clip.startsWith("<svg") && /stroke-width="1.3"/.test(clip), "copied SVG carries the slider's stroke width on the root");
await page.screenshot({ path: `${SHOTS}/sheet-pro.png` });

// 5. Stroke (simulated before) now shows the live drawing and the slider works
await page.click('#styles [data-style="stroke"]');
await page.waitForSelector("#p-stage svg.glyph", { timeout: 5000 });
ok(!(await page.isDisabled("#sw")), "stroke slider is live for a Pro customer");

// 6. log out
await page.click(".acct-open");
await page.click('#acct [data-act="logout"]');
await page.waitForFunction(() => document.querySelector(".acct-open").textContent.trim() === "Log in");
await page.click('#styles [data-style="sharp"]');
await page.waitForSelector("#p-lock:not([hidden])", { timeout: 5000 });
ok(await page.isVisible("#p-lock"), "after logout the Pro sheet is locked again");
ok(await page.isVisible(".lock-login"), "lock panel offers 'Already have Pro? Log in'");
r = await page.request.get("http://localhost:4100/api/pro?style=sharp&icon=general/home");
ok(r.status() === 401, "after logout /api/pro → 401");

// 7. an email in two Polar customers: pick one
await page.click(".lock-login");
await page.fill('#acct input[name="email"]', "two@x.com");
await page.click('#acct [data-step="email"] .acct-go');
await page.waitForSelector('#acct [data-view="pick"]:not([hidden])');
ok((await page.$$("#acct .acct-pick button")).length === 2, "409: both accounts offered");
await page.click("#acct .acct-pick button >> nth=0");
await page.waitForSelector('#acct [data-view="code"]:not([hidden])');
await page.fill('#acct input[name="code"]', "TWO123");
await page.click('#acct [data-step="code"] .acct-go');
await page.waitForSelector('#acct [data-view="account"]:not([hidden])');
ok((await page.textContent("#acct .acct-email")) === "two@x.com", "signed in after choosing the account");
await page.click('#acct [data-act="logout"]');

// 8. license key
await page.waitForFunction(() => document.querySelector(".acct-open").textContent.trim() === "Log in");
await page.click(".acct-open");
await page.click('#acct [data-go="key"]');
await page.fill('#acct input[name="key"]', "MEYA-BAD-KEY-0000");
await page.click('#acct [data-step="key"] .acct-go');
await page.waitForSelector("#acct .acct-err:not([hidden])");
ok(/isn't active/.test(await page.textContent("#acct .acct-err")), "bad license key refused");
await page.fill('#acct input[name="key"]', "MEYA-GOOD-KEY-1234");
await page.click('#acct [data-step="key"] .acct-go');
await page.waitForSelector('#acct [data-view="account"]:not([hidden])');
ok((await page.textContent("#acct .acct-email")) === "seat@x.com", "signed in with a license key, as the seat holder");
await page.click('#acct [data-act="close"]');

// 9. API hardening
r = await page.request.get("http://localhost:4100/api/pro?style=sharp&icon=../../etc/passwd");
ok(r.status() === 404, "path tricks in icon → 404");
r = await page.request.get("http://localhost:4100/api/pro?style=outline&icon=general/home");
ok(r.status() === 404, "free style through /api/pro → 404");
r = await page.request.get("http://localhost:4100/api/pro?style=sharp&icon=landmarks/eiffel-tower");
ok(r.status() === 404, "hidden category → 404");
r = await page.request.post("http://localhost:4100/api/auth/session", { data: { token: "polar_mst_xxxxxxxxxxxxxxxx" }, headers: { Origin: "https://evil.example" } });
ok(r.status() === 403, "login POST from another site → 403");
r = await page.request.get("http://localhost:4100/api/pro?style=sharp&icon=general/home");
ok(r.status() === 200 && /svg/.test(r.headers()["content-type"]) && /default-src 'none'/.test(r.headers()["content-security-policy"] || ""), "Pro SVG served with a locked-down CSP");

// 10. pricing page: login button and Rupiah from /api/geo
await page.goto("http://localhost:4100/pricing");
await page.waitForSelector(".acct-open:not([hidden])");
ok((await page.textContent(".acct-open")).trim() === "Account", "pricing: signed-in state carries over");
ok((await page.evaluate(() => document.documentElement.dataset.cur)) === "idr", "pricing: Rupiah for an Indonesian visitor");
ok(await page.isVisible("#have-pro") && !(await page.isVisible("#get-pro")) && !(await page.isVisible("#get-pro-cmp")) && !(await page.isVisible("#get-pro-end")) && !(await page.isVisible("#login-link")),
  "pricing: a Pro customer sees 'You have Pro', no Get Pro or Log in");
{
  const pc = await browser.newContext({ viewport: { width: 375, height: 800 }, timezoneId: "Asia/Jakarta" });
  await pc.addCookies(await ctx.cookies());
  const pp = await pc.newPage(); await pp.goto("http://localhost:4100/pricing");
  await pp.waitForFunction(() => window.meyaAuth && meyaAuth.state.signedIn);
  await pp.evaluate(() => document.querySelector("#styles").scrollIntoView()); await pp.waitForTimeout(400);
  ok(!(await pp.evaluate(() => document.querySelector("#buybar").classList.contains("show"))), "pricing on a phone: no buy bar for a Pro customer");
  await pc.close();
}
{
  const pc = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pp = await pc.newPage(); await pp.goto("http://localhost:4100/pricing");
  await pp.waitForSelector("#login-link:not([hidden])");
  ok(await pp.isVisible("#get-pro") && !(await pp.isVisible("#have-pro")), "pricing signed out: Get Pro and 'Already have Pro? Log in'");
  await pp.click("#login-link");
  ok(await pp.$eval("#acct", (d) => d.open), "pricing: 'Log in' opens the login dialog");
  await pc.close();
}

// 12. review fixes, signed in (license key session)
await page.goto("http://localhost:4100/");
await page.waitForFunction(() => document.querySelector(".acct-open .label").textContent === "Account");
// a Pro icon the private repo does not have (the stand-in answers 404 for animated/): clear message, no endless
// "Loading"
missing.add("animated/");
await page.click('#styles [data-style="animated"]');
await (await page.$(".tile[data-i]:has(.lk)")).click();
await page.waitForFunction(() => !document.querySelector("#p-lock").hidden, null, { timeout: 5000 });
ok(/couldn't be loaded/.test(await page.textContent("#p-lock p")) && !/Loading/.test(await page.textContent("#p-file")), "missing Pro icon: clear message, not stuck on Loading");
ok(!(await page.isVisible("#p-lock .pill")) && !(await page.isVisible(".lock-login")), "missing Pro icon: no Get Pro / Log in offered to a customer");
// Glass: the opened icon's tile stays an image preview (no duplicate SVG ids in the page)
await page.click('#styles [data-style="glass"]');
const gtile = await page.$(".tile[data-i]:has(.lk)"); await gtile.click();
await page.waitForSelector("#p-stage svg.glyph", { timeout: 5000 });
await page.click('#styles [data-style="outline"]'); await page.click('#styles [data-style="glass"]');
ok(await gtile.evaluate((t) => !!t.querySelector(".lk") && !t.querySelector("svg")), "grid tiles stay previews after opening a Pro icon");
// clicks in the dialog's padding do not close it; a click on the backdrop does
await page.click(".acct-open");
const box = await page.$eval("#acct", (d) => { const r = d.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
await page.mouse.click(box.x + 6, box.y + box.h - 6);
ok(await page.$eval("#acct", (d) => d.open), "click in the dialog padding keeps it open");
await page.mouse.click(5, 5);
ok(!(await page.$eval("#acct", (d) => d.open)), "click on the backdrop closes it");
// a failed logout is reported and the session stays
await page.route("**/api/auth/logout", (route) => route.fulfill({ status: 500, body: "{}" }));
await page.click(".acct-open"); await page.click('#acct [data-act="logout"]');
await page.waitForSelector("#acct .acct-err:not([hidden])");
ok(/Couldn't log out/.test(await page.textContent("#acct .acct-err")) && (await page.textContent(".acct-open .label")) === "Account", "failed logout is reported, still signed in");
await page.unroute("**/api/auth/logout"); await page.click('#acct [data-act="close"]');
// the session ends behind the page's back: one 401, then back to previews, no request loop
await ctx.clearCookies();
const proCalls = []; page.on("request", (q) => { if (q.url().includes("/api/pro?")) proCalls.push(q.url()); });
await page.click('#styles [data-style="filled"]');
await (await page.$$(".tile[data-i]:has(.lk)"))[3].click();
await page.waitForFunction(() => document.querySelector(".acct-open .label").textContent === "Log in", null, { timeout: 5000 });
await page.waitForTimeout(1500);
ok(proCalls.length <= 2, `after the session ends: ${proCalls.length} /api/pro call(s), no loop`);
ok(await page.isVisible("#p-lock .pill"), "after the session ends: the sheet offers Get Pro again");

// 13. phones: nothing wider than the screen, login configured, Rupiah visitor
for (const width of [360, 390]) {
  const pc = await browser.newContext({ viewport: { width, height: 800 }, timezoneId: "Asia/Jakarta", isMobile: true, hasTouch: true });
  const pp = await pc.newPage();
  for (const url of ["/", "/pricing"]) {
    await pp.goto("http://localhost:4100" + url);
    await pp.waitForSelector(".acct-open:not([hidden])");
    const w = await pp.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, right: Math.max(...[...document.querySelectorAll(".nav-actions > *")].filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect().right)) }));
    ok(w.sw <= w.iw && w.right <= w.iw - 8, `${width}px ${url}: page ${w.sw}px and nav (right edge ${Math.round(w.right)}px) fit the ${w.iw}px screen`);
    if (url === "/pricing" && width === 360) await pp.screenshot({ path: `${SHOTS}/pricing-360.png`, fullPage: false, clip: { x: 0, y: 0, width: 360, height: 800 } });
  }
  if (width === 390) { await pp.goto("http://localhost:4100/"); await pp.screenshot({ path: `${SHOTS}/home-390.png`, clip: { x: 0, y: 0, width: 390, height: 260 } }); }
  await pc.close();
}

// 14. the banner admits when the clipboard is refused
const bc = await browser.newContext({ viewport: { width: 1280, height: 400 } });
await bc.addInitScript(() => { Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) } }); });
const bp = await bc.newPage(); await bp.goto("http://localhost:4100/pricing");
await bp.click(".promo-code");
ok(await bp.$eval(".promo-code", (b) => b.classList.contains("manual") && !b.classList.contains("copied") && getSelection().toString() === "LAUNCH50"), "banner: refused clipboard → code selected, 'press Ctrl/⌘ C'");
await bc.close();

ok(errors.length === 0, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
await browser.close();

// 11. the daily re-check: an old session whose seat was revoked is ended
const crypto = await import("node:crypto");
const old = Math.floor(Date.now() / 1000) - 2 * 86400;
const data = Buffer.from(JSON.stringify({ e: "pro@x.com", c: "c1", m: "m1", chk: old, exp: old + 30 * 86400 })).toString("base64url");
const mac = crypto.createHmac("sha256", process.env.SESSION_SECRET).update(data).digest("base64url");
revoke(true);
let res = await fetch("http://localhost:4100/api/pro?style=sharp&icon=general/home", { headers: { cookie: `__Host-meya_pro=${data}.${mac}` } });
ok(res.status === 401 && /Max-Age=0/.test(res.headers.get("set-cookie") || ""), "re-check after a day: revoked seat → 401 and cookie cleared");
revoke(false);
// (the revoked verdict for m1 is remembered for 10 minutes on purpose; check a different, still-granted member)
const data3 = Buffer.from(JSON.stringify({ e: "two@x.com", c: "c3", m: "m3", chk: old, exp: old + 30 * 86400 })).toString("base64url");
const mac3 = crypto.createHmac("sha256", process.env.SESSION_SECRET).update(data3).digest("base64url");
res = await fetch("http://localhost:4100/api/pro?style=sharp&icon=general/home", { headers: { cookie: `__Host-meya_pro=${data3}.${mac3}` } });
ok(res.status === 200 && /__Host-meya_pro=/.test(res.headers.get("set-cookie") || ""), "re-check after a day: still granted → 200 and cookie refreshed");
res = await fetch("http://localhost:4100/api/pro?style=sharp&icon=general/home", { headers: { cookie: `__Host-meya_pro=${data}.${mac.slice(0, -2)}xx` } });
ok(res.status === 401, "tampered cookie → 401");

// 15. a license-key session ends when its key is disabled (daily re-check)
const old2 = Math.floor(Date.now() / 1000) - 2 * 86400;
const { keyHash } = await import(path.join(REPO, "api/_lib/polar.js"));
const data2 = Buffer.from(JSON.stringify({ e: "seat@x.com", c: "c1", m: "m1", k: "lk1", h: keyHash("MEYA-GOOD-KEY-1234"), chk: old2, exp: old2 + 30 * 86400 })).toString("base64url");
const mac2 = crypto.createHmac("sha256", process.env.SESSION_SECRET).update(data2).digest("base64url");
disableKey(true);
res = await fetch("http://localhost:4100/api/pro?style=sharp&icon=general/home", { headers: { cookie: `__Host-meya_pro=${data2}.${mac2}` } });
ok(res.status === 401, "re-check: a disabled license key ends its sessions");
disableKey(false);
res = await fetch("http://localhost:4100/api/pro?style=sharp&icon=general/home", { headers: { cookie: `__Host-meya_pro=${data2}.${mac2.slice(0, -1)}é` } });
ok(res.status === 401, "a non-ASCII cookie signature → 401, not a crash");

// 15b. an access code (PRO_ACCESS_CODES) signs in without Polar, on the site and in the Figma plugin
const before = log.length;
const typed = ACCESS_CODE.toLowerCase().replace(/-/g, " ");
res = await fetch("http://localhost:4100/api/auth/license", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: typed }) });
const codeCookie = (res.headers.get("set-cookie") || "").split(";")[0];
ok(res.status === 200 && (await res.json()).email === "tester (access code)" && codeCookie.startsWith("__Host-meya_pro="), "access code: signed in on the site, typed in lower case with spaces");
res = await fetch("http://localhost:4100/api/pro?style=sharp&icon=general/home", { headers: { cookie: codeCookie } });
ok(res.status === 200 && /<svg/.test(await res.text()), "access code: Pro icons copy");
ok(!log.slice(before).some((l) => /\/v1\//.test(l)), "access code: Polar is never asked");
res = await fetch("http://localhost:4100/api/auth/license", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "MEYA-TEST0-TEST1-TEST2-TEST4" }) });
ok(res.status === 401, "a code one letter off is refused");
res = await fetch("http://localhost:4100/api/plugin/license", { method: "POST", headers: { Origin: "null", "Content-Type": "application/json" }, body: JSON.stringify({ key: ACCESS_CODE }) });
const codeToken = res.status === 200 ? (await res.json()).token : null;
res = codeToken && await fetch("http://localhost:4100/api/plugin/pro?style=sharp&icon=general/home", { headers: { Origin: "null", Authorization: `Bearer ${codeToken}` } });
ok(!!res && res.status === 200, "access code: the Figma plugin signs in and places Pro icons");
const [cd] = codeCookie.split("=")[1].split(".");
const codeSession = JSON.parse(Buffer.from(cd, "base64url").toString());
const old3 = Math.floor(Date.now() / 1000) - 2 * 86400;
const data4 = Buffer.from(JSON.stringify({ ...codeSession, chk: old3 })).toString("base64url");
const mac4 = crypto.createHmac("sha256", process.env.SESSION_SECRET).update(data4).digest("base64url");
res = await fetch("http://localhost:4100/api/pro?style=sharp&icon=general/home", { headers: { cookie: `__Host-meya_pro=${data4}.${mac4}` } });
ok(res.status === 200, "access code: still in after a day (no Polar account to re-check)");
if (MODE === "node") {
  // the Worker reads its variables on each request; in Node the test can take the code off the list
  const keep = process.env.PRO_ACCESS_CODES;
  process.env.PRO_ACCESS_CODES = "";
  res = await fetch("http://localhost:4100/api/pro?style=sharp&icon=general/home", { headers: { cookie: codeCookie } });
  ok(res.status === 401 && /Max-Age=0/.test(res.headers.get("set-cookie") || ""), "access code taken off the list → its sessions end");
  process.env.PRO_ACCESS_CODES = keep;
}

// 16. the host: functions, unknown paths, and (on Cloudflare) clean URLs; GitHub gets a User-Agent
res = await fetch("http://localhost:4100/api/auth/logout");
ok(res.status === 405, "GET on a POST-only function → 405");
res = await fetch("http://localhost:4100/api/geo");
ok((await res.json()).country === "ID" && /no-store/.test(res.headers.get("cache-control") || ""), "/api/geo: the visitor's country, not cached");
res = await fetch("http://localhost:4100/api/auth/license", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "MEYA-GOOD-KEY-1234", pad: "x".repeat(20000) }) });
ok(res.status === 400, `a login body over 4 KB is not read (${res.status})`);
res = await fetch("http://localhost:4100/api/auth/license", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ key: "MEYA-GOOD-KEY-1234" }) });
ok(res.status === 200 && /__Host-meya_pro=/.test(res.headers.get("set-cookie") || ""), "a small login body is read whatever its content type");
res = await fetch("http://localhost:4100/api/nothing");
ok(res.status === 404, "unknown function → 404");
ok(log.some((l) => /^GITHUB .* auth=yes ua=meya-icons-site/.test(l)) && !log.some((l) => /ua=none/.test(l)), "GitHub is called with the token and a User-Agent");
if (MODE === "workerd") {
  res = await fetch("http://localhost:4100/pricing.html", { redirect: "manual" });
  ok([301, 307, 308].includes(res.status) && /\/pricing$/.test(res.headers.get("location") || ""), `/pricing.html → redirect to /pricing (${res.status} ${res.headers.get("location")})`);
  res = await fetch("http://localhost:4100/pricing");
  ok(res.status === 200 && /<title>Pricing/.test(await res.text()), "/pricing → the pricing page");
  res = await fetch("http://localhost:4100/");
  ok(res.status === 200 && /<title>/.test(await res.text()), "/ → the home page");
  ok(/max-age=63072000/.test(res.headers.get("strict-transport-security") || ""), "pages send HSTS");
  res = await fetch("http://localhost:4100/_headers");
  ok(res.status === 404, `_headers is not published (${res.status})`);
  res = await fetch("http://localhost:4100/no-such-page");
  ok(res.status === 404, "unknown page → 404");
  res = await fetch("http://localhost:4100/pro/glass/general/home.webp");
  ok(res.status === 200 && /image\/webp/.test(res.headers.get("content-type") || ""), "Pro previews served as images");
  for (const f of ["/wrangler.jsonc", "/worker.js", "/api/_lib/session.js", "/package.json", "/scripts/guard.mjs"]) {
    res = await fetch("http://localhost:4100" + f);
    ok(res.status === 404, `${f} is not published (${res.status})`);
  }
}

stop();
fs.writeFileSync(`${SHOTS}/log.txt`, log.join("\n"));
console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
