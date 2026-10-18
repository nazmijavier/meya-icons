// Builds the website (docs/index.html), README preview images and README counts from icons/<style>/.
// Usage: node scripts/build.mjs [artifact-fragment-output-path]
//        node scripts/build.mjs --admin   the owner's copy, see ADMIN below
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES, COLOR_SETS, HIDDEN } from "./categories.mjs";
import { keywordsFor } from "./keywords.mjs";
import { PRO_DIR, PRO_SAMPLES, previewIcons, proIcons } from "./pro.mjs";
const SAMPLES = (() => { try { return JSON.parse(fs.readFileSync(new URL("./pro-samples.json", import.meta.url), "utf8")); } catch { return {}; } })();
import { STYLES } from "./styles.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = (...p) => path.join(root, ...p);
const VERSION = JSON.parse(fs.readFileSync(rel("package.json"), "utf8")).version.replace(/\.0$/, "");
const REPO = "https://github.com/nazmijavier/meya-icons";
const SITE = "https://icons.meyalab.com";
// The sponsor page is finished but not open yet: flip this to true to publish docs/sponsor.html.
const PUBLISH_SPONSOR_PAGE = true;
// Paste the access key from web3forms.com so the sponsor form emails hello@meyalab.com.
// Left empty, the form falls back to opening the visitor's own mail app.
const WEB3FORMS_KEY = "11a56e93-754a-4035-87e6-e90bb4de7bf2";
// The owner's copy (--admin): the same site with every style as real vectors (the Pro styles read from
// ../meya-icons-pro), the hidden categories shown and nothing locked. It is written to admin/index.html only:
// admin/ is git-ignored and outside docs/, so it is never committed or deployed, and docs/ and the README
// are left untouched.
const ADMIN = process.argv.includes("--admin");
const ARGS = process.argv.slice(2).filter((a) => a !== "--admin");

// ---------- Read icons ----------
// Every style is read from icons/<style>/. An icon is the union of its variants by category and name.
// Full-color sets (cursors, flags) are their own "style": one category, read from icons/outline/<id>/.
function readStyle(style) {
  const out = new Map();
  const { set, showcase } = STYLES.find((st) => st.id === style);
  const fromPro = ADMIN && showcase;
  for (const [cat] of CATEGORIES) {
    if (set ? cat !== style : COLOR_SETS.includes(cat) || (!ADMIN && HIDDEN.includes(cat))) continue;
    const dir = fromPro ? path.join(PRO_DIR, style, cat) : rel("icons", set ? "outline" : style, cat);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".svg")).sort()) {
      const name = file.slice(0, -4);
      const inner = fs
        .readFileSync(path.join(dir, file), "utf8")
        .replace(/^[\s\S]*?<svg[^>]*>/, "")
        .replace(/<\/svg>\s*$/, "")
        .replace(/\n\s*/g, "")
        .trim()
        .replace(/id="([^"]+)"/g, `id="${style}-${cat}-${name}-$1"`)
        .replace(/url\(#([^)]+)\)/g, `url(#${style}-${cat}-${name}-$1)`);
      out.set(`${cat}/${name}`, inner);
    }
  }
  return out;
}
const variants = Object.fromEntries(STYLES.map((st) => [st.id, readStyle(st.id)]));
const keys = new Set(Object.values(variants).flatMap((m) => [...m.keys()]));
const order = CATEGORIES.map(([id]) => id);
const icons = [...keys]
  .map((k) => {
    const [c, n] = k.split("/");
    return { n, c, v: Object.fromEntries(STYLES.filter((st) => variants[st.id].has(k)).map((st) => [st.id, variants[st.id].get(k)])) };
  })
  .sort((x, y) => order.indexOf(x.c) - order.indexOf(y.c) || x.n.localeCompare(y.n));
