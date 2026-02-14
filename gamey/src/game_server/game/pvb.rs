use axum::{
    Json,
    extract::{Path, State},
};
use axum::http::StatusCode;
use serde::{Deserialize};
use crate::{GameY, YEN};
use crate::game_server::{version::check_api_version, error::ErrorResponse, state::AppState};
use crate::Movement;

/// Path parameters for the PVB endpoint.
/// POST /{api_version}/game/pvb/{bot_id}
#[derive(Deserialize)]
pub struct PvbParams {
    pub api_version: String, // api version
    pub bot_id: String, // bot id
}

/// PLAYER vs BOT endpoint.
///
/// This endpoint expects:
/// - A valid YEN object representing the current game state
/// - A bot identifier in the URL
///
/// It performs:
/// 1. YEN -> GameY conversion
/// 2. Bot move selection
/// 3. Apply bot move
/// 4. Convert GameY -> YEN
///
/// Returns the updated YEN after the bot move.
#[axum::debug_handler]
pub async fn pvb_move(
    State(state): State<AppState>,
    Path(params): Path<PvbParams>,
    Json(yen): Json<YEN>,
) -> Result<Json<YEN>, (StatusCode, Json<ErrorResponse>)> {

    if let Err(err) = check_api_version(&params.api_version) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(err),
        ));
    }

    let mut game = match GameY::try_from(yen) {
        Ok(g) => g,
        Err(err) => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse::error(
                    &format!("Invalid YEN format: {}", err),
                    Some(params.api_version),
                    Some(params.bot_id),
                )),
            ));
        }
    };

    if game.check_game_over() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse::error(
                "Game is already over",
                Some(params.api_version),
                Some(params.bot_id),
            )),
        ));
    }

    let bot = match state.bots().find(&params.bot_id) {
        Some(b) => b,
        None => {
            let available = state.bots().names().join(", ");
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse::error(
                    &format!(
                        "Bot not found: {}, available bots: [{}]",
                        params.bot_id, available
                    ),
                    Some(params.api_version),
                    Some(params.bot_id),
                )),
            ));
        }
    };

    let coords = match bot.choose_move(&game) {
        Some(c) => c,
        None => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse::error(
                    "No valid moves available for the bot",
                    Some(params.api_version),
                    Some(params.bot_id),
                )),
            ));
        }
    };

    let bot_player = match game.next_player() {
        Some(p) => p,
        None => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse::error(
                    "Game has no next player (already finished?)",
                    Some(params.api_version),
                    Some(params.bot_id),
                )),
            ));
        }
    };

    let movement = Movement::Placement {
        player: bot_player,
        coords,
    };

    if let Err(e) = game.add_move(movement) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse::error(
                &format!("Game error applying bot move: {}", e),
                Some(params.api_version),
                Some(params.bot_id),
            )),
        ));
    }

    let new_yen: YEN = (&game).into();

    Ok(Json(new_yen))
}

#[cfg(test)]
mod tests {

    #[tokio::test]
    async fn test_pvb_valid_request() {
        use axum::body::Body;
        use axum::http::{Request, StatusCode};
        use tower::ServiceExt;

        use crate::{YBotRegistry, RandomBot};
        use crate::game_server::{create_router, state::AppState};

        let registry = YBotRegistry::new()
            .with_bot(std::sync::Arc::new(RandomBot));

        let state = AppState::new(registry);
        let app = create_router(state);

        let game = crate::GameY::new(5);
        let yen: crate::YEN = (&game).into();

        let response = app
            .oneshot(
                Request::post("/v1/game/pvb/random_bot")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&yen).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }


    #[tokio::test]
    async fn test_pvb_unknown_bot() {
        use axum::body::Body;
        use axum::http::{Request, StatusCode};
        use tower::ServiceExt;

        use crate::{YBotRegistry};
        use crate::game_server::{create_router, state::AppState};

        let registry = YBotRegistry::new();

        let state = AppState::new(registry);
        let app = create_router(state);
        
        let game = crate::GameY::new(5);
        let yen: crate::YEN = (&game).into();

        let response = app
            .oneshot(
                Request::post("/v1/game/pvb/unknown_bot")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&yen).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

}
