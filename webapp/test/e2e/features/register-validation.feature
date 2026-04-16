Feature: Register validation
  Scenario: Registration fails when passwords do not match
    Given the register page is open
    When I enter "Alice" as the username, "alice@uniovi.es" as the email, "123456" as the password and "654321" as the repeat password and submit
    Then I should see a register error message