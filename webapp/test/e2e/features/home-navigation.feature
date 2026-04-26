Feature: Home navigation

  Scenario: Logged user can open local game flow from home
    Given I am logged in with a newly registered user
    When I click the local play card on the home page
    Then I should be on the difficulty selection page

  Scenario: Logged user can open multiplayer from home
    Given I am logged in with a newly registered user
    When I click the multiplayer card on the home page
    Then I should be on the multiplayer page

  Scenario: Logged user can open social from home
    Given I am logged in with a newly registered user
    When I click the social card on the home page
    Then I should be on the social page