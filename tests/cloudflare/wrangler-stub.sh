#!/bin/sh
# records what scripts/cloudflare.mjs hands to `wrangler secret bulk`
echo "$@" > "$STUB_OUT.args"; cat > "$STUB_OUT.json"; echo "stub: secrets uploaded"
