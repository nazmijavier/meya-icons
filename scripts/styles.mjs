// Icon styles, in the order they appear on the site and in the README.
// A style with no icons in icons/<id>/ yet shows greyed out on the site.
//   stroke: the style is drawn with strokes, so the stroke-width slider applies. Outline and Duotone ship with
//           their strokes outlined into shapes; the live strokes are the Pro "Stroke" style.
//   outlined: drawn with 1.3 px strokes that ship outlined into shapes (the site reports the line weight).
//   round:  copied SVGs set round caps and joins on the root <svg>.
//   pro:    shows a PRO badge on the site and in the README.
//   set:    a full-color set with its own tab instead of a drawing style.
//   showcase: a PRO style the site shows from image previews (docs/pro/, made by pro-previews.mjs);
//           people can browse it but copying needs Pro, and its vectors never ship in this repo.
//   color:  the icons carry their own colors (no currentColor), so previews show them as they are.
//   animated: the icons move: each SVG carries its own CSS animation. A hand-picked set, not every icon. On the site
//           a tile shows its still frame and plays an animated preview (docs/pro/<style>/<category>/<name>.webp)
//           while hovered; the details sheet always plays it.
export const STYLES = [
  { id: "outline", label: "Outline", stroke: false, outlined: true, round: false, look: "1.3 px lines, outlined into shapes" },
  { id: "duotone", label: "Duotone", stroke: false, outlined: true, round: false, look: "The same lines, plus a 30% tint fill for depth" },
  { id: "stroke", label: "Stroke", stroke: true, round: true, pro: true, showcase: true, look: "Live 1.3 px strokes you can make thinner or bolder" },
  { id: "stroke-duotone", label: "Stroke Duotone", stroke: true, round: true, pro: true, showcase: true, look: "Live strokes with a 30% tint fill, thinner or bolder" },
  { id: "sharp", label: "Sharp", stroke: true, round: false, pro: true, showcase: true, look: "Strokes with square caps and mitered corners" },
  { id: "filled", label: "Filled", stroke: false, round: false, pro: true, showcase: true, look: "Solid shapes for active and selected states" },
  { id: "glass", label: "Glass", stroke: false, round: false, pro: true, showcase: true, color: true, look: "Glossy glass in a blue-to-violet gradient" },
  { id: "animated", label: "Animated", stroke: true, round: true, pro: true, showcase: true, animated: true, look: "Icons that move, each with its own motion, as animated SVG" },
  { id: "pixel", label: "Pixel", stroke: false, round: false, pro: true, look: "Solid cells on a 12 × 12 grid, made with the Pixel Lab" },
  { id: "3d", label: "3D", stroke: false, round: false, pro: true, look: "Rendered 3D icons with depth and soft light" },
  // Full-color sets: their own tab, read from icons/outline/<id>/ (see COLOR_SETS in categories.mjs).
  { id: "cursors", label: "Cursors", stroke: false, round: false, set: true, look: "Full-color cursors: arrows, hands, text, resize and more" },
  { id: "flags", label: "Flags", stroke: false, round: false, set: true, look: "Full-color country and territory flags, 3:2 with rounded corners" },
];
