<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/banner-dark.svg">
  <img alt="Meya Icons 2.0" src="./assets/banner-light.svg" width="100%">
</picture>

# Meya Icons

Meya Icons is a free, open-source set of <!--count-->2064<!--/count--> icons drawn by [Meya Lab](https://meyalab.com), in <!--stylenames-->**Outline** and **Duotone**<!--/stylenames--> styles. Every icon sits on a 24 × 24 grid and uses `currentColor`, so it picks up the text color around it. Icons are drawn with a 1.3 px stroke with round caps and joins, and ship with that stroke outlined into shapes, so they look the same in every app and at every size.

[![npm](https://img.shields.io/npm/v/meya-icons?style=flat-square&color=1BA4FF&label=npm)](https://www.npmjs.com/package/meya-icons)
[![Icons](https://img.shields.io/badge/icons-2064-121212?style=flat-square)](#categories)
[![Version](https://img.shields.io/badge/version-2.0-1BA4FF?style=flat-square)](https://github.com/nazmijavier/meya-icons/releases)
[![License](https://img.shields.io/badge/license-MIT-737373?style=flat-square)](./LICENSE)

**[Browse and copy the icons](https://icons.meyalab.com/)** · **[Figma plugin](https://www.figma.com/community/plugin/1685393903679180914)** · **[Hire Meya Lab](https://meyalab.com/contact)**

<!--previews-->
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/preview-outline-dark.svg">
  <img alt="A sample of Meya Icons in the Outline style" src="./assets/preview-outline-light.svg" width="100%">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/preview-duotone-dark.svg">
  <img alt="A sample of Meya Icons in the Duotone style" src="./assets/preview-duotone-light.svg" width="100%">
</picture>
<!--/previews-->

## Styles

<!--styles-->
| Style | Icons | Look |
| --- | ---: | --- |
| [Outline](./icons/outline) | 884 | 1.3 px lines, outlined into shapes |
| [Duotone](./icons/duotone) | 882 | The same lines, plus a 30% tint fill for depth |
| [Stroke](https://icons.meyalab.com/#stroke) `PRO` | 884 | Live 1.3 px strokes you can make thinner or bolder |
| [Sharp](https://icons.meyalab.com/#sharp) `PRO` | 884 | Strokes with square caps and mitered corners |
| [Filled](https://icons.meyalab.com/#filled) `PRO` | 884 | Solid shapes for active and selected states |
| [Glass](https://icons.meyalab.com/#glass) `PRO` | 884 | Glossy glass in a blue-to-violet gradient |
| Pixel `PRO` | Coming soon | Solid cells on a 12 × 12 grid, made with the Pixel Lab |
| 3D `PRO` | Coming soon | Rendered 3D icons with depth and soft light |
| [Cursors](./icons/outline/cursors) | 43 | Full-color cursors: arrows, hands, text, resize and more |
| [Flags](./icons/outline/flags) | 255 | Full-color country and territory flags, 3:2 with rounded corners |
<!--/styles-->

Outline, Duotone, Stroke, Sharp and Filled use `currentColor`; Cursors and Flags carry their own colors. Duotone tints use `fill-opacity`, so both tones follow the one color you set.

Since 2.0, Outline and Duotone have their strokes outlined into solid shapes, so the line weight is fixed at 1.3 px. Live strokes you can make thinner or bolder are the **Stroke** style in [Meya Icons Pro](https://icons.meyalab.com/pricing). Releases before 2.0 keep their strokes and stay MIT.

## Get the icons

- **Copy one icon.** Open the [website](https://icons.meyalab.com/), choose a style, search, pick an icon, and copy it as SVG or as a React component. You can change the size and color before you copy.
- **Use them in Figma.** Install [Meya Icons for Figma](https://www.figma.com/community/plugin/1685393903679180914) from the Community and place icons straight onto your canvas.

- **Install the package.**

  ```bash
  npm i meya-icons
  ```

## Usage

### HTML

Paste the SVG inline. The icon takes the color of its parent.

```html
<button style="color: #1BA4FF">
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <!-- paths from icons/outline/general/home.svg -->
  </svg>
  Home
</button>
```

### React

```jsx
import { Home, Search } from "meya-icons/react/outline";
import { Heart } from "meya-icons/react/duotone";

<Home />                          // 24px, inherits the text color
<Search size={20} />
<Heart color="#0071E3" />
```

Components forward a ref and take any SVG prop, so `className`, `onClick` and `aria-label` all work. Where a name appears in more than one category the first keeps the plain name and the rest carry theirs, so `camera` is `Camera`, `MediaDevicesCamera` and `SecurityCamera`.

### Figma

Drag any SVG from [`icons/`](./icons) onto the canvas. Each icon comes in as one shape (Duotone: its tint as a second, 30% layer), ready to recolor.

## Design specs

| Property | Value |
| --- | --- |
| Grid | 24 × 24 px |
| Live area | 20 × 20 px (2 px padding) |
| Stroke | 1.3 px, centered, outlined into shapes |
| Caps and joins | Round |
| Color | `currentColor` |

## Categories

<!--categories-->
| Category | Outline | Duotone |
| --- | ---: | ---: |
| General | [106](icons/outline/general) | [106](icons/duotone/general) |
| AI | [128](icons/outline/ai) | [128](icons/duotone/ai) |
| Arrows | [37](icons/outline/arrows) | [37](icons/duotone/arrows) |
| Alerts & Feedback | [18](icons/outline/alerts-feedback) | [18](icons/duotone/alerts-feedback) |
| Communication | [32](icons/outline/communication) | [32](icons/duotone/communication) |
| Users | [41](icons/outline/users) | [41](icons/duotone/users) |
| Files | [33](icons/outline/files) | [33](icons/duotone/files) |
| Editor | [37](icons/outline/editor) | [37](icons/duotone/editor) |
| Layout | [47](icons/outline/layout) | [47](icons/duotone/layout) |
| Images | [49](icons/outline/images) | [49](icons/duotone/images) |
| Media & Devices | [63](icons/outline/media-devices) | [63](icons/duotone/media-devices) |
| Charts | [19](icons/outline/charts) | [19](icons/duotone/charts) |
| Development | [23](icons/outline/development) | [23](icons/duotone/development) |
| Security | [20](icons/outline/security) | [20](icons/duotone/security) |
| Finance & E-commerce | [38](icons/outline/finance-ecommerce) | [38](icons/duotone/finance-ecommerce) |
| Time | [21](icons/outline/time) | [21](icons/duotone/time) |
| Maps & Travel | [36](icons/outline/maps-travel) | [35](icons/duotone/maps-travel) |
| Education | [20](icons/outline/education) | [20](icons/duotone/education) |
| Weather | [21](icons/outline/weather) | [20](icons/duotone/weather) |
| Nature | [19](icons/outline/nature) | [19](icons/duotone/nature) |
| Health | [12](icons/outline/health) | [12](icons/duotone/health) |
| Food & Drink | [28](icons/outline/food) | [28](icons/duotone/food) |
| Home & Living | [16](icons/outline/home) | [16](icons/duotone/home) |
| Shapes | [20](icons/outline/shapes) | [20](icons/duotone/shapes) |
<!--/categories-->

## Adding icons

1. Export the new icons from Figma as SVG, strokes and all. Name each file `category-name.svg`, for example `weather-sun.svg` or `Icon=weather-sun.svg`.
2. Import them into the Pro stroke folders. The live strokes are the Pro Stroke style, so they stay out of this repo:

   ```bash
   node scripts/import.mjs ~/path/to/exports --out ../meya-icons-pro/stroke
   node scripts/import.mjs ~/path/to/duotone-exports --out ../meya-icons-pro/stroke-duotone
   ```

3. Outline them into `icons/`. Every stroke becomes the shape it draws, caps, joins and dots included (needs `npm i` once, for CanvasKit). Add a name filter to outline only some icons:

   ```bash
   node scripts/outline.mjs ../meya-icons-pro/stroke
   node scripts/outline.mjs ../meya-icons-pro/stroke-duotone --style duotone
   ```

4. Rebuild the website, the README images and the icon counts:

   ```bash
   node scripts/build.mjs
   ```

Stroke, Sharp, Filled, Pixel, 3D and Glass are Pro styles. Their SVGs live in `../meya-icons-pro/<style>/`, never in `icons/`, so they don't ship under the MIT license. The website shows the Pro styles that have shipped (marked `showcase` in `scripts/styles.mjs`) from image previews in `docs/pro/`, with copying locked; the others show as coming soon. Full-color styles (marked `color`) are previewed as they are, the rest as one-color shapes that follow the site's color picker. After changing a shipped Pro style's icons, refresh the previews before you build:

```bash
node scripts/pro-previews.mjs   # needs Playwright: npm i -D playwright && npx playwright install chromium
node scripts/build.mjs
```

Rebuild the npm package with:

```bash
node scripts/package.mjs
```

It writes `dist/`, which is what gets published.

The website is a single file at [`docs/index.html`](./docs/index.html), served by Vercel (see [`vercel.json`](./vercel.json)).

## License

Meya Icons is released under the [MIT License](./LICENSE). You can use it in personal and commercial projects. Credit is appreciated but not required.

---

<a href="https://meyalab.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/wordmark-white.svg">
    <img src="./assets/wordmark.svg" alt="Meya Lab Studio" height="18">
  </picture>
</a>

Made by [Meya Lab](https://meyalab.com), a design studio that builds brands, websites and apps. Need a custom icon set? [Hire us](https://meyalab.com/contact).