const styles = STYLES.map((st) => ({ ...st, count: icons.filter((i) => i.v[st.id]).length }));
const ready = styles.filter((st) => st.count);
// Headline count: every icon in every style that has shipped.
const total = ready.reduce((n, st) => n + st.count, 0);
// Drawing styles only, for wording like "in 2 styles" and the README previews.
const lineStyles = ready.filter((st) => !st.set);
const categories = CATEGORIES.map(([id, label]) => ({
  id, label,
  count: icons.filter((i) => i.c === id).length,
  counts: Object.fromEntries(styles.map((st) => [st.id, icons.filter((i) => i.c === id && i.v[st.id]).length])),
})).filter((c) => c.count);

// ---------- PRO showcase: browsable on the site from image previews, never as vectors ----------
// Previews come from scripts/pro-previews.mjs. Showcase styles stay out of the free counts, the README tables,
// the npm package and the Figma plugin data. Their icons carry "@<n>", the cell in docs/pro/<style>.webp.
const PREVIEWS = fs.existsSync(rel("scripts/pro-previews.json")) ? JSON.parse(fs.readFileSync(rel("scripts/pro-previews.json"), "utf8")) : {};
const showcase = {};
for (const st of STYLES.filter((s) => s.showcase && !variants[s.id].size && PREVIEWS[s.id])) {
  const shown = PREVIEWS[st.id].icons;
  if (fs.existsSync(path.join(PRO_DIR, st.id))) {
    const now = new Map(previewIcons(st.id).map((i) => [i.k, i.h]));
    const changed = shown.filter(([k, h]) => now.get(k) !== h).length + [...now.keys()].filter((k) => !shown.some(([s]) => s === k)).length;
    if (changed) console.warn(`${st.label} previews are out of date (${changed} icons differ from ../meya-icons-pro). Run: node scripts/pro-previews.mjs`);
  }
  showcase[st.id] = { cols: PREVIEWS[st.id].cols, cell: new Map(shown.map(([k], n) => [k, n])) };
}
const missing = Object.entries(showcase).flatMap(([id, sc]) => [...sc.cell.keys()].filter((k) => !keys.has(k) && !HIDDEN.includes(k.split("/")[0])).map((k) => `${id}/${k}`));
if (missing.length) console.warn(`Showcase previews with no Outline icon, left out: ${missing.join(", ")}`);
const siteStyles = styles.map((st) => (showcase[st.id] ? { ...st, count: icons.filter((i) => showcase[st.id].cell.has(`${i.c}/${i.n}`)).length, locked: true, cols: showcase[st.id].cols } : st));
const siteCategories = categories.map((c) => ({ ...c, counts: { ...c.counts, ...Object.fromEntries(Object.entries(showcase).map(([id, sc]) => [id, icons.filter((i) => i.c === c.id && sc.cell.has(`${i.c}/${i.n}`)).length])) } }));

// ---------- Pro teaser (the full PRO sets stay in ../meya-icons-pro) ----------
// Paste the Polar checkout link here to switch "Get Pro" on.
const POLAR_CHECKOUT = "https://buy.polar.sh/polar_cl_uUy8cBvgRtyC9pjDe2xcwaCr9XAHLMGrP8Hz307L1Od";
// Pro styles that have shipped are the showcase ones (browsable on the site); the others show as coming soon.
const PRO_STYLES = STYLES.filter((st) => st.pro && st.showcase).map((st) => st.id);
const TEASER = PRO_SAMPLES;
let proCount = 0, proPreview = "";
const proCounts = {};
// Pro counts are the icons the site previews (scripts/pro-previews.json), so every computer builds the same numbers.
for (const st of PRO_STYLES) {
  proCounts[st] = PREVIEWS[st] ? PREVIEWS[st].icons.length : 0;
  proCount += proCounts[st];
}
for (const n of TEASER) {
  // one teaser icon per slot, cycling through the Pro styles; drawings from scripts/pro-samples.json
  const st = PRO_STYLES[TEASER.indexOf(n) % PRO_STYLES.length], inner = SAMPLES[`${st}/${n}`];
  if (!inner) continue;
  const attrs = st === "pixel" ? ' shape-rendering="crispEdges"' : "";
  proPreview += `<span><svg viewBox="0 0 24 24" fill="none"${attrs}>${inner}</svg></span>`;
}

