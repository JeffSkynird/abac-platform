-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Policy sets 
CREATE TABLE IF NOT EXISTS policy_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active|draft
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, version)
);

-- Policies (Cedar text)
CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_set_id UUID NOT NULL REFERENCES policy_sets(id) ON DELETE CASCADE,
  cedar TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Principals and resources (free metadata and attributes)
CREATE TABLE IF NOT EXISTS principals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cedar_uid TEXT NOT NULL, -- ej: User::"123"
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, cedar_uid)
);

CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cedar_uid TEXT NOT NULL, -- ej: Document::"abc"
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, cedar_uid)
);

-- Additional attributes (optional by granularity)
CREATE TABLE IF NOT EXISTS attributes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'principal'|'resource'
  entity_uid  TEXT NOT NULL, -- Cedar UID
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type, entity_uid, key)
);

-- Audit (append-only)
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  principal TEXT NOT NULL,
  resource  TEXT NOT NULL,
  action    TEXT NOT NULL,
  decision  TEXT NOT NULL,   -- ALLOW|DENY
  policy_set_version INT,
  latency_ms INT NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_principals_tenant_uid ON principals(tenant_id, cedar_uid);
CREATE INDEX IF NOT EXISTS idx_resources_tenant_uid  ON resources(tenant_id, cedar_uid);
CREATE INDEX IF NOT EXISTS idx_attributes_lookup     ON attributes(tenant_id, entity_type, entity_uid, key);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_ts       ON audit_logs(tenant_id, ts);

-- RLS by tenant
ALTER TABLE policy_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE principals ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY ps_rls ON policy_sets
USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY p_rls  ON policies
USING (policy_set_id IN (SELECT id FROM policy_sets WHERE tenant_id = current_setting('app.tenant_id', true)::uuid));
CREATE POLICY princ_rls ON principals
USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY res_rls ON resources
USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY attr_rls ON attributes
USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY audit_rls ON audit_logs
USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Demo seed: 1 tenant, 1 policy_set v1 with a simple ABAC policy
INSERT INTO tenants (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'demo-tenant')
ON CONFLICT DO NOTHING;

INSERT INTO policy_sets (tenant_id, version, status)
VALUES ('11111111-1111-1111-1111-111111111111', 1, 'active')
ON CONFLICT DO NOTHING;

WITH ps AS (
  SELECT id FROM policy_sets WHERE tenant_id='11111111-1111-1111-1111-111111111111' AND version=1
)
INSERT INTO policies (policy_set_id, cedar)
SELECT ps.id, $cedar$
permit(
  principal in User::"any",
  action in [Action::"read", Action::"list"],
  resource in Document::"any"
) when {
  principal.department == resource.department &&
  context.timeOfDay in ["workhours"]
};
$cedar$
FROM ps
ON CONFLICT DO NOTHING;

-- Example of entities
INSERT INTO principals (tenant_id, cedar_uid, attrs)
VALUES ('11111111-1111-1111-1111-111111111111', 'User::"123"', '{"department":"sales"}')
ON CONFLICT DO NOTHING;

INSERT INTO resources (tenant_id, cedar_uid, attrs)
VALUES ('11111111-1111-1111-1111-111111111111', 'Document::"abc"', '{"department":"sales"}')
ON CONFLICT DO NOTHING;
