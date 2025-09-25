# ABAC Platform — Operational Guide

End-to-end verification, daily ops checks, chaos drills, k6 load, metrics, and troubleshooting.
Stack: Envoy (ext_authz), PDP (Rust + Cedar), Postgres, Redis, Prometheus.

---

## 1) Prerequisites

* Docker & Docker Compose installed
* Ports **8080** (Envoy) and **8081** (PDP) available
* Dev JWT secret: `dev-very-secret` (dev only)
* Scripts present:
  * `scripts/mint_jwt_hs256.sh`
* Services up:
  ```bash 
  cd infra && docker compose up --build -d && cd ..
  ```

## 2) Dev JWT Minting (HS256)

Use this script to mint a **dev** JWT signed with **HS256**.
⚠️ For production use RS256/ES256 with JWKS and key rotation.

### 2.1 Prerequisites

* Shell tools: **bash**, **openssl**, **jq**

  * macOS: `brew install jq`
  * Ubuntu/Debian: `sudo apt-get install -y jq openssl`

### 2.2 Create the script

Create `scripts/mint_jwt_hs256.sh`:

```bash
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
```

Make it executable:

```bash
chmod +x scripts/mint_jwt_hs256.sh
```

### 2.3 Basic usage

```bash
# Use defaults (HS256 dev secret, 1h expiry)
TOKEN=$(./scripts/mint_jwt_hs256.sh)

# Call a protected route
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8080/
```

## 3) Handy Environment Exports

```bash
export SECRET=dev-very-secret
export ISS=https://auth.local/
export AUD=pdp.example.local
export TENANT_ID=11111111-1111-1111-1111-111111111111

# Dev token
export TOKEN=$(SECRET=$SECRET ISS=$ISS AUD=$AUD ./scripts/mint_jwt_hs256.sh)
```

---

## 4) Quick End-to-End Checks

### 4.1 Health

```bash
curl -s localhost:8081/ready          # PDP → "ok"
curl -i localhost:8080/public/health  # Envoy/App → 200
```

### 4.2 Happy Path (ALLOW when policy exists)

```bash
# Without a policy you’ll typically see 403 (DENY)
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8080/
```

### 4.3 Public routes & required JWT on protected routes

```bash
curl -i http://localhost:8080/                # 401 (jwt_authn: missing token)

# Bad issuer → 401
ISS=bad ./scripts/mint_jwt_hs256.sh | xargs -I{} \
  curl -i -H "Authorization: Bearer {}" http://localhost:8080/

# Invalid signature → 401
BAD=$(SECRET=wrong-secret ./scripts/mint_jwt_hs256.sh)
curl -i -H "Authorization: Bearer $BAD" http://localhost:8080/
```

### 4.4 ext_authz fail-closed + 100 ms timeout

```bash
cd infra && docker compose stop pdp && cd ..
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8080/
# expect: 403 (fail-closed while PDP is down)
cd infra && docker compose start pdp && cd ..
```

## 5) Policies (Cedar) & Cache

### 5.1 Dev Postgres

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=abac
```

### 5.2 Activate policy set + PERMIT

```sql
-- Enable policy set v1 for the tenant
INSERT INTO policy_sets (tenant_id, version, status)
VALUES ('11111111-1111-1111-1111-111111111111', 1, 'active')
ON CONFLICT (tenant_id, version) DO NOTHING;

-- Allow User::"123" to read Document::"abc"
INSERT INTO policies (policy_set_id, cedar)
SELECT ps.id, $$permit(
  principal == User::"123",
  action   == Action::"read",
  resource == Document::"abc"
);$$
FROM policy_sets ps
WHERE ps.tenant_id = '11111111-1111-1111-1111-111111111111'
  AND ps.version = 1
LIMIT 1;
```

### 5.3 Invalidate policy cache & (optional) clear decision cache

```bash
cd infra
# Invalidate PDP in-memory policy cache for the tenant
docker compose exec redis redis-cli PUBLISH \
  pdp:invalidate '{"tenant_id":"'"$TENANT_ID"'"}'

