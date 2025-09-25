# 🛡️ ABAC Platform — Envoy + PDP (Cedar) + Redis + Postgres

![status](https://img.shields.io/badge/status-Hardening-blue) ![envoy](https://img.shields.io/badge/proxy-Envoy-0a7cff) ![rust](https://img.shields.io/badge/lang-Rust-DEA584) ![redis](https://img.shields.io/badge/cache-Redis-d82c20) ![postgres](https://img.shields.io/badge/db-Postgres-336791) ![license](https://img.shields.io/badge/license-MIT-black)

ABAC authorization using **Envoy ext_authz (HTTP)** in front of a Node demo app, a **Rust PDP** (Cedar policies), **Postgres** (policies & attributes), **Redis** (cache-aside + pub/sub), and **Prometheus** metrics.

## Table of Contents

* [TL;DR](#tldr)
* [✨ Features](#-features)
* [🚀 Quickstart](#-quickstart)
* [🏗️ Architecture](#-architecture)
* [🔑 Authentication (Dev: JWT HS256)](#-authentication-dev-jwt-hs256)
* [📜 Policies with Cedar](#-policies-with-cedar)
* [📈 Metrics (Prometheus)](#-metrics-prometheus)
* [⚙️ Config](#-config)
* [📂 Repo Structure](#-repo-structure)
* [🛠️ Advanced Ops](#️-advanced-ops)

---

## TL;DR

```bash
# Start everything
cd infra && docker compose up --build -d && cd ..

# Mint a dev token (HS256) if you want generate see OPS.md
TOKEN=$(SECRET=dev-very-secret ./scripts/mint_jwt_hs256.sh)

# Protected route (expected 403 until you add a policy)
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8080/

# Insert a PERMIT policy (see Policies), invalidate cache, test again → 200
```

---

## ✨ Features

* 🔐 **Envoy** protects everything except `/public/**`
* 🔸 **JWT required** on protected routes (HS256 for dev)
* 🧠 **PDP** with **Cedar** (policies/entities/context) + audit logs
* ⚡ **Redis** cache-aside (TTL + invalidation via Pub/Sub)
* 📊 **Prometheus** at `/metrics`
* 🗃️ **Tenant RLS** via `set_config('app.tenant_id', ...)`
* 🧪 **k6** smoke/load with JWT
* 🧯 **Fail-closed** default; **ext_authz timeout = 100 ms**

---

## 🚀 Quickstart

**Requirements:** Docker + Docker Compose.

```bash
cd infra
docker compose up --build

# Health checks
curl -s localhost:8081/ready             # PDP → "ok"
curl -i localhost:8080/public/health     # App via Envoy (public)
```

## 🏗️ Architecture

```
client → Envoy ──(JWT)──▶ [jwt_authn] ─▶ [Lua derives headers] ──(ext_authz)──▶ PDP (Rust/Cedar)
            │                                                    ├─ Postgres (policies, attrs, audit)
            └───────────────────────────────────────────────────▶ App (Node demo)
                                                                 └─ Redis (cache & pub/sub invalidation)
```

**How Envoy passes data to PDP (derived from JWT claims):**

* `x-tenant-id` ← `tid`
* `x-principal` ← `sub`
* `x-resource`  ← `res`
* `x-action`    ← `act`
  *(the client never sets these headers directly)*

---

## 🔑 Authentication (Dev: JWT HS256)

Envoy validates JWT using:

* `iss = https://auth.local/`
* `aud = pdp.example.local`
* **HS256** with shared secret `dev-very-secret` (dev only)

### Mint a token

Use `scripts/mint_jwt_hs256.sh` (it signs with `SECRET`).

Claims set by the script:

* `iss`, `aud`
* `sub` (**principal**), e.g. `User::"123"`
* `tid` (**tenant UUID**)
* `res` (**resource**), e.g. `Document::"abc"`
* `act` (**action**), e.g. `read`
* `iat`, `exp`

```bash
# Dev token
TOKEN=$(SECRET=dev-very-secret ./scripts/mint_jwt_hs256.sh)

# Protected route
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8080/
# → 200 if Cedar allows; 403 if Cedar denies
```

Invalid token examples:

```bash
# Bad issuer
ISS="bad" ./scripts/mint_jwt_hs256.sh | xargs -I{} curl -i -H "Authorization: Bearer {}" http://localhost:8080/
# → 401 Jwt issuer is not configured

# Wrong secret (signature invalid)
BAD=$(SECRET=wrong-secret ./scripts/mint_jwt_hs256.sh)
curl -i -H "Authorization: Bearer $BAD" http://localhost:8080/
# → 401 Unauthorized
```
## 📜 Policies with Cedar

Dev Postgres credentials:

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=abac
```

Enable a policy set and add a PERMIT:

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

**Invalidate policy cache & (optional) clear decision cache:**

```bash
# Invalidate in-memory policy cache in PDP
cd infra
docker compose exec redis redis-cli PUBLISH \
  pdp:invalidate '{"tenant_id":"11111111-1111-1111-1111-111111111111"}'

# (Optional) Clear Redis decisions to avoid waiting TTL (30s)
docker compose exec redis redis-cli FLUSHALL
```

**Test with JWT:**

```bash
cd ..
TOKEN=$(SECRET=dev-very-secret ./scripts/mint_jwt_hs256.sh)
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8080/
# → 200 OK (ALLOW), or 403 (DENY) depending on policy
```

**Hot policy changes (example remove ALLOW):**

```sql
DELETE FROM policies USING policy_sets ps
WHERE policies.policy_set_id = ps.id
  AND ps.tenant_id = '11111111-1111-1111-1111-111111111111'
  AND ps.version = 1;
```

Then invalidate & (optionally) clear decisions.

---

## 📈 Metrics (Prometheus)

Exposed by PDP at `/metrics`:

* `pdp_requests_total` (counter)
* `pdp_latency_ms` (histogram)
* `pdp_cache_hits_total`, `pdp_cache_misses_total` (counters)
* `pdp_ratelimit_rejected_total` (counter; if rate-limit enabled)

```bash
curl -s localhost:8081/metrics | egrep 'pdp_cache_(hits|misses)_total|pdp_latency_ms|pdp_ratelimit_rejected_total' | head
```

**Decision cache (Redis):**

* Key: `pdp:decision:{sha256(tenant|principal|resource|action|context)}`
* TTL: **30s** (configurable)
* Invalidation channel: `pdp:invalidate` with payload:

  ```json
  { "tenant_id": "11111111-1111-1111-1111-111111111111" }
  ```

---

## ⚙️ Config

**Defaults:**

* **Fail-closed**: `failure_mode_allow: false` in `ext_authz`
* **Timeouts**: `ext_authz` **100 ms**, retries **0**
* **Public routes**: `/public/**` bypasses `jwt_authn` & `ext_authz`
* **SLO (dev)**: p95 **< 8 ms** with warm cache; monthly 99.9% success

**Environment knobs (where to change):**

* `SECRET`, `ISS`, `AUD` → Envoy/JWT config & scripts
* Cache TTLs, Redis host → PDP config/env
* Postgres DSN → PDP config/env
* Rate-limit toggle/thresholds → PDP or Envoy filter (if enabled)
* Ports: Envoy `:8080`, PDP `:8081`

**Validate Envoy config:**

```bash
docker run --rm -v "$PWD/envoy.yaml:/etc/envoy/envoy.yaml:ro" \
  envoyproxy/envoy:v1.31-latest \
  envoy --mode validate -c /etc/envoy/envoy.yaml
```

## 📂 Repo Structure

```text
.
├─ infra/            # docker-compose, envoy.yaml, grafana/prom
├─ pdp/              # Rust PDP (Cedar, Redis, Postgres)
├─ examples/app/              # Node demo app
├─ k6/               # authz_smoke_jwt.js and helpers
├─ scripts/          # mint_jwt_hs256.sh, utilities
└─ README.md
```

## 🛠️ Advanced Ops

The comprehensive **Operational Guide** (end-to-end checks, fail-closed with PDP down, chaos scenarios, rate-limit tests, k6 smoke/load, fuzzing, troubleshooting) lives in:

**➡️ [`OPS.md`](OPS.md)**