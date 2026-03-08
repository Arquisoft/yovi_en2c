use axum::{
    extract::{Path, State},
    Json,
};
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};

use crate::{Coordinates, GameY, Movement, PlayerId, YEN};
use crate::game_server::{
    error::ErrorResponse,
    state::AppState,
    version::check_api_version,
};

use std::collections::{HashSet, VecDeque};

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

/// Response payload for PVB move endpoint.
/// This avoids coupling game logic into the frontend.
#[derive(Serialize, Deserialize)]
pub struct PvbMoveResponse {
    pub yen: YEN,
    pub finished: bool,
    pub winner: Option<char>,
    pub winning_edges: Vec<[[usize; 2]; 2]>,
}

fn row_col_to_coords(
    layout: &str,
    size: u32,
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

    let total_cells: usize = rows.iter().map(|r| r.chars().count()).sum();
    if index >= total_cells {
        return Err("Invalid coordinate conversion".to_string());
    }

    let coords = Coordinates::from_index(index as u32, size);

    Ok(coords)
}

/// Parses YEN layout string into a 2D matrix of chars.
/// Rows are split by '/', each row is a Vec<char>.
fn parse_layout(layout: &str) -> Vec<Vec<char>> {
    if layout.is_empty() {
        return vec![];
    }
    layout.split('/').map(|row| row.chars().collect()).collect()
}

/// Returns neighbors for the "triangular/hex-like" adjacency used by the frontend.
fn neighbors(layout: &[Vec<char>], r: isize, c: isize) -> Vec<(usize, usize)> {
    let n = layout.len() as isize;
    let in_bounds = |rr: isize, cc: isize| -> bool {
        if rr < 0 || rr >= n { return false; }
        let row_len = layout[rr as usize].len() as isize;
        cc >= 0 && cc < row_len
    };

    let candidates = [
        (r, c - 1),
        (r, c + 1),
        (r - 1, c - 1),
        (r - 1, c),
        (r + 1, c),
        (r + 1, c + 1),
    ];

    candidates
        .iter()
        .copied()
        .filter(|(rr, cc)| in_bounds(*rr, *cc))
        .map(|(rr, cc)| (rr as usize, cc as usize))
        .collect()
}

/// Computes the winning connected component for a token, if any.
/// Win condition is the same as your frontend: touches left + right + bottom.
fn compute_winner_component(layout: &[Vec<char>], token: char) -> Option<HashSet<(usize, usize)>> {
    let n = layout.len();
    if n == 0 {
        return None;
    }

    let mut visited: HashSet<(usize, usize)> = HashSet::new();

    for r in 0..n {
        for c in 0..layout[r].len() {
            if layout[r][c] != token {
                continue;
            }
            if visited.contains(&(r, c)) {
                continue;
            }

            let mut touches_left = false;
            let mut touches_right = false;
            let mut touches_bottom = false;

            let mut queue: VecDeque<(usize, usize)> = VecDeque::new();
            let mut component: HashSet<(usize, usize)> = HashSet::new();

            visited.insert((r, c));
            component.insert((r, c));
            queue.push_back((r, c));

            while let Some((rr, cc)) = queue.pop_front() {
                if cc == 0 {
                    touches_left = true;
                }
                if cc == layout[rr].len().saturating_sub(1) {
                    touches_right = true;
                }
                if rr == n - 1 {
                    touches_bottom = true;
                }

                if touches_left && touches_right && touches_bottom {
                    return Some(component);
                }

                for (nr, nc) in neighbors(layout, rr as isize, cc as isize) {
                    if layout[nr][nc] != token {
                        continue;
                    }
                    if visited.contains(&(nr, nc)) {
                        continue;
                    }
                    visited.insert((nr, nc));
                    component.insert((nr, nc));
                    queue.push_back((nr, nc));
                }
            }
        }
    }

    None
}

/// Builds unique edges between adjacent cells within a component.
/// The edge format matches the frontend expectation: [[[r1,c1],[r2,c2]], ...]
fn build_edges(layout: &[Vec<char>], component: &HashSet<(usize, usize)>) -> Vec<[[usize; 2]; 2]> {
    let mut edges: Vec<[[usize; 2]; 2]> = vec![];
    let mut seen: HashSet<((usize, usize), (usize, usize))> = HashSet::new();

    for &(r, c) in component.iter() {
        for (nr, nc) in neighbors(layout, r as isize, c as isize) {
            if !component.contains(&(nr, nc)) {
                continue;
            }

            // Avoid duplicates by sorting endpoints
            let a = (r, c);
            let b = (nr, nc);
            let (p, q) = if a <= b { (a, b) } else { (b, a) };

            if seen.contains(&(p, q)) {
                continue;
            }
            seen.insert((p, q));

            edges.push([[p.0, p.1], [q.0, q.1]]);
        }
    }

    edges
}

