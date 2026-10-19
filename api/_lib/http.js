// Small helpers shared by the functions. Each function takes a Web Request and returns a Response: the signature
// Cloudflare Workers run (through worker.js) and Vercel runs from api/.
export function json(status, body, headers = new Headers()) {
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "private, no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

// The JSON bodies the functions take are a few hundred bytes: a body over MAX_BODY is dropped unread, not parsed.
const MAX_BODY = 4096;

export async function body(request) {
  try {
    if (!request.body || Number(request.headers.get("content-length")) > MAX_BODY) return {};
    const reader = request.body.getReader(), dec = new TextDecoder();
    let text = "", size = 0;
    for (let r; !(r = await reader.read()).done; ) {
      size += r.value.byteLength;
      if (size > MAX_BODY) { reader.cancel().catch(() => {}); return {}; }
      text += dec.decode(r.value, { stream: true });
    }
    const b = JSON.parse(text + dec.decode());
    return b && typeof b === "object" ? b : {};
  } catch {
    return {};
  }
}
