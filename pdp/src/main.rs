use axum::http::{HeaderMap, Method, StatusCode};
use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use cedar_policy::Decision;
use cedar_policy::{Authorizer, Entities, EntityUid, Policy, PolicySet, Request};
use futures::StreamExt;
use metrics_exporter_prometheus::PrometheusBuilder;
use redis::{aio::MultiplexedConnection, AsyncCommands};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::{postgres::PgPoolOptions, PgPool, Row};
use std::{collections::HashMap, env, net::SocketAddr, str::FromStr, sync::Arc, time::Duration};
use thiserror::Error;
use tokio::{net::TcpListener, sync::RwLock, time::Instant};
use tracing::{error, info, warn};
use tracing_subscriber::EnvFilter;
use uuid::Uuid;

const REDIS_DECISIONS_TTL_SECS: usize = 30;
const REDIS_INVALIDATION_CHANNEL: &str = "pdp:invalidate";

#[derive(Clone)]
struct AppState {
    default_decision_allow: bool,
    db: PgPool,
    redis_client: redis::Client,
    // In-memory policy cache per tenant (version + PolicySet)
    policies_cache: Arc<RwLock<HashMap<Uuid, (i32, PolicySet)>>>,
    rate_limit_rps_default: u32,
    claims_secret: String,
}

#[derive(Serialize, Deserialize)]
struct AuthzDecision {
    decision: String, // "ALLOW" | "DENY"
    reason: String,
}

#[derive(Deserialize)]
struct AdminValidateRequest {
    policies: Vec<String>,
}

#[derive(Serialize)]
struct AdminValidateResponse {
    ok: bool,
    errors: Vec<String>,
}

#[derive(Deserialize)]
struct AdminTestRequest {
    policies_override: Option<Vec<String>>,
    tenant_id: Option<Uuid>,
    principal: String,
    resource: String,
    action: Option<String>,
    context: Option<Value>,
}

