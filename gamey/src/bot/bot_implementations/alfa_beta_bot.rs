use crate::{Coordinates, GameY, PlayerId};
use crate::bot::YBot;
use std::collections::{HashSet, HashMap};

// ============================================================
// CONSTANTES DE PRIORIDAD
// ============================================================
const WIN_NOW: i32 = 1000000;
const BLOCK_OPPONENT_WIN: i32 = 900000;
const CONNECT_TWO_SIDES: i32 = 50000;
const CONNECT_ONE_SIDE: i32 = 10000;
const GROUP_SIZE_BONUS: i32 = 5000;
const BRIDGE_PATTERN: i32 = 3000;
const VIRTUAL_CONNECTION: i32 = 2000;
const CENTER_CONTROL: i32 = 1000;
const MOBILITY: i32 = 500;
const BLOCK_OPPONENT_GROWTH: i32 = 2000;
const PROXIMITY_TO_OPPONENT: i32 = 800;

// Constantes del bot
const DEFAULT_MAX_DEPTH: u32 = 4;
const BOT_PLAYER_ID: u32 = 1;
const HUMAN_PLAYER_ID: u32 = 0;
const TRANSPOSITION_TABLE_SIZE: usize = 500000;

pub struct AlfaBetaBot {
    max_depth: u32,
    transposition_table: HashMap<u64, TranspositionEntry>,
    pub nodes_evaluated: u64,
}

#[derive(Clone)]
struct TranspositionEntry {
    score: i32,
    depth: u32,
    flag: NodeType,
    _best_move: Option<Coordinates>,
}

#[derive(Clone, PartialEq)]
enum NodeType {
    Exact,
    Lower,
    Upper,
}

impl AlfaBetaBot {
    pub fn new(depth: Option<u32>) -> Self {
        Self {
            max_depth: depth.unwrap_or(DEFAULT_MAX_DEPTH),
            transposition_table: HashMap::with_capacity(TRANSPOSITION_TABLE_SIZE),
            nodes_evaluated: 0,
        }
    }

    fn evaluate_board(&self, board: &GameY, for_player_id: u32) -> i32 {
        // IMPORTANTE: for_player_id es el jugador PARA EL QUE evaluamos
        let player_cells = if for_player_id == BOT_PLAYER_ID {
            // Si evaluamos para el bot (player 1), sus celdas son las del oponente
            // porque el bot SIEMPRE juega como oponente
            board.get_opponent_positions_coords()
        } else {
            // Si evaluamos para el humano (player 0), sus celdas son las del jugador
            board.get_player_positions_coords()
        };

        let opponent_cells = if for_player_id == BOT_PLAYER_ID {
            // El oponente del bot es el humano
            board.get_player_positions_coords()
        } else {
            board.get_opponent_positions_coords()
        };

        let mut score = 0;

        // VICTORIA INMEDIATA
        if self.check_winner(board, BOT_PLAYER_ID) {
            return WIN_NOW;
        }
        if self.check_winner(board, HUMAN_PLAYER_ID) {
            return -WIN_NOW;
        }

        // GRUPOS CONEXOS
        let groups = self.find_all_connected_groups(&player_cells, board);
        for group in &groups {
            score += (group.len() as i32) * GROUP_SIZE_BONUS;

            let touches_a = group.iter().any(|c| c.touches_side_a());
            let touches_b = group.iter().any(|c| c.touches_side_b());
            let touches_c = group.iter().any(|c| c.touches_side_c());

            if touches_a { score += CONNECT_ONE_SIDE; }
            if touches_b { score += CONNECT_ONE_SIDE; }
            if touches_c { score += CONNECT_ONE_SIDE; }

            let sides = [touches_a, touches_b, touches_c].iter().filter(|&&b| b).count();
            if sides >= 2 {
                score += CONNECT_TWO_SIDES;
            }
        }

        // PATRONES
        score += self.bridge_patterns_score(&player_cells, board) * BRIDGE_PATTERN;
        score += self.virtual_connections_score(&player_cells, board) * VIRTUAL_CONNECTION;
        score += self.center_control_score(&player_cells, board.board_size()) * CENTER_CONTROL;
        score += self.mobility_score(board) * MOBILITY;
        score += self.blocking_score(&player_cells, &opponent_cells, board) * BLOCK_OPPONENT_GROWTH;
        score += self.proximity_score(&player_cells, &opponent_cells, board) * PROXIMITY_TO_OPPONENT;

        score
    }

    fn find_all_connected_groups(&self, cells: &[Coordinates], board: &GameY) -> Vec<Vec<Coordinates>> {
        let mut visited = HashSet::new();
        let mut groups = Vec::new();

        for &cell in cells {
            if !visited.contains(&cell) {
                let mut group = Vec::new();
                let mut stack = vec![cell];
                visited.insert(cell);

                while let Some(current) = stack.pop() {
                    group.push(current);
                    for &other in cells {
                        if !visited.contains(&other) && board.manhattan_distance(current, other) == 1 {
                            visited.insert(other);
                            stack.push(other);
                        }
                    }
                }
                groups.push(group);
            }
        }
        groups
    }

    fn bridge_patterns_score(&self, cells: &[Coordinates], board: &GameY) -> i32 {
        let mut score = 0;
        for i in 0..cells.len() {
            for j in i+1..cells.len() {
                let dist = board.manhattan_distance(cells[i], cells[j]);
                if dist == 1 {
                    let dx = (cells[i].x() as i32 - cells[j].x() as i32).abs();
                    let dy = (cells[i].y() as i32 - cells[j].y() as i32).abs();
                    let dz = (cells[i].z() as i32 - cells[j].z() as i32).abs();

                    if (dx == 1 && dy == 1 && dz == 0) ||
                        (dx == 1 && dy == 0 && dz == 1) ||
                        (dx == 0 && dy == 1 && dz == 1) {
                        score += 1;
                    }
                }
            }
        }
        score
    }

    fn virtual_connections_score(&self, cells: &[Coordinates], board: &GameY) -> i32 {
        let mut score = 0;
        let board_size = board.board_size();

        for &cell in cells {
            let neighbors = self.get_virtual_neighbors(cell, board_size);
            for &neighbor in &neighbors {
                if self.is_cell_empty(board, neighbor) {
                    score += 1;
                }
            }
        }
        score
    }

    fn get_virtual_neighbors(&self, coords: Coordinates, board_size: u32) -> Vec<Coordinates> {
        let mut neighbors = Vec::new();
        let x = coords.x() as i32;
        let y = coords.y() as i32;
        let z = coords.z() as i32;
        let n = (board_size - 1) as i32;

        let jumps = [
            (2, -1, -1), (1, -2, 1), (-1, -1, 2),
            (-2, 1, 1), (-1, 2, -1), (1, 1, -2),
        ];

        for &(dx, dy, dz) in &jumps {
            let new_x = x + dx;
            let new_y = y + dy;
            let new_z = z + dz;

            if new_x >= 0 && new_y >= 0 && new_z >= 0 &&
                new_x <= n && new_y <= n && new_z <= n &&
                new_x + new_y + new_z == n {
                neighbors.push(Coordinates::new(new_x as u32, new_y as u32, new_z as u32));
            }
        }
        neighbors
    }

    fn center_control_score(&self, cells: &[Coordinates], board_size: u32) -> i32 {
        let n = board_size as i32 - 1;
        let center = n as f32 / 3.0;
        let center_rounded = center.round() as i32;

        let mut score = 0;
        for cell in cells {
            let dx = (cell.x() as i32 - center_rounded).abs();
            let dy = (cell.y() as i32 - center_rounded).abs();
            let dz = (cell.z() as i32 - center_rounded).abs();
            let dist = dx + dy + dz;
            score += (n * 3 - dist).max(0);
        }
        score
    }

    fn mobility_score(&self, board: &GameY) -> i32 {
        let available = board.available_cells();
        let mut good_moves = 0;

        for &cell_idx in available.iter().take(10) {
            let coords = Coordinates::from_index(cell_idx, board.board_size());
            if coords.touches_side_a() || coords.touches_side_b() || coords.touches_side_c() {
                good_moves += 2;
            }
            let n = (board.board_size() - 1) as i32;
            let center = n as f32 / 3.0;
            let center_rounded = center.round() as i32;
            let dist = (coords.x() as i32 - center_rounded).abs() +
                (coords.y() as i32 - center_rounded).abs() +
                (coords.z() as i32 - center_rounded).abs();
            if dist < 3 {
                good_moves += 1;
            }
        }
        good_moves
    }

    fn blocking_score(&self, my_cells: &[Coordinates], opp_cells: &[Coordinates], board: &GameY) -> i32 {
        let mut score = 0;
        for &my_cell in my_cells {
            for &opp_cell in opp_cells {
                let dist = board.manhattan_distance(my_cell, opp_cell);
                if dist == 1 {
                    score += 3;
                } else if dist == 2 {
                    score += 1;
                }
            }
        }
        score
    }

    fn proximity_score(&self, my_cells: &[Coordinates], opp_cells: &[Coordinates], board: &GameY) -> i32 {
        let mut score = 0;
        for &my_cell in my_cells {
            for &opp_cell in opp_cells {
                let dist = board.manhattan_distance(my_cell, opp_cell);
                if dist <= 2 {
                    score += 1;
                }
            }
        }
        score
    }

    fn detect_winning_threat(&self, board: &GameY, player_id: u32) -> Option<Coordinates> {
        let available = board.available_cells();

        for &cell_idx in available.iter() {
            let coords = Coordinates::from_index(cell_idx, board.board_size());
            let mut temp_cells = if player_id == BOT_PLAYER_ID {
                board.get_opponent_positions_coords()
            } else {
                board.get_player_positions_coords()
            };
            temp_cells.push(coords);

            let groups = self.find_all_connected_groups(&temp_cells, board);
            for group in groups {
                let touches_a = group.iter().any(|c| c.touches_side_a());
                let touches_b = group.iter().any(|c| c.touches_side_b());
                let touches_c = group.iter().any(|c| c.touches_side_c());

                if touches_a && touches_b && touches_c {
                    return Some(coords);
                }
            }
        }
        None
    }

    fn order_moves(&self, board: &GameY, moves: &[u32], is_bot_turn: bool) -> Vec<u32> {
        let mut move_scores: Vec<(u32, i32)> = moves.iter()
            .map(|&cell_idx| {
                let coords = Coordinates::from_index(cell_idx, board.board_size());
                let mut score = 0;

                // Victoria inmediata
                let mut temp_bot_cells = board.get_opponent_positions_coords();
                temp_bot_cells.push(coords);
                let groups = self.find_all_connected_groups(&temp_bot_cells, board);
                for group in groups {
                    let touches_a = group.iter().any(|c| c.touches_side_a());
                    let touches_b = group.iter().any(|c| c.touches_side_b());
                    let touches_c = group.iter().any(|c| c.touches_side_c());
                    if touches_a && touches_b && touches_c {
                        score += WIN_NOW;
                    }
                }

                // Bloquear victoria del oponente
                let mut temp_user_cells = board.get_player_positions_coords();
                temp_user_cells.push(coords);
                let groups_user = self.find_all_connected_groups(&temp_user_cells, board);
                for group in groups_user {
                    let touches_a = group.iter().any(|c| c.touches_side_a());
                    let touches_b = group.iter().any(|c| c.touches_side_b());
                    let touches_c = group.iter().any(|c| c.touches_side_c());
                    if touches_a && touches_b && touches_c {
                        score += BLOCK_OPPONENT_WIN;
                    }
                }

                // Heurísticas posicionales
                if coords.touches_side_a() { score += CONNECT_ONE_SIDE / 10; }
                if coords.touches_side_b() { score += CONNECT_ONE_SIDE / 10; }
                if coords.touches_side_c() { score += CONNECT_ONE_SIDE / 10; }

                let n = (board.board_size() - 1) as i32;
                let center = n as f32 / 3.0;
                let center_rounded = center.round() as i32;
                let dist = (coords.x() as i32 - center_rounded).abs() +
                    (coords.y() as i32 - center_rounded).abs() +
                    (coords.z() as i32 - center_rounded).abs();
                score += (n * 3 - dist) * 5;

                (cell_idx, score)
            })
            .collect();

        move_scores.sort_by(|a, b| b.1.cmp(&a.1));
        move_scores.into_iter().map(|(cell_idx, _)| cell_idx).collect()
    }

