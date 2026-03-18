Feature: Register
  Validate the register form

  Scenario: Successful registration
    Given the register page is open
    When I enter "Alice" as the username, "alice@uniovi.es" as the email, "123456" as the password and "123456" as the repeat password and submit
    Then I should be redirected to the login page