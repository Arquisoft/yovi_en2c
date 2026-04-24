use axum::{
    extract::Path,
    Json,
};
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};

use crate::{Coordinates, GameY, Movement, YEN};
use crate::game_server::{
    error::ErrorResponse,
    version::check_api_version,
};

use std::collections::{HashSet, VecDeque};

#[derive(Deserialize)]
pub struct PvpParams {
    pub api_version: String,
}

#[derive(Deserialize, Serialize)]
pub struct PvpMoveRequest {
    pub yen: YEN,
    pub row: usize,
    pub col: usize,
}

/// Response payload for PVP move endpoint.
/// Keeps the frontend decoupled from internal engine details.
#[derive(Serialize, Deserialize)]
pub struct PvpMoveResponse {
    pub yen: YEN,
    pub finished: bool,
    pub winner: Option<char>,
    pub winning_edges: Vec<[[usize; 2]; 2]>,
}

/// Convenience alias for the handler error type.
type HandlerError = (StatusCode, Json<ErrorResponse>);

/// Builds a 400 Bad Request error response with a message tied to the current API version.
fn bad_request(message: &str, api_version: &str) -> HandlerError {
    (
        StatusCode::BAD_REQUEST,
        Json(ErrorResponse::error(message, Some(api_version.to_string()), None)),
    )
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
    for row_str in rows.iter().take(row) {
        index += row_str.chars().count();
    }
    index += col;

    let total_cells: usize = rows.iter().map(|r| r.chars().count()).sum();
    if index >= total_cells {
        return Err("Invalid coordinate conversion".to_string());
    }

    Ok(Coordinates::from_index(index as u32, size))
}

/// Parses YEN layout string into a 2D matrix of chars.
fn parse_layout(layout: &str) -> Vec<Vec<char>> {
    if layout.is_empty() {
        return vec![];
    }
    layout.split('/').map(|row| row.chars().collect()).collect()
}