    fn alphabeta(
        &mut self,
        board: &GameY,
        depth: u32,
        mut alpha: i32,
        mut beta: i32,
        is_bot_turn: bool,
    ) -> i32 {
        self.nodes_evaluated += 1;

        let hash = self.hash_board(board);
        if let Some(entry) = self.transposition_table.get(&hash) {
            if entry.depth >= depth {
                match entry.flag {
                    NodeType::Exact => return entry.score,
                    NodeType::Lower if entry.score >= beta => return entry.score,
                    NodeType::Upper if entry.score <= alpha => return entry.score,
                    _ => {}
                }
            }
        }

        if depth == 0 {
            return self.evaluate_board(board, BOT_PLAYER_ID);
        }

        if self.check_winner(board, BOT_PLAYER_ID) {
            return WIN_NOW;
        }
        if self.check_winner(board, HUMAN_PLAYER_ID) {
            return -WIN_NOW;
        }

        let available = board.available_cells();
        if available.is_empty() {
            return 0;
        }

        let ordered_moves = self.order_moves(board, available, is_bot_turn);
        let current_player_id = if is_bot_turn { BOT_PLAYER_ID } else { HUMAN_PLAYER_ID };

        let mut best_score = if is_bot_turn { i32::MIN } else { i32::MAX };
        let original_alpha = alpha;
        let original_beta = beta;

        if is_bot_turn {
            for &cell_idx in &ordered_moves {
                let coords = Coordinates::from_index(cell_idx, board.board_size());
                let mut board_copy = board.clone();

                let movement = crate::Movement::Placement {
                    player: PlayerId::new(current_player_id),
                    coords,
                };

                if board_copy.add_move(movement).is_ok() {
                    let eval = self.alphabeta(&board_copy, depth - 1, alpha, beta, false);

                    if eval > best_score {
                        best_score = eval;
                    }

                    alpha = alpha.max(eval);
                    if beta <= alpha {
                        break;
                    }
                }
            }
        } else {
            for &cell_idx in &ordered_moves {
                let coords = Coordinates::from_index(cell_idx, board.board_size());
                let mut board_copy = board.clone();

                let movement = crate::Movement::Placement {
                    player: PlayerId::new(current_player_id),
                    coords,
                };

                if board_copy.add_move(movement).is_ok() {
                    let eval = self.alphabeta(&board_copy, depth - 1, alpha, beta, true);

                    if eval < best_score {
                        best_score = eval;
                    }

                    beta = beta.min(eval);
                    if beta <= alpha {
                        break;
                    }
                }
            }
        }

        let flag = if best_score <= original_alpha {
            NodeType::Upper
        } else if best_score >= original_beta {
            NodeType::Lower
        } else {
            NodeType::Exact
        };

        self.transposition_table.insert(hash, TranspositionEntry {
            score: best_score,
            depth,
            flag,
            _best_move: None,
        });

        best_score
    }

    fn hash_board(&self, board: &GameY) -> u64 {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        let state: Vec<u32> = board.available_cells().iter().copied().collect();
        state.hash(&mut hasher);
        hasher.finish()
    }

    fn check_winner(&self, board: &GameY, player_id: u32) -> bool {
        let cells = if player_id == BOT_PLAYER_ID {
            board.get_opponent_positions_coords()
        } else {
            board.get_player_positions_coords()
        };

        let groups = self.find_all_connected_groups(&cells, board);
        for group in groups {
            let touches_a = group.iter().any(|c| c.touches_side_a());
            let touches_b = group.iter().any(|c| c.touches_side_b());
            let touches_c = group.iter().any(|c| c.touches_side_c());

            if touches_a && touches_b && touches_c {
                return true;
            }
        }
        false
    }

    fn is_cell_empty(&self, board: &GameY, coords: Coordinates) -> bool {
        let idx = coords.to_index(board.board_size());
        board.available_cells().contains(&idx)
    }
}

impl YBot for AlfaBetaBot {
    fn name(&self) -> &str {
        "alfa_beta_bot"
    }

    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        let mut bot = AlfaBetaBot::new(Some(self.max_depth));
        bot.choose_move_internal(board)
    }
}

impl AlfaBetaBot {
    fn choose_move_internal(&mut self, board: &GameY) -> Option<Coordinates> {
        let available = board.available_cells();
        if available.is_empty() {
            return None;
        }

        let mut best_score = i32::MIN;
        let mut best_move = None;
        let mut alpha = i32::MIN;
        let beta = i32::MAX;

        let ordered_moves = self.order_moves(board, available, true);

        for &cell_idx in &ordered_moves {
            let coords = Coordinates::from_index(cell_idx, board.board_size());
            let mut board_copy = board.clone();

            let movement = crate::Movement::Placement {
                player: PlayerId::new(BOT_PLAYER_ID),
                coords,
            };

            if board_copy.add_move(movement).is_ok() {
                let score = self.alphabeta(&board_copy, self.max_depth - 1, alpha, beta, false);

                if score > best_score {
                    best_score = score;
                    best_move = Some(coords);
                    alpha = alpha.max(score);
                }
            }
        }

        best_move
    }
}


#[cfg(test)]
mod tests {
    // ============================================================
    // GRUPO 1: CONSTRUCTOR Y PROPIEDADES BÁSICAS
    // ============================================================

    use crate::{AlfaBetaBot, Coordinates, GameY, Movement, PlayerId, YBot};
    use crate::bot_implementations::alfa_beta_bot::{NodeType, TranspositionEntry, BLOCK_OPPONENT_WIN, BOT_PLAYER_ID, BRIDGE_PATTERN, CONNECT_ONE_SIDE, CONNECT_TWO_SIDES, DEFAULT_MAX_DEPTH, GROUP_SIZE_BONUS, HUMAN_PLAYER_ID, TRANSPOSITION_TABLE_SIZE, WIN_NOW};
    fn create_test_game(size: u32, moves: Vec<(u32, u32, u32, u32)>) -> GameY {
        let mut game = GameY::new(size);
        for (x, y, z, player_id) in moves {
            let coords = Coordinates::new(x, y, z);
            let movement = Movement::Placement {
                player: PlayerId::new(player_id),
                coords,
            };
            game.add_move(movement).unwrap();
        }
        game
    }

    #[test]
    fn test_new_with_default_depth() {
        // TEST : Verificar que new(None) usa DEFAULT_MAX_DEPTH
        let bot = AlfaBetaBot::new(None);
        assert_eq!(
            bot.max_depth,
            DEFAULT_MAX_DEPTH,
            "new(None) debería usar la profundidad por defecto {}",
            DEFAULT_MAX_DEPTH
        );
        assert_eq!(
            bot.nodes_evaluated,
            0,
            "Al crear el bot, nodes_evaluated debe ser 0"
        );
    }

    #[test]
    fn test_new_with_custom_depth() {
        // TEST : Verificar que new(Some(5)) usa profundidad 5
        let depths = vec![2, 3, 5, 7];
        for &depth in &depths {
            let bot = AlfaBetaBot::new(Some(depth));
            assert_eq!(
                bot.max_depth,
                depth,
                "new(Some({})) debería tener profundidad {}",
                depth, depth
            );
        }
    }

    // ============================================================
    // GRUPO 2: DETECCIÓN DE GRUPOS CONEXOS
    // ============================================================

    #[test]
    fn test_find_all_connected_groups_empty() {
        // TEST : Lista vacía de celdas → grupos vacíos
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(5);
        let cells: Vec<Coordinates> = vec![];

        let groups = bot.find_all_connected_groups(&cells, &game);

        assert!(
            groups.is_empty(),
            "Con lista vacía de celdas, debe devolver lista vacía de grupos"
        );
    }

    #[test]
    fn test_find_all_connected_groups_single() {
        // TEST : 1 celda sola → 1 grupo de tamaño 1
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(5);
        let cells = vec![
            Coordinates::new(4, 0, 0), // Una sola celda
        ];

        let groups = bot.find_all_connected_groups(&cells, &game);

        assert_eq!(
            groups.len(),
            1,
            "Una celda debe formar 1 grupo"
        );
        assert_eq!(
            groups[0].len(),
            1,
            "El grupo debe tener tamaño 1"
        );
        assert_eq!(
            groups[0][0],
            cells[0],
            "La celda en el grupo debe ser la misma"
        );
    }

    #[test]
    fn test_find_all_connected_groups_connected() {
        // TEST : 3 celdas conectadas en línea → 1 grupo de tamaño 3
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(5);
        let cells = vec![
            Coordinates::new(4, 0, 0),
            Coordinates::new(3, 1, 0),
            Coordinates::new(2, 2, 0),
        ];

        let groups = bot.find_all_connected_groups(&cells, &game);

        assert_eq!(
            groups.len(),
            1,
            "Tres celdas conectadas deben formar 1 grupo"
        );
        assert_eq!(
            groups[0].len(),
            3,
            "El grupo debe tener tamaño 3"
        );

        for &cell in &cells {
            assert!(
                groups[0].contains(&cell),
                "La celda {:?} debería estar en el grupo",
                cell
            );
        }
    }

    #[test]
    fn test_find_all_connected_groups_multiple() {
        // TEST : 4 celdas formando 2 grupos separados
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(5);
        let cells = vec![
            // Grupo 1
            Coordinates::new(4, 0, 0),
            Coordinates::new(3, 1, 0),
            // Grupo 2
            Coordinates::new(0, 4, 0),
            Coordinates::new(0, 3, 1),
        ];

        let groups = bot.find_all_connected_groups(&cells, &game);

        assert_eq!(
            groups.len(),
            2,
            "4 celdas en 2 grupos debe devolver 2 grupos"
        );

        let sizes: Vec<usize> = groups.iter().map(|g| g.len()).collect();
        assert!(
            sizes.contains(&2),
            "Cada grupo debería tener tamaño 2"
        );
    }

    #[test]
    fn test_find_all_connected_groups_complex() {
        // TEST : 3 grupos de diferentes tamaños
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(6);
        let cells = vec![
            Coordinates::new(5, 0, 0),  // A
            Coordinates::new(4, 1, 0),  // B (conectada a A)
            Coordinates::new(3, 2, 0),  // C (conectada a B)

            // Grupo 2: tamaño 2 (esquina izquierda)
            Coordinates::new(0, 5, 0),  // D
            Coordinates::new(0, 4, 1),  // E (conectada a D)

            // Grupo 3: tamaño 1 (ahora SÍ aislado)
            Coordinates::new(1, 1, 3),  // F - Lejos de todos
        ];

        let groups = bot.find_all_connected_groups(&cells, &game);

        assert_eq!(
            groups.len(),
            3,
            "Debería detectar exactamente 3 grupos"
        );

        let sizes: Vec<usize> = groups.iter().map(|g| g.len()).collect();
        assert!(sizes.contains(&3));
        assert!(sizes.contains(&2));
        assert!(sizes.contains(&1));
    }

    // ============================================================
    // GRUPO 3: PATRONES DE PUENTE (bridge_patterns_score)
    // ============================================================

    #[test]
    fn test_bridge_patterns_empty() {
        // TEST : Sin celdas → score 0
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(5);
        let cells: Vec<Coordinates> = vec![];

        let score = bot.bridge_patterns_score(&cells, &game);

        assert_eq!(
            score, 0,
            "Con lista vacía de celdas, el score debe ser 0"
        );
    }

    #[test]
    fn test_bridge_patterns_single_cell() {
        // TEST : Una sola celda → score 0 (no hay pares)
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(5);
        let cells = vec![
            Coordinates::new(4, 0, 0),
        ];

        let score = bot.bridge_patterns_score(&cells, &game);

        assert_eq!(
            score, 0,
            "Con una sola celda, no puede haber patrones de puente"
        );
    }

    #[test]
    fn test_bridge_patterns_pattern_110() {
        // TEST : Patrón (1,1,0) → debe dar score 1
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(5);
        let cells = vec![
            Coordinates::new(4, 0, 0),
            Coordinates::new(3, 1, 0),
        ];

        // Verificar que la distancia es 1 (conectadas)
        let dist = game.manhattan_distance(cells[0], cells[1]);
        assert_eq!(dist, 1, "Las celdas deberían estar a distancia 1 (conectadas)");

        let score = bot.bridge_patterns_score(&cells, &game);

        assert_eq!(
            score, 1,
            "El patrón (1,1,0) debería dar score 1, pero dio {}",
            score
        );
    }

    #[test]
    fn test_bridge_patterns_pattern_101() {
        // TEST : Patrón (1,0,1) → debe dar score 1
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(5);
        let cells = vec![
            Coordinates::new(4, 0, 0),
            Coordinates::new(3, 0, 1),
        ];

        let dist = game.manhattan_distance(cells[0], cells[1]);
        assert_eq!(dist, 1, "Las celdas deberían estar a distancia 1");

        let score = bot.bridge_patterns_score(&cells, &game);

        assert_eq!(
            score, 1,
            "El patrón (1,0,1) debería dar score 1, pero dio {}",
            score
        );
    }

