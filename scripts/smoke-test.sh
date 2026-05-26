#!/bin/bash
# SigOS Smoke Test Suite
# Tests auth gates (401 on protected endpoints) and public routes (200/other expected)
# Usage: bash scripts/smoke-test.sh [--verbose]

BASE="http://localhost:3200"
PASS=0
FAIL=0
VERBOSE=false

[[ "$1" == "--verbose" ]] && VERBOSE=true

# GET check — simple form.
check_get() {
  local label="$1"
  local url="$2"
  local expected="$3"

  actual=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)

  if [[ "$actual" == "$expected" ]]; then
    PASS=$((PASS+1))
    $VERBOSE && echo "  PASS [$actual] $label"
  else
    FAIL=$((FAIL+1))
    echo "  FAIL [$actual != $expected] $label ($url)"
  fi
}

# POST check — curl args passed as a bash array so quoted strings survive word-splitting.
# Usage: check_post LABEL URL EXPECTED [extra curl args...]
check_post() {
  local label="$1"
  local url="$2"
  local expected="$3"
  shift 3
  local extra_args=("$@")

  actual=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" "${extra_args[@]}" "$url" 2>/dev/null)

  if [[ "$actual" == "$expected" ]]; then
    PASS=$((PASS+1))
    $VERBOSE && echo "  PASS [$actual] $label"
  else
    FAIL=$((FAIL+1))
    echo "  FAIL [$actual != $expected] $label ($url)"
  fi
}

echo "=== SigOS Smoke Tests ==="
echo "Target: $BASE"
echo ""

echo "--- Auth gates (expect 401) ---"
check_get "GET /api/dashboard"                "$BASE/api/dashboard"                401
check_get "GET /api/dashboard/va"             "$BASE/api/dashboard/va"             401
check_get "GET /api/leads"                    "$BASE/api/leads"                    401
check_get "GET /api/deals"                    "$BASE/api/deals"                    401
check_get "GET /api/contacts"                 "$BASE/api/contacts"                 401
check_get "GET /api/accounts"                 "$BASE/api/accounts"                 401
check_get "GET /api/quotes"                   "$BASE/api/quotes"                   401
check_get "GET /api/tasks"                    "$BASE/api/tasks"                    401
check_get "GET /api/activities"               "$BASE/api/activities"               401
check_get "GET /api/calendar"                 "$BASE/api/calendar"                 401
check_get "GET /api/emails"                   "$BASE/api/emails"                   401
check_get "GET /api/emails/mailboxes"         "$BASE/api/emails/mailboxes"         401
check_get "GET /api/email-templates"          "$BASE/api/email-templates"          401
check_get "GET /api/fireflies"                "$BASE/api/fireflies"                401
check_get "GET /api/notifications"            "$BASE/api/notifications"            401
check_get "GET /api/users"                    "$BASE/api/users"                    401
check_get "GET /api/sites"                    "$BASE/api/sites"                    401
check_get "GET /api/cadence"                  "$BASE/api/cadence"                  401
check_get "GET /api/growth"                   "$BASE/api/growth"                   401
check_get "GET /api/time-tracking/status"     "$BASE/api/time-tracking/status"     401
check_get "GET /api/cold-calling/stats"       "$BASE/api/cold-calling/stats"       401
check_get "GET /api/cold-calling/feed"        "$BASE/api/cold-calling/feed"        401

echo ""
echo "--- POST CSRF gates (expect 403 when Origin absent — CSRF fires before auth) ---"
# CSRF middleware rejects before auth when no Origin header is present — 403 is correct
check_post "POST /api/leads"       "$BASE/api/leads"       403
check_post "POST /api/deals"       "$BASE/api/deals"       403
check_post "POST /api/contacts"    "$BASE/api/contacts"    403
check_post "POST /api/tasks"       "$BASE/api/tasks"       403
check_post "POST /api/calendar"    "$BASE/api/calendar"    403
check_post "POST /api/sites"       "$BASE/api/sites"       403

echo ""
echo "--- Public/semi-public routes ---"
# Login page should redirect or 200
login_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/login" 2>/dev/null)
if [[ "$login_code" == "200" || "$login_code" == "307" || "$login_code" == "308" ]]; then
  PASS=$((PASS+1))
  $VERBOSE && echo "  PASS [$login_code] GET /login"
else
  FAIL=$((FAIL+1))
  echo "  FAIL [$login_code != 200/307] GET /login"
fi

# Dashboard redirects to login when unauthenticated (307)
dash_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/dashboard" 2>/dev/null)
if [[ "$dash_code" == "307" || "$dash_code" == "302" || "$dash_code" == "200" ]]; then
  PASS=$((PASS+1))
  $VERBOSE && echo "  PASS [$dash_code] GET /dashboard (redirect/200)"
else
  FAIL=$((FAIL+1))
  echo "  FAIL [$dash_code] GET /dashboard"
fi

echo ""
echo "--- App health (expect app is serving) ---"
check_post "POST /api/quotes/calculate (CSRF guard)" "$BASE/api/quotes/calculate" 403 -d "{}"

echo ""
echo "--- New: Sites/Contract routes (expect 401) ---"
check_get "GET /api/sites/[id]"           "$BASE/api/sites/test-id"           401
check_get "GET /api/sites/[id]/margin"    "$BASE/api/sites/test-id/margin"    401

echo ""
TOTAL=$((PASS+FAIL))
echo "=== Results: $PASS/$TOTAL passed ==="
if [[ $FAIL -gt 0 ]]; then
  echo "FAIL: $FAIL tests failed"
  exit 1
else
  echo "ALL PASS"
  exit 0
fi
