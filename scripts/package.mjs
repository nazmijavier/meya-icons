// Builds the publishable npm package into dist/: raw SVGs plus React components.
// Usage: node scripts/package.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES } from "./categories.mjs";
import { STYLES } from "./styles.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = (...p) => path.join(root, ...p);
const pkg = JSON.parse(fs.readFileSync(rel("package.json"), "utf8"));
const out = rel("dist");
const shipped = STYLES.filter((st) => fs.existsSync(rel("icons", st.id)) && !st.pro);

// ---------- Read ----------
// Names repeat across categories (camera, star, lock…). The first category in the
// canonical order keeps the plain name; the others are prefixed with their category.
const seen = new Map();
const icons = [];
for (const [cat] of CATEGORIES) {
  const dir = rel("icons", "outline", cat);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".svg")).sort()) {
    const name = file.slice(0, -4);
    const slug = seen.has(name) ? `${cat}-${name}` : name;
    seen.set(name, true);
    icons.push({ cat, name, slug, component: pascal(slug) });
  }
}

function pascal(s) {
  return s.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("");
}
function body(style, cat, name) {
  const f = rel("icons", style, cat, `${name}.svg`);
  if (!fs.existsSync(f)) return null;
  return fs.readFileSync(f, "utf8").replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").trim();
}

