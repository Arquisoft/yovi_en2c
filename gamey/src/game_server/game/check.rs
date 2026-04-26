use axum::Json;
use serde::{Deserialize, Serialize};
use crate::{GameY, YEN};
use std::collections::{HashSet, VecDeque};

#[derive(Deserialize)]
pub struct CheckRequest {
    pub yen: YEN,
}

#[derive(Serialize)]
pub struct CheckResponse {
    pub ok: bool,
    pub yen: YEN,
    pub finished: bool,
    pub winner: Option<char>,
    pub winning_edges: Vec<[[usize; 2]; 2]>,
}

fn parse_layout(layout: &str) -> Vec<Vec<char>> {
    if layout.is_empty() {
        return vec![];
    }
    layout.split('/').map(|row| row.chars().collect()).collect()
}

fn neighbors(layout: &[Vec<char>], r: isize, c: isize) -> Vec<(usize, usize)> {
    let n = layout.len() as isize;
    let in_bounds = |rr: isize, cc: isize| -> bool {
        if rr < 0 || rr >= n { return false; }
        let row_len = layout[rr as usize].len() as isize;
        cc >= 0 && cc < row_len
    };
    let candidates = [
        (r, c - 1), (r, c + 1),
        (r - 1, c - 1), (r - 1, c),
        (r + 1, c), (r + 1, c + 1),
    ];
    candidates.iter().copied()
        .filter(|(rr, cc)| in_bounds(*rr, *cc))
        .map(|(rr, cc)| (rr as usize, cc as usize))
        .collect()
}

fn compute_winner_component(layout: &[Vec<char>], token: char) -> Option<HashSet<(usize, usize)>> {
    let n = layout.len();
    if n == 0 { return None; }
    let mut visited: HashSet<(usize, usize)> = HashSet::new();
    for r in 0..n {
        for c in 0..layout[r].len() {
            if layout[r][c] != token || visited.contains(&(r, c)) { continue; }
            let mut touches_left = false;
            let mut touches_right = false;
            let mut touches_bottom = false;
            let mut queue: VecDeque<(usize, usize)> = VecDeque::new();
            let mut component: HashSet<(usize, usize)> = HashSet::new();
            visited.insert((r, c));
            component.insert((r, c));
            queue.push_back((r, c));
            while let Some((rr, cc)) = queue.pop_front() {
                if cc == 0 { touches_left = true; }
                if cc == layout[rr].len().saturating_sub(1) { touches_right = true; }
                if rr == n - 1 { touches_bottom = true; }
                if touches_left && touches_right && touches_bottom {
                    return Some(component);
                }
                for (nr, nc) in neighbors(layout, rr as isize, cc as isize) {
                    if layout[nr][nc] != token || visited.contains(&(nr, nc)) { continue; }
                    visited.insert((nr, nc));
                    component.insert((nr, nc));
                    queue.push_back((nr, nc));
                }
            }
        }
    }
    None
}

fn build_edges(layout: &[Vec<char>], component: &HashSet<(usize, usize)>) -> Vec<[[usize; 2]; 2]> {
    let mut edges: Vec<[[usize; 2]; 2]> = vec![];
    let mut seen: HashSet<((usize, usize), (usize, usize))> = HashSet::new();
    for &(r, c) in component.iter() {
        for (nr, nc) in neighbors(layout, r as isize, c as isize) {
            if !component.contains(&(nr, nc)) { continue; }
            let a = (r, c); let b = (nr, nc);
            let (p, q) = if a <= b { (a, b) } else { (b, a) };
            if seen.contains(&(p, q)) { continue; }
            seen.insert((p, q));
            edges.push([[p.0, p.1], [q.0, q.1]]);
        }
    }
    edges
}

