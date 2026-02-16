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

// Infer board size from layout rows (rows = 2n - 1)
fn infer_board_size(layout: &str) -> u32 {
    let rows = layout.split('/').count() as u32;
    (rows + 1) / 2
}

// Convert row/col into internal index and then Coordinates
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

    // Compute linear index
    let mut index: usize = 0;

    for r in 0..row {
        index += rows[r].chars().count();
    }

    index += col;

    let board_size = infer_board_size(layout);

    Ok(Coordinates::from_index(index as u32, board_size))
}

#[axum::debug_handler]
pub async fn pvb_move(
    State(state): State<AppState>,
    Path(params): Path<PvbParams>,
    Json(req): Json<PvbMoveRequest>,
) -> Result<Json<YEN>, (StatusCode, Json<ErrorResponse>)> {

    // Check API version
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

    // Convert row/col to Coordinates
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

    // Human move
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

    // Bot lookup
    let bot = match state.bots().find(&params.bot_id) {
        Some(b) => b,
        None => {
            let available = state.bots().names().join(", ");
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse::error(
                    &format!("Bot not found: {}, available bots: [{}]", params.bot_id, available),
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
