Feature: In-game instructions

  Scenario: Logged user can open instructions inside the game
    Given I am logged in with a newly registered user
    And I am on a started game
    When I open the in-game instructions
    Then I should see the how-to-play section