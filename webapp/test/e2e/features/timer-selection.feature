Feature: Timer selection

  Scenario: Logged user can start a game with 15 second timer
    Given I am logged in with a newly registered user
    When I go to the difficulty selection page
    And I choose the "Easy" difficulty
    And I choose the timer "15s"
    And I start the selected game
    Then I should be on the game page
    And the game board should be visible

  Scenario: Logged user can start a game with 30 second timer
    Given I am logged in with a newly registered user
    When I go to the difficulty selection page
    And I choose the "Easy" difficulty
    And I choose the timer "30s"
    And I start the selected game
    Then I should be on the game page