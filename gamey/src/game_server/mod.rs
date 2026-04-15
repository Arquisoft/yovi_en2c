//! HTTP server for Y game bots.
//!
//! This module provides an Axum-based REST API for querying Y game bots.
//! The server exposes endpoints for checking bot status and requesting moves.
//!
//! # Endpoints
//! - `GET /status`                              - Health check endpoint
//! - `GET /metrics`                             - Prometheus metrics endpoint
//! - `POST /{api_version}/ybot/choose/{bot_id}` - Request a move from a bot
//! - `POST /{api_version}/game/pvb/{bot_id}`    - Player vs bot move
//! - `POST /game/new`                           - Start a new game
//!
//! # Example
//! ```no_run
//! use gamey::game_server::run_bot_server;
//!
//! #[tokio::main]
//! async fn main() {
//!     if let Err(e) = run_bot_server(3000).await {
//!         eprintln!("Server error: {}", e);
//!     }
//! }
//! ```

pub mod error;
pub mod state;
pub mod version;

pub mod bot {
    pub mod choose;
}

pub mod game {
    pub mod pvb;
    pub mod new;
}

use axum::response::IntoResponse;
use axum_prometheus::PrometheusMetricLayer;
use std::sync::Arc;
pub use bot::choose::MoveResponse;
pub use error::ErrorResponse;
pub use version::*;

use crate::{GameYError, HeuristicBot, YBotRegistry, game_server::state::AppState};

/// Creates the Axum router with the given state.
///
/// Includes a Prometheus metrics layer that automatically instruments all routes
/// with: `axum_http_requests_total` (counter), `axum_http_requests_duration_seconds`
/// (histogram), and `axum_http_requests_pending` (gauge).
/// The `/metrics` endpoint is added for Prometheus to scrape.
///
/// This is useful for testing the API without binding to a network port.
pub fn create_router(state: AppState) -> axum::Router {
    // PrometheusMetricLayer uses the Tower middleware pattern — it wraps every
    // route in the router automatically, so no per-route changes are needed.
    let (prometheus_layer, metrics_handle) = PrometheusMetricLayer::pair();

    axum::Router::new()
        .route("/status", axum::routing::get(status))
        .route("/metrics", axum::routing::get(move || async move {
            metrics_handle.render()
        }))
        .route(
            "/{api_version}/ybot/choose/{bot_id}",
            axum::routing::post(bot::choose::choose),
        )
        .route(
            "/{api_version}/game/pvb/{bot_id}",
            axum::routing::post(game::pvb::pvb_move),
        )
        .route(
            "/game/new",
            axum::routing::post(game::new::new_game),
        )
        .layer(prometheus_layer)
        .with_state(state)
}

/// Creates the default application state with the standard bot registry.
pub fn create_default_state() -> AppState {
    let bots = YBotRegistry::new().with_bot(Arc::new(HeuristicBot));
    AppState::new(bots)
}

/// Starts the game server on the specified port.
///
/// # Errors
/// Returns `GameYError::ServerError` if the TCP port cannot be bound or
/// the server encounters a runtime error.
pub async fn run_bot_server(port: u16) -> Result<(), GameYError> {
    let state = create_default_state();
    let app = create_router(state);

    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| GameYError::ServerError {
            message: format!("Failed to bind to {}: {}", addr, e),
        })?;

    println!("Server mode: Listening on http://{}", addr);
    println!("Metrics available at http://{}/metrics", addr);
    axum::serve(listener, app)
        .await
        .map_err(|e| GameYError::ServerError {
            message: format!("Server error: {}", e),
        })?;

    Ok(())
}

/// Health check endpoint handler.
///
/// Returns "OK" to indicate the server is running.
pub async fn status() -> impl IntoResponse {
    "OK"
}


#[cfg(test)]
mod router_tests {
    use super::*;
    use axum::http::{Request, StatusCode};
    use axum::body::Body;
    use tower::ServiceExt;
    use crate::bot::ybot_registry::YBotRegistry;

    #[tokio::test]
    async fn test_unknown_route_returns_404() {
        let state = crate::game_server::state::AppState::new(
            YBotRegistry::default()
        );
        let app = create_router(state);
        let response = app
            .oneshot(
                Request::get("/unknown")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_metrics_endpoint_returns_200() {
        let state = crate::game_server::state::AppState::new(
            YBotRegistry::default()
        );
        let app = create_router(state);
        let response = app
            .oneshot(
                Request::get("/metrics")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }
}