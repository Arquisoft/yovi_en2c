use crate::{Coordinates, GameY};
use crate::bot::YBot;
use std::collections::HashSet;

pub struct HeuristicBot;

impl YBot for HeuristicBot {
    fn name(&self) -> &str {
        "heuristic_bot"
    }

    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        let my_cells = board.available_cells();

        if my_cells.is_empty() {
            return None;
        }

        let best_cell = my_cells
            .iter()
            .max_by_key(|&&cell| self.evaluate_cell(board, cell as usize))
            .copied()?;

        let coordinates = Coordinates::from_index(best_cell, board.board_size());
        Some(coordinates)
    }
}

impl HeuristicBot {
    fn evaluate_cell(&self, board: &GameY, cell_index: usize) -> i32 {
        let board_size = board.board_size();
        let coords = Coordinates::from_index(cell_index as u32, board_size);

        let mut score = 0;

        score += self.calculate_center_balance_score(board_size, coords);
        score += self.calculate_proximity_to_bot_cells(board, coords);
        score += self.calculate_blocking_score(board, coords);
        score += self.calculate_edge_bonus(coords);
        score += self.calculate_winning_potential(board, coords);
        score += self.calculate_edge_connection_bonus(board, coords);
        score -= self.calculate_opponent_threat_penalty(board, coords);

        score += self.calculate_side_connection_bonus(board, coords) * 3;
        score += self.calculate_bridge_potential(board, coords);
        score += self.calculate_central_control(board_size, coords);

        if self.check_side_connection_completed(board, coords) {
            score += 200;
        }

        score += self.calculate_block_opponent_connection(board, coords) * 4;
        score += self.calculate_winning_block_bonus(board, coords);

        score
    }

    fn calculate_center_balance_score(&self, board_size: u32, coords: Coordinates) -> i32 {
        let n = board_size as i32 - 1;

        let balance_score = 100 - (
            (coords.x() as i32 - coords.y() as i32).abs() +
                (coords.y() as i32 - coords.z() as i32).abs() +
                (coords.z() as i32 - coords.x() as i32).abs()
        ) * 2;

        let target = (n as f32 / 3.0).round() as i32;
        let center_distance = (coords.x() as i32 - target).abs() +
            (coords.y() as i32 - target).abs() +
            (coords.z() as i32 - target).abs();

        balance_score.max(0) + (n * 3 - center_distance) * 3
    }

    fn calculate_proximity_to_bot_cells(&self, board: &GameY, coords: Coordinates) -> i32 {
        let mut score = 0;
        let bot_cells = board.get_player_positions_coords();

        for &bot_cell in &bot_cells {
            let dist = board.manhattan_distance(coords, bot_cell);
            match dist {
                1 => score += 15,
                2 => score += 5,
                _ => {}
            }
        }

        score
    }

    fn calculate_blocking_score(&self, board: &GameY, coords: Coordinates) -> i32 {
        let mut score = 0;
        let opponent_cells = board.get_opponent_positions_coords();

        for &opp_cell in &opponent_cells {
            let dist = board.manhattan_distance(coords, opp_cell);
            if dist == 1 {
                score += 8;
            } else if dist == 2 {
                score += 2;
            }
        }

        score
    }

    fn calculate_edge_bonus(&self, coords: Coordinates) -> i32 {
        let sides_touched = [
            coords.touches_side_a(),
            coords.touches_side_b(),
            coords.touches_side_c()
        ].iter().filter(|&&b| b).count();

        match sides_touched {
            2 => 10,
            1 => 5,
            _ => 0,
        }
    }

    fn calculate_winning_potential(&self, board: &GameY, coords: Coordinates) -> i32 {
        let mut score = 0;
        let bot_cells = board.get_player_positions_coords();

        for &bot_cell in &bot_cells {
            let dist = board.manhattan_distance(coords, bot_cell);
            if dist == 1 {
                score += 5;
            }
        }

        score
    }

