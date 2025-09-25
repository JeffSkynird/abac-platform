use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use axum::http::{HeaderMap, Method, StatusCode};
use cedar_policy::{
    Authorizer, Entities, EntityUid, Policy, PolicySet, Request,
};
use metrics_exporter_prometheus::PrometheusBuilder;
use redis::{aio::MultiplexedConnection, AsyncCommands};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use sqlx::{postgres::PgPoolOptions, PgPool, Row};
use std::{collections::HashMap, env, net::SocketAddr, str::FromStr, sync::Arc, time::Duration};
use thiserror::Error;
use tokio::{net::TcpListener, sync::RwLock, time::Instant};
use tracing::{error, info, warn};
use tracing_subscriber::EnvFilter;
use uuid::Uuid;
use futures::StreamExt;
use cedar_policy::Decision;

const REDIS_DECISIONS_TTL_SECS: usize = 30;
const REDIS_INVALIDATION_CHANNEL: &str = "pdp:invalidate";

#[derive(Clone)]
struct AppState {
    default_decision_allow: bool,
    db: PgPool,
    redis_client: redis::Client,
    // cache de políticas en memoria por tenant (version + PolicySet)
    policies_cache: Arc<RwLock<HashMap<Uuid, (i32, PolicySet)>>>,
}

#[derive(Serialize, Deserialize)]
struct AuthzDecision {
    decision: String, // "ALLOW" | "DENY"
    reason: String,
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

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("booting PDP {}", env!("CARGO_PKG_VERSION"));
    // Logs
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into());
    tracing_subscriber::fmt().with_env_filter(filter).init();

    // Prometheus (dev) — expone /metrics
    let prom_handle = PrometheusBuilder::new().install_recorder()?;
    metrics::gauge!("pdp_build_info", "version" => env!("CARGO_PKG_VERSION")).set(1.0);



    // Flags
    let default_decision_allow = env::var("DEFAULT_ALLOW")
        .map(|v| v == "1" || v.to_lowercase() == "true")
        .unwrap_or(false);

    // DB
    let db_url =
        env::var("DATABASE_URL").unwrap_or_else(|_| "postgres://postgres:postgres@db:5432/abac".into());
    let db = PgPoolOptions::new()
        .max_connections(10)
        .connect(&db_url)
        .await?;

    // Redis
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://redis:6379".into());
    let redis_client = redis::Client::open(redis_url.clone())?;

    // In-memory policies cache + invalidation (pub/sub)
    let policies_cache: Arc<RwLock<HashMap<Uuid, (i32, PolicySet)>>> = Arc::new(RwLock::new(HashMap::new()));
    spawn_redis_invalidation_listener(redis_client.clone(), policies_cache.clone()).await?;

    let state = AppState {
        default_decision_allow,
        db,
        redis_client,
        policies_cache,
    };

    // HTTP server
    let app = Router::new()
        .route("/ready", get(|| async { "ok" }))
        .route("/metrics", get(move || {
            let h = prom_handle.clone();
            async move { h.render() }
        }))
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

