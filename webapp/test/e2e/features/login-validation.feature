Feature: Login validation
  Scenario: Login fails when username is empty
    Given the login page is open
    When I submit the login form without username
    Then I should see a login error message

  Scenario: Login fails when password is empty
    Given the login page is open
    When I submit the login form without password
    Then I should see a login error message