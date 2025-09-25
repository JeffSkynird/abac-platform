
# 🛡️ ABAC Platform — Envoy + PDP (Cedar) + Redis + Postgres

![status](https://img.shields.io/badge/status-MVP-green) ![envoy](https://img.shields.io/badge/proxy-Envoy-0a7cff) ![rust](https://img.shields.io/badge/lang-Rust-DEA584) ![redis](https://img.shields.io/badge/cache-Redis-d82c20) ![postgres](https://img.shields.io/badge/db-Postgres-336791) ![license](https://img.shields.io/badge/license-MIT-black)

**ABAC** authorization with **Envoy ext_authz (HTTP)** in front of a Node demo app, a **Rust PDP** (Cedar policies), **Postgres** (policies + attributes), **Redis** (cache-aside + pub/sub), and **Prometheus** metrics.

---

## ✨ Features

* 🔐 **Envoy** protects everything except `/public/**`
* 🧠 **PDP** with **Cedar** (policies, entities, context)
* ⚡ **Redis** cache-aside (TTL + invalidation via Pub/Sub)
* 📊 **Prometheus** at `/metrics`
* 🗃️ **Tenant RLS** via `set_config('app.tenant_id', ...)`
* 🧪 **k6** smoke & load authorization tests

---

## 🏗️ Architecture

```
client → Envoy ─(ext_authz)→ PDP (Rust/Cedar)
            │                 ├─ Postgres (policies, attrs, audit)
            └───────────────→ App (Node demo)
                              └─ Redis (cache & pub/sub invalidation)
```

---

## 🚀 Quickstart

> Requirements: Docker + Docker Compose.

```bash
cd infra
docker compose up --build

curl -s localhost:8081/ready                # PDP
curl -i localhost:8080/public/health        # App across Envoy
```

**Protected route (DENY by default without policy):**

```bash
curl -i \
  -H 'x-tenant-id: 11111111-1111-1111-1111-111111111111' \
  -H 'x-principal: User::"123"' \
  -H 'x-resource:  Document::"abc"' \
  -H 'x-action:    read' \
  localhost:8080/
```

**Temporary bypass (dev only):**

```bash
curl -i \
  -H 'x-tenant-id: 11111111-1111-1111-1111-111111111111' \
  -H 'x-principal: User::"123"' \
  -H 'x-resource:  Document::"abc"' \
  -H 'x-action:    read' \
  -H 'x-allow: 1' \
  localhost:8080/
```

---

## 🧩 AuthZ Headers (MVP)

* `x-tenant-id` → tenant **UUID**
* `x-principal` → Cedar UID (e.g. `User::"123"`)
* `x-resource`  → Cedar UID (e.g. `Document::"abc"`)
* `x-action`    → action (e.g. `read`)
* `x-allow`     → **dev only** (`1` = ALLOW bridge)

---

## 📜 Insert a Policy (permit)
To access you can use the following credentials (in next features im going to include .env)
- POSTGRES_PASSWORD=postgres
- POSTGRES_USER=postgres
- POSTGRES_DB=abac

```sql
INSERT INTO policy_sets (tenant_id, version, status)
VALUES ('11111111-1111-1111-1111-111111111111', 1, 'active')
ON CONFLICT (tenant_id, version) DO NOTHING;

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

**Invalidate cache & test:**

```bash
docker compose exec redis redis-cli PUBLISH pdp:invalidate '{"tenant_id":"11111111-1111-1111-1111-111111111111"}'
docker compose exec redis redis-cli FLUSHALL   # optional, clears DECISIONS

curl -i \
  -H 'x-tenant-id: 11111111-1111-1111-1111-111111111111' \
  -H 'x-principal: User::"123"' \
  -H 'x-resource:  Document::"abc"' \
  -H 'x-action:    read' \
  localhost:8080/
```

---

## 🧰 PDP Endpoints

* `GET /ready` → `"ok"`
* `GET /metrics` → Prometheus exposition
* `POST|GET /check` and `/check/*` → used by Envoy **ext_authz**

---

## 📈 Metrics (Prometheus)

* `pdp_requests_total` (counter)
* `pdp_latency_ms` (histogram)
* `pdp_cache_hits_total` (counter)
* `pdp_cache_misses_total` (counter)

```bash
curl -s localhost:8081/metrics | head -n 50
```

---

## 🧪 k6 (smoke & load)

File: `k6/authz_smoke.js` (thresholds ignore expected 403s; uses `authz_*_ok`).

**Local host:**

```bash
BASE=http://localhost:8080/ \
TENANT_ID=11111111-1111-1111-1111-111111111111 \
VUS=20 DURATION=30s VUS_DENY=10 DURATION_DENY=30s \
k6 run k6/authz_smoke.js
```

**Docker (Linux) hitting host:**

```bash
docker run --rm -i \
  --add-host=host.docker.internal:host-gateway \
  -e BASE=http://host.docker.internal:8080/ \
  -e TENANT_ID=11111111-1111-1111-1111-111111111111 \
  -e VUS=20 -e DURATION=30s \
  -e VUS_DENY=10 -e DURATION_DENY=30s \
  -v "$PWD/k6:/scripts" grafana/k6 run /scripts/authz_smoke.js
```

**Docker on Compose network (recommended):**

```bash
docker run --rm -i --network infra_default \
  -e BASE=http://envoy:8080/ \
  -e TENANT_ID=11111111-1111-1111-1111-111111111111 \
  -e VUS=20 -e DURATION=30s \
  -e VUS_DENY=10 -e DURATION_DENY=30s \
  -v "$PWD/k6:/scripts" grafana/k6 run /scripts/authz_smoke.js
```

---

## 🗄️ Schema (summary)

* `tenants(id uuid, ...)`
* `policy_sets(id pk, tenant_id uuid, version int, status text)`
* `policies(id pk, policy_set_id fk, cedar text)`
* `principals(cedar_uid text, attrs jsonb)`
* `resources(cedar_uid text, attrs jsonb)`
* `audit_logs(tenant_id, principal, resource, action, decision, policy_set_version, latency_ms, created_at)`

> **RLS:** PDP runs `SELECT set_config('app.tenant_id', $1, true)` before reads; your schema can leverage it in RLS policies.

---

## 🧠 Redis cache-aside

* **Key:** `pdp:decision:{sha256(tenant|principal|resource|action|context)}`
* **TTL:** 30s (configure)
* **Invalidation (policies):** channel `pdp:invalidate` with payload:

  ```json
  { "tenant_id": "11111111-1111-1111-1111-111111111111" }
  ```

---

## 🎯 SLOs (MVP)

* p95 < **10ms** with **≥80% hit ratio**
* p99 < **25ms**
* error rate < **0.1%**

---

## 🧰 Troubleshooting

### Envoy returns 404 at `/`

* Check access log.
* Ensure routes: `public-route` (prefix `/public`), `root-exact` (path `/`), `protected-route` (prefix `/`).

### `policy load error` / Cedar parse

* Don’t escape with `\"...\"`. Use dollar-quoting `$$ ... $$` and UIDs `Type::"id"`.

### TTL vs invalidation

* Pub/Sub clears **policy cache in memory**; **decisions** remain until TTL or `FLUSHALL`.

### Docker build “silent” / dummy binary

* Rebuild without cache: `docker compose build --no-cache pdp && docker compose up pdp`.