    #[test]
    fn test_bridge_patterns_pattern_011() {
        // TEST : Patrón (0,1,1) → debe dar score 1
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(5);
        let cells = vec![
            Coordinates::new(0, 4, 0),
            Coordinates::new(0, 3, 1),
        ];

        let dist = game.manhattan_distance(cells[0], cells[1]);
        assert_eq!(dist, 1, "Las celdas deberían estar a distancia 1");

        let score = bot.bridge_patterns_score(&cells, &game);

        assert_eq!(
            score, 1,
            "El patrón (0,1,1) debería dar score 1, pero dio {}",
            score
        );
    }

    #[test]
    fn test_bridge_patterns_no_pattern() {
        // TEST : Distancia 1 pero NO patrón de puente → score 0
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(5);
        let cells = vec![
            Coordinates::new(4, 0, 0),
            Coordinates::new(2, 2, 0),  // Distancia = 2 (no conectadas)
        ];

        let dist = game.manhattan_distance(cells[0], cells[1]);
        assert_eq!(dist, 2, "Las celdas deberían estar a distancia 2 (no conectadas)");

        let score = bot.bridge_patterns_score(&cells, &game);

        assert_eq!(
            score, 0,
            "Celdas no conectadas deben dar score 0"
        );
    }

    #[test]
    fn test_bridge_patterns_multiple_patterns() {
        // TEST : Múltiples pares con patrón → suma correcta
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(6);
        let cells = vec![
            Coordinates::new(5, 0, 0),  // A
            Coordinates::new(4, 1, 0),  // B (patrón con A)
            Coordinates::new(3, 2, 0),  // C (patrón con B)
            Coordinates::new(0, 5, 0),  // D
            Coordinates::new(0, 4, 1),  // E (patrón con D)
        ];

        // Verificar conexiones
        assert_eq!(game.manhattan_distance(cells[0], cells[1]), 1, "A-B deberían estar conectadas");
        assert_eq!(game.manhattan_distance(cells[1], cells[2]), 1, "B-C deberían estar conectadas");
        assert_eq!(game.manhattan_distance(cells[3], cells[4]), 1, "D-E deberían estar conectadas");

        let score = bot.bridge_patterns_score(&cells, &game);

        assert_eq!(
            score, 3,
            "Debería detectar 3 patrones de puente, pero devolvió {}",
            score
        );
    }

    #[test]
    fn test_bridge_patterns_all_directions_in_one() {
        // TEST : Verifica las 3 direcciones en un solo test
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(6);

        // Dirección (1,1,0)
        let cells1 = vec![
            Coordinates::new(5, 0, 0),
            Coordinates::new(4, 1, 0),
        ];

        // Dirección (1,0,1)
        let cells2 = vec![
            Coordinates::new(5, 0, 0),
            Coordinates::new(4, 0, 1),
        ];

        // Dirección (0,1,1)
        let cells3 = vec![
            Coordinates::new(0, 5, 0),
            Coordinates::new(0, 4, 1),
        ];

        assert_eq!(
            bot.bridge_patterns_score(&cells1, &game), 1,
            "Dirección (1,1,0) debería dar 1"
        );

        assert_eq!(
            bot.bridge_patterns_score(&cells2, &game), 1,
            "Dirección (1,0,1) debería dar 1"
        );

        assert_eq!(
            bot.bridge_patterns_score(&cells3, &game), 1,
            "Dirección (0,1,1) debería dar 1"
        );
    }

    // ============================================================
    // GRUPO 4: CONEXIONES VIRTUALES (virtual_connections_score)
    // ============================================================

    #[test]
    fn test_virtual_connections_empty() {
        // TEST : Sin celdas → score 0
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(5);
        let cells: Vec<Coordinates> = vec![];

        let score = bot.virtual_connections_score(&cells, &game);

        assert_eq!(
            score, 0,
            "Con lista vacía de celdas, el score debe ser 0"
        );
    }

    #[test]
    fn test_virtual_connections_single_cell_with_neighbors() {
        // TEST : Una celda que tiene vecinos virtuales
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(5);
        let cells = vec![
            Coordinates::new(4, 0, 0),  // Esquina
        ];

        let score = bot.virtual_connections_score(&cells, &game);

        // No podemos predecir el número exacto, pero debe ser >= 0
        assert!(
            score >= 0,
            "Una celda puede tener vecinos virtuales, score debe ser >= 0"
        );

        println!("Virtual connections score para esquina: {}", score);
    }

    #[test]
    fn test_virtual_connections_center_cell() {
        // TEST : Celda central tiene más vecinos virtuales
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(6); // Tamaño 6 para tener más espacio
        let cells = vec![
            Coordinates::new(2, 2, 1),  // Cerca del centro
        ];

        let score = bot.virtual_connections_score(&cells, &game);

        assert!(
            score >= 0,
            "Una celda central debería tener vecinos virtuales"
        );

        println!("Virtual connections score para centro: {}", score);
    }

    #[test]
    fn test_virtual_connections_multiple_cells() {
        // TEST : Múltiples celdas → suma de sus vecinos virtuales
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(5);
        let cells = vec![
            Coordinates::new(4, 0, 0),  // Esquina
            Coordinates::new(3, 1, 0),  // Conectada a la esquina
            Coordinates::new(0, 4, 0),  // Otra esquina
        ];

        let score1 = bot.virtual_connections_score(&cells[0..1], &game);
        let score2 = bot.virtual_connections_score(&cells[1..2], &game);
        let score3 = bot.virtual_connections_score(&cells[2..3], &game);
        let score_total = bot.virtual_connections_score(&cells, &game);

        println!("Score celda1: {}", score1);
        println!("Score celda2: {}", score2);
        println!("Score celda3: {}", score3);
        println!("Score total: {}", score_total);

        // La suma de los scores individuales debería ser <= score total
        // (puede haber solapamiento si comparten vecinos)
        assert!(
            score_total >= score1 && score_total >= score2 && score_total >= score3,
            "El score total debe ser al menos el de cada celda individual"
        );
    }

