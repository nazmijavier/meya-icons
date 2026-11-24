// Pricing page QA: screenshots and layout checks at desktop and phone sizes. Prices are in US dollars for everyone,
// including visitors from Indonesia.
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
    const text = await page.evaluate(() => document.body.innerText);
    ok(!/__[A-Z]/.test(text), `${tag}: no build placeholders in the text`);
    ok(!/\bIDR\b/.test(text), `${tag}: no "IDR" shown`);
    ok(!/Rp\d/.test(text) && text.includes("$29"), `${tag}: price shown in US dollars`);
    ok(!/a year|per seat|first year|subscription,? then|Cancel anytime/i.test(text), `${tag}: no yearly or per-seat wording`);
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
    ok(await btn.evaluate((a) => /^https:\/\/buy\.polar\.sh\//.test(a.href)), `${tag}: Get Pro links to the Polar checkout`);
    const rows = await page.evaluate(() => [".cta", ".rule", ".checks"].map((s) => [...document.querySelectorAll(`.plan ${s}`)].map((el) => Math.round(el.getBoundingClientRect().top))));
    if (vp.width === 1440) ok(rows.every(([a, b]) => a === b), `${tag}: both cards line up (button, rule, list) ${JSON.stringify(rows)}`);
    ok(!errors.length, `${tag}: no script errors ${errors.join(" | ")}`);
    await page.screenshot({ path: `${OUT}/full-${tag}.png`, fullPage: true });
    await page.screenshot({ path: `${OUT}/top-${tag}.png` });
    await ctx.close();
  }
}

// one price, paid once
{
  const { ctx, page } = await open({ width: 1440, height: 900 }, "usd");
  ok((await page.textContent("#pro-price")).trim() === "$29", `price: ${await page.textContent("#pro-price")}`);
  ok((await page.textContent("#pro-sub")).trim() === "One payment, yours to keep", `price line: ${await page.textContent("#pro-sub")}`);
  ok(!(await page.$("#seat-up")) && !(await page.$("#pro-was")), "no seat picker and no struck price");
  await page.screenshot({ path: `${OUT}/card-pro.png`, clip: await (await page.$("#pro")).boundingBox() });

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

// phone buy bar
{
  const { ctx, page } = await open({ width: 375, height: 812 }, "usd");
  ok(!(await page.evaluate(() => document.querySelector("#buybar").classList.contains("show"))), "phone: buy bar hidden at the top");
  await page.evaluate(() => document.querySelector("#styles").scrollIntoView());
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => document.querySelector("#buybar").classList.contains("show")), "phone: buy bar shows once Get Pro scrolled away");
  ok((await page.textContent("#bar-price")).includes("$29 once"), `phone: bar price ${await page.textContent("#bar-price")}`);
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
