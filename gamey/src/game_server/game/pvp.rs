use axum::Json;
use crate::game_server::error::ErrorResponse;

//placeholder file for now

pub async fn pvp_move() -> Result<Json<String>, Json<ErrorResponse>> {
    Err(Json(ErrorResponse::error(
        "PVP not implemented yet",
        None,
        None,
    )))
}
