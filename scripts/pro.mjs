// The PRO icon sets live outside this repo, in ../meya-icons-pro/<style>/<category>/<name>.svg.
// Shared by build.mjs and pro-previews.mjs.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES, COLOR_SETS, HIDDEN } from "./categories.mjs";

// The only Pro drawings published as vectors: the pricing page shows these in the Pro styles as samples
// (home in every style, the rest in the teaser). scripts/guard.mjs lets these through and nothing else.
export const PRO_SAMPLES = ["general/home", "general/heart", "communication/chat", "files/folder", "general/settings", "general/star"];

export const PRO_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../meya-icons-pro");

// A PRO style's icons in the order the site lists them, each with a short content hash.
export function proIcons(style) {
  const out = [];
  for (const [cat] of CATEGORIES) {
    if (COLOR_SETS.includes(cat)) continue;
    const dir = path.join(PRO_DIR, style, cat);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".svg")).sort()) {
      const svg = fs.readFileSync(path.join(dir, f), "utf8");
      out.push({ k: `${cat}/${f.slice(0, -4)}`, svg, h: crypto.createHash("sha1").update(svg).digest("hex").slice(0, 12) });
    }
  }
  return out;
}

// The icons the site previews: every Pro icon outside the hidden categories. Hidden categories (HIDDEN in
// categories.mjs) get no published previews until they are released, so their Pro work stays private.
export function previewIcons(style) {
  return proIcons(style).filter((i) => !HIDDEN.includes(i.k.split("/")[0]));
}
