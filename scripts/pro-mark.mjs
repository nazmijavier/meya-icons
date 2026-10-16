// The watermark on the large previews of full-color Pro styles (Glass), whose preview is the picture itself rather
// than a mask. It runs inside the browser on a canvas 2D context, so it must stay self-contained (it is passed to the
// page as source text). Used by scripts/pro-previews.mjs.
export function drawMark(ctx, size) {
  const text = "MEYA ICONS PRO";
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.font = `600 ${Math.round(size * 0.062)}px Inter, "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1, size / 320);
  const gap = size * 0.3;
  for (let row = -2; row <= 2; row++) {
    const y = row * gap, x = row % 2 ? size * 0.22 : 0;
    ctx.strokeStyle = "rgba(20, 24, 40, 0.10)";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = "rgba(255, 255, 255, 0.30)";
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}
