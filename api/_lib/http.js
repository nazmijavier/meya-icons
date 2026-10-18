// Small helpers shared by the functions.
export function json(res, status, body) {
  res.setHeader("Cache-Control", "private, no-store");
  res.status(status).json(body);
}

export async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}
