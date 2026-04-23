Feature: Board size selection

  Scenario: Logged user can start a game with board size 9
    Given I am logged in with a newly registered user
    When I go to the difficulty selection page
    And I choose the "Easy" difficulty
    And I choose the preset board size "9"
    And I start the selected game
    Then I should be on the game page
    And the game board should be visible

  Scenario: Logged user can start a game with board size 11
    Given I am logged in with a newly registered user
    When I go to the difficulty selection page
    And I choose the "Easy" difficulty
    And I choose the preset board size "11"
    And I start the selected game
    Then I should be on the game page
    And the game board should be visible