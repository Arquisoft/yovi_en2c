Feature: Quick game
  Scenario: Logged user can start a quick game
    Given I am logged in with a newly registered user
    When I click the quick game button
    Then I should be on the game page