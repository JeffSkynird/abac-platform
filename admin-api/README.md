# Admin API — ABAC (NestJS + Fastify) 🔐🧱

Administrative layer (hexagonal/DDD) that orchestrates:

* 🔑 **Keycloak (OIDC)** for JWT + RBAC (`admin` / `ops`)
* 🐘 **Postgres** with **multi-tenant RLS** (via interceptor that sets `app.tenant_id`)
* 🚦 **Redis** pub/sub for PDP invalidations
* 🧠 **PDP** (endpoints `/admin/validate` and `/admin/test`) to validate and test **Cedar** policies

---

## 🚀 Quick start

```bash
# 1) Start stack (if you haven't done it)
docker compose up -d --build

# 2) Health Check
curl -s localhost:3001/health 
```

### 🔐 Get JWT from Keycloak

> Realm: `abac` · Client: `admin-api` (with **Audience** mapper → `admin-api`)

Admin (`alice-admin` / `password`)

```bash
KC=http://localhost:8085
JWT=$(curl -s -X POST "$KC/realms/abac/protocol/openid-connect/token" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_id=admin-api' \
  -d 'grant_type=password' \
  -d 'username=alice-admin' \
  -d 'password=password' | jq -r .access_token)
echo "${JWT:0:40}..."
```

Ops (`oscar-ops` / `password`)

```bash
JWTS=$(curl -s -X POST "$KC/realms/abac/protocol/openid-connect/token" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_id=admin-api' \
  -d 'grant_type=password' \
  -d 'username=oscar-ops' \
  -d 'password=password' | jq -r .access_token)
echo "${JWT:0:40}..."
```

---

## 🔌 Admin API env (now in docker-compose service:admin-api)

* `OIDC_AUDIENCE=admin-api`
* `OIDC_ISSUER=http://keycloak:8080/realms/abac`
* `OIDC_JWKS_URI=http://keycloak:8080/realms/abac/protocol/openid-connect/certs`
* `OIDC_ACCEPTED_ISSUERS=http://localhost:8085/realms/abac,http://keycloak:8080/realms/abac`
* `PDP_BASE_URL=http://pdp:8081`
* `DB_URL=postgres://postgres:postgres@db:5432/abac`
* `REDIS_URL=redis://redis:6379`

> 🔒 For non-dev, change `CLAIMS_SECRET` (PDP) and credentials.

---

## 📚 Endpoints

### 🧩 Tenants (`/api/tenants`)

* `POST /api/tenants` *(admin)* → create tenant
* `GET /api/tenants?page=&limit=` *(admin|ops)* → paginated list

### 📦 Policy Sets

* `POST /api/policy-sets` *(admin)* → create **draft** `{ tenantId, baseVersion? }`
* `GET /api/policy-sets?tenantId=…` *(admin|ops)* → list by tenant
* `POST /api/policies` *(admin)* → add Cedar policy to draft `{ policySetId, cedar }`
* `POST /api/policy-sets/:id/validate` *(admin|ops)* → validate draft (PDP proxy)
* `POST /api/policy-sets/:id/test` *(admin|ops)* → what-if against draft (override) (PDP proxy)
* `POST /api/policy-sets/test-active` *(admin|ops)* → what-if against **active** set `{ tenantId, ... }`
* `POST /api/policy-sets/:id/promote` *(admin)* → **draft → active** + Redis `pdp:invalidate`

### 👥 Entities & Attributes

* `GET /api/entities?tenantId=…&type=principal|resource&page=&limit=` *(admin|ops)*
* `POST /api/entities` *(admin)* → upsert
  `{ tenantId, type: 'principal'|'resource', cedar_uid: 'Type::"id"', attrs: {...} }`
* `GET /api/entity-attributes?tenantId=…&type=…&uid?=…` *(admin|ops)*
* `POST /api/entity-attributes` *(admin)* → upsert
  `{ tenantId, entity_type, entity_uid, key, value }`

### 🪵 Audit

* `GET /api/audit?tenantId=…&page=&limit=` *(admin|ops)* → paginated read (no PII)