async fn check_base(State(state): State<AppState>, headers: HeaderMap, method: Method) -> (StatusCode, Json<AuthzDecision>) {
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

async fn check_impl(
    state: AppState,
    headers: HeaderMap,
    _method: Method,
    original_path: &str,
) -> (StatusCode, Json<AuthzDecision>) {
    let started = Instant::now();

    // Headers mínimos (temporal en MVP)
    let tenant_id = match headers.get("x-tenant-id").and_then(|v| v.to_str().ok()).and_then(|s| Uuid::parse_str(s).ok())
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

    // Puente de demo (como Fase 0)
    if let Some("1") = headers.get("x-allow").and_then(|v| v.to_str().ok()) {
        return allow("allowed by x-allow: 1");
    }

    // Contexto (MVP: fijo)
    let ctx_json = json!({
        "timeOfDay": "workhours",
        "path": original_path,
    });

    // Cache key
    let cache_key = make_cache_key(&tenant_id, &principal, &resource, &action_str, &ctx_json.to_string());

    // Redis GET
    if let Ok(mut conn) = get_redis_conn(&state.redis_client).await {
        let cached: redis::RedisResult<Option<String>> = conn.get(&cache_key).await;
        if let Ok(Some(v)) = cached {
            metrics::counter!("pdp_cache_hits_total").increment(1);


            record_latency(started.elapsed());
            return if v == "ALLOW" { allow("cache hit") } else { deny("cache hit") };
        }
    }
    metrics::counter!("pdp_cache_misses_total").increment(1);

    // DB: RLS tenant
    if let Err(e) = sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
    .bind(tenant_id.to_string())   // set_config espera text
    .execute(&state.db)
    .await
    {
        error!("set_config app.tenant_id failed: {e}");
        record_latency(started.elapsed());
        return deny("tenant set failed");
    }

    // Policies activas
    let (version, pset) = match load_policies_for_tenant(&state, tenant_id).await {
        Ok(v) => v,
        Err(e) => {
            error!("load policies error: {e:?}");
            record_latency(started.elapsed());
            return deny("policy load error");
        }
    };

    // Atributos
    let principal_attrs = load_attrs(&state.db, "principals", &principal).await.unwrap_or(json!({}));
    let resource_attrs = load_attrs(&state.db, "resources", &resource).await.unwrap_or(json!({}));

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
    let ctx_cedar = cedar_policy::Context::from_json_value(ctx_val, None).map_err(|e| e.to_string());
    if ctx_cedar.is_err() {
        return deny("invalid context");
    }

    // --- Helpers para construir las entidades en dos formatos ---
    // --- Helpers para partir Type::"id" ---
    fn split_type_and_id(uid: &str) -> Option<(String, String)> {
        let parts: Vec<&str> = uid.splitn(2, "::").collect();
        if parts.len() != 2 { return None; }
        let typ = parts[0].to_string();
        let mut id = parts[1].trim().to_string(); // "\"123\""
        if id.starts_with('"') && id.ends_with('"') && id.len() >= 2 {
            id = id[1..id.len()-1].to_string();
        }
        Some((typ, id))
    }

    let (p_type, p_id) = match split_type_and_id(&principal) {
        Some(x) => x,
        None => return deny("invalid principal UID format"),
    };
    let (r_type, r_id) = match split_type_and_id(&resource) {
        Some(x) => x,
        None => return deny("invalid resource UID format"),
    };

    // ✅ Formato A (array) con uid STRING
    let ents_a = json!([
        { "uid": principal, "attrs": principal_attrs, "parents": [] },
        { "uid": resource,  "attrs": resource_attrs,  "parents": [] }
    ]);

    // ✅ Formato B (array) con uid OBJETO {type,id}
    let ents_b = json!([
        { "uid": { "type": p_type, "id": p_id }, "attrs": principal_attrs, "parents": [] },
        { "uid": { "type": r_type, "id": r_id }, "attrs": resource_attrs,  "parents": [] }
    ]);

    // Parse con fallback y logs
    let entities_opt = match Entities::from_json_value(ents_a.clone(), None) {
        Ok(e) => Some(e),
        Err(ea) => {
            tracing::warn!("cedar entities parse (array + string uid) failed: {ea:?}");
            match Entities::from_json_value(ents_b.clone(), None) {
                Ok(e) => Some(e),
                Err(eb) => {
                    tracing::error!(
                        "cedar entities parse failed both formats. A_err={ea:?}  B_err={eb:?}  A_json={}  B_json={}",
                        ents_a, ents_b
                    );
                    None
                }
            }
        }
    };

    let Some(entities) = entities_opt else {
        return deny("invalid entities");
    };



    // Request (nota: Cedar v3 espera Option<EntityUid> para P/A/R y Context)
    let req = match Request::new(Some(auid), Some(action_uid), Some(ruid), ctx_cedar.unwrap(), None) {
        Ok(r)  => r,
        Err(_) => return deny("invalid request"),
    };

    // Autorizar
    let authz = Authorizer::new();
    let resp = authz.is_authorized(&req, &pset, &entities);
    let decision = if resp.decision() == Decision::Allow { "ALLOW" } else { "DENY" };

    // Cache SET
    if let Ok(mut conn) = get_redis_conn(&state.redis_client).await {
        let _ : redis::RedisResult<()> = conn.set_ex(&cache_key, decision, REDIS_DECISIONS_TTL_SECS as u64).await;
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

    if decision == "ALLOW" { allow("cedar allow") } else { deny("cedar deny") }
}

fn allow(reason: &str) -> (StatusCode, Json<AuthzDecision>) {
    (StatusCode::OK, Json(AuthzDecision{ decision: "ALLOW".into(), reason: reason.into() }))
}
fn deny(reason: &str) -> (StatusCode, Json<AuthzDecision>) {
    (StatusCode::FORBIDDEN, Json(AuthzDecision{ decision: "DENY".into(), reason: reason.into() }))
}

fn make_cache_key(tenant: &Uuid, principal: &str, resource: &str, action: &str, context_json: &str) -> String {
    let mut h = Sha256::new();
    h.update(tenant.as_bytes());
    h.update(principal.as_bytes());
    h.update(resource.as_bytes());
    h.update(action.as_bytes());
    h.update(context_json.as_bytes());
    format!("pdp:decision:{:x}", h.finalize())
}

async fn load_policies_for_tenant(state: &AppState, tenant: Uuid) -> Result<(i32, PolicySet), PDPError> {
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
        "#
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
        "#
    )
    .bind(tenant)
    .bind(version)
    .fetch_all(&state.db)
    .await?;

    let mut pset = PolicySet::new();
    for (idx, r) in rows.iter().enumerate() {
        let cedar_text: String = r.try_get("cedar")?;
        // Cedar v3: Policy::parse(id: Option<String>, src: &str)
        let pol = Policy::parse(Some(format!("p{}", idx)), &cedar_text)
            .map_err(|e| PDPError::Cedar(format!("{e:?}")))?;
        pset.add(pol).map_err(|e| PDPError::Cedar(format!("{e:?}")))?;
    }

    state.policies_cache.write().await.insert(tenant, (version, pset.clone()));
    Ok((version, pset))
}

async fn load_attrs(db: &PgPool, table: &str, cedar_uid: &str) -> Result<serde_json::Value, PDPError> {
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

async fn get_redis_conn(client: &redis::Client) -> Result<MultiplexedConnection, redis::RedisError> {
    client.get_multiplexed_tokio_connection().await
}

async fn spawn_redis_invalidation_listener(
    client: redis::Client,
    cache: Arc<RwLock<HashMap<Uuid, (i32, PolicySet)>>>,
) -> anyhow::Result<()> {
    tokio::spawn(async move {
        // Para pub/sub, usamos una conexión "no multiplexada"
       match client.get_tokio_connection().await {
            Ok(conn) => {
                let mut pubsub = conn.into_pubsub();
                if let Err(e) = pubsub.subscribe(REDIS_INVALIDATION_CHANNEL).await {
                    warn!("redis subscribe error: {e}");
                    return;
                }
                info!("Subscribed to Redis invalidation channel {}", REDIS_INVALIDATION_CHANNEL);
                loop {
                    // on_message() devuelve un Stream; NO se await-ea directo.
                    if let Some(msg) = pubsub.on_message().next().await {
                        // NO uses `if let Ok(payload): Result<...>` -> usa turbofish
                        if let Ok(payload) = msg.get_payload::<String>() {
                            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&payload) {
                                if let Some(tid) = v.get("tenant_id")
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
