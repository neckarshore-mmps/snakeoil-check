#!/usr/bin/env bash
# verify-deploy-prereqs.sh — live posture check for the B1 deploy-prereq surfaces.
#
# Verifies that the secret-gated endpoints on a running deployment show the
# EXPECTED security posture after the deploy-prereq env vars are set:
#
#   1. GET  /api/health                  -> 200 (deployment alive)
#   2. GET  /api/cron/purge-expired      -> 401 without bearer   (CRON_SECRET live)
#   3. GET  /api/cron/purge-expired      -> 401 with a BAD bearer
#   4. POST /api/resend/bounce-webhook   -> 503 while RESEND_WEBHOOK_SECRET is
#                                           unset (fail-closed), 401 once set
#                                           (unsigned request rejected)
#
# Diagnostic mapping (what a non-expected code means):
#   404 -> route not in the running deployment (deploy is older than the code)
#   503 on cron -> CRON_SECRET not in the running deployment (fail-closed,
#                  set the var and redeploy)
#
# Usage:
#   scripts/verify-deploy-prereqs.sh [BASE_URL]
#   BASE_URL defaults to https://snakeoil-check.vercel.app
#
# Optional live purge run (proves CRON_SECRET end-to-end, requires the secret
# in the macOS keychain as `snakeoil_cron_secret`):
#   scripts/verify-deploy-prereqs.sh --live-purge [BASE_URL]
#
# Exit code: 0 = launch-ready posture, 1 = at least one check failed.

set -euo pipefail

LIVE_PURGE=0
if [[ "${1:-}" == "--live-purge" ]]; then
  LIVE_PURGE=1
  shift
fi
BASE_URL="${1:-https://snakeoil-check.vercel.app}"

PASS=0
FAIL=0

status() {
  # status METHOD URL [curl extra args...]
  local method="$1" url="$2"
  shift 2
  curl -s -o /dev/null -w '%{http_code}' -X "$method" --max-time 15 "$@" "$url"
}

check() {
  # check LABEL ACTUAL EXPECTED [ALT_EXPECTED]
  local label="$1" actual="$2" expected="$3" alt="${4:-}"
  if [[ "$actual" == "$expected" || ( -n "$alt" && "$actual" == "$alt" ) ]]; then
    echo "PASS  $label -> $actual"
    PASS=$((PASS + 1))
  else
    echo "FAIL  $label -> $actual (expected $expected${alt:+ or $alt})"
    FAIL=$((FAIL + 1))
  fi
}

echo "== verify-deploy-prereqs @ $BASE_URL =="

check "health 200" \
  "$(status GET "$BASE_URL/api/health")" 200

check "cron purge-expired, no auth -> 401 (CRON_SECRET live; 503 = secret missing, 404 = route not deployed)" \
  "$(status GET "$BASE_URL/api/cron/purge-expired")" 401

check "cron purge-expired, bad bearer -> 401" \
  "$(status GET "$BASE_URL/api/cron/purge-expired" -H 'Authorization: Bearer not-the-secret')" 401

# 503 = RESEND_WEBHOOK_SECRET not yet set (fail-closed, acceptable pre-Resend-setup)
# 401 = secret set, unsigned request rejected (launch posture)
check "bounce-webhook, unsigned POST -> 503 (secret unset, fail-closed) or 401 (secret set)" \
  "$(status POST "$BASE_URL/api/resend/bounce-webhook" -H 'Content-Type: application/json' -d '{}')" 503 401

if [[ "$LIVE_PURGE" == "1" ]]; then
  if ! command -v security >/dev/null 2>&1; then
    echo "FAIL  --live-purge requires macOS keychain (security not found)"
    FAIL=$((FAIL + 1))
  else
    CRON_SECRET="$(security find-generic-password -s snakeoil_cron_secret -w 2>/dev/null | tr -d '\n' || true)"
    if [[ -z "$CRON_SECRET" ]]; then
      echo "FAIL  --live-purge: keychain entry snakeoil_cron_secret not found"
      FAIL=$((FAIL + 1))
    else
      check "cron purge-expired, correct bearer -> 200 (live purge run)" \
        "$(status GET "$BASE_URL/api/cron/purge-expired" -H "Authorization: Bearer $CRON_SECRET")" 200
    fi
  fi
fi

echo "== $PASS passed, $FAIL failed =="
[[ "$FAIL" == "0" ]]