// ---------- A small parser for the markup we ship ----------
// Our icons are plain SVG shapes plus the occasional <mask>/<g>, so this stays simple.
const VOID = new Set(["path", "circle", "rect", "line", "ellipse", "polyline", "polygon", "use", "stop"]);
function parse(svg) {
  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z-:]+="[^"]*")*)\s*(\/?)>/g;
  const rootNodes = [];
  const stack = [{ children: rootNodes }];
  let m;
  while ((m = tag.exec(svg))) {
    const [, closing, name, attrString, selfClose] = m;
    if (closing) { stack.pop(); continue; }
    const node = { name, attrs: attrs(attrString), children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClose && !VOID.has(name)) stack.push(node);
  }
  return rootNodes;
}
function attrs(s) {
  const out = {};
  for (const m of s.matchAll(/([a-zA-Z-:]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

// Children inherit these from the root <svg>, so repeating them per shape is noise.
const INHERITED = { "stroke-width": "1.3", "stroke-linecap": "round", "stroke-linejoin": "round" };
const REACT_ATTR = { class: "className" };
const camel = (k) => (REACT_ATTR[k] || k.replace(/-([a-z])/g, (_, c) => c.toUpperCase()));

function toElements(nodes, uid) {
  return nodes.map((n) => {
    const props = [];
    for (const [k, v] of Object.entries(n.attrs)) {
      if (INHERITED[k] === v) continue;
      if (k === "style") {
        const style = Object.fromEntries(v.split(";").filter(Boolean).map((d) => {
          const [p, val] = d.split(":");
          return [camel(p.trim()), val.trim()];
        }));
        props.push(`style:${JSON.stringify(style)}`);
        continue;
      }
      // Namespace ids so two icons on one page cannot clash.
      const value = k === "id" ? `${uid}-${v}` : v.replace(/url\(#([^)]+)\)/g, `url(#${uid}-$1)`);
      props.push(`${JSON.stringify(camel(k))}:${JSON.stringify(value)}`);
    }
    const kids = n.children.length ? `,[${toElements(n.children, uid)}]` : "";
    return `e(${JSON.stringify(n.name)},{${props.join(",")}}${kids})`;
  }).join(",");
}

// ---------- Emit ----------
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const counts = {};
for (const st of shipped) {
  const dir = path.join(out, st.id);
  fs.mkdirSync(dir, { recursive: true });
  const made = [];
  for (const ic of icons) {
    const b = body(st.id, ic.cat, ic.name);
    if (!b) continue;
    fs.writeFileSync(path.join(dir, `${ic.slug}.svg`), svgFile(st, b));
    made.push({ ...ic, elements: toElements(parse(b), ic.slug) });
  }
  counts[st.id] = made.length;
  writeReact(st, made);
}

function svgFile(st, inner) {
  const stroke = st.stroke ? ' stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"' : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"${stroke}>\n  ${inner.replace(/></g, ">\n  <")}\n</svg>\n`;
}

function writeReact(st, made) {
  const dir = path.join(out, "react", st.id);
  fs.mkdirSync(dir, { recursive: true });
  const rootProps = st.stroke
    ? `fill:"none",stroke:"currentColor",strokeWidth,strokeLinecap:"round",strokeLinejoin:"round"`
    : `fill:"currentColor"`;
  const esmHead = `import { createElement as e0, forwardRef } from "react";
var e = function (t, p, c) { return c ? e0(t, p, c) : e0(t, p); };
var base = function (size, color, rest) {
  return Object.assign({ xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", color: color }, rest);
};
`;
  const comp = (ic) => `export var ${ic.component} = forwardRef(function ${ic.component}(props, ref) {
  var size = props.size === undefined ? 24 : props.size;
  var strokeWidth = props.strokeWidth === undefined ? 1.3 : props.strokeWidth;
  var color = props.color;
  var rest = Object.assign({}, props); delete rest.size; delete rest.strokeWidth; delete rest.color;
  return e("svg", Object.assign(base(size, color, rest), { ref: ref, ${rootProps} }), [${ic.elements}]);
});`;

  const bodyJs = made.map(comp).join("\n\n");
  fs.writeFileSync(path.join(dir, "index.js"), keyChildren(esmHead + "\n" + bodyJs) + "\n");

  const cjs = `"use strict";
var React = require("react");
var e0 = React.createElement, forwardRef = React.forwardRef;
var e = function (t, p, c) { return c ? e0(t, p, c) : e0(t, p); };
var base = function (size, color, rest) {
  return Object.assign({ xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", color: color }, rest);
};
${made.map((ic) => comp(ic).replace(/^export var /, "var ")).join("\n\n")}

module.exports = { ${made.map((ic) => ic.component).join(", ")} };
`;
  fs.writeFileSync(path.join(dir, "index.cjs"), keyChildren(cjs));

  const dts = `import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from "react";

export interface MeyaIconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  /** Width and height in pixels. Default 24. */
  size?: number | string;
${st.stroke ? "  /** Stroke width. Default 1.3. */\n  strokeWidth?: number | string;\n" : ""}  /** Sets the CSS color the icon is drawn in. Defaults to the inherited text color. */
  color?: string;
}

export type MeyaIcon = ForwardRefExoticComponent<MeyaIconProps & RefAttributes<SVGSVGElement>>;

${made.map((ic) => `export declare const ${ic.component}: MeyaIcon;`).join("\n")}
`;
  fs.writeFileSync(path.join(dir, "index.d.ts"), dts);
}

// React wants a key on every child in an array.
function keyChildren(src) {
  let n = 0;
  return src.replace(/e\((".*?"),\{/g, (m, tag) => `e(${tag},{"key":${n++},`).replace(/e\("svg",Object/g, 'e("svg",Object');
}

// ---------- package.json, docs ----------
const exportsMap = { "./package.json": "./package.json" };
for (const st of shipped) {
  exportsMap[`./react/${st.id}`] = { types: `./react/${st.id}/index.d.ts`, import: `./react/${st.id}/index.js`, require: `./react/${st.id}/index.cjs` };
  exportsMap[`./${st.id}/*`] = `./${st.id}/*`;
}
fs.writeFileSync(path.join(out, "package.json"), JSON.stringify({
  name: "meya-icons",
  version: pkg.version,
  description: pkg.description,
  license: pkg.license,
  author: pkg.author,
  homepage: pkg.homepage,
  repository: pkg.repository,
  keywords: pkg.keywords,
  sideEffects: false,
  type: "module",
  exports: exportsMap,
  files: [...shipped.map((st) => st.id), "react", "README.md", "LICENSE"],
  peerDependencies: { react: ">=16.8" },
  peerDependenciesMeta: { react: { optional: true } },
}, null, 2) + "\n");

fs.copyFileSync(rel("LICENSE"), path.join(out, "LICENSE"));
fs.writeFileSync(path.join(out, "README.md"), `# Meya Icons

${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(" and ")} icons by [Meya Lab](https://meyalab.com), on a 24 × 24 grid.

**[Browse every icon](https://icons.meyalab.com/)**

## Install

\`\`\`bash
npm i meya-icons
\`\`\`

## React

\`\`\`jsx
import { Home, Search } from "meya-icons/react/outline";
import { Heart } from "meya-icons/react/duotone";

<Home />                          // 24px, inherits the text color
<Search size={20} strokeWidth={2} />
<Heart color="#0071E3" />
\`\`\`

Every component forwards a ref and accepts any SVG prop, so \`className\`, \`onClick\` and \`aria-label\` all work.

## SVG

\`\`\`js
import homeUrl from "meya-icons/outline/home.svg";
\`\`\`

Icons use \`currentColor\`, so they take the color of the text around them.

## Names

Components are the PascalCase form of the file name: \`arrow-right\` is \`ArrowRight\`. Where a name appears in more than one category, the first keeps the plain name and the rest carry their category, so \`camera\` is \`Camera\` (images), \`MediaDevicesCamera\` and \`SecurityCamera\`.

## License

MIT
`);

console.log(`Packed ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")} → dist/`);
