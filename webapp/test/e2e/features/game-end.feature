Feature: Game end

  Scenario: Game ends and shows winner
    Given I am logged in with a newly registered user
    And I am on a nearly finished game
    When the last move is played
    Then I should see the winner
    And the game should be finished