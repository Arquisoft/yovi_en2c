Feature: Hint button

  Scenario: Logged user can see and press the hint button
    Given I am logged in with a newly registered user
    And I am on a started game
    When I wait until the game is ready for hints
    Then the hint button should be visible
    When I request a hint
    Then the hint button should still be visible