// ---------- Footer shared by every page ----------
const FOOTER = `<footer class="footer">
  <div class="wrap">
    <a class="brand" href="./">Meya Icons <span class="pro">__VERSION__</span></a>
    <div class="footer-meta">
      <span>__COUNT__ free icons · MIT License</span>
      <a href="pricing">Pricing</a>
      <a href="mailto:hello@meyalab.com">hello@meyalab.com</a>
      <a href="https://meyalab.com/contact" target="_blank" rel="noopener">Need custom icons? Hire us</a>
    </div>
  </div>
</footer>`;

// ---------- Offer banner (top of every page) ----------
// The launch offer, shown site-wide. Set OFFER to null to take the banner down.
const OFFER = { code: "LAUNCH30", text: "30% off <span class=\"promo-long\">your first year of </span>Pro" };
const BANNER = OFFER
  ? `<div class="promo" role="region" aria-label="Offer">
  <p><span>${OFFER.text} with code</span> <button type="button" class="promo-code" data-code="${OFFER.code}" title="Copy code">${OFFER.code}</button> <a href="pricing#pro">Get Pro<span aria-hidden="true"> →</span></a></p>
</div>
<style>
.promo { background: #1D1D1F; color: #FFFFFF; font: 500 13px/1.3 "Inter", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; letter-spacing: -0.01em; }
.promo p { margin: 0 auto; min-height: 40px; padding: 7px 16px; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px 10px; text-align: center; }
.promo-code { font: 500 12px/1 "Geist Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace; letter-spacing: 0.04em; color: inherit; background: rgba(255, 255, 255, 0.12); border: 1px dashed rgba(255, 255, 255, 0.45); border-radius: 9999px; padding: 6px 10px; cursor: copy; transition: background-color 150ms ease; }
.promo-code:hover { background: rgba(255, 255, 255, 0.2); }
.promo-code.copied::after { content: " · copied"; }
.promo-code.manual { user-select: all; -webkit-user-select: all; }
.promo-code.manual::after { content: " · press Ctrl/⌘ C"; }
.promo a { color: inherit; opacity: 0.8; text-decoration: none; }
.promo a:hover { opacity: 1; text-decoration: underline; }
@media (max-width: 520px) { .promo-long { display: none; } }
</style>
<script>
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest(".promo-code");
  if (!b) return;
  const flag = (c) => { b.classList.remove("copied", "manual"); b.classList.add(c); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove(c), c === "manual" ? 6000 : 1600); };
  // when the clipboard is refused, select the code so it can be copied by hand
  const manual = () => { const r = document.createRange(); r.selectNodeContents(b.firstChild); const s = getSelection(); s.removeAllRanges(); s.addRange(r); flag("manual"); };
  (navigator.clipboard ? navigator.clipboard.writeText(b.dataset.code) : Promise.reject()).then(() => flag("copied"), manual);
});
</script>`
  : "";

// ---------- Pro login (site/account.html) ----------
// The nav button and login dialog on the home and pricing pages. Both stay hidden until the login is configured
// on Vercel (see api/_lib/polar.js), so the site works the same without it.
// On phones (≤ 420 px) nav labels hide and the icon stays, as for the other nav links.
const ACCOUNT_BUTTON = `<button type="button" class="nav-link acct-open" aria-label="Log in" hidden><svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 1.5c-3 0-5.5 1.6-5.5 3.6 0 .5.4.9.9.9h9.2c.5 0 .9-.4.9-.9 0-2-2.5-3.6-5.5-3.6z"/></svg><span class="label">Log in</span></button>`;
const ACCOUNT = fs.readFileSync(rel("site/account.html"), "utf8");
// Which Pro styles /api/pro may serve, and which categories stay private: generated so the server matches the site.
fs.writeFileSync(
  rel("api/_lib/catalog.js"),
  `// Generated by scripts/build.mjs from scripts/styles.mjs and scripts/categories.mjs. Do not edit.\n` +
    `export const PRO_STYLES = ${JSON.stringify(STYLES.filter((st) => st.pro && st.showcase).map((st) => st.id))};\n` +
    `export const HIDDEN = ${JSON.stringify(HIDDEN)};\n`
);
// The checkout link applies the launch code by itself (Polar's discount_code parameter).
const CHECKOUT_URL = POLAR_CHECKOUT && OFFER ? `${POLAR_CHECKOUT}?discount_code=${encodeURIComponent(OFFER.code)}` : POLAR_CHECKOUT;