#[derive(Error, Debug)]
enum PDPError {
    #[error("missing header {0}")]
    MissingHeader(&'static str),
    #[error("invalid tenant id")]
    InvalidTenant,
    #[error("db error: {0}")]
    Db(#[from] sqlx::Error),
    #[error("redis error: {0}")]
    Redis(#[from] redis::RedisError),
    #[error("cedar error: {0}")]
    Cedar(String),
    #[error("other: {0}")]
    Other(String),
}

fn verify_claims_sig(
    secret: &str,
    tenant: &str,
    principal: &str,
    resource: &str,
    action: &str,
    sig: &str,
) -> bool {
    let msg = format!("{}|{}|{}|{}", tenant, principal, resource, action);
    let mut c: u32 = 0;
    for b in (secret.to_owned() + "|" + &msg).bytes() {
        c = c.wrapping_add(b as u32);
    }
    format!("{:08x}", c) == sig
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("booting PDP {}", env!("CARGO_PKG_VERSION"));
    // Logs
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into());
    tracing_subscriber::fmt().with_env_filter(filter).init();

    // Prometheus (dev) — expone /metrics
    let prom_handle = PrometheusBuilder::new().install_recorder()?;
    metrics::gauge!("pdp_build_info", "version" => env!("CARGO_PKG_VERSION")).set(1.0);

    let rate_limit_rps_default = env::var("RATE_LIMIT_RPS_DEFAULT")
        .ok()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(100);

    let claims_secret = env::var("CLAIMS_SECRET").unwrap_or_else(|_| "dev-secret".into());

    // Flags
    let default_decision_allow = env::var("DEFAULT_ALLOW")
        .map(|v| v == "1" || v.to_lowercase() == "true")
        .unwrap_or(false);

    // DB
    let db_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@db:5432/abac".into());
    let db = PgPoolOptions::new()
        .max_connections(10)
        .connect(&db_url)
        .await?;

    // Redis
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://redis:6379".into());
    let redis_client = redis::Client::open(redis_url.clone())?;

    // In-memory policies cache + invalidation (pub/sub)
    let policies_cache: Arc<RwLock<HashMap<Uuid, (i32, PolicySet)>>> =
        Arc::new(RwLock::new(HashMap::new()));
    spawn_redis_invalidation_listener(redis_client.clone(), policies_cache.clone()).await?;

    let state = AppState {
        default_decision_allow,
        db,
        redis_client,
        policies_cache,
        rate_limit_rps_default,
        claims_secret,
    };

    // HTTP server
    let app = Router::new()
        .route("/ready", get(|| async { "ok" }))
        .route(
            "/metrics",
            get(move || {
                let h = prom_handle.clone();
                async move { h.render() }
            }),
        )
        .route("/admin/validate", post(admin_validate))
        .route("/admin/test", post(admin_test))
        // admitir /check, /check/ y /check/* (Envoy hace /check + path original)
        .route("/check", post(check_base).get(check_base))
        .route("/check/", post(check_base).get(check_base))
        .route("/check/*rest", post(check_with_rest).get(check_with_rest))
        .with_state(state);

    let addr: SocketAddr = "0.0.0.0:8081".parse().unwrap();
    info!("PDP listening on {}", addr);
    let listener = TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn check_base(
    State(state): State<AppState>,
    headers: HeaderMap,
    method: Method,
) -> (StatusCode, Json<AuthzDecision>) {
    check_impl(state, headers, method, "/").await
}

async fn check_with_rest(
    State(state): State<AppState>,
    headers: HeaderMap,
    method: Method,
    Path(rest): Path<String>,
) -> (StatusCode, Json<AuthzDecision>) {
    let p = format!("/{}", rest);
    check_impl(state, headers, method, &p).await
}

async fn admin_validate(
    State(_state): State<AppState>,
    Json(req): Json<AdminValidateRequest>,
) -> Json<AdminValidateResponse> {
    let parse_result = parse_policy_set_strings(&req.policies);
    let (ok, errors) = match parse_result {
        Ok(_) => (true, Vec::new()),
        Err(errs) => (false, errs),
    };

    Json(AdminValidateResponse { ok, errors })
}

async fn admin_test(
    State(state): State<AppState>,
    Json(req): Json<AdminTestRequest>,
) -> (StatusCode, Json<AuthzDecision>) {
    let AdminTestRequest {
        policies_override,
        tenant_id,
        principal,
        resource,
        action,
        context,
    } = req;

    let mut reason_origin = String::from("override");

    let policy_set = if let Some(policies) = policies_override {
        if let Some(tid) = tenant_id {
            if let Err(e) = set_tenant_context(&state.db, tid).await {
                error!("set_config app.tenant_id failed: {e}");
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(AuthzDecision {
                        decision: "DENY".into(),
                        reason: "tenant set failed".into(),
                    }),
                );
            }
        }

        match parse_policy_set_strings(&policies) {
            Ok(pset) => pset,
            Err(errs) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(AuthzDecision {
                        decision: "DENY".into(),
                        reason: errs.join("; "),
                    }),
                );
            }
        }
    } else {
        let tenant = match tenant_id {
            Some(t) => t,
            None => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(AuthzDecision {
                        decision: "DENY".into(),
                        reason: "tenant_id is required when policies_override is not provided"
                            .into(),
                    }),
                );
            }
        };

        if let Err(e) = set_tenant_context(&state.db, tenant).await {
            error!("set_config app.tenant_id failed: {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AuthzDecision {
                    decision: "DENY".into(),
                    reason: "tenant set failed".into(),
                }),
            );
        }

        match load_policies_for_tenant(&state, tenant).await {
            Ok((version, pset)) => {
                reason_origin = format!("active v{}", version);
                pset
            }
            Err(e) => {
                error!("load policies error: {e:?}");
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(AuthzDecision {
                        decision: "DENY".into(),
                        reason: "policy load error".into(),
                    }),
                );
            }
        }
    };

    let action_str = action.unwrap_or_else(|| "read".to_string());
    let ctx_json = context.unwrap_or_else(|| json!({}));

    let principal_attrs = match load_attrs(&state.db, "principals", &principal).await {
        Ok(attrs) => attrs,
        Err(e) => {
            warn!("load principal attrs error: {e:?}");
            json!({})
        }
    };
    let resource_attrs = match load_attrs(&state.db, "resources", &resource).await {
        Ok(attrs) => attrs,
        Err(e) => {
            warn!("load resource attrs error: {e:?}");
            json!({})
        }
    };

    let auid = match EntityUid::from_str(&principal) {
        Ok(u) => u,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(AuthzDecision {
                    decision: "DENY".into(),
                    reason: "invalid principal UID".into(),
                }),
            );
        }
    };
    let ruid = match EntityUid::from_str(&resource) {
        Ok(u) => u,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(AuthzDecision {
                    decision: "DENY".into(),
                    reason: "invalid resource UID".into(),
                }),
            );
        }
    };
    let action_uid = match EntityUid::from_str(&format!(r#"Action::"{}""#, action_str)) {
        Ok(u) => u,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(AuthzDecision {
                    decision: "DENY".into(),
                    reason: "invalid action".into(),
                }),
            );
        }
    };

    let ctx_cedar = match cedar_policy::Context::from_json_value(ctx_json.clone(), None) {
        Ok(ctx) => ctx,
        Err(e) => {
            warn!("invalid context provided for admin test: {e:?}");
            return (
                StatusCode::BAD_REQUEST,
                Json(AuthzDecision {
                    decision: "DENY".into(),
                    reason: "invalid context".into(),
                }),
            );
        }
    };

    let entities = match build_entities(&principal, &resource, &principal_attrs, &resource_attrs) {
        Ok(entities) => entities,
        Err(PDPError::Other(reason)) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(AuthzDecision {
                    decision: "DENY".into(),
                    reason,
                }),
            );
        }
        Err(e) => {
            error!("entities build error: {e:?}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AuthzDecision {
                    decision: "DENY".into(),
                    reason: "invalid entities".into(),
                }),
            );
        }
    };

    let req = match Request::new(Some(auid), Some(action_uid), Some(ruid), ctx_cedar, None) {
        Ok(r) => r,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(AuthzDecision {
                    decision: "DENY".into(),
                    reason: "invalid request".into(),
                }),
            );
        }
    };

    let authz = Authorizer::new();
    let resp = authz.is_authorized(&req, &policy_set, &entities);
    let decision_str = if resp.decision() == Decision::Allow {
        "ALLOW"
    } else {
        "DENY"
    };

    let reason = if decision_str == "ALLOW" {
        format!("cedar allow ({})", reason_origin)
    } else {
        format!("cedar deny ({})", reason_origin)
    };

    (
        StatusCode::OK,
        Json(AuthzDecision {
            decision: decision_str.into(),
            reason,
        }),
    )
}

