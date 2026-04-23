Feature: Difficulty selection

  Scenario: Logged user can open difficulty selection and choose a difficulty
    Given I am logged in with a newly registered user
    When I go to the difficulty selection page
    And I choose the "Easy" difficulty
    Then the play button should be enabled

  Scenario: Logged user can start a game with selected difficulty
    Given I am logged in with a newly registered user
    When I go to the difficulty selection page
    And I choose the "Medium" difficulty
    And I start the selected game
    Then I should be on the game page