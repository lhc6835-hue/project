#!/usr/bin/env bash
# Deploy the game to https://aether-heart.pages.dev (Cloudflare Pages, advanced mode: one _worker.js holds
# every static file plus the account API). Needs CLOUDFLARE_ACCOUNT_ID and an API token with Pages access.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=$(mktemp -d)
mkdir -p "$OUT/dist"
cp -r index.html style.css manifest.webmanifest src assets "$OUT/dist/"
node tools/build-worker.mjs "$OUT/dist" "$OUT/_worker.js"
curl -sS -X POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/aether-heart/deployments" \
  ${CLOUDFLARE_API_TOKEN:+-H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"} \
  -F "manifest={}" -F "branch=main" -F "_worker.js=@$OUT/_worker.js;type=application/javascript+module;filename=_worker.js"
echo
