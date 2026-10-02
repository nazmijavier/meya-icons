// Icon styles, in the order they appear on the site and in the README.
// A style with no icons in icons/<id>/ yet shows greyed out on the site.
//   stroke: the style is drawn with strokes, so the stroke-width slider applies.
//   round:  copied SVGs set round caps and joins on the root <svg>.
//   pro:    shows a PRO badge on the site and in the README.
//   set:    a full-color set with its own tab instead of a drawing style.
export const STYLES = [
  { id: "outline", label: "Outline", stroke: true, round: true, look: "1.3 px strokes only" },
  { id: "duotone", label: "Duotone", stroke: true, round: true, look: "The same strokes, plus a 30% tint fill for depth" },
  { id: "sharp", label: "Sharp", stroke: true, round: false, pro: true, look: "Strokes with square caps and mitered corners" },
  { id: "filled", label: "Filled", stroke: false, round: false, pro: true, look: "Solid shapes for active and selected states" },
  { id: "pixel", label: "Pixel", stroke: false, round: false, pro: true, look: "Solid cells on a 12 × 12 grid, made with the Pixel Lab" },
  { id: "3d", label: "3D", stroke: false, round: false, pro: true, look: "Rendered 3D icons with depth and soft light" },
  { id: "glass", label: "Glass", stroke: false, round: false, pro: true, look: "Frosted, translucent glass icons" },
  // Full-color sets: their own tab, read from icons/outline/<id>/ (see COLOR_SETS in categories.mjs).
  { id: "cursors", label: "Cursors", stroke: false, round: false, set: true, look: "Full-color cursors: arrows, hands, text, resize and more" },
  { id: "flags", label: "Flags", stroke: false, round: false, set: true, look: "Full-color country and territory flags, 3:2 with rounded corners" },
];
