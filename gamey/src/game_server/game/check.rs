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
