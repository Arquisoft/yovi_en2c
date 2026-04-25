Feature: Loading and error states

  Scenario: Statistics loading failure is shown
    Given I am logged in with a newly registered user
    And the statistics request fails
    When I go to the statistics page
    Then I should see a statistics error

  Scenario: Empty statistics state is shown
    Given I am logged in with a newly registered user
    And my statistics are empty
    When I go to the statistics page
    Then I should see the empty statistics state