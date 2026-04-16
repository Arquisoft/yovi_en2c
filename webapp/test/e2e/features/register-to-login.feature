Feature: Register navigation
  Scenario: User can go from register to login page
    Given the register page is open
    When I click the go to login link
    Then I should see the login page