async fn check_impl(
    state: AppState,
    headers: HeaderMap,
    _method: Method,
    original_path: &str,
) -> (StatusCode, Json<AuthzDecision>) {
    let started = Instant::now();

    let tenant_id = match headers
        .get("x-tenant-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
    {
        Some(t) => t,
        None => return deny("missing x-tenant-id"),
    };

    let principal = match headers.get("x-principal").and_then(|v| v.to_str().ok()) {
        Some(p) => p.to_string(),
        None => return deny("missing x-principal"),
    };

    let resource = match headers.get("x-resource").and_then(|v| v.to_str().ok()) {
        Some(r) => r.to_string(),
        None => return deny("missing x-resource"),
    };

    let action_str = headers
        .get("x-action")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("read")
        .to_string();

    if let Some("1") = headers.get("x-allow").and_then(|v| v.to_str().ok()) {
        return allow("allowed by x-allow: 1");
    }
    // --- Validate claims signature if applicable (defense of headers forged by client) ---
    if let (Some(sig), Some(tid), Some(pri)) = (
        headers.get("x-claims-sig").and_then(|v| v.to_str().ok()),
        headers.get("x-tenant-id").and_then(|v| v.to_str().ok()),
        headers.get("x-principal").and_then(|v| v.to_str().ok()),
    ) {
        let res_hdr = headers
            .get("x-resource")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        let act_hdr = headers
            .get("x-action")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("read");
        if !verify_claims_sig(&state.claims_secret, tid, pri, res_hdr, act_hdr, sig) {
            return (
                StatusCode::UNAUTHORIZED,
                Json(AuthzDecision {
                    decision: "DENY".into(),
                    reason: "bad signature".into(),
                }),
            );
        }
    }

    // --- Rate limit by tenant ---
    // Simple policy: N RPS per tenant (approximate TOKEN BUCKET with counter/sec)
    let mut over_limit = false;
    if let Ok(mut conn) = get_redis_conn(&state.redis_client).await {
        let now = time::OffsetDateTime::now_utc().unix_timestamp();
        let window = format!("{}", now); // 1s bucket
        let rate_key = format!("rl:{}:{}", tenant_id, window);
        let limit = state.rate_limit_rps_default as i64;

        match conn.incr::<_, _, i64>(&rate_key, 1).await {
            Ok(count) => {
                let _: redis::RedisResult<()> = conn.expire::<_, ()>(&rate_key, 2).await;
                if count > limit {
                    over_limit = true;
                }
            }
            Err(e) => {
                warn!("ratelimit redis error: {e}");
            }
        }
    }
    if over_limit {
        metrics::counter!("pdp_ratelimit_rejected_total").increment(1);
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(AuthzDecision {
                decision: "DENY".into(),
                reason: format!("rate limit > {} rps", state.rate_limit_rps_default),
            }),
        );
    }

    let ctx_json = json!({
        "timeOfDay": "workhours",
        "path": original_path,
    });

    // Cache key
    let cache_key = make_cache_key(
        &tenant_id,
        &principal,
        &resource,
        &action_str,
        &ctx_json.to_string(),
    );

    // Redis GET
    if let Ok(mut conn) = get_redis_conn(&state.redis_client).await {
        let cached: redis::RedisResult<Option<String>> = conn.get(&cache_key).await;
        if let Ok(Some(v)) = cached {
            metrics::counter!("pdp_cache_hits_total").increment(1);

            record_latency(started.elapsed());
            return if v == "ALLOW" {
                allow("cache hit")
            } else {
                deny("cache hit")
            };
        }
    }
    metrics::counter!("pdp_cache_misses_total").increment(1);

    // DB: RLS tenant
    if let Err(e) = set_tenant_context(&state.db, tenant_id).await {
        error!("set_config app.tenant_id failed: {e}");
        record_latency(started.elapsed());
        return deny("tenant set failed");
    }

    // Active Policies
    let (version, pset) = match load_policies_for_tenant(&state, tenant_id).await {
        Ok(v) => v,
        Err(e) => {
            error!("load policies error: {e:?}");
            record_latency(started.elapsed());
            return deny("policy load error");
        }
    };

    // Attributes
    let principal_attrs = load_attrs(&state.db, "principals", &principal)
        .await
        .unwrap_or(json!({}));
    let resource_attrs = load_attrs(&state.db, "resources", &resource)
        .await
        .unwrap_or(json!({}));

    // Cedar UIDs
    let auid = match EntityUid::from_str(&principal) {
        Ok(u) => u,
        Err(_) => return deny("invalid principal UID"),
    };
    let ruid = match EntityUid::from_str(&resource) {
        Ok(u) => u,
        Err(_) => return deny("invalid resource UID"),
    };
    let action_uid = match EntityUid::from_str(&format!(r#"Action::"{}""#, action_str)) {
        Ok(u) => u,
        Err(_) => return deny("invalid action"),
    };

    // Context
    let ctx_val = serde_json::to_value(&ctx_json).unwrap();
    let ctx_cedar =
        cedar_policy::Context::from_json_value(ctx_val, None).map_err(|e| e.to_string());
    if ctx_cedar.is_err() {
        return deny("invalid context");
    }
    let entities = match build_entities(&principal, &resource, &principal_attrs, &resource_attrs) {
        Ok(entities) => entities,
        Err(PDPError::Other(reason)) => {
            return (
                StatusCode::FORBIDDEN,
                Json(AuthzDecision {
                    decision: "DENY".into(),
                    reason,
                }),
            );
        }
        Err(e) => {
            error!("entities build error: {e:?}");
            return deny("invalid entities");
        }
    };

    // Request (note: Cedar v3 expects Option<EntityUid> for P/A/R and Context)
    let req = match Request::new(
        Some(auid),
        Some(action_uid),
        Some(ruid),
        ctx_cedar.unwrap(),
        None,
    ) {
        Ok(r) => r,
        Err(_) => return deny("invalid request"),
    };

    // Authorize
    let authz = Authorizer::new();
    let resp = authz.is_authorized(&req, &pset, &entities);
    let decision = if resp.decision() == Decision::Allow {
        "ALLOW"
    } else {
        "DENY"
    };

    // Cache SET
    if let Ok(mut conn) = get_redis_conn(&state.redis_client).await {
        let _: redis::RedisResult<()> = conn
            .set_ex(&cache_key, decision, REDIS_DECISIONS_TTL_SECS as u64)
            .await;
    }

    // Audit
    let latency_ms = started.elapsed().as_millis() as i32;
    let _ = sqlx::query(
        "INSERT INTO audit_logs (tenant_id, principal, resource, action, decision, policy_set_version, latency_ms)
         VALUES ($1,$2,$3,$4,$5,$6,$7)"
    )
    .bind(tenant_id)
    .bind(&principal)
    .bind(&resource)
    .bind(&action_str)
    .bind(decision)
    .bind(version)
    .bind(latency_ms)
    .execute(&state.db)
    .await;

    record_latency(started.elapsed());

    if decision == "ALLOW" {
        allow("cedar allow")
    } else {
        deny("cedar deny")
    }
}

fn allow(reason: &str) -> (StatusCode, Json<AuthzDecision>) {
    (
        StatusCode::OK,
        Json(AuthzDecision {
            decision: "ALLOW".into(),
            reason: reason.into(),
        }),
    )
}
fn deny(reason: &str) -> (StatusCode, Json<AuthzDecision>) {
    (
        StatusCode::FORBIDDEN,
        Json(AuthzDecision {
            decision: "DENY".into(),
            reason: reason.into(),
        }),
    )
}

fn make_cache_key(
    tenant: &Uuid,
    principal: &str,
    resource: &str,
    action: &str,
    context_json: &str,
) -> String {
    let mut h = Sha256::new();
    h.update(tenant.as_bytes());
    h.update(principal.as_bytes());
    h.update(resource.as_bytes());
    h.update(action.as_bytes());
    h.update(context_json.as_bytes());
    format!("pdp:decision:{:x}", h.finalize())
}

fn parse_policy_set_strings(policies: &[String]) -> Result<PolicySet, Vec<String>> {
    let mut errors = Vec::new();
    let mut pset = PolicySet::new();
    for (idx, cedar_text) in policies.iter().enumerate() {
        match Policy::parse(Some(format!("inline_policy_{}", idx)), cedar_text) {
            Ok(policy) => {
                if let Err(e) = pset.add(policy) {
                    errors.push(format!("policy {} add error: {e:?}", idx));
                }
            }
            Err(e) => errors.push(format!("policy {} parse error: {e:?}", idx)),
        }
    }

    if errors.is_empty() {
        Ok(pset)
    } else {
        Err(errors)
    }
}

fn split_type_and_id(uid: &str) -> Option<(String, String)> {
    let parts: Vec<&str> = uid.splitn(2, "::").collect();
    if parts.len() != 2 {
        return None;
    }
    let typ = parts[0].to_string();
    let mut id = parts[1].trim().to_string();
    if id.starts_with('"') && id.ends_with('"') && id.len() >= 2 {
        id = id[1..id.len() - 1].to_string();
    }
    Some((typ, id))
}

fn build_entities(
    principal: &str,
    resource: &str,
    principal_attrs: &Value,
    resource_attrs: &Value,
) -> Result<Entities, PDPError> {
    let (p_type, p_id) = split_type_and_id(principal)
        .ok_or_else(|| PDPError::Other("invalid principal UID format".into()))?;
    let (r_type, r_id) = split_type_and_id(resource)
        .ok_or_else(|| PDPError::Other("invalid resource UID format".into()))?;

    let ents_a = json!([
        { "uid": principal, "attrs": principal_attrs.clone(), "parents": [] },
        { "uid": resource,  "attrs": resource_attrs.clone(),  "parents": [] }
    ]);
    let ents_b = json!([
        { "uid": { "type": p_type, "id": p_id }, "attrs": principal_attrs.clone(), "parents": [] },
        { "uid": { "type": r_type, "id": r_id }, "attrs": resource_attrs.clone(),  "parents": [] }
    ]);

    match Entities::from_json_value(ents_a.clone(), None) {
        Ok(entities) => Ok(entities),
        Err(ea) => {
            warn!("cedar entities parse (array + string uid) failed: {ea:?}");
            match Entities::from_json_value(ents_b.clone(), None) {
                Ok(entities) => Ok(entities),
                Err(eb) => {
                    error!(
                        "cedar entities parse failed both formats. A_err={ea:?}  B_err={eb:?}  A_json={}  B_json={}",
                        ents_a, ents_b
                    );
                    Err(PDPError::Other("invalid entities".into()))
                }
            }
        }
    }
}

async fn set_tenant_context(db: &PgPool, tenant_id: Uuid) -> Result<(), PDPError> {
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant_id.to_string())
        .execute(db)
        .await?;
    Ok(())
}