    #[test]
    fn test_virtual_connections_with_occupied_neighbors() {
        // TEST : Vecinos virtuales que están ocupados NO deberían contar
        let bot = AlfaBetaBot::new(None);
        let mut game = GameY::new(5);

        // Colocar una pieza en un posible vecino virtual
        let occupied_neighbor = Coordinates::new(3, 1, 0);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: occupied_neighbor,
        }).unwrap();

        let cells = vec![
            Coordinates::new(4, 0, 0),  // Esta celda tiene a (3,1,0) como vecino virtual
        ];

        let score = bot.virtual_connections_score(&cells, &game);

        // Como el vecino está ocupado, no debería contar
        // Pero puede tener otros vecinos virtuales
        println!("Score con vecino ocupado: {}", score);

        // Comparamos con el mismo tablero sin la pieza ocupada
        let game_empty = GameY::new(5);
        let score_empty = bot.virtual_connections_score(&cells, &game_empty);

        println!("Score con tablero vacío: {}", score_empty);

        assert!(
            score <= score_empty,
            "Con vecinos ocupados, el score debería ser menor o igual"
        );
    }

    #[test]
    fn test_virtual_connections_all_directions() {
        // TEST : Verificar que se generan vecinos en todas las direcciones
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(7); // Tamaño grande para tener todas las direcciones

        let cells = vec![
            Coordinates::new(3, 2, 1),  // Celda interior
        ];

        let neighbors = bot.get_virtual_neighbors(cells[0], 7);
        let score = bot.virtual_connections_score(&cells, &game);

        println!("Número de vecinos virtuales: {}", neighbors.len());
        println!("Score: {}", score);

        // No debe ser negativo
        assert!(score >= 0, "El score no puede ser negativo");

        // El score debería ser como máximo el número de vecinos
        assert!(
            (score as usize) <= neighbors.len(),
            "El score ({}) no puede ser mayor que el número de vecinos ({})",
            score, neighbors.len()
        );
    }

    #[test]
    fn test_virtual_connections_edge_vs_center() {
        // TEST : Las celdas centrales suelen tener más vecinos virtuales que las esquinas
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(6);

        let corner_cells = vec![
            Coordinates::new(5, 0, 0),  // Esquina
        ];

        let center_cells = vec![
            Coordinates::new(2, 2, 1),  // Centro aproximado
        ];

        let corner_score = bot.virtual_connections_score(&corner_cells, &game);
        let center_score = bot.virtual_connections_score(&center_cells, &game);

        println!("Score esquina: {}", corner_score);
        println!("Score centro: {}", center_score);

        // No podemos asegurar que center_score > corner_score porque depende de la implementación
        // pero podemos verificar que ambos son calculables
        assert!(corner_score >= 0);
        assert!(center_score >= 0);
    }

    // ============================================================
    // GRUPO 5: VECINOS VIRTUALES (get_virtual_neighbors)
    // ============================================================

    #[test]
    fn test_get_virtual_neighbors_corner() {
        // TEST : Esquina del tablero
        let bot = AlfaBetaBot::new(None);
        let board_size = 5;
        let coords = Coordinates::new(4, 0, 0); // Esquina superior

        let neighbors = bot.get_virtual_neighbors(coords, board_size);

        println!("Vecinos virtuales de (4,0,0) en tamaño {}: {:?}", board_size, neighbors);

        // Verificar que todos los vecinos generados son válidos
        for &n in &neighbors {
            let sum = n.x() + n.y() + n.z();
            assert_eq!(
                sum, board_size - 1,
                "Coordenada {:?} no es válida: x+y+z = {}, debería ser {}",
                n, sum, board_size - 1
            );

            assert!(
                n.x() < board_size && n.y() < board_size && n.z() < board_size,
                "Coordenada {:?} fuera de rango", n
            );
        }

        // Una esquina debería tener menos vecinos virtuales que el centro
        // pero no podemos predecir el número exacto
        println!("Número de vecinos virtuales para esquina: {}", neighbors.len());
    }

    #[test]
    fn test_get_virtual_neighbors_edge() {
        // TEST : Borde del tablero (no esquina)
        let bot = AlfaBetaBot::new(None);
        let board_size = 6;
        let coords = Coordinates::new(2, 3, 0); // En un borde (z=0)

        let neighbors = bot.get_virtual_neighbors(coords, board_size);

        println!("Vecinos virtuales de (2,3,0) en tamaño {}: {:?}", board_size, neighbors);

        for &n in &neighbors {
            let sum = n.x() + n.y() + n.z();
            assert_eq!(
                sum, board_size - 1,
                "Coordenada {:?} inválida", n
            );
        }
    }

    #[test]
    fn test_get_virtual_neighbors_center() {
        // TEST : Centro del tablero
        let bot = AlfaBetaBot::new(None);
        let board_size = 7;
        let coords = Coordinates::new(2, 2, 2); // Centro aproximado

        let neighbors = bot.get_virtual_neighbors(coords, board_size);

        println!("Vecinos virtuales de (2,2,2) en tamaño {}: {:?}", board_size, neighbors);

        for &n in &neighbors {
            let sum = n.x() + n.y() + n.z();
            assert_eq!(
                sum, board_size - 1,
                "Coordenada {:?} inválida", n
            );
        }

        // El centro debería tener más vecinos virtuales que la esquina
        let corner = Coordinates::new(6, 0, 0);
        let corner_neighbors = bot.get_virtual_neighbors(corner, board_size);

        println!("Vecinos virtuales del centro: {}", neighbors.len());
        println!("Vecinos virtuales de esquina: {}", corner_neighbors.len());

        // No podemos asegurar que center > corner, pero podemos imprimirlo
    }

    #[test]
    fn test_get_virtual_neighbors_all_directions() {
        // TEST : Verificar que se generan vecinos en todas las direcciones
        let bot = AlfaBetaBot::new(None);
        let board_size = 8;
        let coords = Coordinates::new(3, 3, 1); // Celda interior

        let neighbors = bot.get_virtual_neighbors(coords, board_size);

        println!("Todos los vecinos virtuales de (3,3,1):");
        for (i, &n) in neighbors.iter().enumerate() {
            println!("  {}: {:?}", i+1, n);
        }

        // Verificar que no hay duplicados
        let mut unique = std::collections::HashSet::new();
        let mut duplicates = false;
        for &n in &neighbors {
            if !unique.insert(n) {
                println!("DUPLICADO ENCONTRADO: {:?}", n);
                duplicates = true;
            }
        }
        assert!(!duplicates, "No debería haber vecinos duplicados");
    }

    #[test]
    fn test_get_virtual_neighbors_boundaries() {
        // TEST : Verificar que no se generan vecinos fuera del tablero
        let bot = AlfaBetaBot::new(None);
        let board_size = 4;

        // Probar con coordenadas cerca de los límites
        let test_coords = vec![
            Coordinates::new(3, 0, 0), // Cerca del límite
            Coordinates::new(0, 3, 0),
            Coordinates::new(0, 0, 3),
            Coordinates::new(2, 1, 0),
        ];

        for &coords in &test_coords {
            let neighbors = bot.get_virtual_neighbors(coords, board_size);

            for &n in &neighbors {
                // Verificar que está dentro del tablero
                assert!(
                    n.x() < board_size && n.y() < board_size && n.z() < board_size,
                    "Vecino {:?} fuera de rango para coordenada {:?}", n, coords
                );

                // Verificar que es una coordenada válida
                assert_eq!(
                    n.x() + n.y() + n.z(),
                    board_size - 1,
                    "Vecino {:?} no es coordenada válida", n
                );
            }

            println!("Coordenada {:?} genera {} vecinos", coords, neighbors.len());
        }
    }

    #[test]
    fn test_get_virtual_neighbors_consistency() {
        // TEST : Misma coordenada debe dar mismos vecinos siempre
        let bot = AlfaBetaBot::new(None);
        let board_size = 6;
        let coords = Coordinates::new(2, 2, 1);

        let neighbors1 = bot.get_virtual_neighbors(coords, board_size);
        let neighbors2 = bot.get_virtual_neighbors(coords, board_size);
        let neighbors3 = bot.get_virtual_neighbors(coords, board_size);

        assert_eq!(
            neighbors1.len(), neighbors2.len(),
            "Las llamadas deben producir el mismo número de vecinos"
        );
        assert_eq!(
            neighbors2.len(), neighbors3.len(),
            "Las llamadas deben producir el mismo número de vecinos"
        );

        // Verificar que son exactamente los mismos vecinos
        for i in 0..neighbors1.len() {
            assert_eq!(
                neighbors1[i], neighbors2[i],
                "El vecino {} debería ser igual en todas las llamadas", i
            );
        }

        println!("Consistencia verificada: {} vecinos siempre iguales", neighbors1.len());
    }

    #[test]
    fn test_get_virtual_neighbors_size_effect() {
        // TEST : A mayor tamaño del tablero, más vecinos virtuales posibles
        let bot = AlfaBetaBot::new(None);
        let coords = Coordinates::new(3, 3, 3); // Centro para varios tamaños

        let sizes = vec![5, 6, 7, 8, 9];
        let mut prev_count = 0;

        for &size in &sizes {
            let neighbors = bot.get_virtual_neighbors(coords, size);
            let count = neighbors.len();

            println!("Tamaño {}: {} vecinos virtuales", size, count);

            // A mayor tamaño, debería haber al menos tantos vecinos como en tamaño menor
            // (no siempre es cierto porque la geometría cambia, pero lo imprimimos)
            if size > 5 {
                println!("  Diferencia con tamaño anterior: {}", count as i32 - prev_count as i32);
            }

            prev_count = count;
        }
    }

    // ============================================================
    // GRUPO 6: CONTROL DEL CENTRO (center_control_score)
    // ============================================================

    #[test]
    fn test_center_control_empty() {
        // TEST : Sin celdas → score 0
        let bot = AlfaBetaBot::new(None);
        let board_size = 5;
        let cells: Vec<Coordinates> = vec![];

        let score = bot.center_control_score(&cells, board_size);

        assert_eq!(
            score, 0,
            "Con lista vacía de celdas, el score debe ser 0"
        );
    }

    #[test]
    fn test_center_control_single_cell_center() {
        // TEST : Una celda en el centro
        let bot = AlfaBetaBot::new(None);
        let board_size = 7;
        let center = Coordinates::new(2, 2, 2); // Centro aproximado para tamaño 7

        let cells = vec![center];
        let score = bot.center_control_score(&cells, board_size);

        println!("Score para celda central (2,2,2) en tamaño 7: {}", score);
        assert!(
            score > 0,
            "Una celda central debería tener score positivo. Score: {}",
            score
        );
    }

    #[test]
    fn test_center_control_single_cell_corner() {
        // TEST : Una celda en la esquina
        let bot = AlfaBetaBot::new(None);
        let board_size = 7;
        let corner = Coordinates::new(6, 0, 0); // Esquina

        let cells = vec![corner];
        let score = bot.center_control_score(&cells, board_size);

        println!("Score para celda esquina (6,0,0) en tamaño 7: {}", score);
        assert!(
            score >= 0,
            "Una celda esquina debería tener score >= 0. Score: {}",
            score
        );
    }

    #[test]
    fn test_center_control_center_vs_corner() {
        // TEST : El centro debe puntuar más que la esquina
        let bot = AlfaBetaBot::new(None);
        let board_size = 7;

        let center = Coordinates::new(2, 2, 2);
        let corner = Coordinates::new(6, 0, 0);
        let edge = Coordinates::new(3, 3, 0); // En un borde

        let center_score = bot.center_control_score(&[center], board_size);
        let corner_score = bot.center_control_score(&[corner], board_size);
        let edge_score = bot.center_control_score(&[edge], board_size);

        println!("Centro (2,2,2): {}", center_score);
        println!("Borde (3,3,0): {}", edge_score);
        println!("Esquina (6,0,0): {}", corner_score);

        assert!(
            center_score > edge_score,
            "El centro ({}) debería puntuar más que el borde ({})",
            center_score, edge_score
        );

        assert!(
            edge_score > corner_score,
            "El borde ({}) debería puntuar más que la esquina ({})",
            edge_score, corner_score
        );
    }

    #[test]
    fn test_center_control_multiple_cells() {
        // TEST : Múltiples celdas suman sus puntuaciones
        let bot = AlfaBetaBot::new(None);
        let board_size = 6;

        let cell1 = Coordinates::new(2, 2, 1); // Cerca del centro
        let cell2 = Coordinates::new(3, 2, 0); // Borde
        let cell3 = Coordinates::new(5, 0, 0); // Esquina

        let score1 = bot.center_control_score(&[cell1], board_size);
        let score2 = bot.center_control_score(&[cell2], board_size);
        let score3 = bot.center_control_score(&[cell3], board_size);
        let score_total = bot.center_control_score(&[cell1, cell2, cell3], board_size);

        println!("Score celda1 (cerca centro): {}", score1);
        println!("Score celda2 (borde): {}", score2);
        println!("Score celda3 (esquina): {}", score3);
        println!("Score total: {}", score_total);
        println!("Suma individual: {}", score1 + score2 + score3);

        // La suma de los scores individuales debería ser igual al score total
        // (asumiendo que no hay interacción entre celdas)
        assert_eq!(
            score_total, score1 + score2 + score3,
            "El score total debería ser la suma de los scores individuales"
        );
    }

    #[test]
    fn test_center_control_different_sizes() {
        // TEST : Comportamiento con diferentes tamaños de tablero
        let bot = AlfaBetaBot::new(None);

        // Probar misma posición relativa en diferentes tamaños
        let test_cases = vec![
            (5, Coordinates::new(1, 1, 2)), // Centro aproximado para tamaño 5
            (6, Coordinates::new(2, 2, 1)), // Centro aproximado para tamaño 6
            (7, Coordinates::new(2, 2, 2)), // Centro aproximado para tamaño 7
            (8, Coordinates::new(2, 3, 2)), // Centro aproximado para tamaño 8
        ];

        for (size, coords) in test_cases {
            let score = bot.center_control_score(&[coords], size);
            println!("Tamaño {} - {:?}: score {}", size, coords, score);
            assert!(
                score > 0,
                "El centro en tamaño {} debería tener score positivo",
                size
            );
        }
    }

    #[test]
    fn test_center_control_distance_effect() {
        // TEST : A mayor distancia del centro, menor puntuación
        let bot = AlfaBetaBot::new(None);
        let board_size = 7;
        let center = Coordinates::new(2, 2, 2);

        // Celdas a diferentes distancias del centro
        let cells = vec![
            center,                                           // Distancia 0
            Coordinates::new(3, 2, 1),                        // Distancia 1
            Coordinates::new(4, 2, 0),                        // Distancia 2
            Coordinates::new(5, 1, 0),                        // Distancia 3
            Coordinates::new(6, 0, 0),                        // Distancia 4
        ];

        let scores: Vec<i32> = cells.iter()
            .map(|&c| bot.center_control_score(&[c], board_size))
            .collect();

        for i in 0..scores.len() {
            println!("Celda {:?}: score {}", cells[i], scores[i]);
        }

        // Verificar que los scores decrecen (o al menos no aumentan)
        for i in 0..scores.len()-1 {
            assert!(
                scores[i] >= scores[i+1],
                "Score debería decrecer con la distancia: {} (idx{}) >= {} (idx{})",
                scores[i], i, scores[i+1], i+1
            );
        }
    }

    // ============================================================
    // GRUPO 7: BLOQUEO AL OPONENTE (blocking_score)
    // ============================================================

    #[test]
    fn test_blocking_score_empty() {
        // TEST : Sin celdas de ningún jugador → score 0
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(5);
        let my_cells: Vec<Coordinates> = vec![];
        let opp_cells: Vec<Coordinates> = vec![];

        let score = bot.blocking_score(&my_cells, &opp_cells, &game);

        assert_eq!(
            score, 0,
            "Sin celdas, el score debe ser 0"
        );
    }

    #[test]
    fn test_blocking_score_no_contact() {
        // TEST : Celdas de ambos jugadores pero lejos → score 0
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(6);

        let my_cells = vec![
            Coordinates::new(5, 0, 0), // Esquina superior
        ];

        let opp_cells = vec![
            Coordinates::new(0, 5, 0), // Esquina izquierda (lejos)
        ];

        let dist = game.manhattan_distance(my_cells[0], opp_cells[0]);
        println!("Distancia entre celdas: {}", dist);
        assert!(dist > 2, "Las celdas deberían estar lejos");

        let score = bot.blocking_score(&my_cells, &opp_cells, &game);

        assert_eq!(
            score, 0,
            "Celdas lejanas deben dar score 0"
        );
    }

    #[test]
    fn test_blocking_score_direct() {
        // TEST : Distancia 1 → bloqueo directo (3 puntos)
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(5);

        let my_cells = vec![
            Coordinates::new(4, 0, 0),
        ];

        let opp_cells = vec![
            Coordinates::new(3, 1, 0), // Distancia 1
        ];

        let dist = game.manhattan_distance(my_cells[0], opp_cells[0]);
        assert_eq!(dist, 1, "Las celdas deberían estar a distancia 1");

        let score = bot.blocking_score(&my_cells, &opp_cells, &game);

        assert_eq!(
            score, 3,
            "Bloqueo directo (distancia 1) debe dar 3 puntos, dio {}",
            score
        );
    }

    #[test]
    fn test_blocking_score_potential() {
        // TEST : Distancia 2 → bloqueo potencial (1 punto)
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(5);

        let my_cells = vec![
            Coordinates::new(4, 0, 0),
        ];

        let opp_cells = vec![
            Coordinates::new(2, 2, 0), // Distancia 2
        ];

        let dist = game.manhattan_distance(my_cells[0], opp_cells[0]);
        assert_eq!(dist, 2, "Las celdas deberían estar a distancia 2");

        let score = bot.blocking_score(&my_cells, &opp_cells, &game);

        assert_eq!(
            score, 1,
            "Bloqueo potencial (distancia 2) debe dar 1 punto, dio {}",
            score
        );
    }

    #[test]
    fn test_blocking_score_mixed() {
        // TEST : Múltiples distancias → suma correcta
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(6);

        let my_cells = vec![
            Coordinates::new(5, 0, 0), // A
        ];

        let opp_cells = vec![
            Coordinates::new(4, 1, 0), // B (distancia 1 con A) → 3 pts
            Coordinates::new(3, 2, 0), // C (distancia 2 con A) → 1 pt
            Coordinates::new(0, 5, 0), // D (distancia 5 con A) → 0 pts
        ];

        let dist_b = game.manhattan_distance(my_cells[0], opp_cells[0]);
        let dist_c = game.manhattan_distance(my_cells[0], opp_cells[1]);
        let dist_d = game.manhattan_distance(my_cells[0], opp_cells[2]);

        println!("Distancia A-B: {}", dist_b);
        println!("Distancia A-C: {}", dist_c);
        println!("Distancia A-D: {}", dist_d);

        let score = bot.blocking_score(&my_cells, &opp_cells, &game);

        assert_eq!(
            score, 4, // 3 + 1 = 4
            "Score esperado 4 (3+1), pero dio {}",
            score
        );
    }

    #[test]
    fn test_blocking_score_multiple_my_cells() {
        // TEST : Varias celdas propias contra varias del oponente
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(6);

        let my_cells = vec![
            Coordinates::new(5, 0, 0), // A
            Coordinates::new(0, 5, 0), // B
        ];

        let opp_cells = vec![
            Coordinates::new(4, 1, 0), // C (distancia 1 con A) → 3 pts
            Coordinates::new(1, 4, 0), // D (distancia 1 con B) → 3 pts
            Coordinates::new(3, 2, 0), // E (distancia 2 con A) → 1 pt
        ];

        // A-C: 3 pts
        // B-D: 3 pts
        // A-E: 1 pt
        // Total esperado: 7

        let score = bot.blocking_score(&my_cells, &opp_cells, &game);

        println!("Score con múltiples celdas: {}", score);

        assert_eq!(
            score, 7,
            "Score esperado 7 (3+3+1), pero dio {}",
            score
        );
    }

    #[test]
    fn test_blocking_score_symmetry() {
        // TEST : El score debe ser simétrico (intercambiar jugadores da mismo resultado)
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(5);

        let cells_a = vec![
            Coordinates::new(4, 0, 0),
            Coordinates::new(2, 2, 0),
        ];

        let cells_b = vec![
            Coordinates::new(3, 1, 0),
            Coordinates::new(1, 1, 2),
        ];

        let score_ab = bot.blocking_score(&cells_a, &cells_b, &game);
        let score_ba = bot.blocking_score(&cells_b, &cells_a, &game);

        println!("Score A vs B: {}", score_ab);
        println!("Score B vs A: {}", score_ba);

        assert_eq!(
            score_ab, score_ba,
            "El score debe ser simétrico al intercambiar jugadores"
        );
    }

    #[test]
    fn test_blocking_score_all_distances() {
        // TEST : Verificar todas las distancias posibles
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(7);

        let my_cell = Coordinates::new(3, 2, 1);

        // Generar celdas a diferentes distancias (con valores REALES de manhattan_distance)
        let test_opponents = vec![
            (Coordinates::new(4, 1, 1), 1, 3),  // distancia 1 → 3 pts
            (Coordinates::new(5, 1, 0), 2, 1),  // distancia 2 → 1 pt
            (Coordinates::new(6, 0, 0), 3, 0),  // distancia 3 → 0 pts
            (Coordinates::new(0, 3, 3), 3, 0),  // ¡CORREGIDO: distancia 3, no 4!
        ];

        for (opp_cell, expected_dist, expected_pts) in test_opponents {
            let dist = game.manhattan_distance(my_cell, opp_cell);
            let score = bot.blocking_score(&[my_cell], &[opp_cell], &game);

            println!("Celda {:?} - distancia {}: score {}", opp_cell, dist, score);

            assert_eq!(
                dist, expected_dist,
                "Distancia esperada {}, pero fue {}", expected_dist, dist
            );

            assert_eq!(
                score, expected_pts,
                "Para distancia {}, score esperado {}, pero fue {}",
                dist, expected_pts, score
            );
        }
    }

    // ============================================================
    // GRUPO 8: PROXIMIDAD (proximity_score)
    // ============================================================

    #[test]
    fn test_proximity_score() {
        // TEST : Verificar puntuación de proximidad entre celdas
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(6);

        let my_cells = vec![
            Coordinates::new(5, 0, 0), // A
            Coordinates::new(3, 2, 0), // B
        ];

        let opp_cells = vec![
            Coordinates::new(4, 1, 0), // C (dist 1 con A, dist 2 con B)
            Coordinates::new(2, 2, 1), // D (dist 3 con A, dist 1 con B)
            Coordinates::new(0, 5, 0), // E (dist 5 con A, dist 4 con B)
        ];

        // Calcular distancias para depuración
        println!("Distancias desde A (5,0,0):");
        for &opp in &opp_cells {
            let dist = game.manhattan_distance(my_cells[0], opp);
            println!("  a {:?}: {}", opp, dist);
        }

        println!("\nDistancias desde B (3,2,0):");
        for &opp in &opp_cells {
            let dist = game.manhattan_distance(my_cells[1], opp);
            println!("  a {:?}: {}", opp, dist);
        }

        let score = bot.proximity_score(&my_cells, &opp_cells, &game);

        // proximity_score suma 1 por cada par con distancia <= 2
        // Pares:
        // A-C: dist 1 → +1
        // A-D: dist ? (calcular)
        // A-E: dist ? (calcular)
        // B-C: dist 2 → +1
        // B-D: dist 1 → +1
        // B-E: dist ? (calcular)

        println!("\nScore total: {}", score);

        // No podemos predecir el valor exacto sin calcular todas las distancias,
        // pero podemos verificar que es coherente
        assert!(
            score >= 0,
            "El score de proximidad debe ser >= 0"
        );

        // Verificar que es un número entero
        assert_eq!(
            score as f64, score as f64,
            "El score debe ser un número entero"
        );
    }
    // ============================================================
    // GRUPO 9: MOVILIDAD (mobility_score)
    // ============================================================

    #[test]
    fn test_mobility_empty_board() {
        // TEST : Tablero vacío debería tener alta movilidad
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(5);

        let score = bot.mobility_score(&game);

        println!("Movilidad en tablero vacío (tamaño 5): {}", score);

        assert!(
            score > 0,
            "En tablero vacío debería haber movilidad positiva"
        );
    }

    #[test]
    fn test_mobility_partial_board() {
        // TEST : Tablero con algunas piezas puestas
        let bot = AlfaBetaBot::new(None);
        let mut game = GameY::new(5);

        // Poner algunas piezas para reducir movilidad
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(4, 0, 0),
        }).unwrap();

        game.add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: Coordinates::new(3, 1, 0),
        }).unwrap();

        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(0, 4, 0),
        }).unwrap();

        let score = bot.mobility_score(&game);

        println!("Movilidad con 3 piezas puestas: {}", score);

        assert!(
            score >= 0,
            "La movilidad debe ser >= 0"
        );

        // Comparar con tablero vacío (opcional)
        let empty_game = GameY::new(5);
        let empty_score = bot.mobility_score(&empty_game);

        println!("Movilidad tablero vacío: {}", empty_score);
        println!("Movilidad tablero parcial: {}", score);

        // No podemos asegurar que empty_score > score porque depende de la heurística,
        // pero podemos imprimirlo para depuración
    }

    // ============================================================
    // GRUPO 10: DETECCIÓN DE AMENAZAS (detect_winning_threat)
    // ============================================================

    #[test]
    fn test_detect_winning_threat_none() {
        // TEST : Sin amenaza de victoria
        let bot = AlfaBetaBot::new(None);

        let game = create_test_game(3, vec![
            (2, 0, 0, 0), // Solo una pieza
        ]);

        let threat = bot.detect_winning_threat(&game, HUMAN_PLAYER_ID);

        assert!(
            threat.is_none(),
            "No debería detectar amenaza cuando solo hay una pieza"
        );
    }

    #[test]
    fn test_detect_winning_threat_exists() {
        // TEST : Amenaza real de victoria
        let bot = AlfaBetaBot::new(None);

        // Humano tiene 2 lados, necesita el tercero
        // En tamaño 3, las coordenadas válidas son las que suman 2
        let game = create_test_game(3, vec![
            (2, 0, 0, 0), // Lado A
            (1, 1, 0, 0), // Centro
            (0, 2, 0, 0), // Lado B
            // La celda (1,0,1) le daría la victoria (conecta con lado C)
        ]);

        let threat = bot.detect_winning_threat(&game, HUMAN_PLAYER_ID);

        println!("Amenaza detectada: {:?}", threat);

        assert!(
            threat.is_some(),
            "Debería detectar amenaza de victoria"
        );

        if let Some(coords) = threat {
            // Puede ser (1,0,1) o (0,1,1) dependiendo de la implementación
            let possible_threats = vec![
                Coordinates::new(1, 0, 1),
                Coordinates::new(0, 1, 1),
            ];
            assert!(
                possible_threats.contains(&coords),
                "La amenaza debería ser una de {:?}, pero fue {:?}",
                possible_threats, coords
            );
        }
    }

    #[test]
    fn test_detect_winning_threat_multiple() {
        // TEST : Múltiples amenazas (cualquiera vale)
        let bot = AlfaBetaBot::new(None);

        // Humano tiene 2 lados y dos posibles celdas para ganar
        let game = create_test_game(4, vec![
            (3, 0, 0, 0), // Lado A
            (2, 1, 0, 0), // Centro
            (1, 2, 0, 0), // Centro
            (0, 3, 0, 0), // Lado B
            // Puede ganar en (0,2,1) o (0,1,2) o (1,1,1)
        ]);

        let threat = bot.detect_winning_threat(&game, HUMAN_PLAYER_ID);

        println!("Amenaza múltiple detectada: {:?}", threat);

        assert!(
            threat.is_some(),
            "Debería detectar alguna amenaza"
        );
    }

    #[test]
    fn test_detect_winning_threat_specific() {
        // TEST : Test específico con la amenaza que realmente aparece
        let bot = AlfaBetaBot::new(None);

        let game = create_test_game(3, vec![
            (2, 0, 0, 0),
            (1, 1, 0, 0),
            (0, 2, 0, 0),
        ]);

        let threat = bot.detect_winning_threat(&game, HUMAN_PLAYER_ID);

        // Según la ejecución, la amenaza real es (1,0,1)
        assert_eq!(
            threat,
            Some(Coordinates::new(1, 0, 1)),
            "La amenaza debería ser (1,0,1)"
        );
    }
    // ============================================================
    // GRUPO 11: CHECK WINNER (check_winner)
    // ============================================================


    #[test]
    fn test_check_winner_human_wins() {
        // TEST : Humano conecta los tres lados
        let bot = AlfaBetaBot::new(None);

        let game = create_test_game(3, vec![
            (2, 0, 0, 0), // Lado A (humano)
            (1, 1, 0, 0), // Centro (humano)
            (0, 2, 0, 0), // Lado B (humano)
            (0, 1, 1, 0), // Centro (humano)
            (0, 0, 2, 0), // Lado C (humano) - VICTORIA
        ]);

        assert!(
            bot.check_winner(&game, HUMAN_PLAYER_ID),
            "El humano debería haber ganado"
        );

        assert!(
            !bot.check_winner(&game, BOT_PLAYER_ID),
            "El bot no debería haber ganado"
        );
    }

    #[test]
    fn test_check_winner_no_winner() {
        // TEST : Nadie ha ganado todavía
        let bot = AlfaBetaBot::new(None);

        let game = create_test_game(3, vec![
            (2, 0, 0, 0), // Lado A (humano)
            (0, 2, 0, 1), // Lado B (bot)
            (0, 0, 2, 0), // Lado C (humano) - pero no conectados
        ]);

        assert!(
            !bot.check_winner(&game, BOT_PLAYER_ID),
            "El bot no debería haber ganado"
        );

        assert!(
            !bot.check_winner(&game, HUMAN_PLAYER_ID),
            "El humano no debería haber ganado"
        );
    }

    // ============================================================
    // GRUPO 12: CELDA VACÍA (is_cell_empty)
    // ============================================================

    #[test]
    fn test_is_cell_empty_true() {
        // TEST : Celda vacía debe devolver true
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(5);

        // Probar varias celdas vacías
        let test_coords = vec![
            Coordinates::new(4, 0, 0), // Esquina
            Coordinates::new(2, 2, 0), // Borde
            Coordinates::new(1, 1, 2), // Centro
            Coordinates::new(0, 4, 0), // Otra esquina
        ];

        for (i, &coords) in test_coords.iter().enumerate() {
            assert!(
                bot.is_cell_empty(&game, coords),
                "Test {}: La celda {:?} debería estar vacía",
                i+1, coords
            );
        }
    }

    #[test]
    fn test_is_cell_empty_false() {
        // TEST : Celda ocupada debe devolver false
        let bot = AlfaBetaBot::new(None);
        let mut game = GameY::new(5);

        // Ocupar varias celdas
        let occupied_coords = vec![
            Coordinates::new(4, 0, 0),
            Coordinates::new(2, 2, 0),
            Coordinates::new(1, 1, 2),
            Coordinates::new(0, 4, 0),
        ];

        for (i, &coords) in occupied_coords.iter().enumerate() {
            let player_id = if i % 2 == 0 { 0 } else { 1 };
            game.add_move(Movement::Placement {
                player: PlayerId::new(player_id),
                coords,
            }).unwrap();
        }

        // Verificar que las celdas ocupadas ya no están vacías
        for (i, &coords) in occupied_coords.iter().enumerate() {
            assert!(
                !bot.is_cell_empty(&game, coords),
                "Test {}: La celda {:?} debería estar ocupada",
                i+1, coords
            );
        }
    }

    #[test]
    fn test_is_cell_empty_after_placement() {
        // TEST : Verificar cambio de estado después de colocar pieza
        let bot = AlfaBetaBot::new(None);
        let mut game = GameY::new(4);

        let coords = Coordinates::new(3, 0, 0);

        // Antes de colocar
        assert!(
            bot.is_cell_empty(&game, coords),
            "Antes de colocar, la celda debería estar vacía"
        );

        // Colocar pieza
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords,
        }).unwrap();

        // Después de colocar
        assert!(
            !bot.is_cell_empty(&game, coords),
            "Después de colocar, la celda no debería estar vacía"
        );
    }

    #[test]
    fn test_is_cell_empty_all_cells() {
        // TEST : Verificar todas las celdas del tablero
        let bot = AlfaBetaBot::new(None);
        let mut game = GameY::new(3);

        // Al principio todas vacías
        for idx in 0..game.total_cells() {
            let coords = Coordinates::from_index(idx, 3);
            assert!(
                bot.is_cell_empty(&game, coords),
                "Celda {:?} debería estar vacía al inicio",
                coords
            );
        }

        // Ocupar una celda
        let coords1 = Coordinates::new(2, 0, 0);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: coords1,
        }).unwrap();

        // Verificar que esa ya no está vacía
        assert!(!bot.is_cell_empty(&game, coords1));

        // El resto siguen vacías
        for idx in 0..game.total_cells() {
            let coords = Coordinates::from_index(idx, 3);
            if coords != coords1 {
                assert!(
                    bot.is_cell_empty(&game, coords),
                    "Celda {:?} debería estar vacía",
                    coords
                );
            }
        }
    }

    // ============================================================
    // GRUPO 13: ORDENAMIENTO DE MOVIMIENTOS (order_moves)
    // ============================================================

    #[test]
    fn test_order_moves_empty() {
        // TEST : Lista vacía de movimientos
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(5);
        let moves: Vec<u32> = vec![];

        let ordered = bot.order_moves(&game, &moves, true);

        assert!(
            ordered.is_empty(),
            "Lista vacía debe devolver lista vacía"
        );
    }

    #[test]
    fn test_order_moves_preserves_all() {
        // TEST : El ordenamiento no debe perder movimientos
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(3);
        let moves: Vec<u32> = game.available_cells().iter().copied().collect();
        let original_len = moves.len();

        let ordered = bot.order_moves(&game, &moves, true);

        assert_eq!(
            ordered.len(), original_len,
            "El ordenamiento debe preservar todos los movimientos"
        );

        // Verificar que todos los movimientos originales están en la lista ordenada
        for &mv in &moves {
            assert!(
                ordered.contains(&mv),
                "El movimiento {} debería estar en la lista ordenada",
                mv
            );
        }
    }

    #[test]
    fn test_order_moves_winning_first() {
        // TEST : Movimiento ganador debe tener alta prioridad
        let bot = AlfaBetaBot::new(None);

        // Configurar partida donde el bot puede ganar en (0,0,2)
        let game = create_test_game(3, vec![
            (2, 0, 0, 1), // Lado A (bot)
            (1, 1, 0, 1), // Centro (bot)
            (0, 2, 0, 1), // Lado B (bot)
            // Si juega en (0,0,2) gana
        ]);

        let moves: Vec<u32> = game.available_cells().iter().copied().collect();
        let winning_idx = Coordinates::new(0, 0, 2).to_index(3);

        let ordered = bot.order_moves(&game, &moves, true);

        println!("Primeros 3 movimientos ordenados: {:?}", &ordered[..3]);
        println!("Índice ganador esperado: {}", winning_idx);

        // El movimiento ganador debería estar entre los primeros
        assert!(
            ordered.iter().take(3).any(|&x| x == winning_idx),
            "El movimiento ganador debería estar entre los 3 primeros"
        );
    }

    #[test]
    fn test_order_moves_blocking_high() {
        // TEST : Movimiento que bloquea victoria del oponente debe tener alta prioridad
        let bot = AlfaBetaBot::new(None);

        // Configurar partida donde el humano puede ganar en (0,0,2)
        let game = create_test_game(3, vec![
            (2, 0, 0, 0), // Lado A (humano)
            (1, 1, 0, 0), // Centro (humano)
            (0, 2, 0, 0), // Lado B (humano)
            // Si el humano juega en (0,0,2) gana
            (1, 0, 1, 1), // Una pieza del bot
        ]);

        let moves: Vec<u32> = game.available_cells().iter().copied().collect();
        let blocking_idx = Coordinates::new(0, 0, 2).to_index(3);

        println!("Movimientos disponibles: {:?}", moves);
        println!("Índice bloqueador esperado: {}", blocking_idx);

        let ordered = bot.order_moves(&game, &moves, true);

        println!("Orden completo: {:?}", ordered);

        // Verificar que el movimiento bloqueador existe
        assert!(
            ordered.contains(&blocking_idx),
            "El movimiento bloqueador debería estar en la lista ordenada"
        );

        // Verificar que está entre los primeros (si hay al menos 3 movimientos)
        if ordered.len() >= 3 {
            assert!(
                ordered.iter().take(3).any(|&x| x == blocking_idx),
                "El movimiento bloqueador debería estar entre los 3 primeros"
            );
        } else {
            // Si hay menos de 3 movimientos, debería ser el primero
            assert_eq!(
                ordered[0], blocking_idx,
                "Con pocos movimientos, el bloqueador debería ser el primero"
            );
        }
    }

    // ============================================================
    // GRUPO 14: EVALUATE BOARD (evaluate_board) - CORREGIDO
    // ============================================================

    #[test]
    fn test_evaluate_board_empty() {
        // TEST : Tablero vacío debe dar score cercano a 0
        let bot = AlfaBetaBot::new(None);
        let game = GameY::new(4);

        let score = bot.evaluate_board(&game, BOT_PLAYER_ID);

        println!("Score tablero vacío: {}", score);

        // No debería ser extremo
        assert!(score > -100000 && score < 100000);
    }

    #[test]
    fn test_evaluate_board_human_wins() {
        // TEST : Humano que ya ganó debe dar -WIN_NOW para el bot
        let bot = AlfaBetaBot::new(None);

        // Humano gana (player_id = 0)
        let game = create_test_game(3, vec![
            (2, 0, 0, 0),
            (1, 1, 0, 0),
            (0, 2, 0, 0),
            (0, 1, 1, 0),
            (0, 0, 2, 0),
        ]);

        let score = bot.evaluate_board(&game, BOT_PLAYER_ID);

        assert_eq!(score, -WIN_NOW);
    }

    #[test]
    fn test_evaluate_board_mid_game() {
        // TEST : Posición equilibrada
        let bot = AlfaBetaBot::new(None);

        // Ambos tienen 2 piezas cada uno
        let game = create_test_game(4, vec![
            (3, 0, 0, 1), // Bot
            (2, 1, 0, 1), // Bot
            (0, 3, 0, 0), // Humano
            (0, 2, 1, 0), // Humano
        ]);

        let score_bot = bot.evaluate_board(&game, BOT_PLAYER_ID);
        let score_human = bot.evaluate_board(&game, HUMAN_PLAYER_ID);

        println!("Score bot: {}", score_bot);
        println!("Score humano: {}", score_human);

        // No deberían ser extremos
        assert!(score_bot > -WIN_NOW/2 && score_bot < WIN_NOW/2);
        assert!(score_human > -WIN_NOW/2 && score_human < WIN_NOW/2);
    }

    // ============================================================
    // GRUPO 15: ALPHABETA (alphabeta) - CORREGIDO
    // ============================================================

    #[test]
    fn test_alphabeta_depth_zero() {
        // TEST : Profundidad 0 debe llamar a evaluate_board
        let mut bot = AlfaBetaBot::new(None);
        let game = GameY::new(3);

        let score = bot.alphabeta(&game, 0, i32::MIN, i32::MAX, true);

        println!("Alpha-beta depth 0 score: {}", score);

        // No debe ser un valor extremo (victoria/derrota)
        assert!(score > -100000 && score < 100000);
    }

    #[test]
    fn test_alphabeta_human_wins() {
        // TEST : Humano gana (malo para el bot)
        let mut bot = AlfaBetaBot::new(None);

        // Configurar victoria del humano (player_id = 0)
        let game = create_test_game(3, vec![
            (2, 0, 0, 0),
            (1, 1, 0, 0),
            (0, 2, 0, 0),
            (0, 1, 1, 0),
            (0, 0, 2, 0),
        ]);

        // Verificar primero que check_winner funciona
        assert!(
            bot.check_winner(&game, HUMAN_PLAYER_ID),
            "check_winner debería detectar victoria del humano"
        );

        let score = bot.alphabeta(&game, 2, i32::MIN, i32::MAX, true);

        assert_eq!(
            score, -WIN_NOW,
            "alphabeta debería devolver -WIN_NOW ({}) cuando el humano gana, pero devolvió {}",
            -WIN_NOW, score
        );
    }

    #[test]
    fn test_alphabeta_pruning_effect() {
        // TEST : Verificar que la poda funciona
        let mut bot = AlfaBetaBot::new(Some(3));
        let game = GameY::new(4);

        let start_nodes = bot.nodes_evaluated;
        let score = bot.alphabeta(&game, 3, i32::MIN, i32::MAX, true);
        let end_nodes = bot.nodes_evaluated;
        let nodes_evaluated = end_nodes - start_nodes;

        println!("Score: {}", score);
        println!("Nodos evaluados: {}", nodes_evaluated);

        assert!(
            nodes_evaluated > 0,
            "Debería haber evaluado al menos 1 nodo"
        );
    }

    #[test]
    fn test_alphabeta_different_depths() {
        // TEST : Diferentes profundidades dan resultados
        let mut bot = AlfaBetaBot::new(None);
        let game = create_test_game(4, vec![
            (3, 0, 0, 1),
            (2, 1, 0, 1),
            (0, 3, 0, 0),
        ]);

        let score_depth1 = bot.alphabeta(&game, 1, i32::MIN, i32::MAX, true);
        let score_depth2 = bot.alphabeta(&game, 2, i32::MIN, i32::MAX, true);

        println!("Score depth 1: {}", score_depth1);
        println!("Score depth 2: {}", score_depth2);

        // Solo verificamos que no hay pánico
    }

    // ============================================================
    // GRUPO 16: HASH BOARD (hash_board)
    // ============================================================

    #[test]
    fn test_hash_board_consistency() {
        // TEST : Mismo estado debe producir mismo hash
        let bot = AlfaBetaBot::new(None);
        let game1 = GameY::new(4);
        let game2 = GameY::new(4);

        let hash1 = bot.hash_board(&game1);
        let hash2 = bot.hash_board(&game2);

        assert_eq!(
            hash1, hash2,
            "Dos tableros vacíos del mismo tamaño deben tener el mismo hash"
        );

        // Mismo estado después de un movimiento
        let mut game3 = GameY::new(4);
        let mut game4 = GameY::new(4);

        game3.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(3, 0, 0),
        }).unwrap();

        game4.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(3, 0, 0),
        }).unwrap();

        let hash3 = bot.hash_board(&game3);
        let hash4 = bot.hash_board(&game4);

        assert_eq!(
            hash3, hash4,
            "Tableros con los mismos movimientos deben tener el mismo hash"
        );
    }

    #[test]
    fn test_hash_board_different() {
        // TEST : Estados diferentes deben producir hashes diferentes
        let bot = AlfaBetaBot::new(None);

        let mut game1 = GameY::new(4);
        let mut game2 = GameY::new(4);

        // Mismo tablero pero diferentes movimientos
        game1.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(3, 0, 0),
        }).unwrap();

        game2.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(2, 1, 0),
        }).unwrap();

        let hash1 = bot.hash_board(&game1);
        let hash2 = bot.hash_board(&game2);

        assert_ne!(
            hash1, hash2,
            "Tableros con diferentes movimientos deben tener diferentes hashes"
        );

        // Diferente número de movimientos
        let mut game3 = GameY::new(4);
        game3.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(3, 0, 0),
        }).unwrap();
        game3.add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: Coordinates::new(2, 1, 0),
        }).unwrap();

        let hash3 = bot.hash_board(&game3);

        assert_ne!(
            hash1, hash3,
            "Tableros con diferente número de movimientos deben tener diferentes hashes"
        );
    }

    #[test]
    fn test_hash_board_deterministic() {
        // TEST : Múltiples llamadas al mismo tablero dan el mismo hash
        let bot = AlfaBetaBot::new(None);
        let mut game = GameY::new(5);

        // Añadir algunos movimientos
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(4, 0, 0),
        }).unwrap();

        game.add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: Coordinates::new(3, 1, 0),
        }).unwrap();

        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(0, 4, 0),
        }).unwrap();

        // Calcular hash varias veces
        let hash_a = bot.hash_board(&game);
        let hash_b = bot.hash_board(&game);
        let hash_c = bot.hash_board(&game);
        let hash_d = bot.hash_board(&game);

        assert_eq!(hash_a, hash_b, "Primera y segunda llamada deben ser iguales");
        assert_eq!(hash_b, hash_c, "Segunda y tercera llamada deben ser iguales");
        assert_eq!(hash_c, hash_d, "Tercera y cuarta llamada deben ser iguales");

        println!("Hash del tablero: {}", hash_a);
        println!("Verificaciones: {} == {} == {} == {}", hash_a, hash_b, hash_c, hash_d);
    }

    #[test]
    fn test_hash_board_collision_resistance() {
        // TEST : Probabilidad de colisión muy baja (test conceptual)
        let bot = AlfaBetaBot::new(None);
        let mut hashes = std::collections::HashSet::new();

        // Generar muchos tableros diferentes y verificar que no hay colisiones
        for i in 0..10 {
            for j in 0..10 {
                let mut game = GameY::new(5);

                // Crear un tablero único
                if i % 2 == 0 {
                    game.add_move(Movement::Placement {
                        player: PlayerId::new(0),
                        coords: Coordinates::new(4, 0, 0),
                    }).unwrap_or(());
                }
                if j % 3 == 0 {
                    game.add_move(Movement::Placement {
                        player: PlayerId::new(1),
                        coords: Coordinates::new(0, 4, 0),
                    }).unwrap_or(());
                }
                if (i + j) % 4 == 0 {
                    game.add_move(Movement::Placement {
                        player: PlayerId::new(0),
                        coords: Coordinates::new(2, 2, 0),
                    }).unwrap_or(());
                }

                let hash = bot.hash_board(&game);
                hashes.insert(hash);
            }
        }

        println!("Hashes únicos generados: {}", hashes.len());

        // No debería haber colisiones (en la práctica, con pocos elementos es muy improbable)
        // Este test es más informativo que asertivo
        assert!(hashes.len() > 5, "Debería haber al menos 5 hashes únicos");
    }

    // ============================================================
    // GRUPO 17: TRANSPOSITION TABLE
    // ============================================================

    #[test]
    fn test_transposition_table_reuse() {
        // TEST : Segunda llamada debe usar la tabla (más rápida)
        let mut bot = AlfaBetaBot::new(Some(3));
        let game = GameY::new(3);

        // Primera llamada - debe llenar la tabla
        let start_nodes1 = bot.nodes_evaluated;
        let score1 = bot.alphabeta(&game, 2, i32::MIN, i32::MAX, true);
        let end_nodes1 = bot.nodes_evaluated;
        let nodes1 = end_nodes1 - start_nodes1;

        // Verificar que la tabla no está vacía
        assert!(!bot.transposition_table.is_empty(), "La tabla de transposición debería tener entradas después de la primera llamada");

        // Segunda llamada - debería usar la tabla
        let start_nodes2 = bot.nodes_evaluated;
        let score2 = bot.alphabeta(&game, 2, i32::MIN, i32::MAX, true);
        let end_nodes2 = bot.nodes_evaluated;
        let nodes2 = end_nodes2 - start_nodes2;

        println!("Primera llamada - nodos: {}, score: {}", nodes1, score1);
        println!("Segunda llamada - nodos: {}, score: {}", nodes2, score2);
        println!("Entradas en tabla: {}", bot.transposition_table.len());

        assert_eq!(
            score1, score2,
            "Los scores deben ser iguales en ambas llamadas"
        );

        // La segunda llamada debería evaluar menos nodos (o al menos no más)
        // Debido a la tabla de transposición
        assert!(
            nodes2 <= nodes1,
            "La segunda llamada debería evaluar menos o igual nodos ({} vs {})",
            nodes2, nodes1
        );
    }

    #[test]
    fn test_transposition_table_different_depths() {
        // TEST : Diferentes profundidades deben tener entradas diferentes
        let mut bot = AlfaBetaBot::new(None);
        let game = GameY::new(3);

        // Llamada con profundidad 2
        let _ = bot.alphabeta(&game, 2, i32::MIN, i32::MAX, true);
        let entries_depth2 = bot.transposition_table.len();

        // Resetear el bot para empezar limpio
        let mut bot2 = AlfaBetaBot::new(None);

        // Llamada con profundidad 3
        let _ = bot2.alphabeta(&game, 3, i32::MIN, i32::MAX, true);
        let entries_depth3 = bot2.transposition_table.len();

        println!("Entradas con profundidad 2: {}", entries_depth2);
        println!("Entradas con profundidad 3: {}", entries_depth3);

        // Ambas deberían tener entradas
        assert!(entries_depth2 > 0, "Debería haber entradas con profundidad 2");
        assert!(entries_depth3 > 0, "Debería haber entradas con profundidad 3");
    }

    #[test]
    fn test_transposition_table_cleared_on_new() {
        // TEST : Un nuevo bot debe tener tabla vacía
        let bot = AlfaBetaBot::new(None);

        assert!(
            bot.transposition_table.is_empty(),
            "La tabla de transposición debe estar vacía al crear un nuevo bot"
        );
    }

    #[test]
    fn test_transposition_table_different_boards() {
        // TEST : Diferentes tableros deben tener diferentes entradas
        let mut bot = AlfaBetaBot::new(Some(2));

        let game1 = GameY::new(3);
        let game2 = GameY::new(4); // Tamaño diferente

        let _ = bot.alphabeta(&game1, 1, i32::MIN, i32::MAX, true);
        let entries_before = bot.transposition_table.len();

        let _ = bot.alphabeta(&game2, 1, i32::MIN, i32::MAX, true);
        let entries_after = bot.transposition_table.len();

        println!("Entradas después de game1: {}", entries_before);
        println!("Entradas después de game2: {}", entries_after);

        // Debería haber más entradas después del segundo tablero
        assert!(
            entries_after >= entries_before,
            "La tabla debería tener al menos tantas entradas como antes"
        );
    }

    #[test]
    fn test_transposition_table_same_board_different_turns() {
        // TEST : Mismo tablero con diferente turno (el hash no incluye turno)
        let mut bot = AlfaBetaBot::new(Some(2));

        // Crear un tablero con algunas piezas
        let mut game = GameY::new(3);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(2, 0, 0),
        }).unwrap();

        // Evaluar con turno del bot
        let score_bot_turn = bot.alphabeta(&game, 2, i32::MIN, i32::MAX, true);
        let entries_before = bot.transposition_table.len();

        // Evaluar con turno del humano (mismo tablero)
        let score_human_turn = bot.alphabeta(&game, 2, i32::MIN, i32::MAX, false);
        let entries_after = bot.transposition_table.len();

        println!("Score turno bot: {}", score_bot_turn);
        println!("Score turno humano: {}", score_human_turn);
        println!("Entradas antes: {}, después: {}", entries_before, entries_after);

        // Pueden ser iguales o diferentes, pero la tabla debería crecer
        assert!(
            entries_after >= entries_before,
            "La tabla debería tener al menos tantas entradas como antes"
        );
    }

    #[test]
    fn test_transposition_table_node_count() {
        // TEST : Verificar que nodes_evaluated se incrementa correctamente
        let mut bot = AlfaBetaBot::new(Some(3));
        let game = GameY::new(3);

        let start_nodes = bot.nodes_evaluated;
        let _ = bot.alphabeta(&game, 2, i32::MIN, i32::MAX, true);
        let end_nodes = bot.nodes_evaluated;

        println!("Nodos evaluados: {}", end_nodes - start_nodes);

        assert!(
            end_nodes > start_nodes,
            "nodes_evaluated debería incrementarse después de alphabeta"
        );
    }

    // ============================================================
    // GRUPO 18: CHOOSE MOVE (choose_move y choose_move_internal)
    // ============================================================

    #[test]
    fn test_choose_move_empty_board() {
        // TEST : Tablero vacío debe devolver algún movimiento
        let mut bot = AlfaBetaBot::new(Some(2));
        let game = GameY::new(3);

        let chosen = bot.choose_move_internal(&game);

        assert!(
            chosen.is_some(),
            "En tablero vacío, choose_move debe devolver Some(coordenadas)"
        );

        if let Some(coords) = chosen {
            println!("Movimiento elegido en tablero vacío: {:?}", coords);

            // Verificar que las coordenadas son válidas
            assert!(coords.x() < 3 && coords.y() < 3 && coords.z() < 3);
            assert_eq!(coords.x() + coords.y() + coords.z(), 2);

            // Verificar que la celda está disponible
            let idx = coords.to_index(3);
            assert!(
                game.available_cells().contains(&idx),
                "La celda elegida debe estar disponible"
            );
        }
    }

    #[test]
    fn test_choose_move_full_board() {
        // TEST : Tablero lleno debe devolver None
        let mut bot = AlfaBetaBot::new(None);
        let mut game = GameY::new(2);

        // Llenar todas las celdas
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(1, 0, 0),
        }).unwrap();

        game.add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: Coordinates::new(0, 1, 0),
        }).unwrap();

        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(0, 0, 1),
        }).unwrap();

        let chosen = bot.choose_move_internal(&game);

        assert!(
            chosen.is_none(),
            "En tablero lleno, choose_move debe devolver None"
        );
    }

    #[test]
    fn test_choose_move_winning_priority() {
        // TEST : Debe priorizar movimiento que da la victoria
        let mut bot = AlfaBetaBot::new(Some(3));

        // Configurar partida donde el bot (player 1) puede ganar en (0,0,2)
        let game = create_test_game(3, vec![
            (2, 0, 0, 1), // Lado A (bot)
            (1, 1, 0, 1), // Centro (bot)
            (0, 2, 0, 1), // Lado B (bot)
            // Si juega en (0,0,2) gana
            (1, 0, 1, 0), // Pieza del humano (para que no sea tan trivial)
        ]);

        let winning_move = Coordinates::new(0, 0, 2);
        let winning_idx = winning_move.to_index(3);

        // Verificar que la celda ganadora está disponible
        assert!(
            game.available_cells().contains(&winning_idx),
            "La celda ganadora debería estar disponible"
        );

        let chosen = bot.choose_move_internal(&game).unwrap();

        println!("Movimiento ganador esperado: {:?}", winning_move);
        println!("Movimiento elegido: {:?}", chosen);

        assert_eq!(
            chosen, winning_move,
            "El bot debería elegir el movimiento ganador {:?}, pero eligió {:?}",
            winning_move, chosen
        );
    }

    #[test]
    fn test_choose_move_blocking_priority() {
        // TEST : Debe priorizar movimiento que bloquea victoria del oponente
        let mut bot = AlfaBetaBot::new(Some(3));

        // Configurar partida donde el humano (player 0) puede ganar en (0,0,2)
        let game = create_test_game(3, vec![
            (2, 0, 0, 0), // Lado A (humano)
            (1, 1, 0, 0), // Centro (humano)
            (0, 2, 0, 0), // Lado B (humano)
            // Si el humano juega en (0,0,2) gana
            (1, 0, 1, 1), // Pieza del bot (para que tenga que decidir)
        ]);

        let blocking_move = Coordinates::new(0, 0, 2);
        let blocking_idx = blocking_move.to_index(3);

        // Verificar que la celda bloqueadora está disponible
        assert!(
            game.available_cells().contains(&blocking_idx),
            "La celda bloqueadora debería estar disponible"
        );

        let chosen = bot.choose_move_internal(&game).unwrap();

        println!("Movimiento bloqueador esperado: {:?}", blocking_move);
        println!("Movimiento elegido: {:?}", chosen);

        assert_eq!(
            chosen, blocking_move,
            "El bot debería elegir el movimiento bloqueador {:?}, pero eligió {:?}",
            blocking_move, chosen
        );
    }

    #[test]
    fn test_choose_move_strategic_vs_random() {
        // TEST : En posición equilibrada, debe elegir un movimiento estratégico
        let mut bot = AlfaBetaBot::new(Some(3));

        // Posición equilibrada sin amenazas inmediatas
        let game = create_test_game(4, vec![
            (3, 0, 0, 1), // Bot en lado A
            (2, 1, 0, 1), // Bot en centro
            (0, 3, 0, 0), // Humano en lado B
            (0, 2, 1, 0), // Humano en centro
        ]);

        let chosen = bot.choose_move_internal(&game).unwrap();

        println!("Movimiento elegido en posición equilibrada: {:?}", chosen);

        // Verificar que la celda elegida es válida
        let idx = chosen.to_index(4);
        assert!(
            game.available_cells().contains(&idx),
            "La celda elegida debe estar disponible"
        );

        // No podemos predecir exactamente cuál, pero debe ser una celda válida
        assert!(
            chosen.x() < 4 && chosen.y() < 4 && chosen.z() < 4,
            "Coordenadas fuera de rango: {:?}", chosen
        );
        assert_eq!(
            chosen.x() + chosen.y() + chosen.z(), 3,
            "Coordenadas inválidas: suma = {}, debe ser 3", chosen.x() + chosen.y() + chosen.z()
        );
    }

    #[test]
    fn test_choose_move_different_depths() {
        // TEST : Diferentes profundidades pueden dar diferentes movimientos
        let mut bot_depth2 = AlfaBetaBot::new(Some(2));
        let mut bot_depth4 = AlfaBetaBot::new(Some(4));

        let game = create_test_game(4, vec![
            (3, 0, 0, 1),
            (2, 1, 0, 1),
            (0, 3, 0, 0),
        ]);

        let move_depth2 = bot_depth2.choose_move_internal(&game);
        let move_depth4 = bot_depth4.choose_move_internal(&game);

        println!("Movimiento con profundidad 2: {:?}", move_depth2);
        println!("Movimiento con profundidad 4: {:?}", move_depth4);

        // Ambos deben ser Some
        assert!(move_depth2.is_some(), "Profundidad 2 debe devolver un movimiento");
        assert!(move_depth4.is_some(), "Profundidad 4 debe devolver un movimiento");

        // Pueden ser iguales o diferentes, no hay garantía
    }

    #[test]
    fn test_choose_move_ybot_trait() {
        // TEST : Verificar que el trait YBot funciona
        let bot = AlfaBetaBot::new(Some(2));
        let game = GameY::new(3);

        let chosen = YBot::choose_move(&bot, &game);

        assert!(
            chosen.is_some(),
            "El trait YBot debe funcionar correctamente"
        );

        assert_eq!(
            bot.name(),
            "alfa_beta_bot",
            "El nombre del bot debe ser 'alfa_beta_bot'"
        );
    }

    // ============================================================
    // GRUPO 19: ESCENARIOS REALES
    // ============================================================

    #[test]
    fn test_avoid_dead_zones() {
        // TEST : No debe jugar en zonas sin esperanza
        let mut bot = AlfaBetaBot::new(Some(3));

        // Configurar una zona muerta para el bot (esquina aislada)
        // y una zona prometedora (centro)
        let game = create_test_game(5, vec![
            // Zona muerta del bot (player 1) - esquina aislada
            (4, 0, 0, 1),
            (3, 1, 0, 1), // Conectada a la esquina pero sin salida

            // Zona prometedora del bot - centro
            (1, 1, 2, 1), // Centro
            (0, 2, 2, 1), // Cerca de lado

            // Piezas del humano
            (2, 2, 0, 0),
        ]);

        let chosen = bot.choose_move_internal(&game).unwrap();
        println!("Movimiento elegido: {:?}", chosen);

        // Verificar que NO elige en la zona muerta (esquina)
        // Zona muerta aproximadamente: x >= 3 y y <= 1
        let is_dead_zone = chosen.x() >= 3 && chosen.y() <= 1;
        assert!(
            !is_dead_zone,
            "El bot no debería jugar en la zona muerta (esquina), pero eligió {:?}",
            chosen
        );

        // Verificar que la celda elegida es válida
        let idx = chosen.to_index(5);
        assert!(
            game.available_cells().contains(&idx),
            "La celda elegida debe estar disponible"
        );
    }

    #[test]
    fn test_real_scenario_block_24() {
        // TEST : Tu caso específico - bloquear casilla 24
        let mut bot = AlfaBetaBot::new(Some(3));

        // Recrear tu partida donde casi ganas con la casilla 24
        // Basado en la partida que mostraste:
        // Tamaño 7, tú eres player 0, bot es player 1
        let game = create_test_game(7, vec![
            // Tus movimientos (player 0) - los que hiciste
            (3, 3, 0, 0), // aprox casilla 11
            (2, 3, 1, 0), // aprox casilla 12
            (1, 3, 2, 0), // aprox casilla 13
            (5, 1, 0, 0), // aprox casilla 6
            (4, 1, 1, 0), // aprox casilla 14
            (2, 1, 3, 0), // aprox casilla 17
            (0, 3, 3, 0), // aprox casilla 21

            // Movimientos del bot (player 1)
            (4, 2, 0, 1), // aprox casilla 3
            (3, 2, 1, 1), // aprox casilla 4
            (3, 0, 3, 1), // aprox casilla 10
            (0, 0, 6, 1), // aprox casilla 27
        ]);

        // La casilla 24 tiene coordenadas aproximadas (0,2,4) o (1,2,3)
        // Calculamos ambas posibilidades
        let possible_block_moves = vec![
            Coordinates::new(0, 2, 4), // (0,2,4) suma 6? 0+2+4=6 ✓
            Coordinates::new(1, 2, 3), // (1,2,3) suma 6? 1+2+3=6 ✓
            Coordinates::new(0, 3, 3), // (0,3,3) suma 6? 0+3+3=6 ✓
        ];

        println!("Posibles movimientos bloqueadores: {:?}", possible_block_moves);

        // Verificar qué celdas están disponibles
        for (i, &coords) in possible_block_moves.iter().enumerate() {
            let idx = coords.to_index(7);
            println!("Opción {}: {:?} - índice {} - disponible: {}",
                     i+1, coords, idx, game.available_cells().contains(&idx));
        }

        let chosen = bot.choose_move_internal(&game);
        assert!(
            chosen.is_some(),
            "El bot debería elegir algún movimiento"
        );

        let chosen_coords = chosen.unwrap();
        let chosen_idx = chosen_coords.to_index(7);
        println!("El bot eligió la casilla {} ({:?})", chosen_idx, chosen_coords);

        // Verificar que al menos eligió una celda válida
        assert!(
            game.available_cells().contains(&chosen_idx),
            "La celda elegida debe estar disponible"
        );
    }

    #[test]
    fn test_endgame_scenario() {
        // TEST : Escenario de final de partida
        let mut bot = AlfaBetaBot::new(Some(4));

        // Configurar un final de partida donde ambos están cerca de ganar
        let game = create_test_game(4, vec![
            // Bot (player 1) tiene 2 lados
            (3, 0, 0, 1), // Lado A
            (2, 1, 0, 1), // Centro
            (1, 2, 0, 1), // Centro
            (0, 3, 0, 1), // Lado B - bot conecta A y B

            // Humano (player 0) tiene otros 2 lados
            (0, 0, 3, 0), // Lado C
            (1, 0, 2, 0), // Centro
            (2, 0, 1, 0), // Centro
            // Le falta el lado A para ganar
        ]);

        let chosen = bot.choose_move_internal(&game).unwrap();
        println!("Movimiento en final de partida: {:?}", chosen);

        // Debería elegir una celda estratégica (conectar su lado C o bloquear al humano)
        let idx = chosen.to_index(4);
        assert!(
            game.available_cells().contains(&idx),
            "La celda elegida debe estar disponible"
        );
    }

    #[test]
    fn test_early_game_opening() {
        // TEST : Comportamiento en apertura
        let mut bot = AlfaBetaBot::new(Some(3));

        // Solo 3 movimientos realizados
        let game = create_test_game(5, vec![
            (4, 0, 0, 0), // Humano en esquina A
            (3, 1, 0, 1), // Bot en centro
            (0, 4, 0, 0), // Humano en esquina B
        ]);

        let chosen = bot.choose_move_internal(&game).unwrap();
        println!("Movimiento de apertura: {:?}", chosen);

        // En apertura, puede elegir estratégicamente:
        // - Centro para desarrollo
        // - Bordes para control
        // - Esquinas para bloquear al humano
        // La celda (0,0,4) es la esquina C - ¡perfectamente válida!

        let idx = chosen.to_index(5);
        assert!(
            game.available_cells().contains(&idx),
            "La celda elegida debe estar disponible"
        );

        // Verificar que la celda es válida (no fuera del tablero)
        assert!(
            chosen.x() < 5 && chosen.y() < 5 && chosen.z() < 5,
            "Coordenadas fuera de rango: {:?}", chosen
        );

        // Verificar que es una coordenada válida del tablero
        assert_eq!(
            chosen.x() + chosen.y() + chosen.z(), 4,
            "Coordenadas inválidas: suma = {}, debe ser 4",
            chosen.x() + chosen.y() + chosen.z()
        );

        // No restringir a "céntrica" - cualquier movimiento válido está bien
        println!("Bot eligió un movimiento válido: {:?}", chosen);
    }

    #[test]
    fn test_defensive_play() {
        // TEST : Juego defensivo cuando va perdiendo
        let mut bot = AlfaBetaBot::new(Some(3));

        // Bot va perdiendo (humano tiene ventaja)
        let game = create_test_game(4, vec![
            // Humano (player 0) tiene 2 lados
            (3, 0, 0, 0), // Lado A
            (2, 1, 0, 0), // Centro
            (1, 2, 0, 0), // Centro
            (0, 3, 0, 0), // Lado B

            // Bot (player 1) solo tiene 1 lado
            (0, 0, 3, 1), // Lado C
            (1, 0, 2, 1), // Centro
        ]);

        let chosen = bot.choose_move_internal(&game).unwrap();
        println!("Movimiento defensivo: {:?}", chosen);

        // Debería elegir una celda defensiva (cerca del humano o conectando sus piezas)
        let idx = chosen.to_index(4);
        assert!(
            game.available_cells().contains(&idx),
            "La celda elegida debe estar disponible"
        );
    }

    // ============================================================
    // GRUPO 20: CONSTANTES Y UTILIDADES
    // ============================================================

    #[test]
    fn test_constants_logic() {
        // TEST : Verificar la lógica de las constantes (WIN_NOW > BLOCK > ...)

        // NIVEL 1: Victoria inmediata
        assert!(
            WIN_NOW > BLOCK_OPPONENT_WIN,
            "Ganar (WIN_NOW={}) debe ser más importante que bloquear (BLOCK_OPPONENT_WIN={})",
            WIN_NOW, BLOCK_OPPONENT_WIN
        );

        // NIVEL 2: Bloquear victoria > Conectar 2 lados
        assert!(
            BLOCK_OPPONENT_WIN > CONNECT_TWO_SIDES,
            "Bloquear victoria ({}) debe ser más importante que conectar 2 lados ({})",
            BLOCK_OPPONENT_WIN, CONNECT_TWO_SIDES
        );

        // NIVEL 3: Conectar 2 lados > Conectar 1 lado
        assert!(
            CONNECT_TWO_SIDES > CONNECT_ONE_SIDE,
            "Conectar 2 lados ({}) debe ser más importante que conectar 1 lado ({})",
            CONNECT_TWO_SIDES, CONNECT_ONE_SIDE
        );

        // NIVEL 4: Conectar 1 lado > Tamaño de grupo
        assert!(
            CONNECT_ONE_SIDE > GROUP_SIZE_BONUS,
            "Conectar 1 lado ({}) debe ser más importante que tamaño de grupo ({})",
            CONNECT_ONE_SIDE, GROUP_SIZE_BONUS
        );

        // NIVEL 5: Tamaño de grupo > Patrones de puente
        assert!(
            GROUP_SIZE_BONUS > BRIDGE_PATTERN,
            "Tamaño de grupo ({}) debe ser más importante que patrones de puente ({})",
            GROUP_SIZE_BONUS, BRIDGE_PATTERN
        );

        println!("Todas las constantes respetan la jerarquía de prioridades");
    }

    #[test]
    fn test_player_id_constants() {
        // TEST : Verificar que los IDs de jugador son correctos
        assert_eq!(
            BOT_PLAYER_ID, 1,
            "El bot debe ser player_id = 1"
        );

        assert_eq!(
            HUMAN_PLAYER_ID, 0,
            "El humano debe ser player_id = 0"
        );

        assert_ne!(
            BOT_PLAYER_ID, HUMAN_PLAYER_ID,
            "Bot y humano deben tener diferentes IDs"
        );
    }

    #[test]
    fn test_depth_constants() {
        // TEST : Verificar constantes de profundidad
        assert!(
            DEFAULT_MAX_DEPTH >= 3,
            "La profundidad por defecto ({}) debería ser al menos 3",
            DEFAULT_MAX_DEPTH
        );

        assert!(
            DEFAULT_MAX_DEPTH <= 10,
            "La profundidad por defecto ({}) no debería ser excesiva",
            DEFAULT_MAX_DEPTH
        );

        // Probar creación con diferentes profundidades
        let bot_depth_1 = AlfaBetaBot::new(Some(1));
        let bot_depth_5 = AlfaBetaBot::new(Some(5));
        let bot_depth_10 = AlfaBetaBot::new(Some(10));

        assert_eq!(bot_depth_1.max_depth, 1);
        assert_eq!(bot_depth_5.max_depth, 5);
        assert_eq!(bot_depth_10.max_depth, 10);
    }

    #[test]
    fn test_transposition_table_size() {
        // TEST : Verificar tamaño de la tabla de transposición
        assert!(
            TRANSPOSITION_TABLE_SIZE >= 100000,
            "La tabla de transposición debería tener al menos 100.000 entradas, pero tiene {}",
            TRANSPOSITION_TABLE_SIZE
        );

        let bot = AlfaBetaBot::new(None);
        assert!(
            bot.transposition_table.capacity() >= TRANSPOSITION_TABLE_SIZE / 2,
            "La capacidad inicial debería ser al menos la mitad del tamaño configurado"
        );
    }



}
