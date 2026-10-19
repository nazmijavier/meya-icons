// Pricing page QA: screenshots and layout checks at desktop and phone sizes, in USD and in Rupiah.
import path from "node:path";
import { createRequire } from "node:module";
import { start, stop } from "./serve.mjs";

// Usage: node tests/pricing.test.mjs <screenshot folder>   (Playwright as in login.test.mjs)
const { chromium } = createRequire(process.env.PWDIR ? path.resolve(process.env.PWDIR, "x.js") : import.meta.url)("playwright");
const OUT = process.argv[2];
let fails = 0;
const ok = (cond, what) => { console.log(`${cond ? "PASS" : "FAIL"}  ${what}`); if (!cond) fails++; };

await start();
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

async function open(vp, cur, extra = {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: vp.width < 500 ? 2 : 1, timezoneId: cur === "idr" ? "Asia/Jakarta" : "America/New_York", ...extra });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/geo", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ country: cur === "idr" ? "ID" : "US" }) }));
  await page.goto("http://localhost:4100/pricing", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  return { ctx, page, errors };
}

for (const cur of ["usd", "idr"]) {
  for (const vp of [{ width: 1440, height: 900 }, { width: 375, height: 812 }, { width: 360, height: 740 }]) {
    const tag = `${vp.width}-${cur}`;
    const { ctx, page, errors } = await open(vp, cur);
    ok(await page.evaluate(() => document.documentElement.dataset.cur) === cur, `${tag}: currency is ${cur}`);
    const text = await page.evaluate(() => document.body.innerText);
    ok(!/__[A-Z]/.test(text), `${tag}: no build placeholders in the text`);
    ok(!/\bIDR\b/.test(text), `${tag}: no "IDR" shown`);
    ok(cur === "idr" ? !/\$\d/.test(text) : !/Rp\d/.test(text), `${tag}: only one currency visible`);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(wide <= 0, `${tag}: no horizontal scroll (${wide}px over)`);
    const over = await page.evaluate(() => [...document.querySelectorAll("main *, .nav *")].filter((el) => {
      const r = el.getBoundingClientRect(); return r.width && r.right > innerWidth + 0.5 && getComputedStyle(el).position !== "absolute";
    }).slice(0, 5).map((el) => el.id || el.className || el.tagName));
    ok(!over.length, `${tag}: nothing pokes past the right edge ${over.join(", ")}`);
    const btn = await page.$("#get-pro");
    const box = await btn.boundingBox();
    if (vp.width === 1440) ok(box && box.y + box.height <= vp.height, `${tag}: Get Pro is on the first screen (bottom ${Math.round(box.y + box.height)}px)`);
    ok((await btn.textContent()).trim() === "Get Pro", `${tag}: button reads Get Pro: ${await btn.textContent()}`);
    const rows = await page.evaluate(() => [".cta", ".rule", ".checks"].map((s) => [...document.querySelectorAll(`.plan ${s}`)].map((el) => Math.round(el.getBoundingClientRect().top))));
    if (vp.width === 1440) ok(rows.every(([a, b]) => a === b), `${tag}: both cards line up (button, rule, list) ${JSON.stringify(rows)}`);
    ok(!errors.length, `${tag}: no script errors ${errors.join(" | ")}`);
    await page.screenshot({ path: `${OUT}/full-${tag}.png`, fullPage: true });
    await page.screenshot({ path: `${OUT}/top-${tag}.png` });
    await ctx.close();
  }
}

