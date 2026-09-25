// Icon styles, in the order they appear on the site and in the README.
// A style with no icons in icons/<id>/ yet shows greyed out on the site.
//   stroke: the style is drawn with strokes, so the stroke-width slider applies.
//   round:  copied SVGs set round caps and joins on the root <svg>.
//   pro:    shows a PRO badge on the site and in the README.
export const STYLES = [
  { id: "outline", label: "Outline", stroke: true, round: true, look: "1.3 px strokes only" },
  { id: "duotone", label: "Duotone", stroke: true, round: true, look: "The same strokes, plus a 30% tint fill for depth" },
  { id: "pixel", label: "Pixel", stroke: false, round: false, look: "Solid cells on a 12 × 12 grid, made with the Pixel Lab" },
  { id: "sharp", label: "Sharp", stroke: true, round: false, pro: true, look: "Strokes with square caps and mitered corners" },
  { id: "filled", label: "Filled", stroke: false, round: false, pro: true, look: "Solid shapes for active and selected states" },
];