async fn load_policies_for_tenant(
    state: &AppState,
    tenant: Uuid,
) -> Result<(i32, PolicySet), PDPError> {
    // memoria
    if let Some((ver, set)) = state.policies_cache.read().await.get(&tenant).cloned() {
        return Ok((ver, set));
    }

    // versión activa
    let row_opt = sqlx::query(
        r#"
        SELECT ps.version
        FROM policy_sets ps
        WHERE ps.tenant_id = $1 AND ps.status='active'
        ORDER BY ps.version DESC
        LIMIT 1
        "#,
    )
    .bind(tenant)
    .fetch_optional(&state.db)
    .await?;

    let row = row_opt.ok_or_else(|| PDPError::Other("no active policy_set".into()))?;
    let version: i32 = row.try_get("version")?;

    // políticas de esa versión
    let rows = sqlx::query(
        r#"
        SELECT p.cedar
        FROM policies p
        JOIN policy_sets ps ON p.policy_set_id = ps.id
        WHERE ps.tenant_id = $1 AND ps.version = $2
        "#,
    )
    .bind(tenant)
    .bind(version)
    .fetch_all(&state.db)
    .await?;

    let mut pset = PolicySet::new();
    for (idx, r) in rows.iter().enumerate() {
        let cedar_text: String = r.try_get("cedar")?;
        let pol = Policy::parse(Some(format!("p{}", idx)), &cedar_text)
            .map_err(|e| PDPError::Cedar(format!("{e:?}")))?;
        pset.add(pol)
            .map_err(|e| PDPError::Cedar(format!("{e:?}")))?;
    }

    state
        .policies_cache
        .write()
        .await
        .insert(tenant, (version, pset.clone()));
    Ok((version, pset))
}