/// Returns neighbors for the triangular/hex-like adjacency used by the frontend.
fn neighbors(layout: &[Vec<char>], r: isize, c: isize) -> Vec<(usize, usize)> {
    let n = layout.len() as isize;
    let in_bounds = |rr: isize, cc: isize| -> bool {
        if rr < 0 || rr >= n {
            return false;
        }
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
/// Win condition: touches left + right + bottom.
fn compute_winner_component(
    layout: &[Vec<char>],
    token: char,
) -> Option<HashSet<(usize, usize)>> {
    let n = layout.len();
    if n == 0 {
        return None;
    }

    let mut visited: HashSet<(usize, usize)> = HashSet::new();

    for r in 0..n {
        for c in 0..layout[r].len() {
            if layout[r][c] != token || visited.contains(&(r, c)) {
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
                    if layout[nr][nc] != token || visited.contains(&(nr, nc)) {
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
fn build_edges(
    layout: &[Vec<char>],
    component: &HashSet<(usize, usize)>,
) -> Vec<[[usize; 2]; 2]> {
    let mut edges: Vec<[[usize; 2]; 2]> = vec![];
    let mut seen: HashSet<((usize, usize), (usize, usize))> = HashSet::new();

    for &(r, c) in component {
        for (nr, nc) in neighbors(layout, r as isize, c as isize) {
            if !component.contains(&(nr, nc)) {
                continue;
            }

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
fn compute_result_from_yen(yen: &YEN) -> (bool, Option<char>, Vec<[[usize; 2]; 2]>) {
    let layout = parse_layout(yen.layout());
    if layout.is_empty() {
        return (false, None, vec![]);
    }

    let any_empty = layout.iter().any(|row| row.iter().any(|&ch| ch == '.'));

    let players = yen.players();
    let p0 = players.first().copied().unwrap_or('B');
    let p1 = players.get(1).copied().unwrap_or('R');

    if let Some(comp) = compute_winner_component(&layout, p0) {
        return (true, Some(p0), build_edges(&layout, &comp));
    }

    if let Some(comp) = compute_winner_component(&layout, p1) {
        return (true, Some(p1), build_edges(&layout, &comp));
    }

    if !any_empty {
        return (true, None, vec![]);
    }

    (false, None, vec![])
}

#[axum::debug_handler]
pub async fn pvp_move(
    Path(params): Path<PvpParams>,
    Json(req): Json<PvpMoveRequest>,
) -> Result<Json<PvpMoveResponse>, HandlerError> {
    let version = &params.api_version;

    if let Err(err) = check_api_version(version) {
        return Err((StatusCode::BAD_REQUEST, Json(err)));
    }

    let layout_str = req.yen.layout().to_string();
    let size = req.yen.size();

    let mut game = GameY::try_from(req.yen)
        .map_err(|err| bad_request(&format!("Invalid YEN format: {}", err), version))?;

    if game.check_game_over() {
        return Err(bad_request("Game is already over", version));
    }

    let coords = row_col_to_coords(&layout_str, size, req.row, req.col)
        .map_err(|msg| bad_request(&format!("Invalid coordinates: {}", msg), version))?;

    let current_player = game
        .next_player()
        .ok_or_else(|| bad_request("No next player available", version))?;

    let movement = Movement::Placement {
        player: current_player,
        coords,
    };

    game.add_move(movement)
        .map_err(|err| bad_request(&format!("Invalid move: {}", err), version))?;

    let new_yen: YEN = (&game).into();
    let (finished, winner, winning_edges) = compute_result_from_yen(&new_yen);

    Ok(Json(PvpMoveResponse {
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

    use crate::game_server::{create_router, state::AppState};
    use crate::YBotRegistry;

    fn test_app() -> axum::Router {
        let state = AppState::new(YBotRegistry::new());
        create_router(state)
    }

    fn post_pvp(body: &PvpMoveRequest, version: &str) -> Request<Body> {
        Request::post(format!("/{version}/game/pvp/move"))
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(body).unwrap()))
            .unwrap()
    }

    fn new_yen(size: u32) -> crate::YEN {
        let game = crate::GameY::new(size);
        (&game).into()
    }

    async fn send_pvp(
        app: axum::Router,
        body: &PvpMoveRequest,
        version: &str,
    ) -> axum::response::Response {
        app.oneshot(post_pvp(body, version)).await.unwrap()
    }

    #[tokio::test]
    async fn test_pvp_valid_request() {
        let app = test_app();

        let body = PvpMoveRequest {
            yen: new_yen(3),
            row: 0,
            col: 0,
        };

        let response = send_pvp(app, &body, "v1").await;

        assert_eq!(response.status(), StatusCode::OK);

        let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let parsed: PvpMoveResponse = serde_json::from_slice(&bytes).unwrap();

        assert_eq!(parsed.yen.size(), 3);
        assert_eq!(parsed.yen.turn(), 1);
    }

    #[tokio::test]
    async fn test_pvp_invalid_api_version() {
        let app = test_app();

        let body = PvpMoveRequest {
            yen: new_yen(3),
            row: 0,
            col: 0,
        };

        let response = send_pvp(app, &body, "v2").await;

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_pvp_row_out_of_bounds() {
        let app = test_app();

        let body = PvpMoveRequest {
            yen: new_yen(3),
            row: 99,
            col: 0,
        };

        let response = send_pvp(app, &body, "v1").await;

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_pvp_col_out_of_bounds() {
        let app = test_app();

        let body = PvpMoveRequest {
            yen: new_yen(3),
            row: 0,
            col: 99,
        };

        let response = send_pvp(app, &body, "v1").await;

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_pvp_rejects_finished_game() {
        let app = test_app();

        let mut game = crate::GameY::new(1);
        game.add_move(crate::Movement::Placement {
            player: crate::PlayerId::new(0),
            coords: crate::Coordinates::new(0, 0, 0),
        })
        .unwrap();

        let yen: crate::YEN = (&game).into();
        let body = PvpMoveRequest { yen, row: 0, col: 0 };

        let response = send_pvp(app, &body, "v1").await;

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_pvp_rejects_invalid_yen_format() {
        let app = test_app();

        let yen = crate::YEN::new(3, 0, vec!['B', 'R'], "X/../...".to_string());
        let body = PvpMoveRequest { yen, row: 0, col: 0 };

        let response = send_pvp(app, &body, "v1").await;

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_pvp_rejects_occupied_cell() {
        let app = test_app();

        let mut game = crate::GameY::new(3);
        game.add_move(crate::Movement::Placement {
            player: crate::PlayerId::new(0),
            coords: crate::Coordinates::new(2, 0, 0),
        })
        .unwrap();

        let yen: crate::YEN = (&game).into();
        let body = PvpMoveRequest { yen, row: 0, col: 0 };

        let response = send_pvp(app, &body, "v1").await;

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn test_parse_layout_empty() {
        let parsed = parse_layout("");
        assert!(parsed.is_empty());
    }

    #[test]
    fn test_compute_result_from_yen_ongoing_game() {
        let yen = crate::YEN::new(3, 0, vec!['B', 'R'], "./../...".to_string());

        let (finished, winner, winning_edges) = compute_result_from_yen(&yen);

        assert!(!finished);
        assert_eq!(winner, None);
        assert!(winning_edges.is_empty());
    }

    #[test]
    fn test_compute_result_from_yen_finished_with_winner() {
        let yen = crate::YEN::new(3, 1, vec!['B', 'R'], "B/BB/BBR".to_string());

        let (finished, winner, winning_edges) = compute_result_from_yen(&yen);

        assert!(finished);
        assert_eq!(winner, Some('B'));
        assert!(!winning_edges.is_empty());
    }
}