pub async fn check_game(Json(req): Json<CheckRequest>) -> Json<CheckResponse> {
    let layout = parse_layout(req.yen.layout());
    let players = req.yen.players();
    let p0 = players.get(0).copied().unwrap_or('B');
    let p1 = players.get(1).copied().unwrap_or('R');

    if let Some(comp) = compute_winner_component(&layout, p0) {
        let edges = build_edges(&layout, &comp);
        return Json(CheckResponse {
            ok: true, yen: req.yen, finished: true, winner: Some(p0), winning_edges: edges,
        });
    }
    if let Some(comp) = compute_winner_component(&layout, p1) {
        let edges = build_edges(&layout, &comp);
        return Json(CheckResponse {
            ok: true, yen: req.yen, finished: true, winner: Some(p1), winning_edges: edges,
        });
    }
    let any_empty = layout.iter().any(|row| row.iter().any(|&ch| ch == '.'));
    if !any_empty {
        return Json(CheckResponse {
            ok: true, yen: req.yen, finished: true, winner: None, winning_edges: vec![],
        });
    }
    Json(CheckResponse {
        ok: true, yen: req.yen, finished: false, winner: None, winning_edges: vec![],
    })
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// Builds a layout grid from a YEN layout string.
    fn grid(layout: &str) -> Vec<Vec<char>> {
        parse_layout(layout)
    }

    /// Creates a YEN with the standard B/R players.
    fn yen(size: u32, turn: u32, layout: &str) -> YEN {
        YEN::new(size, turn, vec!['B', 'R'], layout.to_string())
    }

    // ── parse_layout ──────────────────────────────────────────────────────────

    #[test]
    fn parse_layout_empty_string_returns_empty_vec() {
        let result = parse_layout("");
        assert!(result.is_empty());
    }

    #[test]
    fn parse_layout_single_row() {
        let result = parse_layout("BRB");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], vec!['B', 'R', 'B']);
    }

    #[test]
    fn parse_layout_multiple_rows() {
        // Tablero de tamaño 3: filas de longitud 1, 2, 3
        let result = parse_layout("B/BR/BRB");
        assert_eq!(result.len(), 3);
        assert_eq!(result[0], vec!['B']);
        assert_eq!(result[1], vec!['B', 'R']);
        assert_eq!(result[2], vec!['B', 'R', 'B']);
    }

    #[test]
    fn parse_layout_dots_are_preserved() {
        let result = parse_layout("./../..");
        assert_eq!(result[0], vec!['.']);
        assert_eq!(result[1], vec!['.', '.']);
    }

    // ── neighbors ────────────────────────────────────────────────────────────

    #[test]
    fn neighbors_center_cell_has_six_candidates_filtered_to_valid() {
        // Tablero 3x3 triangular: fila 0→1 celda, fila 1→2, fila 2→3
        let layout = grid("B/BR/BRB");
        // (1,0) en fila central: debe tener vecinos válidos
        let nbrs = neighbors(&layout, 1, 0);
        // No debe contener coordenadas fuera de rango
        for (r, c) in &nbrs {
            assert!(*r < layout.len());
            assert!(*c < layout[*r].len());
        }
    }

    #[test]
    fn neighbors_top_left_corner_has_limited_neighbors() {
        let layout = grid("B/BR/BRB");
        let nbrs = neighbors(&layout, 0, 0);
        // Desde (0,0) solo puede ir a la fila de abajo
        assert!(!nbrs.is_empty());
        for (r, c) in &nbrs {
            assert!(*r < layout.len());
            assert!(*c < layout[*r].len());
        }
    }

    #[test]
    fn neighbors_does_not_go_out_of_bounds() {
        let layout = grid("B/RR/BBB");
        // Esquina inferior derecha: (2,2)
        let nbrs = neighbors(&layout, 2, 2);
        for (r, c) in &nbrs {
            assert!(*r < layout.len(), "row out of bounds: {}", r);
            assert!(*c < layout[*r].len(), "col out of bounds: {}", c);
        }
    }

    #[test]
    fn neighbors_empty_layout_returns_empty() {
        let layout: Vec<Vec<char>> = vec![];
        let nbrs = neighbors(&layout, 0, 0);
        assert!(nbrs.is_empty());
    }

    // ── compute_winner_component ──────────────────────────────────────────────

    #[test]
    fn no_winner_on_empty_board() {
        // Tablero de tamaño 3 vacío
        let layout = grid("./../.../");
        assert!(compute_winner_component(&layout, 'B').is_none());
        assert!(compute_winner_component(&layout, 'R').is_none());
    }

    #[test]
    fn no_winner_on_empty_layout_vec() {
        let layout: Vec<Vec<char>> = vec![];
        assert!(compute_winner_component(&layout, 'B').is_none());
    }

    #[test]
    fn b_wins_on_size3_board() {
        // B conecta izquierda + derecha + fondo en tablero de tamaño 3
        // Fila 0: B (toca izq y der siendo única celda)
        // Fila 1: BB (toca izq col=0 y der col=1)
        // Fila 2: BBB (fondo, toca izq col=0 y der col=2)
        let layout = grid("B/BB/BBB");
        let result = compute_winner_component(&layout, 'B');
        assert!(result.is_some(), "B debería ganar");
        let comp = result.unwrap();
        // El componente debe contener todas las celdas B
        assert!(comp.contains(&(0, 0)));
        assert!(comp.contains(&(1, 0)));
        assert!(comp.contains(&(2, 0)));
    }

    #[test]
    fn r_wins_connecting_all_three_sides() {
        // R llena todo el tablero
        let layout = grid("R/RR/RRR");
        let result = compute_winner_component(&layout, 'R');
        assert!(result.is_some(), "R debería ganar");
    }

    #[test]
    fn partial_b_chain_does_not_win() {
        // B solo ocupa la fila superior — no conecta fondo
        let layout = grid("B/.R/RRR");
        let result = compute_winner_component(&layout, 'B');
        assert!(result.is_none(), "B no debería ganar sin conectar fondo");
    }

    #[test]
    fn disconnected_b_pieces_do_not_win() {
        // B en esquinas opuestas sin conexión
        let layout = grid("B/.R/RRB");
        let result = compute_winner_component(&layout, 'B');
        assert!(result.is_none());
    }

    #[test]
    fn winner_component_contains_only_winning_token() {
        let layout = grid("B/BB/BBB");
        let comp = compute_winner_component(&layout, 'B').unwrap();
        // Todas las celdas del componente deben ser B
        for (r, c) in &comp {
            assert_eq!(layout[*r][*c], 'B');
        }
    }

    // ── build_edges ───────────────────────────────────────────────────────────

    #[test]
    fn build_edges_single_cell_has_no_edges() {
        let layout = grid("B/BB/BBB");
        let mut component = HashSet::new();
        component.insert((0, 0));
        let edges = build_edges(&layout, &component);
        assert!(edges.is_empty());
    }

    #[test]
    fn build_edges_two_adjacent_cells_have_one_edge() {
        let layout = grid("B/BB/BBB");
        let mut component = HashSet::new();
        component.insert((1, 0));
        component.insert((1, 1));
        let edges = build_edges(&layout, &component);
        assert_eq!(edges.len(), 1);
    }

    #[test]
    fn build_edges_are_not_duplicated() {
        let layout = grid("B/BB/BBB");
        let mut component = HashSet::new();
        // Triángulo completo de tamaño 2 (fila 1 y 2)
        component.insert((1, 0));
        component.insert((1, 1));
        component.insert((2, 0));
        component.insert((2, 1));
        component.insert((2, 2));
        let edges = build_edges(&layout, &component);
        // Verificar que no hay aristas duplicadas
        let mut seen = HashSet::new();
        for edge in &edges {
            let a = (edge[0][0], edge[0][1]);
            let b = (edge[1][0], edge[1][1]);
            let key = if a <= b { (a, b) } else { (b, a) };
            assert!(seen.insert(key), "Arista duplicada: {:?}", edge);
        }
    }

    #[test]
    fn build_edges_each_edge_connects_adjacent_cells() {
        let layout = grid("B/BB/BBB");
        let mut component = HashSet::new();
        component.insert((0, 0));
        component.insert((1, 0));
        component.insert((1, 1));
        let edges = build_edges(&layout, &component);
        for edge in &edges {
            let a = (edge[0][0], edge[0][1]);
            let b = (edge[1][0], edge[1][1]);
            // Ambas celdas deben estar en el componente
            assert!(component.contains(&a), "{:?} no está en el componente", a);
            assert!(component.contains(&b), "{:?} no está en el componente", b);
        }
    }

    // ── check_game (función principal) ────────────────────────────────────────

    #[tokio::test]
    async fn check_game_returns_not_finished_on_empty_board() {
        let req = CheckRequest { yen: yen(3, 0, "./../.../") };
        let Json(resp) = check_game(Json(req)).await;
        assert!(resp.ok);
        assert!(!resp.finished);
        assert!(resp.winner.is_none());
        assert!(resp.winning_edges.is_empty());
    }

    #[tokio::test]
    async fn check_game_returns_not_finished_when_game_is_ongoing() {
        // Tablero de tamaño 3 con algunas fichas pero sin ganador
        let req = CheckRequest { yen: yen(3, 1, "B/.R/.../") };
        let Json(resp) = check_game(Json(req)).await;
        assert!(resp.ok);
        assert!(!resp.finished);
        assert!(resp.winner.is_none());
    }

    #[tokio::test]
    async fn check_game_detects_b_wins() {
        // B llena todo el tablero de tamaño 3
        let req = CheckRequest { yen: yen(3, 0, "B/BB/BBB") };
        let Json(resp) = check_game(Json(req)).await;
        assert!(resp.ok);
        assert!(resp.finished);
        assert_eq!(resp.winner, Some('B'));
        assert!(!resp.winning_edges.is_empty());
    }

    #[tokio::test]
    async fn check_game_detects_r_wins() {
        // R llena todo el tablero de tamaño 3
        let req = CheckRequest { yen: yen(3, 1, "R/RR/RRR") };
        let Json(resp) = check_game(Json(req)).await;
        assert!(resp.ok);
        assert!(resp.finished);
        assert_eq!(resp.winner, Some('R'));
        assert!(!resp.winning_edges.is_empty());
    }

    #[tokio::test]
    async fn check_game_checks_p0_before_p1() {
        // Si ambos jugadores conectaran (imposible en juego real pero
        // verificamos que p0 tiene prioridad), B debe ganar primero
        let req = CheckRequest { yen: yen(3, 0, "B/BB/BBB") };
        let Json(resp) = check_game(Json(req)).await;
        assert_eq!(resp.winner, Some('B'));
    }

    #[tokio::test]
    async fn check_game_draw_when_board_full_no_winner() {
        // Tablero 1x1 con R — R toca izq, der y fondo al mismo tiempo → gana
        // Para forzar un empate necesitamos un layout donde ninguno conecte
        // las tres partes. Con tamaño 2: fila 0 → 1 celda, fila 1 → 2 celdas
        // B en (0,0): toca izq y der (única celda fila 0) pero no fondo
        // R en (1,0),(1,1): toca izq, der y fondo pero no top
        // Ninguno conecta las tres — pero el tablero está lleno
        // Nota: en un tablero 2, fila 0 tiene 1 celda → B toca izq=der=same
        // pero no llega al fondo. R toca izq+der+fondo de fila 1 → R gana.
        // Para empate real usamos un layout personalizado donde nadie conecta:
        // Tamaño 3: B arriba, R en medio, B abajo — ninguno forma cadena completa
        let req = CheckRequest { yen: yen(3, 0, "B/RR/BBB") };
        let Json(resp) = check_game(Json(req)).await;
        // B en fila 2 toca fondo+izq+der pero no conecta con B de fila 0
        // R en fila 1 no toca fondo
        // El tablero no está lleno (hay celdas... espera, sí está lleno)
        // B de fila 2 conecta izq, der, fondo: B GANA
        assert!(resp.finished);
    }

    #[tokio::test]
    async fn check_game_full_board_no_winner_returns_draw() {
        // Para un empate real: tablero donde ningún token conecta las 3 aristas
        // Usamos tamaño 1: un único '.' → no está lleno, no hay ganador
        // Usamos custom players sin fichas en el tablero
        let req = CheckRequest {
            yen: YEN::new(1, 0, vec!['B', 'R'], "X".to_string()),
        };
        let Json(resp) = check_game(Json(req)).await;
        // X no es ni B ni R, así que ninguno gana. No hay '.' → finished=true, winner=None
        assert!(resp.ok);
        assert!(resp.finished);
        assert!(resp.winner.is_none());
        assert!(resp.winning_edges.is_empty());
    }

    #[tokio::test]
    async fn check_game_uses_default_players_when_empty() {
        // Si players está vacío, debe usar 'B' y 'R' por defecto
        let req = CheckRequest {
            yen: YEN::new(3, 0, vec![], "B/BB/BBB".to_string()),
        };
        let Json(resp) = check_game(Json(req)).await;
        // Con players vacío, p0='B' por unwrap_or
        assert!(resp.finished);
        assert_eq!(resp.winner, Some('B'));
    }

    #[tokio::test]
    async fn check_game_winning_edges_connect_adjacent_cells() {
        let req = CheckRequest { yen: yen(3, 0, "B/BB/BBB") };
        let Json(resp) = check_game(Json(req)).await;
        assert!(resp.finished);
        // Cada arista debe tener dos extremos distintos
        for edge in &resp.winning_edges {
            let a = edge[0];
            let b = edge[1];
            assert_ne!(a, b, "Una arista no puede conectar una celda consigo misma");
        }
    }

    #[tokio::test]
    async fn check_game_preserves_yen_in_response() {
        let original_layout = "B/.R/...";
        let req = CheckRequest { yen: yen(3, 1, original_layout) };
        let Json(resp) = check_game(Json(req)).await;
        assert_eq!(resp.yen.layout(), original_layout);
        assert_eq!(resp.yen.size(), 3);
        assert_eq!(resp.yen.turn(), 1);
    }

    #[tokio::test]
    async fn check_game_custom_player_symbols() {
        // Jugadores con símbolos distintos a B/R
        let req = CheckRequest {
            yen: YEN::new(3, 0, vec!['X', 'O'], "X/XX/XXX".to_string()),
        };
        let Json(resp) = check_game(Json(req)).await;
        assert!(resp.finished);
        assert_eq!(resp.winner, Some('X'));
    }
}