<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/banner-dark.svg">
  <img alt="Meya Icons 1.0" src="./assets/banner-light.svg" width="100%">
</picture>

# Meya Icons

Meya Icons is a free, open-source set of <!--count-->572<!--/count--> icons drawn by [Meya Lab](https://meyalab.com), in <!--stylenames-->**Outline** and **Duotone**<!--/stylenames--> styles. Every icon sits on a 24 × 24 grid and uses `currentColor`, so it picks up the text color around it. The stroke styles use a 1.3 px stroke with round caps and joins.

[![npm](https://img.shields.io/npm/v/meya-icons?style=flat-square&color=1BA4FF&label=npm)](https://www.npmjs.com/package/meya-icons)
[![Icons](https://img.shields.io/badge/icons-572-121212?style=flat-square)](#categories)
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
| [Outline](./icons/outline) | 287 | 1.3 px strokes only |
| [Duotone](./icons/duotone) | 285 | The same strokes, plus a 30% tint fill for depth |
| Sharp `PRO` | Coming soon | Strokes with square caps and mitered corners |
| Filled `PRO` | Coming soon | Solid shapes for active and selected states |
| Pixel `PRO` | Coming soon | Solid cells on a 12 × 12 grid, made with the Pixel Lab |
<!--/styles-->

Every style uses `currentColor`. Duotone tints use `fill-opacity`, so both tones follow the one color you set.

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
| General | [15](icons/outline/general) | [15](icons/duotone/general) |
| Arrows | [15](icons/outline/arrows) | [15](icons/duotone/arrows) |
| Alerts & Feedback | [15](icons/outline/alerts-feedback) | [15](icons/duotone/alerts-feedback) |
| Communication | [15](icons/outline/communication) | [15](icons/duotone/communication) |
| Users | [15](icons/outline/users) | [15](icons/duotone/users) |
| Files | [15](icons/outline/files) | [15](icons/duotone/files) |
| Editor | [15](icons/outline/editor) | [15](icons/duotone/editor) |
| Layout | [15](icons/outline/layout) | [15](icons/duotone/layout) |
| Images | [15](icons/outline/images) | [15](icons/duotone/images) |
| Media & Devices | [15](icons/outline/media-devices) | [15](icons/duotone/media-devices) |
| Charts | [15](icons/outline/charts) | [15](icons/duotone/charts) |
| Development | [15](icons/outline/development) | [15](icons/duotone/development) |
| Security | [15](icons/outline/security) | [15](icons/duotone/security) |
| Finance & E-commerce | [15](icons/outline/finance-ecommerce) | [15](icons/duotone/finance-ecommerce) |
| Time | [15](icons/outline/time) | [15](icons/duotone/time) |
| Maps & Travel | [16](icons/outline/maps-travel) | [15](icons/duotone/maps-travel) |
| Education | [15](icons/outline/education) | [15](icons/duotone/education) |
| Weather | [16](icons/outline/weather) | [15](icons/duotone/weather) |
| Shapes | [15](icons/outline/shapes) | [15](icons/duotone/shapes) |
<!--/categories-->

## Adding icons

1. Export the new icons from Figma as SVG. Name each file `category-name.svg`, for example `weather-sun.svg` or `Icon=weather-sun.svg`.
2. Import them into `icons/`. Pass `--style` for anything other than Outline (`duotone`, `sharp` or `filled`):

   ```bash
   node scripts/import.mjs ~/path/to/exports
   node scripts/import.mjs ~/path/to/duotone-exports --style duotone
   node scripts/import.mjs ~/path/to/sharp-exports --style sharp
   node scripts/import.mjs ~/path/to/filled-exports --style filled
   ```

3. Rebuild the website, the README images and the icon counts:

   ```bash
   node scripts/build.mjs
   ```

Rebuild the npm package with:

```bash
node scripts/package.mjs
```

It writes `dist/`, which is what gets published.

The website is a single file at [`docs/index.html`](./docs/index.html), served by GitHub Pages.

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