    fn calculate_edge_connection_bonus(&self, board: &GameY, coords: Coordinates) -> i32 {
        let mut score = 0;
        let bot_cells = board.get_player_positions_coords();

        let touches_a = coords.touches_side_a();
        let touches_b = coords.touches_side_b();
        let touches_c = coords.touches_side_c();

        let mut covered_edges = HashSet::new();
        for &bot_cell in &bot_cells {
            if bot_cell.touches_side_a() {
                covered_edges.insert('A');
            }
            if bot_cell.touches_side_b() {
                covered_edges.insert('B');
            }
            if bot_cell.touches_side_c() {
                covered_edges.insert('C');
            }
        }

        if touches_a && !covered_edges.contains(&'A') {
            score += 20;
        }
        if touches_b && !covered_edges.contains(&'B') {
            score += 20;
        }
        if touches_c && !covered_edges.contains(&'C') {
            score += 20;
        }

        let is_connected_to_bot = bot_cells.iter().any(|&bot_cell| {
            board.manhattan_distance(coords, bot_cell) == 1
        });

        if is_connected_to_bot {
            if touches_a || touches_b || touches_c {
                score += 15;
            }
        }

        score
    }

    fn calculate_opponent_threat_penalty(&self, board: &GameY, coords: Coordinates) -> i32 {
        let mut opponent_threat = 0;
        let opponent_cells = board.get_opponent_positions_coords();

        for &opp_cell in &opponent_cells {
            let dist = board.manhattan_distance(coords, opp_cell);
            if dist == 1 {
                opponent_threat += 3;
            }
        }

        if opponent_threat > 5 {
            opponent_threat * 2
        } else {
            0
        }
    }

    fn calculate_winning_block_bonus(&self, board: &GameY, coords: Coordinates) -> i32 {
        let mut score = 0;
        let opponent_cells = board.get_opponent_positions_coords();
        let bot_cells = board.get_player_positions_coords();

        for &_opp_cell in &opponent_cells {
            let mut temp_opponent_cells = opponent_cells.clone();
            temp_opponent_cells.push(coords);

            if self.check_winning_line(board, &temp_opponent_cells) {
                score += 50;
            }
        }

        let mut temp_bot_cells = bot_cells.clone();
        temp_bot_cells.push(coords);

        if self.check_winning_line(board, &temp_bot_cells) {
            score += 100;
        }

        score
    }

    fn calculate_side_connection_bonus(&self, board: &GameY, coords: Coordinates) -> i32 {
        let mut score = 0;

        if coords.touches_side_a() { score += 30; }
        if coords.touches_side_b() { score += 30; }
        if coords.touches_side_c() { score += 30; }

        let bot_cells = board.get_player_positions_coords();
        for &bot_cell in &bot_cells {
            if board.manhattan_distance(coords, bot_cell) == 1 {
                if coords.touches_side_a() { score += 20; }
                if coords.touches_side_b() { score += 20; }
                if coords.touches_side_c() { score += 20; }
            }
        }

        let sides_touched = [
            coords.touches_side_a(),
            coords.touches_side_b(),
            coords.touches_side_c()
        ].iter().filter(|&&b| b).count();

        if sides_touched >= 2 {
            score += 25;
        }

        score
    }

    fn calculate_bridge_potential(&self, board: &GameY, coords: Coordinates) -> i32 {
        let mut score = 0;
        let bot_cells = board.get_player_positions_coords();

        for &bot_cell in &bot_cells {
            let dist = board.manhattan_distance(coords, bot_cell);
            if dist == 2 {
                score += 10;

                let dx = (coords.x() as i32 - bot_cell.x() as i32).abs();
                let dy = (coords.y() as i32 - bot_cell.y() as i32).abs();
                let dz = (coords.z() as i32 - bot_cell.z() as i32).abs();

                if (dx == 1 && dy == 1 && dz == 0) ||
                    (dx == 1 && dy == 0 && dz == 1) ||
                    (dx == 0 && dy == 1 && dz == 1) {
                    score += 15;
                }
            }
        }

        score
    }

