#!/bin/bash
# Cobot AI - Infrastructure Setup
# Run once to create all Cloudflare resources, then update wrangler.jsonc with the IDs.

set -e

echo "Cobot AI Setup"
echo "=================="
echo ""

if ! command -v wrangler &> /dev/null; then
    echo "Error: wrangler not found. Install: npm install -g wrangler"
    exit 1
fi

echo "Checking authentication..."
wrangler whoami || { echo "Not logged in. Run: wrangler login"; exit 1; }
echo ""

echo "[1/5] Creating KV namespaces..."
echo "  TENANT_REGISTRY:"
wrangler kv namespace create TENANT_REGISTRY 2>&1 | grep -E 'id|already' || true
echo ""
echo "  TELEGRAM_ROUTING:"
wrangler kv namespace create TELEGRAM_ROUTING 2>&1 | grep -E 'id|already' || true
echo ""
echo "  BOT_ROUTING:"
wrangler kv namespace create BOT_ROUTING 2>&1 | grep -E 'id|already' || true
echo ""
echo "  CONVERSATIONS (shared by tenant Workers):"
wrangler kv namespace create CONVERSATIONS 2>&1 | grep -E 'id|already' || true
echo ""

echo "[2/5] Creating D1 database..."
wrangler d1 create cobot-usage 2>&1 | grep -E 'database_id|already' || true
echo ""

echo "[3/5] Applying D1 schema..."
wrangler d1 execute cobot-usage --file=schema.sql --remote 2>&1 || echo "  (may need --remote flag or already applied)"
echo ""

echo "[4/5] Skipping R2/Queue (not needed for v2)"
echo ""

echo "[5/5] Done!"
echo ""
echo "Next steps:"
echo ""
echo "1. Copy the KV namespace IDs and D1 database ID into wrangler.jsonc"
echo "   (replace all PLACEHOLDER_ values)"
echo ""
echo "2. Set secrets:"
echo "   wrangler secret put OPENAI_API_KEY"
echo "   wrangler secret put CF_API_TOKEN"
echo "   wrangler secret put CF_ACCOUNT_ID"
echo "   wrangler secret put PLATFORM_SECRET"
echo "   wrangler secret put ADMIN_TOKEN"
echo ""
echo "3. Deploy: npm run deploy"
echo ""
