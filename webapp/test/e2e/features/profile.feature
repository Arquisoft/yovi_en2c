Feature: Profile page

  Scenario: Logged user can open their profile page
    Given I am logged in with a newly registered user
    When I go to my profile page
    Then I should be on my profile page