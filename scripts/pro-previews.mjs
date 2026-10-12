// Renders image previews of the PRO showcase styles (see `showcase` in styles.mjs) from ../meya-icons-pro.
// The site shows these images instead of the vector files, so Pro icons can be browsed but not copied.
// Usage: node scripts/pro-previews.mjs
// Needs Playwright with Chromium: npm i -D playwright && npx playwright install chromium
// Writes docs/pro/<style>.webp (one sprite for the grid), docs/pro/<style>/<category>/<name>.webp (large, for the
// details sheet) and scripts/pro-previews.json, which build.mjs reads.
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRO_DIR, proIcons } from "./pro.mjs";
import { STYLES } from "./styles.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = (...p) => path.join(root, ...p);
const CELL = 96, COLS = 16, BIG = 480;

let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch {
  console.error("Playwright is needed to render previews: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

const manifestPath = rel("scripts/pro-previews.json");
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
const browser = await chromium.launch();
const page = await browser.newPage();
for (const st of STYLES.filter((s) => s.showcase)) {
  const icons = proIcons(st.id);
  if (!icons.length) { console.log(`${st.label}: no icons in ${path.join(PRO_DIR, st.id)}, skipped`); continue; }
  // Black on transparent: the site only uses the alpha channel, as a mask filled with the icon colour.
  const sources = icons.map((i) => "data:image/svg+xml;base64," + Buffer.from(i.svg.replace(/currentColor/g, "#000")).toString("base64"));
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
  manifest[st.id] = { cols: COLS, icons: icons.map((i) => [i.k, i.h]) };
  console.log(`${st.label}: ${icons.length} previews → docs/pro/${st.id}.webp and docs/pro/${st.id}/`);
}
await browser.close();
fs.writeFileSync(manifestPath, JSON.stringify(manifest) + "\n");
