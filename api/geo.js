// The visitor's country, from Vercel's edge (x-vercel-ip-country). The pricing page uses it to show Rupiah in Indonesia
// and US dollars elsewhere. Nothing is stored.
export default function handler(req, res) {
  const country = String(req.headers["x-vercel-ip-country"] || "").toUpperCase().slice(0, 2) || null;
  res.setHeader("Cache-Control", "private, no-store");
  res.status(200).json({ country });
}
