use axum::{
    Json,
    extract::{Path, State},
};
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
) -> Result<Json<YEN>, Json<ErrorResponse>> {

    // API version validation
    check_api_version(&params.api_version)?;

    // Convert YEN -> internal GameY
    let mut game = match GameY::try_from(yen) {
        Ok(g) => g,
        Err(err) => {
            return Err(Json(ErrorResponse::error(
                &format!("Invalid YEN format: {}", err),
                Some(params.api_version),
                Some(params.bot_id),
            )));
        }
    };

    // Prevent playing if the game is already finished
    if game.check_game_over() {
        return Err(Json(ErrorResponse::error(
            "Game is already over",
            Some(params.api_version),
            Some(params.bot_id),
        )));
    }

    // Retrieve the bot from registry
    let bot = match state.bots().find(&params.bot_id) {
        Some(b) => b,
        None => {
            let available = state.bots().names().join(", ");
            return Err(Json(ErrorResponse::error(
                &format!(
                    "Bot not found: {}, available bots: [{}]",
                    params.bot_id, available
                ),
                Some(params.api_version),
                Some(params.bot_id),
            )));
        }
    };

    // Let the bot choose a move
    let coords = match bot.choose_move(&game) {
        Some(c) => c,
        None => {
            return Err(Json(ErrorResponse::error(
                "No valid moves available for the bot",
                Some(params.api_version),
                Some(params.bot_id),
            )));
        }
    };

    // Determine which player the bot is (next player)
    let bot_player = match game.next_player() {
        Some(p) => p,
        None => {
            return Err(Json(ErrorResponse::error(
                "Game has no next player (already finished?)",
                Some(params.api_version),
                Some(params.bot_id),
            )));
        }
    };

    // Apply bot move using core engine
    let movement = Movement::Placement {
        player: bot_player,
        coords,
    };

    if let Err(e) = game.add_move(movement) {
        return Err(Json(ErrorResponse::error(
            &format!("Game error applying bot move: {}", e),
            Some(params.api_version),
            Some(params.bot_id),
        )));
    }

    // convert internal GameY back to YEN
    let new_yen: YEN = (&game).into();

    Ok(Json(new_yen))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use axum::extract::{Path, State};
    use crate::{RandomBot, YBotRegistry, PlayerId, Coordinates};

    #[tokio::test]
    async fn test_pvb_move_returns_updated_yen() {

        // Prepare bot registry with RandomBot
        let bots = YBotRegistry::new().with_bot(Arc::new(RandomBot));
        let state = AppState::new(bots);

        // Create a small game
        let mut game = GameY::new(3);
        let total_cells = game.total_cells() as usize;

        // Simulate a human move first
        let human_move = Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(2, 0, 0),
        };
        game.add_move(human_move).unwrap();

        // Convert current state to YEN (input for endpoint)
        let yen_input: YEN = (&game).into();

        let params = PvbParams {
            api_version: "v1".to_string(),
            bot_id: "random_bot".to_string(),
        };

        // Call endpoint handler directly
        let response = pvb_move(
            State(state),
            Path(params),
            Json(yen_input),
        )
        .await;

        assert!(response.is_ok());

        let Json(yen_output) = response.unwrap();
        let game_after = GameY::try_from(yen_output).unwrap();

        // We expect two moves total (human + bot)
        assert_eq!(
            game_after.available_cells().len(),
            total_cells - 2
        );
    }
}
