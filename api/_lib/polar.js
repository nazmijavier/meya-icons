// Calls to Polar. Settings come from Vercel environment variables:
//   POLAR_ORG_ID          the organization's id (Polar > Settings > General)
//   POLAR_PRO_BENEFIT_ID  the id of the "Meya Icons Pro" benefit attached to the Pro product
//   POLAR_ACCESS_TOKEN    an organization access token with the benefits:read scope (daily re-check)
//   POLAR_API_URL         optional, https://sandbox-api.polar.sh to test against Polar's sandbox
export const API = () => (process.env.POLAR_API_URL || "https://api.polar.sh").replace(/\/$/, "");
export const ORG = () => process.env.POLAR_ORG_ID || "";
export const BENEFIT = () => process.env.POLAR_PRO_BENEFIT_ID || "";
export const configured = () => !!(ORG() && BENEFIT() && (process.env.SESSION_SECRET || "").length >= 32);

async function call(path, { token, method = "GET", body } = {}) {
  const r = await fetch(API() + path, {
    method,
    headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const json = await r.json().catch(() => null);
  return { status: r.status, json };
}

// A customer-portal token (from the email-code login) → the person, if they hold the Pro benefit.
export async function whoHoldsPro(token) {
  const user = await call("/v1/customer-portal/customer-session/user", { token });
  if (user.status === 401 || user.status === 403) return { error: "invalid" };
  if (user.status !== 200 || !user.json) throw new Error(`Polar user lookup failed (${user.status})`);
  const grants = await call(`/v1/customer-portal/benefit-grants/?benefit_id=${encodeURIComponent(BENEFIT())}&limit=10`, { token });
  if (grants.status !== 200 || !grants.json) throw new Error(`Polar grants lookup failed (${grants.status})`);
  const who = { email: user.json.email, customer_id: user.json.customer_id, member_id: user.json.member_id || null };
  // a member token lists only that member's grants; the benefit id ties it to this organization
  const held = (grants.json.items || []).some((g) => g.is_granted && g.benefit_id === BENEFIT() && (!who.member_id || !g.member_id || g.member_id === who.member_id));
  return held ? { who } : { error: "no_pro", who };
}

// A license key from the Pro benefit → the person, if the key is granted. Public endpoint, no token needed.
export async function licenseHolder(key) {
  const r = await call("/v1/customer-portal/license-keys/validate", { method: "POST", body: { key, organization_id: ORG(), benefit_id: BENEFIT() } });
  if (r.status === 404 || r.status === 422) return { error: "invalid" };
  if (r.status !== 200 || !r.json) throw new Error(`Polar license check failed (${r.status})`);
  if (r.json.status !== "granted") return { error: "invalid" };
  return { who: { email: r.json.customer?.email || "", customer_id: r.json.customer_id, member_id: r.json.member_id || null } };
}

// Daily re-check with the organization token: does this member (or customer) still hold the Pro benefit?
export async function proGrantedTo({ member_id, customer_id }) {
  const q = member_id ? `member_id=${encodeURIComponent(member_id)}` : `customer_id=${encodeURIComponent(customer_id)}`;
  const r = await call(`/v1/benefits/${encodeURIComponent(BENEFIT())}/grants?is_granted=true&limit=1&${q}`, { token: process.env.POLAR_ACCESS_TOKEN });
  if (r.status !== 200 || !r.json) throw new Error(`Polar re-check failed (${r.status})`);
  return (r.json.items || []).length > 0;
}
