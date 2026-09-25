// Icon styles, in the order they appear on the site and in the README.
// A style with no icons in icons/<id>/ yet shows as "Soon" on the site.
//   stroke: the style is drawn with strokes, so the stroke-width slider applies.
//   round:  copied SVGs set round caps and joins on the root <svg>.
export const STYLES = [
  { id: "outline", label: "Outline", stroke: true, round: true, look: "1.3 px strokes only" },
  { id: "duotone", label: "Duotone", stroke: true, round: true, look: "The same strokes, plus a 30% tint fill for depth" },
  { id: "sharp", label: "Sharp", stroke: true, round: false, look: "Strokes with square caps and mitered corners" },
  { id: "filled", label: "Filled", stroke: false, round: false, look: "Solid shapes for active and selected states" },
];
