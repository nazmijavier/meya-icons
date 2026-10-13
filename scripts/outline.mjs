// Outlines stroke icons: every stroke becomes the shape it draws (its caps, joins and dashes included), so an icon
// looks the same but has no stroke left to adjust. Outline and Duotone are made this way from the live strokes,
// which are the Pro "Stroke" style and never ship in this repo. Paths are written short, within 0.004 of the
// exact outline (see fit-path.mjs).
//   Outline: the whole drawing as one path.
//   Duotone: each 30% part keeps its own path (so overlapping 30% parts still add up as drawn); neighbouring
//            full-strength parts are joined into one path.
// Usage: node scripts/outline.mjs <stroke folder> [--style outline|duotone] [--out <folder>] [name filter]
//   Reads <stroke folder>/<category>/<name>.svg and writes icons/<style>/<category>/<name>.svg, or into --out.
// Needs CanvasKit (Skia's stroker and path ops): npm i -D canvaskit-wasm
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { contoursOf, compactContours, writePath, deviation } from "./fit-path.mjs";

const require = createRequire(import.meta.url);
const CK = await require("canvaskit-wasm/bin/canvaskit.js")();

const PRECISION = 16; // the stroker's curve resolution: Skia's default is made for pixels and bulges round corners on a 24 grid
const DASH_SCALE = 64; // dashes are measured on the path scaled up this much, so dots sit where a browser puts them

// ---------- Reading ----------
function readSvg(text) {
  const open = text.match(/<svg\b[^>]*>/)[0];
  const body = text.slice(text.indexOf(open) + open.length, text.lastIndexOf("</svg>"));
  const items = [];
  for (const m of body.matchAll(/<(\/?)([a-zA-Z]+)\b([^>]*?)(\/?)>/g)) {
    const attrs = {};
    for (const a of m[3].matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
    items.push({ close: !!m[1], tag: m[2], attrs });
  }
  return items;
}
function matrixOf(tr) {
  if (!tr) return null;
  let m = tr.match(/matrix\(([^)]+)\)/);
  if (m) { const [a, b, c, d, e, f] = m[1].split(/[\s,]+/).map(Number); return [a, c, e, b, d, f, 0, 0, 1]; }
  m = tr.match(/rotate\(([^)]+)\)/);
  if (m) {
    const [ang, cx = 0, cy = 0] = m[1].split(/[\s,]+/).map(Number);
    const r = (ang * Math.PI) / 180, cs = Math.cos(r), sn = Math.sin(r);
    return [cs, -sn, cx - cs * cx + sn * cy, sn, cs, cy - sn * cx - cs * cy, 0, 0, 1];
  }
  throw new Error("Unsupported transform " + tr);
}
const K = 0.5522847498;
function geometryD(el) {
  const a = el.attrs;
  if (el.tag === "path") return a.d;
  if (el.tag === "rect") {
    const x = +(a.x || 0), y = +(a.y || 0), w = +a.width, h = +a.height, r = Math.min(+(a.rx || a.ry || 0), w / 2, h / 2);
    if (r <= 0) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
    return `M${x + r} ${y}H${x + w - r}C${x + w - r + K * r} ${y} ${x + w} ${y + r - K * r} ${x + w} ${y + r}V${y + h - r}C${x + w} ${y + h - r + K * r} ${x + w - r + K * r} ${y + h} ${x + w - r} ${y + h}H${x + r}C${x + r - K * r} ${y + h} ${x} ${y + h - r + K * r} ${x} ${y + h - r}V${y + r}C${x} ${y + r - K * r} ${x + r - K * r} ${y} ${x + r} ${y}Z`;
  }
  if (el.tag === "circle" || el.tag === "ellipse") {
    const cx = +a.cx, cy = +a.cy, rx = +(a.rx ?? a.r), ry = +(a.ry ?? a.r);
    return `M${cx + rx} ${cy}C${cx + rx} ${cy + K * ry} ${cx + K * rx} ${cy + ry} ${cx} ${cy + ry}C${cx - K * rx} ${cy + ry} ${cx - rx} ${cy + K * ry} ${cx - rx} ${cy}C${cx - rx} ${cy - K * ry} ${cx - K * rx} ${cy - ry} ${cx} ${cy - ry}C${cx + K * rx} ${cy - ry} ${cx + rx} ${cy - K * ry} ${cx + rx} ${cy}Z`;
  }
  return null;
}
function shapeOf(el) {
  const d = geometryD(el);
  if (!d) return null;
  const p = CK.Path.MakeFromSVGString(d);
  if (!p) throw new Error("Bad path " + d.slice(0, 40));
  const M = matrixOf(el.attrs.transform);
  if (M) p.transform(M);
  return p;
}

