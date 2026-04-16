Feature: Login navigation
  Scenario: User can go from login to register page
    Given the login page is open
    When I click the go to register link
    Then I should see the register page