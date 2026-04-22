Feature: Empty statistics

  Scenario: Logged user sees empty statistics state when there is no history
    Given I am logged in with a newly registered user
    And my statistics are empty
    When I go to the statistics page
    Then I should see the empty statistics state