// ---------- Path ops ----------
// Operands are simplified first, and each result is checked on a grid of points; when the check fails the
// operation is tried again with one operand moved by under a thousandth of a pixel (PathOps can trip on edges
// that lie exactly on each other, which is common on a 24 grid).
const prep = (p) => { const q = p.copy(); q.simplify(); return q; };
const STEP = 0.37, X0 = 0.11, Y0 = 0.17;
function op(a, b, kind) {
  const want = kind === CK.PathOp.Union ? (x, y) => x || y : kind === CK.PathOp.Difference ? (x, y) => x && !y : (x, y) => x && y;
  const pa = prep(a), pb = prep(b);
  const ba = pa.computeTightBounds(), bb = pb.computeTightBounds();
  const x0 = Math.min(ba[0], bb[0]) - 0.1, y0 = Math.min(ba[1], bb[1]) - 0.1, x1 = Math.max(ba[2], bb[2]) + 0.1, y1 = Math.max(ba[3], bb[3]) + 0.1;
  const ok = (r) => {
    if (!r) return false;
    let bad = 0;
    for (let y = Y0 + Math.max(0, Math.ceil((y0 - Y0) / STEP)) * STEP; y <= y1; y += STEP)
      for (let x = X0 + Math.max(0, Math.ceil((x0 - X0) / STEP)) * STEP; x <= x1; x += STEP)
        if (r.contains(x, y) !== want(pa.contains(x, y), pb.contains(x, y)) && ++bad > 3) return false;
    return true;
  };
  const r = CK.Path.MakeFromOp(pa, pb, kind);
  if (ok(r)) return r;
  for (const [dx, dy] of [[0.0007, 0.0003], [-0.0004, 0.0009], [0.0008, -0.0006], [-0.0009, -0.0005]]) {
    const nb = pb.copy();
    nb.transform([1, 0, dx, 0, 1, dy, 0, 0, 1]);
    const t = CK.Path.MakeFromOp(pa, nb, kind);
    if (ok(t)) return t;
  }
  return r;
}
const union = (a, b) => (!b ? a : a ? op(a, b, CK.PathOp.Union) : b.copy());
const minus = (a, b) => (b ? op(a, b, CK.PathOp.Difference) : a);
const meet = (a, b) => op(a, b, CK.PathOp.Intersect);

// ---------- Strokes ----------
const capOf = (v) => (v === "round" ? CK.StrokeCap.Round : v === "square" ? CK.StrokeCap.Square : CK.StrokeCap.Butt);
const joinOf = (v) => (v === "round" ? CK.StrokeJoin.Round : v === "bevel" ? CK.StrokeJoin.Bevel : CK.StrokeJoin.Miter);
function dashOf(p, a) {
  if (!a["stroke-dasharray"]) return p;
  const [on, off] = a["stroke-dasharray"].split(/[\s,]+/).map(Number);
  if (!(off > 0)) return p;
  const k = DASH_SCALE, ph = +(a["stroke-dashoffset"] || 0);
  p.transform([k, 0, 0, 0, k, 0, 0, 0, 1]);
  p.dash(on * k, off * k, ph * k);
  p.transform([1 / k, 0, 0, 0, 1 / k, 0, 0, 0, 1]);
  return p;
}
function strokeOf(center, a, w) {
  const s = center.copy().stroke({ precision: PRECISION, width: w, cap: capOf(a["stroke-linecap"]), join: joinOf(a["stroke-linejoin"]), miter_limit: +(a["stroke-miterlimit"] || 4) });
  if (s) s.simplify(); // the stroker's outline overlaps itself; PathOps is only reliable on simple paths
  return s;
}
// A stroked element, one subpath at a time (each starts its own dash pattern, as in a browser).
function strokeInk(center, a, w) {
  let ink = null;
  const it = new CK.ContourMeasureIter(center, false, 1);
  let cm;
  while ((cm = it.next())) {
    const seg = cm.getSegment(0, cm.length(), true);
    if (cm.isClosed()) seg.close();
    const s = strokeOf(dashOf(seg.copy(), a), a, w);
    if (s) ink = union(ink, s);
  }
  return ink;
}

// ---------- Masks: white parts added, black parts taken away (Figma's "outside stroke" text uses one) ----------
function masksOf(items) {
  const masks = new Map();
  let cur = null;
  for (const el of items) {
    if (el.tag === "mask") {
      if (el.close) { masks.set(cur.id, cur.region); cur = null; } else cur = { id: el.attrs.id, fill: el.attrs.fill || "white", region: null };
      continue;
    }
    if (!cur || el.close) continue;
    const p = shapeOf(el);
    if (!p) continue;
    const fill = (el.attrs.fill || cur.fill).toLowerCase();
    if (["white", "#fff", "#ffffff"].includes(fill)) cur.region = union(cur.region, p);
    else if (["black", "#000", "#000000"].includes(fill)) { if (cur.region) cur.region = minus(cur.region, p); }
    else throw new Error("Unsupported mask colour " + fill);
  }
  return masks;
}

// ---------- Output ----------
// Exact path data: Skia's own pieces, rounded to a thousandth.
function pathData(p) {
  const tokens = p.toSVGString().match(/[MLQCZ]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) || [];
  const r = (v) => String(+(+v).toFixed(3));
  const arity = { M: 2, L: 2, Q: 4, C: 6, Z: 0 };
  let out = "", cur = null, start = null, i = 0;
  while (i < tokens.length) {
    const c = tokens[i++], args = tokens.slice(i, i + arity[c]).map(r);
    i += arity[c];
    if (c === "Z") { out += "Z"; cur = start; continue; }
    const end = args.slice(-2).join(" ");
    if (c !== "M" && cur !== null && args.every((v, k) => v === (k % 2 ? cur.split(" ")[1] : cur.split(" ")[0]))) continue; // drop zero-length segments
    out += c + args.join(" ").replace(/ -/g, "-");
    cur = end;
    if (c === "M") start = end;
  }
  return out;
}