    fn calculate_central_control(&self, board_size: u32, coords: Coordinates) -> i32 {
        let n = board_size as i32 - 1;
        let center = n as f32 / 3.0;
        let center_rounded = center.round() as i32;

        let dx = (coords.x() as i32 - center_rounded).abs();
        let dy = (coords.y() as i32 - center_rounded).abs();
        let dz = (coords.z() as i32 - center_rounded).abs();

        (n * 3 - (dx + dy + dz)) * 5
    }

    fn check_side_connection_completed(&self, board: &GameY, coords: Coordinates) -> bool {
        let bot_cells = board.get_player_positions_coords();
        let mut temp_cells = bot_cells.clone();
        temp_cells.push(coords);

        let touches_a = temp_cells.iter().any(|c| c.touches_side_a());
        let touches_b = temp_cells.iter().any(|c| c.touches_side_b());
        let touches_c = temp_cells.iter().any(|c| c.touches_side_c());

        touches_a && touches_b && touches_c
    }

    fn calculate_block_opponent_connection(&self, board: &GameY, coords: Coordinates) -> i32 {
        let mut score = 0;
        let opponent_cells = board.get_opponent_positions_coords();

        if opponent_cells.is_empty() {
            return 0;
        }

        let opp_touches_a = opponent_cells.iter().any(|c| c.touches_side_a());
        let opp_touches_b = opponent_cells.iter().any(|c| c.touches_side_b());
        let opp_touches_c = opponent_cells.iter().any(|c| c.touches_side_c());

        let sides_touched = [opp_touches_a, opp_touches_b, opp_touches_c]
            .iter().filter(|&&b| b).count();

        if sides_touched >= 2 {
            for &opp_cell in &opponent_cells {
                let dist = board.manhattan_distance(coords, opp_cell);
                if dist <= 2 {
                    score += 40;

                    if !opp_touches_a && coords.touches_side_a() {
                        score += 30;
                    }
                    if !opp_touches_b && coords.touches_side_b() {
                        score += 30;
                    }
                    if !opp_touches_c && coords.touches_side_c() {
                        score += 30;
                    }
                }
            }
        } else if sides_touched == 1 {
            for &opp_cell in &opponent_cells {
                let dist = board.manhattan_distance(coords, opp_cell);
                if dist <= 2 {
                    score += 15;

                    if !opp_touches_a && coords.touches_side_a() {
                        score += 20;
                    }
                    if !opp_touches_b && coords.touches_side_b() {
                        score += 20;
                    }
                    if !opp_touches_c && coords.touches_side_c() {
                        score += 20;
                    }
                }
            }
        }

        score
    }

    fn check_winning_line(&self, board: &GameY, cells: &[Coordinates]) -> bool {
        if cells.is_empty() {
            return false;
        }

        let mut visited = HashSet::new();
        let mut stack = vec![cells[0]];
        visited.insert(cells[0]);

        while let Some(current) = stack.pop() {
            for &other in cells {
                if !visited.contains(&other) && board.manhattan_distance(current, other) == 1 {
                    visited.insert(other);
                    stack.push(other);
                }
            }
        }

        let touches_a = visited.iter().any(|c| c.touches_side_a());
        let touches_b = visited.iter().any(|c| c.touches_side_b());
        let touches_c = visited.iter().any(|c| c.touches_side_c());

        touches_a && touches_b && touches_c
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Movement, PlayerId};

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
    fn test_heuristic_bot_name() {
        let bot = HeuristicBot;
        assert_eq!(bot.name(), "heuristic_bot");
    }

    #[test]
    fn test_choose_move_with_empty_board() {
        let bot = HeuristicBot;
        let game = GameY::new(3);

        let chosen_move = bot.choose_move(&game);
        assert!(chosen_move.is_some());

        let coords = chosen_move.unwrap();
        assert!(coords.x() < 3 && coords.y() < 3 && coords.z() < 3);
        assert_eq!(coords.x() + coords.y() + coords.z(), 2);
    }

