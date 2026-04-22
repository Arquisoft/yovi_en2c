Feature: Login
  Scenario: Successful login after registration
    Given the login page is open
    When I register a new valid user
    And I log in with that registered user
    Then I should be redirected to the home page