// GET /api/pro?style=sharp&icon=general/home: one Pro icon as SVG, for signed-in Pro customers only.
// The Pro sets live in the private repository; this reads them with a read-only token:
//   PRO_GITHUB_TOKEN  fine-grained GitHub token, Contents: read-only, on nazmijavier/meya-icons-pro
//   PRO_REPO          optional, default nazmijavier/meya-icons-pro
//   PRO_REF           optional, default main
//   GITHUB_API_URL    optional, default https://api.github.com (tests point it at a local stand-in)
import { json } from "./_lib/http.js";
import { HIDDEN, PRO_STYLES } from "./_lib/catalog.js";
import { current } from "./_lib/session.js";

const cache = new Map(); // per warm instance: path -> { svg, at }
const TTL = 10 * 60 * 1000;

export async function GET(request) {
  const headers = new Headers();
  const s = await current(request, headers);
  if (!s) return json(401, { error: "signed_out" }, headers);
  const q = new URL(request.url).searchParams;
  const style = q.get("style") || "", icon = q.get("icon") || "";
  if (!PRO_STYLES.includes(style) || !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(icon) || HIDDEN.includes(icon.split("/")[0])) return json(404, { error: "not_found" }, headers);
  const path = `${style}/${icon}.svg`;
  let hit = cache.get(path);
  if (!hit || Date.now() - hit.at > TTL) {
    const repo = process.env.PRO_REPO || "nazmijavier/meya-icons-pro", ref = process.env.PRO_REF || "main";
    const api = (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "");
    if (!process.env.PRO_GITHUB_TOKEN) return json(503, { error: "not_configured" }, headers);
    let r;
    try {
      r = await fetch(`${api}/repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`, {
        // GitHub refuses API requests without a User-Agent, and Workers' fetch sends none of its own
        headers: { Accept: "application/vnd.github.raw+json", Authorization: `Bearer ${process.env.PRO_GITHUB_TOKEN}`, "User-Agent": "meya-icons-site", "X-GitHub-Api-Version": "2022-11-28" },
        signal: AbortSignal.timeout(8000),
      });
    } catch { return json(502, { error: "storage" }, headers); }
    if (r.status === 404) return json(404, { error: "not_found" }, headers);
    if (!r.ok) return json(502, { error: "storage" }, headers);
    hit = { svg: await r.text(), at: Date.now() };
    cache.set(path, hit);
  }
  headers.set("Content-Type", "image/svg+xml; charset=utf-8");
  headers.set("Cache-Control", "private, no-store"); // never cached by the CDN: it is a paid file
  headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(hit.svg, { status: 200, headers });
}
