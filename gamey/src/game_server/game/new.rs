use axum::Json;
use serde::Deserialize;
use crate::{GameY, YEN};

#[derive(Deserialize)]
pub struct NewGameRequest {
    pub size: u32,
}

pub async fn new_game(
    Json(req): Json<NewGameRequest>,
) -> Json<YEN> {
    let game = GameY::new(req.size);
    let yen: YEN = (&game).into();
    Json(yen)
}
