// Imports the full-color sets that sit beside the line icons: cursors and country flags.
// They keep their own colors, so they live in icons/outline/<cat>/ and the site shows them in every style.
// Usage: node scripts/import-extras.mjs ../meya-studio-icons
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = path.resolve(process.argv[2] || "../meya-studio-icons");
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, "and").replace(/['’.()]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const inner = (s) => s.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
// Filled shapes get stroke="none" so a stroke set on the root <svg> (copied SVG, Figma plugin) never touches them.
const noStroke = (s) => s.replace(/<(path|circle|ellipse|rect|polygon|polyline)\b([^>]*?)(\/?)>/g, (m, tag, a, sl) =>
  /\sstroke=/.test(a) || !/\sfill="(?!none")[^"]*"/.test(a) ? m : `<${tag}${a} stroke="none"${sl}>`);
const tidy = (s) => s.split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => "  " + l).join("\n");
const file = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">\n${tidy(body)}\n</svg>\n`;

function write(cat, items) {
  const dir = path.join(root, "icons", "outline", cat);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, svg] of items) fs.writeFileSync(path.join(dir, `${name}.svg`), svg);
  console.log(`Imported ${cat}: ${items.length}`);
}

// ---------- Cursors ----------
// Black takes the icon color; white outlines and colored details stay. Drop shadows are removed.
const CURSOR_NAMES = {
  "Figma Cursor": "figma-cursor", "Figma Hand": "figma-hand", "Grabbed": "grabbing", "ZoomIn": "zoom-in", "ZoomOut": "zoom-out",
  "Norht South": "resize-north-south", "LeftRIght": "resize-left-right", "RIght": "resize-right", "UpDown": "resize-up-down",
  "Make alias": "alias",
};
const SKIP = new Set(["Typing (GIF)"]); // an embedded bitmap, not a vector
const cursors = [];
(function walk(dir, group) {
  for (const f of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { walk(p, f === "Cursor" || f === "More" ? group : f); continue; }
    if (!f.endsWith(".svg")) continue;
    const base = f.slice(0, -4);
    if (SKIP.has(base)) continue;
    const name = CURSOR_NAMES[base] || (group ? `${slug(group)}-${slug(base)}` : slug(base));
    const raw = fs.readFileSync(p, "utf8");
    const [, vw, vh] = raw.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
    let body = inner(raw)
      .replace(/<filter[\s\S]*?<\/filter>/g, "")
      .replace(/\s(filter)="[^"]*"/g, "")
      .replace(/<defs>\s*<\/defs>/g, "")
      .replace(/"(black|#000|#000000|#231F20|#232020)"/gi, '"currentColor"');
    // A few cursors are drawn on a larger canvas (28 × 40 for the badge ones): scale them to fit the 24 frame.
    if (vw !== 24 || vh !== 24) {
      const k = 24 / Math.max(vw, vh);
      body = `<g transform="translate(${+((24 - vw * k) / 2).toFixed(3)} ${+((24 - vh * k) / 2).toFixed(3)}) scale(${+k.toFixed(4)})">${body}</g>`;
    }
    cursors.push([name, file(noStroke(body))]);
  }
})(path.join(from, "Cursor"), "");
const resizeName = (n) => n.replace(/^resize-resize-/, "resize-").replace(/^rotate-rotate-/, "rotate-");
write("cursors", cursors.map(([n, s]) => [resizeName(n), s]));

// ---------- Flags ----------
// Each 3:2 flag sits as 24×16 in the 24×24 frame, with softly rounded corners and a faint edge so white flags read.
const region = new Intl.DisplayNames(["en"], { type: "region" });
const FLAG_NAMES = {
  "GE-AB": "Abkhazia", "GE-OS": "South Ossetia", CD: "DR Congo", CG: "Congo", HK: "Hong Kong", MO: "Macau", MM: "Myanmar",
  PS: "Palestine", CI: "Ivory Coast", UM: "US Outlying Islands", VI: "US Virgin Islands", VG: "British Virgin Islands",
  FM: "Micronesia", KP: "North Korea", KR: "South Korea", BL: "Saint Barthelemy", MF: "Saint Martin", SH: "Saint Helena",
  KN: "Saint Kitts and Nevis", LC: "Saint Lucia", PM: "Saint Pierre and Miquelon", VC: "Saint Vincent", BQ: "Caribbean Netherlands",
  SJ: "Svalbard", TF: "French Southern Territories", HM: "Heard and McDonald Islands", IO: "British Indian Ocean Territory",
};
const flags = [];
const codes = {};
for (const f of fs.readdirSync(path.join(from, "Flags", "flag")).filter((f) => f.endsWith(".svg")).sort()) {
  const code = f.slice(0, -4);
  const raw = fs.readFileSync(path.join(from, "Flags", "flag", f), "utf8");
  const [, w, h] = raw.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const sx = 24 / w, sy = 16 / h, r = 1.6;
  const body = inner(raw)
    .replace(/<defs>[\s\S]*?<\/defs>/g, "")
    .replace(/<g clip-path="[^"]*">/g, "").replace(/<\/g>/g, "");
  const name = slug(FLAG_NAMES[code] || region.of(code));
  codes[name] = code;
  flags.push([name, file(`<g transform="matrix(${+sx.toFixed(6)} 0 0 ${+sy.toFixed(6)} 0 4)" clip-path="url(#round)" stroke="none">
${noStroke(body)}
</g>
<rect x="0.25" y="4.25" width="23.5" height="15.5" rx="${r - 0.25}" stroke="#000" stroke-opacity="0.1" stroke-width="0.5"/>
<defs><clipPath id="round"><rect width="${w}" height="${h}" rx="${+(r / sx).toFixed(2)}" ry="${+(r / sy).toFixed(2)}"/></clipPath></defs>`)]);
}
write("flags", flags);
fs.writeFileSync(path.join(root, "scripts", "flag-codes.json"), JSON.stringify(codes, null, 0) + "\n");
