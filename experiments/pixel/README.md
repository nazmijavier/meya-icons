# Pixel experiments

Pixel-grid versions of Meya Icons, made with the Pixel Lab (`docs/pixel.html`, live at https://nazmijavier.github.io/meya-icons/pixel.html).

These three were exported at the default settings: 12 × 12 grid, weight 1.00, fill threshold 45%, no corner rounding.

To turn a full export into a style on the site, unzip it and run:

```bash
node scripts/import.mjs ~/Downloads/meya-pixel-12 --style pixel
```

after adding a `pixel` entry to `scripts/styles.mjs`.
