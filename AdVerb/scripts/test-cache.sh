#!/usr/bin/env bash
# End-to-end check: FAISS + Redis creative cache via Next.js /api/ad.
# Requires: UI on :3000, creative-cache on :8001, decision-engine on :8080 (e.g. docker compose up).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_FILE="${SCRIPT_DIR}/cache-test-payload.json"

UI_BASE="${UI_BASE:-http://localhost:3000}"
CACHE_BASE="${CREATIVE_CACHE_URL:-http://localhost:8001}"
DECISION_BASE="${DECISION_ENGINE_URL:-http://localhost:8080}"

echo "=== Creative-cache health (before) ==="
curl -sS "${CACHE_BASE}/health"
echo

echo ""
echo "=== Decision engine /health ==="
curl -sS "${DECISION_BASE}/health"
echo

echo ""
echo "=== POST ${UI_BASE}/api/ad — request A (MISS only on cold cache / empty index) ==="
curl -sS -X POST "${UI_BASE}/api/ad" \
  -H "Content-Type: application/json" \
  -d "@${PAYLOAD_FILE}" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
lat = d.get('latency') or {}
print('cacheStatus:', d.get('cacheStatus'))
print('faissCacheHit:', lat.get('faissCacheHit'))
print('faissSearchMs:', lat.get('faissSearchMs'))
print('totalMs:', lat.get('totalMs'))
"

echo ""
echo "=== POST ${UI_BASE}/api/ad — request B same body (expect HIT when cache warm) ==="
curl -sS -X POST "${UI_BASE}/api/ad" \
  -H "Content-Type: application/json" \
  -d "@${PAYLOAD_FILE}" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
lat = d.get('latency') or {}
print('cacheStatus:', d.get('cacheStatus'))
print('faissCacheHit:', lat.get('faissCacheHit'))
print('faissSearchMs:', lat.get('faissSearchMs'))
print('totalMs:', lat.get('totalMs'))
"

echo ""
echo "=== Creative-cache health (after — index_vectors should be >= 1) ==="
curl -sS "${CACHE_BASE}/health"
echo
echo ""
echo "Done. For stricter neighbor matching, lower SIMILARITY_THRESHOLD on the creative-cache service."
