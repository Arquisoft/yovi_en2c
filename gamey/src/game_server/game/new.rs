use axum::Json;
use serde::Deserialize;
use crate::{GameY, YEN};

#[derive(Deserialize)]
pub struct NewGameRequest {
    pub size: u32,
}

pub async fn new_game(
    Json(req): Json<NewGameRequest>,
) -> Json<YEN> {
    let game = GameY::new(req.size);
    let yen: YEN = (&game).into();
    Json(yen)
}

#[cfg(test)]
mod tests {
    use axum::http::{Request, StatusCode};
    use axum::body::Body;
    use tower::ServiceExt;
    use crate::game_server::state::AppState;
    use crate::bot::ybot_registry::YBotRegistry;

    fn build_app() -> axum::Router {
        let state = AppState::new(YBotRegistry::default());
        crate::game_server::create_router(state)
    }

    #[tokio::test]
    async fn test_new_game_valid_size() {
        let app = build_app();

        let response = app
            .oneshot(
                Request::post("/game/new")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"size":5}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_new_game_invalid_json() {
        let app = build_app();

        let response = app
            .oneshot(
                Request::post("/game/new")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"invalid"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_new_game_missing_content_type() {
        let app = build_app();

        let response = app
            .oneshot(
                Request::post("/game/new")
                    .body(Body::from(r#"{"size":5}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert!(response.status() == StatusCode::UNSUPPORTED_MEDIA_TYPE
            || response.status() == StatusCode::BAD_REQUEST);
    }
}
