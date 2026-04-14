Feature: Home to instructions
  Scenario: Logged user opens instructions from home
    Given I am logged in with a newly registered user
    When I click the instructions button on the home page
    Then I should arrive at the instructions page