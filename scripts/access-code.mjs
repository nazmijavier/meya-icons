// Makes a new Pro access code (api/_lib/access.js): node scripts/access-code.mjs <label>
// Prints the code, for its holder only, and the "label:hash" pair to add to PRO_ACCESS_CODES in wrangler.jsonc
// (comma-separated). Only the pair goes in the repository; deploy, and the code opens Pro in the license-key field.
import crypto from "node:crypto";
import { accessHash } from "../api/_lib/access.js";

const label = process.argv[2];
if (!/^[a-z0-9-]+$/.test(label || "")) { console.error("usage: node scripts/access-code.mjs <label, e.g. owner>"); process.exit(2); }
// Crockford's base32 (no I, L, O or U), 20 characters: 100 random bits
const A = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const code = "MEYA-" + [...crypto.randomBytes(20)].map((b) => A[b & 31]).join("").match(/.{5}/g).join("-");
console.log(`code (give it to its holder, never commit it): ${code}`);
console.log(`PRO_ACCESS_CODES entry: ${label}:${accessHash(code)}`);