/// Computes finished/winner/edges from a YEN state.
/// Winner detection is UI-oriented; engine remains unchanged.
fn compute_result_from_yen(yen: &YEN) -> (bool, Option<char>, Vec<[[usize; 2]; 2]>) {
    let layout = parse_layout(yen.layout());
    if layout.is_empty() {
        return (false, None, vec![]);
    }

    // Finished: no '.' left OR there is a winner
    let any_empty = layout.iter().any(|row| row.iter().any(|&ch| ch == '.'));

    let players = yen.players();
    let p0 = players.get(0).copied().unwrap_or('B');
    let p1 = players.get(1).copied().unwrap_or('R');

    if let Some(comp) = compute_winner_component(&layout, p0) {
        let edges = build_edges(&layout, &comp);
        return (true, Some(p0), edges);
    }

    if let Some(comp) = compute_winner_component(&layout, p1) {
        let edges = build_edges(&layout, &comp);
        return (true, Some(p1), edges);
    }

    if !any_empty {
        return (true, None, vec![]);
    }

    (false, None, vec![])
}

#[axum::debug_handler]
pub async fn pvb_move(
    State(state): State<AppState>,
    Path(params): Path<PvbParams>,
    Json(req): Json<PvbMoveRequest>,
) -> Result<Json<PvbMoveResponse>, (StatusCode, Json<ErrorResponse>)> {
    // 1) API version is checked
    if let Err(err) = check_api_version(&params.api_version) {
        return Err((StatusCode::BAD_REQUEST, Json(err)));
    }

    // 2) Save game size
    let layout_str = req.yen.layout().to_string();
    let size = req.yen.size();

    // 3) Parse YEN -> Game
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

    // Validate game is finished
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

    // We convert to coords
    let coords = match row_col_to_coords(&layout_str, size, req.row, req.col) {
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
    let human_player = PlayerId::new(0);

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

    // If we finished the game, we return
    if game.check_game_over() {
        let new_yen: YEN = (&game).into();
        let (finished, winner, winning_edges) = compute_result_from_yen(&new_yen);

        return Ok(Json(PvbMoveResponse {
            yen: new_yen,
            finished,
            winner,
            winning_edges,
        }));
    }

    // We search for the bot
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

    // We choose the bot move
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

    // Bot's turn
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

    // New state is returned
    let new_yen: YEN = (&game).into();
    let (finished, winner, winning_edges) = compute_result_from_yen(&new_yen);

    Ok(Json(PvbMoveResponse {
        yen: new_yen,
        finished,
        winner,
        winning_edges,
    }))
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

        // Ensure response can be parsed
        let bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let parsed: PvbMoveResponse = serde_json::from_slice(&bytes).unwrap();
        assert!(parsed.yen.size() > 0);
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

    #[tokio::test]
    async fn test_pvb_row_out_of_bounds() {
        let registry =
            YBotRegistry::new().with_bot(std::sync::Arc::new(RandomBot));
        let state = AppState::new(registry);
        let app = create_router(state);

        let game = crate::GameY::new(7);
        let yen: crate::YEN = (&game).into();

        let body = PvbMoveRequest { yen, row: 99, col: 0 };

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

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_pvb_col_out_of_bounds() {
        let registry =
            YBotRegistry::new().with_bot(std::sync::Arc::new(RandomBot));
        let state = AppState::new(registry);
        let app = create_router(state);

        let game = crate::GameY::new(7);
        let yen: crate::YEN = (&game).into();

        let body = PvbMoveRequest { yen, row: 0, col: 99 };

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

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_pvb_rejects_finished_game() {
        let registry =
            YBotRegistry::new().with_bot(std::sync::Arc::new(RandomBot));
        let state = AppState::new(registry);
        let app = create_router(state);

        let mut game = crate::GameY::new(1);
        game.add_move(crate::Movement::Placement {
            player: crate::PlayerId::new(0),
            coords: crate::Coordinates::new(0, 0, 0),
        })
        .unwrap();

        let yen: crate::YEN = (&game).into();
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

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_pvb_rejects_invalid_yen_format() {
        let registry =
            YBotRegistry::new().with_bot(std::sync::Arc::new(RandomBot));
        let state = AppState::new(registry);
        let app = create_router(state);

        let yen = crate::YEN::new(
            3,
            0,
            vec!['B', 'R'],
            "X/../...".to_string(),
        );

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

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }
}