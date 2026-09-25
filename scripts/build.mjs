// Builds the website (docs/index.html), README preview images and README counts from icons/.
// Usage: node scripts/build.mjs [artifact-fragment-output-path]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES } from "./categories.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = (...p) => path.join(root, ...p);
const VERSION = JSON.parse(fs.readFileSync(rel("package.json"), "utf8")).version.replace(/\.0$/, "");
const REPO = "https://github.com/nazmijavier/meya-icons";

// ---------- Read icons ----------
const icons = [];
for (const [cat] of CATEGORIES) {
  const dir = rel("icons", cat);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".svg")).sort()) {
    const name = file.slice(0, -4);
    const inner = fs
      .readFileSync(path.join(dir, file), "utf8")
      .replace(/^[\s\S]*?<svg[^>]*>/, "")
      .replace(/<\/svg>\s*$/, "")
      .replace(/\n\s*/g, "")
      .trim()
      .replace(/id="([^"]+)"/g, `id="${cat}-${name}-$1"`)
      .replace(/url\(#([^)]+)\)/g, `url(#${cat}-${name}-$1)`);
    icons.push({ n: name, c: cat, b: inner });
  }
}
const categories = CATEGORIES.map(([id, label]) => ({ id, label, count: icons.filter((i) => i.c === id).length })).filter((c) => c.count);

// ---------- Website ----------
// On the site, default 1.3 strokes inherit from the root so the stroke slider can drive them.
const siteIcons = icons.map((i) => ({ ...i, b: i.b.replace(/\s*stroke-width="1\.3"/g, "") }));
const wordmark = fs
  .readFileSync(rel("assets/wordmark-white.svg"), "utf8")
  .replace(/fill="white"/g, 'fill="currentColor"')
  .replace(/<svg /, '<svg class="wordmark" aria-label="Meya Lab Studio" role="img" ');

const fragment = fs
  .readFileSync(rel("site/template.html"), "utf8")
  .replace("/*__DATA__*/", `window.MEYA=${JSON.stringify({ categories, icons: siteIcons })};`)
  .replace("<!--__WORDMARK__-->", wordmark)
  .replaceAll("__COUNT__", String(icons.length))
  .replaceAll("__CATS__", String(categories.length))
  .replaceAll("__VERSION__", VERSION)
  .replaceAll("__REPO__", REPO)
  .replace("__CHROME__", `data:image/jpeg;base64,${fs.readFileSync(rel("assets/logo-chrome.jpg")).toString("base64")}`);

const split = fragment.indexOf("</style>") + 8;
fs.writeFileSync(
  rel("docs/index.html"),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${fragment.slice(0, split)}\n</head>\n<body>\n${fragment.slice(split).trim()}\n</body>\n</html>\n`
);
if (process.argv[2]) fs.writeFileSync(process.argv[2], fragment);

// ---------- README images ----------
const BOLT = "M77 349 218 130 243 197 359 98 357 258 334 202 211 326 221 251Z";
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
  <rect x="96" y="100" width="160" height="160" rx="40" fill="#1BA4FF"/>
  <svg x="116" y="120" width="120" height="120" viewBox="68 74 300 300"><path d="${BOLT}" fill="#032439" stroke="#032439" stroke-width="12" stroke-linejoin="round"/></svg>
  <text x="304" y="178" font-family="${FONT}" font-size="72" font-weight="600" letter-spacing="-2.5" fill="${t.ink}">Meya Icons</text>
  <rect x="696" y="126" width="72" height="44" rx="10" fill="${t.bg}" stroke="${t.line}"/>
  <text x="732" y="156" text-anchor="middle" font-family="${FONT}" font-size="22" font-weight="500" fill="${t.muted}">${VERSION}</text>
  <text x="306" y="232" font-family="${FONT}" font-size="28" fill="${t.muted}">${icons.length} open-source stroke icons by Meya Lab</text>
</svg>
`
  );

  // Preview grid: a sample across every category.
  const cols = 16, rows = 5, cell = 72, pad = 40;
  const perCat = Math.ceil((cols * rows) / categories.length);
  const sample = categories.flatMap((c) => icons.filter((i) => i.c === c.id).slice(0, perCat)).slice(0, cols * rows);
  const w = cols * cell + pad * 2, h = rows * cell + pad * 2;
  const cells = sample
    .map((ic, k) => {
      const x = pad + (k % cols) * cell + (cell - 32) / 2;
      const y = pad + Math.floor(k / cols) * cell + (cell - 32) / 2;
      return `<svg x="${x}" y="${y}" width="32" height="32" viewBox="0 0 24 24" fill="none">${ic.b}</svg>`;
    })
    .join("\n  ");
  fs.writeFileSync(
    rel(`assets/preview-${mode}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" color="${t.ink}">\n  <rect width="${w}" height="${h}" rx="28" fill="${t.card}"/>\n  ${cells}\n</svg>\n`
  );
}

// ---------- README counts ----------
const readmePath = rel("README.md");
if (fs.existsSync(readmePath)) {
  let md = fs.readFileSync(readmePath, "utf8");
  md = md.replace(/(<!--count-->)[\s\S]*?(<!--\/count-->)/g, `$1${icons.length}$2`);
  md = md.replace(/icons-\d+-/g, `icons-${icons.length}-`);
  const table = ["| Category | Folder | Icons |", "| --- | --- | ---: |", ...categories.map((c) => `| ${c.label} | [\`icons/${c.id}\`](icons/${c.id}) | ${c.count} |`)].join("\n");
  md = md.replace(/(<!--categories-->)[\s\S]*?(<!--\/categories-->)/, `$1\n${table}\n$2`);
  fs.writeFileSync(readmePath, md);
}

console.log(`Built ${icons.length} icons in ${categories.length} categories → docs/index.html (${(fragment.length / 1024).toFixed(0)} KB), README assets updated.`);
