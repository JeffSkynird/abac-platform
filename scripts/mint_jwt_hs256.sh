#!/usr/bin/env bash
set -euo pipefail

# Defaults (override via env)
SECRET="${SECRET:-dev-very-secret}"
ISS="${ISS:-https://auth.local/}"
AUD="${AUD:-pdp.example.local}"
SUB='User::"123"'
TID='11111111-1111-1111-1111-111111111111'
RES='Document::"abc"'
ACT='read'

NOW=$(date +%s); EXP=$((NOW+3600))  # token valid for 1 hour

# base64url (no padding)
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

HEADER='{"alg":"HS256","typ":"JWT","kid":"dev"}'
PAYLOAD=$(jq -c -n --arg iss "$ISS" --arg aud "$AUD" \
  --arg sub "$SUB" --arg tid "$TID" --arg res "$RES" --arg act "$ACT" \
  --argjson iat "$NOW" --argjson exp "$EXP" \
  '{iss:$iss,aud:$aud,sub:$sub,tid:$tid,res:$res,act:$act,iat:$iat,exp:$exp}')

P1=$(printf '%s' "$HEADER"  | b64url)
P2=$(printf '%s' "$PAYLOAD" | b64url)
SIG=$(printf '%s' "$P1.$P2" \
  | openssl dgst -sha256 -mac HMAC -macopt "key:$SECRET" -binary | b64url)

echo "$P1.$P2.$SIG"