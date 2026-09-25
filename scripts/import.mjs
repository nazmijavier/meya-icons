// Imports raw Figma exports into icons/<category>/<name>.svg.
// Usage: node scripts/import.mjs <folder-with-exports>
// Accepts "Icon=weather-sun.svg" or "weather-sun.svg". The name must start with a category id.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES } from "./categories.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = process.argv[2];
if (!from) {
  console.error("Usage: node scripts/import.mjs <folder-with-exports>");
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
  const dest = path.join(root, "icons", cat, `${name}.svg`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    if (fs.readFileSync(dest, "utf8") === svg) continue;
    updated++;
  } else added++;
  fs.writeFileSync(dest, svg);
}

console.log(`Imported: ${added} new, ${updated} updated.`);
if (skipped.length) console.log(`Skipped ${skipped.length} files with no category prefix (e.g. ${skipped.slice(0, 3).join(", ")}).`);

function normalize(raw) {
  const body = raw
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/"(white|#fff|#ffffff|black|#000|#000000)"/gi, '"currentColor"')
    .trim()
    .split(/\n/)
    .map((l) => "  " + l.trim())
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">\n${body}\n</svg>\n`;
}