// ---------- Website ----------
// On the site, default 1.3 strokes inherit from the root so the stroke slider can drive them.
const SEARCH = fs.readFileSync(rel("site/search.js"), "utf8");
const strip = (b) => b.replace(/\s*stroke-width="1\.3"/g, "");
const siteIcons = icons.map((i) => ({ ...i, k: keywordsFor(i.c, i.n), v: Object.fromEntries(Object.entries(i.v).map(([k, b]) => [k, strip(b)])) }));
const showcaseIcons = siteIcons.map((i) => {
  const extra = Object.entries(showcase).filter(([, sc]) => sc.cell.has(`${i.c}/${i.n}`)).map(([id, sc]) => [id, "@" + sc.cell.get(`${i.c}/${i.n}`)]);
  return extra.length ? { ...i, v: { ...i.v, ...Object.fromEntries(extra) } } : i;
});
const fragment = fs
  .readFileSync(rel("site/template.html"), "utf8")
  .replace("__BANNER__", BANNER)
  .replace("__ACCOUNT_BUTTON__", ACCOUNT_BUTTON)
  .replace("__ACCOUNT__", ACCOUNT)
  .replace("__FOOTER__", FOOTER)
  .replace("/*__DATA__*/", `window.MEYA=${JSON.stringify({ categories: siteCategories, styles: siteStyles, icons: showcaseIcons })};`)
  .replace("/*__SEARCH__*/", SEARCH)
  .replaceAll("__SPONSOR_LOGO__", fs.readFileSync(rel("assets/logo.svg"), "utf8").replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").trim())
  .replace("__CLICK_SOUND__", fs.readFileSync(rel("assets/click.wav")).toString("base64"))
  .replaceAll("__COUNT__", total.toLocaleString("en-US"))
  .replaceAll("__PRO_COUNT__", proCount.toLocaleString("en-US"))
  .replace("__PRO_PREVIEW__", proPreview)
  .replace('href="#pricing" class="plan-cta soon" id="get-pro" data-tip="Coming soon"', CHECKOUT_URL ? `href="${CHECKOUT_URL}" class="plan-cta" id="get-pro" target="_blank" rel="noopener"` : 'href="#pricing" class="plan-cta soon" id="get-pro" data-tip="Coming soon"')
  .replaceAll("__STYLECOUNT__", String(lineStyles.length))
  .replaceAll("__CATS__", String(categories.length))
  .replaceAll("__VERSION__", VERSION)
  .replaceAll("__REPO__", REPO)
  .replaceAll("__FAVICON__", `data:image/png;base64,${fs.readFileSync(rel("assets/favicon.png")).toString("base64")}`)
  .replace("__CHROME__", `data:image/jpeg;base64,${fs.readFileSync(rel("assets/logo-chrome.jpg")).toString("base64")}`);

const split = fragment.indexOf("</style>") + 8;
if (ADMIN) {
  // admin/ holds only this page, so the links to the other pages go to the live site
  const owner = fragment.replace(/href="(pricing|sponsor|pixel)"/g, `href="${SITE}/$1"`).replace(/<title>/, "<title>Owner · ");
  const at = owner.indexOf("</style>") + 8;
  const note = `<div style="position:fixed;left:12px;bottom:12px;z-index:99;padding:6px 10px;border-radius:8px;background:#1d1d1f;color:#fff;font:600 12px/1.2 Inter,system-ui,sans-serif">Owner copy · every style unlocked · keep private</div>`;
  fs.mkdirSync(rel("admin"), { recursive: true });
  fs.writeFileSync(
    rel("admin/index.html"),
    `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="robots" content="noindex">\n${owner.slice(0, at)}\n</head>\n<body>\n${owner.slice(at).trim()}\n${note}\n</body>\n</html>\n`
  );
  console.log(`Owner copy: ${siteStyles.filter((st) => st.count).map((st) => `${st.label} ${st.count}`).join(", ")} in ${categories.length} categories → admin/index.html (${(owner.length / 1048576).toFixed(1)} MB). Keep it private: it holds the Pro vectors.`);
  process.exit(0);
}
fs.writeFileSync(
  rel("docs/index.html"),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${fragment.slice(0, split)}\n</head>\n<body>\n${fragment.slice(split).trim()}\n</body>\n</html>\n`
);
if (ARGS[0]) fs.writeFileSync(ARGS[0], fragment);

// ---------- Figma plugin UI (kept outside this repo) ----------
// The plugin lives in ../meya-icons-pro/figma-plugin, so this step is skipped when it is not there.
const pluginDir = rel("../meya-icons-pro/figma-plugin");
const pluginTpl = path.join(pluginDir, "ui-template.html");
let builtPlugin = false;
if (fs.existsSync(pluginTpl)) {
  const figmaUi = fs
    .readFileSync(pluginTpl, "utf8")
    .replace("/*__DATA__*/", `window.MEYA=${JSON.stringify({ categories, styles, icons: siteIcons })};`)
  .replace("/*__SEARCH__*/", SEARCH);
  const at = figmaUi.indexOf("</style>") + 8;
  fs.writeFileSync(
    path.join(pluginDir, "ui.html"),
    `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n${figmaUi.slice(0, at)}\n</head>\n<body>\n${figmaUi.slice(at).trim()}\n</body>\n</html>\n`
  );
  builtPlugin = true;
}

// ---------- Pixel Lab (docs/pixel.html) ----------
// Converts Outline icons to pixel-grid icons in the browser, widening or thinning their outlined lines to the weight asked for.
const pixelData = icons.filter((i) => i.v.outline && !COLOR_SETS.includes(i.c)).map((i) => ({ key: `${i.c}/${i.n}`, n: i.n, b: i.v.outline }));
const pixel = fs
  .readFileSync(rel("site/pixel.html"), "utf8")
  .replace("__BANNER__", BANNER)
  .replace("/*__DATA__*/", `window.MEYA=${JSON.stringify({ icons: pixelData })};`)
  .replaceAll("__COUNT__", String(pixelData.length))
  .replaceAll("__FAVICON__", `data:image/png;base64,${fs.readFileSync(rel("assets/favicon.png")).toString("base64")}`);
const pSplit = pixel.indexOf("</style>") + 8;
fs.writeFileSync(
  rel("docs/pixel.html"),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${pixel.slice(0, pSplit).replaceAll("__SITE__", "./")}\n</head>\n<body>\n${pixel.slice(pSplit).trim().replaceAll("__SITE__", "./")}\n</body>\n</html>\n`
);
if (ARGS[1]) fs.writeFileSync(ARGS[1], pixel.replaceAll("__SITE__", SITE + "/"));

if (PUBLISH_SPONSOR_PAGE) {
  // ---------- Sponsor page (docs/sponsor.html) ----------
  const sponsor = fs
    .readFileSync(rel("site/sponsor.html"), "utf8")
    .replace("__BANNER__", BANNER)
    .replace("__FOOTER__", FOOTER)
    .replace("/*__DATA__*/", `window.MEYA=${JSON.stringify({ icons: siteIcons.filter((i) => i.c === "shapes") })};`)
    .replaceAll("__VERSION__", VERSION)
    .replaceAll("__COUNT__", total.toLocaleString("en-US"))
    .replaceAll("__REPO__", REPO)
    .replaceAll("__FAVICON__", `data:image/png;base64,${fs.readFileSync(rel("assets/favicon.png")).toString("base64")}`)
    .replaceAll("__WEB3FORMS_KEY__", WEB3FORMS_KEY)
  .replace("__CLICK_SOUND__", fs.readFileSync(rel("assets/click.wav")).toString("base64"));
  const sAt = sponsor.indexOf("</style>") + 8;
  fs.writeFileSync(
    rel("docs/sponsor.html"),
    `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${sponsor.slice(0, sAt)}\n</head>\n<body>\n${sponsor.slice(sAt).trim()}\n</body>\n</html>\n`
  );
}

// ---------- Pricing page (docs/pricing.html) ----------
{
  const outlineIcon = (ref) => {
    const f = rel("icons/outline", ref + ".svg");
    const inner = fs.readFileSync(f, "utf8").replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").trim().replace(/\s*stroke-width="1\.3"/g, "");
    return `<svg class="ic ui" viewBox="0 0 24 24" fill="none" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  };
  const check = outlineIcon("shapes/check");
  const listOf = (names) => names.join(", ").replace(/, ([^,]*)$/, " and $1");
  const proNames = listOf(PRO_STYLES.map((id) => STYLES.find((st) => st.id === id).label));
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  const styleCount = lineStyles.length + PRO_STYLES.length;
  // one comparison row per Pro style: shipped ones with a sample and a count, the rest coming soon
  const proRows = STYLES.filter((st) => st.pro).map((st) => PRO_STYLES.includes(st.id)
    ? `<div class="cmp-row" role="row"><div role="cell"><span class="sample">__SAMPLE:${st.id}__</span>${st.label}<small>__PRO_N:${st.id}__ icons</small></div><div role="cell">__NO__</div><div role="cell" class="cmp-pro">__YES__</div></div>`
    : `<div class="cmp-row" role="row"><div role="cell"><span class="sample"></span>${st.label}<small>Coming soon</small></div><div role="cell">__NO__</div><div role="cell" class="cmp-pro"><span class="txt">Coming soon</span></div></div>`).join("\n          ");
  const page = fs
    .readFileSync(rel("site/pricing.html"), "utf8")
    .replace("__BANNER__", BANNER)
    .replace("__ACCOUNT_BUTTON__", ACCOUNT_BUTTON)
    .replace("__ACCOUNT__", ACCOUNT)
    .replace("__PRO_ROWS__", proRows)
    .replaceAll("__PRO_NAMES__", proNames)
    .replaceAll("__STYLE_WORD_CAP__", (w => w[0].toUpperCase() + w.slice(1))(WORDS[styleCount] || String(styleCount)))
    .replaceAll("__STYLE_WORD__", WORDS[styleCount] || String(styleCount))
    .replaceAll("__PRO_STYLE_WORD__", WORDS[PRO_STYLES.length] || String(PRO_STYLES.length))
    .replace("__FOOTER__", FOOTER)
    .replace(/__ICON:([a-z-]+\/[a-z-]+)__/g, (m, ref) => outlineIcon(ref))
    .replaceAll("__YES__", `<span class="yes" aria-label="Included">${check}</span>`)
    .replaceAll("__NO__", '<span class="no" aria-label="Not included"></span>')
    .replace(/__SAMPLE:([a-z-]+\/[a-z-]+)__/g, (m, ref) =>
      `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${fs.readFileSync(rel("icons", "outline", ref + ".svg"), "utf8").replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").trim()}</svg>`)
    .replace(/__N:([a-z-]+)__/g, (m, cat) => String(icons.filter((i) => i.c === cat).length))
    .replace(/__STYLE_N:([a-z]+)__/g, (m, st) => String(styles.find((x) => x.id === st).count))
    .replace(/__PRO_N:([a-z-]+)__/g, (m, st) => String(proCounts[st] || siteStyles.find((x) => x.id === st).count))
    .replace(/__SAMPLE:([a-z-]+)__/g, (m, st) => {
      // free styles from icons/, Pro styles from scripts/pro-samples.json
      const f = rel("icons", st, "general/home.svg");
      const inner = ["outline", "duotone"].includes(st)
        ? fs.existsSync(f) && fs.readFileSync(f, "utf8").replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").trim()
        : SAMPLES[`${st}/general/home`];
      if (!inner) return "";
      return `<svg viewBox="0 0 24 24" fill="none"${st === "pixel" ? ' shape-rendering="crispEdges"' : ""} aria-hidden="true">${inner}</svg>`;
    })
    .replaceAll('data-polar href="#" data-tip="Coming soon" class="pill soon"', CHECKOUT_URL ? `href="${CHECKOUT_URL}" target="_blank" rel="noopener" class="pill"` : 'href="#" data-tip="Coming soon" class="pill soon"')
    .replaceAll("__VERSION__", VERSION)
    .replaceAll("__COUNT__", total.toLocaleString("en-US"))
    .replaceAll("__PRO_COUNT__", proCount.toLocaleString("en-US"))
    .replaceAll("__ALL_COUNT__", (total + proCount).toLocaleString("en-US"))
    .replace("__PRO_PREVIEW__", proPreview)
    .replaceAll("__FAVICON__", `data:image/png;base64,${fs.readFileSync(rel("assets/favicon.png")).toString("base64")}`)
    .replace("__CLICK_SOUND__", fs.readFileSync(rel("assets/click.wav")).toString("base64"));
  const at = page.indexOf("</style>") + 8;
  fs.writeFileSync(rel("docs/pricing.html"), `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${page.slice(0, at)}\n</head>\n<body>\n${page.slice(at).trim()}\n</body>\n</html>\n`);
}

// ---------- README images ----------
// Official app-icon mark (vector trace of Logos/Main Logo.png), drawn inline so GitHub renders it.
const LOGO = fs.readFileSync(rel("assets/logo.svg"), "utf8").replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").trim();
const themes = {
  light: { bg: "#FFFFFF", card: "#F5F5F5", ink: "#121212", muted: "#737373", line: "#E8E8E8" },
  dark: { bg: "#0D0D0D", card: "#171717", ink: "#F5F5F5", muted: "#A3A3A3", line: "#262626" },
};
const FONT = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

for (const [mode, t] of Object.entries(themes)) {
  // Banner
  fs.writeFileSync(
    rel(`assets/banner-${mode}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="360" viewBox="0 0 1280 360" fill="none">
  <rect width="1280" height="360" rx="28" fill="${t.card}"/>
  <svg x="96" y="100" width="160" height="160" viewBox="0 0 480 480">${LOGO}</svg>
  <text x="304" y="178" font-family="${FONT}" font-size="72" font-weight="600" letter-spacing="-2.5" fill="${t.ink}">Meya Icons</text>
  <rect x="696" y="126" width="72" height="44" rx="10" fill="${t.bg}" stroke="${t.line}"/>
  <text x="732" y="156" text-anchor="middle" font-family="${FONT}" font-size="22" font-weight="500" fill="${t.muted}">${VERSION}</text>
  <text x="306" y="232" font-family="${FONT}" font-size="28" fill="${t.muted}">${total.toLocaleString("en-US")} open-source icons in ${lineStyles.map((st) => st.label).join(", ").replace(/, ([^,]*)$/, " and $1")} by Meya Lab</text>
</svg>
`
  );

  // Preview grids: a sample across every category, one image per style.
  for (const { id: style } of lineStyles) {
    const cols = 16, rows = 5, cell = 72, pad = 40;
    const pool = icons.filter((i) => i.v[style]);
    const perCat = Math.ceil((cols * rows) / categories.length);
    const sample = categories.flatMap((c) => pool.filter((i) => i.c === c.id).slice(0, perCat)).slice(0, cols * rows);
    const w = cols * cell + pad * 2, h = rows * cell + pad * 2;
    const cells = sample
      .map((ic, k) => {
        const x = pad + (k % cols) * cell + (cell - 32) / 2;
        const y = pad + Math.floor(k / cols) * cell + (cell - 32) / 2;
        return `<svg x="${x}" y="${y}" width="32" height="32" viewBox="0 0 24 24" fill="none">${ic.v[style]}</svg>`;
      })
      .join("\n  ");
    fs.writeFileSync(
      rel(`assets/preview-${style}-${mode}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" color="${t.ink}">\n  <rect width="${w}" height="${h}" rx="28" fill="${t.card}"/>\n  ${cells}\n</svg>\n`
    );
  }
}

// ---------- README counts ----------
const readmePath = rel("README.md");
if (fs.existsSync(readmePath)) {
  let md = fs.readFileSync(readmePath, "utf8");
  md = md.replace(/(<!--count-->)[\s\S]*?(<!--\/count-->)/g, `$1${total}$2`);
  md = md.replace(/icons-\d+-/g, `icons-${total}-`);
  const table = [
    `| Category | ${lineStyles.map((st) => st.label).join(" | ")} |`,
    `| --- | ${lineStyles.map(() => "---:").join(" | ")} |`,
    ...categories.filter((c) => !COLOR_SETS.includes(c.id)).map((c) => `| ${c.label} | ${lineStyles.map((st) => `[${c.counts[st.id]}](icons/${st.id}/${c.id})`).join(" | ")} |`),
  ].join("\n");
  const styleRows = [
    "| Style | Icons | Look |",
    "| --- | ---: | --- |",
    ...siteStyles.map((st) => `| ${st.locked ? `[${st.label}](${SITE}/#${st.id})` : st.count ? `[${st.label}](./icons/${st.set ? "outline/" : ""}${st.id})` : st.label}${st.pro ? " `PRO`" : ""} | ${st.count || "Coming soon"} | ${st.look} |`),
  ].join("\n");
  md = md.replace(/(<!--styles-->)[\s\S]*?(<!--\/styles-->)/, `$1\n${styleRows}\n$2`);
  const previews = lineStyles
    .map((st) => `<picture>\n  <source media="(prefers-color-scheme: dark)" srcset="./assets/preview-${st.id}-dark.svg">\n  <img alt="A sample of Meya Icons in the ${st.label} style" src="./assets/preview-${st.id}-light.svg" width="100%">\n</picture>`)
    .join("\n\n");
  md = md.replace(/(<!--previews-->)[\s\S]*?(<!--\/previews-->)/, `$1\n${previews}\n$2`);
  md = md.replace(/(<!--stylenames-->)[\s\S]*?(<!--\/stylenames-->)/g, `$1${lineStyles.map((st) => `**${st.label}**`).join(", ").replace(/, ([^,]*)$/, " and $1")}$2`);
  md = md.replace(/(<!--categories-->)[\s\S]*?(<!--\/categories-->)/, `$1\n${table}\n$2`);
  fs.writeFileSync(readmePath, md);
}

// ---------- Link previews (Open Graph + X), one shared image, each page's own title and description ----------
fs.copyFileSync(rel("assets/og.jpg"), rel("docs/og.jpg"));
const PAGE_PATH = { "index.html": "/", "pricing.html": "/pricing", "sponsor.html": "/sponsor", "pixel.html": "/pixel" };
for (const [file, urlPath] of Object.entries(PAGE_PATH)) {
  const p = rel("docs/" + file);
  if (!fs.existsSync(p)) continue;
  let html = fs.readFileSync(p, "utf8").replace(/\n<!--og-->[\s\S]*?<!--\/og-->/, "");
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "Meya Icons";
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
  const tags = [
    `<meta property="og:type" content="website">`, `<meta property="og:site_name" content="Meya Icons">`,
    `<meta property="og:title" content="${title}">`, `<meta property="og:description" content="${desc}">`,
    `<meta property="og:url" content="${SITE}${urlPath}">`, `<meta property="og:image" content="${SITE}/og.jpg">`,
    `<meta property="og:image:width" content="1200">`, `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="Meya Icons: ${total.toLocaleString("en-US")} free icons in Outline and Duotone, plus cursors and flags">`,
    `<meta name="twitter:card" content="summary_large_image">`, `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${desc}">`, `<meta name="twitter:image" content="${SITE}/og.jpg">`,
    `<link rel="canonical" href="${SITE}${urlPath}">`,
  ].join("\n");
  html = html.replace(/(<meta name="description"[^>]*>)/, `$1\n<!--og-->\n${tags}\n<!--/og-->`);
  fs.writeFileSync(p, html);
}

console.log(`Built ${total} icons${builtPlugin ? " + Figma plugin UI" : ""} (${siteStyles.map((st) => `${st.label} ${st.count}${st.locked ? " previews" : ""}`).join(", ")}) in ${categories.length} categories → docs/index.html (${(fragment.length / 1024).toFixed(0)} KB), README assets updated.`);
