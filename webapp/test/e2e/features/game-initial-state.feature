Feature: Game initial state

  Scenario: New game starts with empty board and player turn
    Given I am logged in with a newly registered user
    And I start a new game
    Then the board should be empty
    And it should be the player's turn