// seats and team math
{
  const { ctx, page } = await open({ width: 1440, height: 900 }, "usd");
  ok((await page.textContent("#pro-price")) === "$30", `1 seat: first-year price ${await page.textContent("#pro-price")}`);
  ok((await page.textContent("#pro-was")) === "$60", "1 seat: regular price struck");
  ok((await page.textContent("#pro-sub")) === "First year, then $60 a year", `1 seat: ${await page.textContent("#pro-sub")}`);
  for (let i = 0; i < 4; i++) await page.click("#seat-up");
  // 60 + 4 × 22 = 148, 50% off → 74
  ok((await page.textContent("#pro-price")) === "$74", `5 seats: ${await page.textContent("#pro-price")}`);
  ok((await page.textContent("#pro-was")) === "$148", `5 seats regular: ${await page.textContent("#pro-was")}`);
  ok((await page.textContent("#pro-sub")) === "5 seats · first year, then $148 a year", `5 seats: ${await page.textContent("#pro-sub")}`);
  for (let i = 0; i < 5; i++) await page.click("#seat-up");
  // 60 + 88 + 5 × 10 = 198 → 99
  ok((await page.textContent("#pro-price")) === "$99", `10 seats: ${await page.textContent("#pro-price")}`);
  await page.screenshot({ path: `${OUT}/card-10-seats.png`, clip: await (await page.$("#pro")).boundingBox() });
  for (let i = 0; i < 40; i++) await page.click("#seat-up");
  ok((await page.textContent("#seat-n")) === "50 seats" && (await page.isDisabled("#seat-up")) && (await page.isVisible("#seat-max")), "50 seats: stepper stops and the contact line shows");

  // the gallery switches style
  ok((await page.getAttribute("#g-panel", "data-style")) === "glass", "gallery starts on Glass");
  await page.click("#tab-stroke");
  await page.waitForFunction(() => document.querySelector("#g-panel").dataset.style === "stroke");
  ok((await page.textContent("#g-link")).startsWith("Browse all") && (await page.textContent("#g-name")) === "Stroke", "gallery: Stroke tab shows Stroke");
  await page.click("#tab-duotone");
  ok((await page.getAttribute("#g-panel", "data-style")) === "duotone" && await page.isVisible("#g-panel .g-d svg"), "gallery: Duotone shows the inline icons");
  await page.focus("#tab-duotone"); await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.querySelector("#g-panel").dataset.style === "stroke");
  ok(true, "gallery: arrow keys move between tabs");
  const broken = await page.evaluate(async () => {
    const urls = [...document.querySelectorAll(".g-grid li")].flatMap((li) => ["stroke", "stroke-duotone", "sharp", "filled", "glass"].map((s) => `pro/${s}/${li.dataset.ref}.webp`).concat(`pro/animated/${li.dataset.ref}.tile.webp`));
    const bad = [];
    for (const u of urls) { const r = await fetch(u); if (!r.ok) bad.push(u); }
    return bad;
  });
  ok(!broken.length, `gallery: every preview exists ${broken.join(", ")}`);
  await page.click('.st[data-style="filled"]');
  await page.waitForFunction(() => document.querySelector("#g-panel").dataset.style === "filled");
  ok(true, "hero tile selects its style in the gallery");
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/gallery-filled.png`, clip: await (await page.$(".gallery")).boundingBox() });
  await page.click("#tab-animated");
  await page.waitForFunction(() => document.querySelector("#g-panel").dataset.style === "animated");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/gallery-animated.png`, clip: await (await page.$(".gallery")).boundingBox() });
  await ctx.close();
}

// IDR math
{
  const { ctx, page } = await open({ width: 1440, height: 900 }, "idr");
  ok((await page.textContent("#pro-price")) === "Rp395.000", `IDR 1 seat: ${await page.textContent("#pro-price")}`);
  for (let i = 0; i < 4; i++) await page.click("#seat-up");
  // 790.000 + 4 × 290.000 = 1.950.000 → 975.000
  ok((await page.textContent("#pro-price")) === "Rp975.000", `IDR 5 seats: ${await page.textContent("#pro-price")}`);
  await page.screenshot({ path: `${OUT}/card-idr-5.png`, clip: await (await page.$("#pro")).boundingBox() });
  await ctx.close();
}

// phone buy bar
{
  const { ctx, page } = await open({ width: 375, height: 812 }, "usd");
  ok(!(await page.evaluate(() => document.querySelector("#buybar").classList.contains("show"))), "phone: buy bar hidden at the top");
  await page.evaluate(() => document.querySelector("#styles").scrollIntoView());
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => document.querySelector("#buybar").classList.contains("show")), "phone: buy bar shows once Get Pro scrolled away");
  ok((await page.textContent("#bar-price")).includes("$30"), `phone: bar price ${await page.textContent("#bar-price")}`);
  await page.screenshot({ path: `${OUT}/phone-bar.png` });
  await page.evaluate(() => document.querySelector("#end").scrollIntoView());
  await page.waitForTimeout(500);
  ok(!(await page.evaluate(() => document.querySelector("#buybar").classList.contains("show"))), "phone: buy bar hides at the closing band");
  await ctx.close();
}

// reduced motion: Animated shows still frames
{
  const { ctx, page } = await open({ width: 1440, height: 900 }, "usd", { reducedMotion: "reduce" });
  await page.click("#tab-animated");
  ok(await page.isVisible("#g-panel .g-still") && (await page.textContent("#g-note")).includes("paused"), "reduced motion: Animated shows still frames");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/gallery-still.png`, clip: await (await page.$(".gallery")).boundingBox() });
  await ctx.close();
}

await browser.close();
stop();
console.log(fails ? `${fails} FAILED` : "ALL PASSED");
process.exit(fails ? 1 : 0);
