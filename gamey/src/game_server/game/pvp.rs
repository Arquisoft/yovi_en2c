use axum::{extract::Path, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use std::collections::{HashSet, VecDeque};

use crate::game_server::{error::ErrorResponse, version::check_api_version};
use crate::{Coordinates, GameY, Movement, YEN};

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

#[derive(Serialize, Deserialize)]
pub struct PvpMoveResponse {
    pub yen: YEN,
    pub finished: bool,
    pub winner: Option<char>,
    pub winning_edges: Vec<[[usize; 2]; 2]>,
}

type HandlerError = (StatusCode, Json<ErrorResponse>);
type Cell = (usize, usize);
type Edge = [[usize; 2]; 2];

fn bad_request(message: &str, api_version: &str) -> HandlerError {
    (
        StatusCode::BAD_REQUEST,
        Json(ErrorResponse::error(message, Some(api_version.to_string()), None)),
    )
}

fn row_col_to_coords(layout: &str, size: u32, row: usize, col: usize) -> Result<Coordinates, String> {
    let rows: Vec<&str> = layout.split('/').collect();

    let selected_row = rows
        .get(row)
        .ok_or_else(|| format!("row out of bounds: {} (rows={})", row, rows.len()))?;

    let row_len = selected_row.chars().count();
    if col >= row_len {
        return Err(format!("col out of bounds: {} (row_len={})", col, row_len));
    }

    let index = rows
        .iter()
        .take(row)
        .map(|row_str| row_str.chars().count())
        .sum::<usize>()
        + col;

    let total_cells = rows.iter().map(|row_str| row_str.chars().count()).sum::<usize>();
    if index >= total_cells {
        return Err("Invalid coordinate conversion".to_string());
    }

    Ok(Coordinates::from_index(index as u32, size))
}

fn parse_layout(layout: &str) -> Vec<Vec<char>> {
    if layout.is_empty() {
        return vec![];
    }

    layout.split('/').map(|row| row.chars().collect()).collect()
}

fn is_cell_in_bounds(layout: &[Vec<char>], row: isize, col: isize) -> bool {
    if row < 0 || row >= layout.len() as isize {
        return false;
    }

    let row_len = layout[row as usize].len() as isize;
    col >= 0 && col < row_len
}

fn neighbors(layout: &[Vec<char>], row: isize, col: isize) -> Vec<Cell> {
    [
        (row, col - 1),
        (row, col + 1),
        (row - 1, col - 1),
        (row - 1, col),
        (row + 1, col),
        (row + 1, col + 1),
    ]
    .into_iter()
    .filter(|(candidate_row, candidate_col)| {
        is_cell_in_bounds(layout, *candidate_row, *candidate_col)
    })
    .map(|(candidate_row, candidate_col)| (candidate_row as usize, candidate_col as usize))
    .collect()
}

fn touches_all_winning_edges(layout: &[Vec<char>], row: usize, col: usize) -> (bool, bool, bool) {
    (
        col == 0,
        col == layout[row].len().saturating_sub(1),
        row == layout.len().saturating_sub(1),
    )
}

fn merge_touched_edges(
    current: (bool, bool, bool),
    next: (bool, bool, bool),
) -> (bool, bool, bool) {
    (current.0 || next.0, current.1 || next.1, current.2 || next.2)
}

fn has_won(touched_edges: (bool, bool, bool)) -> bool {
    touched_edges.0 && touched_edges.1 && touched_edges.2
}

fn explore_component(
    layout: &[Vec<char>],
    token: char,
    start: Cell,
    visited: &mut HashSet<Cell>,
) -> Option<HashSet<Cell>> {
    let mut queue = VecDeque::from([start]);
    let mut component = HashSet::from([start]);
    let mut touched_edges = (false, false, false);

    visited.insert(start);

    while let Some((row, col)) = queue.pop_front() {
        touched_edges = merge_touched_edges(
            touched_edges,
            touches_all_winning_edges(layout, row, col),
        );

        if has_won(touched_edges) {
            return Some(component);
        }

        for neighbor in neighbors(layout, row as isize, col as isize) {
            let (next_row, next_col) = neighbor;

            if layout[next_row][next_col] != token || visited.contains(&neighbor) {
                continue;
            }

            visited.insert(neighbor);
            component.insert(neighbor);
            queue.push_back(neighbor);
        }
    }

    None
}

fn compute_winner_component(layout: &[Vec<char>], token: char) -> Option<HashSet<Cell>> {
    let mut visited = HashSet::new();

    for row in 0..layout.len() {
        for col in 0..layout[row].len() {
            let cell = (row, col);

            if layout[row][col] != token || visited.contains(&cell) {
                continue;
            }

            if let Some(component) = explore_component(layout, token, cell, &mut visited) {
                return Some(component);
            }
        }
    }

    None
}

fn ordered_pair(a: Cell, b: Cell) -> (Cell, Cell) {
    if a <= b {
        (a, b)
    } else {
        (b, a)
    }
}

fn build_edges(layout: &[Vec<char>], component: &HashSet<Cell>) -> Vec<Edge> {
    let mut edges = vec![];
    let mut seen = HashSet::new();

    for &(row, col) in component {
        for neighbor in neighbors(layout, row as isize, col as isize) {
            if !component.contains(&neighbor) {
                continue;
            }

            let pair = ordered_pair((row, col), neighbor);
            if !seen.insert(pair) {
                continue;
            }

            edges.push([[pair.0 .0, pair.0 .1], [pair.1 .0, pair.1 .1]]);
        }
    }

    edges
}

fn result_for_token(layout: &[Vec<char>], token: char) -> Option<(bool, Option<char>, Vec<Edge>)> {
    compute_winner_component(layout, token)
        .map(|component| (true, Some(token), build_edges(layout, &component)))
}

fn compute_result_from_yen(yen: &YEN) -> (bool, Option<char>, Vec<Edge>) {
    let layout = parse_layout(yen.layout());
    if layout.is_empty() {
        return (false, None, vec![]);
    }

    let players = yen.players();
    let player_tokens = [
        players.first().copied().unwrap_or('B'),
        players.get(1).copied().unwrap_or('R'),
    ];

    for token in player_tokens {
        if let Some(result) = result_for_token(&layout, token) {
            return result;
        }
    }

    let any_empty = layout.iter().flatten().any(|&cell| cell == '.');
    if any_empty {
        (false, None, vec![])
    } else {
        (true, None, vec![])
    }
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

    let layout = req.yen.layout().to_string();
    let size = req.yen.size();

    let mut game = GameY::try_from(req.yen)
        .map_err(|err| bad_request(&format!("Invalid YEN format: {}", err), version))?;

    if game.check_game_over() {
        return Err(bad_request("Game is already over", version));
    }

    let coords = row_col_to_coords(&layout, size, req.row, req.col)
        .map_err(|msg| bad_request(&format!("Invalid coordinates: {}", msg), version))?;

    let current_player = game
        .next_player()
        .ok_or_else(|| bad_request("No next player available", version))?;

    game.add_move(Movement::Placement {
        player: current_player,
        coords,
    })
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

    const API_VERSION: &str = "v1";

    fn test_app() -> axum::Router {
        create_router(AppState::new(YBotRegistry::new()))
    }

    fn new_yen(size: u32) -> crate::YEN {
        let game = crate::GameY::new(size);
        (&game).into()
    }

    fn post_pvp(body: &PvpMoveRequest, version: &str) -> Request<Body> {
        Request::post(format!("/{version}/game/pvp/move"))
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(body).unwrap()))
            .unwrap()
    }

    async fn send_pvp(body: PvpMoveRequest, version: &str) -> axum::response::Response {
        test_app().oneshot(post_pvp(&body, version)).await.unwrap()
    }

    async fn expect_bad_request(yen: crate::YEN, row: usize, col: usize, version: &str) {
        let response = send_pvp(PvpMoveRequest { yen, row, col }, version).await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_pvp_valid_request() {
        let response = send_pvp(
            PvpMoveRequest {
                yen: new_yen(3),
                row: 0,
                col: 0,
            },
            API_VERSION,
        )
        .await;

        assert_eq!(response.status(), StatusCode::OK);

        let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let parsed: PvpMoveResponse = serde_json::from_slice(&bytes).unwrap();

        assert_eq!(parsed.yen.size(), 3);
        assert_eq!(parsed.yen.turn(), 1);
    }

    #[tokio::test]
    async fn test_pvp_rejects_invalid_inputs() {
        let invalid_cases = [
            (new_yen(3), 0, 0, "v2"),
            (new_yen(3), 99, 0, API_VERSION),
            (new_yen(3), 0, 99, API_VERSION),
            (
                crate::YEN::new(3, 0, vec!['B', 'R'], "X/../...".to_string()),
                0,
                0,
                API_VERSION,
            ),
        ];

        for (yen, row, col, version) in invalid_cases {
            expect_bad_request(yen, row, col, version).await;
        }
    }

    #[tokio::test]
    async fn test_pvp_rejects_finished_game() {
        let mut game = crate::GameY::new(1);

        game.add_move(crate::Movement::Placement {
            player: crate::PlayerId::new(0),
            coords: crate::Coordinates::new(0, 0, 0),
        })
        .unwrap();

        expect_bad_request((&game).into(), 0, 0, API_VERSION).await;
    }

    #[tokio::test]
    async fn test_pvp_rejects_occupied_cell() {
        let mut game = crate::GameY::new(3);

        game.add_move(crate::Movement::Placement {
            player: crate::PlayerId::new(0),
            coords: crate::Coordinates::new(2, 0, 0),
        })
        .unwrap();

        expect_bad_request((&game).into(), 0, 0, API_VERSION).await;
    }

    #[test]
    fn test_parse_layout_empty() {
        assert!(parse_layout("").is_empty());
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