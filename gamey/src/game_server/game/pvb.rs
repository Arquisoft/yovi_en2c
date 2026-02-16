use axum::{
    extract::{Path, State},
    Json,
};
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};

use crate::{Coordinates, GameY, Movement, YEN};
use crate::game_server::{
    error::ErrorResponse,
    state::AppState,
    version::check_api_version,
};

#[derive(Deserialize)]
pub struct PvbParams {
    pub api_version: String,
    pub bot_id: String,
}

#[derive(Deserialize, Serialize)]
pub struct PvbMoveRequest {
    pub yen: YEN,
    pub row: usize,
    pub col: usize,
}

fn infer_board_size(layout: &str) -> u32 {
    let rows = layout.split('/').count() as u32;
    (rows + 1) / 2
}

fn row_col_to_coords(
    layout: &str,
    row: usize,
    col: usize,
) -> Result<Coordinates, String> {
    let rows: Vec<&str> = layout.split('/').collect();

    if row >= rows.len() {
        return Err(format!("row out of bounds: {} (rows={})", row, rows.len()));
    }

    let row_len = rows[row].chars().count();
    if col >= row_len {
        return Err(format!("col out of bounds: {} (row_len={})", col, row_len));
    }

    let mut index: usize = 0;
    for r in 0..row {
        index += rows[r].chars().count();
    }
    index += col;

    let board_size = infer_board_size(layout);

    let coords = Coordinates::from_index(index as u32, board_size);

    let total_cells: usize = rows.iter().map(|r| r.chars().count()).sum();
    if index >= total_cells {
        return Err("Invalid coordinate conversion".to_string());
    }

    Ok(coords)
}

#[axum::debug_handler]
pub async fn pvb_move(
    State(state): State<AppState>,
    Path(params): Path<PvbParams>,
    Json(req): Json<PvbMoveRequest>,
) -> Result<Json<YEN>, (StatusCode, Json<ErrorResponse>)> {
    if let Err(err) = check_api_version(&params.api_version) {
        return Err((StatusCode::BAD_REQUEST, Json(err)));
    }

    let layout_str = req.yen.layout().to_string();

    let mut game = match GameY::try_from(req.yen) {
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

    let coords = match row_col_to_coords(&layout_str, req.row, req.col) {
        Ok(c) => c,
        Err(msg) => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse::error(
                    &format!("Invalid coordinates: {}", msg),
                    Some(params.api_version),
                    Some(params.bot_id),
                )),
            ));
        }
    };

    let human_player = match game.next_player() {
        Some(p) => p,
        None => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse::error(
                    "No next player available for human move",
                    Some(params.api_version),
                    Some(params.bot_id),
                )),
            ));
        }
    };

    let human_move = Movement::Placement {
        player: human_player,
        coords,
    };

    if let Err(e) = game.add_move(human_move) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse::error(
                &format!("Invalid human move: {}", e),
                Some(params.api_version),
                Some(params.bot_id),
            )),
        ));
    }

    if game.check_game_over() {
        let new_yen: YEN = (&game).into();
        return Ok(Json(new_yen));
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

    let bot_coords = match bot.choose_move(&game) {
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
                    "No next player available for bot move",
                    Some(params.api_version),
                    Some(params.bot_id),
                )),
            ));
        }
    };

    let bot_move = Movement::Placement {
        player: bot_player,
        coords: bot_coords,
    };

    if let Err(e) = game.add_move(bot_move) {
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
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    use crate::{RandomBot, YBotRegistry};
    use crate::game_server::{create_router, state::AppState};

    #[tokio::test]
    async fn test_pvb_valid_request() {
        let registry =
            YBotRegistry::new().with_bot(std::sync::Arc::new(RandomBot));
        let state = AppState::new(registry);
        let app = create_router(state);

        let game = crate::GameY::new(7);
        let yen: crate::YEN = (&game).into();

        // Use safe coordinates
        let body = PvbMoveRequest { yen, row: 0, col: 0 };

        let response = app
            .oneshot(
                Request::post("/v1/game/pvb/random_bot")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        serde_json::to_string(&body).unwrap(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_pvb_unknown_bot() {
        let registry = YBotRegistry::new();
        let state = AppState::new(registry);
        let app = create_router(state);

        let game = crate::GameY::new(7);
        let yen: crate::YEN = (&game).into();

        let body = PvbMoveRequest { yen, row: 0, col: 0 };

        let response = app
            .oneshot(
                Request::post("/v1/game/pvb/unknown_bot")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        serde_json::to_string(&body).unwrap(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_invalid_api_version() {
        let registry =
            YBotRegistry::new().with_bot(std::sync::Arc::new(RandomBot));
        let state = AppState::new(registry);
        let app = create_router(state);

        let game = crate::GameY::new(7);
        let yen: crate::YEN = (&game).into();

        let body = PvbMoveRequest { yen, row: 0, col: 0 };

        let response = app
            .oneshot(
                Request::post("/v2/game/pvb/random_bot")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        serde_json::to_string(&body).unwrap(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }
}

