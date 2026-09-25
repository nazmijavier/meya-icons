// Builds the website (docs/index.html), README preview images and README counts from icons/<style>/.
// Usage: node scripts/build.mjs [artifact-fragment-output-path]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES } from "./categories.mjs";
import { STYLES } from "./styles.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = (...p) => path.join(root, ...p);
const VERSION = JSON.parse(fs.readFileSync(rel("package.json"), "utf8")).version.replace(/\.0$/, "");
const REPO = "https://github.com/nazmijavier/meya-icons";

// ---------- Read icons ----------
// Every style is read from icons/<style>/. An icon is the union of its variants by category and name.
function readStyle(style) {
  const out = new Map();
  for (const [cat] of CATEGORIES) {
    const dir = rel("icons", style, cat);
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
const categories = CATEGORIES.map(([id, label]) => ({
  id, label,
  count: icons.filter((i) => i.c === id).length,
  counts: Object.fromEntries(styles.map((st) => [st.id, icons.filter((i) => i.c === id && i.v[st.id]).length])),
})).filter((c) => c.count);

// ---------- Website ----------
// On the site, default 1.3 strokes inherit from the root so the stroke slider can drive them.
const strip = (b) => b.replace(/\s*stroke-width="1\.3"/g, "");
const siteIcons = icons.map((i) => ({ ...i, v: Object.fromEntries(Object.entries(i.v).map(([k, b]) => [k, strip(b)])) }));
const wordmark = fs
  .readFileSync(rel("assets/wordmark-white.svg"), "utf8")
  .replace(/fill="white"/g, 'fill="currentColor"')
  .replace(/<svg /, '<svg class="wordmark" aria-label="Meya Lab Studio" role="img" ');

const fragment = fs
  .readFileSync(rel("site/template.html"), "utf8")
  .replace("/*__DATA__*/", `window.MEYA=${JSON.stringify({ categories, styles, icons: siteIcons })};`)
  .replace("<!--__WORDMARK__-->", wordmark)
  .replaceAll("__COUNT__", total.toLocaleString("en-US"))
  .replaceAll("__STYLECOUNT__", String(ready.length))
  .replaceAll("__CATS__", String(categories.length))
  .replaceAll("__VERSION__", VERSION)
  .replaceAll("__REPO__", REPO)
  .replaceAll("__FAVICON__", `data:image/png;base64,${fs.readFileSync(rel("assets/favicon.png")).toString("base64")}`)
  .replace("__CHROME__", `data:image/jpeg;base64,${fs.readFileSync(rel("assets/logo-chrome.jpg")).toString("base64")}`);

const split = fragment.indexOf("</style>") + 8;
fs.writeFileSync(
  rel("docs/index.html"),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${fragment.slice(0, split)}\n</head>\n<body>\n${fragment.slice(split).trim()}\n</body>\n</html>\n`
);
if (process.argv[2]) fs.writeFileSync(process.argv[2], fragment);

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
  <text x="306" y="232" font-family="${FONT}" font-size="28" fill="${t.muted}">${total.toLocaleString("en-US")} open-source icons in ${ready.map((st) => st.label).join(", ").replace(/, ([^,]*)$/, " and $1")} by Meya Lab</text>
</svg>
`
  );

  // Preview grids: a sample across every category, one image per style.
  for (const { id: style } of ready) {
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
    `| Category | ${ready.map((st) => st.label).join(" | ")} |`,
    `| --- | ${ready.map(() => "---:").join(" | ")} |`,
    ...categories.map((c) => `| ${c.label} | ${ready.map((st) => `[${c.counts[st.id]}](icons/${st.id}/${c.id})`).join(" | ")} |`),
  ].join("\n");
  const styleRows = [
    "| Style | Icons | Look |",
    "| --- | ---: | --- |",
    ...styles.map((st) => `| ${st.count ? `[${st.label}](./icons/${st.id})` : st.label} | ${st.count || "Coming soon"} | ${st.look} |`),
  ].join("\n");
  md = md.replace(/(<!--styles-->)[\s\S]*?(<!--\/styles-->)/, `$1\n${styleRows}\n$2`);
  const previews = ready
    .map((st) => `<picture>\n  <source media="(prefers-color-scheme: dark)" srcset="./assets/preview-${st.id}-dark.svg">\n  <img alt="A sample of Meya Icons in the ${st.label} style" src="./assets/preview-${st.id}-light.svg" width="100%">\n</picture>`)
    .join("\n\n");
  md = md.replace(/(<!--previews-->)[\s\S]*?(<!--\/previews-->)/, `$1\n${previews}\n$2`);
  md = md.replace(/(<!--stylenames-->)[\s\S]*?(<!--\/stylenames-->)/g, `$1${ready.map((st) => `**${st.label}**`).join(", ").replace(/, ([^,]*)$/, " and $1")}$2`);
  md = md.replace(/(<!--categories-->)[\s\S]*?(<!--\/categories-->)/, `$1\n${table}\n$2`);
  fs.writeFileSync(readmePath, md);
}

console.log(`Built ${total} icons (${styles.map((st) => `${st.label} ${st.count}`).join(", ")}) in ${categories.length} categories → docs/index.html (${(fragment.length / 1024).toFixed(0)} KB), README assets updated.`);
