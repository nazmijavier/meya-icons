# Tests

End-to-end checks for the website and the scripts that deploy it. Nothing here is published: the Worker serves `docs/` only.

| File | What it checks |
| --- | --- |
| `login.test.mjs` | The Pro login and Pro icons end to end in a real browser: Polar email-code and license-key login (against a stand-in Polar), copying Pro SVGs, the daily re-check, tampered cookies, the Origin check, phones, the offer banner. With `SITE=workerd` it runs the real Worker under `wrangler dev` (Cloudflare's runtime) and also checks clean URLs, 404s, HSTS and that repository files are not served. |
| `pricing.test.mjs` | The pricing page at 1440, 375 and 360 px in USD and Rupiah: no build placeholders, one currency at a time, no horizontal scroll, the seat maths, the style gallery, the phone buy bar. Writes screenshots. |
| `serve.mjs` | The stand-ins both use: the site (Node, or the Worker under `wrangler dev`), a fake Polar and a fake GitHub contents API that reads `../meya-icons-pro`. |
| `cloudflare/*.test.mjs` | `scripts/cloudflare.mjs` (prepare, secrets, status, cutover, rollback) against a stand-in Cloudflare API, and `scripts/handoff.mjs` (sealed secrets) against stand-in GitHub and Polar. |

Run from the repository root:

```bash
npm ci --prefix .github/deploy          # the pinned wrangler, for SITE=workerd
npm i --no-save playwright && npx playwright install chromium

node tests/login.test.mjs /tmp/shots                 # site in Node
SITE=workerd node tests/login.test.mjs /tmp/shots    # the real Worker under wrangler dev
node tests/pricing.test.mjs /tmp/shots
for t in tests/cloudflare/*.test.mjs; do node "$t"; done
```

`login.test.mjs` needs the private Pro folder next to this repository (`../meya-icons-pro`, or `MEYA_PRO=<path>`). Playwright can also come from another folder (`PWDIR=<folder with node_modules/playwright>`) with your own browser (`CHROMIUM_PATH`). The tests use ports 4100, 4200, 4300 and 4700-4811.
