// Meya Icons for Figma: main thread. The UI (ui.html) sends ready-made SVG strings;
// this side turns them into layers, places them and keeps the UI told about the selection.

figma.showUI(__html__, { width: 360, height: 600, themeColors: true });

const PREFIX = "meya/";
const isIcon = (node) => node && node.name.startsWith(PREFIX);

function selectedIcon() {
  const sel = figma.currentPage.selection;
  return sel.length === 1 && isIcon(sel[0]) ? sel[0] : null;
}

function build({ svg, name, size }) {
  const node = figma.createNodeFromSvg(svg); // drawn at 24 × 24
  node.name = PREFIX + name;
  node.fills = [];
  if (size !== 24) node.rescale(size / 24); // scales strokes with the shape
  node.setPluginData("meya", JSON.stringify({ name, size }));
  return node;
}

function place(node, target) {
  // Swap: same parent, same stacking position, same top-left corner.
  if (target) {
    const parent = target.parent;
    const index = parent.children.indexOf(target);
    parent.insertChild(index, node);
    node.x = target.x;
    node.y = target.y;
    target.remove();
    return;
  }
  // Into a selected frame, otherwise the middle of the viewport.
  const sel = figma.currentPage.selection;
  const frame = sel.length === 1 && ["FRAME", "COMPONENT", "SECTION"].includes(sel[0].type) && !isIcon(sel[0]) ? sel[0] : null;
  if (frame) {
    frame.appendChild(node);
    node.x = Math.round((frame.width - node.width) / 2);
    node.y = Math.round((frame.height - node.height) / 2);
    return;
  }
  const c = figma.viewport.center;
  node.x = Math.round(c.x - node.width / 2);
  node.y = Math.round(c.y - node.height / 2);
}

function postSelection() {
  const icon = selectedIcon();
  figma.ui.postMessage({ type: "selection", icon: icon ? icon.name.slice(PREFIX.length) : null });
}

figma.ui.onmessage = (msg) => {
  if (msg.type === "insert") {
    const target = msg.swap ? selectedIcon() : null;
    const node = build(msg);
    place(node, target);
    figma.currentPage.selection = [node];
    if (!target) figma.viewport.scrollAndZoomIntoView([node]);
    figma.notify(`${target ? "Swapped to" : "Inserted"} ${msg.name.split("/").pop()}`, { timeout: 1200 });
  }
  if (msg.type === "notify") figma.notify(msg.text, { timeout: 1600 });
  if (msg.type === "resize") figma.ui.resize(360, Math.max(420, Math.min(900, msg.height)));
};

// Drag from the plugin onto the canvas.
figma.on("drop", (event) => {
  const item = event.items.find((i) => i.type === "image/svg+xml");
  if (!item || !event.dropMetadata) return true;
  const node = build({ svg: item.data, name: event.dropMetadata.name, size: event.dropMetadata.size });
  // x/y are relative to the node dropped on; fall back to page coordinates when it can't hold children.
  const into = event.node && event.node.type !== "PAGE" && "appendChild" in event.node;
  (into ? event.node : figma.currentPage).appendChild(node);
  const x = into ? event.x : event.absoluteX, y = into ? event.y : event.absoluteY;
  node.x = Math.round(x - node.width / 2);
  node.y = Math.round(y - node.height / 2);
  figma.currentPage.selection = [node];
  return false;
});

figma.on("selectionchange", postSelection);
postSelection();