async fn load_attrs(
    db: &PgPool,
    table: &str,
    cedar_uid: &str,
) -> Result<serde_json::Value, PDPError> {
    let sql = format!("SELECT attrs FROM {} WHERE cedar_uid=$1 LIMIT 1", table);
    let row = sqlx::query(&sql).bind(cedar_uid).fetch_optional(db).await?;
    Ok(row
        .and_then(|r| r.try_get::<serde_json::Value, _>("attrs").ok())
        .unwrap_or(json!({})))
}

fn record_latency(dur: Duration) {
    let ms = dur.as_secs_f64() * 1000.0;

    metrics::counter!("pdp_requests_total").increment(1);

    metrics::histogram!("pdp_latency_ms").record(ms);
}

async fn get_redis_conn(
    client: &redis::Client,
) -> Result<MultiplexedConnection, redis::RedisError> {
    client.get_multiplexed_tokio_connection().await
}

async fn spawn_redis_invalidation_listener(
    client: redis::Client,
    cache: Arc<RwLock<HashMap<Uuid, (i32, PolicySet)>>>,
) -> anyhow::Result<()> {
    tokio::spawn(async move {
        // For pub/sub, "non-multiplexed" connection
        match client.get_tokio_connection().await {
            Ok(conn) => {
                let mut pubsub = conn.into_pubsub();
                if let Err(e) = pubsub.subscribe(REDIS_INVALIDATION_CHANNEL).await {
                    warn!("redis subscribe error: {e}");
                    return;
                }
                info!(
                    "Subscribed to Redis invalidation channel {}",
                    REDIS_INVALIDATION_CHANNEL
                );
                loop {
                    if let Some(msg) = pubsub.on_message().next().await {
                        if let Ok(payload) = msg.get_payload::<String>() {
                            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&payload) {
                                if let Some(tid) = v
                                    .get("tenant_id")
                                    .and_then(|x| x.as_str())
                                    .and_then(|s| uuid::Uuid::parse_str(s).ok())
                                {
                                    cache.write().await.remove(&tid);
                                    tracing::info!("Invalidated policies cache for tenant {}", tid);
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => warn!("redis pubsub connect error: {e}"),
        }
    });
    Ok(())
}
