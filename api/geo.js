// The visitor's country: Cloudflare's request.cf.country, or Vercel's x-vercel-ip-country header. The pricing page
// uses it to show Rupiah in Indonesia and US dollars elsewhere. Nothing is stored.
import { json } from "./_lib/http.js";

export function GET(request) {
  const country = String(request.cf?.country || request.headers.get("x-vercel-ip-country") || "").toUpperCase().slice(0, 2) || null;
  return json(200, { country });
}
