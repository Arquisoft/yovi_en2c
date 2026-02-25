use rand::seq::IteratorRandom; // Necesitarás añadir esta importación

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

        // gets the best cell iterating over all the available ones
        let best_cell = my_cells
            .iter()
            .max_by_key(|&&cell| self.evaluate_cell(board, cell))
            .copied()?;

        let coordinates = Coordinates::from_index(best_cell, board.board_size());
        Some(coordinates)
    }
}

impl HeuristicBot {
    fn evaluate_cell(&self, board: &GameY, cell_index: usize) -> i32 {
        let board_size = board.board_size();
        let coords = Coordinates::from_index(cell_index, board_size);

        let mut score = 0;

        // As closer to the center better
        let center = (board_size / 2) as i32;
        let distance_to_center = ((coords.x() as i32 - center).abs() +
            (coords.y() as i32 - center).abs() +
            (coords.z() as i32 - center).abs()) / 2;
        score += (board_size as i32 * 2) - distance_to_center;

        // If it is connected to our pieces better
        let our_positions = board.get_player_positions_coords();
        for our_pos in our_positions {
            let dist = board.manhattan_distance(coords, our_pos);
            if dist == 1 {
                score += 10; // Adyacente a una de nuestras piezas (muy bueno)
            } else if dist == 2 {
                score += 3;  // A dos de distancia (potencial conexión)
            }
        }

        // If it blocks the opponent better
        let opponent_positions = board.get_opponent_positions_coords();
        for opp_pos in opponent_positions {
            let dist = board.manhattan_distance(coords, opp_pos);
            if dist == 1 {
                score += 5;  // Adyacente al oponente (bueno para bloquear)
            }
        }

        // Prefers the corners of the board
        if coords.x() == 0 || coords.y() == 0 || coords.z() == 0 {
            if coords.x() == 0 && coords.y() == 0 ||
                coords.x() == 0 && coords.z() == 0 ||
                coords.y() == 0 && coords.z() == 0 {
                // A corner
                score += 5;
            } else {
                // A border
                score += 2;
            }
        }

        score
    }
}