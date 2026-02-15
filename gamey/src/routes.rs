//routes
use axum::{
    extract::State,
    Json,
};
use serde::Serialize;
use std::sync::Arc;

use crate::db::{Database, User};

#[derive(Serialize)]
pub struct MeResponse {

    pub username: String,

}

pub async fn get_me(
    State(db): State<Arc<Database>>
) -> Json<MeResponse> {

    let users = db.users_collection();

    let user: Option<User> = users
        .find_one(None, None)
        .await
        .expect("DB error");

    match user {

        Some(u) => Json(MeResponse {
            username: u.username
        }),

        None => Json(MeResponse {
            username: "Guest".to_string()
        })

    }

}