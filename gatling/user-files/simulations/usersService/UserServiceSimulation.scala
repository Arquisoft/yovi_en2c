import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

class UserServiceSimulation extends Simulation {

  val httpProtocol = http
    .baseUrl("http://16.171.175.28:3000")
    .acceptHeader("application/json")
    .contentTypeHeader("application/json")

  val scn = scenario("User Service Load Test")
    // Health check
    .exec(
      http("Health Check")
        .get("/health")
    )

    // Create user
    .exec(
      http("Create User")
        .post("/createuser")
        .body(StringBody(
          """{
            "username": "user#{randomInt(1,1000)}",
            "email": "test#{randomInt(1,1000)}@mail.com",
            "password": "1234"
          }"""
        )).asJson
    )

    // Login
    .exec(
      http("Login")
        .post("/login")
        .body(StringBody(
          """{
            "username": "prueba1",
            "password": "prueba1"
          }"""
        )).asJson
    )

    // Get users
    .exec(
      http("Get Users")
        .get("/users")
    )

    // Save game result
    .exec(
      http("Game Result")
        .post("/gameresult")
        .body(StringBody(
          """{
            "username": "prueba1",
            "opponent": "cpu",
            "result": "win",
            "score": 10
          }"""
        )).asJson
    )

  setUp(
    scn.inject(
      atOnceUsers(5),        // start small
      rampUsers(20).during(20.seconds) // then increase
    )
  ).protocols(httpProtocol)
}