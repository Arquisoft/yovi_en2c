use crate::{Coordinates, GameY, PlayerId};
use crate::bot::YBot;
use std::collections::HashSet;

// Constantes para la evaluación heurística
const WIN_SCORE: i32 = 10000;
const LOSE_SCORE: i32 = -10000;
const SIDE_CONNECTION_BONUS: i32 = 100;
const GROUP_SIZE_MULTIPLIER: i32 = 10;
const CENTER_CONTROL_BONUS: i32 = 15;
const BLOCKING_BONUS: i32 = 5;

// Constantes para el bot
const DEFAULT_MAX_DEPTH: u32 = 3;
const BOT_PLAYER_ID: u32 = 1;  // El bot juega como Player 1 (oponente)
const HUMAN_PLAYER_ID: u32 = 0; // El humano juega como Player 0

pub struct MinimaxBot {
    max_depth: u32,
}

impl MinimaxBot {
    pub fn new(depth: Option<u32>) -> Self {
        Self {
            max_depth: depth.unwrap_or(DEFAULT_MAX_DEPTH)
        }
    }

    // Evaluación heurística del tablero para un jugador específico
    fn evaluate_board(&self, board: &GameY, for_player_id: u32) -> i32 {
        // Obtener celdas del jugador que estamos evaluando
        let player_cells = if for_player_id == BOT_PLAYER_ID {
            board.get_opponent_positions_coords()  // El bot es el oponente
        } else {
            board.get_player_positions_coords()     // El humano es el jugador
        };

        // Obtener celdas del otro jugador
        let opponent_cells = if for_player_id == BOT_PLAYER_ID {
            board.get_player_positions_coords()
        } else {
            board.get_opponent_positions_coords()
        };

        let mut score = 0;

        // 1. Conexión a los lados (objetivo principal)
        let touches_a = player_cells.iter().any(|c| c.touches_side_a());
        let touches_b = player_cells.iter().any(|c| c.touches_side_b());
        let touches_c = player_cells.iter().any(|c| c.touches_side_c());

        let sides_touched = [touches_a, touches_b, touches_c]
            .iter()
            .filter(|&&b| b)
            .count();

        score += (sides_touched as i32) * SIDE_CONNECTION_BONUS;

        // 2. Tamaño del grupo conexo más grande
        if let Some(largest_group) = self.find_largest_connected_group(&player_cells, board) {
            score += largest_group as i32 * GROUP_SIZE_MULTIPLIER;
        }

        // 3. Control del centro
        let board_size = board.board_size();
        let n = board_size as i32 - 1;
        let center = n as f32 / 3.0;
        let center_rounded = center.round() as i32;

        for cell in &player_cells {
            let dx = (cell.x() as i32 - center_rounded).abs();
            let dy = (cell.y() as i32 - center_rounded).abs();
            let dz = (cell.z() as i32 - center_rounded).abs();
            score += CENTER_CONTROL_BONUS - (dx + dy + dz);
        }

        // 4. Bloqueo al oponente
        for opp_cell in &opponent_cells {
            for my_cell in &player_cells {
                let dist = board.manhattan_distance(*my_cell, *opp_cell);
                if dist == 1 {
                    score += BLOCKING_BONUS;  // Estamos cerca del oponente (bloqueando)
                }
            }
        }

        score
    }

    // Encontrar el grupo conexo más grande
    fn find_largest_connected_group(&self, cells: &[Coordinates], board: &GameY) -> Option<usize> {
        if cells.is_empty() {
            return None;
        }

        let mut visited = HashSet::new();
        let mut max_size = 0;

        for &cell in cells {
            if !visited.contains(&cell) {
                let mut stack = vec![cell];
                visited.insert(cell);
                let mut group_size = 1;

                while let Some(current) = stack.pop() {
                    for &other in cells {
                        if !visited.contains(&other) && board.manhattan_distance(current, other) == 1 {
                            visited.insert(other);
                            stack.push(other);
                            group_size += 1;
                        }
                    }
                }

                max_size = max_size.max(group_size);
            }
        }

        Some(max_size)
    }

    // Verificar si un jugador ha ganado
    fn check_winner(&self, board: &GameY, player_id: u32) -> bool {
        let cells = if player_id == BOT_PLAYER_ID {
            board.get_opponent_positions_coords()  // Bot es oponente
        } else {
            board.get_player_positions_coords()
        };

        let touches_a = cells.iter().any(|c| c.touches_side_a());
        let touches_b = cells.iter().any(|c| c.touches_side_b());
        let touches_c = cells.iter().any(|c| c.touches_side_c());

        touches_a && touches_b && touches_c
    }

