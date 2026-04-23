import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

class GameFlowSimulation extends Simulation {

  val httpProtocol = http
    .baseUrl("https://gameofy.publicvm.com")
    .contentTypeHeader("application/json")
    .acceptHeader("application/json")

  val scn = scenario("Full Game Flow")

    // 1. Create game
    .exec(
      http("Create Game")
        .post("/api/game/new")
        .body(StringBody("""{ "size": 7 }"""))
        .check(status.is(200))
        .check(jsonPath("$.yen").saveAs("gameState"))
    )

    // 2. First move (simplified simulation)
    .exec(
      http("Make Move")
        .post("/api/game/pvb/move")
        .body(StringBody("""
        {
          "yen": ${gameState},
          "bot": "random_bot",
          "row": 1,
          "col": 1
        }
        """))
        .check(status.in(200, 201))
        .check(jsonPath("$.finished").optional.saveAs("finished"))
    )

    // 3. Record result (only sometimes)
    .doIf(session => session("finished").asOption[String].contains("true")) {
      exec(
        http("Save Result")
          .post("/api/gameresult")
          .body(StringBody("""
          {
            "username": "gatling_user",
            "opponent": "random_bot",
            "result": "win",
            "score": 10
          }
          """))
      )
    }

  setUp(
    scn.inject(
      rampUsers(50).during(30.seconds)
    )
  ).protocols(httpProtocol)
}