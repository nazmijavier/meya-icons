// GET /api/pro?style=sharp&icon=general/home: one Pro icon as SVG, for signed-in Pro customers only.
// The Pro sets live in the private repository; this reads them with a read-only token:
//   PRO_GITHUB_TOKEN  fine-grained GitHub token, Contents: read-only, on nazmijavier/meya-icons-pro
//   PRO_REPO          optional, default nazmijavier/meya-icons-pro
//   PRO_REF           optional, default main
import { json } from "./_lib/http.js";
import { HIDDEN, PRO_STYLES } from "./_lib/catalog.js";
import { current } from "./_lib/session.js";

const cache = new Map(); // per warm instance: path -> { svg, at }
const TTL = 10 * 60 * 1000;

export default async function handler(req, res) {
  const s = await current(req, res);
  if (!s) return json(res, 401, { error: "signed_out" });
  const style = String(req.query.style || ""), icon = String(req.query.icon || "");
  if (!PRO_STYLES.includes(style) || !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(icon) || HIDDEN.includes(icon.split("/")[0])) return json(res, 404, { error: "not_found" });
  const path = `${style}/${icon}.svg`;
  let hit = cache.get(path);
  if (!hit || Date.now() - hit.at > TTL) {
    const repo = process.env.PRO_REPO || "nazmijavier/meya-icons-pro", ref = process.env.PRO_REF || "main";
    if (!process.env.PRO_GITHUB_TOKEN) return json(res, 503, { error: "not_configured" });
    let r;
    try {
      r = await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`, {
        headers: { Accept: "application/vnd.github.raw+json", Authorization: `Bearer ${process.env.PRO_GITHUB_TOKEN}`, "User-Agent": "meya-icons-site", "X-GitHub-Api-Version": "2022-11-28" },
        signal: AbortSignal.timeout(8000),
      });
    } catch { return json(res, 502, { error: "storage" }); }
    if (r.status === 404) return json(res, 404, { error: "not_found" });
    if (!r.ok) return json(res, 502, { error: "storage" });
    hit = { svg: await r.text(), at: Date.now() };
    cache.set(path, hit);
  }
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store"); // never cached by the CDN: it is a paid file
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.status(200).send(hit.svg);
}