    // Algoritmo Minimax
    fn minimax(&self, board: &GameY, depth: u32, is_bot_turn: bool) -> i32 {
        // Condiciones de terminación
        if depth == 0 {
            return self.evaluate_board(board, BOT_PLAYER_ID);
        }

        // Verificar si alguien ganó
        if self.check_winner(board, BOT_PLAYER_ID) {
            return WIN_SCORE;  // Gana el bot
        }
        if self.check_winner(board, HUMAN_PLAYER_ID) {
            return LOSE_SCORE;  // Gana el humano (malo para el bot)
        }

        let available = board.available_cells();
        if available.is_empty() {
            return 0;  // Empate
        }

        let current_player_id = if is_bot_turn { BOT_PLAYER_ID } else { HUMAN_PLAYER_ID };

        if is_bot_turn {
            // Turno del bot (maximizar)
            let mut max_eval = i32::MIN;
            for cell_idx in available {  // Quitamos el & antes de cell_idx
                let coords = Coordinates::from_index(*cell_idx, board.board_size());  // Añadimos * para dereferenciar
                let mut board_copy = board.clone();

                let movement = crate::Movement::Placement {
                    player: PlayerId::new(current_player_id),
                    coords,
                };

                if board_copy.add_move(movement).is_ok() {
                    let eval = self.minimax(&board_copy, depth - 1, false);
                    max_eval = max_eval.max(eval);
                }
            }
            max_eval
        } else {
            // Turno del humano (minimizar)
            let mut min_eval = i32::MAX;
            for cell_idx in available {  // Quitamos el & antes de cell_idx
                let coords = Coordinates::from_index(*cell_idx, board.board_size());  // Añadimos * para dereferenciar
                let mut board_copy = board.clone();

                let movement = crate::Movement::Placement {
                    player: PlayerId::new(current_player_id),
                    coords,
                };

                if board_copy.add_move(movement).is_ok() {
                    let eval = self.minimax(&board_copy, depth - 1, true);
                    min_eval = min_eval.min(eval);
                }
            }
            min_eval
        }
    }
}

impl YBot for MinimaxBot {
    fn name(&self) -> &str {
        "minimax_bot"
    }

    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        let available = board.available_cells();
        if available.is_empty() {
            return None;
        }

        let mut best_score = i32::MIN;
        let mut best_move = None;

        // Probar cada movimiento posible
        for &cell_idx in available.iter() {  // .iter() devuelve iterador sobre referencias
            let coords = Coordinates::from_index(cell_idx, board.board_size());  // cell_idx ya es u32
            let mut board_copy = board.clone();

            // Simular nuestro movimiento (como bot, turno actual)
            let movement = crate::Movement::Placement {
                player: PlayerId::new(BOT_PLAYER_ID),
                coords,
            };

            if board_copy.add_move(movement).is_ok() {
                // Evaluar con Minimax (siguiente turno es del humano)
                let score = self.minimax(&board_copy, self.max_depth - 1, false);

                if score > best_score {
                    best_score = score;
                    best_move = Some(coords);
                }
            }
        }

        best_move
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Movement, GameY, Coordinates, PlayerId};

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
    fn test_minimax_bot_name() {
        let bot = MinimaxBot::new(None);
        assert_eq!(bot.name(), "minimax_bot");
    }

    #[test]
    fn test_minimax_bot_with_custom_depth() {
        let bot = MinimaxBot::new(Some(5));
        assert_eq!(bot.max_depth, 5);
    }

    #[test]
    fn test_evaluate_board_empty() {
        let bot = MinimaxBot::new(None);
        let game = GameY::new(3);
        let score = bot.evaluate_board(&game, BOT_PLAYER_ID);
        // En tablero vacío, la puntuación debería ser 0 o baja
        assert!(score >= 0);
    }

    #[test]
    fn test_evaluate_board_with_side_connection() {
        let bot = MinimaxBot::new(None);

        // Bot tiene una celda en lado A
        let game = create_test_game(3, vec![
            (2, 0, 0, BOT_PLAYER_ID),
        ]);

        let score = bot.evaluate_board(&game, BOT_PLAYER_ID);
        assert!(score > 0);
    }

    #[test]
    fn test_check_winner() {
        let bot = MinimaxBot::new(None);

        // Bot tiene celdas tocando los tres lados (victoria)
        let game = create_test_game(3, vec![
            (2, 0, 0, BOT_PLAYER_ID), // Lado A
            (0, 2, 0, BOT_PLAYER_ID), // Lado B
            (0, 0, 2, BOT_PLAYER_ID), // Lado C
        ]);

        assert!(bot.check_winner(&game, BOT_PLAYER_ID));
    }

    #[test]
    fn test_choose_move_on_empty_board() {
        let bot = MinimaxBot::new(Some(2)); // Profundidad baja para test rápido
        let game = GameY::new(3);

        let chosen = bot.choose_move(&game);
        assert!(chosen.is_some());

        let coords = chosen.unwrap();
        assert!(coords.x() < 3 && coords.y() < 3 && coords.z() < 3);
        assert_eq!(coords.x() + coords.y() + coords.z(), 2);
    }

    #[test]
    fn test_choose_move_with_no_available_cells() {
        let bot = MinimaxBot::new(None);
        let mut game = GameY::new(2);

        // Llenar todas las celdas
        let moves = vec![
            (1, 0, 0, 0),
            (0, 1, 0, 1),
            (0, 0, 1, 0),
        ];

        for (x, y, z, player_id) in moves {
            let coords = Coordinates::new(x, y, z);
            let movement = Movement::Placement {
                player: PlayerId::new(player_id),
                coords,
            };
            game.add_move(movement).unwrap();
        }

        let chosen = bot.choose_move(&game);
        assert!(chosen.is_none());
    }

    #[test]
    fn test_find_largest_connected_group() {
        let bot = MinimaxBot::new(None);
        let game = GameY::new(4);

        let cells = vec![
            Coordinates::new(3, 0, 0),
            Coordinates::new(2, 1, 0),
            Coordinates::new(0, 2, 1),
        ];

        let largest = bot.find_largest_connected_group(&cells, &game);
        assert_eq!(largest, Some(2)); // Las dos primeras están conectadas
    }
}