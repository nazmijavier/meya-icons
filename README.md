<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/banner-dark.svg">
  <img alt="Meya Icons 1.0" src="./assets/banner-light.svg" width="100%">
</picture>

# Meya Icons

Meya Icons is a free, open-source set of <!--count-->287<!--/count--> stroke icons drawn by [Meya Lab](https://meyalab.com). Every icon sits on a 24 × 24 grid with a 1.3 px stroke and round caps and joins, and uses `currentColor`, so it picks up the text color around it.

[![Icons](https://img.shields.io/badge/icons-287-121212?style=flat-square)](#categories)
[![Version](https://img.shields.io/badge/version-1.0-1BA4FF?style=flat-square)](https://github.com/nazmijavier/meya-icons/releases)
[![License](https://img.shields.io/badge/license-MIT-737373?style=flat-square)](./LICENSE)

**[Browse the icons](https://nazmijavier.github.io/meya-icons/)** · **[Download ZIP](https://github.com/nazmijavier/meya-icons/releases/latest/download/meya-icons-1.0.zip)** · **[Hire Meya Lab](https://meyalab.com/contact)**

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/preview-dark.svg">
  <img alt="A sample of Meya Icons across every category" src="./assets/preview-light.svg" width="100%">
</picture>

## Get the icons

- **Copy one icon.** Open the [website](https://nazmijavier.github.io/meya-icons/), search, pick an icon, and copy it as SVG or as a React component. You can change the stroke width and size before you copy.
- **Download the whole set.** Get the [ZIP from the latest release](https://github.com/nazmijavier/meya-icons/releases/latest/download/meya-icons-1.0.zip). The SVG files are in [`icons/`](./icons), one folder per category.
- **Clone it.**

  ```bash
  git clone https://github.com/nazmijavier/meya-icons.git
  ```

## Usage

### HTML

Paste the SVG inline. The icon takes the color of its parent.

```html
<button style="color: #1BA4FF">
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <!-- paths from icons/general/home.svg -->
  </svg>
  Home
</button>
```

### React

Copy the React version from the website, or import the file with an SVG loader such as SVGR:

```jsx
// home.svg copied from icons/general/
import HomeIcon from "./icons/home.svg?react";

<HomeIcon className="text-neutral-900" width={20} height={20} />
```

### Figma

Drag any SVG from [`icons/`](./icons) onto the canvas. Strokes stay editable.

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
| Category | Folder | Icons |
| --- | --- | ---: |
| General | [`icons/general`](icons/general) | 15 |
| Arrows | [`icons/arrows`](icons/arrows) | 15 |
| Alerts & Feedback | [`icons/alerts-feedback`](icons/alerts-feedback) | 15 |
| Communication | [`icons/communication`](icons/communication) | 15 |
| Users | [`icons/users`](icons/users) | 15 |
| Files | [`icons/files`](icons/files) | 15 |
| Editor | [`icons/editor`](icons/editor) | 15 |
| Layout | [`icons/layout`](icons/layout) | 15 |
| Images | [`icons/images`](icons/images) | 15 |
| Media & Devices | [`icons/media-devices`](icons/media-devices) | 15 |
| Charts | [`icons/charts`](icons/charts) | 15 |
| Development | [`icons/development`](icons/development) | 15 |
| Security | [`icons/security`](icons/security) | 15 |
| Finance & E-commerce | [`icons/finance-ecommerce`](icons/finance-ecommerce) | 15 |
| Time | [`icons/time`](icons/time) | 15 |
| Maps & Travel | [`icons/maps-travel`](icons/maps-travel) | 16 |
| Education | [`icons/education`](icons/education) | 15 |
| Weather | [`icons/weather`](icons/weather) | 16 |
| Shapes | [`icons/shapes`](icons/shapes) | 15 |
<!--/categories-->

## Adding icons

1. Export the new icons from Figma as SVG. Name each file `category-name.svg`, for example `weather-sun.svg` or `Icon=weather-sun.svg`.
2. Import them into `icons/`:

   ```bash
   node scripts/import.mjs ~/path/to/exports
   ```

3. Rebuild the website, the README images and the icon counts:

   ```bash
   node scripts/build.mjs
   ```

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
