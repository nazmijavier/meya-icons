// Small helpers shared by the functions. Each function takes a Web Request and returns a Response: the signature
// Cloudflare Workers run (through worker.js) and Vercel runs from api/.
export function json(status, body, headers = new Headers()) {
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "private, no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

export async function body(request) {
  try {
    const b = await request.json();
    return b && typeof b === "object" ? b : {};
  } catch {
    return {};
  }
}
