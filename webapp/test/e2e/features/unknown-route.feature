Feature: Unknown routes
  Scenario: Unknown route redirects to login
    Given I open an unknown route
    Then I should land on the login route