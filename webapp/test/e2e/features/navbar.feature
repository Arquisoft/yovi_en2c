Feature: Navbar navigation

  Scenario: Logged user can navigate to home from navbar
    Given I am logged in with a newly registered user
    When I click the navbar home link
    Then I should still be on the home page

  Scenario: Logged user can navigate to multiplayer from navbar
    Given I am logged in with a newly registered user
    When I click the navbar multiplayer link
    Then I should be on the multiplayer page

  Scenario: Logged user can navigate to social from navbar
    Given I am logged in with a newly registered user
    When I click the navbar social link
    Then I should be on the social page

  Scenario: Logged user can navigate to statistics from navbar
    Given I am logged in with a newly registered user
    When I click the navbar statistics link
    Then I should be on the statistics page

  Scenario: Logged user sees their username in navbar
    Given I am logged in with a newly registered user
    Then I should see my username