// Access codes: Pro without a Polar purchase (the owner's own code). PRO_ACCESS_CODES lists "label:hash" pairs,
// comma-separated, where hash is the SHA-256 (hex) of "meya-access:" and the code without dashes or spaces, in
// capitals. Only hashes are kept, so the list can sit in wrangler.jsonc: a code is a long random string that
// can't be worked back out of its hash. Remove a pair to revoke its code; its sessions end on their next request.
// A code goes in the license-key field, on the site and in the Figma plugin.
import crypto from "node:crypto";

export const accessHash = (code) =>
  crypto.createHash("sha256").update("meya-access:" + String(code).replace(/[\s-]/g, "").toUpperCase()).digest("hex");

function listed() {
  return String(process.env.PRO_ACCESS_CODES || "").split(",").map((e) => e.trim()).filter(Boolean)
    .map((e) => { const i = e.lastIndexOf(":"); return { label: e.slice(0, i), hash: e.slice(i + 1).toLowerCase() }; })
    .filter((e) => e.label && /^[0-9a-f]{64}$/.test(e.hash));
}

// The listed entry for this code, or null (hashes compared in constant time).
export function accessCode(code) {
  const h = Buffer.from(accessHash(code));
  return listed().find((e) => crypto.timingSafeEqual(h, Buffer.from(e.hash))) || null;
}

// Is the code a session was started with still listed?
export const accessListed = (label, hash) => listed().some((e) => e.label === label && e.hash === hash);
