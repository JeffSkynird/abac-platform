# ========= Variables =========
COMPOSE := docker compose -f infra/docker-compose.yml
NETWORK ?= infra_default                # Change if your compose network name differs
TENANT  ?= 11111111-1111-1111-1111-111111111111
BASE    ?= http://localhost:8080/
BASE_PDP?= http://localhost:8081

# k6 defaults
VUS           ?= 20
DURATION      ?= 30s
VUS_DENY      ?= 10
DURATION_DENY ?= 30s

# Proto (placeholder)
PROTO_DIR ?= proto
OUT_DIR   ?= generated

# ========= Help =========
.PHONY: help
help:
	@echo "Targets:"
	@echo "  up                 - Build & start the whole stack"
	@echo "  down               - Stop and remove containers/volumes"
	@echo "  logs               - Tail logs for all services"
	@echo "  logs-<svc>         - Tail logs for a service (pdp, envoy, db, redis, app)"
	@echo "  ready              - Health checks for PDP and App"
	@echo "  seed               - Insert demo policy set + permit policy and invalidate PDP cache"
	@echo "  flush              - FLUSHALL Redis (clears decision cache)"
	@echo "  curl-allow         - Protected request expected to be 200"
	@echo "  curl-deny          - Protected request expected to be 403"
	@echo "  k6-host            - Run k6 on host (requires k6)"
	@echo "  k6-docker-host     - Run k6 in Docker hitting host (Linux: host-gateway)"
	@echo "  k6-docker-compose  - Run k6 in Docker on compose network (http://envoy:8080/)"
	@echo "  metrics            - Print first lines of PDP /metrics"
	@echo "  psql               - Open psql inside DB container"
	@echo "  redis-cli          - Open redis-cli inside Redis container"
	@echo "  proto              - (placeholder) Generate SDK from $(PROTO_DIR) to $(OUT_DIR)"

# ========= Infra =========
.PHONY: up
up:
	$(COMPOSE) up --build -d

.PHONY: down
down:
	$(COMPOSE) down -v

.PHONY: logs
logs:
	$(COMPOSE) logs -f

.PHONY: logs-%
logs-%:
	$(COMPOSE) logs -f $*

.PHONY: ready
ready:
	@curl -sf $(BASE_PDP)/ready && echo " -> PDP ready" || (echo "PDP not ready"; exit 1)
	@curl -sf $(BASE)/public/health >/dev/null && echo " -> App via Envoy ready" || (echo "App not ready"; exit 1)

# ========= DB seed (demo) =========
# Creates policy_set v1 (active) and a basic permit policy User::"123" -> read Document::"abc"
.PHONY: seed
seed:
	@echo "Seeding demo tenant/policy (tenant=$(TENANT))..."
	@$(COMPOSE) exec -T db psql -U postgres -d abac <<'SQL'
	INSERT INTO policy_sets (tenant_id, version, status)
	VALUES ('$(TENANT)', 1, 'active')
	ON CONFLICT (tenant_id, version) DO NOTHING;

	INSERT INTO policies (policy_set_id, cedar)
	SELECT ps.id, $$permit(
	  principal == User::"123",
	  action   == Action::"read",
	  resource == Document::"abc"
	);$$
	FROM policy_sets ps
	WHERE ps.tenant_id = '$(TENANT)' AND ps.version = 1
	LIMIT 1;
	SQL
	@$(COMPOSE) exec -T redis redis-cli PUBLISH pdp:invalidate '{"tenant_id":"$(TENANT)"}' >/dev/null
	@echo "Seed done and PDP policy cache invalidated."

# Optional: reset policies for v1 if you need to clean a bad insert
.PHONY: seed-reset
seed-reset:
	@$(COMPOSE) exec -T db psql -U postgres -d abac <<'SQL'
	DELETE FROM policies p
	USING policy_sets ps
	WHERE p.policy_set_id = ps.id
	  AND ps.tenant_id = '$(TENANT)'
	  AND ps.version = 1;
	SQL
	@$(COMPOSE) exec -T redis redis-cli PUBLISH pdp:invalidate '{"tenant_id":"$(TENANT)"}' >/dev/null
	@echo "Policy set v1 cleared and PDP policy cache invalidated."

.PHONY: flush
flush:
	$(COMPOSE) exec -T redis redis-cli FLUSHALL

# ========= cURL helpers =========
.PHONY: curl-allow
curl-allow:
	curl -i \
	 -H 'x-tenant-id: $(TENANT)' \
	 -H 'x-principal: User::"123"' \
	 -H 'x-resource:  Document::"abc"' \
	 -H 'x-action:    read' \
	 $(BASE)

.PHONY: curl-deny
curl-deny:
	curl -i \
	 -H 'x-tenant-id: $(TENANT)' \
	 -H 'x-principal: User::"123"' \
	 -H 'x-resource:  Document::"nope"' \
	 -H 'x-action:    read' \
	 $(BASE)

# ========= k6 =========
.PHONY: k6-host
k6-host:
	BASE=$(BASE) TENANT_ID=$(TENANT) \
	VUS=$(VUS) DURATION=$(DURATION) VUS_DENY=$(VUS_DENY) DURATION_DENY=$(DURATION_DENY) \
	k6 run k6/authz_smoke.js

# Linux: requires Docker 20.10+ for host-gateway
.PHONY: k6-docker-host
k6-docker-host:
	docker run --rm -i \
	 --add-host=host.docker.internal:host-gateway \
	 -e BASE=http://host.docker.internal:8080/ \
	 -e TENANT_ID=$(TENANT) \
	 -e VUS=$(VUS) -e DURATION=$(DURATION) \
	 -e VUS_DENY=$(VUS_DENY) -e DURATION_DENY=$(DURATION_DENY) \
	 -v "$$PWD/k6:/scripts" grafana/k6 run /scripts/authz_smoke.js

# Run k6 in the compose network, targeting 'envoy:8080'
.PHONY: k6-docker-compose
k6-docker-compose:
	docker run --rm -i --network $(NETWORK) \
	 -e BASE=http://envoy:8080/ \
	 -e TENANT_ID=$(TENANT) \
	 -e VUS=$(VUS) -e DURATION=$(DURATION) \
	 -e VUS_DENY=$(VUS_DENY) -e DURATION_DENY=$(DURATION_DENY) \
	 -v "$$PWD/k6:/scripts" grafana/k6 run /scripts/authz_smoke.js

# ========= Utilities =========
.PHONY: metrics
metrics:
	curl -s $(BASE_PDP)/metrics | head -n 50

.PHONY: psql
psql:
	$(COMPOSE) exec db psql -U postgres -d abac

.PHONY: redis-cli
redis-cli:
	$(COMPOSE) exec redis redis-cli

# ========= Proto (placeholder) =========
.PHONY: proto
proto:
	mkdir -p $(OUT_DIR)
	@echo "👉 SDK generation from $(PROTO_DIR) to $(OUT_DIR) ..."
