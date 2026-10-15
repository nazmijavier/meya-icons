// Renders image previews of the PRO showcase styles (see `showcase` in styles.mjs) from ../meya-icons-pro.
// The site shows these images instead of the vector files, so Pro icons can be browsed but not copied.
// Usage: node scripts/pro-previews.mjs [style ...]   (no styles: every showcase style)
// Needs Playwright with Chromium: npm i -D playwright && npx playwright install chromium
// Writes docs/pro/<style>.webp (one sprite for the grid), docs/pro/<style>/<category>/<name>.webp (large, for the
// details sheet) and scripts/pro-previews.json, which build.mjs reads.
// Animated styles: the sprite holds each icon's still frame, and the large previews are animated WebP that loop
// one full cycle of the icon's motion (made with ffmpeg; without it they stay still).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRO_DIR, proIcons } from "./pro.mjs";
import { STYLES } from "./styles.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = (...p) => path.join(root, ...p);
const CELL = 96, COLS = 16, BIG = 480, MOVING = 320;

let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch {
  console.error("Playwright is needed to render previews: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

// Animated WebP of each icon's motion: one full cycle (the longest track), from the second cycle on so tracks
// that start late are already moving, black on transparent like the still previews.
async function moving(st, icons) {
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); } catch { console.warn(`${st.label}: ffmpeg not found, the large previews stay still`); return; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "meya-moving-"));
  const pg = await browser.newPage({ viewport: { width: MOVING, height: MOVING } });
  for (const i of icons) {
    await pg.setContent(`<body style="margin:0;background:transparent">${i.svg.replace("<svg ", `<svg style="display:block;width:${MOVING}px;height:${MOVING}px;color:#000" `)}</body>`);
    const period = await pg.evaluate(() => Math.max(...document.getAnimations().map((a) => a.effect.getTiming().duration)));
    const frames = Math.min(48, Math.round((period / 1000) * 20)), dir = fs.mkdtempSync(path.join(tmp, "f-"));
    for (let f = 0; f < frames; f++) {
      await pg.evaluate((t) => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = t; } }, period + (f * period) / frames);
      await pg.screenshot({ path: path.join(dir, `${String(f).padStart(3, "0")}.png`), omitBackground: true });
    }
    const out = rel("docs/pro", st.id, `${i.k}.webp`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String((frames * 1000) / period), "-i", path.join(dir, "%03d.png"),
      "-c:v", "libwebp_anim", "-lossless", "0", "-q:v", "70", "-compression_level", "6", "-loop", "0", "-pix_fmt", "yuva420p", out]);
  }
  await pg.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

const manifestPath = rel("scripts/pro-previews.json");
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
const browser = await chromium.launch();
const page = await browser.newPage();
const only = process.argv.slice(2);
for (const st of STYLES.filter((s) => s.showcase && (!only.length || only.includes(s.id)))) {
  const icons = proIcons(st.id);
  if (!icons.length) { console.log(`${st.label}: no icons in ${path.join(PRO_DIR, st.id)}, skipped`); continue; }
  // One-color styles render black on transparent: the site only uses the alpha channel, as a mask filled with
  // the icon colour. Full-color styles render as they are and the site shows the image itself.
  // an animated icon's still frame is the icon without its motion
  const still = (svg) => (st.animated ? svg.replace(/<style>[\s\S]*?<\/style>\s*/, "") : svg);
  const sources = icons.map((i) => "data:image/svg+xml;base64," + Buffer.from(st.color ? still(i.svg) : still(i.svg).replace(/currentColor/g, "#000")).toString("base64"));
  const files = await page.evaluate(async ({ sources, CELL, COLS, BIG }) => {
    const load = (src) => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = src; });
    const webp = (c) => new Promise((ok) => c.toBlob((b) => { const r = new FileReader(); r.onload = () => ok(r.result.split(",")[1]); r.readAsDataURL(b); }, "image/webp", 0.8));
    const imgs = await Promise.all(sources.map(load));
    const sprite = document.createElement("canvas");
    sprite.width = COLS * CELL; sprite.height = Math.ceil(imgs.length / COLS) * CELL;
    const sx = sprite.getContext("2d");
    imgs.forEach((im, k) => sx.drawImage(im, (k % COLS) * CELL, Math.floor(k / COLS) * CELL, CELL, CELL));
    const big = [];
    for (const im of imgs) {
      const c = document.createElement("canvas"); c.width = c.height = BIG;
      c.getContext("2d").drawImage(im, 0, 0, BIG, BIG);
      big.push(await webp(c));
    }
    return { sprite: await webp(sprite), big };
  }, { sources, CELL, COLS, BIG });
  fs.rmSync(rel("docs/pro", st.id), { recursive: true, force: true });
  fs.mkdirSync(rel("docs/pro"), { recursive: true });
  fs.writeFileSync(rel("docs/pro", `${st.id}.webp`), Buffer.from(files.sprite, "base64"));
  icons.forEach((i, k) => {
    const f = rel("docs/pro", st.id, `${i.k}.webp`);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.from(files.big[k], "base64"));
  });
  if (st.animated) await moving(st, icons);
  manifest[st.id] = { cols: COLS, icons: icons.map((i) => [i.k, i.h]) };
  console.log(`${st.label}: ${icons.length} previews → docs/pro/${st.id}.webp and docs/pro/${st.id}/`);
}
await browser.close();
fs.writeFileSync(manifestPath, JSON.stringify(manifest) + "\n");
