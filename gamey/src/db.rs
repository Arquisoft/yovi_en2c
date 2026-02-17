use mongodb::{
    Client,
    options::ClientOptions,
    Collection,
};
use serde::{Serialize, Deserialize};
use std::env;

#[derive(Debug, Serialize, Deserialize)]
pub struct User {

    pub username: String,

}

pub struct Database {

    pub client: Client,

}

impl Database {

    pub async fn connect() -> Self {

        let uri = env::var("MONGODB_URI")
            .expect("MONGODB_URI not set");

        let options = ClientOptions::parse(uri)
            .await
            .expect("Failed to parse MongoDB URI");

        let client = Client::with_options(options)
            .expect("Failed to create MongoDB client");

        Database { client }

    }

    pub fn users_collection(&self) -> Collection<User> {

        self.client
            .database("gameofy")
            .collection::<User>("users")

    }

}
