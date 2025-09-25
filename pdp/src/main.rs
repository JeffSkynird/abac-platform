use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use axum::http::{HeaderMap, Method, StatusCode};
use serde::{Deserialize, Serialize};
use std::{env, net::SocketAddr};
use tokio::net::TcpListener;
use tracing::info;
use tracing_subscriber::EnvFilter;

#[derive(Clone)]
struct AppState {
    default_decision_allow: bool,
}

#[derive(Serialize, Deserialize)]
struct AuthzDecision {
    decision: String, // "ALLOW" | "DENY"
    reason: String,
}

#[tokio::main]
async fn main() {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into());
    tracing_subscriber::fmt().with_env_filter(filter).init();

    let default_decision_allow = env::var("DEFAULT_ALLOW")
        .map(|v| v == "1" || v.to_lowercase() == "true")
        .unwrap_or(false);

    let state = AppState { default_decision_allow };

    let app = Router::new()
        .route("/ready", get(ready))
        // ✅ /check y /check/ y /check/*rest (Envoy do /check + original path, p.ej. "/")
        .route("/check",            post(check_base).get(check_base))
        .route("/check/",           post(check_base).get(check_base))
        .route("/check/*rest",      post(check_with_rest).get(check_with_rest))
        .with_state(state);

    let addr: SocketAddr = "0.0.0.0:8081".parse().unwrap();
    info!("PDP HTTP (ext_authz) escuchando en {}", addr);

    let listener = TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn ready() -> &'static str {
    "ok"
}

async fn check_base(
    State(state): State<AppState>,
    headers: HeaderMap,
    method: Method,
) -> (StatusCode, Json<AuthzDecision>) {
    check_common(state, headers, method, "/").await
}

async fn check_with_rest(
    State(state): State<AppState>,
    headers: HeaderMap,
    method: Method,
    Path(rest): Path<String>,
) -> (StatusCode, Json<AuthzDecision>) {
    let joined = format!("/{}", rest);
    check_common(state, headers, method, &joined).await
}

async fn check_common(
    state: AppState,
    headers: HeaderMap,
    method: Method,
    original_path: &str,
) -> (StatusCode, Json<AuthzDecision>) {
    let allow_header = headers
        .get("x-allow")
        .and_then(|v| v.to_str().ok())
        .map(|s| s == "1")
        .unwrap_or(false);

    let fwd_path   = headers.get("x-forwarded-path").and_then(|v| v.to_str().ok()).unwrap_or("-");
    let fwd_method = headers.get("x-forwarded-method").and_then(|v| v.to_str().ok()).unwrap_or("-");
    info!(
        "PDP /check hit: method={}, fwd_method={}, fwd_path={}, original_path={}, x-allow={}",
        method, fwd_method, fwd_path, original_path, allow_header
    );

    let decision = if allow_header {
        ("ALLOW", StatusCode::OK, "allowed by x-allow: 1")
    } else if state.default_decision_allow {
        ("ALLOW", StatusCode::OK, "allowed by default")
    } else {
        ("DENY", StatusCode::FORBIDDEN, "denied by default")
    };

    let body = AuthzDecision {
        decision: decision.0.to_string(),
        reason: decision.2.to_string(),
    };

    (decision.1, Json(body))
}
