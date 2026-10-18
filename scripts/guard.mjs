// Keeps Meya Icons Pro out of this public repository. Fails (exit 1) when a tracked or staged file would leak it:
//   - an SVG outside icons/outline, icons/duotone and assets/ (Pro styles live in ../meya-icons-pro, never here)
//   - a folder in icons/ other than outline/ and duotone/ (sharp/, filled/, glass/, pixel/, stroke/ ...)
//   - live strokes in icons/outline or icons/duotone (the free sets ship outlined; live strokes are Pro Stroke)
//   - anything in docs/pro/ that is not a WebP preview, a preview larger than the site shows, or a preview of a
//     hidden category (HIDDEN in categories.mjs: not released yet)
//   - the owner build (admin/), the Pro folder, the Figma plugin, tools or zips
//   - when ../meya-icons-pro is on this computer: any Pro drawing copied into a tracked file, except the few
//     samples the pricing page shows (PRO_SAMPLES in pro.mjs)
// Usage: node scripts/guard.mjs            checks every tracked file (CI runs this)
//        node scripts/guard.mjs --staged   checks what is about to be committed (the pre-commit hook runs this)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COLOR_SETS, HIDDEN } from "./categories.mjs";
import { PRO_DIR, PRO_SAMPLES, sampleSlots } from "./pro.mjs";
import { STYLES } from "./styles.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGED = process.argv.includes("--staged");
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
// tracked files deleted on disk but not yet staged are leaving, so they are not checked
const files = (STAGED ? git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z") : git("ls-files", "-z")).split("\0").filter(Boolean)
  .filter((f) => STAGED || fs.existsSync(path.join(root, f)));
const read = (f) => (STAGED ? execFileSync("git", ["show", `:${f}`], { cwd: root, maxBuffer: 1 << 28 }) : fs.readFileSync(path.join(root, f)));

// The largest previews pro-previews.mjs writes: one tile in the sprite, and the detail image.
const CELL = 96, COLS = 16, BIG = 320;
const FORBIDDEN = [/^admin\//, /(^|\/)meya-icons-pro\//, /^figma-plugin\//, /^tools\//, /\.zip$/i];
const OWNER_MARK = "every style unlocked · keep private";

const problems = [];
const bad = (f, why) => problems.push(`${f}: ${why}`);

function webpSize(b) {
  if (b.toString("latin1", 0, 4) !== "RIFF" || b.toString("latin1", 8, 12) !== "WEBP") return null;
  const kind = b.toString("latin1", 12, 16);
  if (kind === "VP8X") return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
  if (kind === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (kind === "VP8L") { const n = b.readUInt32LE(21); return [(n & 0x3fff) + 1, ((n >> 14) & 0x3fff) + 1]; }
  return null;
}

for (const f of files) {
  if (FORBIDDEN.some((re) => re.test(f))) { bad(f, "private Pro material, keep it out of this repo"); continue; }
  const m = f.match(/^icons\/([^/]+)\/([^/]+)\//);
  if (f.startsWith("icons/") && (!m || !["outline", "duotone"].includes(m[1]))) { bad(f, "only icons/outline and icons/duotone are free; Pro styles stay in ../meya-icons-pro"); continue; }
  if (f.endsWith(".svg") && !m && !f.startsWith("assets/")) { bad(f, "SVG outside icons/ and assets/"); continue; }
  if (m && f.endsWith(".svg") && !COLOR_SETS.includes(m[2]) && /stroke-width|stroke="currentColor"/.test(read(f).toString("utf8"))) {
    bad(f, "live strokes: the free sets ship outlined (scripts/outline.mjs), live strokes are the Pro Stroke style");
    continue;
  }
  if (f.startsWith("docs/pro/")) {
    if (!f.endsWith(".webp")) { bad(f, "docs/pro holds WebP previews only"); continue; }
    if (HIDDEN.includes(f.split("/")[3])) { bad(f, "preview of a hidden category: it is not released, keep its Pro work private"); continue; }
    const size = webpSize(read(f));
    if (!size) { bad(f, "not a readable WebP"); continue; }
    const sprite = /^docs\/pro\/[^/]+\.webp$/.test(f);
    const [w] = size, max = sprite ? CELL * COLS : BIG;
    if (w > max) bad(f, `preview is ${w}px wide, more than ${max}px: large previews can be traced back into vectors`);
    continue;
  }
  if (f === "scripts/pro-samples.json") {
    const allowed = new Set(sampleSlots(STYLES.filter((s) => s.pro && s.showcase).map((s) => s.id)).map(([s, k]) => `${s}/${k}`));
    const extra = Object.keys(JSON.parse(read(f).toString("utf8"))).filter((k) => !allowed.has(k));
    if (extra.length) bad(f, `holds Pro drawings that are not pricing samples: ${extra.slice(0, 5).join(", ")}`);
  }
  if (f === "scripts/pro-previews.json") {
    const listed = Object.entries(JSON.parse(read(f).toString("utf8"))).flatMap(([st, m]) => m.icons.map(([k]) => `${st}/${k}`));
    const hidden = listed.filter((k) => HIDDEN.includes(k.split("/")[1]));
    if (hidden.length) bad(f, `lists ${hidden.length} previews of hidden categories (${hidden.slice(0, 3).join(", ")} ...)`);
  }
  if (/\.(html|js|mjs|json|md|txt)$/.test(f) && f !== "scripts/build.mjs" && f !== "scripts/guard.mjs" && read(f).toString("utf8").includes(OWNER_MARK)) bad(f, "this is the owner build with the Pro vectors (build.mjs --admin), never commit it");
}

// With the Pro folder at hand, look for its drawings in the text files about to go public.
if (fs.existsSync(PRO_DIR)) {
  const free = new Set();
  for (const f of files) if (/^icons\/.*\.svg$/.test(f)) for (const [, d] of read(f).toString("utf8").matchAll(/\sd="([^"]{60,})"/g)) free.add(d);
  const isSample = (k) => PRO_SAMPLES.includes(k.split(path.sep).slice(1).join("/").replace(/\.svg$/, ""));
  const pro = new Map(), sample = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== "tools") walk(p); }
      else if (e.name.endsWith(".svg")) {
        const k = path.relative(PRO_DIR, p);
        for (const [, d] of fs.readFileSync(p, "utf8").matchAll(/\sd="([^"]{60,})"/g)) if (isSample(k)) sample.add(d); else if (!free.has(d)) pro.set(d, k);
      }
    }
  };
  walk(PRO_DIR);
  for (const f of files) {
    if (!/\.(svg|html|js|mjs|json|md|txt)$/.test(f)) continue;
    const text = read(f).toString("utf8");
    for (const [, d] of text.matchAll(/(?:\sd=|["'])"?([Mm][^"'<>]{59,})/g)) {
      const v = d.replace(/["\\]+$/, ""), hit = !sample.has(v) && pro.get(v);
      if (hit) { bad(f, `holds the drawing of Pro ${hit}`); break; }
    }
  }
}

if (problems.length) {
  console.error(`Pro guard: ${problems.length} problem${problems.length === 1 ? "" : "s"}, nothing of Meya Icons Pro may be published here:\n` + problems.slice(0, 50).map((p) => "  " + p).join("\n") + (problems.length > 50 ? `\n  ... and ${problems.length - 50} more` : ""));
  process.exit(1);
}
console.log(`Pro guard: ${files.length} ${STAGED ? "staged" : "tracked"} files checked, no Pro material${fs.existsSync(PRO_DIR) ? " (compared with ../meya-icons-pro)" : ""}.`);
