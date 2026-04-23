Feature: Statistics error state

  Scenario: Logged user sees an error when statistics request fails
    Given I am logged in with a newly registered user
    And the statistics request fails
    When I go to the statistics page
    Then I should see a statistics error