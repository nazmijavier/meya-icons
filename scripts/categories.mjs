// Folder id → display label. Order here is the order on the site and in the README.
export const CATEGORIES = [
  ["general", "General"],
  ["ai", "AI"],
  ["arrows", "Arrows"],
  ["alerts-feedback", "Alerts & Feedback"],
  ["communication", "Communication"],
  ["users", "Users"],
  ["files", "Files"],
  ["editor", "Editor"],
  ["layout", "Layout"],
  ["images", "Images"],
  ["media-devices", "Media & Devices"],
  ["charts", "Charts"],
  ["development", "Development"],
  ["security", "Security"],
  ["finance-ecommerce", "Finance & E-commerce"],
  ["time", "Time"],
  ["maps-travel", "Maps & Travel"],
  ["landmarks", "Landmarks"],
  ["education", "Education"],
  ["weather", "Weather"],
  ["nature", "Nature"],
  ["health", "Health"],
  ["fitness", "Fitness"],
  ["food", "Food & Drink"],
  ["home", "Home & Living"],
  ["shapes", "Shapes"],
  ["cursors", "Cursors"],
  ["flags", "Flags"],
];

// Full-color sets drawn once: they live in icons/outline/<id>/ and show in every style on the site.
export const COLOR_SETS = ["cursors", "flags"];

// Categories held back for now: their files stay in icons/, but the site, the README, the npm package and the
// Figma plugin leave them out. Remove an id here to bring it back.
export const HIDDEN = ["landmarks"];