// Short path data (see fit-path.mjs), checked once more as written: one that strays from the exact outline is
// written exactly instead.
let exactFallbacks = 0;
function shortPath(p) {
  const exact = contoursOf(p.toCmds()), d = writePath(compactContours(exact));
  const back = contoursOf(CK.Path.MakeFromSVGString(d).toCmds());
  if (back.length === exact.length && deviation(exact, back) <= 0.006) return d;
  exactFallbacks++;
  return pathData(p);
}

const num = (v) => (v === undefined || v === null || v === "" ? 1 : +v);

export function outlineSvg(text) {
  const items = readSvg(text);
  const masks = masksOf(items);
  const layers = []; // in drawing order: { ink, opacity }
  let inMask = false;
  for (const el of items) {
    if (el.tag === "mask") { inMask = !el.close; continue; }
    if (el.close || inMask || !["path", "rect", "circle", "ellipse"].includes(el.tag)) continue;
    const a = el.attrs, center = shapeOf(el);
    if (!center) continue;
    const op = num(a.opacity), w = +(a["stroke-width"] || 1.3);
    const filled = a.fill && a.fill !== "none", stroked = a.stroke && a.stroke !== "none";
    const own = [];
    // the fill is painted first, then the stroke over it, each at its own strength
    if (filled) {
      const f = center.copy();
      f.setFillType(a["fill-rule"] === "evenodd" ? CK.FillType.EvenOdd : CK.FillType.Winding);
      f.simplify();
      own.push({ ink: f, opacity: num(a["fill-opacity"]) * op });
    }
    if (stroked) {
      // a hairline on a filled shape (a letter) only smooths its edge, so it is never dashed
      const s = filled && w < 0.5 ? strokeOf(center, a, w) : strokeInk(center, a, w);
      if (s) own.push({ ink: s, opacity: num(a["stroke-opacity"]) * op });
    }
    const m = a.mask && a.mask.match(/url\(#([^)]+)\)/);
    if (m && !masks.has(m[1])) throw new Error("Missing mask " + m[1]);
    for (const l of own) {
      if (m) { const r = masks.get(m[1]); l.ink = r ? meet(l.ink, r) : null; }
      if (l.ink && !l.ink.isEmpty()) layers.push(l);
    }
  }
  // join neighbouring full-strength layers (nothing changes); translucent ones stay apart
  const merged = [];
  for (const l of layers) {
    const last = merged[merged.length - 1];
    if (last && last.opacity === 1 && l.opacity === 1) last.ink = union(last.ink, l.ink);
    else merged.push({ ...l });
  }
  const body = merged.map(({ ink, opacity }) => {
    const p = ink.copy();
    p.simplify();
    const d = shortPath(p);
    if (!d) return "";
    const evenodd = p.getFillType() === CK.FillType.EvenOdd;
    return `  <path d="${d}" fill="currentColor"${opacity < 1 ? ` fill-opacity="${+opacity.toFixed(3)}"` : ""}${evenodd ? ' fill-rule="evenodd"' : ""}/>`;
  }).filter(Boolean);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">\n${body.join("\n")}\n</svg>\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const take = (flag) => { const at = args.indexOf(flag); return at >= 0 ? args.splice(at, 2)[1] : null; };
  const style = take("--style") || "outline", outArg = take("--out");
  const [src, only] = args;
  if (!src || !["outline", "duotone"].includes(style)) {
    console.error("Usage: node scripts/outline.mjs <stroke folder> [--style outline|duotone] [--out <folder>] [name filter]");
    process.exit(1);
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const dst = outArg ? path.resolve(outArg) : path.join(root, "icons", style);
  let n = 0;
  const fails = [];
  for (const cat of fs.readdirSync(src).sort()) {
    if (!fs.statSync(path.join(src, cat)).isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(src, cat)).filter((f) => f.endsWith(".svg")).sort()) {
      const key = `${cat}/${f.slice(0, -4)}`;
      if (only && !only.split(",").some((o) => key.includes(o))) continue;
      try {
        const out = outlineSvg(fs.readFileSync(path.join(src, cat, f), "utf8"));
        fs.mkdirSync(path.join(dst, cat), { recursive: true });
        fs.writeFileSync(path.join(dst, cat, f), out);
        n++;
      } catch (e) { fails.push(`${key}: ${e.message}`); }
    }
  }
  console.log(`Outlined ${n} icons -> ${path.relative(process.cwd(), dst) || dst}${exactFallbacks ? ` (${exactFallbacks} paths written exactly, as their short form strayed)` : ""}`);
  if (fails.length) { console.log("Failed:\n  " + fails.join("\n  ")); process.exitCode = 1; }
}