# (Optional) clear decision keys (TTL ≈ 30s)
docker compose exec redis redis-cli FLUSHALL
```

### 5.4 Verify

```bash
cd ..
export TOKEN=$(SECRET=$SECRET ISS=$ISS AUD=$AUD ./scripts/mint_jwt_hs256.sh)
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8080/
# expect: 200 OK (ALLOW)
```

> If `PUBSUB NUMSUB pdp:invalidate` shows `0`, PDP isn’t subscribed. Restart PDP.

---

## 6) Per-Tenant Rate Limit (optional)

```bash
seq 1 150 | xargs -n1 -P0 -I{} curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" http://localhost:8080/ | sort | uniq -c
# You should see a mix of "200" and "429" if enabled
```

Metric (if incremented by PDP):

```bash
curl -s http://localhost:8081/metrics | egrep 'pdp_ratelimit_rejected_total'
```

---

## 7) Decision Cache (Redis)

* Key: `pdp:decision:{sha256(tenant|principal|resource|action|context)}`
* TTL: **30s** (configurable)
* Policy invalidation channel: `pdp:invalidate` with payload:

  ```json
  { "tenant_id": "11111111-1111-1111-1111-111111111111" }
  ```

Quick hit/miss probe:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOKEN" http://localhost:8080/
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOKEN" http://localhost:8080/
# The 2nd call should reflect a cache hit in metrics
```

---

## 8) Chaos Drills (resilience)

### 8.1 Redis down (degrade; still authorize via DB)

```bash
cd infra && docker compose stop redis && cd ..
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8080/
# expect: 200/403 based on policy (no cache; only misses)
cd infra && docker compose start redis && cd ..
```

### 8.2 DB down (safe-deny)

```bash
cd infra && docker compose stop db && cd ..
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8080/
# expect: 403 DENY (no policies/attrs available)
cd infra && docker compose start db && cd ..
```

### 8.3 PDP down (fail-closed)

```bash
cd infra && docker compose stop pdp && cd ..
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8080/
# expect: 403 (ext_authz fail-closed)
cd infra && docker compose start pdp && cd ..
```

---

## 9) k6 — Smoke / Load (JWT)

### 9.1 Requirements

* Script: `k6/authz_smoke_jwt.js` (sends `Authorization: Bearer <TOKEN>`)
* Env vars: `BASE`, `TENANT_ID`, `SECRET`, `ISS`, `AUD`, `VUS`, `DURATION`, etc.
* Ensure to add inserts the policy to postgres to allow before smoke test. See *5.2 Activate policy set + PERMIT*    

### 9.2 Run from host

```bash
k6 run k6/authz_smoke.js \
  -e BASE=http://localhost:8080/ \
  -e TENANT_ID=$TENANT_ID \
  -e SECRET=$SECRET \
  -e ISS=$ISS \
  -e AUD=$AUD \
  -e VUS=20 -e DURATION=30s \
  -e VUS_DENY=10 -e DURATION_DENY=30s
```

### 9.3 Run inside Compose network

```bash
docker run --rm -i --network infra_default \
  -e BASE=http://envoy:8080/ \
  -e TENANT_ID=$TENANT_ID \
  -e SECRET=$SECRET -e ISS=$ISS -e AUD=$AUD \
  -e VUS=20 -e DURATION=30s -e VUS_DENY=10 -e DURATION_DENY=30s \
  -v "$PWD/k6:/scripts" grafana/k6 run /scripts/authz_smoke.js
```

> After policy changes, **publish invalidation** and optionally clear decisions or wait TTL.


## 10) Metrics

* PDP exposes Prometheus metrics at `GET /metrics`

Quick grep:

```bash
curl -s localhost:8081/metrics | egrep \
  'pdp_cache_(hits|misses)_total|pdp_latency_ms|pdp_ratelimit_rejected_total' | head
```

PromQL snippets:

```promql
# Latency p95/p99
histogram_quantile(0.95, sum by (le) (rate(pdp_latency_ms_bucket[5m])))
histogram_quantile(0.99, sum by (le) (rate(pdp_latency_ms_bucket[5m])))

# Cache hit ratio
sum(rate(pdp_cache_hits_total[5m])) 
/ (sum(rate(pdp_cache_hits_total[5m])) + sum(rate(pdp_cache_misses_total[5m])))

# Rate-limit rejects (if enabled)
rate(pdp_ratelimit_rejected_total[5m])
```


## 11) Troubleshooting

**401 `Jwt is missing` / `issuer not configured`**

* Missing `Authorization: Bearer <token>` or `iss`/`aud` mismatch
* Script must sign with the **same** secret/algorithm Envoy expects (dev)

**403 `missing x-tenant-id` / header derivation failed**

* JWT must include `tid`, `sub`, `res`, `act`
* Check Envoy access logs to confirm header derivation from claims

**403 after policy changes (`cache hit`)**

* Decision cache still valid — `FLUSHALL` or wait TTL (~30s)
* Ensure PDP received invalidation (`PUBSUB NUMSUB pdp:invalidate` → `1`)

**Validate Envoy config**

```bash
docker run --rm -v "$PWD/envoy.yaml:/etc/envoy/envoy.yaml:ro" \
  envoyproxy/envoy:v1.31-latest \
  envoy --mode validate -c /etc/envoy/envoy.yaml
```