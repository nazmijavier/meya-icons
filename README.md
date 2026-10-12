<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/banner-dark.svg">
  <img alt="Meya Icons 1.0" src="./assets/banner-light.svg" width="100%">
</picture>

# Meya Icons

Meya Icons is a free, open-source set of <!--count-->1380<!--/count--> icons drawn by [Meya Lab](https://meyalab.com), in <!--stylenames-->**Outline** and **Duotone**<!--/stylenames--> styles. Every icon sits on a 24 × 24 grid and uses `currentColor`, so it picks up the text color around it. The stroke styles use a 1.3 px stroke with round caps and joins.

[![npm](https://img.shields.io/npm/v/meya-icons?style=flat-square&color=1BA4FF&label=npm)](https://www.npmjs.com/package/meya-icons)
[![Icons](https://img.shields.io/badge/icons-1380-121212?style=flat-square)](#categories)
[![Version](https://img.shields.io/badge/version-1.0-1BA4FF?style=flat-square)](https://github.com/nazmijavier/meya-icons/releases)
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
| [Outline](./icons/outline) | 542 | 1.3 px strokes only |
| [Duotone](./icons/duotone) | 540 | The same strokes, plus a 30% tint fill for depth |
| [Sharp](https://icons.meyalab.com/#sharp) `PRO` | 520 | Strokes with square caps and mitered corners |
| [Filled](https://icons.meyalab.com/#filled) `PRO` | 520 | Solid shapes for active and selected states |
| Pixel `PRO` | Coming soon | Solid cells on a 12 × 12 grid, made with the Pixel Lab |
| 3D `PRO` | Coming soon | Rendered 3D icons with depth and soft light |
| Glass `PRO` | Coming soon | Frosted, translucent glass icons |
| [Cursors](./icons/outline/cursors) | 43 | Full-color cursors: arrows, hands, text, resize and more |
| [Flags](./icons/outline/flags) | 255 | Full-color country and territory flags, 3:2 with rounded corners |
<!--/styles-->

Outline, Duotone, Sharp and Filled use `currentColor`; Cursors and Flags carry their own colors. Duotone tints use `fill-opacity`, so both tones follow the one color you set.

## Get the icons

- **Copy one icon.** Open the [website](https://icons.meyalab.com/), choose a style, search, pick an icon, and copy it as SVG or as a React component. You can change the stroke width and size before you copy.
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
<Search size={20} strokeWidth={2} />
<Heart color="#0071E3" />
```

Components forward a ref and take any SVG prop, so `className`, `onClick` and `aria-label` all work. Where a name appears in more than one category the first keeps the plain name and the rest carry theirs, so `camera` is `Camera`, `MediaDevicesCamera` and `SecurityCamera`.

### Figma

Drag any SVG from [`icons/`](./icons) onto the canvas. Strokes and tints stay editable.

## Design specs

| Property | Value |
| --- | --- |
| Grid | 24 × 24 px |
| Live area | 20 × 20 px (2 px padding) |
| Stroke | 1.3 px, centered |
| Caps and joins | Round |
| Color | `currentColor` |

## Categories

<!--categories-->
| Category | Outline | Duotone |
| --- | ---: | ---: |
| General | [76](icons/outline/general) | [76](icons/duotone/general) |
| Arrows | [30](icons/outline/arrows) | [30](icons/duotone/arrows) |
| Alerts & Feedback | [17](icons/outline/alerts-feedback) | [17](icons/duotone/alerts-feedback) |
| Communication | [29](icons/outline/communication) | [29](icons/duotone/communication) |
| Users | [18](icons/outline/users) | [18](icons/duotone/users) |
| Files | [26](icons/outline/files) | [26](icons/duotone/files) |
| Editor | [28](icons/outline/editor) | [28](icons/duotone/editor) |
| Layout | [26](icons/outline/layout) | [26](icons/duotone/layout) |
| Images | [27](icons/outline/images) | [27](icons/duotone/images) |
| Media & Devices | [43](icons/outline/media-devices) | [43](icons/duotone/media-devices) |
| Charts | [19](icons/outline/charts) | [19](icons/duotone/charts) |
| Development | [19](icons/outline/development) | [19](icons/duotone/development) |
| Security | [18](icons/outline/security) | [18](icons/duotone/security) |
| Finance & E-commerce | [27](icons/outline/finance-ecommerce) | [27](icons/duotone/finance-ecommerce) |
| Time | [18](icons/outline/time) | [18](icons/duotone/time) |
| Maps & Travel | [29](icons/outline/maps-travel) | [28](icons/duotone/maps-travel) |
| Education | [20](icons/outline/education) | [20](icons/duotone/education) |
| Weather | [21](icons/outline/weather) | [20](icons/duotone/weather) |
| Nature | [10](icons/outline/nature) | [10](icons/duotone/nature) |
| Health | [11](icons/outline/health) | [11](icons/duotone/health) |
| Food & Drink | [15](icons/outline/food) | [15](icons/duotone/food) |
| Shapes | [15](icons/outline/shapes) | [15](icons/duotone/shapes) |
<!--/categories-->

## Adding icons

1. Export the new icons from Figma as SVG. Name each file `category-name.svg`, for example `weather-sun.svg` or `Icon=weather-sun.svg`.
2. Import them into `icons/`. Pass `--style duotone` for Duotone exports:

   ```bash
   node scripts/import.mjs ~/path/to/exports
   node scripts/import.mjs ~/path/to/duotone-exports --style duotone
   ```

3. Rebuild the website, the README images and the icon counts:

   ```bash
   node scripts/build.mjs
   ```

Sharp, Filled, Pixel, 3D and Glass are Pro styles. Their SVGs live in `../meya-icons-pro/<style>/`, never in `icons/`, so they don't ship under the MIT license. The website shows the Pro styles that have shipped (marked `showcase` in `scripts/styles.mjs`) from image previews in `docs/pro/`, with copying locked; the others show as coming soon. Full-color styles (marked `color`) are previewed as they are, the rest as one-color shapes that follow the site's color picker. After changing a shipped Pro style's icons, refresh the previews before you build:

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