---

## 🧪 cURL cheatsheet

> All calls use `Authorization: Bearer $JWT`.

### 1) Create tenant

```bash
curl -s -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"name":"t1"}' http://localhost:3001/api/tenants | jq
```

### 2) List tenants

```bash
curl -s -H "Authorization: Bearer $JWT" \
  "http://localhost:3001/api/tenants?page=1&limit=50" | jq
```

### 3) Create Policy Set draft

```bash
TENANT_ID="<tenant-uuid>"
DRAFT=$(curl -s -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"$TENANT_ID\"}" http://localhost:3001/api/policy-sets)
DRAFT_ID=$(echo "$DRAFT" | jq -r .id)
echo "$DRAFT_ID"
```

### 4) Add Cedar policy to draft

```bash
curl -s -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d "{\"policySetId\":\"$DRAFT_ID\",\"cedar\":\"permit(principal == User::\\\"123\\\", action == Action::\\\"read\\\", resource == Document::\\\"abc\\\");\"}" \
  http://localhost:3001/api/policies | jq
```

### 5) Validate draft (syntax/policies)

```bash
curl -s -H "Authorization: Bearer $JWT" -X POST \
  http://localhost:3001/api/policy-sets/$DRAFT_ID/validate | jq
```

### 6) Test “what-if” on draft (override)

```bash
curl -s -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"principal":{"type":"User","id":"123"},"resource":{"type":"Document","id":"abc"},"action":"read"}' \
  http://localhost:3001/api/policy-sets/$DRAFT_ID/test | jq
```

### 7) Promote draft → active

```bash
curl -s -H "Authorization: Bearer $JWT" -X POST \
  http://localhost:3001/api/policy-sets/$DRAFT_ID/promote | jq
```

### 8) Test against **active** policies

```bash
curl -s -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"$TENANT_ID\",\"principal\":{\"type\":\"User\",\"id\":\"123\"},\"resource\":{\"type\":\"Document\",\"id\":\"abc\"},\"action\":\"read\"}" \
  http://localhost:3001/api/policy-sets/test-active | jq
```

### 9) Upsert Entity (attrs)

```bash
curl -s -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{
    "tenantId":"'"$TENANT_ID"'",
    "type":"principal",
    "cedar_uid":"User::\"123\"",
    "attrs":{"department":"sales","country":"EC"}
  }' http://localhost:3001/api/entities | jq
```

### 10) List Entities

```bash
curl -s -H "Authorization: Bearer $JWT" \
  "http://localhost:3001/api/entities?tenantId=$TENANT_ID&type=principal&page=1&limit=20" | jq
```

### 11) Audit (latest N) [TODO]

```bash
curl -s -H "Authorization: Bearer $JWT" \
  "http://localhost:3001/api/audit?tenantId=$TENANT_ID&page=1&limit=50" | jq
```

---

## 🧭 Design notes

* **AuthN/Z**: `RolesGuard` validates JWT and requires `roles` (`realm_access.roles`) per handler.
* **RLS per request**: `TenantInterceptor` opens a transaction and sets `app.tenant_id` (GUC) so **all** queries run in the correct tenant.
* **Repositories** (TypeORM) use `qr.manager.getRepository(...)` to run inside the request’s `QueryRunner`.
* **PDP HTTP**: Admin-API normalizes `principal/resource` to Cedar UID (`Type::"id"`) and `action` to string; it **forwards PDP status codes** (e.g., `400 invalid action`, `404/409 no active policy_set`) instead of collapsing to `500`.

---

## 🧯 Troubleshooting

* `401 Unauthorized` → check **audience** (`aud: admin-api`) and accepted **issuer**.
* `403 Forbidden` → missing role (`admin`/`ops`) or action not permitted.
* `422 Unprocessable Entity` at PDP → send `principal/resource` as Cedar UIDs (`User::"123"`, `Document::"abc"`).
* Not seeing DB inserts → repos write through the request’s `QueryRunner`; without the interceptor (and `app.tenant_id`), RLS will reject.