    #[test]
    fn test_choose_move_with_no_available_cells() {
        let bot = HeuristicBot;
        let mut game = GameY::new(2);

        let moves = vec![
            (1, 0, 0, 0),
            (0, 1, 0, 1),
            (0, 0, 1, 0),
        ];

        for (x, y, z, player) in moves {
            let coords = Coordinates::new(x, y, z);
            let movement = Movement::Placement {
                player: PlayerId::new(player),
                coords,
            };
            game.add_move(movement).unwrap();
        }

        let chosen_move = bot.choose_move(&game);
        assert!(chosen_move.is_none());
    }

    #[test]
    fn test_calculate_center_balance_score() {
        let bot = HeuristicBot;
        let board_size = 5;

        let center = Coordinates::new(1, 1, 2);
        let corner = Coordinates::new(4, 0, 0);
        let edge = Coordinates::new(2, 0, 2);

        let center_score = bot.calculate_center_balance_score(board_size, center);
        let corner_score = bot.calculate_center_balance_score(board_size, corner);
        let edge_score = bot.calculate_center_balance_score(board_size, edge);

        assert!(center_score > edge_score);
        assert!(edge_score > corner_score);
    }

    #[test]
    fn test_calculate_side_connection_bonus() {
        let bot = HeuristicBot;

        let game = create_test_game(4, vec![
            (3, 0, 0, 0),
        ]);

        let side_b = Coordinates::new(0, 3, 0);
        let side_a = Coordinates::new(3, 0, 1);
        let interior = Coordinates::new(1, 1, 1);

        let side_b_score = bot.calculate_side_connection_bonus(&game, side_b);
        let side_a_score = bot.calculate_side_connection_bonus(&game, side_a);
        let interior_score = bot.calculate_side_connection_bonus(&game, interior);

        assert!(side_b_score > interior_score);
        assert!(side_a_score > interior_score);
    }

    #[test]
    fn test_calculate_central_control() {
        let bot = HeuristicBot;
        let board_size = 5;

        let center = Coordinates::new(1, 1, 2);
        let corner = Coordinates::new(4, 0, 0);
        let edge = Coordinates::new(2, 0, 2);

        let center_score = bot.calculate_central_control(board_size, center);
        let corner_score = bot.calculate_central_control(board_size, corner);
        let edge_score = bot.calculate_central_control(board_size, edge);

        assert!(center_score > edge_score);
        assert!(edge_score > corner_score);
    }

    #[test]
    fn test_calculate_block_opponent_connection() {
        let bot = HeuristicBot;

        let game = create_test_game(5, vec![
            (4, 0, 0, 1),
            (0, 4, 0, 1),
            (2, 2, 0, 1),
        ]);

        let blocking = Coordinates::new(1, 1, 2);
        let far = Coordinates::new(0, 0, 4);

        let blocking_score = bot.calculate_block_opponent_connection(&game, blocking);
        let far_score = bot.calculate_block_opponent_connection(&game, far);

        assert!(blocking_score > far_score);
    }

    #[test]
    fn test_check_winning_line() {
        let bot = HeuristicBot;
        let game = GameY::new(3);

        let winning_line = vec![
            Coordinates::new(2, 0, 0),
            Coordinates::new(1, 1, 0),
            Coordinates::new(0, 2, 0),
        ];

        let line_of_2 = vec![
            Coordinates::new(2, 0, 0),
            Coordinates::new(1, 1, 0),
        ];

        let scattered = vec![
            Coordinates::new(2, 0, 0),
            Coordinates::new(0, 2, 0),
            Coordinates::new(0, 0, 2),
        ];

        assert!(bot.check_winning_line(&game, &winning_line));
        assert!(!bot.check_winning_line(&game, &line_of_2));
        assert!(!bot.check_winning_line(&game, &scattered));
    }

    #[test]
    fn test_multiple_evaluations_consistency() {
        let bot = HeuristicBot;
        let game = GameY::new(3);

        let cell_idx = 2;
        let score1 = bot.evaluate_cell(&game, cell_idx);
        let score2 = bot.evaluate_cell(&game, cell_idx);
        let score3 = bot.evaluate_cell(&game, cell_idx);

        assert_eq!(score1, score2);
        assert_eq!(score2, score3);
    }
}