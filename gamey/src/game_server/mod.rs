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

pub mod error;
pub mod state;
pub mod version;

pub mod bot {
    pub mod choose;
}

pub mod game {
    pub mod new;
    pub mod pvb;
    pub mod pvp;
    pub mod check;
}

use axum::response::IntoResponse;
use axum_prometheus::metrics_exporter_prometheus::{PrometheusBuilder, PrometheusHandle};
use std::sync::{Arc, OnceLock};

pub use bot::choose::MoveResponse;
pub use error::ErrorResponse;
pub use version::*;

use crate::{
    game_server::state::AppState, AlfaBetaBot, GameYError, HeuristicBot, MinimaxBot,
    MonteCarloBot, RandomBot, YBotRegistry,
};

use crate::bot_implementations::MonteCarloDifficulty;

static PROMETHEUS_HANDLE: OnceLock<PrometheusHandle> = OnceLock::new();

fn prometheus_handle() -> &'static PrometheusHandle {
    PROMETHEUS_HANDLE.get_or_init(|| {
        PrometheusBuilder::new()
            .install_recorder()
            .expect("Failed to install Prometheus recorder")
    })
}

pub fn create_router(state: AppState) -> axum::Router {
    let _ = prometheus_handle();

    let prometheus_layer = axum_prometheus::PrometheusMetricLayer::new();

    axum::Router::new()
        .route("/status", axum::routing::get(status))
        .route(
            "/metrics",
            axum::routing::get(|| async { prometheus_handle().render() }),
        )
        .route(
            "/{api_version}/ybot/choose/{bot_id}",
            axum::routing::post(bot::choose::choose),
        )
        .route(
            "/{api_version}/game/pvb/{bot_id}",
            axum::routing::post(game::pvb::pvb_move),
        )
        .route(
            "/{api_version}/game/pvp/move",
            axum::routing::post(game::pvp::pvp_move),
        )
        .route(
            "/game/new",
            axum::routing::post(game::new::new_game),
        )
        .route(
            "/game/check",
            axum::routing::post(game::check::check_game))
        .layer(prometheus_layer)
        .with_state(state)
}

pub fn create_default_state() -> AppState {
    let bots = YBotRegistry::new()
        .with_bot(Arc::new(HeuristicBot))
        .with_bot(Arc::new(RandomBot))
        .with_bot(Arc::new(AlfaBetaBot::new(None)))
        .with_bot(Arc::new(MinimaxBot::new(None)))
        .with_bot(Arc::new(MonteCarloBot::new(MonteCarloDifficulty::Hard)))
        .with_bot(Arc::new(MonteCarloBot::new(MonteCarloDifficulty::Extreme)));

    AppState::new(bots)
}

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

pub async fn status() -> impl IntoResponse {
    "OK"
}

#[cfg(test)]
mod router_tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    #[tokio::test]
    async fn test_unknown_route_returns_404() {
        let state = create_default_state();
        let app = create_router(state);

        let response = app
            .oneshot(Request::get("/unknown").body(Body::empty()).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_metrics_endpoint_returns_200() {
        let state = create_default_state();
        let app = create_router(state);

        let response = app
            .oneshot(Request::get("/metrics").body(Body::empty()).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }
}