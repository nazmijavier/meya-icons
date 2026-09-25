// Imports raw Figma exports into icons/<style>/<category>/<name>.svg.
// Usage: node scripts/import.mjs <folder-with-exports> [--style outline|duotone|sharp|filled]
// Accepts "Icon=weather-sun.svg" or "weather-sun.svg". The name must start with a category id.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES } from "./categories.mjs";
import { STYLES } from "./styles.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ids = STYLES.map((st) => st.id);
const args = process.argv.slice(2);
const styleAt = args.indexOf("--style");
const style = styleAt >= 0 ? args.splice(styleAt, 2)[1] : "outline";
const from = args[0];
if (!from || !ids.includes(style)) {
  console.error(`Usage: node scripts/import.mjs <folder-with-exports> [--style ${ids.join("|")}]`);
  process.exit(1);
}

const prefixes = CATEGORIES.map(([id]) => id).sort((a, b) => b.length - a.length);
let added = 0, updated = 0, skipped = [];

for (const file of fs.readdirSync(from).sort()) {
  if (!file.endsWith(".svg")) continue;
  const slug = file.replace(/^Icon=/, "").replace(/\.svg$/, "").toLowerCase().replace(/\s+/g, "-");
  const cat = prefixes.find((p) => slug.startsWith(p + "-"));
  if (!cat) { skipped.push(file); continue; }
  const name = slug.slice(cat.length + 1);

  const raw = fs.readFileSync(path.join(from, file), "utf8");
  const svg = normalize(raw);
  const dest = path.join(root, "icons", style, cat, `${name}.svg`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    if (fs.readFileSync(dest, "utf8") === svg) continue;
    updated++;
  } else added++;
  fs.writeFileSync(dest, svg);
}

console.log(`Imported ${style}: ${added} new, ${updated} updated.`);
if (skipped.length) console.log(`Skipped ${skipped.length} files with no category prefix (e.g. ${skipped.slice(0, 3).join(", ")}).`);

function normalize(raw) {
  // Recolor to currentColor, but leave <mask> contents alone: masks need real white and black.
  const body = raw
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .split(/(<mask[\s\S]*?<\/mask>)/)
    .map((part) => (part.startsWith("<mask") ? part : part.replace(/"(white|#fff|#ffffff|black|#000|#000000)"/gi, '"currentColor"')))
    .join("")
    .trim()
    .split(/\n/)
    .map((l) => "  " + l.trim())
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">\n${body}\n</svg>\n`;
}
